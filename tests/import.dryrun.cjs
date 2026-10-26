/**
 * Dry-run the Excel→PMT import pipeline against the real workbook.
 * Usage: node tests/import.dryrun.cjs [path-to-xlsx]
 * Prints the validation + reconciliation report; writes nothing.
 */
const fs = require('fs')
const path = require('path')
const sucrase = require('sucrase')

// ---- compile the TS module on the fly ----
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'excelImport.ts'), 'utf8')
const js = sucrase.transform(src, { transforms: ['typescript', 'imports'] }).code
const mod = { exports: {} }
new Function('module', 'exports', 'require', js)(mod, mod.exports, require)
const { extractProjectRows, buildImportPlan, buildCommitPayload, parseSourceDate } = mod.exports

// ---- load workbook with vendored SheetJS ----
global.window = global
;(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'public', 'sprintiq', 'vendor', 'xlsx.full.min.js'), 'utf8'))
if (typeof XLSX.read !== 'function') make_xlsx_lib(XLSX)

const file = process.argv[2] || 'C:/Users/Sandeep_fastranking/Desktop/Ongoing/Project_Report.xlsx'
const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer', cellDates: false })

const SHEET = 'New Projects_July'
const rows2D = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1, defval: '' })
const extracted = extractProjectRows(rows2D)

if (!extracted) { console.error('FAIL: no project table found'); process.exit(1) }
console.log(`Sheet "${SHEET}" — header row ${extracted.headerRow}, ${extracted.rows.length} data rows`)
console.log('Headers:', JSON.stringify(extracted.headers.filter(Boolean)))

const existing = { projects: [], clients: [] } // clean store
const plan = buildImportPlan({ sheetName: SHEET, headerRow: extracted.headerRow, sourceRows: extracted.rows, existing, fileName: path.basename(file) })

let pass = 0, fail = 0
const check = (cond, label) => { if (cond) { pass++ } else { fail++; console.log('  FAIL:', label) } }

// ---- reconciliation ----
const S = plan.summary
console.log('\n== RECONCILIATION ==')
console.log(`Source rows: ${S.totalRows} | create: ${S.create} | dup: ${S.duplicates} | err: ${S.errors}`)
console.log('Status counts:', JSON.stringify(S.statusCounts))
console.log('Financials:', JSON.stringify(S.financials))
console.log('Clients to create:', plan.clientsToCreate.length)
console.log('Blanks/NA preserved:', S.blanksPreserved)

// ---- assertions ----
check(S.totalRows === 29, `expected 29 rows, got ${S.totalRows}`)
check(S.create === 29, `expected all 29 to import, got ${S.create}`)
check(S.errors === 0, 'no error rows')
check(plan.clientsToCreate.length === 29, 'one client per row (names unique)')
check(S.statusCounts['Done'] === 9 && S.statusCounts['In-Progress'] === 13 && S.statusCounts['On-Hold'] === 3 && S.statusCounts['BackedOff'] === 1 && S.statusCounts['To-Do'] === 3, 'status counts match dashboard')

const done = plan.rows.filter((r) => r.project.status === 'Completed')
check(done.length === 9, `9 Done → Completed, got ${done.length}`)
check(done.every((r) => r.project.progress === 100), 'completed projects get progress=100')
check(plan.rows.find((r) => r.project.name === 'GoldFinch Insulations LTD')?.project.start === '2026-07-17', 'ordinal date "17th July,2026" → 2026-07-17')
check(plan.rows.find((r) => r.project.name === 'Optimum Global link Landing Page')?.project.start === '2026-09-21', '"21th Sep" parses')
check(plan.rows.find((r) => r.project.name === 'GoldFinch Insulations LTD')?.project.budget === '£ 200.00', 'raw money preserved')
check(plan.rows.find((r) => r.project.name === 'Optimum Global Care')?.project.start === '', 'NA date stays blank')
check(plan.rows.every((r) => r.project.collectedAmount === String(r.source['Collected Amount'] ?? '').trim()), 'collected amounts preserved verbatim')
check(plan.rows.every((r) => r.project.amountPending === String(r.source['Amount Pending'] ?? '').trim()), 'pending amounts preserved verbatim')
check(plan.rows.every((r) => r.project.notes === String(r.source['Comments'] ?? '').trim()), 'comments preserved verbatim')
check(plan.rows.find((r) => /BackedOff/i.test(r.source['Current Status'] || ''))?.project.importMeta?.sourceStatus === 'BackedOff', 'sourceStatus preserved')
check(plan.rows.every((r) => typeof r.project.importMeta?.sourceRow === 'number'), 'every row has sourceRow provenance')

// idempotency: re-plan against "already imported" state
const payload = buildCommitPayload(plan, path.basename(file), 'b1')
const reimport = buildImportPlan({
  sheetName: SHEET, headerRow: extracted.headerRow, sourceRows: extracted.rows,
  existing: { projects: payload.projects.map((p, i) => ({ ...p, id: `x${i}` })), clients: payload.clients.map((c, i) => ({ ...c, id: `c${i}` })) },
  fileName: path.basename(file),
})
check(reimport.summary.create === 0 && reimport.summary.duplicates === 29, 're-import is idempotent (all duplicates)')

// payload sanity
check(payload.projects.length === 29 && payload.clients.length === 29, 'commit payload sizes')
check(payload.batch.sourceSnapshot.length === 29, 'source snapshot kept all rows')
check(payload.projects.every((p) => p.importMeta?.batchId === 'b1'), 'batch id stamped')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
