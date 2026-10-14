export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent'

export type RaidCategory = 'Risk' | 'Assumption' | 'Issue' | 'Dependency'

export type RaidStatus =
  | 'Open'
  | 'Monitoring'
  | 'In Progress'
  | 'Resolved'
  | 'Closed'
  | 'Invalidated'
  | 'Superseded'
  | 'Cancelled'

export type Probability = 1 | 2 | 3 | 4 | 5
export type Impact = 1 | 2 | 3 | 4 | 5

export interface RaidScore {
  probability: Probability
  impact: Impact
  score: number
  severity: 'Low' | 'Moderate' | 'High' | 'Critical'
  rationale: string
  source: string
  scoredAt: string
}

export interface RaidComment {
  id: string
  author: string
  text: string
  at: string
}

export interface RaidItem {
  id: string
  projectId: string
  category: RaidCategory
  title: string
  description: string
  businessImpact: string
  technicalImpact: string
  scopeImpact: string
  scheduleImpact: string
  costImpact: string
  qualityImpact: string
  inherent: RaidScore
  current: RaidScore
  residual: RaidScore
  priority: Priority
  owner: string
  reporter: string
  affectedTaskIds: string[]
  affectedMilestoneIds: string[]
  relatedRaidIds: string[]
  mitigationPlan: string
  contingencyPlan: string
  actionItems: string
  targetDate: string
  status: RaidStatus
  evidence: string
  sourceReference: string
  comments: RaidComment[]
  createdAt: string
  updatedAt: string
  lastReviewedAt: string
  reviewFrequencyDays: number
  resolutionDetails: string
  resolvedAt: string | null
  closedAt: string | null
  trigger?: string
  rationale?: string
  validationMethod?: string
  validatedAt?: string | null
  invalidatedAt?: string | null
  validationOutcome?: string
  discoveryDate?: string
  rootCause?: string
  escalationStatus?: 'None' | 'Escalated' | 'Resolved'
  prerequisite?: string
  dependentOnId?: string
  dependencyType?: 'Internal' | 'External' | 'Cross-team' | 'Technical'
  provider?: string
  delayImpact?: string
}

export interface RaidScoringBands {
  lowMax: number
  moderateMax: number
  highMax: number
}

export const DEFAULT_BANDS: RaidScoringBands = {
  lowMax: 4,
  moderateMax: 9,
  highMax: 16,
}

export interface ProjectLike {
  id: string
  name: string
  manager: string
  status: string
  health: 'Green' | 'Amber' | 'Red'
  start: string
  end: string
  progress: number
  priority: Priority
}

export interface TaskLike {
  id: string
  title: string
  projectId: string
  assignee: string
  status: string
  priority: Priority
  due: string
  dependencies: string[]
}

export interface RaidSettings {
  bands: RaidScoringBands
  reviewIntervalDays: number
  escalationScoreThreshold: number
  health: {
    criticalOpenRisks: number
    highOpenRisks: number
    criticalOpenIssues: number
    overdueActionsDays: number
    blockedTasksThreshold: number
  }
}

export const DEFAULT_SETTINGS: RaidSettings = {
  bands: DEFAULT_BANDS,
  reviewIntervalDays: 7,
  escalationScoreThreshold: 16,
  health: {
    criticalOpenRisks: 1,
    highOpenRisks: 1,
    criticalOpenIssues: 1,
    overdueActionsDays: 1,
    blockedTasksThreshold: 1,
  },
}

export function severityFromScore(score: number, bands: RaidScoringBands = DEFAULT_BANDS) {
  if (score <= bands.lowMax) return 'Low'
  if (score <= bands.moderateMax) return 'Moderate'
  if (score <= bands.highMax) return 'High'
  return 'Critical'
}

export function calculateRiskScore(
  probability: number,
  impact: number,
  bands: RaidScoringBands = DEFAULT_BANDS,
): { score: number; severity: RaidScore['severity'] } {
  const p = Math.min(5, Math.max(1, Math.round(probability)))
  const i = Math.min(5, Math.max(1, Math.round(impact)))
  const score = p * i
  return { score, severity: severityFromScore(score, bands) }
}

export function makeScore(probability: Probability, impact: Impact, source: string, rationale = ''): RaidScore {
  const { score, severity } = calculateRiskScore(probability, impact)
  return {
    probability,
    impact,
    score,
    severity,
    rationale,
    source,
    scoredAt: new Date().toISOString(),
  }
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function isOverdue(date: string) {
  return !!date && date < today()
}

export function isDueSoon(date: string, days = 3) {
  if (!date) return false
  const d = new Date(date)
  const now = new Date()
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= days
}

const uid = () => Math.random().toString(36).slice(2, 9)

export function emptyRaid(projectId = '', owner = ''): RaidItem {
  const now = new Date().toISOString()
  return {
    id: '',
    projectId,
    category: 'Risk',
    title: '',
    description: '',
    businessImpact: '',
    technicalImpact: '',
    scopeImpact: '',
    scheduleImpact: '',
    costImpact: '',
    qualityImpact: '',
    inherent: makeScore(3, 3, 'default', 'Initial placeholder'),
    current: makeScore(3, 3, 'default', 'Initial placeholder'),
    residual: makeScore(3, 3, 'default', 'Initial placeholder'),
    priority: 'Medium',
    owner,
    reporter: '',
    affectedTaskIds: [],
    affectedMilestoneIds: [],
    relatedRaidIds: [],
    mitigationPlan: '',
    contingencyPlan: '',
    actionItems: '',
    targetDate: today(),
    status: 'Open',
    evidence: '',
    sourceReference: '',
    comments: [],
    createdAt: now,
    updatedAt: now,
    lastReviewedAt: now,
    reviewFrequencyDays: DEFAULT_SETTINGS.reviewIntervalDays,
    resolutionDetails: '',
    resolvedAt: null,
    closedAt: null,
  }
}

export function normalizeRisk(item: Partial<RaidItem> & { id: string }): RaidItem {
  const now = new Date().toISOString()
  const base = emptyRaid()
  const category = (item.category ?? (item as any).type) || 'Risk'
  const inherent = item.inherent ?? base.inherent
  return {
    ...base,
    ...item,
    id: item.id,
    category: (category as RaidCategory) || 'Risk',
    status: (item.status as any) || 'Open',
    inherent,
    current: item.current ?? inherent,
    residual: item.residual ?? (item.current ?? inherent),
    affectedTaskIds: Array.isArray(item.affectedTaskIds) ? item.affectedTaskIds : [],
    relatedRaidIds: Array.isArray(item.relatedRaidIds) ? item.relatedRaidIds : [],
    comments: Array.isArray(item.comments) ? item.comments : [],
    createdAt: item.createdAt ?? now,
    updatedAt: now,
    lastReviewedAt: item.lastReviewedAt ?? now,
  }
}

export function migrateLegacyRisk(risk: any): RaidItem {
  const id = risk.id ?? uid()
  const legacyType: string = risk.type ?? risk.category ?? 'Risk'
  const categoryMap: Record<string, RaidCategory> = {
    Risk: 'Risk',
    Issue: 'Issue',
    Blocker: 'Issue',
    Dependency: 'Dependency',
    'Change Request': 'Issue',
    Assumption: 'Assumption',
  }
  const category = categoryMap[legacyType] ?? 'Risk'
  const priorityToImpact: Record<string, Impact> = {
    Low: 2,
    Medium: 3,
    High: 4,
    Urgent: 5,
  }
  const impact = priorityToImpact[risk.priority as Priority] ?? 3
  return normalizeRisk({
    ...risk,
    id,
    category,
    title: risk.title ?? risk.description ?? '',
    description: risk.description ?? '',
    targetDate: risk.targetDate ?? risk.due ?? today(),
    createdAt: risk.createdAt ?? risk.raised ?? new Date().toISOString(),
    businessImpact: risk.businessImpact ?? risk.impact ?? '',
    resolutionDetails: risk.resolutionDetails ?? risk.resolution ?? '',
    mitigationPlan: risk.mitigationPlan ?? '',
    inherent:
      risk.probability && risk.impact
        ? makeScore(risk.probability, risk.impact, 'migrated')
        : makeScore(3, impact, 'migrated', `Inferred from legacy priority ${risk.priority}`),
  })
}

export interface RaidMetrics {
  totalOpen: number
  openRisks: number
  criticalRisks: number
  highRisks: number
  unresolvedIssues: number
  unverifiedAssumptions: number
  blockedTasks: number
  atRiskMilestones: number
  overdueActions: number
  upcomingDependencies: number
  awaitingDecisions: number
  newAiSuggestions: number
  projectHealth: 'Healthy' | 'At Risk' | 'Critical' | 'Unknown'
  overallRiskExposure: number
  riskTrend: 'up' | 'down' | 'flat'
  lastRefresh: string
  lastReportAt: string | null
}

export function computeRaidMetrics(
  raids: RaidItem[],
  tasks: TaskLike[],
  _projects: ProjectLike[],
  _settings: RaidSettings = DEFAULT_SETTINGS,
): RaidMetrics {
  const open = raids.filter((r) => r.status !== 'Resolved' && r.status !== 'Closed' && r.status !== 'Cancelled')
  const openRisks = open.filter((r) => r.category === 'Risk')
  const criticalRisks = openRisks.filter((r) => r.current?.severity === 'Critical').length
  const highRisks = openRisks.filter((r) => r.current?.severity === 'High').length
  const unresolvedIssues = open.filter((r) => r.category === 'Issue').length
  const unverifiedAssumptions = open.filter(
    (r) => r.category === 'Assumption' && r.status !== 'Resolved' && r.status !== 'Invalidated' && r.status !== 'Superseded',
  ).length
  const blockedTasks = tasks.filter((t) => t.status === 'Blocked').length
  const overdueActions = open.filter((r) => isOverdue(r.targetDate)).length
  const upcomingDependencies = raids.filter(
    (r) => r.category === 'Dependency' && r.status !== 'Resolved' && r.status !== 'Closed' && isDueSoon(r.targetDate),
  ).length
  const awaitingDecisions = open.filter(
    (r) => r.category === 'Risk' && r.current?.severity === 'Critical' && !r.contingencyPlan,
  ).length
  const exposure = openRisks.reduce((sum, r) => sum + (r.current?.score ?? 0), 0)

  let health: RaidMetrics['projectHealth'] = 'Healthy'
  if (criticalRisks >= _settings.health.criticalOpenRisks) health = 'Critical'
  else if (highRisks >= _settings.health.highOpenRisks || overdueActions >= _settings.health.overdueActionsDays) health = 'At Risk'
  if (!raids.length && !tasks.length) health = 'Unknown'

  return {
    totalOpen: open.length,
    openRisks: openRisks.length,
    criticalRisks,
    highRisks,
    unresolvedIssues,
    unverifiedAssumptions,
    blockedTasks,
    atRiskMilestones: 0,
    overdueActions,
    upcomingDependencies,
    awaitingDecisions,
    newAiSuggestions: 0,
    projectHealth: health,
    overallRiskExposure: exposure,
    riskTrend: 'flat',
    lastRefresh: new Date().toLocaleString(),
    lastReportAt: null,
  }
}

export function computeProjectHealth(
  project: ProjectLike,
  tasks: TaskLike[],
  raids: RaidItem[],
  settings: RaidSettings = DEFAULT_SETTINGS,
): { status: 'Healthy' | 'At Risk' | 'Critical' | 'Unknown'; reasons: string[] } {
  const reasons: string[] = []
  const openRisks = raids.filter((r) => r.projectId === project.id && r.category === 'Risk' && r.status !== 'Resolved' && r.status !== 'Closed')
  const critical = openRisks.filter((r) => r.current?.severity === 'Critical')
  const high = openRisks.filter((r) => r.current?.severity === 'High')
  const issues = raids.filter((r) => r.projectId === project.id && r.category === 'Issue' && r.status !== 'Resolved' && r.status !== 'Closed')
  const overdueRaids = raids.filter((r) => r.projectId === project.id && isOverdue(r.targetDate))
  const blocked = tasks.filter((t) => t.projectId === project.id && t.status === 'Blocked')

  if (critical.length) reasons.push(`${critical.length} Critical risk(s)`)
  if (high.length) reasons.push(`${high.length} High risk(s)`)
  if (issues.filter((r) => r.current?.severity === 'Critical').length) reasons.push('Critical unresolved issue(s)')
  if (overdueRaids.length) reasons.push(`${overdueRaids.length} overdue RAID action(s)`)
  if (blocked.length >= settings.health.blockedTasksThreshold) reasons.push(`${blocked.length} blocked task(s)`)

  let status: 'Healthy' | 'At Risk' | 'Critical' | 'Unknown' = 'Healthy'
  if (!raids.length && !tasks.length) status = 'Unknown'
  else if (reasons.some((r) => r.includes('Critical'))) status = 'Critical'
  else if (reasons.length > 0) status = 'At Risk'
  return { status, reasons }
}

export interface ReportSection {
  title: string
  content: string
  items: any[]
}

export interface LivingRaidReport {
  project: ProjectLike
  generatedAt: string
  period: string
  health: { status: string; reasons: string[] }
  summary: string
  sections: ReportSection[]
  changes: string[]
}

export function generateRaidReport(
  project: ProjectLike,
  tasks: TaskLike[],
  raids: RaidItem[],
  settings: RaidSettings = DEFAULT_SETTINGS,
): LivingRaidReport {
  const projectRaids = raids.filter((r) => r.projectId === project.id)
  const projectTasks = tasks.filter((t) => t.projectId === project.id)
  const health = computeProjectHealth(project, tasks, raids, settings)
  const openRisks = projectRaids.filter((r) => r.category === 'Risk' && r.status !== 'Resolved' && r.status !== 'Closed')
  const criticalRisks = openRisks.filter((r) => r.current?.severity === 'Critical')
  const highRisks = openRisks.filter((r) => r.current?.severity === 'High')
  const issues = projectRaids.filter((r) => r.category === 'Issue' && r.status !== 'Resolved' && r.status !== 'Closed')
  const assumptions = projectRaids.filter((r) => r.category === 'Assumption')
  const dependencies = projectRaids.filter((r) => r.category === 'Dependency')
  const overdue = projectRaids.filter((r) => isOverdue(r.targetDate))

  const summary = `Project health is ${health.status}${
    health.reasons.length ? ' because: ' + health.reasons.join('; ') + '.' : '.'
  } There are ${criticalRisks.length} Critical and ${highRisks.length} High open risks, and ${overdue.length} overdue RAID actions.`

  const sections: ReportSection[] = [
    {
      title: 'Risks',
      content: `${openRisks.length} open risks. Critical: ${criticalRisks.length}, High: ${highRisks.length}.`,
      items: openRisks.sort((a, b) => (b.current?.score ?? 0) - (a.current?.score ?? 0)),
    },
    { title: 'Issues', content: `${issues.length} open issues.`, items: issues },
    { title: 'Assumptions', content: `${assumptions.length} assumptions tracked.`, items: assumptions },
    { title: 'Dependencies', content: `${dependencies.length} dependencies tracked.`, items: dependencies },
    { title: 'Overdue Actions', content: `${overdue.length} overdue items.`, items: overdue },
    { title: 'Blocked Tasks', content: `${projectTasks.filter((t) => t.status === 'Blocked').length} blocked tasks.`, items: projectTasks.filter((t) => t.status === 'Blocked') },
  ]

  return {
    project,
    generatedAt: new Date().toISOString(),
    period: `${project.start} to ${project.end}`,
    health,
    summary,
    sections,
    changes: [],
  }
}

export interface AiFinding {
  id: string
  category: RaidCategory
  title: string
  explanation: string
  evidence: string
  sourceIds: string[]
  sourceType: 'task' | 'risk' | 'project' | 'dependency' | 'assumption'
  detectedAt: string
  confidence: 'Low' | 'Medium' | 'High'
  suggestedProbability: Probability
  suggestedImpact: Impact
  recommendedMitigation: string
  recommendedOwner: string
  reviewBy: string
  status: 'awaiting review' | 'accepted' | 'rejected' | 'superseded'
}

export function scanProjectForRisks(project: ProjectLike, tasks: TaskLike[], raids: RaidItem[], team: string[]): AiFinding[] {
  const findings: AiFinding[] = []
  const projectTasks = tasks.filter((t) => t.projectId === project.id)
  const projectRaids = raids.filter((r) => r.projectId === project.id)

  const suggest = (
    category: RaidCategory,
    title: string,
    explanation: string,
    evidence: string,
    sourceIds: string[],
    sourceType: AiFinding['sourceType'],
    impact: Impact,
    owner: string,
  ) => {
    findings.push({
      id: `ai-${uid()}`,
      category,
      title,
      explanation,
      evidence,
      sourceIds,
      sourceType,
      detectedAt: new Date().toISOString(),
      confidence: 'High',
      suggestedProbability: 4,
      suggestedImpact: impact,
      recommendedMitigation: 'Assign owner and set resolution target.',
      recommendedOwner: owner,
      reviewBy: today(),
      status: 'awaiting review',
    })
  }

  projectTasks
    .filter((t) => t.status === 'Blocked')
    .forEach((t) =>
      suggest('Issue', `Blocked task: ${t.title}`, 'The task is blocked and may delay the project.', `Task "${t.title}" is Blocked.`, [t.id], 'task', 4, t.assignee || team[0] || ''),
    )

  projectTasks
    .filter((t) => t.status !== 'Completed' && t.due && isOverdue(t.due))
    .forEach((t) =>
      suggest('Risk', `Overdue task: ${t.title}`, 'A task is overdue and may impact schedule.', `Task "${t.title}" due ${t.due} has passed.`, [t.id], 'task', 4, t.assignee || team[0] || ''),
    )

  projectTasks
    .filter((t) => !t.assignee && t.status !== 'Completed')
    .forEach((t) =>
      suggest('Risk', `Unowned task: ${t.title}`, 'No assignee and may not progress.', `Task "${t.title}" has no assignee.`, [t.id], 'task', 3, project.manager),
    )

  projectRaids
    .filter((r) => r.category === 'Risk' && r.status !== 'Resolved' && r.status !== 'Closed' && !r.mitigationPlan)
    .forEach((r) =>
      suggest('Risk', `Risk lacks mitigation: ${r.title}`, 'Open risk has no mitigation plan.', `Risk "${r.title}" has no mitigation plan.`, [r.id], 'risk', 4, r.owner || project.manager),
    )

  projectRaids
    .filter((r) => r.category === 'Assumption' && r.status !== 'Resolved' && r.status !== 'Invalidated' && r.status !== 'Superseded' && isOverdue(r.targetDate))
    .forEach((a) =>
      suggest('Risk', `Assumption overdue: ${a.title}`, 'Assumption passed validation deadline and may be a risk.', `Assumption "${a.title}" was due ${a.targetDate}.`, [a.id], 'assumption', 4, a.owner || project.manager),
    )

  projectRaids
    .filter((r) => r.category === 'Dependency' && r.status !== 'Resolved' && r.status !== 'Closed' && isOverdue(r.targetDate))
    .forEach((d) =>
      suggest('Issue', `Dependency overdue: ${d.title}`, 'A prerequisite is overdue and may block downstream work.', `Dependency "${d.title}" was due ${d.targetDate}.`, [d.id], 'dependency', 4, d.owner || d.provider || project.manager),
    )

  return dedupeFindings(findings)
}

function dedupeFindings(findings: AiFinding[]): AiFinding[] {
  const seen = new Set<string>()
  return findings.filter((f) => {
    const key = `${f.title}::${f.sourceIds.join(',')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function csvExport(raids: RaidItem[], projects: ProjectLike[]) {
  const headers = ['ID', 'Project', 'Category', 'Title', 'Status', 'Owner', 'Priority', 'Score', 'Severity', 'Target', 'Created']
  const rows = raids.map((r) => [
    r.id,
    projects.find((p) => p.id === r.projectId)?.name ?? '',
    r.category,
    r.title,
    r.status,
    r.owner,
    r.priority,
    r.current?.score ?? '',
    r.current?.severity ?? '',
    r.targetDate,
    r.createdAt.slice(0, 10),
  ])
  return [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
}
