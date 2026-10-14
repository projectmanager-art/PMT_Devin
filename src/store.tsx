import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { migrateLegacyRisk, normalizeRisk, type AiFinding, type RaidItem } from './lib/raid'

export type ProjectStatus = 'Planning' | 'In Progress' | 'On Hold' | 'Completed'
export type Health = 'Green' | 'Amber' | 'Red'
export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent'
export type TaskStatus = 'To Do' | 'In Progress' | 'Review' | 'Blocked' | 'Completed'

export interface Project {
  id: string
  name: string
  client: string
  manager: string
  status: ProjectStatus
  health: Health
  progress: number
  priority: Priority
  start: string
  end: string
  type: string
  budget: string
  estimatedHours: number
  actualHours: number
  description: string
  notes: string
}

export interface TaskComment {
  id: string
  text: string
  author: string
  createdAt: string
  updatedAt: string
  isSystem?: boolean
}

export interface TaskActivityEvent {
  id: string
  type: 'comment' | 'status' | 'priority' | 'assignee' | 'due' | 'start' | 'follow-up' | 'dependency' | 'raid' | 'create' | 'update'
  message: string
  author: string
  createdAt: string
}

export interface Task {
  id: string
  title: string
  projectId: string
  assignee: string
  status: TaskStatus
  priority: Priority
  start?: string
  due: string
  nextFollowUp?: string
  estimatedHours: number
  actualHours: number
  description?: string
  acceptanceCriteria?: string
  labels?: string[]
  taskComments: TaskComment[]
  dependencies: string[]
  activity: TaskActivityEvent[]
}

export interface Client {
  id: string
  name: string
  company: string
  contact: string
  email: string
  phone: string
  website: string
  notes: string
  requirements: string
  pendingApprovals: string
  gender?: 'male' | 'female'
}

export interface TeamMember {
  id: string
  name: string
  role: string
  skills: string
  capacity: number
  utilized: number
  projects: string[]
  gender?: 'male' | 'female'
}

export type { RaidItem }
export type Risk = RaidItem

export type MeetingType = 'Client meeting' | 'Internal meeting' | 'Project review' | 'Discovery call' | 'Sprint review' | 'Follow-up' | 'Other'
export type MeetingStatus = 'Scheduled' | 'Completed' | 'Cancelled'

export interface MeetingHistoryEvent {
  id: string
  message: string
  at: string
}

export interface Meeting {
  id: string
  title: string
  date: string
  time: string
  participants: string
  discussion: string
  decisions: string
  actionItems: string
  responsible: string
  deadline: string
  description?: string
  type?: MeetingType
  projectId?: string
  projectName?: string
  clientId?: string
  clientName?: string
  taskId?: string
  startTime?: string
  endTime?: string
  timezone?: string
  agenda?: string
  notes?: string
  attendeeEmails?: string[]
  status?: MeetingStatus
  provider?: 'Google Meet' | 'Other' | 'Not set'
  meetUrl?: string
  googleCalendarEventId?: string
  conferenceStatus?: 'not-configured' | 'pending' | 'ready' | 'failed'
  syncStatus?: 'not-configured' | 'pending' | 'synced' | 'failed'
  lastSyncedAt?: string
  lastSyncError?: string
  reminderMinutes?: number[]
  convertedActionItemLines?: string[]
  linkedTaskIds?: Record<string, string>
  history?: MeetingHistoryEvent[]
}

export interface DocumentItem {
  id: string
  name: string
  projectId: string
  updated: string
  status: 'Shared' | 'In review' | 'Draft'
  size: string
  description?: string
  fileId?: string
  fileName?: string
  mimeType?: string
}

export interface Activity {
  id: string
  message: string
  project: string
  time: string
  type: 'task' | 'comment' | 'status' | 'risk' | 'meeting' | 'project'
}

export interface AppData {
  projects: Project[]
  tasks: Task[]
  clients: Client[]
  team: TeamMember[]
  risks: Risk[]
  aiFindings: AiFinding[]
  meetings: Meeting[]
  documents: DocumentItem[]
  activity: Activity[]
}

const uid = () => Math.random().toString(36).slice(2, 9)

const seed = {
  projects: [
    { id: 'p1', name: 'Atlas Rebrand', client: 'Atlas Corp', manager: 'Sandeep Rana', status: 'In Progress', health: 'Green', progress: 65, priority: 'High', start: '2026-07-12', end: '2026-09-28', type: 'Brand & Web', budget: '$42,000', estimatedHours: 320, actualHours: 208, description: 'Complete brand refresh and digital experience for Atlas Corp.', notes: 'Client prefers weekly written updates.' },
    { id: 'p2', name: 'Vertex Campaign', client: 'Vertex Marketing', manager: 'Maya Patel', status: 'Planning', health: 'Amber', progress: 25, priority: 'Urgent', start: '2026-08-18', end: '2026-10-15', type: 'Campaign', budget: '$24,000', estimatedHours: 180, actualHours: 45, description: 'Product launch campaign pending final client approval.', notes: 'Waiting on brand sign-off.' },
    { id: 'p3', name: 'Mercury Mobile App', client: 'Mercury LLC', manager: 'Chris Wong', status: 'In Progress', health: 'Green', progress: 80, priority: 'High', start: '2026-06-02', end: '2026-09-20', type: 'Product Design', budget: '$68,500', estimatedHours: 480, actualHours: 384, description: 'Mobile-first financial planning experience for Mercury.', notes: 'Security review required before launch.' },
    { id: 'p4', name: 'Northwind Portal', client: 'Northwind Logistics', manager: 'Sam Lee', status: 'Planning', health: 'Green', progress: 15, priority: 'Medium', start: '2026-09-01', end: '2026-10-24', type: 'Web Platform', budget: '$31,200', estimatedHours: 250, actualHours: 38, description: 'Self-service logistics portal for Northwind customers.', notes: 'Kickoff completed.' },
    { id: 'p5', name: 'Orchid Analytics', client: 'Orchid Retail', manager: 'Maya Patel', status: 'Completed', health: 'Green', progress: 100, priority: 'Medium', start: '2026-04-05', end: '2026-08-30', type: 'Data & Analytics', budget: '$52,000', estimatedHours: 390, actualHours: 382, description: 'Retail analytics dashboard and reporting suite.', notes: 'Handoff complete.' },
    { id: 'p6', name: 'Cobalt Website', client: 'Cobalt Energy', manager: 'Sandeep Rana', status: 'On Hold', health: 'Red', progress: 40, priority: 'Medium', start: '2026-07-20', end: '2026-10-08', type: 'Web Platform', budget: '$29,000', estimatedHours: 220, actualHours: 88, description: 'High-performance marketing website for Cobalt Energy.', notes: 'Paused pending content decisions.' },
  ],
  tasks: [
    { id: 't1', title: 'Finalize homepage content', projectId: 'p1', assignee: 'Maya Patel', status: 'In Progress', priority: 'High', due: '2026-09-06', estimatedHours: 12, actualHours: 8, comments: ['Waiting on final copy.'], dependencies: [] },
    { id: 't2', title: 'QA mobile navigation', projectId: 'p3', assignee: 'Chris Wong', status: 'Review', priority: 'High', due: '2026-09-05', estimatedHours: 8, actualHours: 6, comments: [], dependencies: ['t1'] },
    { id: 't3', title: 'Client approval: color system', projectId: 'p2', assignee: 'Sandeep Rana', status: 'Blocked', priority: 'Urgent', due: '2026-09-01', estimatedHours: 4, actualHours: 2, comments: ['Client response overdue.'], dependencies: [] },
    { id: 't4', title: 'Set up analytics events', projectId: 'p6', assignee: 'Alex Morgan', status: 'To Do', priority: 'Medium', due: '2026-09-10', estimatedHours: 10, actualHours: 0, comments: [], dependencies: [] },
    { id: 't5', title: 'Prototype customer portal', projectId: 'p4', assignee: 'Chris Wong', status: 'In Progress', priority: 'Medium', due: '2026-09-14', estimatedHours: 20, actualHours: 12, comments: [], dependencies: [] },
    { id: 't6', title: 'Prepare handoff documentation', projectId: 'p5', assignee: 'Alex Morgan', status: 'Completed', priority: 'Low', due: '2026-08-29', estimatedHours: 6, actualHours: 6, comments: [], dependencies: [] },
    { id: 't7', title: 'Payment flow usability test', projectId: 'p3', assignee: 'Maya Patel', status: 'To Do', priority: 'High', due: '2026-09-08', estimatedHours: 16, actualHours: 0, comments: [], dependencies: [] },
    { id: 't8', title: 'Landing page animation', projectId: 'p6', assignee: 'Sam Lee', status: 'Completed', priority: 'Low', due: '2026-09-01', estimatedHours: 7, actualHours: 7, comments: [], dependencies: [] },
    { id: 't9', title: 'Finalize pitch deck', projectId: 'p2', assignee: 'Sandeep Rana', status: 'In Progress', priority: 'High', due: '2026-10-01', estimatedHours: 6, actualHours: 3, comments: [], dependencies: [] },
    { id: 't10', title: 'Client call prep', projectId: 'p4', assignee: 'Maya Patel', status: 'To Do', priority: 'Medium', due: '2026-10-01', estimatedHours: 4, actualHours: 0, comments: [], dependencies: [] },
    { id: 't11', title: 'Review SEO keywords', projectId: 'p1', assignee: 'Chris Wong', status: 'In Progress', priority: 'Medium', due: '2026-10-02', estimatedHours: 8, actualHours: 4, comments: [], dependencies: [] },
    { id: 't12', title: 'Submit expense reports', projectId: 'p5', assignee: 'Alex Morgan', status: 'Completed', priority: 'Low', due: '2026-10-02', estimatedHours: 3, actualHours: 3, comments: [], dependencies: [] },
    { id: 't13', title: 'QA regression suite', projectId: 'p3', assignee: 'Sam Lee', status: 'Blocked', priority: 'High', due: '2026-10-03', estimatedHours: 12, actualHours: 4, comments: ['Waiting on test environment.'], dependencies: [] },
    { id: 't14', title: 'Sprint planning', projectId: 'p3', assignee: 'Sandeep Rana', status: 'To Do', priority: 'High', due: '2026-10-05', estimatedHours: 5, actualHours: 0, comments: [], dependencies: [] },
    { id: 't15', title: 'Design system tokens', projectId: 'p1', assignee: 'Maya Patel', status: 'Review', priority: 'Medium', due: '2026-10-06', estimatedHours: 9, actualHours: 9, comments: ['Ready for review.'], dependencies: [] },
    { id: 't16', title: 'Deploy staging build', projectId: 'p4', assignee: 'Alex Morgan', status: 'In Progress', priority: 'Urgent', due: '2026-10-07', estimatedHours: 7, actualHours: 3, comments: [], dependencies: [] },
    { id: 't17', title: 'Contract redlines', projectId: 'p6', assignee: 'Sandeep Rana', status: 'Blocked', priority: 'Medium', due: '2026-09-30', estimatedHours: 4, actualHours: 1, comments: ['Legal feedback pending.'], dependencies: [] },
  ],
  clients: [
    { id: 'c1', name: 'Atlas Corp', company: 'Atlas Corporation', contact: 'Amelia Stone', email: 'amelia@atlas.example', phone: '+1 415 555 0198', website: 'atlas.example', notes: 'Executive sponsor prefers weekly written updates.', requirements: 'Brand refresh, website, guidelines.', pendingApprovals: 'Final homepage copy', gender: 'female' },
    { id: 'c2', name: 'Vertex Marketing', company: 'Vertex Marketing Group', contact: 'Theo Grant', email: 'theo@vertex.example', phone: '+1 646 555 0113', website: 'vertex.example', notes: 'Pending brand approval.', requirements: 'Launch campaign, creative assets.', pendingApprovals: 'Color system sign-off', gender: 'male' },
    { id: 'c3', name: 'Mercury LLC', company: 'Mercury Financial', contact: 'Marcus Bell', email: 'marcus@mercury.example', phone: '+1 212 555 0142', website: 'mercury.example', notes: 'Security review required before launch.', requirements: 'Mobile app design and build.', pendingApprovals: 'Security checklist', gender: 'male' },
    { id: 'c4', name: 'Northwind Logistics', company: 'Northwind Logistics', contact: 'Priya Shah', email: 'priya@northwind.example', phone: '+1 312 555 0177', website: 'northwind.example', notes: 'Main contact available Tuesday–Thursday.', requirements: 'Customer portal.', pendingApprovals: 'None', gender: 'female' },
  ],
  team: [
    { id: 'm1', name: 'Sandeep Rana', role: 'Project Manager', skills: 'Strategy, Delivery', capacity: 40, utilized: 31, projects: ['Atlas Rebrand', 'Cobalt Website', 'Vertex Campaign'], gender: 'male' },
    { id: 'm2', name: 'Maya Patel', role: 'Senior Designer', skills: 'UX, Visual Design', capacity: 40, utilized: 36, projects: ['Atlas Rebrand', 'Mercury Mobile App', 'Orchid Analytics'], gender: 'female' },
    { id: 'm3', name: 'Chris Wong', role: 'Product Designer', skills: 'Research, UI', capacity: 40, utilized: 27, projects: ['Mercury Mobile App', 'Northwind Portal'], gender: 'male' },
    { id: 'm4', name: 'Alex Morgan', role: 'Engineer', skills: 'Frontend, Analytics', capacity: 40, utilized: 19, projects: ['Cobalt Website', 'Orchid Analytics'], gender: 'male' },
    { id: 'm5', name: 'Sam Lee', role: 'Engineer', skills: 'Backend, QA', capacity: 40, utilized: 14, projects: ['Northwind Portal', 'Cobalt Website'], gender: 'male' },
  ],
  risks: [
    { id: 'r1', projectId: 'p2', type: 'Issue', description: 'Client approval pending', priority: 'Urgent', owner: 'Sandeep Rana', raised: '2026-08-28', due: '2026-09-01', status: 'Open', impact: 'Launch delay', resolution: 'Follow up daily until sign-off.' },
    { id: 'r2', projectId: 'p3', type: 'Risk', description: 'Security review scope', priority: 'High', owner: 'Chris Wong', raised: '2026-08-30', due: '2026-09-12', status: 'Monitoring', impact: 'Launch risk', resolution: 'Schedule review with security team.' },
    { id: 'r3', projectId: 'p1', type: 'Dependency', description: 'Content delivery delay', priority: 'Medium', owner: 'Maya Patel', raised: '2026-09-02', due: '2026-09-06', status: 'Open', impact: 'Timeline slip', resolution: 'Escalate to client sponsor.' },
  ],
  meetings: [
    { id: 'mt1', title: 'Mercury weekly sync', date: '2026-09-05', time: '10:00 AM', participants: 'Marcus Bell, Chris Wong, Sandeep Rana', discussion: 'Sprint progress and security review.', decisions: 'Proceed with QA after security sign-off.', actionItems: 'Chris to schedule security review.', responsible: 'Chris Wong', deadline: '2026-09-07' },
    { id: 'mt2', title: 'Atlas creative review', date: '2026-09-08', time: '02:00 PM', participants: 'Amelia Stone, Maya Patel, Sandeep Rana', discussion: 'Homepage concepts and content.', decisions: 'Approve concept B with revisions.', actionItems: 'Maya to update hero section.', responsible: 'Maya Patel', deadline: '2026-09-10' },
    { id: 'mt3', title: 'Sprint standup', date: '2026-10-01', time: '10:00 AM', participants: 'All', discussion: 'Daily sync.', decisions: 'No blockers.', actionItems: 'Continue on track.', responsible: 'Sandeep Rana', deadline: '2026-10-01' },
    { id: 'mt4', title: 'Design review', date: '2026-10-03', time: '02:00 PM', participants: 'Maya, Chris', discussion: 'Design system.', decisions: 'Approve tokens.', actionItems: 'Update handoff.', responsible: 'Maya Patel', deadline: '2026-10-06' },
    { id: 'mt5', title: 'Project kickoff', date: '2026-10-06', time: '11:00 AM', participants: 'Northwind, Sandeep', discussion: 'Portal scope.', decisions: 'Proceed with prototype.', actionItems: 'Send invite.', responsible: 'Sandeep Rana', deadline: '2026-10-08' },
  ],
  documents: [
    { id: 'd1', name: 'Atlas Rebrand — Brand guidelines.pdf', projectId: 'p1', updated: '2026-09-04', status: 'Shared', size: '2.4 MB' },
    { id: 'd2', name: 'Mercury — Security review checklist', projectId: 'p3', updated: '2026-09-03', status: 'In review', size: '480 KB' },
    { id: 'd3', name: 'Vertex — Launch brief.docx', projectId: 'p2', updated: '2026-08-28', status: 'Draft', size: '1.1 MB' },
  ],
  activity: [
    { id: 'a1', message: 'Maya completed “Handoff documentation”', project: 'Atlas Rebrand', time: '32 minutes ago', type: 'task' },
    { id: 'a2', message: 'New comment from Amelia Stone', project: 'Atlas Rebrand', time: '2 hours ago', type: 'comment' },
    { id: 'a3', message: 'Task moved to blocked', project: 'Vertex Campaign', time: 'Yesterday', type: 'status' },
    { id: 'a4', message: 'Risk raised: Security review scope', project: 'Mercury Mobile App', time: 'Yesterday', type: 'risk' },
    { id: 'a5', message: 'Meeting scheduled: Atlas creative review', project: 'Atlas Rebrand', time: '2 days ago', type: 'meeting' },
  ],
} as unknown as AppData

interface AppContextValue extends AppData {
  addProject: (project: Omit<Project, 'id'>) => void
  updateProject: (id: string, patch: Partial<Project>) => void
  deleteProject: (id: string) => void
  addTask: (task: Omit<Task, 'id'>) => string
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  addClient: (client: Omit<Client, 'id'>) => void
  updateClient: (id: string, patch: Partial<Client>) => void
  deleteClient: (id: string) => void
  addTeamMember: (member: Omit<TeamMember, 'id'>) => void
  updateTeamMember: (id: string, patch: Partial<TeamMember>) => void
  deleteTeamMember: (id: string) => void
  addRisk: (risk: Omit<Risk, 'id'>) => void
  updateRisk: (id: string, patch: Partial<Risk>) => void
  deleteRisk: (id: string) => void
  addAiFinding: (finding: AiFinding) => void
  updateAiFinding: (id: string, patch: Partial<AiFinding>) => void
  deleteAiFinding: (id: string) => void
  addMeeting: (meeting: Omit<Meeting, 'id'>) => void
  updateMeeting: (id: string, patch: Partial<Meeting>) => void
  deleteMeeting: (id: string) => void
  addDocument: (doc: Omit<DocumentItem, 'id'>) => void
  updateDocument: (id: string, patch: Partial<DocumentItem>) => void
  deleteDocument: (id: string) => void
  logActivity: (message: string, project: string, type: Activity['type']) => void
  resetData: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

const STORAGE_KEY = 'nexora-data-v5'

function migrateTask(task: any): Task {
  const now = new Date().toISOString()
  const legacyComments = Array.isArray(task.comments) ? task.comments : []
  const hasStringComments = legacyComments.length > 0 && legacyComments.every((c: any) => typeof c === 'string')
  const taskComments: TaskComment[] = hasStringComments
    ? legacyComments.map((text: string) => ({ id: uid(), text, author: task.assignee || 'System', createdAt: now, updatedAt: now, isSystem: false }))
    : Array.isArray(task.taskComments)
      ? task.taskComments
      : []
  return {
    ...task,
    description: task.description ?? '',
    start: task.start ?? '',
    nextFollowUp: task.nextFollowUp ?? '',
    acceptanceCriteria: task.acceptanceCriteria ?? '',
    labels: Array.isArray(task.labels) ? task.labels : [],
    taskComments,
    activity: Array.isArray(task.activity) ? task.activity : [],
    dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
  }
}

function load(): AppData {
  const base = typeof window === 'undefined' ? seed : (window.localStorage.getItem(STORAGE_KEY) ? (JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as any) : seed)
  try {
    const raw = base
    return {
      ...raw,
      risks: ((raw.risks || []) as any[]).map(migrateLegacyRisk),
      tasks: ((raw.tasks || []) as any[]).map(migrateTask),
      aiFindings: (raw.aiFindings || []) as AiFinding[],
    } as AppData
  } catch {
    return { ...seed, risks: (seed.risks || []).map(migrateLegacyRisk), tasks: (seed.tasks || []).map(migrateTask), aiFindings: [] } as AppData
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  const value = useMemo<AppContextValue>(() => {
    const patch = <K extends keyof AppData>(key: K, updater: (items: AppData[K]) => AppData[K]) => {
      setData((current) => ({ ...current, [key]: updater(current[key]) }))
    }

    const logActivity = (message: string, project: string, type: Activity['type']) => {
      patch('activity', (items) => [
        { id: uid(), message, project, time: 'Just now', type },
        ...(items as Activity[]),
      ].slice(0, 40) as Activity[])
    }

    return {
      ...data,
      addProject: (project) => {
        const id = uid()
        patch('projects', (items) => [...(items as Project[]), { ...project, id }])
        logActivity(`Project created: ${project.name}`, project.name, 'project')
      },
      updateProject: (id, p) => {
        patch('projects', (items) => (items as Project[]).map((item) => (item.id === id ? { ...item, ...p } : item)))
        if (p.name || p.status || p.progress || p.health) {
          const project = data.projects.find((item) => item.id === id)
          logActivity(`Project updated: ${project?.name ?? id}`, project?.name ?? '', 'project')
        }
      },
      deleteProject: (id) => {
        const project = data.projects.find((item) => item.id === id)
        patch('projects', (items) => (items as Project[]).filter((item) => item.id !== id))
        if (project) logActivity(`Project archived: ${project.name}`, project.name, 'project')
      },
      addTask: (task) => {
        const id = uid()
        const now = new Date().toISOString()
        const normalized: Task = {
          ...task,
          id,
          description: task.description ?? '',
          start: task.start ?? '',
          nextFollowUp: task.nextFollowUp ?? '',
          acceptanceCriteria: task.acceptanceCriteria ?? '',
          labels: Array.isArray(task.labels) ? task.labels : [],
          taskComments: Array.isArray(task.taskComments) ? task.taskComments : [],
          activity: Array.isArray(task.activity) && task.activity.length > 0
            ? task.activity
            : [{ id: uid(), type: 'create', message: 'Task created', author: task.assignee || 'System', createdAt: now }],
          dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
        }
        patch('tasks', (items) => [...(items as Task[]), normalized])
        logActivity(`Task created: ${task.title}`, data.projects.find((p) => p.id === task.projectId)?.name ?? '', 'task')
        return id
      },
      updateTask: (id, p) => {
        patch('tasks', (items) =>
          (items as Task[]).map((item) => {
            if (item.id !== id) return item
            const now = new Date().toISOString()
            const baseActivity = Array.isArray(p.activity) ? p.activity : (item.activity || [])
            const activity: TaskActivityEvent[] = [...baseActivity]
            if (p.status && p.status !== item.status) activity.unshift({ id: uid(), type: 'status', message: `Status changed from ${item.status} to ${p.status}`, author: 'System', createdAt: now })
            if (p.priority && p.priority !== item.priority) activity.unshift({ id: uid(), type: 'priority', message: `Priority changed from ${item.priority} to ${p.priority}`, author: 'System', createdAt: now })
            if (p.assignee && p.assignee !== item.assignee) activity.unshift({ id: uid(), type: 'assignee', message: `Assignee changed from ${item.assignee} to ${p.assignee}`, author: 'System', createdAt: now })
            if (p.due && p.due !== item.due) activity.unshift({ id: uid(), type: 'due', message: `Due date changed to ${p.due}`, author: 'System', createdAt: now })
            if (p.start && p.start !== item.start) activity.unshift({ id: uid(), type: 'start', message: `Start date changed to ${p.start}`, author: 'System', createdAt: now })
            if (p.nextFollowUp !== undefined && p.nextFollowUp !== item.nextFollowUp) activity.unshift({ id: uid(), type: 'follow-up', message: p.nextFollowUp ? `Next follow-up date set to ${p.nextFollowUp}` : 'Next follow-up date cleared', author: 'System', createdAt: now })
            return { ...item, ...p, activity }
          }),
        )
        const task = data.tasks.find((item) => item.id === id)
        if (task && (p.status || p.priority || p.assignee || p.due || p.start || p.nextFollowUp !== undefined)) {
          logActivity(`Task updated: ${task.title}`, data.projects.find((proj) => proj.id === task.projectId)?.name ?? '', 'task')
        }
      },
      deleteTask: (id) => {
        const task = data.tasks.find((item) => item.id === id)
        patch('tasks', (items) => (items as Task[]).filter((item) => item.id !== id))
        if (task) logActivity(`Task deleted: ${task.title}`, data.projects.find((proj) => proj.id === task.projectId)?.name ?? '', 'task')
      },
      addClient: (client) => {
        const id = uid()
        patch('clients', (items) => [...(items as Client[]), { ...client, id }])
        logActivity(`Client added: ${client.name}`, client.name, 'project')
      },
      updateClient: (id, p) => patch('clients', (items) => (items as Client[]).map((item) => (item.id === id ? { ...item, ...p } : item))),
      deleteClient: (id) => patch('clients', (items) => (items as Client[]).filter((item) => item.id !== id)),
      addTeamMember: (member) => {
        const id = uid()
        patch('team', (items) => [...(items as TeamMember[]), { ...member, id }])
        logActivity(`Team member added: ${member.name}`, '', 'project')
      },
      updateTeamMember: (id, p) => patch('team', (items) => (items as TeamMember[]).map((item) => (item.id === id ? { ...item, ...p } : item))),
      deleteTeamMember: (id) => patch('team', (items) => (items as TeamMember[]).filter((item) => item.id !== id)),
      addRisk: (risk) => {
        const id = uid()
        patch('risks', (items) => [...(items as Risk[]), normalizeRisk({ ...risk, id })])
        logActivity(`RAID item created: ${risk.title ?? risk.description}`, data.projects.find((p) => p.id === risk.projectId)?.name ?? '', 'risk')
      },
      updateRisk: (id, p) =>
        patch('risks', (items) =>
          (items as Risk[]).map((item) =>
            item.id === id ? { ...item, ...p, updatedAt: new Date().toISOString() } : item,
          ),
        ),
      deleteRisk: (id) => patch('risks', (items) => (items as Risk[]).filter((item) => item.id !== id)),
      addAiFinding: (finding) => {
        patch('aiFindings', (items) => [...(items as AiFinding[]), finding])
      },
      updateAiFinding: (id, p) => patch('aiFindings', (items) => (items as AiFinding[]).map((item) => (item.id === id ? { ...item, ...p } : item))),
      deleteAiFinding: (id) => patch('aiFindings', (items) => (items as AiFinding[]).filter((item) => item.id !== id)),
      addMeeting: (meeting) => {
        const id = uid()
        const now = new Date().toISOString()
        const created: Meeting = {
          ...meeting,
          id,
          history: [...(meeting.history ?? []), { id: uid(), message: 'Meeting created', at: now }],
          convertedActionItemLines: meeting.convertedActionItemLines ?? [],
          linkedTaskIds: meeting.linkedTaskIds ?? {},
        }
        patch('meetings', (items) => [...(items as Meeting[]), created])
        logActivity(`Meeting scheduled: ${meeting.title}`, data.projects.find((p) => p.id === meeting.projectId)?.name ?? '', 'meeting')
      },
      updateMeeting: (id, p) => {
        const existing = data.meetings.find((meeting) => meeting.id === id)
        if (!existing) return
        const changes: string[] = []
        if (p.date && p.date !== existing.date) changes.push('Meeting date changed')
        if (p.startTime && p.startTime !== existing.startTime) changes.push('Meeting start time changed')
        if (p.endTime && p.endTime !== existing.endTime) changes.push('Meeting end time changed')
        if (p.title && p.title !== existing.title) changes.push('Meeting title updated')
        if (p.participants !== undefined && p.participants !== existing.participants) changes.push('Meeting participants updated')
        if (p.attendeeEmails && JSON.stringify(p.attendeeEmails) !== JSON.stringify(existing.attendeeEmails ?? [])) changes.push('Meeting invitees updated')
        if (p.agenda !== undefined && p.agenda !== existing.agenda) changes.push('Meeting agenda updated')
        if (p.decisions !== undefined && p.decisions !== existing.decisions) changes.push('Meeting decisions updated')
        if (p.actionItems !== undefined && p.actionItems !== existing.actionItems) changes.push('Meeting action items updated')
        if (p.convertedActionItemLines && p.convertedActionItemLines.length > (existing.convertedActionItemLines?.length ?? 0)) changes.push('Meeting action item converted to task')
        if (p.status && p.status !== existing.status) changes.push(`Meeting ${p.status.toLowerCase()}`)
        const now = new Date().toISOString()
        patch('meetings', (items) => (items as Meeting[]).map((item) =>
          item.id === id
            ? { ...item, ...p, history: [...(item.history ?? []), ...changes.map((message) => ({ id: uid(), message, at: now }))] }
            : item,
        ))
        if (changes.length) logActivity(`Meeting updated: ${existing.title}`, data.projects.find((proj) => proj.id === existing.projectId)?.name ?? '', 'meeting')
      },
      deleteMeeting: (id) => {
        const meeting = data.meetings.find((item) => item.id === id)
        patch('meetings', (items) => (items as Meeting[]).filter((item) => item.id !== id))
        if (meeting) logActivity(`Meeting deleted: ${meeting.title}`, data.projects.find((p) => p.id === meeting.projectId)?.name ?? '', 'meeting')
      },
      addDocument: (doc) => {
        const id = uid()
        patch('documents', (items) => [...(items as DocumentItem[]), { ...doc, id }])
        logActivity(`Document added: ${doc.name}`, data.projects.find((p) => p.id === doc.projectId)?.name ?? '', 'project')
      },
      updateDocument: (id, p) => patch('documents', (items) => (items as DocumentItem[]).map((item) => (item.id === id ? { ...item, ...p } : item))),
      deleteDocument: (id) => patch('documents', (items) => (items as DocumentItem[]).filter((item) => item.id !== id)),
      logActivity,
      resetData: () =>
        setData({
          ...seed,
          risks: (seed.risks || []).map(migrateLegacyRisk),
          tasks: (seed.tasks || []).map(migrateTask),
          aiFindings: [],
        } as AppData),
    }
  }, [data])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
