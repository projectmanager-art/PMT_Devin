import { useEffect, useMemo, useRef, useState, type ElementType } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, AlertTriangle, Bell, ChevronRight, LogOut, Menu, Search, Settings, UserRound, Users } from 'lucide-react'
import { useApp } from '../store'
import { todayKey } from '../lib/dates'
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
  items?: { id: string; title: string; meta: string; to: string }[]
}

const alertTone: Record<AlertItem['type'], { iconBg: string; iconColor: string; strip: string; pill: string }> = {
  overdue: {
    iconBg: 'bg-[#fee2e2]',
    iconColor: 'text-[#dc2626]',
    strip: 'bg-[#ef4444]',
    pill: 'bg-[#fee2e2] text-[#b91c1c]',
  },
  blocked: {
    iconBg: 'bg-[#fef3c7]',
    iconColor: 'text-[#b45309]',
    strip: 'bg-[#f0b429]',
    pill: 'bg-[#fef3c7] text-[#92400e]',
  },
  risk: {
    iconBg: 'bg-[#fee2e2]',
    iconColor: 'text-[#dc2626]',
    strip: 'bg-[#ef4444]',
    pill: 'bg-[#fee2e2] text-[#b91c1c]',
  },
  review: {
    iconBg: 'bg-[#e0e7ff]',
    iconColor: 'text-[#4f46e5]',
    strip: 'bg-[#6366f1]',
    pill: 'bg-[#e0e7ff] text-[#4338ca]',
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
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)
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
    const projectName = (projectId: string) => projects.find((p) => p.id === projectId)?.name ?? 'No project'
    const overdue = tasks.filter((t) => t.status !== 'Completed' && t.due && t.due < todayKey())
    if (overdue.length)
      list.push({
        id: 'overdue',
        type: 'overdue',
        message: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} need attention`,
        to: '/tasks',
        items: overdue.map((t) => ({ id: t.id, title: t.title, meta: `${projectName(t.projectId)} · due ${t.due}`, to: `/tasks/${t.id}` })),
      })
    const blocked = tasks.filter((t) => t.status === 'Blocked')
    if (blocked.length)
      list.push({
        id: 'blocked',
        type: 'blocked',
        message: `${blocked.length} blocked task${blocked.length > 1 ? 's' : ''}`,
        to: '/tasks',
        items: blocked.map((t) => ({ id: t.id, title: t.title, meta: `Blocked · ${projectName(t.projectId)}`, to: `/tasks/${t.id}` })),
      })
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
          </div>

          {showResults && query.trim() && (
            <div className="dropdown-enter absolute right-0 top-[50px] w-[320px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-white p-2 shadow-lift">
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
            <div className="dropdown-enter absolute right-0 top-[42px] w-[320px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-line bg-white shadow-lift">
              <div className="flex items-center justify-between px-3.5 pb-1 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Notifications</p>
                {alerts.length > 0 && (
                  <span className="rounded-full bg-ink px-1.5 py-px text-[9px] font-semibold leading-4 text-white">{alerts.length}</span>
                )}
              </div>
              {alerts.length === 0 ? (
                <p className="px-3 pb-5 pt-3 text-center text-[11px] text-muted">You're all caught up</p>
              ) : (
                <>
                  <div className="space-y-2 p-2">
                    {alerts.map((alert, i) => {
                      const Icon = alertIcon[alert.type]
                      const tone = alertTone[alert.type]
                      const label = alert.type === 'overdue' ? 'Task alert' : alert.type === 'blocked' ? 'Blocked' : alert.type === 'risk' ? 'Project risk' : 'Needs review'
                      const expanded = expandedAlert === alert.id
                      return (
                        <div
                          key={alert.id}
                          className="page-enter overflow-hidden rounded-[12px] border border-line bg-white shadow-sm"
                          style={{ animationDelay: `${i * 60}ms` }}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (alert.items?.length) {
                                setExpandedAlert(expanded ? null : alert.id)
                              } else {
                                navigate(alert.to)
                                setShowAlerts(false)
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click()
                            }}
                            className="group flex w-full cursor-pointer items-stretch text-left transition hover:bg-[#fafaf8]"
                          >
                            <span className={`w-1 shrink-0 ${tone.strip}`} />
                            <span className={`mx-2.5 my-2.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone.iconBg} ${tone.iconColor}`}>
                              <Icon size={15} />
                            </span>
                            <div className="min-w-0 flex-1 self-center py-2 pr-1">
                              <p className="truncate text-[11px] font-semibold leading-snug text-ink">{alert.message}</p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-muted">
                                <span className={`rounded-full px-1.5 py-px text-[8px] font-semibold ${tone.pill}`}>{label}</span>
                                {alert.items?.length ? <span className="normal-case tracking-normal">{alert.items.length} item{alert.items.length > 1 ? 's' : ''}</span> : null}
                              </p>
                            </div>
                            <ChevronRight
                              size={14}
                              className={`mr-2.5 shrink-0 self-center text-muted transition ${alert.items?.length ? (expanded ? 'rotate-90' : '') : 'opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100'}`}
                            />
                          </div>
                          {expanded && alert.items && (
                            <div className="border-t border-line bg-[#fafaf8] p-1.5">
                              {alert.items.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigate(item.to)
                                    setShowAlerts(false)
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white"
                                >
                                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.strip}`} />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[11px] font-medium text-ink">{item.title}</span>
                                    <span className="block truncate text-[9px] text-muted">{item.meta}</span>
                                  </span>
                                  <ChevronRight size={12} className="shrink-0 text-muted" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/risks')
                      setShowAlerts(false)
                    }}
                    className="w-full border-t border-line px-3 py-2.5 text-center text-[11px] font-medium text-ink transition hover:bg-[#f7f7f5]"
                  >
                    View all alerts →
                  </button>
                </>
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
            <div className="dropdown-enter absolute right-0 top-[42px] w-[220px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-white p-2 shadow-lift">
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
