// @ts-nocheck
import { useEffect, useMemo, useState } from 'react'

// today is computed per-render via todayKey() to avoid stale module-level dates
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  LayoutDashboard,
  List,
  ListTodo,
  Plus,
  Search,
  Target,
  Users,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  type BacklogItem,
  type Sprint,
  getBacklogItems,
  getSprintHealthScore,
  getSprintItems,
  getSprintKPIs,
  getSprintScopeChanges,
} from '../lib/sprints'
import { useSprints } from '../lib/sprintStore'
import { todayKey } from '../lib/dates'
import { useApp, type TeamMember } from '../store'
import { Badge, Button, Card, CardTitle, EmptyState, Field, FormErrorSummary, Modal, TextButton, inputClass, invalidInputClass } from '../components/ui'

type TabKey =
  | 'dashboard'
  | 'planning'
  | 'productBacklog'
  | 'sprintBacklog'
  | 'capacity'
  | 'analytics'
  | 'blockers'
  | 'review'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'planning', label: 'Planning', icon: Target },
  { key: 'productBacklog', label: 'Product Backlog', icon: List },
  { key: 'sprintBacklog', label: 'Sprint Backlog', icon: ListTodo },
  { key: 'capacity', label: 'Capacity', icon: Users },
  { key: 'analytics', label: 'Progress & Analytics', icon: BarChart3 },
  { key: 'blockers', label: 'Blockers', icon: AlertTriangle },
  { key: 'review', label: 'Sprint Review', icon: CheckCircle2 },
]

const taskTone: Record<BacklogItem['status'], 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'dark'> = {
  Backlog: 'neutral',
  'To Do': 'neutral',
  'In Progress': 'blue',
  'In Review': 'amber',
  QA: 'amber',
  Blocked: 'red',
  Done: 'green',
}

function KpiCard({ label, value, sub, tone = 'neutral', onClick }: { label: string; value: string | number; sub?: string; tone?: 'neutral' | 'green' | 'amber' | 'red'; onClick?: () => void }) {
  return (
    <Card onClick={onClick} className={`p-4 ${onClick ? 'cursor-pointer' : ''}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 font-heading text-[22px] font-semibold ${tone === 'red' ? 'text-red' : tone === 'green' ? 'text-green' : tone === 'amber' ? 'text-amber' : 'text-ink'}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </Card>
  )
}

export function Sprints({ embedded = false }: { embedded?: boolean }) {
  const sprints = useSprints()
  const app = useApp()
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [sprintFormOpen, setSprintFormOpen] = useState(false)
  const [backlogFormOpen, setBacklogFormOpen] = useState(false)
  const [blockerFormOpen, setBlockerFormOpen] = useState(false)

  const activeSprint = useMemo(() => sprints.sprints.find((s) => s.id === sprints.activeSprintId) ?? sprints.sprints[0], [sprints])
  const activeItems = useMemo(() => (activeSprint ? getSprintItems(activeSprint.id, sprints) : []), [activeSprint, sprints])
  const kpi = useMemo(() => (activeSprint ? getSprintKPIs(activeSprint, sprints) : null), [activeSprint, sprints])
  const health = useMemo(() => (activeSprint ? getSprintHealthScore(activeSprint, sprints) : null), [activeSprint, sprints])
  const project = useMemo(() => app.projects.find((p) => p.id === activeSprint?.projectId), [activeSprint, app.projects])

  const burndownData = useMemo(
    () => sprints.dailyMetrics.filter((m) => m.sprintId === activeSprint?.id),
    [activeSprint, sprints.dailyMetrics],
  )

  const changeTable = useMemo(
    () => (activeSprint ? getSprintScopeChanges(activeSprint.id, sprints) : []),
    [activeSprint, sprints],
  )

  const sprintMeta = useMemo(() => {
    if (!activeSprint) return null
    const start = new Date(`${activeSprint.start}T00:00:00`)
    const end = new Date(`${activeSprint.end}T00:00:00`)
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
    const elapsedDays = Math.min(totalDays, Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000) + 1))
    const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return {
      totalDays,
      elapsedDays,
      remainingDays: Math.max(0, totalDays - elapsedDays),
      startLabel: fmt(activeSprint.start),
      endLabel: fmt(activeSprint.end),
    }
  }, [activeSprint])

  return (
    <div className={embedded ? 'w-full' : 'mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8'}>
      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-[36px] rounded-lg border border-line bg-white px-3 text-[11px] text-ink outline-none"
            value={activeSprint?.id ?? ''}
            onChange={(e) => sprints.setActiveSprintId(e.target.value)}
          >
            {sprints.sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>
          {activeSprint?.status === 'Planned' && (
            <Button onClick={() => sprints.startSprint(activeSprint.id)}>Start Sprint</Button>
          )}
          {activeSprint?.status === 'Active' && (
            <Button onClick={() => sprints.completeSprint(activeSprint.id)}>Complete Sprint</Button>
          )}
          <Button variant="secondary" onClick={() => setSprintFormOpen(true)}>
            <span className="flex items-center gap-1.5"><Plus size={14} /> New Sprint</span>
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-line pb-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex h-[34px] items-center gap-1.5 rounded-lg px-3 text-[11px] font-medium transition-all ${tab === key ? 'bg-ink text-white' : 'text-muted hover:bg-[#eeeeeb] hover:text-ink'}`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div key={tab} className="page-enter">
      {!activeSprint && tab !== 'planning' && tab !== 'productBacklog' && (
        <EmptyState
          title="No sprints yet"
          description="Create your first sprint to start planning and tracking sprint work."
          action={<Button onClick={() => setSprintFormOpen(true)}><span className="inline-flex items-center gap-1.5"><Plus size={13} />New sprint</span></Button>}
        />
      )}
      {tab === 'dashboard' && activeSprint && kpi && health && (
        <div className="space-y-5">
          {sprintMeta && (
            <Card>
              <CardTitle title="Sprint Details" subtitle={`Sprint ${activeSprint.number} · ${sprintMeta.startLabel} → ${sprintMeta.endLabel}`} />
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: 'Project', value: project?.name ?? '—' },
                  { label: 'Owner', value: activeSprint.owner || '—' },
                  { label: 'Duration', value: `${activeSprint.workingDays} working days · ${activeSprint.hoursPerDay}h/day` },
                  { label: 'Team', value: `${activeSprint.members.length} member${activeSprint.members.length === 1 ? '' : 's'}` },
                  { label: 'Velocity', value: `${kpi.velocity} pts` },
                  { label: 'Timeline', value: `Day ${sprintMeta.elapsedDays} of ${sprintMeta.totalDays}` },
                ].map((d) => (
                  <div key={d.label} className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">{d.label}</p>
                    <p className="mt-1 truncate text-[12px] font-semibold text-ink" title={d.value}>{d.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[10px] text-muted">
                  <span>Elapsed</span>
                  <span>{sprintMeta.remainingDays} day{sprintMeta.remainingDays === 1 ? '' : 's'} remaining</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#eeeeeb]">
                  <div className="h-full rounded-full bg-blue transition-all" style={{ width: `${Math.min(100, (sprintMeta.elapsedDays / sprintMeta.totalDays) * 100)}%` }} />
                </div>
              </div>
            </Card>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <KpiCard label="Story Points" value={kpi.totalPoints} onClick={() => setTab('sprintBacklog')} />
            <KpiCard label="Planned Tasks" value={kpi.plannedTasks} onClick={() => setTab('sprintBacklog')} />
            <KpiCard label="Completed" value={kpi.completedTasks} tone="green" onClick={() => setTab('sprintBacklog')} />
            <KpiCard label="In Progress" value={kpi.inProgress} tone="blue" onClick={() => setTab('sprintBacklog')} />
            <KpiCard label="Blocked" value={kpi.blocked} tone={kpi.blocked ? 'red' : 'neutral'} onClick={() => setTab('blockers')} />
            <KpiCard label="Pending" value={kpi.pending} onClick={() => setTab('sprintBacklog')} />
            <KpiCard label="Completion %" value={`${kpi.completion}%`} tone={kpi.completion >= 80 ? 'green' : kpi.completion >= 50 ? 'amber' : 'red'} onClick={() => setTab('analytics')} />
            <KpiCard label="Planned Hours" value={kpi.plannedHours} onClick={() => setTab('capacity')} />
            <KpiCard label="Logged Hours" value={kpi.loggedHours} onClick={() => setTab('capacity')} />
            <KpiCard label="Remaining" value={kpi.remainingHours} onClick={() => setTab('analytics')} />
            <KpiCard label="Capacity" value={`${kpi.capacity}h`} onClick={() => setTab('capacity')} />
            <KpiCard label="Utilisation" value={`${kpi.utilisation}%`} tone={kpi.utilisation > 100 ? 'red' : kpi.utilisation > 90 ? 'amber' : 'neutral'} onClick={() => setTab('capacity')} />
          </div>

          <Card>
            <CardTitle title="Sprint Health" subtitle="Overall assessment based on progress, blocked work and scope changes" />
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
              <div className="flex items-center gap-4">
                <div className="relative h-[84px] w-[84px] shrink-0">
                  <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
                    <circle cx="42" cy="42" r="36" fill="none" stroke="#eeeeeb" strokeWidth="8" />
                    <circle
                      cx="42"
                      cy="42"
                      r="36"
                      fill="none"
                      stroke={health.status === 'Healthy' ? '#16a34a' : health.status === 'At Risk' ? '#d97706' : '#dc2626'}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(Math.min(100, Math.max(0, health.score)) / 100) * 2 * Math.PI * 36} ${2 * Math.PI * 36}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-heading text-[17px] font-semibold leading-none text-ink">{health.score}</span>
                    <span className="text-[8px] text-muted">/ 100</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    {health.status === 'Healthy' ? <CheckCircle2 size={16} className="text-green" /> : <AlertTriangle size={16} className={health.status === 'At Risk' ? 'text-amber' : 'text-red'} />}
                    <p className={`text-[15px] font-semibold ${health.status === 'Healthy' ? 'text-green' : health.status === 'At Risk' ? 'text-amber' : 'text-red'}`}>{health.status}</p>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted">Sprint health score</p>
                </div>
              </div>
              <div className="min-w-0 flex-1 border-t border-line pt-4 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{health.reasons.length ? 'Issues affecting this sprint' : 'No issues detected'}</p>
                {health.reasons.length > 0 ? (
                  <ul className="space-y-1.5">
                    {health.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-ink">
                        <AlertTriangle size={12} className="mt-[3px] shrink-0 text-amber" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="flex items-center gap-2 text-[12px] text-muted"><CheckCircle2 size={13} className="shrink-0 text-green" /> Everything is on track for this sprint.</p>
                )}
              </div>
            </div>
          </Card>

        </div>
      )}

      {tab === 'planning' && (
        <SprintPlanningForm onCancel={() => setSprintFormOpen(false)} onSubmit={(form) => sprints.addSprint(form)} />
      )}

      {tab === 'productBacklog' && (
        <ProductBacklogList
          open={backlogFormOpen}
          setOpen={setBacklogFormOpen}
          onMoveToSprint={(itemId) => activeSprint && sprints.moveToSprint(itemId, activeSprint.id)}
        />
      )}

      {tab === 'sprintBacklog' && activeSprint && (
        <SprintBacklog sprint={activeSprint} onRemove={(id) => sprints.removeFromSprint(id)} />
      )}

      {tab === 'capacity' && activeSprint && <CapacityTable sprint={activeSprint} team={app.team} items={activeItems} />}

      {tab === 'analytics' && activeSprint && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Sprint Velocity" value={kpi?.velocity ?? 0} tone="green" />
            <KpiCard label="Blocked Hours" value={sprints.blockers.filter((b) => b.sprintId === activeSprint.id).reduce((s, b) => s + b.blockedHours, 0)} tone="red" />
            <KpiCard label="Carry Forward" value={kpi?.carried ?? 0} />
            <KpiCard label="Scope Changes" value={changeTable.length} />
          </div>
          <Card>
            <CardTitle title="Daily Progress Trend" />
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={burndownData.length ? burndownData : [{ date: todayKey(), completedTasks: 0 }]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="completedTasks" stroke="#16a34a" strokeWidth={2} name="Completed Tasks" />
                  <Line type="monotone" dataKey="remainingPoints" stroke="#2b6cb0" name="Remaining Points" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {tab === 'blockers' && activeSprint && (
        <BlockersSection
          sprint={activeSprint}
          open={blockerFormOpen}
          setOpen={setBlockerFormOpen}
          onResolve={sprints.resolveBlocker}
          onAdd={sprints.addBlocker}
        />
      )}

      {tab === 'review' && activeSprint && kpi && (
        <Card>
          <CardTitle title="Sprint Review" subtitle={`Sprint ${activeSprint.number} · ${activeSprint.name}`} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-line p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Original Commitment</p>
              <p className="text-[20px] font-semibold text-ink">{activeSprint.originalItemIds.length} tasks</p>
              <p className="text-[12px] text-muted">{activeSprint.originalItemIds.reduce((s, id) => s + (sprints.backlog.find((b) => b.id === id)?.storyPoints ?? 0), 0)} points</p>
            </div>
            <div className="rounded-lg border border-line p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Delivery</p>
              <p className="text-[20px] font-semibold text-ink">{kpi.completedTasks} completed</p>
              <p className="text-[12px] text-muted">{kpi.completedPoints} points · {kpi.loggedHours}h logged</p>
            </div>
            <div className="rounded-lg border border-line p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Outcome</p>
              <p className="text-[20px] font-semibold text-ink">{kpi.completion}%</p>
              <p className="text-[12px] text-muted">Velocity {kpi.velocity} · {changeTable.length} scope changes</p>
            </div>
          </div>
          <div className="mt-5 rounded-lg bg-[#fafaf8] p-4">
            <p className="text-[12px] font-semibold text-ink">Scope Change Log</p>
            <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[400px] text-[11px]">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-1">Type</th>
                  <th>Item</th>
                  <th>By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {changeTable.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-1.5"><Badge tone={c.type === 'Added' ? 'green' : c.type === 'Removed' ? 'red' : 'amber'}>{c.type}</Badge></td>
                    <td className="text-ink">{c.backlogItemId ? sprints.backlog.find((b) => b.id === c.backlogItemId)?.title ?? c.backlogItemId.slice(0, 6) : '—'}</td>
                    <td className="text-muted">{c.changedBy}</td>
                    <td className="text-muted">{c.changedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </Card>
      )}
      </div>

      <SprintModal open={sprintFormOpen} onClose={() => setSprintFormOpen(false)} onSubmit={sprints.addSprint} projects={app.projects} team={app.team} />
    </div>
  )
}

function SprintPlanningForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (s: any) => void }) {
  return (
    <Card>
      <CardTitle title="Sprint Planning" subtitle="Use the New Sprint button above to create a sprint. Set dates, working days and team, then move backlog items in via the Sprint Backlog tab." />
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-line p-3">
          <p className="text-[12px] font-semibold text-ink">1. Create Sprint</p>
          <p className="text-[11px] text-muted">Name, goal, project, dates, working days and owner.</p>
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="text-[12px] font-semibold text-ink">2. Select Team</p>
          <p className="text-[11px] text-muted">Team member capacity is auto-calculated from working days × 8h.</p>
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="text-[12px] font-semibold text-ink">3. Plan Backlog</p>
          <p className="text-[11px] text-muted">Move product backlog items into the sprint and review capacity warnings.</p>
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="text-[12px] font-semibold text-ink">4. Validate</p>
          <p className="text-[11px] text-muted">Over-allocation, missing estimates and unresolved dependencies are flagged.</p>
        </div>
      </div>
    </Card>
  )
}

function ProductBacklogList({ open, setOpen, onMoveToSprint }: { open: boolean; setOpen: (v: boolean) => void; onMoveToSprint: (id: string) => void }) {
  const sprints = useSprints()
  const app = useApp()
  const items = useMemo(() => getBacklogItems(sprints), [sprints])
  const [query, setQuery] = useState('')
  const visible = useMemo(
    () => items.filter((i) => i.title.toLowerCase().includes(query.trim().toLowerCase())),
    [items, query],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex h-[36px] w-full max-w-[245px] items-center gap-2 rounded-lg border border-line bg-white px-3 text-muted">
          <Search size={14} />
          <input placeholder="Search backlog..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-[11px] text-ink outline-none" />
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={14} className="mr-1" /> Add Backlog Item</Button>
      </div>
      <Card>
        <CardTitle title="Product Backlog" subtitle={`${items.length} items`} />
        {items.length === 0 ? (
          <EmptyState title="No product backlog items" description="Add items or move them from the sprint backlog." action={<Button onClick={() => setOpen(true)}>Add Item</Button>} />
        ) : visible.length === 0 ? (
          <EmptyState title="No backlog items match" description="Try a different search term." />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-[11px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2">Title</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Points</th>
                <th>Est. Hours</th>
                <th>Project</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="py-2 font-medium text-ink">{item.title}</td>
                  <td><Badge tone="neutral">{item.type}</Badge></td>
                  <td><Badge tone={item.priority === 'Critical' ? 'red' : item.priority === 'High' ? 'amber' : 'neutral'}>{item.priority}</Badge></td>
                  <td>{item.storyPoints}</td>
                  <td>{item.estimatedHours}</td>
                  <td className="text-muted">{app.projects.find((p) => p.id === item.projectId)?.name ?? '—'}</td>
                  <td>
                    <TextButton onClick={() => onMoveToSprint(item.id)}>Move to sprint</TextButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
      <BacklogModal open={open} onClose={() => setOpen(false)} projects={app.projects} onSubmit={(item) => { sprints.addBacklogItem(item); setOpen(false) }} />
    </div>
  )
}

function SprintBacklog({ sprint, onRemove }: { sprint: Sprint; onRemove: (id: string) => void }) {
  const sprints = useSprints()
  const app = useApp()
  const items = useMemo(() => getSprintItems(sprint.id, sprints), [sprint, sprints])
  const kpi = useMemo(() => getSprintKPIs(sprint, sprints), [sprint, sprints])
  const capacity = sprint.members.length * sprint.workingDays * sprint.hoursPerDay
  const memberHours = useMemo(() => {
    const map: Record<string, number> = {}
    items.forEach((i) => { if (i.assignee) map[i.assignee] = (map[i.assignee] ?? 0) + i.estimatedHours })
    return map
  }, [items])
  const perMemberCapacity = sprint.members.length ? capacity / sprint.members.length : 0
  const overallocated = sprint.members.filter((m) => perMemberCapacity > 0 && (memberHours[m] ?? 0) > perMemberCapacity)
  const missingEstimate = items.filter((i) => !i.estimatedHours)
  const missingAssignee = items.filter((i) => !i.assignee)
  const unresolvedDeps = items.filter((i) => i.dependencies.some((dep) => !sprints.backlog.find((b) => b.id === dep && b.status === 'Done')))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Planned Items" value={items.length} />
        <KpiCard label="Story Points" value={kpi.totalPoints} />
        <KpiCard label="Est. Hours" value={kpi.plannedHours} />
        <KpiCard label="Capacity" value={`${capacity}h`} tone={kpi.plannedHours > capacity ? 'red' : kpi.plannedHours > capacity * 0.9 ? 'amber' : 'green'} />
      </div>
      {kpi.plannedHours > capacity && (
        <div className="rounded-lg border border-red/30 bg-[#fee2e2] p-3 text-[12px] text-red">
          <AlertTriangle size={14} className="mb-1 inline" /> Sprint is overloaded. Planned hours exceed team capacity.
        </div>
      )}
      {overallocated.length > 0 && (
        <div className="rounded-lg border border-amber/30 bg-[#fef3c7] p-3 text-[12px] text-amber">
          <AlertTriangle size={14} className="mb-1 inline" /> Overloaded employees: {overallocated.join(', ')}
        </div>
      )}
      {unresolvedDeps.length > 0 && <div className="rounded-lg border border-amber/30 bg-[#fef3c7] p-3 text-[12px] text-amber">{unresolvedDeps.length} tasks have unresolved dependencies.</div>}
      {missingEstimate.length > 0 && <div className="rounded-lg border border-amber/30 bg-[#fef3c7] p-3 text-[12px] text-amber">{missingEstimate.length} tasks are missing estimates.</div>}
      {missingAssignee.length > 0 && <div className="rounded-lg border border-amber/30 bg-[#fef3c7] p-3 text-[12px] text-amber">{missingAssignee.length} tasks are unassigned.</div>}
      <Card>
        <CardTitle title="Sprint Backlog" />
        <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] text-[11px]">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-2">Title</th>
              <th>Assignee</th>
              <th>Status</th>
              <th>Points</th>
              <th>Hours</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-line">
                <td className="py-2 font-medium text-ink">{item.title}</td>
                <td className="text-muted">{item.assignee ?? '—'}</td>
                <td><Badge tone={taskTone[item.status]}>{item.status}</Badge></td>
                <td>{item.storyPoints}</td>
                <td>{item.estimatedHours}</td>
                <td>
                  <TextButton onClick={() => onRemove(item.id)}>Remove</TextButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  )
}

function CapacityTable({ sprint, team, items }: { sprint: Sprint; team: TeamMember[]; items: BacklogItem[] }) {
  const workingHours = sprint.workingDays * sprint.hoursPerDay
  return (
    <Card>
      <CardTitle title="Team Capacity" subtitle={`${sprint.workingDays} working days · ${sprint.hoursPerDay}h/day`} />
      <div className="overflow-x-auto">
      <table className="w-full min-w-[440px] text-[11px]">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-2">Employee</th>
            <th>Capacity</th>
            <th>Planned Hours</th>
            <th>Utilisation</th>
            <th>Remaining</th>
          </tr>
        </thead>
        <tbody>
          {sprint.members.map((m) => {
            const member = team.find((t) => t.name === m)
            const planned = items.filter((i) => i.assignee === m).reduce((s, i) => s + i.estimatedHours, 0)
            const util = workingHours > 0 ? Math.round((planned / workingHours) * 100) : 0
            const tone = util > 100 ? 'red' : util > 90 ? 'amber' : util < 70 ? 'blue' : 'green'
            const label = util > 100 ? 'Overloaded' : util > 90 ? 'High' : util >= 70 ? 'Healthy' : 'Under-utilised'
            return (
              <tr key={m} className="border-t border-line">
                <td className="py-2 font-medium text-ink">{m}</td>
                <td>{workingHours}h</td>
                <td>{planned}h</td>
                <td>
                  <Badge tone={tone as any}>{util}% — {label}</Badge>
                </td>
                <td className="text-muted">{Math.max(0, workingHours - planned)}h</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </Card>
  )
}

function BlockersSection({ sprint, open, setOpen, onResolve, onAdd }: { sprint: Sprint; open: boolean; setOpen: (v: boolean) => void; onResolve: (id: string, res: string) => void; onAdd: (b: any) => void }) {
  const sprints = useSprints()
  const blockers = sprints.blockers.filter((b) => b.sprintId === sprint.id)
  const totalBlocked = blockers.reduce((s, b) => s + b.blockedHours, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Blockers" value={blockers.length} tone={blockers.length ? 'red' : 'neutral'} />
        <KpiCard label="Open" value={blockers.filter((b) => b.status === 'Open').length} tone="red" />
        <KpiCard label="Resolved" value={blockers.filter((b) => b.status === 'Resolved').length} tone="green" />
        <KpiCard label="Blocked Hours" value={totalBlocked} tone="red" />
      </div>
      <Button onClick={() => setOpen(true)}><Plus size={14} className="mr-1" /> Raise Blocker</Button>
      <Card>
        <CardTitle title="Blockers & Dependencies" />
        {blockers.length === 0 ? <EmptyState title="No blockers" description="Sprint is running smoothly." /> : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-[11px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2">Description</th>
                <th>Task</th>
                <th>Type</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Hours</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {blockers.map((b) => (
                <tr key={b.id} className="border-t border-line">
                  <td className="py-2 font-medium text-ink">{b.description}</td>
                  <td className="text-muted">{b.backlogItemId.slice(0, 6)}</td>
                  <td><Badge tone="neutral">{b.type}</Badge></td>
                  <td>{b.owner}</td>
                  <td><Badge tone={b.status === 'Open' ? 'red' : 'green'}>{b.status}</Badge></td>
                  <td>{b.blockedHours}</td>
                  <td>
                    {b.status === 'Open' && (
                      <TextButton onClick={() => onResolve(b.id, 'Resolved today')}>Resolve</TextButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
      <BlockerModal open={open} onClose={() => setOpen(false)} sprint={sprint} items={sprints.backlog.filter((b) => b.sprintId === sprint.id)} onAdd={(b) => { onAdd(b); setOpen(false) }} />
    </div>
  )
}



function SprintModal({ open, onClose, onSubmit, projects, team }: { open: boolean; onClose: () => void; onSubmit: (s: any) => void; projects: any[]; team: TeamMember[] }) {
  const [form, setForm] = useState({ name: '', goal: '', projectId: projects[0]?.id ?? '', start: '', end: '', workingDays: 10, hoursPerDay: 8, owner: team[0]?.name ?? '', members: [] as string[] })
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Reset whenever the modal opens so a previous submission or stale first-project
  // selection never leaks into the next form.
  useEffect(() => {
    if (open) {
      setForm({ name: '', goal: '', projectId: projects[0]?.id ?? '', start: '', end: '', workingDays: 10, hoursPerDay: 8, owner: team[0]?.name ?? '', members: [] })
      setErrors({})
    }
  }, [open, projects, team])
  const submit = () => {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Sprint name is required.'
    if (!form.projectId) next.projectId = 'Select a project.'
    if (!form.owner) next.owner = 'Select an owner.'
    if (!form.start) next.start = 'Start date is required.'
    if (!form.end) next.end = 'End date is required.'
    if (form.start && form.end && form.start > form.end) next.end = 'End date must be on or after the start date.'
    setErrors(next)
    if (Object.keys(next).length) return
    onSubmit(form)
    onClose()
  }
  if (!open) return null
  return (
    <Modal open={open} title="Create Sprint" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Create</Button></>}>
      <FormErrorSummary errors={errors} />
      <div className="form-stagger grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Sprint Name" required error={errors.name}><input className={errors.name ? invalidInputClass : inputClass} aria-invalid={!!errors.name} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: '' }) }} /></Field>
        <Field label="Sprint Goal"><input className={inputClass} value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} /></Field>
        <Field label="Project" required error={errors.projectId}>
          <select className={errors.projectId ? invalidInputClass : inputClass} aria-invalid={!!errors.projectId} value={form.projectId} onChange={(e) => { setForm({ ...form, projectId: e.target.value }); setErrors({ ...errors, projectId: '' }) }}>
            <option value="">Select a project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Owner" required error={errors.owner}>
          <select className={errors.owner ? invalidInputClass : inputClass} aria-invalid={!!errors.owner} value={form.owner} onChange={(e) => { setForm({ ...form, owner: e.target.value }); setErrors({ ...errors, owner: '' }) }}>
            <option value="">Select an owner</option>
            {team.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Start Date" required error={errors.start}><input className={errors.start ? invalidInputClass : inputClass} aria-invalid={!!errors.start} type="date" value={form.start} onChange={(e) => { setForm({ ...form, start: e.target.value }); setErrors({ ...errors, start: '' }) }} /></Field>
        <Field label="End Date" required error={errors.end}><input className={errors.end ? invalidInputClass : inputClass} aria-invalid={!!errors.end} type="date" value={form.end} onChange={(e) => { setForm({ ...form, end: e.target.value }); setErrors({ ...errors, end: '' }) }} /></Field>
        <Field label="Working Days"><input className={inputClass} type="number" min={1} value={form.workingDays} onChange={(e) => setForm({ ...form, workingDays: Math.max(0, Number(e.target.value) || 0) })} /></Field>
        <Field label="Hours/Day"><input className={inputClass} type="number" min={0} value={form.hoursPerDay} onChange={(e) => setForm({ ...form, hoursPerDay: Math.max(0, Number(e.target.value) || 0) })} /></Field>
        <Field label="Team Members" className="md:col-span-2">
          <select multiple className={`${inputClass} h-24`} value={form.members} onChange={(e) => setForm({ ...form, members: Array.from(e.target.selectedOptions).map((o) => o.value) })}>
            {team.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  )
}

function BacklogModal({ open, onClose, projects, onSubmit }: { open: boolean; onClose: () => void; projects: any[]; onSubmit: (i: any) => void }) {
  const [form, setForm] = useState({ title: '', description: '', projectId: projects[0]?.id ?? '', type: 'Task' as any, priority: 'Medium' as any, storyPoints: 0, estimatedHours: 0 })
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    if (open) {
      setForm({ title: '', description: '', projectId: projects[0]?.id ?? '', type: 'Task' as any, priority: 'Medium' as any, storyPoints: 0, estimatedHours: 0 })
      setErrors({})
    }
  }, [open, projects])
  const submit = () => {
    const next: Record<string, string> = {}
    if (!form.title.trim()) next.title = 'Backlog item title is required.'
    if (!form.projectId) next.projectId = 'Select a project.'
    setErrors(next)
    if (Object.keys(next).length) return
    onSubmit(form)
    onClose()
  }
  if (!open) return null
  return (
    <Modal open={open} title="Add Backlog Item" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Add</Button></>}>
      <FormErrorSummary errors={errors} />
      <div className="form-stagger grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Title" required error={errors.title}><input className={errors.title ? invalidInputClass : inputClass} aria-invalid={!!errors.title} value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors({ ...errors, title: '' }) }} /></Field>
        <Field label="Project" required error={errors.projectId}>
          <select className={errors.projectId ? invalidInputClass : inputClass} aria-invalid={!!errors.projectId} value={form.projectId} onChange={(e) => { setForm({ ...form, projectId: e.target.value }); setErrors({ ...errors, projectId: '' }) }}>
            <option value="">Select a project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {['Epic', 'Story', 'Task', 'Bug', 'Improvement', 'Technical Debt', 'CR'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {['Critical', 'High', 'Medium', 'Low'].map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Story Points"><input className={inputClass} type="number" min={0} value={form.storyPoints} onChange={(e) => setForm({ ...form, storyPoints: Math.max(0, Number(e.target.value) || 0) })} /></Field>
        <Field label="Estimated Hours"><input className={inputClass} type="number" min={0} value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: Math.max(0, Number(e.target.value) || 0) })} /></Field>
      </div>
    </Modal>
  )
}

function BlockerModal({ open, onClose, sprint, items, onAdd }: { open: boolean; onClose: () => void; sprint: Sprint; items: BacklogItem[]; onAdd: (b: any) => void }) {
  const [form, setForm] = useState({ backlogItemId: items[0]?.id ?? '', description: '', type: 'Technical' as any, owner: sprint.owner, blockedHours: 0, employee: '', status: 'Open' as const, sprintId: sprint.id })
  // Re-sync when the modal opens or the selected sprint changes — otherwise a
  // persisted mount files the blocker against a stale sprint/task.
  useEffect(() => {
    if (open) {
      setForm({ backlogItemId: items[0]?.id ?? '', description: '', type: 'Technical' as any, owner: sprint.owner, blockedHours: 0, employee: '', status: 'Open' as const, sprintId: sprint.id })
      setErrors({})
    }
  }, [open, sprint.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submit = () => {
    const next: Record<string, string> = {}
    if (!form.backlogItemId) next.backlogItemId = 'Select the affected task.'
    if (!form.description.trim()) next.description = 'Blocker description is required.'
    setErrors(next)
    if (Object.keys(next).length) return
    onAdd(form)
    onClose()
  }
  if (!open) return null
  return (
    <Modal open={open} title="Raise Blocker" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Raise</Button></>}>
      <FormErrorSummary errors={errors} />
      <div className="form-stagger grid grid-cols-1 gap-4">
        <Field label="Related Task" required error={errors.backlogItemId}>
          <select className={errors.backlogItemId ? invalidInputClass : inputClass} aria-invalid={!!errors.backlogItemId} value={form.backlogItemId} onChange={(e) => { setForm({ ...form, backlogItemId: e.target.value }); setErrors({ ...errors, backlogItemId: '' }) }}>
            <option value="">Select a task</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        </Field>
        <Field label="Description" required error={errors.description}><input className={errors.description ? invalidInputClass : inputClass} aria-invalid={!!errors.description} value={form.description} onChange={(e) => { setForm({ ...form, description: e.target.value }); setErrors({ ...errors, description: '' }) }} /></Field>
        <Field label="Blocker Type">
          <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {['Client Dependency', 'Internal Dependency', 'Technical', 'Requirement', 'Design', 'QA', 'Access', 'Infrastructure', 'Approval', 'Other'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Employee"><input className={inputClass} value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })} /></Field>
        <Field label="Owner"><input className={inputClass} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></Field>
        <Field label="Blocked Hours"><input className={inputClass} type="number" min={0} value={form.blockedHours} onChange={(e) => setForm({ ...form, blockedHours: Math.max(0, Number(e.target.value) || 0) })} /></Field>
      </div>
    </Modal>
  )
}


