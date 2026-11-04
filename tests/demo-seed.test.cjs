/**
 * Demo seeder tests — verifies generated data is linked & valid.
 * Usage: node tests/demo-seed.test.cjs
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
const S = loadTs('seedDemo.ts', (p) => (p === './raid' ? raid : require(p)))

let pass = 0, fail = 0
const check = (cond, label) => { if (cond) pass++; else { fail++; console.log('  FAIL:', label) } }

const projects = [
  { id: 'p1', name: 'Alpha Site', client: 'Alpha Co', status: 'In Progress', progress: 60, end: '2026-11-15', manager: 'Sandeep Rana' },
  { id: 'p2', name: 'Beta App', client: 'Beta Ltd', status: 'Completed', progress: 100, end: '2026-10-01', manager: 'Raunik' },
  { id: 'p3', name: 'Gamma Portal', client: 'Gamma Inc', status: 'Planning', progress: 0, end: '2026-12-20', manager: 'Sandeep Rana' },
]
const clients = [{ id: 'c1', name: 'Alpha Co' }, { id: 'c2', name: 'Beta Ltd' }]

const empty = {
  projects, clients, team: [], tasks: [], meetings: [], documents: [],
  risks: [], aiFindings: [], activity: [], importBatches: [], statusUpdates: [],
}
const out = S.ensureDemoData(empty)

// tasks
check(out.tasks.length >= projects.length * 5, `tasks generated (${out.tasks.length})`)
check(out.tasks.every((t) => projects.some((p) => p.id === t.projectId)), 'every task links to a real project')
check(out.tasks.every((t) => out.team.some((m) => m.name === t.assignee)), 'every task assigned to a real team member')
check(out.tasks.filter((t) => t.projectId === 'p2').every((t) => t.status === 'Completed'), 'completed project → all tasks completed')
check(out.tasks.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.due)), 'task due dates valid')
check(out.tasks.every((t) => t.estimatedHours > 0), 'task estimates positive')

// team
check(out.team.length === 9, 'team roster seeded')
check(out.team.some((m) => m.role === 'Project Manager'), 'PM present in roster')

// meetings
check(out.meetings.length >= 7, 'meetings generated')
check(out.meetings.every((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.date)), 'meeting dates valid')
check(out.meetings.filter((m) => m.projectId).every((m) => projects.some((p) => p.id === m.projectId)), 'linked meetings reference real projects')
check(out.meetings.some((m) => m.status === 'Completed') && out.meetings.some((m) => m.status === 'Scheduled'), 'meeting statuses mixed')

// documents
check(out.documents.length >= 8, 'documents generated')
check(out.documents.every((d) => projects.some((p) => p.id === d.projectId)), 'documents link to projects')
check(out.documents.every((d) => d.name && d.size && d.updated), 'document fields populated')

// risks
check(out.risks.length >= 7, 'RAID items generated')
check(new Set(out.risks.map((r) => r.category)).size === 4, 'all 4 RAID categories covered')
check(out.statusUpdates.length >= 3 && out.statusUpdates.every((u) => u.demoSeed), 'status updates seeded for unreported projects')
check(out.clients.every((c) => c.contact && c.email && c.phone), 'client contacts filled')
check(out.risks.every((r) => r.id && r.title && r.status === 'Open'), 'RAID items normalized + open')

// preservation — non-empty collections untouched
const existing = { ...empty, tasks: [{ id: 'keep' }], meetings: [{ id: 'm-keep' }] }
const out2 = S.ensureDemoData(existing)
check(out2.tasks.some((t) => t.id === 'keep'), 'user-created tasks preserved on regen')
check(out2.meetings.some((m) => m.id === 'm-keep'), 'user-created meetings preserved on regen')
check(out2.team.length === 9 && out2.documents.length >= 8, 'still-empty collections still seeded')
const out3 = S.ensureDemoData(out2)
check(out3.tasks.length === out2.tasks.length, 'no double-seeding on second run')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
