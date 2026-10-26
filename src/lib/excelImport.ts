/**
 * Excel → PMT import engine.
 *
 * Pure, React-free module so it can be unit-tested in Node and reused by the
 * Import wizard. Parses a workbook, extracts the project table, maps every
 * source column onto the PMT schema, validates each row, and builds an
 * import plan the store commits atomically.
 *
 * Design rules (per migration spec):
 *  - Never invent data: blank/NA stays blank/NA, never coerced to 0 or a date.
 *  - Never silently overwrite: existing records matched by normalized name are
 *    flagged as duplicates and skipped.
 *  - Preserve provenance: every created record carries importMeta
 *    (batchId, file, sheet, row, raw source status).
 */

import type { AppData, Client, Project, ProjectStatus } from '../store'

// ---------------------------------------------------------------------------
// XLSX loader — reuses the vendored SheetJS bundle (public/sprintiq/vendor)
// so the React bundle stays lean. Node tests inject their own global.
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    XLSX?: any
    make_xlsx_lib?: (target: any) => void
  }
}

let xlsxPromise: Promise<any> | null = null

export function loadXlsx(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('XLSX loader requires a browser'))
  if ((window.XLSX && typeof window.XLSX.read === 'function')) return Promise.resolve(window.XLSX)
  if (!xlsxPromise) {
    xlsxPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = '/sprintiq/vendor/xlsx.full.min.js'
      script.onload = () => {
        // The vendor bundle exposes an empty XLSX global plus a factory
        if (window.XLSX && typeof window.XLSX.read !== 'function' && typeof window.make_xlsx_lib === 'function') {
          try { window.make_xlsx_lib(window.XLSX) } catch { /* already initialised */ }
        }
        if (window.XLSX && typeof window.XLSX.read === 'function') resolve(window.XLSX)
        else reject(new Error('Spreadsheet engine failed to initialise.'))
      }
      script.onerror = () => reject(new Error('Could not load the spreadsheet engine.'))
      document.head.appendChild(script)
    })
  }
  return xlsxPromise
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SourceRow {
  /** 1-based row index in the sheet, for auditability */
  rowNumber: number
  cells: Record<string, string>
}

export type RowDisposition = 'create' | 'duplicate' | 'error'

export interface PlannedProject {
  rowNumber: number
  disposition: RowDisposition
  issues: string[]
  project: Omit<Project, 'id'>
  clientName: string
  clientKey: string
  projectKey: string
  /** raw source cells — kept in the batch record's snapshot */
  source: Record<string, string>
}

export interface PlannedClient {
  name: string
  clientKey: string
  sourceRow: number
}

export interface ImportPlan {
  sheetName: string
  headerRow: number
  rows: PlannedProject[]
  clientsToCreate: PlannedClient[]
  summary: {
    totalRows: number
    create: number
    duplicates: number
    errors: number
    statusCounts: Record<string, number>
    financials: { budgetTotal: number | null; invoiceTotal: number | null; currencySeen: string[] }
    blanksPreserved: number
    warnings: string[]
  }
}

// ---------------------------------------------------------------------------
// Normalizers — conservative; never invent values
// ---------------------------------------------------------------------------

const normName = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')

const cellText = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim())

const isNA = (s: string) => /^\s*(na|n\/a|-)\s*$/i.test(s)

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
}

/**
 * Parse loose ordinal dates like "16th June,2026", "21th Sep, 2026",
 * "30-March-2026", "13/10/2025". Returns 'YYYY-MM-DD' or '' when not parseable.
 * NA/blank → ''.
 */
export function parseSourceDate(raw: string): { iso: string; warning?: string } {
  const s = cellText(raw)
  if (!s || isNA(s)) return { iso: '' }

  // Excel serial numbers (e.g. 46123) — unlikely here but cheap to support
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Number(s)
    const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
    return { iso: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}` }
  }

  // "16th June,2026" / "21th Sep, 2026" / "3rd Aug,2026"
  const ordinal = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)\s*,?\s*(\d{4})$/)
  if (ordinal) {
    const month = MONTHS[ordinal[2].toLowerCase()]
    if (month !== undefined) {
      return { iso: `${ordinal[3]}-${String(month + 1).padStart(2, '0')}-${ordinal[1].padStart(2, '0')}` }
    }
    return { iso: '', warning: `Unparseable date "${s}"` }
  }

  // "30-March-2026" / "31-July-2026"
  const dashed = s.match(/^(\d{1,2})-([a-zA-Z]+)-(\d{4})$/)
  if (dashed) {
    const month = MONTHS[dashed[2].toLowerCase()]
    if (month !== undefined) {
      return { iso: `${dashed[3]}-${String(month + 1).padStart(2, '0')}-${dashed[1].padStart(2, '0')}` }
    }
    return { iso: '', warning: `Unparseable date "${s}"` }
  }

  // "16/05/2026" (day/month/year — UK workbook)
  const slash = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
  if (slash) {
    const [, d, m, y] = slash
    return { iso: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` }
  }

  // ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { iso: s }

  return { iso: '', warning: `Unparseable date "${s}"` }
}

const STATUS_MAP: Record<string, { status: ProjectStatus; progress: number; note?: string }> = {
  'in progress': { status: 'In Progress', progress: 0 },
  'in-progress': { status: 'In Progress', progress: 0 },
  'inprogress': { status: 'In Progress', progress: 0 },
  'done': { status: 'Completed', progress: 100 },
  'completed': { status: 'Completed', progress: 100 },
  'finished': { status: 'Completed', progress: 100 },
  'on hold': { status: 'On Hold', progress: 0 },
  'on-hold': { status: 'On Hold', progress: 0 },
  'onhold': { status: 'On Hold', progress: 0 },
  'to do': { status: 'Planning', progress: 0 },
  'to-do': { status: 'Planning', progress: 0 },
  'todo': { status: 'Planning', progress: 0 },
  'not started': { status: 'Planning', progress: 0 },
  'planning': { status: 'Planning', progress: 0 },
  // "BackedOff" = client backed off — closest PMT state is On Hold; flagged.
  'backedoff': { status: 'On Hold', progress: 0, note: 'Source status "BackedOff" mapped to On Hold — original preserved in import metadata' },
  'backed off': { status: 'On Hold', progress: 0, note: 'Source status "Backed Off" mapped to On Hold — original preserved in import metadata' },
  'backoff': { status: 'On Hold', progress: 0, note: 'Source status "Backoff" mapped to On Hold — original preserved in import metadata' },
  'cancelled': { status: 'On Hold', progress: 0, note: 'Source status "Cancelled" mapped to On Hold — original preserved in import metadata' },
}

/** Keep raw money text ("£ 4,000.00", "NA", "") — never coerced to a number. */
const moneyText = (v: unknown): string => {
  const s = cellText(v)
  return s
}

/** Extract a numeric value from a money string for reconciliation totals only. */
export function moneyNumber(s: string): number | null {
  if (!s || isNA(s)) return null
  const n = Number(s.replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------------
// Sheet → row extraction
// ---------------------------------------------------------------------------

/**
 * Find the data table inside a sheet that may contain dashboard chrome above it.
 * The header row is the first row containing both "Project Name"-ish and
 * "Client Name"-ish cells.
 */
export function extractProjectRows(rows2D: unknown[][]): { headers: string[]; headerRow: number; rows: SourceRow[] } | null {
  const text = (r: unknown[]) => r.map((c) => cellText(c).toLowerCase())

  for (let i = 0; i < rows2D.length; i++) {
    const cells = text(rows2D[i])
    const hasProject = cells.some((c) => c === 'project name' || c === 'project' || c.includes('project name'))
    const hasClient = cells.some((c) => c === 'client name' || c === 'customer' || c.includes('client name'))
    if (hasProject && hasClient) {
      const headers = rows2D[i].map((c, idx) => cellText(c) || `Column ${idx + 1}`)
      const rows: SourceRow[] = []
      for (let r = i + 1; r < rows2D.length; r++) {
        const raw = rows2D[r]
        if (!raw || raw.every((c) => !cellText(c))) continue // skip blank rows
        const cells: Record<string, string> = {}
        headers.forEach((h, idx) => { cells[h] = cellText(raw[idx]) })
        rows.push({ rowNumber: r + 1, cells })
      }
      return { headers, headerRow: i + 1, rows }
    }
  }
  return null
}

// Column lookup tolerant of minor header spelling differences
const pick = (cells: Record<string, string>, ...aliases: string[]): string => {
  const keys = Object.keys(cells)
  for (const alias of aliases) {
    const key = keys.find((k) => k.toLowerCase() === alias.toLowerCase())
    if (key !== undefined) return cells[key]
  }
  for (const alias of aliases) {
    const key = keys.find((k) => k.toLowerCase().includes(alias.toLowerCase()))
    if (key !== undefined) return cells[key]
  }
  return ''
}

// ---------------------------------------------------------------------------
// Plan builder
// ---------------------------------------------------------------------------

export interface BuildPlanOptions {
  sheetName: string
  headerRow?: number
  sourceRows: SourceRow[]
  existing: Pick<AppData, 'projects' | 'clients'>
  fileName: string
}

export function buildImportPlan({ sheetName, headerRow = 0, sourceRows, existing, fileName }: BuildPlanOptions): ImportPlan {
  const existingClientKeys = new Set(existing.clients.map((c) => normName(c.name)))
  const existingProjectKeys = new Set(existing.projects.map((p) => `${normName(p.client)}|${normName(p.name)}`))
  const seenProjectKeys = new Set<string>()
  const newClientKeys = new Set<string>()
  const clientsToCreate: PlannedClient[] = []

  const rows: PlannedProject[] = []
  const warnings: string[] = []
  const statusCounts: Record<string, number> = {}
  let budgetTotal = 0
  let invoiceTotal = 0
  let budgetSeen = false
  let invoiceSeen = false
  const currencies = new Set<string>()
  let blanksPreserved = 0

  for (const row of sourceRows) {
    const issues: string[] = []
    const cells = row.cells

    const projectClass = pick(cells, 'Project Type')
    const clientName = pick(cells, 'Client Name', 'Customer')
    const projectName = pick(cells, 'Project Name')
    const sourceStatus = pick(cells, 'Current Status', 'Status')
    const service = pick(cells, 'Service')
    const onboardRaw = pick(cells, 'Onboarding Date', 'Onboarding', 'Start Date')
    const deadlineRaw = pick(cells, 'Deadline', 'End Date')
    const cost = moneyText(pick(cells, 'Project Cost', 'Cost', 'Total Cost'))
    const invoice = moneyText(pick(cells, 'Inc VAT (Invoice Value)', 'Invoice Value', 'Inc VAT'))
    const payFreq = cellText(pick(cells, 'Payment Frequence', 'Payment Frequency'))
    const collected = moneyText(pick(cells, 'Collected Amount', 'Collected'))
    const pending = moneyText(pick(cells, 'Amount Pending', 'Pending'))
    const comments = pick(cells, 'Comments', 'Notes')

    if (!projectName.trim()) {
      rows.push({
        rowNumber: row.rowNumber,
        disposition: 'error',
        issues: ['Missing project name — row skipped'],
        project: blankProject(),
        clientName, clientKey: normName(clientName), projectKey: '',
        source: { ...cells },
      })
      continue
    }
    if (!clientName.trim()) issues.push('Missing client name — imported without a linked client')

    const onboard = parseSourceDate(onboardRaw)
    const deadline = parseSourceDate(deadlineRaw)
    if (onboard.warning) issues.push(`Onboarding date: ${onboard.warning}`)
    if (deadline.warning) issues.push(`Deadline: ${deadline.warning}`)

    const statusKey = sourceStatus.trim().toLowerCase().replace(/[\s_-]+/g, ' ')
    const mapped = STATUS_MAP[statusKey] ?? STATUS_MAP[statusKey.replace(/ /g, '')]
    let status: ProjectStatus
    let progress: number
    if (mapped) {
      status = mapped.status
      progress = mapped.progress
      if (mapped.note) issues.push(mapped.note)
    } else if (!sourceStatus.trim()) {
      status = 'Planning'
      progress = 0
      issues.push('Missing status — defaulted to Planning (original blank preserved in import metadata)')
    } else {
      status = 'Planning'
      progress = 0
      issues.push(`Unknown status "${sourceStatus}" — defaulted to Planning (original preserved in import metadata)`)
    }
    statusCounts[sourceStatus.trim() || '(blank)'] = (statusCounts[sourceStatus.trim() || '(blank)'] ?? 0) + 1

    const budgetNum = moneyNumber(cost)
    if (budgetNum !== null) { budgetTotal += budgetNum; budgetSeen = true }
    const invoiceNum = moneyNumber(invoice)
    if (invoiceNum !== null) { invoiceTotal += invoiceNum; invoiceSeen = true }
    const cur = cost.match(/[£$€]/)?.[0] ?? invoice.match(/[£$€]/)?.[0]
    if (cur) currencies.add(cur)

    blanksPreserved += [onboardRaw, deadlineRaw, cost, invoice, payFreq, collected, pending]
      .filter((v) => !v || isNA(v)).length

    const clientKey = normName(clientName)
    const projectKey = `${clientKey}|${normName(projectName)}`

    let disposition: RowDisposition = 'create'
    if (existingProjectKeys.has(projectKey)) {
      disposition = 'duplicate'
      issues.push('Already exists in PMT — skipped (no overwrite)')
    } else if (seenProjectKeys.has(projectKey)) {
      disposition = 'duplicate'
      issues.push('Duplicate row inside the import file — skipped')
    }
    seenProjectKeys.add(projectKey)

    if (disposition === 'create' && clientName.trim() && !existingClientKeys.has(clientKey) && !newClientKeys.has(clientKey)) {
      newClientKeys.add(clientKey)
      clientsToCreate.push({ name: clientName.trim(), clientKey, sourceRow: row.rowNumber })
    }

    const project: Omit<Project, 'id'> = {
      name: projectName.trim(),
      client: clientName.trim(),
      manager: '',
      status,
      health: 'Green',
      progress,
      priority: 'Medium',
      start: onboard.iso,
      end: deadline.iso,
      type: service.trim(),
      budget: cost,
      estimatedHours: 0,
      actualHours: 0,
      description: '',
      notes: comments,
      invoiceValue: invoice,
      collectedAmount: collected,
      amountPending: pending,
      paymentFrequency: payFreq,
      importMeta: {
        batchId: '', // filled at commit time
        sourceFile: fileName,
        sourceSheet: sheetName,
        sourceRow: row.rowNumber,
        sourceStatus: sourceStatus.trim(),
        projectClass: projectClass.trim(),
      },
    }

    rows.push({
      rowNumber: row.rowNumber,
      disposition,
      issues,
      project,
      clientName: clientName.trim(),
      clientKey,
      projectKey,
      source: { ...cells },
    })
  }

  if (!existingProjectKeys.size && !seenProjectKeys.size) {
    // unreachable, but keeps the flag meaningful
  }

  return {
    sheetName,
    headerRow,
    rows,
    clientsToCreate,
    summary: {
      totalRows: sourceRows.length,
      create: rows.filter((r) => r.disposition === 'create').length,
      duplicates: rows.filter((r) => r.disposition === 'duplicate').length,
      errors: rows.filter((r) => r.disposition === 'error').length,
      statusCounts,
      financials: {
        budgetTotal: budgetSeen ? Math.round(budgetTotal * 100) / 100 : null,
        invoiceTotal: invoiceSeen ? Math.round(invoiceTotal * 100) / 100 : null,
        currencySeen: [...currencies],
      },
      blanksPreserved,
      warnings,
    },
  }
}

const blankProject = (): Omit<Project, 'id'> => ({
  name: '', client: '', manager: '', status: 'Planning', health: 'Green', progress: 0,
  priority: 'Medium', start: '', end: '', type: '', budget: '', estimatedHours: 0,
  actualHours: 0, description: '', notes: '',
})

// ---------------------------------------------------------------------------
// Commit payloads — what the store writes in one transaction
// ---------------------------------------------------------------------------

export interface CommitPayload {
  clients: Omit<Client, 'id'>[]
  projects: Omit<Project, 'id'>[]
  batch: {
    fileName: string
    sheetName: string
    headerRow: number
    totalRows: number
    importedProjects: number
    importedClients: number
    duplicates: number
    errors: number
    warnings: string[]
    /** full raw rows — auditable snapshot of what was in the file */
    sourceSnapshot: { rowNumber: number; cells: Record<string, string> }[]
  }
}

export function buildCommitPayload(plan: ImportPlan, fileName: string, batchId: string): CommitPayload {
  const clients: Omit<Client, 'id'>[] = plan.clientsToCreate.map((c) => ({
    name: c.name,
    company: c.name,
    contact: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
    requirements: '',
    pendingApprovals: '',
    importMeta: { batchId, sourceFile: fileName, sourceSheet: plan.sheetName, sourceRow: c.sourceRow },
  }))

  const projects = plan.rows
    .filter((r) => r.disposition === 'create')
    .map((r) => ({
      ...r.project,
      importMeta: r.project.importMeta ? { ...r.project.importMeta, batchId } : r.project.importMeta,
    }))

  return {
    clients,
    projects,
    batch: {
      fileName,
      sheetName: plan.sheetName,
      headerRow: plan.headerRow,
      totalRows: plan.rows.length,
      importedProjects: projects.length,
      importedClients: clients.length,
      duplicates: plan.summary.duplicates,
      errors: plan.summary.errors,
      warnings: plan.rows.flatMap((r) => r.issues.map((i) => `Row ${r.rowNumber}: ${i}`)),
      sourceSnapshot: plan.rows.map((r) => ({ rowNumber: r.rowNumber, cells: r.source })),
    },
  }
}
