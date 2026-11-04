/**
 * Builds public/nexora-seed.json — a committed snapshot of the full workspace
 * (imported projects/clients + all demo-seeded modules) that the app loads
 * when browser storage is empty. Run after changing the seeder or import rules.
 * Usage: node tests/build-snapshot.cjs
 */
const fs = require('fs')
const path = require('path')
const sucrase = require('sucrase')

const loadTs = (file, req) => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', file), 'utf8')
  const js = sucrase.transform(src, { transforms: ['typescript', 'imports'] }).code
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', js)(mod, mod.exports, req)
  return mod.exports
}
const raid = loadTs('raid.ts', require)
const X = loadTs('excelImport.ts', require)
const S = loadTs('seedDemo.ts', (p) => (p === './raid' ? raid : require(p)))

global.window = global
;(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'public', 'sprintiq', 'vendor', 'xlsx.full.min.js'), 'utf8'))
if (typeof XLSX.read !== 'function') make_xlsx_lib(XLSX)

const file = path.join(__dirname, '..', 'public', 'Project_Report.xlsx')
const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer', cellDates: false })

// find the sheet that yields a project table
let extracted = null
let sheetName = ''
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
  const hit = X.extractProjectRows(rows)
  if (hit && hit.rows.length >= 10) { extracted = hit; sheetName = name; break }
}
if (!extracted) { console.error('No project table found'); process.exit(1) }
console.log(`Sheet "${sheetName}" — ${extracted.rows.length} rows`)

const plan = X.buildImportPlan({ sheetName, headerRow: extracted.headerRow, sourceRows: extracted.rows, existing: { projects: [], clients: [] }, fileName: 'Project_Report.xlsx' })
const payload = X.buildCommitPayload(plan, 'Project_Report.xlsx', 'seed-batch')

const uid = () => Math.random().toString(36).slice(2, 9)
const data = S.ensureDemoData({
  projects: payload.projects.map((p) => ({ ...p, id: uid() })),
  clients: payload.clients.map((c) => ({ ...c, id: uid() })),
  team: [], tasks: [], meetings: [], documents: [], risks: [], aiFindings: [],
  activity: [{ id: uid(), message: `Imported ${plan.summary.create} projects from Project_Report.xlsx`, project: '', time: 'Just now', type: 'project', at: new Date().toISOString() }],
  importBatches: [{ ...payload.batch, id: 'seed-batch', importedAt: new Date().toISOString() }],
  statusUpdates: [],
})

const out = path.join(__dirname, '..', 'public', 'nexora-seed.json')
fs.writeFileSync(out, JSON.stringify(data))
console.log(`Wrote ${out}`)
console.log(`projects=${data.projects.length} clients=${data.clients.length} tasks=${data.tasks.length} meetings=${data.meetings.length} docs=${data.documents.length} risks=${data.risks.length} updates=${data.statusUpdates.length} team=${data.team.length}`)
