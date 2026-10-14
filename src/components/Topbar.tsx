import { useEffect, useMemo, useRef, useState, type ElementType } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, AlertTriangle, Bell, Command, LogOut, Menu, Search, Settings, UserRound, Users } from 'lucide-react'
import { useApp } from '../store'
import { Avatar, avatarUrl } from '../components/ui'

interface SearchResult {
  type: 'Project' | 'Task' | 'Client' | 'Team' | 'Meeting'
  title: string
  subtitle: string
  to: string
}

interface AlertItem {
  id: string
  type: 'overdue' | 'blocked' | 'risk' | 'review'
  message: string
  to: string
}

const alertTone: Record<AlertItem['type'], { iconBg: string; iconColor: string; border: string; bg: string }> = {
  overdue: {
    iconBg: 'bg-[#fde2e2]',
    iconColor: 'text-[#d64545]',
    border: 'border-[#f5c8c8]',
    bg: 'bg-[#fef0f0]',
  },
  blocked: {
    iconBg: 'bg-[#fdeecb]',
    iconColor: 'text-[#b87b2c]',
    border: 'border-[#f3dfb8]',
    bg: 'bg-[#fdf6e8]',
  },
  risk: {
    iconBg: 'bg-[#fde2e2]',
    iconColor: 'text-[#d64545]',
    border: 'border-[#f5c8c8]',
    bg: 'bg-[#fef0f0]',
  },
  review: {
    iconBg: 'bg-[#fdeecb]',
    iconColor: 'text-[#b87b2c]',
    border: 'border-[#f3dfb8]',
    bg: 'bg-[#fdf6e8]',
  },
}

const alertIcon: Record<AlertItem['type'], ElementType> = {
  overdue: AlertCircle,
  blocked: AlertTriangle,
  risk: AlertTriangle,
  review: AlertCircle,
}

export function Topbar({ onLogout, onMenuClick }: { onLogout: () => void; onMenuClick: () => void }) {
  const { projects, tasks, clients, team, meetings } = useApp()
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowAlerts(false)
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out: SearchResult[] = []
    projects.forEach((p) => {
      if (p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q)) {
        out.push({ type: 'Project', title: p.name, subtitle: `${p.client} · ${p.status}`, to: `/projects/${p.id}` })
      }
    })
    tasks.forEach((t) => {
      if (t.title.toLowerCase().includes(q)) {
        const project = projects.find((p) => p.id === t.projectId)
        out.push({ type: 'Task', title: t.title, subtitle: `${project?.name ?? ''} · ${t.status}`, to: '/tasks' })
      }
    })
    clients.forEach((c) => {
      if (c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q)) {
        out.push({ type: 'Client', title: c.name, subtitle: c.company, to: '/clients' })
      }
    })
    team.forEach((m) => {
      if (m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q)) {
        out.push({ type: 'Team', title: m.name, subtitle: m.role, to: '/team' })
      }
    })
    meetings.forEach((m) => {
      if (m.title.toLowerCase().includes(q)) {
        out.push({ type: 'Meeting', title: m.title, subtitle: `${m.date} · ${m.time}`, to: '/meetings' })
      }
    })
    return out.slice(0, 8)
  }, [query, projects, tasks, clients, team, meetings])

  const alerts = useMemo<AlertItem[]>(() => {
    const list: AlertItem[] = []
    const overdue = tasks.filter((t) => t.status !== 'Completed' && t.due < new Date().toISOString().slice(0, 10))
    if (overdue.length) list.push({ id: 'overdue', type: 'overdue', message: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} need attention`, to: '/tasks' })
    const blocked = tasks.filter((t) => t.status === 'Blocked')
    if (blocked.length) list.push({ id: 'blocked', type: 'blocked', message: `${blocked.length} blocked task${blocked.length > 1 ? 's' : ''}`, to: '/tasks' })
    const redProjects = projects.filter((p) => p.health === 'Red')
    redProjects.forEach((p) => list.push({ id: `risk-${p.id}`, type: 'risk', message: `${p.name} is at risk`, to: `/projects/${p.id}` }))
    const amberProjects = projects.filter((p) => p.health === 'Amber')
    amberProjects.forEach((p) => list.push({ id: `review-${p.id}`, type: 'review', message: `${p.name} needs review`, to: `/projects/${p.id}` }))
    return list.slice(0, 5)
  }, [projects, tasks])

  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-line bg-[rgba(250,250,248,0.85)] px-4 backdrop-blur lg:px-8">
      <div className="flex items-center gap-3 text-[13px]">
        <button
          onClick={onMenuClick}
          className="mr-1 grid h-[34px] w-[34px] place-items-center rounded-lg border border-line bg-white text-ink transition hover:bg-[#f7f7f5] lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>
        <span className="hidden text-[#9a9c9a] sm:inline">Overview</span>
        <span className="hidden text-[#c9cac6] sm:inline">/</span>
        <span className="hidden font-semibold text-ink sm:inline">Dashboard</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative" ref={searchRef}>
          <div className="flex h-[42px] w-[150px] items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 transition focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/5 sm:w-[280px]">
            <Search size={16} className="text-[#9a9c9a]" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowResults(true)
              }}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
              placeholder="Search anything..."
              className="w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-[#b0b3b0]"
            />
            <div className="hidden h-[22px] w-[22px] flex-col items-center justify-center rounded-md border border-[#e6e6e1] bg-[#f9f9f7] text-[9px] text-[#9a9c9a] leading-none sm:flex">
              <Command size={10} />
              <span className="-mt-[1px]">K</span>
            </div>
          </div>

          {showResults && query.trim() && (
            <div className="absolute right-0 top-[50px] w-[320px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-white p-2 shadow-lift">
              {results.length === 0 ? (
                <p className="px-3 py-4 text-center text-[11px] text-muted">No results found</p>
              ) : (
                results.map((result) => (
                  <button
                    key={`${result.type}-${result.title}`}
                    onMouseDown={() => {
                      navigate(result.to)
                      setQuery('')
                      setShowResults(false)
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-[#f4f4f1]"
                  >
                    <span className="rounded-md bg-[#f0f1ed] px-1.5 py-[2px] text-[9px] font-semibold uppercase text-[#777]">{result.type}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-ink">{result.title}</span>
                      <span className="block truncate text-[10px] text-muted">{result.subtitle}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="relative grid h-[34px] w-[34px] place-items-center rounded-lg border border-line bg-white text-[#606463] transition hover:bg-[#f7f7f5]"
            aria-label="Notifications"
          >
            <Bell size={16} />
            {alerts.length > 0 && <span className="absolute right-[7px] top-[7px] h-[5px] w-[5px] rounded-full bg-red" />}
          </button>
          {showAlerts && (
            <div className="absolute right-0 top-[42px] w-[300px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-white p-2 shadow-lift">
              <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Notifications</p>
              {alerts.length === 0 ? (
                <p className="px-3 py-4 text-center text-[11px] text-muted">You're all caught up</p>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => {
                    const Icon = alertIcon[alert.type]
                    const tone = alertTone[alert.type]
                    return (
                      <button
                        key={alert.id}
                        type="button"
                        onClick={() => {
                          navigate(alert.to, { state: alert.type === 'blocked' ? { statusFilter: 'Blocked' } : undefined })
                          setShowAlerts(false)
                        }}
                        className={`flex w-full items-start gap-3 rounded-[12px] border ${tone.border} ${tone.bg} p-3 text-left transition hover:shadow-lift`}
                      >
                        <div className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-full ${tone.iconBg} ${tone.iconColor}`}>
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium leading-[1.35] text-ink">{alert.message}</p>
                          <p className="mt-0.5 text-[9px] uppercase tracking-wide text-muted">
                            {alert.type === 'overdue' ? 'Task alert' : alert.type === 'blocked' ? 'Blocked' : alert.type === 'risk' ? 'Project risk' : 'Needs review'}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="ml-1 rounded-full transition hover:ring-2 hover:ring-ink/10"
            aria-label="Account menu"
            aria-expanded={showUserMenu}
            aria-haspopup="menu"
          >
            <Avatar
              name="Sandeep Rana"
              src={avatarUrl('Sandeep Rana', 'male')}
              className="h-[30px] w-[30px] bg-ink text-white"
            />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-[42px] w-[220px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-white p-2 shadow-lift">
              <div className="px-3 py-2">
                <p className="text-[12px] font-semibold text-ink">Sandeep Rana</p>
                <p className="text-[10px] text-muted">Project Manager</p>
              </div>
              <div className="my-1 border-t border-line" />
              <button
                onClick={() => {
                  navigate('/settings')
                  setShowUserMenu(false)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-ink transition hover:bg-[#f4f4f1]"
              >
                <Settings size={14} className="text-muted" />
                Settings
              </button>
              <button
                onClick={() => {
                  navigate('/team')
                  setShowUserMenu(false)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-ink transition hover:bg-[#f4f4f1]"
              >
                <Users size={14} className="text-muted" />
                Manage team
              </button>
              <button
                onClick={() => {
                  navigate('/settings')
                  setShowUserMenu(false)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-ink transition hover:bg-[#f4f4f1]"
              >
                <UserRound size={14} className="text-muted" />
                Workspace settings
              </button>
              <div className="my-1 border-t border-line" />
              <button
                onClick={() => {
                  onLogout()
                  setShowUserMenu(false)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-red transition hover:bg-[#fef0f0]"
              >
                <LogOut size={14} className="text-red" />
                Log out
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  )
}
