// @ts-nocheck
import { useMemo, useState } from 'react'

const today = new Date().toISOString().slice(0, 10)
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  FileText,
  Filter,
  Flag,
  FolderKanban,
  LayoutDashboard,
  List,
  ListTodo,
  Lock,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  type BacklogItem,
  type Blocker,
  type Retrospective,
  type Sprint,
  type SprintStatus,
  calculateEmployeePerformance,
  getBacklogItems,
  getSprintHealthScore,
  getSprintItems,
  getSprintKPIs,
  getSprintScopeChanges,
  getSprintTotalHours,
} from '../lib/sprints'
import { useSprints } from '../lib/sprintStore'
import { useApp, type TeamMember } from '../store'
import { Badge, Button, Card, CardTitle, EmptyState, Field, FormErrorSummary, Modal, TextButton, inputClass, invalidInputClass } from '../components/ui'

type TabKey =
  | 'dashboard'
  | 'planning'
  | 'productBacklog'
  | 'sprintBacklog'
  | 'board'
  | 'calendar'
  | 'capacity'
  | 'analytics'
  | 'blockers'
  | 'review'
  | 'retrospective'
  | 'performance'
  | 'history'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'planning', label: 'Planning', icon: Target },
  { key: 'productBacklog', label: 'Product Backlog', icon: List },
  { key: 'sprintBacklog', label: 'Sprint Backlog', icon: ListTodo },
  { key: 'board', label: 'Sprint Board', icon: FolderKanban },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'capacity', label: 'Capacity', icon: Users },
  { key: 'analytics', label: 'Progress & Analytics', icon: BarChart3 },
  { key: 'blockers', label: 'Blockers', icon: AlertTriangle },
  { key: 'review', label: 'Sprint Review', icon: CheckCircle2 },
  { key: 'retrospective', label: 'Retrospective', icon: RefreshCcw },
  { key: 'performance', label: 'Performance', icon: Trophy },
  { key: 'history', label: 'History', icon: Clock },
]

const statusColor: Record<SprintStatus, string> = {
  Planned: 'bg-[#dbeafe] text-[#2563eb]',
  'Sprint Ready': 'bg-[#fef3c7] text-[#d97706]',
  Active: 'bg-[#dcfce7] text-[#16a34a]',
  Completed: 'bg-[#f0f1ee] text-[#656966]',
  Cancelled: 'bg-[#fee2e2] text-[#dc2626]',
}

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

export function Sprints() {
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
  const performance = useMemo(
    () => (activeSprint ? calculateEmployeePerformance(activeSprint, sprints, app.team.map((t) => ({ name: t.name, role: t.role }))) : []),
    [activeSprint, sprints, app.team],
  )
  const teamLookup = useMemo(() => new Map(app.team.map((t) => [t.name, t])), [app.team])
  const project = useMemo(() => app.projects.find((p) => p.id === activeSprint?.projectId), [activeSprint, app.projects])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    activeItems.forEach((i) => (counts[i.status] = (counts[i.status] ?? 0) + 1))
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [activeItems])

  const workloadData = useMemo(
    () =>
      app.team.map((m) => {
        const items = activeItems.filter((i) => i.assignee === m.name)
        const hours = items.reduce((s, i) => s + i.estimatedHours, 0)
        return { name: m.name, hours, capacity: m.capacity }
      }),
    [activeItems, app.team],
  )

  const burndownData = useMemo(
    () => sprints.dailyMetrics.filter((m) => m.sprintId === activeSprint?.id),
    [activeSprint, sprints.dailyMetrics],
  )

  const changeTable = useMemo(
    () => (activeSprint ? getSprintScopeChanges(activeSprint.id, sprints) : []),
    [activeSprint, sprints],
  )

  const StatusBadge = ({ status }: { status: SprintStatus }) => <span className={`rounded-full px-2 py-[2px] text-[10px] font-bold ${statusColor[status]}`}>{status}</span>

  return (
    <div className="mx-auto w-full max-w-[1500px] px-8 py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#929692]">Sprints</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[28px] font-semibold tracking-tight text-ink">{activeSprint?.name ?? 'Sprint Module'}</h1>
            {activeSprint && <StatusBadge status={activeSprint.status} />}
          </div>
          <p className="mt-2 max-w-[720px] text-[13px] text-muted">{activeSprint?.goal ?? 'Plan, execute and review agile sprints with connected performance analytics.'}</p>
        </div>
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

      {tab === 'dashboard' && activeSprint && kpi && health && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <KpiCard label="Story Points" value={kpi.totalPoints} onClick={() => setTab('sprintBacklog')} />
            <KpiCard label="Planned Tasks" value={kpi.plannedTasks} onClick={() => setTab('sprintBacklog')} />
            <KpiCard label="Completed" value={kpi.completedTasks} tone="green" onClick={() => setTab('board')} />
            <KpiCard label="In Progress" value={kpi.inProgress} tone="blue" onClick={() => setTab('board')} />
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
            <CardTitle title="Sprint Health" subtitle={`Score: ${health.score}/100 — ${health.status}`} />
            <div className="flex flex-wrap items-center gap-2">
              {health.status === 'Healthy' ? <CheckCircle2 size={16} className="text-green" /> : health.status === 'At Risk' ? <AlertTriangle size={16} className="text-amber" /> : <AlertTriangle size={16} className="text-red" />}
              <span className={`text-[14px] font-semibold ${health.status === 'Healthy' ? 'text-green' : health.status === 'At Risk' ? 'text-amber' : 'text-red'}`}>{health.status}</span>
            </div>
            {health.reasons.length > 0 && (
              <ul className="mt-2 list-disc pl-4 text-[12px] text-muted">
                {health.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardTitle title="Burndown" subtitle="Remaining hours vs. ideal trend" />
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={burndownData.length ? burndownData : [{ date: today, remainingHours: kpi.plannedHours, remainingPoints: kpi.totalPoints }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="remainingHours" stroke="#2b6cb0" fill="#dbeafe" name="Remaining Hours" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardTitle title="Task Status" subtitle="Distribution by status" />
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusCounts.length ? statusCounts : [{ name: 'No tasks', value: 1 }]} dataKey="value" nameKey="name" outerRadius={80} label />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardTitle title="Employee Workload" subtitle="Estimated hours vs capacity" />
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workloadData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="hours" fill="#2b6cb0" name="Planned hours" />
                    <Bar dataKey="capacity" fill="#dcfce7" name="Capacity" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardTitle title="Scope Changes" subtitle={`${changeTable.length} changes`} />
              {changeTable.length === 0 ? (
                <p className="text-[12px] text-muted">No scope changes recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {changeTable.slice(0, 6).map((c) => (
                    <li key={c.id} className="flex items-center justify-between rounded-lg border border-line bg-[#fafaf8] p-2 text-[12px]">
                      <span>{c.type}</span>
                      <span className="text-[10px] text-muted">{c.backlogItemId ? c.backlogItemId.slice(0, 6) : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
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

      {tab === 'board' && activeSprint && <SprintBoard sprint={activeSprint} onStatus={sprints.updateItemStatus} onLog={sprints.logTime} />}

      {tab === 'calendar' && activeSprint && (
        <Card>
          <CardTitle title="Sprint Calendar" subtitle={`${activeSprint.start} → ${activeSprint.end} · ${activeSprint.workingDays} working days`} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: activeSprint.workingDays }).map((_, i) => {
              const d = new Date(activeSprint.start)
              d.setDate(d.getDate() + i)
              const date = d.toISOString().slice(0, 10)
              const done = activeItems.filter((it) => it.completedAt === date).length
              return (
                <div key={i} className="rounded-lg border border-line p-3">
                  <p className="text-[12px] font-semibold text-ink">Day {i + 1}</p>
                  <p className="text-[10px] text-muted">{date}</p>
                  {done > 0 && <p className="mt-1 text-[10px] text-green">{done} completed</p>}
                </div>
              )
            })}
          </div>
        </Card>
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
                <LineChart data={burndownData.length ? burndownData : [{ date: today, completedTasks: 0 }]}>
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
            <table className="mt-2 w-full text-[11px]">
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
                    <td className="text-ink">{c.backlogItemId ? c.backlogItemId.slice(0, 6) : '—'}</td>
                    <td className="text-muted">{c.changedBy}</td>
                    <td className="text-muted">{c.changedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'retrospective' && activeSprint && (
        <RetrospectiveSection
          retro={sprints.retrospectives.find((r) => r.sprintId === activeSprint.id)}
          onSave={(r) => sprints.saveRetrospective(r)}
        />
      )}

      {tab === 'performance' && activeSprint && (
        <PerformanceTable performance={performance} onCompare={(name) => {}} />
      )}

      {tab === 'history' && (
        <Card>
          <CardTitle title="Sprint History" />
          <table className="mt-2 w-full text-[11px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2">Sprint</th>
                <th>Project</th>
                <th>Status</th>
                <th>Tasks</th>
                <th>Points</th>
                <th>Velocity</th>
              </tr>
            </thead>
            <tbody>
              {sprints.sprints.map((s) => {
                const k = getSprintKPIs(s, sprints)
                return (
                  <tr key={s.id} className="border-t border-line">
                    <td className="py-2 font-medium text-ink">{s.name}</td>
                    <td className="text-muted">{app.projects.find((p) => p.id === s.projectId)?.name ?? '—'}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>{k.completedTasks}/{k.plannedTasks}</td>
                    <td>{k.completedPoints}</td>
                    <td>{k.velocity}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

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
  const [form, setForm] = useState({ title: '', type: 'Task' as const, priority: 'Medium' as const, estimatedHours: 0, storyPoints: 0, projectId: app.projects[0]?.id ?? '' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex h-[36px] w-[245px] items-center gap-2 rounded-lg border border-line bg-white px-3 text-muted">
          <Search size={14} />
          <input placeholder="Search backlog..." className="w-full bg-transparent text-[11px] text-ink outline-none" />
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={14} className="mr-1" /> Add Backlog Item</Button>
      </div>
      <Card>
        <CardTitle title="Product Backlog" subtitle={`${items.length} items`} />
        {items.length === 0 ? (
          <EmptyState title="No product backlog items" description="Add items or move them from the sprint backlog." action={<Button onClick={() => setOpen(true)}>Add Item</Button>} />
        ) : (
          <table className="w-full text-[11px]">
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
              {items.map((item) => (
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
  const overallocated = sprint.members.filter((m) => (memberHours[m] ?? 0) > capacity / sprint.members.length)
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
        <table className="w-full text-[11px]">
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
      </Card>
    </div>
  )
}

const boardColumns: BacklogItem['status'][] = ['To Do', 'In Progress', 'In Review', 'QA', 'Blocked', 'Done']

function SprintBoard({ sprint, onStatus, onLog }: { sprint: Sprint; onStatus: (id: string, status: BacklogItem['status']) => void; onLog: (log: any) => void }) {
  const sprints = useSprints()
  const items = useMemo(() => getSprintItems(sprint.id, sprints), [sprint, sprints])
  const [logModal, setLogModal] = useState<{ open: boolean; itemId: string }>({ open: false, itemId: '' })

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {boardColumns.map((col) => (
        <div key={col} className="min-w-[220px] flex-1">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-ink">{col}</p>
            <span className="rounded-full bg-[#f0f1ed] px-1.5 py-[1px] text-[9px] font-bold text-muted">{items.filter((i) => i.status === col).length}</span>
          </div>
          <div className="space-y-2">
            {items.filter((i) => i.status === col).map((item) => (
              <Card key={item.id} className="p-3">
                <p className="text-[12px] font-medium text-ink">{item.title}</p>
                <p className="text-[10px] text-muted">{item.assignee ?? 'Unassigned'}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge tone="neutral" className="text-[9px]">{item.storyPoints} pts</Badge>
                  <Badge tone="neutral" className="text-[9px]">{item.estimatedHours}h</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1 border-t border-line pt-2">
                  {boardColumns.filter((c) => c !== col).map((c) => (
                    <button
                      key={c}
                      onClick={() => onStatus(item.id, c)}
                      className="rounded bg-[#f0f1ed] px-2 py-1 text-[9px] text-ink hover:bg-ink hover:text-white"
                    >
                      → {c}
                    </button>
                  ))}
                </div>
                <TextButton className="mt-1" onClick={() => setLogModal({ open: true, itemId: item.id })}>Log time</TextButton>
              </Card>
            ))}
          </div>
        </div>
      ))}
      <TimeLogModal open={logModal.open} onClose={() => setLogModal({ open: false, itemId: '' })} itemId={logModal.itemId} onLog={onLog} />
    </div>
  )
}

function CapacityTable({ sprint, team, items }: { sprint: Sprint; team: TeamMember[]; items: BacklogItem[] }) {
  const workingHours = sprint.workingDays * sprint.hoursPerDay
  return (
    <Card>
      <CardTitle title="Team Capacity" subtitle={`${sprint.workingDays} working days · ${sprint.hoursPerDay}h/day`} />
      <table className="w-full text-[11px]">
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
            const util = Math.round((planned / workingHours) * 100)
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
          <table className="w-full text-[11px]">
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
        )}
      </Card>
      <BlockerModal open={open} onClose={() => setOpen(false)} sprint={sprint} items={sprints.backlog.filter((b) => b.sprintId === sprint.id)} onAdd={(b) => { onAdd(b); setOpen(false) }} />
    </div>
  )
}

function RetrospectiveSection({ retro, onSave }: { retro?: Retrospective; onSave: (r: Retrospective) => void }) {
  const [wentWell, setWentWell] = useState(retro?.wentWell.join('\n') ?? '')
  const [didNot, setDidNot] = useState(retro?.didNotGoWell.join('\n') ?? '')
  const [actions, setActions] = useState(retro?.actions ?? [])
  const [actionText, setActionText] = useState('')
  const [owner, setOwner] = useState('')
  const [due, setDue] = useState('')

  const save = () => {
    onSave({
      sprintId: retro?.sprintId ?? 's1',
      wentWell: wentWell.split('\n').filter(Boolean),
      didNotGoWell: didNot.split('\n').filter(Boolean),
      blockers: retro?.blockers ?? [],
      processIssues: retro?.processIssues ?? [],
      clientIssues: retro?.clientIssues ?? [],
      technicalIssues: retro?.technicalIssues ?? [],
      actions,
    })
  }

  return (
    <Card>
      <CardTitle title="Sprint Retrospective" action={<Button onClick={save}>Save</Button>} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="What went well"><textarea className={inputClass} rows={4} value={wentWell} onChange={(e) => setWentWell(e.target.value)} /></Field>
        <Field label="What didn't go well"><textarea className={inputClass} rows={4} value={didNot} onChange={(e) => setDidNot(e.target.value)} /></Field>
      </div>
      <div className="mt-5">
        <p className="mb-2 text-[12px] font-semibold text-ink">Improvement Actions</p>
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input className={inputClass} placeholder="Action" value={actionText} onChange={(e) => setActionText(e.target.value)} />
          <input className={inputClass} placeholder="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
          <input className={inputClass} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <Button onClick={() => { if (actionText && owner && due) { setActions([...actions, { id: Math.random().toString(36).slice(2, 9), action: actionText, owner, due, priority: 'Medium', status: 'Open' }]); setActionText(''); setOwner(''); setDue('') } }}>Add Action</Button>
        </div>
        {actions.length === 0 ? <p className="text-[12px] text-muted">No actions yet.</p> : (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-muted"><th className="py-2">Action</th><th>Owner</th><th>Due</th><th>Status</th></tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id} className="border-t border-line"><td className="py-2 font-medium text-ink">{a.action}</td><td>{a.owner}</td><td>{a.due}</td><td><Badge tone={a.status === 'Completed' ? 'green' : 'amber'}>{a.status}</Badge></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  )
}

function PerformanceTable({ performance, onCompare }: { performance: any[]; onCompare: (name: string) => void }) {
  return (
    <Card>
      <CardTitle title="Employee Sprint Performance" subtitle="Calculated across delivery, quality, estimation, productivity, reliability and collaboration" />
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-2">Employee</th>
            <th>Role</th>
            <th>Assigned</th>
            <th>Completed</th>
            <th>Points</th>
            <th>Completion</th>
            <th>Hours</th>
            <th>Blocked</th>
            <th>Score</th>
            <th>Rating</th>
          </tr>
        </thead>
        <tbody>
          {performance.map((p) => (
            <tr key={p.name} className="border-t border-line">
              <td className="py-2 font-medium text-ink">{p.name}</td>
              <td className="text-muted">{p.role}</td>
              <td>{p.assignedTasks}</td>
              <td>{p.completedTasks}</td>
              <td>{p.completedPoints}/{p.assignedPoints}</td>
              <td>{p.completionRate}%</td>
              <td>{p.actualHours}/{p.plannedHours}</td>
              <td>{p.blockedHours}</td>
              <td className="font-semibold text-ink">{p.score}</td>
              <td><Badge tone={p.score >= 80 ? 'green' : p.score >= 60 ? 'amber' : 'red'}>{p.rating}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 rounded-lg bg-[#fafaf8] p-4">
        <p className="text-[12px] font-semibold text-ink">Score Explainability</p>
        {performance.map((p) => (
          <div key={p.name} className="mt-2 text-[11px] text-muted">
            <span className="font-semibold text-ink">{p.name}</span>: {' '}
            {Object.entries(p.scoreBreakdown).map(([k, v]) => `${k}: ${v}`).join(' · ')} (Total {p.score})
          </div>
        ))}
      </div>
    </Card>
  )
}

function SprintModal({ open, onClose, onSubmit, projects, team }: { open: boolean; onClose: () => void; onSubmit: (s: any) => void; projects: any[]; team: TeamMember[] }) {
  const [form, setForm] = useState({ name: '', goal: '', projectId: projects[0]?.id ?? '', start: '', end: '', workingDays: 10, hoursPerDay: 8, owner: team[0]?.name ?? '', members: [] as string[] })
  const [errors, setErrors] = useState<Record<string, string>>({})
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <Field label="Working Days"><input className={inputClass} type="number" value={form.workingDays} onChange={(e) => setForm({ ...form, workingDays: Number(e.target.value) })} /></Field>
        <Field label="Hours/Day"><input className={inputClass} type="number" value={form.hoursPerDay} onChange={(e) => setForm({ ...form, hoursPerDay: Number(e.target.value) })} /></Field>
        <Field label="Team Members" className="col-span-2">
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <Field label="Story Points"><input className={inputClass} type="number" value={form.storyPoints} onChange={(e) => setForm({ ...form, storyPoints: Number(e.target.value) })} /></Field>
        <Field label="Estimated Hours"><input className={inputClass} type="number" value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: Number(e.target.value) })} /></Field>
      </div>
    </Modal>
  )
}

function BlockerModal({ open, onClose, sprint, items, onAdd }: { open: boolean; onClose: () => void; sprint: Sprint; items: BacklogItem[]; onAdd: (b: any) => void }) {
  const [form, setForm] = useState({ backlogItemId: items[0]?.id ?? '', description: '', type: 'Technical' as any, owner: sprint.owner, blockedHours: 0, employee: '', status: 'Open' as const, sprintId: sprint.id })
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
      <div className="grid grid-cols-1 gap-4">
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
        <Field label="Blocked Hours"><input className={inputClass} type="number" value={form.blockedHours} onChange={(e) => setForm({ ...form, blockedHours: Number(e.target.value) })} /></Field>
      </div>
    </Modal>
  )
}

function TimeLogModal({ open, onClose, itemId, onLog }: { open: boolean; onClose: () => void; itemId: string; onLog: (l: any) => void }) {
  const [form, setForm] = useState({ employee: '', date: new Date().toISOString().slice(0, 10), hours: 1, note: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submit = () => {
    const next: Record<string, string> = {}
    if (!form.employee.trim()) next.employee = 'Employee is required.'
    if (!form.date) next.date = 'Date is required.'
    if (!Number.isFinite(form.hours) || form.hours <= 0) next.hours = 'Hours must be greater than zero.'
    setErrors(next)
    if (Object.keys(next).length) return
    onLog({ ...form, backlogItemId: itemId })
    onClose()
  }
  if (!open) return null
  return (
    <Modal open={open} title="Log Time" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Log</Button></>}>
      <FormErrorSummary errors={errors} />
      <div className="grid grid-cols-1 gap-4">
        <Field label="Employee" required error={errors.employee}><input className={errors.employee ? invalidInputClass : inputClass} aria-invalid={!!errors.employee} value={form.employee} onChange={(e) => { setForm({ ...form, employee: e.target.value }); setErrors({ ...errors, employee: '' }) }} /></Field>
        <Field label="Date" required error={errors.date}><input className={errors.date ? invalidInputClass : inputClass} aria-invalid={!!errors.date} type="date" value={form.date} onChange={(e) => { setForm({ ...form, date: e.target.value }); setErrors({ ...errors, date: '' }) }} /></Field>
        <Field label="Hours" required error={errors.hours}><input className={errors.hours ? invalidInputClass : inputClass} aria-invalid={!!errors.hours} type="number" min="0.5" step="0.5" value={form.hours} onChange={(e) => { setForm({ ...form, hours: Number(e.target.value) }); setErrors({ ...errors, hours: '' }) }} /></Field>
        <Field label="Note"><input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
