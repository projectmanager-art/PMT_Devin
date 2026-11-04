import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Briefcase, Building2, Car, FileSpreadsheet, FileText, Flame, Footprints,
  Globe, GraduationCap, HardHat, HeartPulse, Mountain, Palette, PartyPopper,
  Pencil, Plus, Search, SprayCan, Store, Trash2, UtensilsCrossed, type LucideIcon,
} from 'lucide-react'
import { useApp, type Health, type Project, type ProjectStatus } from '../store'
import { effectiveHealth, isOverdue, isStale, latestUpdateMap } from '../lib/reporting'
import { todayKey } from '../lib/dates'
import { Badge, Button, EmptyState } from '../components/ui'
import { ProjectModal } from '../components/ProjectModal'
import { ImportExcelModal } from '../components/ImportExcelModal'
import { StatusUpdateModal } from '../components/StatusUpdateModal'

const healthBar = { Green: 'bg-[#16a34a]', Amber: 'bg-[#d97706]', Red: 'bg-[#dc2626]' } as const

const statusDot: Record<ProjectStatus, string> = {
  'In Progress': 'bg-[#2563eb]',
  'At Risk': 'bg-[#dc2626]',
  Planning: 'bg-[#8a8d88]',
  'On Hold': 'bg-[#d97706]',
  Completed: 'bg-[#16a34a]',
  'Backed Off': 'bg-[#9333ea]',
}

const statusChip: Record<ProjectStatus, string> = {
  'In Progress': 'bg-[#dbeafe] text-[#2563eb]',
  Planning: 'bg-[#f0f0ed] text-[#666a67]',
  'On Hold': 'bg-[#fef3c7] text-[#d97706]',
  Completed: 'bg-[#dcfce7] text-[#16a34a]',
  'At Risk': 'bg-[#fee2e2] text-[#dc2626]',
  'Backed Off': 'bg-[#f3e8ff] text-[#9333ea]',
}

const AVATAR_TINTS = [
  'bg-[#e0e7ff] text-[#4338ca]',
  'bg-[#dcfce7] text-[#15803d]',
  'bg-[#fef3c7] text-[#b45309]',
  'bg-[#fce7f3] text-[#be185d]',
]
const avatarTint = (name: string) => AVATAR_TINTS[Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_TINTS.length]

/** Business-keyword → icon mapping; first match wins (driving before school). */
const ICON_RULES: [RegExp, LucideIcon][] = [
  [/driv|motor|garage|automot|vehicle/, Car],
  [/tutor|learn|academ|admission|educat|school|course|training/, GraduationCap],
  [/foot|shoe|sneaker/, Footprints],
  [/clean|maid|janitor/, SprayCan],
  [/insulat|renovat|construc|engg|engineer|fabricat/, HardHat],
  [/propert|real ?estate|realty|housing|properties/, Building2],
  [/gas|boiler|fuel|energy|heating/, Flame],
  [/party|event|suppl|gift|decor/, PartyPopper],
  [/care|health|medic|clinic|pharma/, HeartPulse],
  [/mountain|trek|outdoor|adventure/, Mountain],
  [/design|studio|creative|art/, Palette],
  [/web|tech|software|landing|digital|global|link|it |consult/, Globe],
  [/depot|warehouse|store|shop|retail|mart/, Store],
  [/food|restaurant|cater|kitchen/, UtensilsCrossed],
]
const projectIcon = (p: Project): LucideIcon => {
  const hay = `${p.name} ${p.client} ${p.type}`.toLowerCase()
  return ICON_RULES.find(([re]) => re.test(hay))?.[1] ?? Briefcase
}

const ALL_STATUSES: ProjectStatus[] = ['Planning', 'In Progress', 'On Hold', 'Completed', 'At Risk', 'Backed Off']

export function Projects() {
  const { projects, statusUpdates, deleteProject } = useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const urlStatus = searchParams.get('status') as ProjectStatus | null
  const urlHealth = searchParams.get('health') as Health | null
  const urlFlag = searchParams.get('flag')
  const [statusFilter, setStatusFilter] = useState<'All' | ProjectStatus>(urlStatus && ALL_STATUSES.includes(urlStatus) ? urlStatus : 'All')
  const [modalOpen, setModalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [updateTarget, setUpdateTarget] = useState<Project | null>(null)

  const latest = useMemo(() => latestUpdateMap(statusUpdates), [statusUpdates])
  const today = todayKey()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter((p) => {
      const l = latest.get(p.id)
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q) || p.manager.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter
      const matchesHealth = !urlHealth || effectiveHealth(p, l, today) === urlHealth
      const matchesFlag =
        !urlFlag ||
        (urlFlag === 'overdue' && isOverdue(p, today)) ||
        (urlFlag === 'stale' && isStale(p, l, today)) ||
        (urlFlag === 'active' && p.status !== 'Completed' && p.status !== 'Backed Off' && p.status !== 'On Hold') ||
        (urlFlag === 'unreported' && !l) ||
        ((urlFlag === 'new' || urlFlag === 'old') && p.importMeta?.projectClass?.toLowerCase() === urlFlag)
      return matchesQuery && matchesStatus && matchesHealth && matchesFlag
    })
  }, [projects, latest, query, statusFilter, urlHealth, urlFlag, today])

  const grouped = useMemo(() => {
    const order: ProjectStatus[] = ['In Progress', 'At Risk', 'Planning', 'On Hold', 'Completed', 'Backed Off']
    const map = new Map<ProjectStatus, Project[]>()
    for (const p of filtered) map.set(p.status, [...(map.get(p.status) ?? []), p])
    return order.map((status) => ({ status, items: map.get(status) ?? [] })).filter((g) => g.items.length > 0)
  }, [filtered])

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#929692]">Workspace</p>
          <h1 className="font-heading text-[28px] font-semibold tracking-tight text-ink">Projects</h1>
          <p className="mt-2 text-[13px] text-muted">Track every engagement from kickoff to completion.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <span className="flex items-center gap-1.5"><FileSpreadsheet size={14} /> Import Excel</span>
          </Button>
          <Button onClick={() => { setEditing(null); setModalOpen(true) }}>
            <span className="flex items-center gap-1.5"><Plus size={14} /> New project</span>
          </Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex h-[36px] w-full items-center gap-2 rounded-lg border border-line bg-white px-3 text-muted sm:w-[245px]">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full bg-transparent text-[11px] text-ink outline-none placeholder:text-[#aaa]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'All' | ProjectStatus)}
          className="h-[36px] rounded-lg border border-line bg-white px-3 text-[11px] text-ink outline-none"
        >
          <option>All</option>
          {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        {(urlHealth || urlFlag) && (
          <Badge tone="amber">
            Filtered{urlHealth ? ` · ${urlHealth} health` : ''}{urlFlag ? ` · ${urlFlag}` : ''} — <button className="underline" onClick={() => navigate('/projects')}>clear</button>
          </Badge>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No projects found"
          description="Try adjusting your search or filters, or create a new project to get started."
          action={<Button className="mt-3" onClick={() => { setEditing(null); setModalOpen(true) }}>Create project</Button>}
        />
      ) : (
        <div className="space-y-8">
          {grouped.map(({ status, items }) => (
            <section key={status}>
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${statusDot[status]}`} />
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink">{status}</h2>
                <span className="text-[10px] text-muted">{items.length}</span>
                <div className="h-px flex-1 bg-line" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((project) => {
            const health = effectiveHealth(project, latest.get(project.id), today)
            const overdue = isOverdue(project, today)
            const Icon = projectIcon(project)
            const daysLeft = project.end
              ? Math.ceil((new Date(project.end).getTime() - new Date(today).getTime()) / 86400000)
              : null
            return (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-line bg-white transition-all duration-200 hover:-translate-y-1 hover:border-[#d8d8d2] hover:shadow-[0_14px_36px_rgba(0,0,0,0.10)]"
              >
                {/* decorative signal bars */}
                <div className="pointer-events-none absolute bottom-3 right-3 flex items-end gap-[3px] opacity-[0.07]">
                  {[5, 9, 7, 12, 4].map((h, i) => (
                    <div key={i} className="w-[4px] rounded-sm bg-ink" style={{ height: h }} />
                  ))}
                </div>

                <div className="p-4">
                  {/* header — avatar + client, health/progress chip */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${avatarTint(project.client || project.name)}`}>
                        <Icon size={14} />
                      </div>
                      <span className="truncate text-[11px] font-medium text-ink">{project.client || '—'}</span>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#f4f4f1] px-1.5 py-0.5 text-[10px] font-bold text-ink">
                      <span className={`h-1.5 w-1.5 rounded-full ${healthBar[health]}`} />
                      {project.progress}%
                    </span>
                  </div>

                  {/* headline + status */}
                  <div className="mt-3">
                    <h3 className="truncate font-heading text-[14px] font-semibold leading-snug text-ink" title={project.name}>{project.name}</h3>
                    <div className="mt-1 flex items-center gap-x-1.5 text-[9px]">
                      <span className={`font-bold uppercase tracking-wide ${statusChip[project.status].split(' ')[1]}`}>{project.status}</span>
                      {project.type && <span className="truncate text-muted">· {project.type}</span>}
                      {overdue && <span className="font-semibold text-red">· Overdue</span>}
                    </div>
                  </div>

                  {/* progress bar + footer in one block */}
                  <div className="mt-3 h-[4px] w-full overflow-hidden rounded-full bg-[#eeeeeb]">
                    <div className={`h-full rounded-full transition-all duration-500 ${healthBar[health]}`} style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }} />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[9px] text-muted">
                    <span className="truncate">{project.manager || 'Unassigned'}</span>
                    <span className={`shrink-0 font-semibold ${overdue ? 'text-red' : 'text-ink'}`}>
                      {project.end
                        ? overdue
                          ? `${project.end.slice(5)} · ${Math.abs(daysLeft ?? 0)}d overdue`
                          : `${project.end.slice(5)} · ${daysLeft}d left`
                        : 'No deadline'}
                    </span>
                  </div>
                </div>

                {/* hover actions */}
                <div
                  className="absolute right-3 top-10 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setUpdateTarget(project)}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-white text-muted shadow-sm transition hover:text-ink"
                    title="Post a status update"
                  >
                    <FileText size={12} />
                  </button>
                  <button
                    onClick={() => { setEditing(project); setModalOpen(true) }}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-white text-muted shadow-sm transition hover:text-ink"
                    title="Edit project"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Archive "${project.name}"?`)) deleteProject(project.id)
                    }}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-white text-muted shadow-sm transition hover:bg-[#fee2e2] hover:text-red"
                    title="Archive project"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
                )
              })}
              </div>
            </section>
          ))}
        </div>
      )}

      {modalOpen && <ProjectModal open editing={editing} onClose={() => { setModalOpen(false); setEditing(null) }} />}
      {importOpen && <ImportExcelModal open onClose={() => setImportOpen(false)} />}
      {updateTarget && <StatusUpdateModal project={updateTarget} onClose={() => setUpdateTarget(null)} />}
    </div>
  )
}
