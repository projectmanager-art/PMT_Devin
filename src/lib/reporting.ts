/**
 * Project-level reporting engine — pure, React-free.
 *
 * Rules (per reporting spec):
 *  - Latest saved status update is the reporting source of truth; project.status
 *    is synced to it at save time, so both agree.
 *  - Progress is the latest manually reported %. Projects never reported show
 *    "unknown" — never invented, never counted as 0 in portfolio averages.
 *  - Health is computed independently of workflow status (a project can be
 *    "In Progress" AND "Red"). A manager override wins when present.
 *  - Overdue is an indicator only — it never mutates status.
 *  - "Active" business rule: not Completed, not Backed Off, not On Hold.
 */

import type { Health, Project, StatusUpdate } from '../store'

export const STALE_DAYS = 7
export const UPCOMING_DEADLINE_DAYS = 14

const MS_PER_DAY = 86_400_000

export const updatesFor = (projectId: string, updates: StatusUpdate[]): StatusUpdate[] =>
  updates
    .filter((u) => u.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export const latestUpdateFor = (projectId: string, updates: StatusUpdate[]): StatusUpdate | undefined =>
  updatesFor(projectId, updates)[0]

/** Map: projectId → latest update (undefined when never reported). */
export function latestUpdateMap(updates: StatusUpdate[]): Map<string, StatusUpdate> {
  const map = new Map<string, StatusUpdate>()
  for (const u of updates) {
    const existing = map.get(u.projectId)
    if (!existing || u.createdAt > existing.createdAt) map.set(u.projectId, u)
  }
  return map
}

/** Past deadline and still delivering — indicator only, never changes status. */
export function isOverdue(project: Project, today: string): boolean {
  return !!project.end && project.end < today && project.status !== 'Completed' && project.status !== 'Backed Off'
}

/** No report ever, or last report older than `days`. */
export function isStale(project: Project, latest: StatusUpdate | undefined, today: string, days = STALE_DAYS): boolean {
  const anchor = latest?.createdAt ?? project.lastReportAt
  if (!anchor) return true // never reported counts as not-updated-recently
  return (new Date(today).getTime() - new Date(anchor).getTime()) / MS_PER_DAY > days
}

/**
 * Auto health — computed from signals, independent of status:
 *   Red   — overdue deadline, status "At Risk", or a critical blocker.
 *   Amber — non-critical blockers/risks recorded, On Hold, or a stale report.
 *   Green — otherwise.
 */
export function autoHealth(project: Project, latest: StatusUpdate | undefined, today: string): Health {
  if (isOverdue(project, today)) return 'Red'
  if (project.status === 'At Risk') return 'Red'
  if (latest?.blockerSeverity === 'critical' && latest.blockers?.trim()) return 'Red'
  if (latest?.blockers?.trim()) return 'Amber'
  if (latest?.risksDependencies?.trim()) return 'Amber'
  if (project.status === 'On Hold') return 'Amber'
  if (isStale(project, latest, today) && latest) return 'Amber'
  return 'Green'
}

/** Display health — manager override wins over the computed value. */
export function effectiveHealth(project: Project, latest: StatusUpdate | undefined, today: string): Health {
  return project.healthOverride?.health ?? autoHealth(project, latest, today)
}

/**
 * Reported progress: latest update wins; completed projects without reports are
 * known-done (100%); anything else is unknown (null) — excluded from averages.
 */
export function reportedProgress(project: Project, latest: StatusUpdate | undefined): number | null {
  if (latest) return latest.progress
  if (project.status === 'Completed') return 100
  return null
}

export interface PortfolioMetrics {
  total: number
  active: number // Planning + In Progress + At Risk (still being delivered)
  inProgress: number
  completed: number
  onHold: number
  atRisk: number
  backedOff: number
  planning: number
  overdue: number
  stale: number
  neverReported: number
  avgProgress: number | null // null when nothing has been reported
  health: Record<Health, number>
}

export function portfolioMetrics(projects: Project[], updates: StatusUpdate[], today: string): PortfolioMetrics {
  const latest = latestUpdateMap(updates)
  const known = projects.map((p) => reportedProgress(p, latest.get(p.id))).filter((v): v is number => v !== null)
  const m: PortfolioMetrics = {
    total: projects.length,
    active: 0, inProgress: 0, completed: 0, onHold: 0, atRisk: 0, backedOff: 0, planning: 0,
    overdue: 0, stale: 0, neverReported: 0,
    avgProgress: known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : null,
    health: { Green: 0, Amber: 0, Red: 0 },
  }
  for (const p of projects) {
    if (p.status === 'In Progress') m.inProgress++
    else if (p.status === 'Completed') m.completed++
    else if (p.status === 'On Hold') m.onHold++
    else if (p.status === 'At Risk') m.atRisk++
    else if (p.status === 'Backed Off') m.backedOff++
    else m.planning++
    if (p.status !== 'Completed' && p.status !== 'Backed Off' && p.status !== 'On Hold') m.active++
    const l = latest.get(p.id)
    if (isOverdue(p, today)) m.overdue++
    if (isStale(p, l, today)) m.stale++
    if (!l) m.neverReported++
    m.health[effectiveHealth(p, l, today)]++
  }
  return m
}

export interface WeeklyPulse {
  completedThisWeek: StatusUpdate[]
  improved: { project: Project; from: number; to: number }[]
  stale: Project[]
  onHold: Project[]
  needsAttention: { project: Project; reason: string }[]
  newBlockers: StatusUpdate[]
  upcomingDeadlines: { project: Project; daysLeft: number }[]
  deadlineChanged: StatusUpdate[]
}

export function weeklyPulse(projects: Project[], updates: StatusUpdate[], today: string): WeeklyPulse {
  const weekAgo = new Date(new Date(today).getTime() - STALE_DAYS * MS_PER_DAY).toISOString()
  const latest = latestUpdateMap(updates)
  const pulse: WeeklyPulse = {
    completedThisWeek: [], improved: [], stale: [], onHold: [], needsAttention: [],
    newBlockers: [], upcomingDeadlines: [], deadlineChanged: [],
  }
  for (const u of updates) {
    if (u.createdAt >= weekAgo) {
      if (u.status === 'Completed') pulse.completedThisWeek.push(u)
      if (u.blockers?.trim()) pulse.newBlockers.push(u)
    }
    if (u.expectedCompletion) pulse.deadlineChanged.push(u)
  }
  for (const p of projects) {
    const l = latest.get(p.id)
    const hist = updatesFor(p.id, updates)
    const prev = hist[1]
    if (l && prev && l.progress > prev.progress) pulse.improved.push({ project: p, from: prev.progress, to: l.progress })
    if (isStale(p, l, today)) pulse.stale.push(p)
    if (p.status === 'On Hold') pulse.onHold.push(p)
    if (isOverdue(p, today)) pulse.needsAttention.push({ project: p, reason: `Deadline passed ${p.end}` })
    else if (p.status === 'At Risk') pulse.needsAttention.push({ project: p, reason: 'Marked At Risk' })
    else if (l?.blockerSeverity === 'critical' && l.blockers?.trim()) pulse.needsAttention.push({ project: p, reason: 'Critical blocker' })
    else if (effectiveHealth(p, l, today) === 'Red') pulse.needsAttention.push({ project: p, reason: 'Red health' })
    if (p.end && p.end >= today && p.status !== 'Completed' && p.status !== 'Backed Off') {
      const daysLeft = Math.round((new Date(p.end).getTime() - new Date(today).getTime()) / MS_PER_DAY)
      if (daysLeft <= UPCOMING_DEADLINE_DAYS) pulse.upcomingDeadlines.push({ project: p, daysLeft })
    }
  }
  pulse.upcomingDeadlines.sort((a, b) => a.daysLeft - b.daysLeft)
  return pulse
}

/** First non-empty field from the latest update — feeds "Last Update Summary". */
export function latestSummary(latest: StatusUpdate | undefined): string {
  if (!latest) return ''
  return (
    latest.workCompleted?.trim() ||
    latest.currentWork?.trim() ||
    latest.nextSteps?.trim() ||
    latest.pendingWork?.trim() ||
    `${latest.status} · ${latest.progress}%`
  )
}
