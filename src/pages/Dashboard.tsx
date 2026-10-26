import { useEffect, useMemo, useState, type ElementType } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Activity, AlertTriangle, ArrowUpDown, ChevronRight, Eye, FileCheck, FileText, FolderKanban, MessageSquare, Plus, Search, Video } from 'lucide-react'
import { CURRENT_USER, useApp, type Health, type Project, type ProjectStatus, type StatusUpdate } from '../store'
import { dateKey, todayKey } from '../lib/dates'
import { effectiveHealth, isOverdue, isStale, latestSummary, latestUpdateMap, portfolioMetrics, reportedProgress, weeklyPulse } from '../lib/reporting'
import { Badge, Button, Card, CardTitle, Modal, ProgressBar, TextButton, Avatar, avatarUrl } from '../components/ui'
import { ProjectModal } from '../components/ProjectModal'
import { StatusUpdateModal } from '../components/StatusUpdateModal'
import { WeeklyKeyPoints } from './Reports'
import { GREETINGS } from '../lib/greetings'

const statusTone: Record<ProjectStatus, 'green' | 'amber' | 'red' | 'blue' | 'neutral'> = {
  Planning: 'neutral',
  'In Progress': 'blue',
  'On Hold': 'amber',
  Completed: 'green',
  'At Risk': 'red',
  'Backed Off': 'red',
}

const healthTone = { Green: 'green', Amber: 'amber', Red: 'red' } as const

const STATUS_ORDER: ProjectStatus[] = ['Planning', 'In Progress', 'On Hold', 'Completed', 'At Risk', 'Backed Off']
const HEALTH_ORDER: Health[] = ['Green', 'Amber', 'Red']

const LIVE_STYLES = `
@keyframes icon-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes icon-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.85; }
}
@keyframes number-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.08); }
  100% { transform: scale(1); }
}
@keyframes card-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes live-dot {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.5); }
  50% { opacity: 0.6; box-shadow: 0 0 0 5px rgba(22, 163, 74, 0); }
}
@keyframes shine-sweep {
  0% { transform: translateX(-140%) skewX(-18deg); }
  55%, 100% { transform: translateX(320%) skewX(-18deg); }
}
@keyframes bar-grow {
  from { width: 0; }
}
`

function getActivityIcon(type: string) {
  const icons: Record<string, ElementType> = {
    task: FileCheck,
    comment: MessageSquare,
    status: ArrowUpDown,
    risk: AlertTriangle,
    meeting: Video,
    project: FolderKanban,
  }
  const Icon = icons[type] ?? ArrowUpDown
  return <Icon size={15} strokeWidth={1.5} />
}

function activityTone(type: string) {
  switch (type) {
    case 'risk':
      return { icon: 'bg-[#fee2e2] text-[#dc2626]', pill: 'bg-[#fee2e2] text-[#b91c1c]', label: 'Risk' }
    case 'comment':
      return { icon: 'bg-[#fae8ff] text-[#a21caf]', pill: 'bg-[#fae8ff] text-[#86198f]', label: 'Comment' }
    case 'status':
      return { icon: 'bg-[#dcfce7] text-[#16a34a]', pill: 'bg-[#dcfce7] text-[#15803d]', label: 'Status' }
    case 'meeting':
      return { icon: 'bg-[#fef3c7] text-[#b45309]', pill: 'bg-[#fef3c7] text-[#92400e]', label: 'Meeting' }
    case 'project':
      return { icon: 'bg-[#e5e7eb] text-[#374151]', pill: 'bg-[#e5e7eb] text-[#374151]', label: 'Project' }
    default:
      return { icon: 'bg-[#e0e7ff] text-[#4f46e5]', pill: 'bg-[#e0e7ff] text-[#4338ca]', label: 'Task' }
  }
}

const relTime = (iso?: string) => {
  if (!iso) return ''
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

// ---------------------------------------------------------------------------
// Latest Project Status table — the core reporting surface
// ---------------------------------------------------------------------------

type SortKey = 'updated' | 'deadline' | 'status' | 'health' | 'progress' | 'name'

export interface TablePatch {
  query?: string
  statusF?: 'All' | ProjectStatus
  healthF?: 'All' | Health
  pmF?: string
  flagF?: 'All' | 'overdue' | 'stale' | 'unreported' | 'new' | 'old' | 'active' | 'closed'
  classF?: 'all' | 'new' | 'old'
  ts: number
}

function StatusTable({ projects, updates, patch }: { projects: Project[]; updates: StatusUpdate[]; patch?: TablePatch | null }) {
  const navigate = useNavigate()
  const today = todayKey()
  const [query, setQuery] = useState('')
  const [statusF, setStatusF] = useState<'All' | ProjectStatus>('All')
  const [healthF, setHealthF] = useState<'All' | Health>('All')
  const [pmF, setPmF] = useState('All')
  const [flagF, setFlagF] = useState<'All' | 'overdue' | 'stale' | 'unreported' | 'new' | 'old' | 'active' | 'closed'>('All')
  const [classF, setClassF] = useState<'all' | 'new' | 'old'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('updated')
  const [sortAsc, setSortAsc] = useState(false)
  const [updateTarget, setUpdateTarget] = useState<Project | null>(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 9

  const latest = useMemo(() => latestUpdateMap(updates), [updates])
  const pms = useMemo(() => [...new Set(projects.map((p) => p.manager).filter(Boolean))].sort(), [projects])

  const resetFilters = () => {
    setQuery(''); setStatusF('All'); setHealthF('All'); setPmF('All'); setFlagF('All'); setClassF('all')
  }

  // External filter requests from dashboard widgets — apply + reset unspecified fields
  useEffect(() => {
    if (!patch) return
    setQuery(patch.query ?? '')
    setStatusF(patch.statusF ?? 'All')
    setHealthF(patch.healthF ?? 'All')
    setPmF(patch.pmF ?? 'All')
    setFlagF(patch.flagF ?? 'All')
    setClassF(patch.classF ?? 'all')
  }, [patch])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects
      .map((p) => {
        const l = latest.get(p.id)
        return { p, l, health: effectiveHealth(p, l, today), summary: latestSummary(l), progress: reportedProgress(p, l) }
      })
      .filter(({ p, l, health }) => {
        if (q && !p.name.toLowerCase().includes(q) && !p.client.toLowerCase().includes(q)) return false
        if (statusF !== 'All' && p.status !== statusF) return false
        if (healthF !== 'All' && health !== healthF) return false
        if (pmF !== 'All' && p.manager !== pmF) return false
        if (flagF === 'overdue' && !isOverdue(p, today)) return false
        if (flagF === 'stale' && !isStale(p, l, today)) return false
        if (flagF === 'unreported' && l) return false
        if ((flagF === 'new' || flagF === 'old') && p.importMeta?.projectClass?.toLowerCase() !== flagF) return false
        if (flagF === 'active' && (p.status === 'Completed' || p.status === 'Backed Off' || p.status === 'On Hold')) return false
        if (flagF === 'closed' && p.status !== 'Completed' && p.status !== 'Backed Off') return false
        if (classF !== 'all' && p.importMeta?.projectClass?.toLowerCase() !== classF) return false
        return true
      })
      .sort((a, b) => {
        const dir = sortAsc ? 1 : -1
        switch (sortKey) {
          case 'name': return dir * a.p.name.localeCompare(b.p.name)
          case 'deadline': return dir * (a.p.end || '9999').localeCompare(b.p.end || '9999')
          case 'status': return dir * (STATUS_ORDER.indexOf(a.p.status) - STATUS_ORDER.indexOf(b.p.status))
          case 'health': return dir * (HEALTH_ORDER.indexOf(a.health) - HEALTH_ORDER.indexOf(b.health))
          case 'progress': return dir * ((a.progress ?? -1) - (b.progress ?? -1))
          default: return dir * ((a.l?.createdAt ?? a.p.lastReportAt ?? '').localeCompare(b.l?.createdAt ?? b.p.lastReportAt ?? ''))
        }
      })
  }, [projects, latest, query, statusF, healthF, pmF, flagF, classF, sortKey, sortAsc, today])

  // Reset to page 1 whenever the result set changes
  useEffect(() => setPage(0), [query, statusF, healthF, pmF, flagF, classF, sortKey, sortAsc])

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(key === 'deadline' || key === 'status' || key === 'health' || key === 'name') }
  }

  const Th = ({ label, k, className = '' }: { label: string; k?: SortKey; className?: string }) => (
    <th
      className={`border-b border-line px-3 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wider text-[#999d9a] ${k ? 'cursor-pointer select-none hover:text-ink' : ''} ${className}`}
      onClick={k ? () => toggleSort(k) : undefined}
    >
      {label}{k && sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <Card className="flex h-full min-h-[640px] flex-col">
      <CardTitle
        title="Latest project status"
        subtitle="Live reporting across the portfolio"
        action={
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-green">
              <i className="h-[6px] w-[6px] rounded-full bg-green" style={{ animation: 'live-dot 2s ease-in-out infinite' }} />
              Live
            </span>
            <TextButton onClick={resetFilters}>All projects →</TextButton>
          </span>
        }
      />
      {(() => {
        const newCount = projects.filter((p) => p.importMeta?.projectClass?.toLowerCase() === 'new').length
        const oldCount = projects.filter((p) => p.importMeta?.projectClass?.toLowerCase() === 'old').length
        const section = (key: 'all' | 'new' | 'old', label: string, count: number) => (
          <button
            key={key}
            onClick={() => setClassF(key)}
            className={`relative rounded-lg px-4 py-2 text-[11px] font-semibold transition-all duration-300 ${
              classF === key ? 'bg-ink text-white shadow-md' : 'text-muted hover:text-ink'
            }`}
          >
            {label}
            <span className={`ml-1.5 rounded-full px-1.5 py-px text-[9px] ${classF === key ? 'bg-white/20 text-white' : 'bg-[#f0f0ed] text-muted'}`}>
              {count}
            </span>
          </button>
        )
        return newCount + oldCount > 0 ? (
          <div className="mb-3 inline-flex items-center gap-1 rounded-xl border border-line bg-[#f4f4f1] p-1">
            {section('all', 'All', newCount + oldCount)}
            {section('new', 'New', newCount)}
            {section('old', 'Old', oldCount)}
          </div>
        ) : null
      })()}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex h-[32px] flex-1 items-center gap-2 rounded-lg border border-line bg-white px-3 text-muted sm:min-w-[200px] sm:max-w-[260px]">
          <Search size={13} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search project or client…" className="w-full bg-transparent text-[11px] text-ink outline-none placeholder:text-[#aaa]" />
        </div>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)} className="h-[32px] rounded-lg border border-line bg-white px-2 text-[11px] text-ink outline-none">
          <option value="All">All statuses</option>
          {STATUS_ORDER.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={healthF} onChange={(e) => setHealthF(e.target.value as typeof healthF)} className="h-[32px] rounded-lg border border-line bg-white px-2 text-[11px] text-ink outline-none">
          <option value="All">All health</option>
          {HEALTH_ORDER.map((h) => <option key={h}>{h}</option>)}
        </select>
        {pms.length > 0 && (
          <select value={pmF} onChange={(e) => setPmF(e.target.value)} className="h-[32px] rounded-lg border border-line bg-white px-2 text-[11px] text-ink outline-none">
            <option value="All">All managers</option>
            {pms.map((m) => <option key={m}>{m}</option>)}
          </select>
        )}
        <select value={flagF} onChange={(e) => setFlagF(e.target.value as typeof flagF)} className="h-[32px] rounded-lg border border-line bg-white px-2 text-[11px] text-ink outline-none">
          <option value="All">All projects</option>
          <option value="overdue">Overdue deadline</option>
          <option value="stale">Not updated in 7 days</option>
          <option value="unreported">Awaiting first update</option>
          <option value="active">Active (open)</option>
          <option value="closed">Closed</option>
          <option value="new">New projects</option>
          <option value="old">Old projects</option>
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-line">
        <table className="w-full min-w-[1080px] border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <Th label="Project" k="name" />
              <Th label="Status" k="status" />
              <Th label="Progress" k="progress" />
              <Th label="Health" k="health" />
              <Th label="Last report summary" />
              <Th label="Deadline" k="deadline" />
              <Th label="Actions" className="text-center" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-[12px] text-muted">No projects match the current filters.</td></tr>
            )}
            {pageRows.map(({ p, l, health, summary, progress }, i) => {
              const overdue = isOverdue(p, today)
              return (
                <tr key={p.id} className={`page-enter transition hover:bg-[#fafaf8] ${overdue ? 'bg-red/5' : ''}`} style={{ animationDelay: `${Math.min(i, 14) * 35}ms` }}>
                  <td className="border-b border-[#efefeb] px-3 py-3">
                    <button onClick={() => navigate(`/projects/${p.id}`)} className="text-left text-[12px] font-semibold text-ink hover:underline">{p.name}</button>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      {p.importMeta?.projectClass && (
                        <span className={`rounded px-1 py-px text-[8px] font-semibold uppercase tracking-wide ${p.importMeta.projectClass.toLowerCase() === 'new' ? 'bg-[#e0e7ff] text-[#4338ca]' : 'bg-[#f0f0ed] text-[#666a67]'}`}>
                          {p.importMeta.projectClass}
                        </span>
                      )}
                      {overdue && <span className="text-[9px] font-semibold uppercase tracking-wide text-red">Overdue</span>}
                    </span>
                  </td>
                  <td className="border-b border-[#efefeb] px-3 py-3"><Badge tone={statusTone[p.status]} className="px-2 py-0.5 text-[10px]">{p.status}</Badge></td>
                  <td className="border-b border-[#efefeb] px-3 py-3">
                    {progress === null ? (
                      <span className="text-[10px] italic text-muted">Not reported</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="w-7 text-[11px] font-semibold text-ink">{progress}%</span>
                        <ProgressBar value={progress} className="h-[6px] w-[70px]" />
                      </div>
                    )}
                  </td>
                  <td className="border-b border-[#efefeb] px-3 py-3">
                    <Badge tone={healthTone[health]} className="px-2 py-0.5 text-[10px]">{health}</Badge>
                    {p.healthOverride && <p className="mt-0.5 text-[8px] text-muted">manual</p>}
                  </td>
                  <td className="max-w-[220px] border-b border-[#efefeb] px-3 py-3">
                    {l ? (
                      <div className="space-y-0.5 text-[10px]">
                        <p className="truncate text-ink" title={summary}>{summary || '—'}</p>
                        {l.pendingWork?.trim() && <p className="truncate text-muted" title={l.pendingWork}>Pending: {l.pendingWork}</p>}
                        {l.blockers?.trim() && <p className="truncate font-medium text-red" title={l.blockers}>Blocked: {l.blockers}</p>}
                      </div>
                    ) : p.notes?.trim() && p.notes.trim().toLowerCase() !== 'na' ? (
                      <div className="space-y-0.5 text-[10px]">
                        <p className="truncate text-ink" title={p.notes.trim()}>{p.notes.trim()}</p>
                        <p className="text-[8px] font-semibold uppercase tracking-wide text-muted">Imported comment</p>
                      </div>
                    ) : <span className="text-[10px] text-muted">—</span>}
                  </td>
                  <td className={`border-b border-[#efefeb] px-3 py-3 text-[11px] ${overdue ? 'font-semibold text-red' : 'text-muted'}`}>{p.end || '—'}</td>
                  <td className="border-b border-[#efefeb] px-3 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => navigate(`/projects/${p.id}`)} className="grid h-6 w-6 place-items-center rounded-md border border-line bg-white text-muted transition hover:bg-[#f0f1ed] hover:text-ink" title="View project"><Eye size={12} /></button>
                      <button onClick={() => setUpdateTarget(p)} className="grid h-6 w-6 place-items-center rounded-md border border-line bg-white text-muted transition hover:bg-[#f0f1ed] hover:text-ink" title="Add status update"><FileText size={12} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {updateTarget && (
        <StatusUpdateModal
          project={updateTarget}
          onClose={() => setUpdateTarget(null)}
        />
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-muted">
          Showing {pageRows.length ? safePage * PAGE_SIZE + 1 : 0}–{safePage * PAGE_SIZE + pageRows.length} of {rows.length} projects · sorted by {sortKey} {sortAsc ? 'ascending' : 'descending'}
        </p>
        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(safePage - 1)}
              disabled={safePage === 0}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-[#f4f4f1] disabled:opacity-40"
            >
              ← Prev
            </button>
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`h-7 min-w-7 rounded-lg px-2 text-[11px] font-semibold transition ${
                  i === safePage ? 'bg-ink text-white' : 'border border-line bg-white text-muted hover:text-ink'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage(safePage + 1)}
              disabled={safePage >= pageCount - 1}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-[#f4f4f1] disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

export function Dashboard() {
  const { projects, tasks, team, activity, statusUpdates } = useApp()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [weeklyOpen, setWeeklyOpen] = useState(false)
  const [tablePatch, setTablePatch] = useState<TablePatch | null>(null)

  // Filter the status table in place + bring it into view — no page navigation
  const patchTable = (p: Partial<TablePatch> = {}) => {
    setTablePatch({ ts: Date.now(), ...p })
    requestAnimationFrame(() => {
      document.getElementById('status-table-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
  const [, setPulse] = useState(0)
  const [greeting] = useState(() => {
    if (typeof window === 'undefined') return GREETINGS[0]
    const stored = window.localStorage.getItem('nexora-greeting')
    const idx = stored ? Number(stored) : Number.NaN
    if (Number.isInteger(idx) && idx >= 0 && idx < GREETINGS.length) return GREETINGS[idx]
    const nextIdx = Math.floor(Math.random() * GREETINGS.length)
    window.localStorage.setItem('nexora-greeting', String(nextIdx))
    return GREETINGS[nextIdx]
  })

  useEffect(() => {
    const id = window.setInterval(() => setPulse((p) => p + 1), 30000)
    return () => window.clearInterval(id)
  }, [])

  const today = todayKey()
  const metrics = useMemo(() => portfolioMetrics(projects, statusUpdates, today), [projects, statusUpdates, today])
  const pulseData = useMemo(() => weeklyPulse(projects, statusUpdates, today), [projects, statusUpdates, today])
  const latest = useMemo(() => latestUpdateMap(statusUpdates), [statusUpdates])

  const statusData = useMemo(() => {
    const counts: Record<ProjectStatus, number> = { Planning: 0, 'In Progress': 0, 'On Hold': 0, Completed: 0, 'At Risk': 0, 'Backed Off': 0 }
    projects.forEach((p) => { counts[p.status] = (counts[p.status] ?? 0) + 1 })
    return [
      { name: 'In progress', value: counts['In Progress'], color: '#0d1538' },
      { name: 'Completed', value: counts.Completed, color: '#1d2f7c' },
      { name: 'Planning', value: counts.Planning, color: '#2f4bd8' },
      { name: 'On hold', value: counts['On Hold'], color: '#5a76e8' },
      { name: 'At risk', value: counts['At Risk'], color: '#93a6dd' },
      { name: 'Backed off', value: counts['Backed Off'], color: '#d4d9e8' },
    ]
  }, [projects])

  // Weekly digest — all live activity (reports, edits, imports…) + blockers per day
  const digest = useMemo(() => {
    const days: { label: string; reports: number; blockers: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = dateKey(d)
      const dayUpdates = statusUpdates.filter((u) => u.createdAt.slice(0, 10) === key)
      // every status update also logs an activity item — count activity events
      // then re-add updates so reports made before the feed captured them still show
      const events = activity.filter((a) => a.at?.slice(0, 10) === key).length
      days.push({
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        reports: Math.max(events, dayUpdates.length),
        blockers: dayUpdates.filter((u) => u.blockers?.trim()).length,
      })
    }
    return days
  }, [statusUpdates, activity])

  // Overall completion — "closed" = Completed + Backed Off; everything else is open
  const completion = useMemo(() => {
    const closed = projects.filter((p) => p.status === 'Completed' || p.status === 'Backed Off').length
    const open = metrics.total - closed
    const pct = metrics.total ? Math.round((closed / metrics.total) * 100) : 0
    return { closed, open, pct }
  }, [projects, metrics.total])

  // Portfolio date range for the header card
  const range = useMemo(() => {
    const starts = projects.map((p) => p.start).filter(Boolean).sort()
    const ends = projects.map((p) => p.end).filter(Boolean).sort()
    const latestEnd = ends[ends.length - 1] ?? ''
    const daysLeft = latestEnd ? Math.max(0, Math.round((new Date(latestEnd).getTime() - new Date(today).getTime()) / 86400000)) : null
    return { firstStart: starts[0] ?? '—', latestEnd: latestEnd || '—', daysLeft }
  }, [projects, today])

  const classData = useMemo(() => {
    const n = projects.filter((p) => p.importMeta?.projectClass?.toLowerCase() === 'new').length
    const o = projects.filter((p) => p.importMeta?.projectClass?.toLowerCase() === 'old').length
    return [
      { name: 'New projects', value: n, color: '#2f4bd8' },
      { name: 'Old projects', value: o, color: '#0d1538' },
    ]
  }, [projects])

  const workloadData = useMemo(() => {
    const palette = ['#9c4a68', '#e85d75', '#f09a6b', '#f5dd92']
    return team.slice(0, 4).map((m, i) => ({
      name: m.name,
      role: m.role,
      gender: m.gender,
      utilized: m.utilized,
      capacity: m.capacity,
      value: m.capacity > 0 ? Math.round((m.utilized / m.capacity) * 100) : 0,
      fill: palette[i % palette.length],
    }))
  }, [team])

  const avgUtilization = workloadData.length
    ? Math.round(workloadData.reduce((sum, w) => sum + w.value, 0) / workloadData.length)
    : 0

  const renderStatusSliceLabel = (props: {
    cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number; value?: number
  }) => {
    const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0, value = 0 } = props
    if (!value || percent <= 0.02) return null
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={percent < 0.06 ? 9 : 13} fontWeight={700} fill="#ffffff" pointerEvents="none">
        {`${Math.round(percent * 100)}%`}
      </text>
    )
  }

  const alerts = useMemo(() => {
    const list: { title: string; detail: string; tone: 'red' | 'amber' | 'neutral'; patch: Partial<TablePatch> }[] = []
    for (const p of projects) {
      const l = latest.get(p.id)
      if (isOverdue(p, today)) list.push({ title: `${p.name} is overdue`, detail: `Deadline passed ${p.end}`, tone: 'red', patch: { query: p.name } })
      else if (p.status === 'At Risk') list.push({ title: `${p.name} is at risk`, detail: l?.blockers?.trim() || 'Marked At Risk in the latest report', tone: 'red', patch: { query: p.name } })
      else if (l?.blockerSeverity === 'critical' && l.blockers?.trim()) list.push({ title: `Critical blocker on ${p.name}`, detail: l.blockers.trim(), tone: 'red', patch: { query: p.name } })
      else if (l?.blockers?.trim()) list.push({ title: `Blocker on ${p.name}`, detail: l.blockers.trim(), tone: 'amber', patch: { query: p.name } })
    }
    const staleCount = pulseData.stale.length
    if (staleCount) list.push({ title: `${staleCount} project${staleCount > 1 ? 's' : ''} not updated in 7+ days`, detail: 'Send a status update to keep reporting live', tone: 'neutral', patch: { flagF: 'stale' } })
    return list.slice(0, 5)
  }, [projects, latest, today, pulseData])

  return (
    <>
      <style>{LIVE_STYLES}</style>
      <div className="w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#929692]">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' })}
          </p>
          <h1 className="font-heading text-[28px] font-semibold leading-[1.2] tracking-tight text-ink">{greeting.text} {greeting.emoji}</h1>
          <p className="mt-2 text-[13px] text-muted">Here’s what needs your attention today.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <span className="flex items-center gap-1.5"><Plus size={14} /> New Project</span>
        </Button>
      </div>

      {/* Portfolio summary — clickable metric cards */}
      {/* Reference-style top block */}
      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          {/* Portfolio header card */}
          <Card className="page-enter">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#0f8ba0] text-white">
                  <FolderKanban size={20} strokeWidth={1.8} />
                </span>
                <div>
                  <p className="font-heading text-[17px] font-semibold text-ink">NexORA Portfolio</p>
                  <p className="text-[10px] text-muted">Owner : {CURRENT_USER}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ['Earliest onboarding', range.firstStart],
                  ['Latest deadline', range.latestEnd],
                  ['Days to latest deadline', range.daysLeft === null ? '—' : `${range.daysLeft} Days`],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-[110px] rounded-lg border border-line text-center">
                    <p className="border-b border-line px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted">{label}</p>
                    <p className="bg-[#0f8ba0] px-2 py-2 text-[12px] font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Weekly digest */}
          <Card className="page-enter" style={{ animationDelay: '80ms' }}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-heading text-[15px] font-semibold text-ink">Weekly digest</p>
                <p className="text-[10px] text-muted">Portfolio activity and blockers per day · {digest[0].label} → {digest[6].label}</p>
              </div>
            </div>
            <div className="mb-1 overflow-x-auto">
              <div className="grid min-w-[480px] grid-cols-7 gap-1">
                {digest.map((d) => (
                  <div key={d.label} className="rounded-lg border border-line px-1.5 py-1.5 text-center">
                    <p className="text-[9px] font-medium text-muted">{d.label}</p>
                    <p className="mt-0.5 text-[13px] font-bold text-ink">{d.reports},{d.blockers}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-[130px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={digest} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <Tooltip
                    contentStyle={{ background: '#252829', border: 'none', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#fff', fontWeight: 600 }}
                    itemStyle={{ color: '#d4d7d2' }}
                    formatter={(v: number, name: string) => [v, name === 'reports' ? 'Activity' : 'Blockers']}
                  />
                  <Area type="monotone" dataKey="reports" stackId="1" stroke="#2f4bd8" fill="#2f4bd8" fillOpacity={0.85} isAnimationActive animationDuration={900} />
                  <Area type="monotone" dataKey="blockers" stackId="1" stroke="#f0b429" fill="#f0b429" fillOpacity={0.85} isAnimationActive animationDuration={900} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex items-center gap-4 text-[10px] text-muted">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#2f4bd8]" /> Activity</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#f0b429]" /> Blockers</span>
            </div>
          </Card>
        </div>

        {/* Overall completion */}
        <Card className="page-enter flex min-w-0 flex-col" style={{ animationDelay: '140ms' }}>
          <div>
            <p className="font-heading text-[15px] font-semibold text-ink">Overall completion</p>
            <p className="text-[10px] text-muted">Open vs closed projects</p>
          </div>
          <div className="relative mx-auto mt-2 h-[190px] w-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{ name: 'track', value: 1 }]} dataKey="value" innerRadius={68} outerRadius={88} fill="#f1f2ee" stroke="none" isAnimationActive={false} />
                <Pie
                  data={[
                    { name: 'Closed', value: Math.max(completion.closed, 0.0001), color: '#e85d75' },
                    { name: 'Open', value: Math.max(completion.open, 0.0001), color: '#eef0ec' },
                  ]}
                  dataKey="value"
                  innerRadius={60}
                  outerRadius={78}
                  paddingAngle={2}
                  cornerRadius={9}
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive
                  stroke="none"
                >
                  <Cell fill="#e85d75" stroke="none" />
                  <Cell fill="#eef0ec" stroke="none" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
              <strong className="font-heading text-[26px] font-semibold leading-none text-ink">{metrics.total}</strong>
              <span className="mt-1 text-[8px] font-semibold uppercase tracking-widest text-muted">total</span>
            </div>
          </div>
          <div className="mt-1 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]"><span className="flex items-center gap-2 text-ink"><i className="h-2 w-2 rounded-full bg-[#e85d75]" />Closed</span><b className="text-ink">{metrics.total ? Math.round((completion.closed / metrics.total) * 100) : 0}%</b></div>
            <div className="flex items-center justify-between text-[11px]"><span className="flex items-center gap-2 text-muted"><i className="h-2 w-2 rounded-full bg-[#dfe3de]" />Open</span><b className="text-muted">{metrics.total ? Math.round((completion.open / metrics.total) * 100) : 0}%</b></div>
          </div>
          <div className="mt-auto grid grid-cols-3 gap-2 pt-3">
            {[
              { label: 'New', value: classData[0].value, tone: 'bg-[#e8f4f6] text-[#0f8ba0]', patch: { classF: 'new' } as Partial<TablePatch> },
              { label: 'Old', value: classData[1].value, tone: 'bg-[#eef0fb] text-[#2f4bd8]', patch: { classF: 'old' } as Partial<TablePatch> },
              { label: 'Overdue', value: metrics.overdue, tone: 'bg-[#fbeaea] text-red', patch: { flagF: 'overdue' } as Partial<TablePatch> },
            ].map((t) => (
              <button key={t.label} onClick={() => patchTable(t.patch)} className={`rounded-lg px-2 py-2 text-center transition hover:scale-[1.04] ${t.tone}`}>
                <p className="text-[16px] font-bold leading-none">{t.value}</p>
                <p className="mt-1 text-[8px] font-semibold uppercase tracking-wider">{t.label}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 2 — removed per user request (number tiles + status mix were unused) */}

      {/* Weekly pulse — computed from real update history */}
      <div className="relative mb-4 overflow-hidden rounded-card bg-ink px-6 py-5 text-white">
        <span
          className="pointer-events-none absolute top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
          style={{ animation: 'shine-sweep 5.5s ease-in-out infinite' }}
        />
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]" preserveAspectRatio="none" viewBox="0 0 600 120">
          <path d="M0 80 C70 60 100 100 150 80 S220 40 270 70 S340 100 390 60 S470 30 520 70 S570 90 600 60" fill="none" stroke="#fff" strokeWidth="1" />
          <path d="M0 100 C80 90 120 110 180 95 S260 75 320 95 S400 110 460 85 S540 70 600 90" fill="none" stroke="#fff" strokeWidth="1" />
        </svg>
        <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="w-full sm:w-auto">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#aeb3af]">Weekly pulse</p>
            <h2 className="font-heading text-[20px] font-medium">
              {metrics.total === 0 ? 'No projects yet.' : metrics.neverReported === metrics.total ? 'Awaiting first status reports.' : 'Your portfolio is moving forward.'}
            </h2>
            <p className="mt-2 text-[12px] text-[#b3b6b4]">
              {pulseData.completedThisWeek.length} completed this week · {pulseData.improved.length} progressed · {pulseData.newBlockers.length} new blocker{pulseData.newBlockers.length === 1 ? '' : 's'} · {pulseData.upcomingDeadlines.length} deadline{pulseData.upcomingDeadlines.length === 1 ? '' : 's'} in 14 days · {pulseData.needsAttention.length} need{pulseData.needsAttention.length === 1 ? 's' : ''} attention
            </p>
          </div>
          <Button className="w-full rounded-full !bg-white px-5 py-2.5 text-[13px] font-medium !text-ink hover:!bg-[#f0f0ed] sm:w-auto" onClick={() => setWeeklyOpen(true)}>
            <span className="flex items-center gap-2">View weekly report <span className="text-[14px] leading-none">→</span></span>
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardTitle title="Project status" subtitle="Latest reported status" />
          <div className="flex h-auto flex-col items-center gap-6 sm:h-[200px] sm:flex-row">
            <div className="relative h-[190px] w-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData.filter((s) => s.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={0}
                    outerRadius={90}
                    paddingAngle={0}
                    startAngle={90}
                    endAngle={-270}
                    isAnimationActive
                    label={renderStatusSliceLabel}
                    labelLine={false}
                    onClick={(d) => {
                      const map: Record<string, ProjectStatus> = {
                        'In progress': 'In Progress', Planning: 'Planning', Completed: 'Completed',
                        'On hold': 'On Hold', 'At risk': 'At Risk', 'Backed off': 'Backed Off',
                      }
                      const s = map[d?.name]
                      if (s) patchTable({ statusF: s })
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="#ffffff" strokeWidth={1.5} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {statusData.map((status) => (
                <button
                  key={status.name}
                  onClick={() => {
                    const map: Record<string, ProjectStatus> = {
                      'In progress': 'In Progress', Planning: 'Planning', Completed: 'Completed',
                      'On hold': 'On Hold', 'At risk': 'At Risk', 'Backed off': 'Backed Off',
                    }
                    const s = map[status.name]
                    if (s) patchTable({ statusF: s })
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-[11px] transition hover:bg-[#f4f4f1]"
                >
                  <span className="flex items-center gap-2 text-ink">
                    <i className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: status.color }} />
                    {status.name}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted">{metrics.total ? Math.round((status.value / metrics.total) * 100) : 0}%</span>
                    <b className="w-5 text-right text-ink">{status.value}</b>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle title="New vs Old" subtitle="Imported project classification" />
          <div className="flex h-auto flex-col items-center gap-6 sm:h-[200px] sm:flex-row">
            <div className="relative h-[190px] w-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={classData.filter((s) => s.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={0}
                    outerRadius={90}
                    paddingAngle={0}
                    startAngle={90}
                    endAngle={-270}
                    isAnimationActive
                    label={renderStatusSliceLabel}
                    labelLine={false}
                    onClick={(d) => {
                      const c = d?.name === 'New projects' ? 'new' : d?.name === 'Old projects' ? 'old' : null
                      if (c) patchTable({ classF: c })
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {classData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="#ffffff" strokeWidth={1.5} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {classData.map((entry) => (
                <button
                  key={entry.name}
                  onClick={() => patchTable({ classF: entry.name === 'New projects' ? 'new' : 'old' })}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-[11px] transition hover:bg-[#f4f4f1]"
                >
                  <span className="flex items-center gap-2 text-ink">
                    <i className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: entry.color }} />
                    {entry.name}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted">{metrics.total ? Math.round((entry.value / metrics.total) * 100) : 0}%</span>
                    <b className="w-5 text-right text-ink">{entry.value}</b>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle title="Project health" subtitle="Auto-computed · manager overrides respected" />
          <div className="space-y-2.5">
            {HEALTH_ORDER.map((h) => {
              const list = projects.filter((p) => effectiveHealth(p, latest.get(p.id), today) === h)
              return (
                <button key={h} onClick={() => patchTable({ healthF: h })} className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2.5 text-left transition hover:bg-[#fafaf8]">
                  <span className="flex items-center gap-2 text-[12px] font-medium text-ink"><Badge tone={healthTone[h]}>{h}</Badge></span>
                  <span className="text-[11px] text-muted">{list.length} project{list.length === 1 ? '' : 's'}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-[9px] leading-relaxed text-muted">
            Red = overdue deadline, At Risk status, or critical blocker · Amber = blockers/risks recorded, On Hold, or stale report · Green = otherwise.
          </p>
        </Card>

        <Card>
          <CardTitle
            title="Team workload"
            subtitle="This week's utilization"
            action={<TextButton onClick={() => navigate('/team')}>View team →</TextButton>}
          />
          {workloadData.length === 0 ? (
            <p className="py-10 text-center text-[11px] text-muted">Add team members to see workload.</p>
          ) : (
            <div className="flex h-auto flex-col items-center gap-4 sm:h-[190px] sm:flex-row">
              <div className="relative h-[170px] w-[170px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart cx="50%" cy="50%" innerRadius="42%" outerRadius="98%" barSize={8} data={workloadData} startAngle={90} endAngle={-270}>
                    <RadialBar dataKey="value" cornerRadius={10} background={{ fill: '#efefeb' }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                  <strong className="font-heading text-[18px] font-semibold text-ink">{avgUtilization}%</strong>
                  <span className="text-[8px] uppercase tracking-wider text-muted">team avg</span>
                </div>
              </div>
              <div className="flex w-full flex-1 flex-col justify-center gap-3">
                {workloadData.map((member) => (
                  <div key={member.name} className="flex items-center gap-2.5">
                    <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: member.fill }} />
                    <Avatar
                      name={member.name}
                      src={avatarUrl(member.name, member.gender)}
                      className="h-7 w-7 shrink-0 bg-ink text-[9px] text-white"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium leading-tight text-ink">{member.name}</p>
                      <p className="text-[10px] leading-tight text-muted">{member.utilized}h of {member.capacity}h · {member.role}</p>
                    </div>
                    <div className="flex w-16 shrink-0 flex-col items-end gap-1 sm:w-20">
                      <b className="text-[12px] font-semibold leading-tight text-ink">{member.value}%</b>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-[#efefeb]">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, member.value)}%`, background: member.fill }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>


      {/* The reporting table — most important section */}
      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4">
        <Card className="flex flex-1 flex-col">
          <CardTitle
            title="Important alerts"
            subtitle="Requires your attention"
            action={<TextButton onClick={() => patchTable()}>See all →</TextButton>}
          />
          <div className="mt-2 min-h-0 flex-1 space-y-2.5 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-muted sm:col-span-2">No alerts right now</p>
            ) : (
              alerts.map((alert, i) => {
                const severity = alert.tone === 'red' ? 'Critical' : alert.tone === 'amber' ? 'Warning' : 'Info'
                const Icon = alert.tone === 'neutral' ? Activity : AlertTriangle
                const stripClass = alert.tone === 'red' ? 'bg-[#ef4444]' : alert.tone === 'amber' ? 'bg-[#f0b429]' : 'bg-[#6366f1]'
                const iconClass =
                  alert.tone === 'red'
                    ? 'bg-[#fee2e2] text-[#dc2626]'
                    : alert.tone === 'amber'
                      ? 'bg-[#fef3c7] text-[#b45309]'
                      : 'bg-[#e0e7ff] text-[#4f46e5]'
                const pillClass =
                  alert.tone === 'red'
                    ? 'bg-[#fee2e2] text-[#b91c1c]'
                    : alert.tone === 'amber'
                      ? 'bg-[#fef3c7] text-[#92400e]'
                      : 'bg-[#e0e7ff] text-[#4338ca]'
                return (
                  <div
                    key={alert.title}
                    onClick={() => patchTable(alert.patch)}
                    className="page-enter group flex cursor-pointer items-stretch overflow-hidden rounded-xl border border-line bg-white shadow-sm transition hover:shadow-md"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <span className={`w-1 shrink-0 ${stripClass}`} />
                    <span className={`mx-3 my-3 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${iconClass}`}>
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0 flex-1 self-center py-2.5">
                      <div className="flex items-center gap-2">
                        <b className="truncate text-[12px] font-semibold text-ink">{alert.title}</b>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${pillClass}`}>
                          {severity}
                        </span>
                      </div>
                      <span className="mt-0.5 block truncate text-[10px] text-muted">{alert.detail}</span>
                    </div>
                    <ChevronRight size={15} className="mr-3 shrink-0 self-center text-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </div>
                )
              })
            )}
          </div>
        </Card>

        <Card className="flex flex-1 flex-col">
          <CardTitle title="Reporting feed" subtitle="Latest project events" action={<TextButton onClick={() => setHistoryOpen(true)}>View history →</TextButton>} />
          {activity.length === 0 && <p className="py-6 text-center text-[12px] text-muted">No activity yet — status reports will appear here as you work.</p>}
          <ul className="mt-1 min-h-0 flex-1 overflow-y-auto pr-1">
            {activity.slice(0, 5).map((item, i) => {
              const tone = activityTone(item.type)
              return (
                <li
                  key={item.id}
                  className={`page-enter relative flex items-start gap-3 pb-4 text-[12px] last:pb-0 ${item.project ? 'cursor-pointer rounded-lg px-1 -mx-1 transition hover:bg-[#fafaf8]' : ''}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                  onClick={item.project ? () => patchTable({ query: item.project }) : undefined}
                >
                  {i < activity.slice(0, 5).length - 1 && (
                    <span className="absolute left-4 top-9 h-[calc(100%-36px)] w-px -translate-x-1/2 bg-[#ececea]" />
                  )}
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone.icon}`}>
                    {getActivityIcon(item.type)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <b className="truncate font-semibold text-ink">{item.message}</b>
                      <span className={`shrink-0 rounded-full px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide ${tone.pill}`}>
                        {tone.label}
                      </span>
                    </span>
                    <span className="mt-1 block text-[11px] text-muted">
                      {item.project}{item.author ? ` · ${item.author}` : ''} · {item.at ? relTime(item.at) : item.time}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
        </div>
        <div className="flex min-w-0 flex-col xl:col-span-2" id="status-table-section">
          <StatusTable projects={projects} updates={statusUpdates} patch={tablePatch} />
        </div>
      </div>


      {modalOpen && <ProjectModal open onClose={() => setModalOpen(false)} />}

      <Modal open={weeklyOpen} title="Weekly project key points" onClose={() => setWeeklyOpen(false)} footer={<Button variant="secondary" onClick={() => setWeeklyOpen(false)}>Close</Button>}>
        <WeeklyKeyPoints projects={projects} tasks={tasks} navigate={navigate} />
      </Modal>

      <Modal open={historyOpen} title="Activity history" onClose={() => setHistoryOpen(false)}>
        <ul className="max-h-[55vh] space-y-0 overflow-y-auto pr-1">
          {activity.map((item, i) => {
            const tone = activityTone(item.type)
            return (
              <li key={item.id} className="relative flex items-start gap-3 pb-4 text-[12px] last:pb-0">
                {i < activity.length - 1 && (
                  <span className="absolute left-4 top-9 h-[calc(100%-36px)] w-px -translate-x-1/2 bg-[#ececea]" />
                )}
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone.icon}`}>
                  {getActivityIcon(item.type)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <b className="truncate font-semibold text-ink">{item.message}</b>
                    <span className={`shrink-0 rounded-full px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide ${tone.pill}`}>
                      {tone.label}
                    </span>
                  </span>
                  <span className="mt-1 block text-[11px] text-muted">
                    {item.project}{item.author ? ` · ${item.author}` : ''} · {item.at ? new Date(item.at).toLocaleString() : item.time}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </Modal>
    </div>
    </>
  )
}
