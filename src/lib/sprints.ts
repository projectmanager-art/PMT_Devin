export type SprintStatus = 'Planned' | 'Active' | 'Sprint Ready' | 'Completed' | 'Cancelled'

export interface Sprint {
  id: string
  projectId: string
  name: string
  number: number
  goal: string
  start: string
  end: string
  workingDays: number
  hoursPerDay: number
  status: SprintStatus
  owner: string
  members: string[]
  originalItemIds: string[]
  createdAt: string
  completedAt?: string
}

export type BacklogType = 'Epic' | 'Story' | 'Task' | 'Bug' | 'Improvement' | 'Technical Debt' | 'CR'
export type BacklogPriority = 'Critical' | 'High' | 'Medium' | 'Low'
export type SprintTaskStatus = 'Backlog' | 'To Do' | 'In Progress' | 'In Review' | 'QA' | 'Blocked' | 'Done'

export interface BacklogItem {
  id: string
  title: string
  description: string
  projectId: string
  epic?: string
  feature?: string
  type: BacklogType
  priority: BacklogPriority
  storyPoints: number
  estimatedHours: number
  businessValue?: number
  assignee?: string
  reporter?: string
  dependencies: string[]
  due?: string
  status: SprintTaskStatus
  sprintId?: string
  sprintOrder: number
  labels: string[]
  attachments: string[]
  comments: string[]
  acceptanceCriteria: string[]
  createdAt: string
  startedAt?: string
  reviewAt?: string
  qaAt?: string
  completedAt?: string
}

export interface TimeLog {
  id: string
  backlogItemId: string
  employee: string
  date: string
  hours: number
  note: string
}

export interface Blocker {
  id: string
  backlogItemId: string
  sprintId: string
  employee: string
  description: string
  type: 'Client Dependency' | 'Internal Dependency' | 'Technical' | 'Requirement' | 'Design' | 'QA' | 'Access' | 'Infrastructure' | 'Approval' | 'Other'
  createdAt: string
  expectedResolution?: string
  actualResolution?: string
  owner: string
  status: 'Open' | 'Resolved'
  blockedHours: number
}

export interface ScopeChange {
  id: string
  sprintId: string
  backlogItemId?: string
  type: 'Added' | 'Removed' | 'Re-estimated' | 'Priority' | 'Assignee' | 'StoryPoints' | 'Deadline'
  oldValue?: string
  newValue?: string
  changedAt: string
  changedBy: string
}

export interface SprintMetric {
  sprintId: string
  date: string
  remainingHours: number
  remainingPoints: number
  completedTasks: number
}

export interface RetrospectiveAction {
  id: string
  action: string
  owner: string
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
  due: string
  status: 'Open' | 'In Progress' | 'Completed'
}

export interface Retrospective {
  sprintId: string
  wentWell: string[]
  didNotGoWell: string[]
  blockers: string[]
  processIssues: string[]
  clientIssues: string[]
  technicalIssues: string[]
  actions: RetrospectiveAction[]
}

export interface Notification {
  id: string
  message: string
  type: 'capacity' | 'risk' | 'blocker' | 'overdue' | 'scope' | 'completion' | 'assignment'
  read: boolean
  createdAt: string
  recipient: 'PM' | 'All' | string
}

export interface SprintData {
  sprints: Sprint[]
  backlog: BacklogItem[]
  timeLogs: TimeLog[]
  blockers: Blocker[]
  scopeChanges: ScopeChange[]
  dailyMetrics: SprintMetric[]
  retrospectives: Retrospective[]
  notifications: Notification[]
}

export const seedSprintData: SprintData = {
  sprints: [],
  backlog: [],
  timeLogs: [],
  blockers: [],
  scopeChanges: [],
  dailyMetrics: [],
  retrospectives: [],
  notifications: [],
}

export function getSprintItems(sprintId: string, data: SprintData) {
  return data.backlog
    .filter((b) => b.sprintId === sprintId)
    .sort((a, b) => a.sprintOrder - b.sprintOrder)
}

export function getBacklogItems(data: SprintData) {
  return data.backlog.filter((b) => !b.sprintId).sort((a, b) => a.sprintOrder - b.sprintOrder)
}

export function getItemLogs(itemId: string, data: SprintData) {
  return data.timeLogs.filter((l) => l.backlogItemId === itemId)
}

export function getItemTotalHours(itemId: string, data: SprintData) {
  return getItemLogs(itemId, data).reduce((sum, l) => sum + l.hours, 0)
}

export function getSprintTotalHours(sprintId: string, data: SprintData) {
  const items = getSprintItems(sprintId, data)
  return items.reduce((sum, item) => sum + getItemTotalHours(item.id, data), 0)
}

export function getSprintPlannedHours(sprintId: string, data: SprintData) {
  return getSprintItems(sprintId, data).reduce((sum, item) => sum + item.estimatedHours, 0)
}

export function getSprintCapacity(sprint: Sprint, _data: SprintData) {
  return sprint.members.length * sprint.workingDays * sprint.hoursPerDay
}

export function getSprintKPIs(sprint: Sprint, data: SprintData) {
  const items = getSprintItems(sprint.id, data)
  const totalPoints = items.reduce((s, i) => s + i.storyPoints, 0)
  const completed = items.filter((i) => i.status === 'Done')
  const completedPoints = completed.reduce((s, i) => s + i.storyPoints, 0)
  const inProgress = items.filter((i) => i.status === 'In Progress').length
  const pending = items.filter((i) => i.status === 'To Do' || i.status === 'Backlog').length
  const blocked = items.filter((i) => i.status === 'Blocked').length
  const carried = sprint.status === 'Completed' ? items.filter((i) => i.status !== 'Done').length : 0
  const plannedHours = getSprintPlannedHours(sprint.id, data)
  const loggedHours = getSprintTotalHours(sprint.id, data)
  const capacity = getSprintCapacity(sprint, data)
  const utilisation = capacity ? Math.round((plannedHours / capacity) * 100) : 0
  const velocity = sprint.status === 'Completed' ? completedPoints : 0
  return {
    totalPoints,
    plannedTasks: items.length,
    completedTasks: completed.length,
    inProgress,
    pending,
    blocked,
    carried,
    completion: items.length ? Math.round((completed.length / items.length) * 100) : 0,
    completedPoints,
    plannedHours,
    loggedHours,
    remainingHours: Math.max(0, plannedHours - loggedHours),
    capacity,
    utilisation,
    velocity,
  }
}

export function getSprintBlockers(sprintId: string, data: SprintData) {
  return data.blockers.filter((b) => b.sprintId === sprintId)
}

export function getSprintScopeChanges(sprintId: string, data: SprintData) {
  return data.scopeChanges.filter((sc) => sc.sprintId === sprintId)
}

export function getSprintHealthScore(sprint: Sprint, data: SprintData) {
  const kpi = getSprintKPIs(sprint, data)
  const scopeChanges = getSprintScopeChanges(sprint.id, data).length
  const openBlockers = getSprintBlockers(sprint.id, data).filter((b) => b.status === 'Open').length
  let score = 100
  if (kpi.completion < 50) score -= 20
  if (kpi.blocked > 0) score -= 10 * kpi.blocked
  if (kpi.utilisation > 100) score -= 15
  if (scopeChanges > 0) score -= 5 * scopeChanges
  if (openBlockers > 0) score -= 10 * openBlockers
  if (kpi.carried > 0) score -= 8 * kpi.carried
  const status: 'Healthy' | 'At Risk' | 'Critical' =
    score >= 80 ? 'Healthy' : score >= 60 ? 'At Risk' : 'Critical'
  const reasons: string[] = []
  if (kpi.blocked) reasons.push(`${kpi.blocked} blocked task${kpi.blocked > 1 ? 's' : ''}`)
  if (kpi.utilisation > 100) reasons.push('Sprint is overloaded')
  if (scopeChanges) reasons.push(`${scopeChanges} scope change${scopeChanges > 1 ? 's' : ''}`)
  if (openBlockers) reasons.push(`${openBlockers} open blocker${openBlockers > 1 ? 's' : ''}`)
  if (kpi.carried) reasons.push(`${kpi.carried} carried forward`)
  return { score: Math.max(0, score), status, reasons }
}

export interface EmployeePerformance {
  name: string
  role: string
  assignedTasks: number
  completedTasks: number
  assignedPoints: number
  completedPoints: number
  plannedHours: number
  actualHours: number
  blockedHours: number
  bugsCreated: number
  bugsReopened: number
  qaRejections: number
  reworkTasks: number
  blockersRaised: number
  blockersResolved: number
  completionRate: number
  onTimeRate: number
  cycleTime: number
  estimationAccuracy: number
  score: number
  scoreBreakdown: Record<string, number>
  rating: string
}

function roleFor(name: string, team: { name: string; role: string }[]) {
  return team.find((t) => t.name === name)?.role ?? 'Team Member'
}

function cycleTime(item: BacklogItem) {
  if (!item.startedAt || !item.completedAt) return 0
  const s = new Date(item.startedAt).getTime()
  const e = new Date(item.completedAt).getTime()
  return Math.max(0, Math.round((e - s) / (1000 * 60 * 60 * 24)))
}

export function calculateEmployeePerformance(
  sprint: Sprint,
  data: SprintData,
  team: { name: string; role: string }[],
): EmployeePerformance[] {
  const items = getSprintItems(sprint.id, data)
  const blockers = getSprintBlockers(sprint.id, data)
  return sprint.members.map((member) => {
    const assigned = items.filter((i) => i.assignee === member)
    const completed = assigned.filter((i) => i.status === 'Done')
    const assignedPoints = assigned.reduce((s, i) => s + i.storyPoints, 0)
    const completedPoints = completed.reduce((s, i) => s + i.storyPoints, 0)
    const plannedHours = assigned.reduce((s, i) => s + i.estimatedHours, 0)
    const actualHours = assigned.reduce((s, i) => s + getItemTotalHours(i.id, data), 0)
    const blockedHours = blockers.filter((b) => b.employee === member).reduce((s, b) => s + b.blockedHours, 0)
    const bugsCreated = assigned.filter((i) => i.type === 'Bug').length
    const bugsReopened = 0
    const qaRejections = 0
    const reworkTasks = assigned.filter((i) => i.type === 'Bug' || i.type === 'Improvement').length
    const blockersRaised = blockers.filter((b) => b.employee === member).length
    const blockersResolved = 0
    const completionRate = assigned.length ? Math.round((completed.length / assigned.length) * 100) : 0
    const onTime = completed.filter((i) => i.completedAt && i.due && i.completedAt <= i.due).length
    const onTimeRate = completed.length ? Math.round((onTime / completed.length) * 100) : 0
    const completedWithCycle = completed.filter((i) => i.startedAt && i.completedAt)
    const avgCycle = completedWithCycle.length
      ? completedWithCycle.reduce((s, i) => s + cycleTime(i), 0) / completedWithCycle.length
      : 0
    const estimationAccuracy = actualHours > 0 ? Math.round((plannedHours / actualHours) * 100) : 0

    const breakdown = {
      Delivery: Math.min(30, Math.round(30 * (completionRate / 100))),
      Quality: Math.max(0, 20 - bugsCreated * 4 - qaRejections * 3),
      'Estimation Accuracy': Math.min(15, Math.round(15 * (estimationAccuracy / 100))),
      Productivity: Math.min(15, Math.round(15 * (completedPoints / Math.max(1, assignedPoints)))),
      Reliability: Math.min(10, Math.round(10 * (onTimeRate / 100))),
      Collaboration: Math.min(10, Math.round(10 * (blockersRaised ? 0.5 : 1))),
    }
    const score = Object.values(breakdown).reduce((s, v) => s + v, 0)
    const rating =
      score >= 90 ? 'Exceptional' : score >= 80 ? 'Strong' : score >= 70 ? 'Good' : score >= 60 ? 'Needs Attention' : 'Critical Review'

    return {
      name: member,
      role: roleFor(member, team),
      assignedTasks: assigned.length,
      completedTasks: completed.length,
      assignedPoints,
      completedPoints,
      plannedHours,
      actualHours,
      blockedHours,
      bugsCreated,
      bugsReopened,
      qaRejections,
      reworkTasks,
      blockersRaised,
      blockersResolved,
      completionRate,
      onTimeRate,
      cycleTime: Math.round(avgCycle),
      estimationAccuracy,
      score,
      scoreBreakdown: breakdown,
      rating,
    }
  })
}
