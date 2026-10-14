import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  seedSprintData,
  type SprintData,
  type Sprint,
  type BacklogItem,
  type TimeLog,
  type Blocker,
  type ScopeChange,
  type Retrospective,
  type RetrospectiveAction,
  type Notification,
} from './sprints'

const STORAGE_KEY = 'nexora-sprints-v2'
const uid = () => Math.random().toString(36).slice(2, 9)

interface SprintContextValue extends SprintData {
  activeSprintId: string | null
  setActiveSprintId: (id: string) => void
  addSprint: (sprint: Omit<Sprint, 'id' | 'number' | 'createdAt'>) => void
  updateSprint: (id: string, patch: Partial<Sprint>) => void
  deleteSprint: (id: string) => void
  startSprint: (id: string) => void
  completeSprint: (id: string) => void
  cancelSprint: (id: string) => void
  addBacklogItem: (item: Omit<BacklogItem, 'id' | 'createdAt' | 'sprintOrder' | 'status' | 'sprintId'>) => void
  updateBacklogItem: (id: string, patch: Partial<BacklogItem>, changedBy?: string) => void
  deleteBacklogItem: (id: string) => void
  moveToSprint: (itemId: string, sprintId: string, changedBy?: string) => void
  removeFromSprint: (itemId: string, changedBy?: string) => void
  updateItemStatus: (itemId: string, status: BacklogItem['status']) => void
  logTime: (log: Omit<TimeLog, 'id'>) => void
  deleteTimeLog: (id: string) => void
  addBlocker: (blocker: Omit<Blocker, 'id' | 'createdAt'>) => void
  resolveBlocker: (id: string, actualResolution: string) => void
  addScopeChange: (change: Omit<ScopeChange, 'id' | 'changedAt'>) => void
  saveRetrospective: (retro: Retrospective) => void
  addAction: (sprintId: string, action: Omit<RetrospectiveAction, 'id'>) => void
  updateAction: (sprintId: string, actionId: string, patch: Partial<RetrospectiveAction>) => void
  addNotification: (n: Omit<Notification, 'id' | 'createdAt'>) => void
  markNotificationRead: (id: string) => void
  dismissNotification: (id: string) => void
  resetSprints: () => void
}

const SprintContext = createContext<SprintContextValue | null>(null)

function load(): SprintData {
  if (typeof window === 'undefined') return seedSprintData
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) return seedSprintData
  try {
    return { ...seedSprintData, ...JSON.parse(stored) } as SprintData
  } catch {
    return seedSprintData
  }
}

function nextSprintNumber(sprints: Sprint[]) {
  return sprints.length ? Math.max(...sprints.map((s) => s.number)) + 1 : 1
}

export function SprintProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SprintData>(load)
  const [activeSprintId, setActiveSprintId] = useState<string | null>(
    () => data.sprints.find((s) => s.status === 'Active')?.id ?? data.sprints[0]?.id ?? null,
  )

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  const patch = <K extends keyof SprintData>(key: K, updater: (items: SprintData[K]) => SprintData[K]) => {
    setData((current) => ({ ...current, [key]: updater(current[key]) }))
  }

  const value = useMemo<SprintContextValue>(() => {
    const recordScope = (change: Omit<ScopeChange, 'id' | 'changedAt' | 'changedBy'>, changedBy?: string) => {
      patch('scopeChanges', (items) => [
        ...(items as ScopeChange[]),
        { ...change, id: uid(), changedAt: new Date().toISOString().slice(0, 10), changedBy: changedBy ?? 'System' },
      ])
    }

    return {
      ...data,
      activeSprintId,
      setActiveSprintId,
      addSprint: (sprint) => {
        const id = uid()
        patch('sprints', (items) => [
          ...(items as Sprint[]),
          { ...sprint, id, number: nextSprintNumber(items as Sprint[]), createdAt: new Date().toISOString().slice(0, 10) },
        ])
        setActiveSprintId(id)
      },
      updateSprint: (id, p) =>
        patch('sprints', (items) =>
          (items as Sprint[]).map((item) => (item.id === id ? { ...item, ...p } : item)),
        ),
      deleteSprint: (id) =>
        patch('sprints', (items) => (items as Sprint[]).filter((item) => item.id !== id)),
      startSprint: (id) => {
        patch('sprints', (items) =>
          (items as Sprint[]).map((item) =>
            item.id === id ? { ...item, status: 'Active' as const } : { ...item, status: item.status === 'Active' ? 'Planned' : item.status },
          ),
        )
      },
      completeSprint: (id) => {
        const sprint = data.sprints.find((s) => s.id === id)
        patch('sprints', (items) =>
          (items as Sprint[]).map((item) =>
            item.id === id
              ? { ...item, status: 'Completed' as const, completedAt: new Date().toISOString().slice(0, 10), originalItemIds: item.originalItemIds.length ? item.originalItemIds : data.backlog.filter((b) => b.sprintId === id).map((b) => b.id) }
              : item,
          ),
        )
        if (sprint) {
          recordScope({ sprintId: id, type: 'Added' }, 'Sprint Close')
          patch('notifications', (items) => [
            ...(items as Notification[]),
            {
              id: uid(),
              message: `Sprint ${sprint.number} marked complete.`,
              type: 'completion',
              read: false,
              createdAt: new Date().toISOString().slice(0, 10),
              recipient: 'PM',
            },
          ])
        }
      },
      cancelSprint: (id) =>
        patch('sprints', (items) =>
          (items as Sprint[]).map((item) =>
            item.id === id ? { ...item, status: 'Cancelled' as const } : item,
          ),
        ),
      addBacklogItem: (item) => {
        const id = uid()
        patch('backlog', (items) => [
          ...(items as BacklogItem[]),
          {
            ...item,
            id,
            createdAt: new Date().toISOString().slice(0, 10),
            sprintOrder: (items as BacklogItem[]).length,
            status: 'Backlog' as const,
            sprintId: undefined,
          },
        ])
      },
      updateBacklogItem: (id, p, changedBy) => {
        const current = data.backlog.find((b) => b.id === id)
        patch('backlog', (items) =>
          (items as BacklogItem[]).map((item) => (item.id === id ? { ...item, ...p } : item)),
        )
        if (current && current.sprintId) {
          if (p.estimatedHours !== undefined && p.estimatedHours !== current.estimatedHours) {
            recordScope({ sprintId: current.sprintId, backlogItemId: id, type: 'Re-estimated', oldValue: String(current.estimatedHours), newValue: String(p.estimatedHours) }, changedBy)
          }
          if (p.priority !== undefined && p.priority !== current.priority) {
            recordScope({ sprintId: current.sprintId, backlogItemId: id, type: 'Priority', oldValue: current.priority, newValue: p.priority }, changedBy)
          }
          if (p.assignee !== undefined && p.assignee !== current.assignee) {
            recordScope({ sprintId: current.sprintId, backlogItemId: id, type: 'Assignee', oldValue: current.assignee ?? 'Unassigned', newValue: p.assignee ?? 'Unassigned' }, changedBy)
          }
          if (p.storyPoints !== undefined && p.storyPoints !== current.storyPoints) {
            recordScope({ sprintId: current.sprintId, backlogItemId: id, type: 'StoryPoints', oldValue: String(current.storyPoints), newValue: String(p.storyPoints) }, changedBy)
          }
          if (p.due !== undefined && p.due !== current.due) {
            recordScope({ sprintId: current.sprintId, backlogItemId: id, type: 'Deadline', oldValue: current.due ?? '', newValue: p.due ?? '' }, changedBy)
          }
        }
      },
      deleteBacklogItem: (id) =>
        patch('backlog', (items) => (items as BacklogItem[]).filter((item) => item.id !== id)),
      moveToSprint: (itemId, sprintId, changedBy) => {
        const current = data.backlog.find((b) => b.id === itemId)
        const count = data.backlog.filter((b) => b.sprintId === sprintId).length
        patch('backlog', (items) =>
          (items as BacklogItem[]).map((item) =>
            item.id === itemId
              ? { ...item, sprintId, sprintOrder: count, status: item.status === 'Backlog' ? 'To Do' : item.status }
              : item,
          ),
        )
        if (current) {
          recordScope({ sprintId, backlogItemId: itemId, type: 'Added' }, changedBy)
        }
      },
      removeFromSprint: (itemId, changedBy) => {
        const current = data.backlog.find((b) => b.id === itemId)
        patch('backlog', (items) =>
          (items as BacklogItem[]).map((item) =>
            item.id === itemId
              ? { ...item, sprintId: undefined, sprintOrder: (items as BacklogItem[]).filter((b) => !b.sprintId).length, status: 'Backlog' as const }
              : item,
          ),
        )
        if (current && current.sprintId) {
          recordScope({ sprintId: current.sprintId, backlogItemId: itemId, type: 'Removed' }, changedBy)
        }
      },
      updateItemStatus: (itemId, status) => {
        const current = data.backlog.find((b) => b.id === itemId)
        const now = new Date().toISOString().slice(0, 10)
        const ts: Partial<BacklogItem> = { status }
        if (status === 'In Progress' && !current?.startedAt) ts.startedAt = now
        if (status === 'In Review') ts.reviewAt = now
        if (status === 'QA') ts.qaAt = now
        if (status === 'Done') {
          ts.completedAt = now
          if (!current?.startedAt) ts.startedAt = now
        }
        patch('backlog', (items) =>
          (items as BacklogItem[]).map((item) =>
            item.id === itemId ? { ...item, ...ts } : item,
          ),
        )
      },
      logTime: (log) =>
        patch('timeLogs', (items) => [...(items as TimeLog[]), { ...log, id: uid() }]),
      deleteTimeLog: (id) =>
        patch('timeLogs', (items) => (items as TimeLog[]).filter((item) => item.id !== id)),
      addBlocker: (blocker) =>
        patch('blockers', (items) => [
          ...(items as Blocker[]),
          { ...blocker, id: uid(), createdAt: new Date().toISOString().slice(0, 10) },
        ]),
      resolveBlocker: (id, actualResolution) =>
        patch('blockers', (items) =>
          (items as Blocker[]).map((item) =>
            item.id === id
              ? { ...item, status: 'Resolved' as const, actualResolution }
              : item,
          ),
        ),
      addScopeChange: (change) =>
        recordScope(change),
      saveRetrospective: (retro) =>
        patch('retrospectives', (items) => {
          const rest = (items as Retrospective[]).filter((r) => r.sprintId !== retro.sprintId)
          return [...rest, retro]
        }),
      addAction: (sprintId, action) =>
        patch('retrospectives', (items) =>
          (items as Retrospective[]).map((r) =>
            r.sprintId === sprintId
              ? { ...r, actions: [...r.actions, { ...action, id: uid() }] }
              : r,
          ),
        ),
      updateAction: (sprintId, actionId, patchA) =>
        patch('retrospectives', (items) =>
          (items as Retrospective[]).map((r) =>
            r.sprintId === sprintId
              ? {
                  ...r,
                  actions: r.actions.map((a) =>
                    a.id === actionId ? { ...a, ...patchA } : a,
                  ),
                }
              : r,
          ),
        ),
      addNotification: (n) =>
        patch('notifications', (items) => [
          ...(items as Notification[]),
          { ...n, id: uid(), createdAt: new Date().toISOString().slice(0, 10) },
        ]),
      markNotificationRead: (id) =>
        patch('notifications', (items) =>
          (items as Notification[]).map((item) =>
            item.id === id ? { ...item, read: true } : item,
          ),
        ),
      dismissNotification: (id) =>
        patch('notifications', (items) =>
          (items as Notification[]).filter((item) => item.id !== id),
        ),
      resetSprints: () => {
        setData(seedSprintData)
        setActiveSprintId(seedSprintData.sprints[0]?.id ?? null)
      },
    }
  }, [data, activeSprintId])

  return <SprintContext.Provider value={value}>{children}</SprintContext.Provider>
}

export function useSprints() {
  const ctx = useContext(SprintContext)
  if (!ctx) throw new Error('useSprints must be used within SprintProvider')
  return ctx
}
