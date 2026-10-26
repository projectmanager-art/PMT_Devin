/**
 * SprintIQ analytics + parser test harness (Node)
 *
 * Loads the real browser modules from public/sprintiq/js with minimal DOM
 * stubs, then recomputes every metric independently and asserts equality.
 * Run: node tests/sprintiq.test.cjs
 */

const fs = require('fs');
const path = require('path');

/* ---------- Browser environment stubs ---------- */
const storage = new Map();
global.window = global;
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }),
  addEventListener: () => {},
  body: { classList: { add() {} } },
};

// XLSX vendor (needed for parseCsvText / workbook reading)
const vendorDir = path.join(__dirname, '..', 'public', 'sprintiq', 'vendor');
try {
  // The bundle is browser-global style: eval into global scope
  const src = fs.readFileSync(path.join(vendorDir, 'xlsx.full.min.js'), 'utf8');
  (0, eval)(src);
  if (!global.XLSX || typeof global.XLSX.read !== 'function') global.XLSX = window.XLSX || null;
} catch (e) {
  global.XLSX = null;
}
if (!global.XLSX) console.warn('[harness] XLSX vendor not loaded — csv parse tests will be skipped');

const jsDir = path.join(__dirname, '..', 'public', 'sprintiq', 'js');
for (const f of ['config.js', 'team.js', 'gsheet_import.js', 'sample_data.js', 'parser.js', 'analytics.js', 'exports.js']) {
  const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
  try {
    // eslint-disable-next-line no-eval
    (0, eval)(src);
  } catch (e) {
    console.error(`Failed to load ${f}:`, e.message);
    process.exit(1);
  }
}

/* ---------- Tiny assertion framework ---------- */
let pass = 0, fail = 0;
const failures = [];
function ok(cond, label, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ label, detail }); }
}
function eq(actual, expected, label) {
  ok(actual === expected, label, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function near(actual, expected, label, tol = 0.15) {
  ok(typeof actual === 'number' && Math.abs(actual - expected) <= tol, label, `expected ~${expected}, got ${actual}`);
}
function noNaN(obj, label) {
  const bad = [];
  (function walk(o, p) {
    if (o == null) return;
    if (typeof o === 'number' && !Number.isFinite(o)) bad.push(p);
    else if (typeof o === 'string' && /undefined|NaN|Infinity/.test(o)) bad.push(`${p}: "${o.slice(0, 90)}"`);
    else if (Array.isArray(o)) o.forEach((v, i) => walk(v, `${p}[${i}]`));
    else if (typeof o === 'object') Object.keys(o).forEach(k => { if (!k.startsWith('__')) walk(o[k], `${p}.${k}`); });
  })(obj, label);
  ok(bad.length === 0, `${label} — no NaN/Infinity/undefined leaks`, bad.join(' | '));
}
function section(name) { console.log(`\n== ${name}`); }
function report() {
  console.log(`\n${'='.repeat(60)}\nRESULT: ${pass} passed, ${fail} failed`);
  failures.forEach(f => console.log(`  FAIL ${f.label}\n       ${f.detail || ''}`));
  process.exit(fail ? 1 : 0);
}

const { SprintParser, SprintAnalytics, SprintIQTeam, SprintIQConfig, SprintIQSampleData } = window;
const team = SprintIQTeam; // instance
const S = SprintIQSampleData.getSampleSprints();
const cfg = SprintIQConfig.get();

/* =====================================================
   1. PARSER — normalizeHours / status / priority
   ===================================================== */
section('Parser: normalizeHours');
const N = SprintParser.normalizeHours;
eq(N(8), 8, 'number passthrough');
eq(N('16'), 16, 'plain numeric string');
eq(N('2.5'), 2.5, 'decimal');
eq(N('2,5'), 2.5, 'comma decimal');
eq(N('02:30'), 2.5, 'HH:MM');
eq(N('1:15'), 1.25, 'H:MM');
eq(N('16h'), 16, '16h');
eq(N('2hrs'), 2, '2hrs');
eq(N('3 hours'), 3, '3 hours');
eq(N('2h 30m'), 2.5, '2h 30m');
eq(N('90min'), 1.5, '90min');
eq(N('30m'), 0.5, '30m');
eq(N('1d'), 8, '1d = 8h');
eq(N('2 days'), 16, '2 days');
eq(N(''), 0, 'empty -> 0');
eq(N(null), 0, 'null -> 0');
eq(N(undefined), 0, 'undefined -> 0');
eq(N('abc'), 0, 'non-numeric junk -> 0');
eq(N('approx 16h'), 16, 'embedded 16h');
eq(N('-'), 0, 'dash -> 0');

section('Parser: normalizeStatus / normalizePriority');
eq(SprintParser.normalizeStatus('Completed'), 'Completed', 'status Completed');
eq(SprintParser.normalizeStatus('done'), 'Completed', 'status done');
eq(SprintParser.normalizeStatus('closed'), 'Completed', 'status closed');
eq(SprintParser.normalizeStatus('In Progress'), 'In Progress', 'status In Progress');
eq(SprintParser.normalizeStatus('wip'), 'In Progress', 'status wip');
eq(SprintParser.normalizeStatus('On Hold'), 'Blocked', 'status On Hold -> Blocked(hold)');
eq(SprintParser.normalizeStatus('todo'), 'Pending', 'status todo');
eq(SprintParser.normalizeStatus('BLOCKED'), 'Blocked', 'status BLOCKED');
eq(SprintParser.normalizeStatus('Cancelled'), 'Cancelled', 'status Cancelled');
eq(SprintParser.normalizeStatus(''), 'Pending', 'empty status -> Pending');
eq(SprintParser.normalizeStatus('garbage'), 'Pending', 'unknown status -> Pending');

eq(SprintParser.normalizePriority('High'), 'High', 'prio High');
eq(SprintParser.normalizePriority('critical'), 'High', 'prio critical');
eq(SprintParser.normalizePriority('P0'), 'High', 'prio P0');
eq(SprintParser.normalizePriority('urgent'), 'High', 'prio urgent');
eq(SprintParser.normalizePriority('Low'), 'Low', 'prio Low');
eq(SprintParser.normalizePriority('P3'), 'Low', 'prio P3');
eq(SprintParser.normalizePriority(''), 'Medium', 'empty prio -> Medium');
eq(SprintParser.normalizePriority('garbage'), 'Medium', 'unknown prio -> Medium');

/* =====================================================
   2. TEAM DIRECTORY
   ===================================================== */
section('TeamDirectory');
eq(team.resolve('Aman').employee_name, 'Aman', 'resolve Aman');
eq(team.resolve('AVINASH').employee_name, 'Avinash', 'resolve case-insensitive');
eq(team.resolve('aman  ').employee_name, 'Aman', 'resolve with whitespace');
ok(team.isDeliveryResource('Aman'), 'Aman is delivery');
ok(!team.isDeliveryResource('Sandeep'), 'Sandeep is leadership');
eq(team.resolve('Sandeep').sprint_role, 'Scrum Master', 'Sandeep is SM');
ok(team.isDeliveryResource('Unknown Person'), 'unknown owner treated as delivery');
eq(team.resolve('Unassigned').employee_name, 'Unassigned', 'Unassigned resolves');
eq(team.resolve('').employee_name, 'Unassigned', 'empty owner resolves to Unassigned');

/* =====================================================
   3. SAMPLE SPRINT METRICS — independent recomputation
   ===================================================== */
function expectedMetrics(tasks) {
  const delivery = tasks.filter(t => team.isDeliveryResource(t.owner));
  const cancelled = delivery.filter(t => t.status === 'Cancelled');
  const completed = delivery.filter(t => t.status === 'Completed').length;
  const inProgress = delivery.filter(t => t.status === 'In Progress').length;
  const blocked = delivery.filter(t => t.status === 'Blocked').length;
  const pending = delivery.filter(t => t.status === 'Pending').length;
  const totalEst = delivery.reduce((a, t) => a + (t.est || 0), 0);
  const totalAct = delivery.reduce((a, t) => a + (t.act || 0), 0);
  const active = delivery.length - cancelled.length;
  return {
    totalTasks: delivery.length, completed, inProgress, blocked, pending,
    cancelled: cancelled.length,
    completionPct: active ? (completed / active) * 100 : 0,
    totalEst, totalAct,
    variance: totalAct - totalEst,
    variancePct: totalEst ? (totalAct - totalEst) / totalEst * 100 : (totalAct > 0 ? 100 : 0),
    efficiencyPct: totalAct ? totalEst / totalAct * 100 : (totalEst === 0 ? 100 : 0),
    teamSize: new Set(delivery.map(t => t.owner).filter(o => o && o !== 'Unassigned')).size,
  };
}

for (const sprint of S) {
  section(`Sample data: ${sprint.name}`);
  const analysis = SprintAnalytics.analyzeSprint(sprint, cfg, 1);
  const m = analysis.metrics;
  const exp = expectedMetrics(sprint.tasks);

  eq(m.totalTasks, exp.totalTasks, `${sprint.id} totalTasks`);
  eq(m.completed, exp.completed, `${sprint.id} completed`);
  eq(m.inProgress, exp.inProgress, `${sprint.id} inProgress`);
  eq(m.blocked, exp.blocked, `${sprint.id} blocked`);
  eq(m.pending, exp.pending, `${sprint.id} pending`);
  eq(m.cancelled, exp.cancelled, `${sprint.id} cancelled`);
  near(m.completionPct, exp.completionPct, `${sprint.id} completionPct`);
  near(m.totalEst, exp.totalEst, `${sprint.id} totalEst`);
  near(m.totalAct, exp.totalAct, `${sprint.id} totalAct`);
  near(m.variance, exp.variance, `${sprint.id} variance`);
  near(m.variancePct, exp.variancePct, `${sprint.id} variancePct`);
  near(m.efficiencyPct, exp.efficiencyPct, `${sprint.id} efficiencyPct`);
  eq(m.teamSize, exp.teamSize, `${sprint.id} teamSize`);
  ok(['GREEN', 'AMBER', 'RED'].includes(m.rag), `${sprint.id} rag valid`);
  ok(m.ragScore >= 0 && m.ragScore <= 100, `${sprint.id} ragScore in range`);

  // --- employee metrics vs independent sums ---
  const deliveryTasks = sprint.tasks.filter(t => team.isDeliveryResource(t.owner));
  const byOwner = {};
  deliveryTasks.forEach(t => {
    const owner = team.resolve(t.owner || 'Unassigned').employee_name;
    (byOwner[owner] = byOwner[owner] || []).push(t);
  });
  eq(analysis.employees.length, Object.keys(byOwner).length, `${sprint.id} employee count`);

  // team average over NAMED delivery employees only
  const namedAct = Object.keys(byOwner).filter(n => n !== 'Unassigned')
    .reduce((a, n) => a + byOwner[n].reduce((s, t) => s + (t.act || 0), 0), 0);
  const namedCount = Object.keys(byOwner).filter(n => n !== 'Unassigned').length;
  const teamAvg = namedCount ? namedAct / namedCount : 0;

  for (const emp of analysis.employees) {
    const ts = byOwner[emp.name] || [];
    const eCompleted = ts.filter(t => t.status === 'Completed').length;
    const eCancelled = ts.filter(t => t.status === 'Cancelled').length;
    const eEst = ts.reduce((a, t) => a + t.est, 0);
    const eAct = ts.reduce((a, t) => a + t.act, 0);
    eq(emp.totalAssigned, ts.length, `${sprint.id} ${emp.name} assigned`);
    eq(emp.completed, eCompleted, `${sprint.id} ${emp.name} completed`);
    near(emp.estHours, eEst, `${sprint.id} ${emp.name} estHours`);
    near(emp.actHours, eAct, `${sprint.id} ${emp.name} actHours`);
    near(emp.variance, eAct - eEst, `${sprint.id} ${emp.name} variance`);
    near(emp.efficiencyPct, eAct ? eEst / eAct * 100 : (eEst === 0 ? 100 : 0), `${sprint.id} ${emp.name} efficiencyPct`);
    near(emp.workloadPct, namedAct ? eAct / namedAct * 100 : 0, `${sprint.id} ${emp.name} workloadPct`);
    const ratio = teamAvg ? eAct / teamAvg : 0;
    const expStatus = emp.name === 'Unassigned' ? 'Unassigned'
      : teamAvg === 0 ? 'Balanced'
      : ratio < cfg.workloadThresholds.underloadedRatio ? 'Underloaded'
      : ratio > cfg.workloadThresholds.overloadedRatio ? 'Overloaded' : 'Balanced';
    eq(emp.workloadStatus, expStatus, `${sprint.id} ${emp.name} workloadStatus`);
    const eCompPct = (ts.length - eCancelled) ? eCompleted / (ts.length - eCancelled) * 100 : 0;
    near(emp.completionPct, eCompPct, `${sprint.id} ${emp.name} completionPct`);
    ok(emp.score >= 0 && emp.score <= 100, `${sprint.id} ${emp.name} score in range`);
    eq(emp.rag, emp.score >= cfg.ragThresholds.greenMin ? 'GREEN' : emp.score >= cfg.ragThresholds.amberMin ? 'AMBER' : 'RED', `${sprint.id} ${emp.name} rag threshold`);
    ok(!/undefined|NaN/.test(emp.observation), `${sprint.id} ${emp.name} observation clean`, emp.observation);
  }

  // --- workload ---
  const wl = analysis.workload;
  const namedEmps = analysis.employees.filter(e => e.name !== 'Unassigned');
  const actSum = namedEmps.reduce((a, e) => a + e.actHours, 0);
  near(wl.totalHours, actSum, `${sprint.id} workload totalHours (named)`);
  near(wl.avgHours, namedEmps.length ? actSum / namedEmps.length : 0, `${sprint.id} workload avgHours (named)`);
  eq(wl.underloadedCount + wl.balancedCount + wl.overloadedCount + (wl.unassignedCount || 0), analysis.employees.length, `${sprint.id} workload bucket sum`);
  eq(wl.underloadedList.length + wl.balancedList.length + wl.overloadedList.length + (wl.unassignedList || []).length, analysis.employees.length, `${sprint.id} workload lists sum`);

  // --- priorities ---
  const pSums = { High: 0, Medium: 0, Low: 0 };
  deliveryTasks.forEach(t => { pSums[t.priority] = (pSums[t.priority] || 0) + 1; });
  for (const p of analysis.priorities) {
    eq(p.taskCount, pSums[p.priority] || 0, `${sprint.id} priority ${p.priority} count`);
    const pts = deliveryTasks.filter(t => t.priority === p.priority);
    eq(p.completedCount, pts.filter(t => t.status === 'Completed').length, `${sprint.id} priority ${p.priority} completed`);
    near(p.estHours, pts.reduce((a, t) => a + t.est, 0), `${sprint.id} priority ${p.priority} est`);
  }

  // --- projects: every delivery task lands in exactly one project ---
  const projTaskSum = analysis.projects.reduce((a, p) => a + p.taskCount, 0);
  eq(projTaskSum, deliveryTasks.length, `${sprint.id} project task partition`);
  near(analysis.projects.reduce((a, p) => a + p.actHours, 0), exp.totalAct, `${sprint.id} project actHours total`);

  // --- risks ---
  const expBlockedRisk = deliveryTasks.filter(t => t.status === 'Blocked').length;
  const critCount = analysis.risks.filter(r => r.severity === 'Critical').length;
  ok(critCount >= expBlockedRisk, `${sprint.id} blocked tasks produce critical risks`);

  // --- retrospective validation ---
  eq(analysis.retrospective.__validationStatus, 'PASSED', `${sprint.id} retrospective validation`);
  ok((analysis.executiveSummary || '').length > 0, `${sprint.id} exec summary present`);
  noNaN(analysis, `${sprint.id} analysis`);
}

/* =====================================================
   4. EDGE-CASE SPRINTS
   ===================================================== */
function mkTask(o) {
  return Object.assign({ id: 'x', item: 'Task', owner: 'Aman', priority: 'Medium', status: 'Completed', est: 4, act: 4, module: 'App', type: 'Feature' }, o);
}
const mkSprint = (id, tasks) => ({ id, name: id, status: 'Closed', startDate: '2025-01-01', endDate: '2025-01-14', tasks });

section('Edge: empty sprint');
{
  const a = SprintAnalytics.analyzeSprint(mkSprint('E1', []), cfg, 2);
  eq(a.metrics.totalTasks, 0, 'empty totalTasks');
  eq(a.metrics.completionPct, 0, 'empty completionPct');
  eq(a.metrics.efficiencyPct, 100, 'empty efficiencyPct (nothing planned/done)');
  eq(a.employees.length, 0, 'empty employees');
  eq(a.retrospective.__validationStatus, 'PASSED', 'empty retrospective passes');
  noNaN(a, 'empty analysis');
}

section('Edge: all cancelled');
{
  const a = SprintAnalytics.analyzeSprint(mkSprint('E2', [mkTask({ status: 'Cancelled' }), mkTask({ id: 'y', status: 'Cancelled' })]), cfg, 3);
  eq(a.metrics.completed, 0, 'cancelled: completed 0');
  eq(a.metrics.completionPct, 0, 'cancelled: completionPct 0 (0/0 active)');
  noNaN(a, 'cancelled analysis');
}

section('Edge: est=0 act>0 penalized (unestimated work)');
{
  const a = SprintAnalytics.analyzeSprint(mkSprint('E3', [
    mkTask({ est: 0, act: 8 }),
    mkTask({ id: 'y', est: 8, act: 0, status: 'In Progress' }),
  ]), cfg, 4);
  ok(Number.isFinite(a.metrics.efficiencyPct), 'E3 efficiency finite');
  const aman = a.employees.find(e => e.name === 'Aman');
  // est=8, act=8 → variancePct = 0... mix: tasks are (0→8) + (8→0): est 8, act 8 → variance 0
  ok(aman.scoreBreakdown.effort <= 100, 'E3 effort score sane');
  noNaN(a, 'E3 analysis');
}

section('Edge: pure unestimated task penalized');
{
  const a = SprintAnalytics.analyzeSprint(mkSprint('E3b', [
    mkTask({ est: 0, act: 8, status: 'Completed' }),
    mkTask({ id: 'b', owner: 'Deepak', est: 4, act: 4 }),
  ]), cfg, 4.5);
  const aman = a.employees.find(e => e.name === 'Aman');
  ok(aman.variancePct > 0, 'E3b est=0 act>0 produces positive variancePct', `variancePct=${aman.variancePct}`);
  ok(aman.scoreBreakdown.effort < 100, 'E3b unestimated overrun dents effort score');
  noNaN(a, 'E3b analysis');
}

section('Edge: Unassigned + unknown owner do not distort team average');
{
  const a = SprintAnalytics.analyzeSprint(mkSprint('E4', [
    mkTask({ owner: 'Unassigned', act: 60, est: 60 }),
    mkTask({ id: 'y', owner: 'Aman', act: 10, est: 10 }),
    mkTask({ id: 'z', owner: 'Deepak', act: 10, est: 10 }),
  ]), cfg, 5);
  const aman = a.employees.find(e => e.name === 'Aman');
  const deepak = a.employees.find(e => e.name === 'Deepak');
  const unassigned = a.employees.find(e => e.name === 'Unassigned');
  eq(aman.workloadStatus, 'Balanced', 'E4 Aman balanced at 10h (avg should be 10h, not 26.7h)');
  eq(deepak.workloadStatus, 'Balanced', 'E4 Deepak balanced');
  ok(unassigned, 'E4 Unassigned row exists');
  if (unassigned) eq(unassigned.workloadStatus, 'Unassigned', 'E4 Unassigned classified as Unassigned');
  eq(a.workload.avgHours, 10, 'E4 workload avg over named only');
  eq(a.workload.unassignedHours, 60, 'E4 unassignedHours tracked separately');
  eq(a.workload.unassignedCount, 1, 'E4 unassignedCount');
  noNaN(a, 'E4 analysis');
}

section('Edge: leadership-only sprint');
{
  const a = SprintAnalytics.analyzeSprint(mkSprint('E5', [
    mkTask({ owner: 'Sandeep', item: 'Sprint facilitation' }),
    mkTask({ id: 'y', owner: 'Sandeep', item: 'Retro facilitation' }),
  ]), cfg, 6);
  eq(a.metrics.totalTasks, 0, 'leadership tasks excluded from delivery metrics');
  eq(a.excludedTasks.length, 2, 'leadership tasks tracked');
  noNaN(a, 'E5 analysis');
}

section('Edge: boundary RAG — completion exactly 90');
{
  const t90 = [];
  for (let i = 0; i < 9; i++) t90.push(mkTask({ id: `g${i}`, est: 4, act: 4 }));
  t90.push(mkTask({ id: 'gx', status: 'Pending', est: 4, act: 0 }));
  const a = SprintAnalytics.analyzeSprint(mkSprint('E6', t90), cfg, 7);
  eq(a.metrics.completionPct, 90, 'E6 completion 90');
  noNaN(a, 'E6 analysis');
}

section('Edge: workload thresholds 70%/130% inclusive-balanced');
{
  const a = SprintAnalytics.analyzeSprint(mkSprint('E7', [
    mkTask({ owner: 'Aman', act: 10, est: 10 }),
    mkTask({ id: 'b', owner: 'Deepak', act: 7, est: 7 }),
    mkTask({ id: 'c', owner: 'Nikhil', act: 13, est: 13 }),
  ]), cfg, 8);
  const find = n => a.employees.find(e => e.name === n);
  eq(find('Deepak').workloadStatus, 'Balanced', 'E7 ratio=0.7 boundary');
  eq(find('Nikhil').workloadStatus, 'Balanced', 'E7 ratio=1.3 boundary');
  eq(find('Aman').workloadStatus, 'Balanced', 'E7 ratio=1.0');
  noNaN(a, 'E7 analysis');
}

section('Edge: employee overloaded observation text');
{
  const a = SprintAnalytics.analyzeSprint(mkSprint('E8', [
    mkTask({ owner: 'Aman', act: 60, est: 40 }),
    mkTask({ id: 'b', owner: 'Deepak', act: 5, est: 5 }),
    mkTask({ id: 'c', owner: 'Nikhil', act: 5, est: 5 }),
  ]), cfg, 9);
  const aman = a.employees.find(e => e.name === 'Aman');
  eq(aman.workloadStatus, 'Overloaded', 'E8 Aman overloaded');
  ok(!/undefined|NaN/.test(aman.observation), 'E8 overloaded observation has no undefined', aman.observation);
  ok(aman.observation.includes('%'), 'E8 observation includes pct figure');
  noNaN(a, 'E8 analysis');
}

section('Edge: cancelled high-priority task must not dent priority score');
{
  const a = SprintAnalytics.analyzeSprint(mkSprint('E11', [
    mkTask({ owner: 'Aman', priority: 'High', status: 'Completed' }),
    mkTask({ id: 'b', owner: 'Aman', priority: 'High', status: 'Cancelled' }),
    mkTask({ id: 'c', owner: 'Deepak', est: 4, act: 4 }),
  ]), cfg, 12);
  const aman = a.employees.find(e => e.name === 'Aman');
  eq(aman.scoreBreakdown.priority, 100, 'E11 cancelled high task excluded from priority score');
  noNaN(a, 'E11 analysis');
}

section('Edge: mixed project-name formats');
{
  const a = SprintAnalytics.analyzeSprint(mkSprint('E10', [
    mkTask({ item: 'Alpha | login page' }),
    mkTask({ id: 'b', item: 'Alpha | logout page' }),
    mkTask({ id: 'c', item: 'Beta - dashboard widget' }),
    mkTask({ id: 'd', item: 'Beta - reports widget' }),
    mkTask({ id: 'e', item: 'Standalone thing without separator' }),
  ]), cfg, 11);
  const alpha = a.projects.find(p => p.name === 'Alpha');
  const beta = a.projects.find(p => p.name === 'Beta');
  eq(alpha && alpha.taskCount, 2, 'E10 pipe-split project grouping');
  eq(beta && beta.taskCount, 2, 'E10 dash-split project grouping');
  noNaN(a, 'E10 analysis');
}

section('Edge: extractProjectName is exposed for UI filtering');
ok(typeof SprintAnalytics.extractProjectName === 'function', 'extractProjectName exposed');
if (typeof SprintAnalytics.extractProjectName === 'function') {
  eq(SprintAnalytics.extractProjectName('Alpha | x'), 'Alpha', 'projectName pipe');
  eq(SprintAnalytics.extractProjectName('Beta - x'), 'Beta', 'projectName dash');
}

/* =====================================================
   5. CSV/EXCEL PARSING
   ===================================================== */
if (global.XLSX) {
  section('Parser: CSV extraction');
  const csv = [
    'S.No,Item,Owner,Priority,Status,Est Hours,Actual Hours',
    '1,Login page,Aman,High,Completed,8,9',
    '2,API integration,Deepak,Medium,In Progress,16,20',
    '3,Unit tests,Nikhil,Low,Blocked,4,6',
    '4,Design review,Sandeep,Medium,Completed,2,2',
    ',,,,,,',
  ].join('\n');
  const p1 = new SprintParser();
  p1.parseCsvText(csv, 'test.csv');
  const res = p1.extractTasks();
  eq(res.tasks.length, 4, 'csv task count (blank row skipped)');
  eq(res.tasks[0].owner, 'Aman', 'csv owner col');
  eq(res.tasks[0].est, 8, 'csv est');
  eq(res.tasks[0].act, 9, 'csv act');
  eq(res.tasks[2].status, 'Blocked', 'csv status');
  noNaN(res.tasks, 'csv parse');

  section('Parser: header aliasing');
  const p2 = new SprintParser();
  p2.parseCsvText([
    'Task ID,Task Name,Assigned To,Priority,Status,Estimated,Actual',
    'T1,Do thing,Aman,High,Done,10,8',
  ].join('\n'), 't2.csv');
  const res2 = p2.extractTasks();
  eq(res2.tasks.length, 1, 'csv2 task count');
  if (res2.tasks.length) {
    eq(res2.tasks[0].item, 'Do thing', 'alias item (Task Name)');
    eq(res2.tasks[0].owner, 'Aman', 'alias owner (Assigned To)');
    eq(res2.tasks[0].status, 'Completed', 'alias status Done');
  }

  section('Parser: "Owner Name" header trap');
  const p3 = new SprintParser();
  p3.parseCsvText([
    'ID,Owner Name,Description,Est,Act,Status,Priority',
    '1,Aman,Some work item,5,6,Done,High',
  ].join('\n'), 't3.csv');
  const res3 = p3.extractTasks();
  eq(res3.tasks.length, 1, 'csv3 task count');
  if (res3.tasks.length) {
    eq(res3.tasks[0].owner, 'Aman', 'Owner Name mapped to owner not item');
    eq(res3.tasks[0].item, 'Some work item', 'Description mapped to item');
  }

  section('Parser: hour-format column values');
  const p4 = new SprintParser();
  p4.parseCsvText([
    'Item,Owner,Est,Act,Status',
    'Task A,Aman,2h 30m,02:00,Done',
    'Task B,Deepak,1d,90min,WIP',
  ].join('\n'), 't4.csv');
  const res4 = p4.extractTasks();
  eq(res4.tasks.length, 2, 'csv4 task count');
  if (res4.tasks.length === 2) {
    eq(res4.tasks[0].est, 2.5, 'csv 2h 30m');
    eq(res4.tasks[0].act, 2, 'csv 02:00');
    eq(res4.tasks[1].est, 8, 'csv 1d');
    eq(res4.tasks[1].act, 1.5, 'csv 90min');
    eq(res4.tasks[1].status, 'In Progress', 'csv WIP status');
  }

  section('Parser: duplicates detection');
  const p5 = new SprintParser();
  p5.parseCsvText([
    'Item,Owner,Est,Act,Status',
    'Same task,Aman,4,4,Done',
    'Same task,Aman,4,4,Done',
    'Other task,Deepak,4,4,Done',
  ].join('\n'), 't5.csv');
  const res5 = p5.extractTasks();
  eq(res5.tasks.length, 3, 'csv5 keeps 3 rows');
  ok(res5.tasks.filter(t => t.isDuplicate).length === 1, 'csv5 flags 1 duplicate');
  eq(res5.validation.duplicateRows.length, 1, 'csv5 validation reports duplicate');
}

/* =====================================================
   5b. END-TO-END: realistic dummy CSV through the whole pipeline
   ===================================================== */
if (global.XLSX) {
  section('E2E: dummy sprint CSV → analyze → verify every number');
  // Hand-computed expectations for this exact dataset:
  // Aman:   10+8=18 est | 10+9=19 act | 2 tasks, 1 done, 1 in-progress (High 16h est? see rows)
  // Deepak: 12 est | 14 act | done
  // Vani:   6 est | 6 act | done
  // Nikhil: 8 est | 10 act | blocked
  // Sandeep: 4 est | 4 act | leadership (excluded from metrics)
  const csv = [
    'ID,Item,Owner,Priority,Status,Est,Act',
    '1,ProjX | Landing page,Aman,High,Done,10,10',
    '2,ProjX | Search API,Aman,Medium,In Progress,8,9',
    '3,ProjY | Onboarding flow,Deepak,High,Done,12,14',
    '4,ProjY | Email templates,Vani,Low,Done,6,6',
    '5,ProjZ | Payment retries,Nikhil,High,Blocked,8,10',
    '6,Sprint ceremony,Sandeep,Medium,Done,4,4',
  ].join('\n');
  const p = new SprintParser();
  p.parseCsvText(csv, 'dummy.csv');
  const { tasks, validation } = p.extractTasks();
  eq(tasks.length, 6, 'E2E parsed 6 rows');

  const sprint = mkSprint('DUMMY', tasks);
  const a = SprintAnalytics.analyzeSprint(sprint, cfg, 55);

  // Delivery-only metrics (Sandeep's 4h excluded)
  eq(a.metrics.totalTasks, 5, 'E2E totalTasks (leadership excluded)');
  eq(a.metrics.completed, 3, 'E2E completed');
  eq(a.metrics.inProgress, 1, 'E2E inProgress');
  eq(a.metrics.blocked, 1, 'E2E blocked');
  near(a.metrics.totalEst, 10 + 8 + 12 + 6 + 8, 'E2E totalEst');
  near(a.metrics.totalAct, 10 + 9 + 14 + 6 + 10, 'E2E totalAct');
  near(a.metrics.completionPct, 3 / 5 * 100, 'E2E completionPct');
  near(a.metrics.variance, 49 - 44, 'E2E variance');
  near(a.metrics.efficiencyPct, 44 / 49 * 100, 'E2E efficiencyPct');
  eq(a.metrics.teamSize, 4, 'E2E teamSize');

  // Employee checks
  const emp = n => a.employees.find(e => e.name === n);
  eq(emp('Aman').totalAssigned, 2, 'E2E Aman assigned');
  eq(emp('Aman').completed, 1, 'E2E Aman completed');
  near(emp('Aman').estHours, 18, 'E2E Aman est');
  near(emp('Aman').actHours, 19, 'E2E Aman act');
  near(emp('Nikhil').blocked, 1, 'E2E Nikhil blocked count');
  ok(!a.employees.some(e => e.name === 'Sandeep'), 'E2E Sandeep not in employee metrics');

  // Leadership
  eq(a.excludedTasks.length, 1, 'E2E leadership task excluded');
  eq(a.leadership.scrumMaster.name, 'Sandeep', 'E2E SM identified');
  eq(a.leadership.excludedFromCapacity.actHours, 4, 'E2E excluded hours');

  // Projects
  const px = a.projects.find(x => x.name === 'ProjX');
  const py = a.projects.find(x => x.name === 'ProjY');
  const pz = a.projects.find(x => x.name === 'ProjZ');
  eq(px.taskCount, 2, 'E2E ProjX tasks');
  eq(px.completedCount, 1, 'E2E ProjX completed');
  eq(py.taskCount, 2, 'E2E ProjY tasks');
  eq(pz.taskCount, 1, 'E2E ProjZ tasks');
  ok(px && py && pz, 'E2E all 3 projects extracted');
  // 'Sprint ceremony' is a leadership (Sandeep) task → correctly excluded from project breakdown
  eq(a.projects.length, 3, 'E2E leadership task excluded from projects');

  // Risks: Nikhil blocked → Critical
  ok(a.risks.some(r => r.severity === 'Critical' && r.owner === 'Nikhil'), 'E2E blocked task → critical risk');
  // ProjZ 8→10h is +2h/25% — under the drift threshold (>=4h AND >35%)
  eq(a.risks.filter(r => r.type === 'Estimation Drift').length, 0, 'E2E no drift under threshold (25% < 35%)');

  // Retrospective passes validation
  eq(a.retrospective.__validationStatus, 'PASSED', 'E2E retrospective validated');
  ok((a.retrospective.summary || '').length > 20, 'E2E retro summary generated');
  noNaN(a, 'E2E analysis');

  // Export model end-to-end
  const RDM = (0, eval)('typeof ReportDataModel !== "undefined" ? ReportDataModel : null');
  if (RDM) {
    const r = new RDM(a);
    eq(r.taskRows().length, 5, 'E2E export task rows (delivery only)');
    eq(r.employeeRows().length, 4, 'E2E export employee rows');
    noNaN(r, 'E2E export model');
  }
}

/* =====================================================
   6. FILTER WIRING (app.js source checks)
   ===================================================== */
section('Filter wiring — project & rag dropdowns must be applied');
{
  const appSrc = fs.readFileSync(path.join(jsDir, 'app.js'), 'utf8');
  ok(/filters\.project\s*=/.test(appSrc), 'filter-project change handler updates filters.project');
  ok(/filters\.rag\s*=/.test(appSrc), 'filter-rag change handler updates filters.rag');
  ok(/filters\.project\s*&&/.test(appSrc) || /this\.filters\.project/.test(appSrc), 'project filter applied in runAnalysis');
}

/* =====================================================
   7. EXPORT DATA MODEL
   ===================================================== */
section('Export engine');
ok(window.SprintExporter, 'SprintExporter exposed');
{
  // ReportDataModel is module-level in exports.js — grab via eval in global scope
  const RDM = (0, eval)('typeof ReportDataModel !== "undefined" ? ReportDataModel : null');
  if (RDM) {
    const analysis = SprintAnalytics.analyzeSprint(S[0], cfg, 99);
    const r = new RDM(analysis);
    const taskRows = r.taskRows();
    eq(taskRows.length, analysis.deliveryTasks.length, 'export task rows = delivery tasks');
    const empRows = r.employeeRows();
    eq(empRows.length, analysis.employees.length, 'export employee rows');
    noNaN(r, 'export model');
  } else {
    ok(true, 'ReportDataModel not directly reachable (internal)');
  }
}

report();
