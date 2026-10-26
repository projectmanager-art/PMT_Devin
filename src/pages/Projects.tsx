import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileSpreadsheet, Plus, Search } from 'lucide-react'
import { useApp, type Health, type Project, type ProjectStatus } from '../store'
import { effectiveHealth, isOverdue, isStale, latestUpdateMap } from '../lib/reporting'
import { todayKey } from '../lib/dates'
import { Badge, Button, Card, EmptyState, ProgressPie, TextButton } from '../components/ui'
import { ProjectModal } from '../components/ProjectModal'
import { ImportExcelModal } from '../components/ImportExcelModal'

const healthTone = { Green: 'green', Amber: 'amber', Red: 'red' } as const

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

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <Card key={project.id} className="flex flex-col">
              <div className="flex items-center justify-between">
                <Badge tone={healthTone[effectiveHealth(project, latest.get(project.id), today)]}>{effectiveHealth(project, latest.get(project.id), today)}</Badge>
                <span className="flex items-center gap-1.5 text-[10px] text-muted">
                  {project.importMeta?.projectClass && (
                    <span className={`rounded px-1 py-px text-[8px] font-semibold uppercase tracking-wide ${project.importMeta.projectClass.toLowerCase() === 'new' ? 'bg-[#e0e7ff] text-[#4338ca]' : 'bg-[#f0f0ed] text-[#666a67]'}`}>
                      {project.importMeta.projectClass}
                    </span>
                  )}
                  {project.type}
                </span>
              </div>
              <h3 className="mt-4 font-heading text-[16px] font-semibold text-ink">{project.name}</h3>
              <p className="mt-1 text-[11px] text-muted">{project.client}</p>
              <div className="mt-5 flex justify-between text-[10px] text-muted">
                <span>{project.status}</span>
                <span className={isOverdue(project, today) ? 'font-semibold text-red' : ''}>Due {project.end ? project.end.slice(5) : '—'}{isOverdue(project, today) ? ' · overdue' : ''}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ProgressPie value={project.progress} size={46} />
                  <span className="text-[10px] text-muted">complete</span>
                </div>
                <div className="flex items-center gap-2">
                  <TextButton onClick={() => navigate(`/projects/${project.id}`)}>Open →</TextButton>
                  <TextButton onClick={() => { setEditing(project); setModalOpen(true) }}>Edit</TextButton>
                  <TextButton
                    className="text-red"
                    onClick={() => {
                      if (window.confirm(`Archive "${project.name}"?`)) deleteProject(project.id)
                    }}
                  >
                    Delete
                  </TextButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modalOpen && <ProjectModal open editing={editing} onClose={() => { setModalOpen(false); setEditing(null) }} />}
      {importOpen && <ImportExcelModal open onClose={() => setImportOpen(false)} />}
    </div>
  )
}
