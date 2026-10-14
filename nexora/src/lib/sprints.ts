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

const offset = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export const seedSprintData: SprintData = {
  sprints: [
    {
      id: 's1',
      projectId: 'p1',
      name: 'Sprint 1 — Foundation',
      number: 1,
      goal: 'Deliver homepage, navigation and core brand components for Atlas Rebrand.',
      start: offset(-14),
      end: offset(-2),
      workingDays: 10,
      hoursPerDay: 8,
      status: 'Completed',
      owner: 'Sandeep Rana',
      members: ['Sandeep Rana', 'Maya Patel', 'Chris Wong', 'Alex Morgan'],
      originalItemIds: ['b1', 'b2', 'b3', 'b4'],
      createdAt: offset(-20),
      completedAt: offset(-2),
    },
    {
      id: 's2',
      projectId: 'p3',
      name: 'Sprint 2 — Mercury Mobile v1.2',
      number: 2,
      goal: 'Complete payment flow, QA mobile navigation and security checklist.',
      start: offset(-1),
      end: offset(13),
      workingDays: 10,
      hoursPerDay: 8,
      status: 'Active',
      owner: 'Sandeep Rana',
      members: ['Sandeep Rana', 'Maya Patel', 'Chris Wong', 'Alex Morgan', 'Sam Lee'],
      originalItemIds: ['b5', 'b6', 'b7', 'b8', 'b9', 'b10'],
      createdAt: offset(-7),
    },
    {
      id: 's3',
      projectId: 'p2',
      name: 'Sprint 3 — Vertex Campaign Launch',
      number: 3,
      goal: 'Finalize launch assets and get client approval for color system.',
      start: offset(3),
      end: offset(17),
      workingDays: 10,
      hoursPerDay: 8,
      status: 'Planned',
      owner: 'Sandeep Rana',
      members: ['Sandeep Rana', 'Maya Patel', 'Sam Lee'],
      originalItemIds: ['b11', 'b12', 'b13'],
      createdAt: offset(-1),
    },
  ],
  backlog: [
    { id: 'b1', title: 'Homepage hero design', description: 'Create the new homepage hero.', projectId: 'p1', type: 'Story', priority: 'High', storyPoints: 5, estimatedHours: 12, assignee: 'Maya Patel', reporter: 'Sandeep Rana', dependencies: [], status: 'Done', sprintId: 's1', sprintOrder: 0, labels: ['design'], attachments: [], comments: [], acceptanceCriteria: [], createdAt: offset(-19), startedAt: offset(-14), reviewAt: offset(-6), qaAt: offset(-4), completedAt: offset(-3) },
    { id: 'b2', title: 'Navigation component', description: 'Responsive navigation.', projectId: 'p1', type: 'Task', priority: 'High', storyPoints: 3, estimatedHours: 8, assignee: 'Chris Wong', reporter: 'Sandeep Rana', dependencies: [], status: 'Done', sprintId: 's1', sprintOrder: 1, labels: ['ui'], attachments: [], comments: [], acceptanceCriteria: [], createdAt: offset(-19), startedAt: offset(-13), reviewAt: offset(-5), completedAt: offset(-4) },
    { id: 'b3', title: 'Brand color tokens', description: 'Define color tokens.', projectId: 'p1', type: 'Task', priority: 'Medium', storyPoints: 2, estimatedHours: 6, assignee: 'Maya Patel', reporter: 'Sandeep Rana', dependencies: [], status: 'Done', sprintId: 's1', sprintOrder: 2, labels: ['design-system'], attachments: [], comments: [], acceptanceCriteria: [], createdAt: offset(-19), completedAt: offset(-5) },
    { id: 'b4', title: 'Footer layout', description: 'Footer layout.', projectId: 'p1', type: 'Task', priority: 'Low', storyPoints: 2, estimatedHours: 5, assignee: 'Alex Morgan', reporter: 'Sandeep Rana', dependencies: [], status: 'Done', sprintId: 's1', sprintOrder: 3, labels: ['frontend'], attachments: [], comments: [], acceptanceCriteria: [], createdAt: offset(-19), completedAt: offset(-2) },
    { id: 'b5', title: 'Payment flow UX', description: 'Payment flow wireframes.', projectId: 'p3', type: 'Story', priority: 'Critical', storyPoints: 8, estimatedHours: 20, assignee: 'Maya Patel', reporter: 'Sandeep Rana', dependencies: [], status: 'In Progress', sprintId: 's2', sprintOrder: 0, labels: ['ux'], attachments: [], comments: [], acceptanceCriteria: [], createdAt: offset(-8), startedAt: offset(-1) },
    { id: 'b6', title: 'QA mobile navigation', description: 'QA the navigation.', projectId: 'p3', type: 'Bug', priority: 'High', storyPoints: 3, estimatedHours: 8, assignee: 'Sam Lee', reporter: 'Chris Wong', dependencies: ['b2'], status: 'Done', completedAt: offset(0), sprintId: 's2', sprintOrder: 1, labels: ['qa'], attachments: [], comments: [], acceptanceCriteria: [], createdAt: offset(-8), startedAt: offset(-2), reviewAt: offset(0), qaAt: offset(0) },
    { id: 'b7', title: 'Security checklist', description: 'Security review.', projectId: 'p3', type: 'Technical Debt', priority: 'High', storyPoints: 5, estimatedHours: 12, assignee: 'Alex Morgan', reporter: 'Sandeep Rana', dependencies: [], status: 'Done', completedAt: offset(0), sprintId: 's2', sprintOrder: 2, labels: ['security'], attachments: [], comments: [], acceptanceCriteria: [], createdAt: offset(-8), startedAt: offset(-1), reviewAt: offset(0) },
    { id: 'b8', title: 'Onboarding screens', description: 'Onboarding screens.', projectId: 'p3', type: 'Story', priority: 'Medium', storyPoints: 5, estimatedHours: 14, assignee: 'Chris Wong', reporter: 'Maya Patel', dependencies: [], status: 'To Do', sprintId: 's2', sprintOrder: 3, labels: ['ui'], attachments: [], comments: [], acceptanceCriteria: [], createdAt: offset(-8) },
    { id: 'b9', title: 'Analytics events', description: 'Set up analytics events.', projectId: 'p3', type: 'Task', priority: 'Medium', storyPoints: 3, estimatedHours: 10, assignee: 'Alex Morgan', reporter: 'Sandeep Rana', dependencies: ['b8'], status: 'Blocked', sprintId: 's2', sprintOrder: 4, labels: ['analytics'], attachments: [], comments: [], acceptanceCriteria: [], createdAt: offset(-8) },
    { id: 'b10', title: 'Push notifications', description: 'Push notification setup.', projectId: 'p3', type: 'Task', priority: 'Low', storyPoints: 2, estimatedHours: 7, assignee: 'Sam Lee', reporter: 'Sandeep Rana', dependencies: [], status: 'Backlog', sprintId: 's2', sprintOrder: 5, labels: ['backend'], attachments: [], comments: [], acceptanceCriteria: [], createdAt: offset(-8) },
    { id: 'b11', title: 'Launch banner', description: 'Launch banner design.', projectId: 'p2', type: 'Story', priority: 'High', storyPoints: 5, estimatedHours: 12, assignee: 'Maya Patel', reporter: 'Sandeep Rana', dependencies: [], status: 'Backlog', sprintOrder: 0, labels: ['campaign'], attachments: [], comments: [], acceptanceCriteria: [], createdAt: offset(-2) },
    { id: 'b12', title: 'Client approval color system', description: 'Get approval.', projectId: 'p2', type: 'Task', priority: 'Critical', storyPoints: 2, estimatedHours: 4, assignee: 'Sandeep Rana', reporter: 'Maya Patel', dependencies: [], status: 'Backlog', sprintOrder: 1, labels: ['client'], attachments: [], comments: [], acceptanceCriteria: [], createdAt: offset(-2) },
    { id: 'b13', title: 'Landing page copy', description: 'Landing page copy.', projectId: 'p2', type: 'Task', priority: 'Medium', storyPoints: 3, estimatedHours: 8, assignee: 'Sam Lee', reporter: 'Sandeep Rana', dependencies: [], status: 'Backlog', sprintOrder: 2, labels: ['copy'], attachments: [], comments: [], acceptanceCriteria: [], createdAt: offset(-2) },
  ],
  timeLogs: [
    { id: 'l1', backlogItemId: 'b1', employee: 'Maya Patel', date: offset(-12), hours: 6, note: 'Initial concepts' },
    { id: 'l2', backlogItemId: 'b1', employee: 'Maya Patel', date: offset(-10), hours: 6, note: 'Refinements' },
    { id: 'l3', backlogItemId: 'b2', employee: 'Chris Wong', date: offset(-11), hours: 4, note: 'Wireframe' },
    { id: 'l4', backlogItemId: 'b2', employee: 'Chris Wong', date: offset(-9), hours: 4, note: 'Build' },
    { id: 'l5', backlogItemId: 'b3', employee: 'Maya Patel', date: offset(-8), hours: 6, note: 'Tokens' },
    { id: 'l6', backlogItemId: 'b4', employee: 'Alex Morgan', date: offset(-5), hours: 5, note: 'Footer' },
    { id: 'l7', backlogItemId: 'b5', employee: 'Maya Patel', date: offset(-1), hours: 4, note: 'Flow start' },
    { id: 'l8', backlogItemId: 'b6', employee: 'Sam Lee', date: offset(0), hours: 6, note: 'QA pass 1' },
    { id: 'l9', backlogItemId: 'b7', employee: 'Alex Morgan', date: offset(0), hours: 5, note: 'Security review' },
    { id: 'l10', backlogItemId: 'b9', employee: 'Alex Morgan', date: offset(-1), hours: 2, note: 'Blocked investigation' },
    { id: 'l11', backlogItemId: 'b6', employee: 'Sam Lee', date: offset(0), hours: 2, note: 'QA sign-off' },
    { id: 'l12', backlogItemId: 'b7', employee: 'Alex Morgan', date: offset(0), hours: 7, note: 'Security checklist completed' },
  ],
  blockers: [
    { id: 'bk1', backlogItemId: 'b9', sprintId: 's2', employee: 'Alex Morgan', description: 'Waiting for analytics access credentials.', type: 'Access', createdAt: offset(-1), expectedResolution: offset(1), owner: 'Sandeep Rana', status: 'Open', blockedHours: 4 },
    { id: 'bk2', backlogItemId: 'b7', sprintId: 's2', employee: 'Alex Morgan', description: 'Client sign-off pending.', type: 'Client Dependency', createdAt: offset(0), expectedResolution: offset(2), owner: 'Sandeep Rana', status: 'Resolved', actualResolution: 'Client sign-off received and checklist completed', blockedHours: 2 },
  ],
  scopeChanges: [
    { id: 'sc1', sprintId: 's2', backlogItemId: 'b10', type: 'Added', changedAt: offset(0), changedBy: 'Sandeep Rana' },
    { id: 'sc2', sprintId: 's2', backlogItemId: 'b9', type: 'Re-estimated', oldValue: '7', newValue: '10', changedAt: offset(-1), changedBy: 'Sandeep Rana' },
  ],
  dailyMetrics: ((): SprintMetric[] => {
    const hours = [71, 45, 41, 37, 33, 29, 25, 21, 17, 13, 9, 6, 3, 0]
    const tasks = [0, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6]
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - 1 + i)
      return {
        sprintId: 's2',
        date: d.toISOString().slice(0, 10),
        remainingHours: hours[i],
        remainingPoints: Math.round((hours[i] / 71) * 26),
        completedTasks: tasks[i],
      }
    })
  })(),
  retrospectives: [
    {
      sprintId: 's1',
      wentWell: ['Design review cadence', 'Clear acceptance criteria'],
      didNotGoWell: ['Late client feedback'],
      blockers: [],
      processIssues: ['Handoff documentation'],
      clientIssues: ['Approval turnaround'],
      technicalIssues: [],
      actions: [
        { id: 'a1', action: 'Document handoff checklist', owner: 'Sandeep Rana', priority: 'High', due: offset(5), status: 'Open' },
      ],
    },
  ],
  notifications: [
    { id: 'n1', message: 'Alex Morgan is overloaded in Sprint 2.', type: 'capacity', read: false, createdAt: offset(0), recipient: 'PM' },
    { id: 'n2', message: 'Sprint 2 scope increased by 2 tasks.', type: 'scope', read: false, createdAt: offset(0), recipient: 'PM' },
    { id: 'n3', message: 'New blocker on Payment flow UX.', type: 'blocker', read: false, createdAt: offset(-1), recipient: 'Maya Patel' },
  ],
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
  return { score, status, reasons }
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
