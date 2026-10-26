import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, RotateCcw } from 'lucide-react'
import { useApp } from '../store'
import { Badge, Button, Modal } from './ui'
import {
  buildCommitPayload,
  buildImportPlan,
  extractProjectRows,
  loadXlsx,
  type ImportPlan,
  type SourceRow,
} from '../lib/excelImport'

type Step = 'upload' | 'preview' | 'done'

interface ParsedSheet {
  name: string
  headers: string[]
  headerRow: number
  rows: SourceRow[]
}

const dispositionTone = { create: 'green', duplicate: 'amber', error: 'red' } as const
const dispositionLabel = { create: 'Import', duplicate: 'Duplicate — skip', error: 'Error — skip' } as const

// Migration scope: only the "New Projects_July" tab is imported.
const ALLOWED_SHEET = 'new projects july'
const normSheet = (name: string) => name.toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim()

export function ImportExcelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { projects, clients, importBatches, applyImport, rollbackImport } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [busy, setBusy] = useState(false)
  const [fileName, setFileName] = useState('')
  const [sheets, setSheets] = useState<ParsedSheet[]>([])
  const [sheetName, setSheetName] = useState('')
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [parseError, setParseError] = useState('')
  const [committed, setCommitted] = useState<{ batchId: string; projects: number; clients: number } | null>(null)
  const [excluded, setExcluded] = useState<Set<number>>(new Set())

  const reset = () => {
    setStep('upload'); setBusy(false); setFileName(''); setSheets([]); setSheetName('')
    setPlan(null); setParseError(''); setCommitted(null); setExcluded(new Set())
  }

  const close = () => { reset(); onClose() }

  const handleFile = async (file: File) => {
    setBusy(true)
    setParseError('')
    try {
      const XLSX = await loadXlsx()
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: false })
      const found: ParsedSheet[] = []
      for (const name of wb.SheetNames) {
        if (normSheet(name) !== ALLOWED_SHEET) continue // migration scope: New Projects_July only
        const rows2D = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }) as unknown[][]
        const extracted = extractProjectRows(rows2D)
        if (extracted && extracted.rows.length > 0) {
          found.push({ name, headers: extracted.headers, headerRow: extracted.headerRow, rows: extracted.rows })
        }
      }
      if (!found.length) {
        const names = wb.SheetNames.join(', ')
        setParseError(`This import only accepts the "New Projects_July" tab — it was not found in this workbook. Sheets present: ${names}`)
        setBusy(false)
        return
      }
      setFileName(file.name)
      setSheets(found)
      // Prefer the "New Projects_July" sheet when present, else first detected table
      const preferred = found.find((s) => s.name.trim().toLowerCase() === 'new projects_july') ?? found[0]
      setSheetName(preferred.name)
      setPlan(buildImportPlan({ sheetName: preferred.name, headerRow: preferred.headerRow, sourceRows: preferred.rows, existing: { projects, clients }, fileName: file.name }))
      setStep('preview')
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Could not read that file.')
    }
    setBusy(false)
  }

  const changeSheet = (name: string) => {
    const sheet = sheets.find((s) => s.name === name)
    if (!sheet) return
    setSheetName(name)
    setExcluded(new Set())
    setPlan(buildImportPlan({ sheetName: sheet.name, headerRow: sheet.headerRow, sourceRows: sheet.rows, existing: { projects, clients }, fileName }))
  }

  const toggleRow = (rowNumber: number) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(rowNumber)) next.delete(rowNumber)
      else next.add(rowNumber)
      return next
    })
  }

  const effectivePlan = useMemo<ImportPlan | null>(() => {
    if (!plan) return null
    const rows = plan.rows.map((r) =>
      r.disposition === 'create' && excluded.has(r.rowNumber)
        ? { ...r, disposition: 'duplicate' as const, issues: [...r.issues, 'Excluded by reviewer'] }
        : r,
    )
    const usedClientKeys = new Set(rows.filter((r) => r.disposition === 'create').map((r) => r.clientKey))
    return {
      ...plan,
      rows,
      clientsToCreate: plan.clientsToCreate.filter((c) => usedClientKeys.has(c.clientKey)),
      summary: {
        ...plan.summary,
        create: rows.filter((r) => r.disposition === 'create').length,
        // Real duplicates only — reviewer-excluded rows are counted separately via `excluded`
        duplicates: plan.summary.duplicates,
      },
    }
  }, [plan, excluded])

  const commit = () => {
    if (!effectivePlan) return
    const batchId = `pending-${Date.now()}`
    const payload = buildCommitPayload(effectivePlan, fileName, batchId)
    const batch = applyImport(payload)
    setCommitted({ batchId: batch.id, projects: payload.projects.length, clients: payload.clients.length })
    setStep('done')
  }

  const doneBatches = (importBatches ?? []).filter((b) => !b.rolledBack)

  return (
    <Modal open={open} title="Import projects from Excel" onClose={close} wide footer={
      step === 'upload' ? undefined
        : step === 'preview' ? (
          <>
            <Button variant="secondary" onClick={() => setStep('upload')}>Back</Button>
            <Button onClick={commit} disabled={!effectivePlan || effectivePlan.summary.create === 0}>
              Import {effectivePlan?.summary.create ?? 0} project{effectivePlan?.summary.create === 1 ? '' : 's'}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={close}>Done</Button>
        )
    }>
      {step === 'upload' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-[#fafaf8] px-6 py-10 text-center transition hover:border-[#c9cbc5] hover:bg-[#f4f4f1]"
          >
            <FileSpreadsheet size={28} className="text-muted" />
            <span className="text-[13px] font-semibold text-ink">{busy ? 'Reading file…' : 'Choose an Excel file (.xlsx / .xls)'}</span>
            <span className="text-[11px] text-muted">The project table is auto-detected — nothing is imported until you confirm.</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
          />
          {parseError && <p className="rounded-lg bg-red/10 px-3 py-2 text-[12px] text-red">{parseError}</p>}

          {doneBatches.length > 0 && (
            <div className="rounded-lg border border-line">
              <p className="border-b border-line px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Import history</p>
              {doneBatches.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px] last:border-0 odd:bg-[#fafaf8]">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{b.fileName} <span className="text-muted">· {b.sheetName}</span></p>
                    <p className="text-[10px] text-muted">
                      {b.importedProjects} projects, {b.importedClients} clients · {b.duplicates} duplicates skipped · {new Date(b.importedAt).toLocaleString()}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => { if (window.confirm(`Roll back this import? It removes the ${b.importedProjects} projects and ${b.importedClients} clients it created. Pre-existing records are untouched.`)) rollbackImport(b.id) }}>
                    <span className="flex items-center gap-1"><RotateCcw size={12} /> Undo</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'preview' && effectivePlan && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{fileName}</Badge>
            {sheets.length > 1 ? (
              <select value={sheetName} onChange={(e) => changeSheet(e.target.value)} className="h-[32px] rounded-lg border border-line bg-white px-2 text-[11px] text-ink outline-none">
                {sheets.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.rows.length} rows)</option>)}
              </select>
            ) : (
              <Badge tone="neutral">Sheet: {sheetName}</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-[#f4f4f1] p-3"><p className="text-[10px] font-semibold uppercase text-muted">Source rows</p><p className="text-[18px] font-semibold text-ink">{effectivePlan.summary.totalRows}</p></div>
            <div className="rounded-lg bg-green/10 p-3"><p className="text-[10px] font-semibold uppercase text-green">Will import</p><p className="text-[18px] font-semibold text-green">{effectivePlan.summary.create}</p></div>
            <div className="rounded-lg bg-amber/10 p-3"><p className="text-[10px] font-semibold uppercase text-amber">Skipped</p><p className="text-[18px] font-semibold text-amber">{effectivePlan.summary.duplicates + excluded.size}</p></div>
            <div className="rounded-lg bg-red/10 p-3"><p className="text-[10px] font-semibold uppercase text-red">Errors</p><p className="text-[18px] font-semibold text-red">{effectivePlan.summary.errors}</p></div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line p-3 text-[11px]">
              <p className="mb-1.5 font-semibold text-ink">Clients</p>
              <p className="text-muted">{effectivePlan.clientsToCreate.length} new client{effectivePlan.clientsToCreate.length === 1 ? '' : 's'} will be created; existing clients are reused by name.</p>
            </div>
            <div className="rounded-lg border border-line p-3 text-[11px]">
              <p className="mb-1.5 font-semibold text-ink">Financial totals (source)</p>
              <p className="text-muted">
                Cost: {effectivePlan.summary.financials.budgetTotal !== null ? `${effectivePlan.summary.financials.currencySeen[0] ?? ''}${effectivePlan.summary.financials.budgetTotal.toLocaleString()}` : 'n/a'} ·
                Invoice: {effectivePlan.summary.financials.invoiceTotal !== null ? ` ${effectivePlan.summary.financials.currencySeen[0] ?? ''}${effectivePlan.summary.financials.invoiceTotal.toLocaleString()}` : 'n/a'}
              </p>
              <p className="mt-1 text-muted">{effectivePlan.summary.blanksPreserved} blank/NA cells preserved as-is.</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[640px] text-[11px]">
              <thead>
                <tr className="border-b border-line bg-[#fafaf8] text-left text-muted">
                  <th className="px-2 py-2">Row</th>
                  <th className="px-2 py-2">Project</th>
                  <th className="px-2 py-2">Client</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Cost</th>
                  <th className="px-2 py-2">Invoice</th>
                  <th className="px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {effectivePlan.rows.map((r) => (
                  <tr key={r.rowNumber} className="border-b border-[#f0f0ed] last:border-0 align-top">
                    <td className="px-2 py-2 text-muted">{r.rowNumber}</td>
                    <td className="px-2 py-2 font-medium text-ink">
                      {r.project.name || <span className="text-red">—</span>}
                      {r.issues.length > 0 && (
                        <p className="mt-0.5 flex items-start gap-1 text-[10px] font-normal text-amber">
                          <AlertTriangle size={10} className="mt-px shrink-0" /> {r.issues.join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-2 text-muted">{r.clientName || '—'}</td>
                    <td className="px-2 py-2">{r.project.status}</td>
                    <td className="px-2 py-2 text-muted">{r.project.budget || '—'}</td>
                    <td className="px-2 py-2 text-muted">{r.project.invoiceValue || '—'}</td>
                    <td className="px-2 py-2">
                      {r.disposition === 'create' ? (
                        <label className="flex items-center gap-1.5">
                          <Badge tone="green">Import</Badge>
                          <input type="checkbox" checked={!excluded.has(r.rowNumber)} onChange={() => toggleRow(r.rowNumber)} aria-label={`Include row ${r.rowNumber}`} />
                        </label>
                      ) : (
                        <Badge tone={dispositionTone[r.disposition]}>{dispositionLabel[r.disposition]}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted">Nothing is written yet — this is a dry run. Untick a row to exclude it. Duplicates and errors are never imported.</p>
        </div>
      )}

      {step === 'done' && committed && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-green/10 p-4">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-green" />
            <div>
              <p className="text-[14px] font-semibold text-ink">Import complete</p>
              <p className="mt-0.5 text-[12px] text-muted">
                {committed.projects} projects and {committed.clients} clients imported from {fileName} ({sheetName}).
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-line p-3 text-[11px] text-muted">
            <p className="mb-1 font-semibold text-ink">Reconciliation</p>
            <p>Source rows: {plan?.summary.totalRows} → Imported: {committed.projects} · Skipped (duplicates/excluded): {(plan?.summary.duplicates ?? 0) + excluded.size} · Errors: {plan?.summary.errors ?? 0}</p>
            <p className="mt-1">Every record is tagged with batch <code className="rounded bg-[#f0f0ed] px-1">{committed.batchId}</code> and keeps its raw source row for audit.</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-[#fafaf8] p-3">
            <p className="text-[11px] text-muted">Something wrong? Roll back this batch — pre-existing records are untouched.</p>
            <Button variant="secondary" onClick={() => { if (window.confirm('Roll back this import? Only records created by it are removed.')) { rollbackImport(committed.batchId); setCommitted(null); setStep('upload') } }}>
              <span className="flex items-center gap-1"><RotateCcw size={12} /> Undo this import</span>
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
