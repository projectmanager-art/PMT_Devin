/**
 * AI natural-language update engine tests.
 * Usage: node tests/ai-update.test.cjs
 */
const fs = require('fs')
const path = require('path')
const sucrase = require('sucrase')

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'aiUpdate.ts'), 'utf8')
const js = sucrase.transform(src, { transforms: ['typescript', 'imports'] }).code
const mod = { exports: {} }
new Function('module', 'exports', 'require', js)(mod, mod.exports, require)
const A = mod.exports

let pass = 0, fail = 0
const check = (cond, label) => { if (cond) pass++; else { fail++; console.log('  FAIL:', label) } }

const proj = (over = {}) => ({ id: 'p1', name: 'Max Out Tutoring', status: 'In Progress', progress: 50, end: '2026-11-30', ...over })
const ctx = (over = {}) => ({ project: proj(), latestUpdate: undefined, openRaids: [], ...over })

const UAT_TEXT = 'Update Max Out Tutoring. Current progress is 70%. Client-side UAT is pending. All internal development and testing activities are completed. There are no internal team blockers. We are waiting for the client to complete UAT. Follow up with the client and update the next milestone accordingly.'

// 1 — progress extraction
{
  const p = A.analyzeUpdate(UAT_TEXT, ctx())
  check(p.progress.present && p.progress.value === 70 && p.progress.source === 'explicit', 'progress extracted (70%)')
}

// 2 — client-side UAT pending lands in clientUpdate + pendingWork + Dependency candidate
{
  const p = A.analyzeUpdate(UAT_TEXT, ctx())
  check(p.clientUpdate.present && /UAT/i.test(p.clientUpdate.value), 'client update captures UAT pending')
  check(p.pendingWork.present && /pending|waiting|UAT/i.test(p.pendingWork.value), 'pending work captures client UAT')
  const dep = p.raidCandidates.find((c) => c.category === 'Dependency')
  check(!!dep && dep.suggested, 'client-side wait → Dependency candidate')
}

// 3 — internal blockers reported
{
  const p = A.analyzeUpdate('Payment API integration is failing and the team is blocked by a critical database issue.', ctx())
  check(p.blockers.present && /failing|database/i.test(p.blockers.value), 'internal blockers extracted')
  check(p.blockerSeverity.value === 'critical', 'critical blocker severity detected')
  check(p.raidCandidates.some((c) => c.category === 'Issue'), 'blocker → Issue candidate')
  check(p.status.present && p.status.value === 'At Risk' && p.status.source === 'inferred', 'blockers infer At Risk status')
}

// 4 — explicit "no internal blockers" recorded, nothing poisoned
{
  const p = A.analyzeUpdate(UAT_TEXT, ctx())
  check(p.teamStatusNote === 'No internal blockers reported.', 'no-blockers note recorded')
  check(!(p.blockers.present && p.blockers.source === 'explicit' && /blocker/i.test(p.blockers.value)), 'no false blockers field')
  const issue = p.raidCandidates.find((c) => c.category === 'Issue' && /blocker/i.test(c.title))
  check(!issue, 'no Issue candidate from "no blockers" phrasing')
}

// 5 — multiple updates in one message
{
  const p = A.analyzeUpdate(UAT_TEXT, ctx())
  check(p.workCompleted.present && /testing/i.test(p.workCompleted.value), 'completed work captured')
  check(p.nextSteps.present && /follow up/i.test(p.nextSteps.value), 'next steps captured')
  check(p.hasMeaningfulChanges, 'compound message = meaningful changes')
}

// 6 — ambiguous status stays unspecified / clarification path works
{
  const p = A.analyzeUpdate('Things are moving along okay.', ctx())
  check(!p.status.present, 'ambiguous input → no status change proposed')
}

// 7 — missing progress leaves field unset
{
  const p = A.analyzeUpdate('Client approval is pending.', ctx())
  check(!p.progress.present, 'missing progress → not proposed')
}

// 8 — invalid progress rejected with clarification
{
  const p = A.analyzeUpdate('Progress is 180% now.', ctx())
  check(!p.progress.present, 'progress 180% rejected')
  check(p.clarifications.some((c) => /invalid/i.test(c)), 'invalid progress clarification shown')
}

// 9 — unspecified fields carry forward previous report (preserve)
{
  const latest = { pendingWork: 'Design sign-off', internalRemarks: 'Keep internal only' }
  const p = A.analyzeUpdate('Progress is 60%.', ctx({ latestUpdate: latest }))
  check(p.pendingWork.present && p.pendingWork.source === 'carried' && p.pendingWork.value === 'Design sign-off', 'unmentioned pendingWork carried forward')
  check(p.internalRemarks.value === 'Keep internal only', 'internal remarks carried forward')
}

// 10 — explicit status changes
{
  const p1 = A.analyzeUpdate('Put the project on hold until the client returns.', ctx())
  check(p1.status.value === 'On Hold' && p1.status.source === 'explicit', '"on hold" → On Hold')
  const p2 = A.analyzeUpdate('The project is fully completed and closed.', ctx())
  check(p2.status.value === 'Completed', 'explicit project completion → Completed')
}

// 10d — mark-as-completion phrasings (the reported bug)
{
  for (const text of [
    'Mark it as completed',
    'Mark this as completed',
    'Marked as complete',
    'Set the project to completed',
    'Update status to done',
    'Close this project',
  ]) {
    const p = A.analyzeUpdate(text, ctx())
    check(p.status.present && p.status.value === 'Completed' && p.status.source === 'explicit', `"${text}" → Completed`)
  }
  // must NOT fire on unrelated "update" verbs
  const safe = A.analyzeUpdate('Follow up with the client and update the next milestone accordingly.', ctx())
  check(!(safe.status.present && safe.status.value === 'Completed'), '"update the next milestone" does not mark Completed')
}

// 10b — "development completed" must NOT mark the project Completed
{
  const p = A.analyzeUpdate('Development is completed but client UAT is still pending.', ctx())
  check(!(p.status.present && p.status.value === 'Completed'), 'dev done + pending ≠ Completed')
}

// 10c — buildApplyPayload refuses Completed with explicit pending work
{
  const p = A.analyzeUpdate('The project is fully completed. One document is still pending.', ctx({ project: proj({ status: 'In Progress' }) }))
  const out = A.buildApplyPayload(p, proj())
  check(typeof out === 'string' && /pending/i.test(out), 'apply guard rejects Completed + pending work')
}

// 11 — RAID dedup against existing open items
{
  const openRaids = [{ title: 'Client UAT is pending', status: 'Open', projectId: 'p1' }]
  const p = A.analyzeUpdate(UAT_TEXT, ctx({ openRaids }))
  const dep = p.raidCandidates.find((c) => /UAT/i.test(c.title))
  check(dep && !dep.suggested && /already tracked/i.test(dep.reason ?? ''), 'duplicate RAID item suppressed')
}

// 12 — apply payload shape feeds the existing status-update pipeline
{
  const p = A.analyzeUpdate(UAT_TEXT, ctx())
  const out = A.buildApplyPayload(p, proj())
  check(typeof out === 'object' && out.projectId === 'p1', 'payload targets project')
  check(out.progress === 70, 'payload progress = 70')
  check(out.status === 'In Progress' || out.status, 'payload carries a valid status')
  check(/UAT/i.test(out.clientUpdate), 'payload clientUpdate populated')
}

// 13 — unauthorized / unknown project rejected
{
  const p = A.analyzeUpdate('Progress is 50%.', ctx())
  check(typeof A.buildApplyPayload(p, { id: '', name: 'x', status: 'In Progress', progress: 0 }) === 'string', 'unknown project rejected')
}

// 14 — external proposal schema validation
{
  check(!A.validateProposal(null), 'validateProposal rejects null')
  check(!A.validateProposal({ status: 'x' }), 'validateProposal rejects malformed')
  const good = A.analyzeUpdate('Progress is 40%.', ctx())
  check(A.validateProposal(good), 'validateProposal accepts engine output')
}

// 15 — carried fields preserve historical report data
{
  const latest = { workCompleted: 'Phase 1 done', nextSteps: 'Plan phase 2' }
  const p = A.analyzeUpdate('Client asked for one more week.', ctx({ latestUpdate: latest }))
  check(p.workCompleted.source === 'carried' && p.workCompleted.value === 'Phase 1 done', 'history preserved when field unmentioned')
}

// 16 — meaningful-change gate blocks empty updates
{
  const p = A.analyzeUpdate('ok.', ctx())
  check(!p.hasMeaningfulChanges, 'empty update flagged as not meaningful')
}

// 17 — date extraction (explicit only)
{
  const p = A.analyzeUpdate('Expected completion 15 December 2026.', ctx())
  check(p.expectedCompletion.present && p.expectedCompletion.value === '2026-12-15', 'explicit date → expectedCompletion')
  const p2 = A.analyzeUpdate('Should be done by end of month.', ctx())
  check(!p2.expectedCompletion.present && p2.clarifications.some((c) => /date/i.test(c)), 'vague date → clarification, no invented date')
}

// 18 — provider contract
{
  check(typeof A.localNlpProvider.analyze === 'function', 'local provider exposes analyze()')
  A.localNlpProvider.analyze('Progress is 30%.', ctx()).then((p) => {
    check(p.progress.value === 30, 'local provider returns a proposal')
    console.log(`\n${pass} passed, ${fail} failed`)
    process.exit(fail ? 1 : 0)
  })
}
