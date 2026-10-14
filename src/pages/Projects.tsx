import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useApp, type Project, type ProjectStatus } from '../store'
import { Badge, Button, Card, EmptyState, ProgressBar, TextButton } from '../components/ui'
import { ProjectModal } from '../components/ProjectModal'

const healthTone = { Green: 'green', Amber: 'amber', Red: 'red' } as const

export function Projects() {
  const { projects, deleteProject } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | ProjectStatus>('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter((p) => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q) || p.manager.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [projects, query, statusFilter])

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#929692]">Workspace</p>
          <h1 className="font-heading text-[28px] font-semibold tracking-tight text-ink">Projects</h1>
          <p className="mt-2 text-[13px] text-muted">Track every engagement from kickoff to completion.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true) }}>
          <span className="flex items-center gap-1.5"><Plus size={14} /> New project</span>
        </Button>
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
          {(['Planning', 'In Progress', 'On Hold', 'Completed'] as ProjectStatus[]).map((s) => <option key={s}>{s}</option>)}
        </select>
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
                <Badge tone={healthTone[project.health]}>{project.health}</Badge>
                <span className="text-[10px] text-muted">{project.type}</span>
              </div>
              <h3 className="mt-4 font-heading text-[16px] font-semibold text-ink">{project.name}</h3>
              <p className="mt-1 text-[11px] text-muted">{project.client}</p>
              <div className="mt-5 flex justify-between text-[10px] text-muted">
                <span>{project.status}</span>
                <span>Due {project.end.slice(5)}</span>
              </div>
              <div className="mt-2">
                <ProgressBar value={project.progress} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-muted">{project.progress}% complete</span>
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

      <ProjectModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} />
    </div>
  )
}
