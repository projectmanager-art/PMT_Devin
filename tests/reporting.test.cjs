/**
 * Reporting-engine tests — verifies health/stale/overdue/pulse/progress rules.
 * Usage: node tests/reporting.test.cjs
 */
const fs = require('fs')
const path = require('path')
const sucrase = require('sucrase')

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'reporting.ts'), 'utf8')
const js = sucrase.transform(src, { transforms: ['typescript', 'imports'] }).code
const mod = { exports: {} }
new Function('module', 'exports', 'require', js)(mod, mod.exports, require)
const R = mod.exports

const TODAY = '2026-10-21'
const ago = (days) => new Date(new Date(TODAY).getTime() - days * 86400000).toISOString()

let pass = 0, fail = 0
const check = (cond, label) => { if (cond) pass++; else { fail++; console.log('  FAIL:', label) } }

const proj = (over = {}) => ({
  id: 'p1', name: 'P', client: 'C', manager: '', status: 'In Progress', health: 'Green',
  progress: 0, priority: 'Medium', start: '', end: '', type: '', budget: '',
  estimatedHours: 0, actualHours: 0, description: '', notes: '', ...over,
})
const upd = (over = {}) => ({
  id: 'u1', projectId: 'p1', author: 'A', createdAt: ago(1), status: 'In Progress',
  progress: 50, source: 'manual', ...over,
})

// --- latestUpdateMap / updatesFor ---
const u_old = upd({ id: 'u0', createdAt: ago(9), progress: 20 })
const u_new = upd({ id: 'u2', createdAt: ago(0.2), progress: 70 })
const u_other = upd({ id: 'u3', projectId: 'p2', createdAt: ago(0.1) })
const map = R.latestUpdateMap([u_old, u_new, u_other])
check(map.get('p1').id === 'u2', 'latestUpdateMap picks newest per project')
check(map.get('p2').id === 'u3', 'latestUpdateMap covers other projects')
check(R.updatesFor('p1', [u_old, u_new, u_other]).length === 2, 'updatesFor filters + sorts')
check(R.updatesFor('p1', [u_old, u_new])[0].id === 'u2', 'updatesFor newest first')

// --- isOverdue ---
check(R.isOverdue(proj({ end: '2026-10-01' }), TODAY), 'past end + in progress = overdue')
check(!R.isOverdue(proj({ end: '2026-10-01', status: 'Completed' }), TODAY), 'completed never overdue')
check(!R.isOverdue(proj({ end: '2026-10-01', status: 'Backed Off' }), TODAY), 'backed off never overdue')
check(!R.isOverdue(proj({ end: '2026-12-01' }), TODAY), 'future deadline not overdue')
check(!R.isOverdue(proj({ end: '' }), TODAY), 'no deadline not overdue')
check(!R.isOverdue(proj({ end: TODAY }), TODAY), 'due today not overdue')

// --- isStale ---
check(R.isStale(proj(), undefined, TODAY), 'never reported = stale')
check(!R.isStale(proj(), upd(), TODAY), 'recent report = not stale')
check(R.isStale(proj(), upd({ createdAt: ago(8) }), TODAY), '8-day-old report = stale')
check(!R.isStale(proj(), upd({ createdAt: ago(6.5) }), TODAY), 'within 7 days = not stale')
check(R.isStale(proj({ lastReportAt: ago(10) }), undefined, TODAY), 'lastReportAt fallback works')

// --- autoHealth ---
check(R.autoHealth(proj({ end: '2026-01-01' }), undefined, TODAY) === 'Red', 'overdue → Red')
check(R.autoHealth(proj({ status: 'At Risk' }), undefined, TODAY) === 'Red', 'At Risk → Red')
check(R.autoHealth(proj(), upd({ blockers: 'x', blockerSeverity: 'critical' }), TODAY) === 'Red', 'critical blocker → Red')
check(R.autoHealth(proj(), upd({ blockers: 'x', blockerSeverity: 'non-critical' }), TODAY) === 'Amber', 'non-critical blocker → Amber')
check(R.autoHealth(proj(), upd({ risksDependencies: 'depends on API' }), TODAY) === 'Amber', 'risks → Amber')
check(R.autoHealth(proj({ status: 'On Hold' }), undefined, TODAY) === 'Amber', 'On Hold → Amber')
check(R.autoHealth(proj(), upd({ createdAt: ago(10) }), TODAY) === 'Amber', 'stale report → Amber')
check(R.autoHealth(proj(), upd(), TODAY) === 'Green', 'clean in-progress → Green')
check(R.autoHealth(proj(), undefined, TODAY) === 'Green', 'never reported, healthy → Green')

// --- effectiveHealth ---
check(
  R.effectiveHealth(proj({ healthOverride: { health: 'Green', reason: 'r', author: 'a', at: 'x' } }), upd({ blockers: 'b' }), TODAY) === 'Green',
  'override wins over auto-Amber',
)
check(R.effectiveHealth(proj(), upd({ blockers: 'b' }), TODAY) === 'Amber', 'no override → auto')

// --- reportedProgress ---
check(R.reportedProgress(proj(), upd({ progress: 42 })) === 42, 'update progress wins')
check(R.reportedProgress(proj({ status: 'Completed' }), undefined) === 100, 'completed no-update → 100')
check(R.reportedProgress(proj(), undefined) === null, 'in-progress no-update → null (unknown)')

// --- portfolioMetrics ---
const projects = [
  proj({ id: 'a', status: 'In Progress' }),
  proj({ id: 'b', status: 'Completed', end: '' }),
  proj({ id: 'c', status: 'On Hold' }),
  proj({ id: 'd', status: 'At Risk' }),
  proj({ id: 'e', status: 'Backed Off' }),
  proj({ id: 'f', status: 'Planning', end: '2026-01-01' }), // overdue
]
const updates = [
  upd({ id: 'x1', projectId: 'e', progress: 60 }),
  upd({ id: 'x2', projectId: 'c', progress: 30, createdAt: ago(9) }), // stale
]
const m = R.portfolioMetrics(projects, updates, TODAY)
check(m.total === 6, 'metrics.total')
check(m.active === 3, `active = Planning+InProgress+AtRisk = 3, got ${m.active}`)
check(m.completed === 1 && m.onHold === 1 && m.atRisk === 1 && m.backedOff === 1 && m.inProgress === 1 && m.planning === 1, 'status counts')
check(m.overdue === 1, 'one overdue')
check(m.neverReported === 4, `4 never reported, got ${m.neverReported}`)
check(m.stale === 5, `5 stale (4 never + 1 old), got ${m.stale}`)
// avgProgress: a=60 (reported), b=100 (completed), c=30 (reported); d/e/f unknown → excluded
check(m.avgProgress === Math.round((60 + 100 + 30) / 3), `avgProgress excludes unknowns, got ${m.avgProgress}`)
check(m.health.Red >= 2, `≥2 Red (At Risk + overdue), got ${m.health.Red}`)
check(R.portfolioMetrics([], [], TODAY).avgProgress === null, 'empty portfolio avgProgress = null')

// --- weeklyPulse ---
const p2 = proj({ id: 'g', status: 'In Progress', end: '2026-11-01' }) // 11 days out
const pu = [
  upd({ id: 'w1', projectId: 'a', createdAt: ago(5), progress: 30 }),
  upd({ id: 'w2', projectId: 'a', createdAt: ago(1), progress: 60 }), // improved
  upd({ id: 'w3', projectId: 'b', status: 'Completed', createdAt: ago(2), progress: 100 }),
  upd({ id: 'w4', projectId: 'c', blockers: 'waiting on client', createdAt: ago(3) }),
  upd({ id: 'w5', projectId: 'd', expectedCompletion: '2026-12-01', createdAt: ago(4) }),
]
const pulse = R.weeklyPulse([...projects, p2], [...updates, ...pu], TODAY)
check(pulse.completedThisWeek.some((u) => u.id === 'w3'), 'pulse: completed this week')
check(pulse.improved.some((x) => x.project.id === 'a' && x.from === 30 && x.to === 60), 'pulse: improvement tracked')
check(pulse.newBlockers.some((u) => u.id === 'w4'), 'pulse: new blockers')
check(pulse.deadlineChanged.some((u) => u.id === 'w5'), 'pulse: deadline changed')
check(pulse.upcomingDeadlines.some((x) => x.project.id === 'g'), 'pulse: upcoming deadline within 14d')
check(pulse.onHold.some((x) => x.id === 'c'), 'pulse: on hold listed')
check(pulse.needsAttention.some((x) => x.project.id === 'f'), 'pulse: overdue needs attention')
check(pulse.needsAttention.some((x) => x.project.id === 'd'), 'pulse: At Risk needs attention')
check(pulse.stale.length >= 1, 'pulse: stale listed')

// --- latestSummary ---
check(R.latestSummary(upd({ workCompleted: 'done x', currentWork: 'y' })) === 'done x', 'summary prefers workCompleted')
check(R.latestSummary(upd({ workCompleted: '', currentWork: 'doing y' })) === 'doing y', 'summary falls to currentWork')
check(R.latestSummary(upd({ workCompleted: '', currentWork: '', pendingWork: 'p', nextSteps: 'n' })) === 'n', 'summary order: nextSteps before pending')
check(R.latestSummary(undefined) === '', 'no update → empty summary')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
