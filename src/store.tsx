import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { migrateLegacyRisk, normalizeRisk, type AiFinding, type RaidItem } from './lib/raid'
import { buildCommitPayload, buildImportPlan, extractProjectRows, loadXlsx } from './lib/excelImport'

export type ProjectStatus = 'Planning' | 'In Progress' | 'On Hold' | 'Completed' | 'At Risk' | 'Backed Off'
export type Health = 'Green' | 'Amber' | 'Red'

/** The signed-in internal user — pass-through auth has no user store yet. */
export const CURRENT_USER = 'Sandeep Rana'

/** Manual project-level status report — independent of employee tasks. */
export interface StatusUpdate {
  id: string
  projectId: string
  author: string
  createdAt: string // ISO
  status: ProjectStatus
  progress: number // 0-100, manually reported until task-derived progress exists
  workCompleted?: string
  currentWork?: string
  pendingWork?: string
  blockers?: string
  blockerSeverity?: 'none' | 'non-critical' | 'critical'
  clientUpdate?: string
  risksDependencies?: string
  nextSteps?: string
  expectedCompletion?: string // YYYY-MM-DD — revises project.end when provided
  internalRemarks?: string // internal-only
  source: 'manual' | 'imported-comment'
  editHistory?: { editedAt: string; editedBy: string; changes: string }[]
}
export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent'
export type TaskStatus = 'To Do' | 'In Progress' | 'Review' | 'Blocked' | 'Completed'

export interface ImportMeta {
  batchId: string
  sourceFile: string
  sourceSheet: string
  sourceRow: number
  sourceStatus?: string
  projectClass?: string
}

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
  /** Migrated financials — raw source strings preserved verbatim ('NA' stays 'NA', never zeroed) */
  invoiceValue?: string
  collectedAmount?: string
  amountPending?: string
  paymentFrequency?: string
  importMeta?: ImportMeta
  /** Manager-set health override with an audit reason; auto-health applies when absent */
  healthOverride?: { health: Health; reason: string; author: string; at: string }
  /** Denormalized reporting stamp — set when a status update is saved */
  lastReportAt?: string
  lastReportBy?: string
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
  importMeta?: ImportMeta
}

/** Auditable record of one Excel import commit — enables rollback + reconciliation. */
export interface ImportBatch {
  id: string
  fileName: string
  sheetName: string
  headerRow: number
  importedAt: string
  totalRows: number
  importedProjects: number
  importedClients: number
  duplicates: number
  errors: number
  warnings: string[]
  rolledBack?: boolean
  sourceSnapshot: { rowNumber: number; cells: Record<string, string> }[]
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
  /** ISO timestamp for sortable feeds; `time` remains the display string */
  at?: string
  /** Link target so feed items can open the project */
  projectId?: string
  author?: string
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
  importBatches: ImportBatch[]
  statusUpdates: StatusUpdate[]
}

const uid = () => Math.random().toString(36).slice(2, 9)

const seed = {
  projects: [],
  tasks: [],
  clients: [],
  team: [],
  risks: [],
  meetings: [],
  documents: [],
  activity: [],
  aiFindings: [],
  importBatches: [],
  statusUpdates: [],
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
  applyImport: (payload: { clients: Omit<Client, 'id'>[]; projects: Omit<Project, 'id'>[]; batch: Omit<ImportBatch, 'id' | 'importedAt'> }) => ImportBatch
  rollbackImport: (batchId: string) => void
  addStatusUpdate: (update: Omit<StatusUpdate, 'id' | 'createdAt'>) => StatusUpdate | null
  editStatusUpdate: (id: string, patch: Partial<StatusUpdate>, editedBy: string) => void
  setHealthOverride: (projectId: string, override: Project['healthOverride']) => void
  resetData: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

const STORAGE_KEY = 'nexora-data-v6'

function migrateTask(task: any): Task {
  const now = new Date().toISOString()
  const legacyComments = Array.isArray(task.comments) ? task.comments : []
  const hasStringComments = legacyComments.length > 0 && legacyComments.every((c: any) => typeof c === 'string')
  const taskComments: TaskComment[] = hasStringComments
    ? legacyComments.map((text: string) => ({ id: uid(), text, author: task.assignee || 'System', createdAt: now, updatedAt: now, isSystem: false }))
    : Array.isArray(task.taskComments)
      ? task.taskComments
      : legacyComments
          .filter((c: any) => typeof c === 'string')
          .map((text: string) => ({ id: uid(), text, author: task.assignee || 'System', createdAt: now, updatedAt: now, isSystem: false }))
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

/** Whether the workspace was empty when the app booted (no snapshot, a corrupt
 *  one, or a stored seed with zero projects) — the restore effect uses this so
 *  an empty seed snapshot can never block recovery. */
let bootWasEmpty = true

function load(): AppData {
  try {
    const stored = typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY)
    // Safety snapshot — a recovery copy of whatever is in storage before the app
    // writes back. Kept in a separate key so a bad parse or partial write can
    // never silently destroy the user's data.
    if (stored && typeof window !== 'undefined' && !window.localStorage.getItem(`${STORAGE_KEY}-backup`)) {
      try { window.localStorage.setItem(`${STORAGE_KEY}-backup`, stored) } catch { /* quota */ }
    }
    const raw = stored ? (JSON.parse(stored) as any) : seed
    // Set only after a successful parse — corrupt JSON stays "empty" so restore can run
    bootWasEmpty = (raw.projects?.length ?? 0) === 0
    return {
      ...raw,
      risks: ((raw.risks || []) as any[]).map(migrateLegacyRisk),
      tasks: ((raw.tasks || []) as any[]).map(migrateTask),
      aiFindings: (raw.aiFindings || []) as AiFinding[],
      importBatches: (raw.importBatches || []) as ImportBatch[],
      statusUpdates: (raw.statusUpdates || []) as StatusUpdate[],
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

    const logActivity = (message: string, project: string, type: Activity['type'], extra?: { projectId?: string; author?: string }) => {
      patch('activity', (items) => [
        { id: uid(), message, project, time: 'Just now', type, at: new Date().toISOString(), ...extra },
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
        const project = data.projects.find((item) => item.id === id)
        patch('projects', (items) => (items as Project[]).map((item) => (item.id === id ? { ...item, ...p } : item)))
        // Renaming a project must not orphan team memberships or meeting links
        // keyed by the project name.
        if (p.name && project && p.name !== project.name) {
          patch('team', (items) =>
            (items as TeamMember[]).map((m) =>
              (m.projects ?? []).includes(project.name)
                ? { ...m, projects: m.projects.map((n) => (n === project.name ? p.name! : n)) }
                : m,
            ),
          )
          patch('meetings', (items) =>
            (items as Meeting[]).map((m) =>
              m.projectId === id ? { ...m, projectName: p.name } : m,
            ),
          )
        }
        if (p.name || p.status || p.progress || p.health) {
          logActivity(`Project updated: ${project?.name ?? id}`, p.name ?? project?.name ?? '', 'project')
        }
      },
      deleteProject: (id) => {
        const project = data.projects.find((item) => item.id === id)
        patch('projects', (items) => (items as Project[]).filter((item) => item.id !== id))
        // Cascade: remove the project's tasks/documents and detach meetings,
        // so nothing links to a deleted project.
        patch('tasks', (items) => (items as Task[]).filter((t) => t.projectId !== id))
        patch('documents', (items) => (items as DocumentItem[]).filter((d) => d.projectId !== id))
        patch('meetings', (items) =>
          (items as Meeting[]).map((m) => (m.projectId === id ? { ...m, projectId: undefined, projectName: undefined } : m)),
        )
        patch('team', (items) =>
          (items as TeamMember[]).map((m) =>
            project && (m.projects ?? []).includes(project.name)
              ? { ...m, projects: m.projects.filter((n) => n !== project.name) }
              : m,
          ),
        )
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
      applyImport: (payload) => {
        // Single atomic commit — clients, projects and the batch record are
        // written together so a partial import can never land.
        const batchId = `imp-${uid()}`
        const batch: ImportBatch = { ...payload.batch, id: batchId, importedAt: new Date().toISOString() }
        const newClients = payload.clients.map((c) => ({
          ...c,
          id: uid(),
          importMeta: c.importMeta ? { ...c.importMeta, batchId } : c.importMeta,
        }))
        const newProjects = payload.projects.map((p) => ({
          ...p,
          id: uid(),
          importMeta: p.importMeta ? { ...p.importMeta, batchId } : p.importMeta,
        }))
        setData((current) => ({
          ...current,
          clients: [...current.clients, ...newClients],
          projects: [...current.projects, ...newProjects],
          importBatches: [...(current.importBatches ?? []), batch],
          activity: [
            { id: uid(), message: `Imported ${newProjects.length} projects from ${batch.fileName}`, project: '', time: 'Just now', type: 'project' as const, at: batch.importedAt },
            ...current.activity,
          ].slice(0, 40),
        }))
        return batch
      },
      rollbackImport: (batchId) =>
        setData((current) => {
          const removedIds = new Set(
            current.projects.filter((p) => p.importMeta?.batchId === batchId).map((p) => p.id),
          )
          const removedNames = new Set(
            current.projects.filter((p) => p.importMeta?.batchId === batchId).map((p) => p.name),
          )
          return {
            ...current,
            projects: current.projects.filter((p) => p.importMeta?.batchId !== batchId),
            clients: current.clients.filter((c) => c.importMeta?.batchId !== batchId),
            // Mirror deleteProject's cascade for anything linked to removed projects
            tasks: current.tasks.filter((t) => !removedIds.has(t.projectId)),
            documents: current.documents.filter((d) => !removedIds.has(d.projectId ?? '')),
            meetings: current.meetings.map((m) =>
              removedIds.has(m.projectId ?? '') ? { ...m, projectId: undefined, projectName: undefined } : m,
            ),
            team: current.team.map((m) =>
              (m.projects ?? []).some((n) => removedNames.has(n))
                ? { ...m, projects: m.projects.filter((n) => !removedNames.has(n)) }
                : m,
            ),
            importBatches: (current.importBatches ?? []).map((b) => (b.id === batchId ? { ...b, rolledBack: true } : b)),
            activity: [
              { id: uid(), message: `Rolled back import ${batchId}`, project: '', time: 'Just now', type: 'project' as const, at: new Date().toISOString() },
              ...current.activity,
            ].slice(0, 40),
          }
        }),
      addStatusUpdate: (input) => {
        const project = data.projects.find((p) => p.id === input.projectId)
        if (!project) return null

        // Idempotency: an identical update saved moments later is a double-submit
        const latest = data.statusUpdates
          .filter((u) => u.projectId === input.projectId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
        const samePayload =
          latest &&
          latest.status === input.status &&
          latest.progress === input.progress &&
          ['workCompleted', 'currentWork', 'pendingWork', 'blockers', 'clientUpdate', 'risksDependencies', 'nextSteps', 'expectedCompletion', 'internalRemarks']
            .every((k) => (latest as any)[k] === (input as any)[k])
        if (samePayload && Date.now() - new Date(latest.createdAt).getTime() < 2 * 60 * 1000) {
          return latest
        }

        const update: StatusUpdate = { ...input, id: uid(), createdAt: new Date().toISOString() }
        const deadlineChanged = input.expectedCompletion && input.expectedCompletion !== project.end
        const prevProgress = project.progress

        // Single atomic commit — report, project sync, and activity entry land together
        setData((current) => {
          const projectNow = current.projects.find((p) => p.id === input.projectId)
          const messages = [
            { id: uid(), message: `Status report: ${project.name} → ${input.status}, ${input.progress}%`, project: project.name, time: 'Just now', type: 'status' as const, at: update.createdAt, projectId: project.id, author: input.author },
          ]
          if (input.progress !== prevProgress) {
            messages.push({ id: uid(), message: `Progress changed: ${project.name} ${prevProgress}% → ${input.progress}%`, project: project.name, time: 'Just now', type: 'status' as const, at: update.createdAt, projectId: project.id, author: input.author })
          }
          if (input.blockers?.trim()) {
            messages.push({ id: uid(), message: `Blocker reported: ${project.name} — ${input.blockers.trim().slice(0, 80)}`, project: project.name, time: 'Just now', type: 'status' as const, at: update.createdAt, projectId: project.id, author: input.author })
          }
          if (deadlineChanged) {
            messages.push({ id: uid(), message: `Deadline revised: ${project.name} ${projectNow?.end || '—'} → ${input.expectedCompletion}`, project: project.name, time: 'Just now', type: 'status' as const, at: update.createdAt, projectId: project.id, author: input.author })
          }
          return {
            ...current,
            statusUpdates: [update, ...current.statusUpdates],
            projects: current.projects.map((p) =>
              p.id === input.projectId
                ? {
                    ...p,
                    status: input.status,
                    progress: Math.min(100, Math.max(0, input.progress)),
                    ...(deadlineChanged ? { end: input.expectedCompletion } : {}),
                    lastReportAt: update.createdAt,
                    lastReportBy: input.author,
                  }
                : p,
            ),
            activity: [...messages, ...current.activity].slice(0, 40),
          }
        })
        return update
      },
      editStatusUpdate: (id, p, editedBy) => {
        const existing = data.statusUpdates.find((u) => u.id === id)
        if (!existing) return
        const changed = (Object.keys(p) as (keyof StatusUpdate)[]).filter(
          (k) => p[k] !== undefined && JSON.stringify(p[k]) !== JSON.stringify(existing[k]),
        )
        if (!changed.length) return
        const entry = {
          editedAt: new Date().toISOString(),
          editedBy,
          changes: `Edited: ${changed.join(', ')}`,
        }
        patch('statusUpdates', (items) =>
          (items as StatusUpdate[]).map((u) =>
            u.id === id ? { ...u, ...p, editHistory: [...(u.editHistory ?? []), entry] } : u,
          ),
        )
        // If the edited report is still the project's latest, re-sync the project summary
        const isLatest = !data.statusUpdates.some(
          (u) => u.projectId === existing.projectId && u.id !== id && u.createdAt > existing.createdAt,
        )
        if (isLatest) {
          const merged = { ...existing, ...p }
          patch('projects', (items) =>
            (items as Project[]).map((proj) =>
              proj.id === existing.projectId
                ? {
                    ...proj,
                    status: merged.status,
                    progress: Math.min(100, Math.max(0, merged.progress)),
                    ...(merged.expectedCompletion ? { end: merged.expectedCompletion } : {}),
                  }
                : proj,
            ),
          )
        }
      },
      setHealthOverride: (projectId, override) => {
        const project = data.projects.find((p) => p.id === projectId)
        if (!project) return
        patch('projects', (items) =>
          (items as Project[]).map((p) => (p.id === projectId ? { ...p, healthOverride: override ?? undefined } : p)),
        )
        if (override) {
          logActivity(`Health set to ${override.health}: ${project.name} — ${override.reason}`, project.name, 'status', { projectId, author: override.author })
        }
      },
      resetData: () =>
        setData({
          ...seed,
          risks: (seed.risks || []).map(migrateLegacyRisk),
          tasks: (seed.tasks || []).map(migrateTask),
          aiFindings: [],
        } as AppData),
    }
  }, [data])

  // One-time restore: if storage was cleared (empty workspace, no stored
  // snapshot), pull the bundled Excel backup from /public and replay the
  // import pipeline. A flag prevents re-importing after an intentional reset.
  useEffect(() => {
    const FLAG = 'nexora-restore-v1'
    if (!bootWasEmpty || window.localStorage.getItem(FLAG)) return
    window.localStorage.setItem(FLAG, 'pending')
    fetch('/Project_Report.xlsx')
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('backup file missing'))))
      .then(async (buf) => {
        const XLSX = await loadXlsx()
        const wb = XLSX.read(buf, { type: 'array', cellDates: false })
        const sheet = wb.SheetNames.find((n: string) => n.trim().toLowerCase() === 'new projects_july')
        if (!sheet) throw new Error('sheet missing')
        const rows2D = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '' }) as unknown[][]
        const extracted = extractProjectRows(rows2D)
        if (!extracted || extracted.rows.length === 0) throw new Error('no rows')
        const fileName = 'Project_Report.xlsx (auto-restore)'
        const plan = buildImportPlan({
          sheetName: sheet,
          headerRow: extracted.headerRow,
          sourceRows: extracted.rows,
          existing: { projects: [], clients: [] },
          fileName,
        })
        const payload = buildCommitPayload(plan, fileName, `rest-${Date.now()}`)
        // Race guard — a manual import that landed while the fetch was
        // in-flight must not be duplicated by the restore.
        try {
          const cur = window.localStorage.getItem(STORAGE_KEY)
          if (cur && (JSON.parse(cur).projects?.length ?? 0) > 0) {
            window.localStorage.setItem(FLAG, 'done')
            return
          }
        } catch { /* fall through to apply */ }
        value.applyImport(payload)
        window.localStorage.setItem(FLAG, 'done')
      })
      .catch(() => {
        window.localStorage.removeItem(FLAG) // allow retry on next load
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
