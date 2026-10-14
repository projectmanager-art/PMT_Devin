import { useEffect, useMemo, useState, type ElementType } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Activity, AlertCircle, AlertTriangle, ArrowUpRight, Eye, FileCheck, FolderKanban, MessageSquare, MoreHorizontal, Plus, TrendingUp, User, Video } from 'lucide-react'
import { useApp, type Project, type ProjectStatus, type TeamMember } from '../store'
import { Badge, Button, Card, CardTitle, ProgressBar, TextButton, Avatar, avatarUrl } from '../components/ui'
import { ProjectModal } from '../components/ProjectModal'
import { GREETINGS } from '../lib/greetings'

const statusTone: Record<ProjectStatus, 'green' | 'amber' | 'red' | 'blue' | 'neutral'> = {
  Planning: 'blue',
  'In Progress': 'blue',
  'On Hold': 'amber',
  Completed: 'green',
}

const healthTone = { Green: 'green', Amber: 'amber', Red: 'red' } as const

const LIVE_STYLES = `
@keyframes icon-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes icon-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.85; }
}
@keyframes icon-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes icon-shake {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(-10deg); }
  75% { transform: rotate(10deg); }
}
@keyframes number-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.08); }
  100% { transform: scale(1); }
}
`

function getActivityIcon(type: string) {
  const icons: Record<string, ElementType> = {
    task: FileCheck,
    comment: MessageSquare,
    status: ArrowUpRight,
    risk: AlertTriangle,
    meeting: Video,
  }
  const Icon = icons[type] ?? ArrowUpRight
  return <Icon size={15} strokeWidth={1.5} />
}

function ProgressRing({ value }: { value: number }) {
  const r = 18
  const c = 2 * Math.PI * r
  const offset = c - (value / 100) * c
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
      <circle cx="24" cy="24" r={r} stroke="#e2e8f0" strokeWidth="6" fill="transparent" />
      <circle
        cx="24"
        cy="24"
        r={r}
        stroke="#2b6cb0"
        strokeWidth="6"
        fill="transparent"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  )
}

function RecentProjectsCard({ projects, team }: { projects: Project[]; team: TeamMember[] }) {
  const navigate = useNavigate()
  return (
    <Card className="lg:col-span-2">
      <CardTitle
        title="Recent projects"
        subtitle="Your latest active work"
        action={<TextButton onClick={() => navigate('/projects')}>View all projects →</TextButton>}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr>
              {['Project', 'Client', 'PM', 'Status', 'Progress', 'Deadline', 'Health', 'Actions'].map((header) => (
                <th key={header} className="border-b border-line px-3 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wider text-[#999d9a]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.slice(0, 3).map((project) => (
              <tr key={project.id} className="transition hover:bg-[#fafaf8]">
                <td className="border-b border-[#efefeb] px-3 py-3 text-[13px] font-semibold text-ink">{project.name}</td>
                <td className="border-b border-[#efefeb] px-3 py-3 text-[11px] text-muted">{project.client}</td>
                <td className="border-b border-[#efefeb] px-3 py-3">
                  {(() => {
                    const manager = team.find((m) => m.name === project.manager)
                    return (
                      <div className="flex items-center gap-2 text-[11px] font-medium text-ink">
                        <Avatar
                          name={project.manager}
                          src={avatarUrl(project.manager, manager?.gender)}
                          className="h-6 w-6 bg-ink text-[9px] text-white"
                        />
                        {project.manager}
                      </div>
                    )
                  })()}
                </td>
                <td className="border-b border-[#efefeb] px-3 py-3"><Badge tone={statusTone[project.status]} className="px-2.5 py-1 text-[11px]">{project.status}</Badge></td>
                <td className="border-b border-[#efefeb] px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[12px] font-semibold text-ink">{project.progress}%</span>
                    <ProgressBar value={project.progress} className="h-[7px] w-[80px]" />
                  </div>
                </td>
                <td className="border-b border-[#efefeb] px-3 py-3 text-[11px] text-muted">{project.end}</td>
                <td className="border-b border-[#efefeb] px-3 py-3"><Badge tone={healthTone[project.health]} className="px-2.5 py-1 text-[11px]">{project.health}</Badge></td>
                <td className="border-b border-[#efefeb] px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="grid h-6 w-6 place-items-center rounded-md border border-line bg-white text-muted transition hover:bg-[#f0f1ed] hover:text-ink"
                      title="Open project"
                    >
                      <Eye size={12} />
                    </button>
                    <button
                      className="grid h-6 w-6 place-items-center rounded-md border border-line bg-white text-muted transition hover:bg-[#f0f1ed] hover:text-ink"
                      title="More actions"
                    >
                      <MoreHorizontal size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function Dashboard() {
  const { projects, tasks, team, activity } = useApp()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [pulse, setPulse] = useState(0)
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

  const kpis = useMemo(() => {
    const total = projects.length
    const active = projects.filter((p) => p.status === 'In Progress').length
    const completed = projects.filter((p) => p.status === 'Completed').length
    const onHold = projects.filter((p) => p.status === 'On Hold').length
    const overdue = tasks.filter((t) => t.status !== 'Completed' && t.due < new Date().toISOString().slice(0, 10)).length
    const avgProgress = total ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / total) : 0
    return { total, active, completed, onHold, overdue, avgProgress }
  }, [projects, tasks])

  const statusData = useMemo(() => {
    const counts: Record<ProjectStatus, number> = { Planning: 0, 'In Progress': 0, 'On Hold': 0, Completed: 0 }
    projects.forEach((p) => { counts[p.status] += 1 })
    return [
      { name: 'In progress', value: counts['In Progress'], color: '#252829' },
      { name: 'Planning', value: counts.Planning, color: '#6b8cf2' },
      { name: 'Completed', value: counts.Completed, color: '#9ddbb1' },
      { name: 'On hold', value: counts['On Hold'], color: '#f2c96a' },
    ]
  }, [projects])

  const alerts = useMemo(() => {
    const list: { title: string; detail: string; tone: 'red' | 'amber' | 'neutral' }[] = []
    projects.filter((p) => p.health === 'Red').forEach((p) => list.push({ title: `${p.name} is at risk`, detail: 'Client approval is overdue', tone: 'red' }))
    tasks.filter((t) => t.status === 'Blocked').forEach((t) => {
      const project = projects.find((p) => p.id === t.projectId)
      list.push({ title: t.title, detail: `Blocked · ${project?.name ?? ''}`, tone: 'amber' })
    })
    const overdue = tasks.filter((t) => t.status !== 'Completed' && t.due < new Date().toISOString().slice(0, 10))
    if (overdue.length) list.push({ title: `${overdue.length} task${overdue.length > 1 ? 's' : ''} overdue`, detail: overdue.map((t) => t.title).join(' · '), tone: 'red' })
    team.filter((m) => m.utilized / m.capacity > 0.85).forEach((m) => list.push({ title: `Capacity is tight for ${m.name.split(' ')[0]}`, detail: `${Math.round((m.utilized / m.capacity) * 100)}% utilized this week`, tone: 'neutral' }))
    return list.slice(0, 4)
  }, [projects, tasks, team])

  return (
    <>
      <style>{LIVE_STYLES}</style>
      <div className="w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mb-7 flex flex-col items-start justify-between gap-4 sm:flex-row">
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

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="min-h-[132px] p-5">
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium text-[#7e8280]">Total Projects</p>
                <p className="mt-3 font-heading text-[32px] font-semibold leading-[1.2] text-ink"><span key={pulse} style={{ display: 'inline-block', animation: 'number-pop 0.4s ease-out' }}>{kpis.total}</span></p>
              </div>
              <div key={pulse} className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f4f4f1] text-ink" style={{ animation: 'icon-bounce 2s ease-in-out infinite' }}>
                <FolderKanban size={24} strokeWidth={1.6} />
              </div>
            </div>
            <p className="mt-2 flex items-center gap-1 text-[10px] text-green">
              <TrendingUp size={10} /> ↑ 2 this quarter
            </p>
          </div>
        </Card>

        <Card className="min-h-[132px] p-5">
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium text-[#7e8280]">Active Projects</p>
                <p className="mt-3 font-heading text-[32px] font-semibold leading-[1.2] text-ink"><span key={pulse} style={{ display: 'inline-block', animation: 'number-pop 0.4s ease-out' }}>{kpis.active}</span></p>
              </div>
              <div key={pulse} className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e8f2ed] text-green" style={{ animation: 'icon-pulse 1.5s ease-in-out infinite' }}>
                <Activity size={24} strokeWidth={1.6} />
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted">of {kpis.total} total</p>
          </div>
        </Card>

        <Card className="min-h-[132px] p-5">
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium text-[#7e8280]">Overall Progress</p>
                <p className="mt-3 font-heading text-[32px] font-semibold leading-[1.2] text-ink"><span key={pulse} style={{ display: 'inline-block', animation: 'number-pop 0.4s ease-out' }}>{kpis.avgProgress}%</span></p>
              </div>
              <div key={pulse} className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e8effa]" style={{ animation: 'icon-spin 4s linear infinite' }}>
                <ProgressRing value={kpis.avgProgress} />
              </div>
            </div>
            <p className="mt-2 flex items-center gap-1 text-[10px] text-green">
              <TrendingUp size={10} /> ↑ 6.4% this week
            </p>
          </div>
        </Card>

        <Card className="min-h-[132px] p-5">
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium text-[#7e8280]">Overdue Tasks</p>
                <p className="mt-3 font-heading text-[32px] font-semibold leading-[1.2] text-ink"><span key={pulse} style={{ display: 'inline-block', animation: 'number-pop 0.4s ease-out' }}>{kpis.overdue}</span></p>
              </div>
              <div key={pulse} className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fbeaea] text-red" style={{ animation: 'icon-shake 2s ease-in-out infinite' }}>
                <AlertCircle size={24} strokeWidth={1.6} />
              </div>
            </div>
            <p className={`mt-2 text-[10px] ${kpis.overdue ? 'text-red' : 'text-muted'}`}>{kpis.overdue ? 'Needs attention' : 'All clear'}</p>
          </div>
        </Card>
      </div>

      <div className="relative mb-4 overflow-hidden rounded-card bg-ink px-6 py-5 text-white">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]" preserveAspectRatio="none" viewBox="0 0 600 120">
          <path d="M0 80 C70 60 100 100 150 80 S220 40 270 70 S340 100 390 60 S470 30 520 70 S570 90 600 60" fill="none" stroke="#fff" strokeWidth="1" />
          <path d="M0 100 C80 90 120 110 180 95 S260 75 320 95 S400 110 460 85 S540 70 600 90" fill="none" stroke="#fff" strokeWidth="1" />
        </svg>
        <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="w-full sm:w-auto">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#aeb3af]">Weekly pulse</p>
            <h2 className="font-heading text-[20px] font-medium">Your portfolio is moving forward.</h2>
            <p className="mt-2 text-[12px] text-[#b3b6b4]">
              {kpis.completed} project{kpis.completed !== 1 ? 's' : ''} completed · {kpis.onHold} on hold ·{' '}
              {tasks.filter((t) => t.status === 'Blocked').length} blocker{tasks.filter((t) => t.status === 'Blocked').length !== 1 ? 's' : ''} need attention
            </p>
          </div>
          <Button className="w-full rounded-full !bg-white px-5 py-2.5 text-[13px] font-medium !text-ink hover:!bg-[#f0f0ed] sm:w-auto" onClick={() => navigate('/reports', { state: { selected: 'weekly', showPulse: true } })}>
            <span className="flex items-center gap-2">View weekly report <span className="text-[14px] leading-none">→</span></span>
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RecentProjectsCard projects={projects} team={team} />

        <Card>
          <CardTitle title="Project status" subtitle="Across your portfolio" />
          <div className="flex h-auto flex-col items-center gap-6 sm:h-[170px] sm:flex-row">
            <div className="relative h-[140px] w-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={65} paddingAngle={0} isAnimationActive>
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #e7e7e2', fontSize: 11 }}
                    formatter={(value: number, name: string) => [`${value} project${value !== 1 ? 's' : ''}`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                <strong className="font-heading text-[25px] font-semibold text-ink">{projects.length}</strong>
                <span className="text-[9px] text-muted">projects</span>
              </div>
            </div>
            <div className="flex-1 space-y-2.5">
              {statusData.map((status) => (
                <div key={status.name} className="flex items-center gap-2 text-[11px] text-ink">
                  <i className="h-[8px] w-[8px] rounded-full" style={{ background: status.color }} />
                  {status.name}
                  <b className="ml-auto font-semibold">{status.value}</b>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle
            title="Team workload"
            subtitle="This week's utilization"
            action={<TextButton onClick={() => navigate('/team')}>View team →</TextButton>}
          />
          <div className="space-y-4">
            {team.slice(0, 4).map((member) => (
              <div key={member.id}>
                <div className="mb-1.5 flex justify-between text-[11px]">
                  <span className="flex items-center gap-2 text-ink">
                    <Avatar
                      name={member.name}
                      src={avatarUrl(member.name, member.gender)}
                      className="h-5 w-5 bg-ink text-white"
                    />
                    {member.name}
                  </span>
                  <b className="font-semibold text-ink">{Math.round((member.utilized / member.capacity) * 100)}%</b>
                </div>
                <ProgressBar value={(member.utilized / member.capacity) * 100} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle
            title="Important alerts"
            subtitle="Requires your attention"
            action={<TextButton onClick={() => navigate('/risks')}>See all →</TextButton>}
          />
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-muted">No alerts right now</p>
            ) : (
              alerts.map((alert) => {
                const isRed = alert.tone === 'red'
                const isAmber = alert.tone === 'amber'
                const Icon = isRed || isAmber ? AlertTriangle : User
                const iconClass = isRed
                  ? 'bg-[#ffe5e5] text-[#ff4d4d]'
                  : isAmber
                    ? 'bg-[#fff2cc] text-[#d98812]'
                    : 'bg-[#e0e7ff] text-[#4f46e5]'
                const cardClass = isRed ? 'bg-[#fff5f5] border border-[#ffe0e0]' : isAmber ? 'bg-[#fffbea] border border-[#fff0c2]' : 'bg-[#f4f6ff] border border-[#e0e7ff]'
                return (
                  <div
                    key={alert.title}
                    className={`flex items-start gap-3.5 rounded-2xl p-3.5 text-[11px] shadow-sm transition hover:-translate-y-px hover:shadow-md ${cardClass}`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${iconClass}`}>
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <b className="block truncate font-semibold text-ink">{alert.title}</b>
                      <span className="mt-0.5 block truncate text-[10px] text-[#979b98]">{alert.detail}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>

        <Card>
          <CardTitle title="Recent activity" subtitle="Latest updates across projects" action={<TextButton>View history →</TextButton>} />
          <ul className="space-y-3.5">
            {activity.slice(0, 4).map((item) => (
              <li key={item.id} className="flex items-start gap-3 text-[12px]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-[#fafaf8] text-[#9a9c9a]">
                  {getActivityIcon(item.type)}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate font-semibold text-ink">{item.message}</b>
                  <span className="mt-1 block text-[11px] text-muted">{item.project} · {item.time}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <ProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
    </>
  )
}
