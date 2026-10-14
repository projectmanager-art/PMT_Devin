import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, Plus, Upload } from 'lucide-react'
import { useApp, type DocumentItem, type Risk } from '../store'
import { downloadDocumentFile } from '../lib/documentFiles'
import { Badge, Button, Card, CardTitle, EmptyState, ProgressBar, TextButton, Avatar, avatarUrl } from '../components/ui'
import { DocumentModal } from './Documents'
import { ProjectModal } from '../components/ProjectModal'
import { TaskModal } from '../components/TaskModal'

const tabs = [
  'Overview',
  'Tasks',
  'Timeline',
  'Milestones',
  'Team',
  'Client',
  'Risks & Issues',
  'Change Requests',
  'Meetings',
  'Documents',
  'Reports',
  'Activity',
] as const

type Tab = (typeof tabs)[number]

export function ProjectDetail() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { projects, tasks, clients, team, risks, meetings, documents, activity, updateProject, deleteProject } = useApp()
  const [tab, setTab] = useState<Tab>('Overview')
  const [editOpen, setEditOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [documentOpen, setDocumentOpen] = useState(false)
  const [editingDocument, setEditingDocument] = useState<DocumentItem | null>(null)
  const [documentError, setDocumentError] = useState('')
  const [downloadingDocumentId, setDownloadingDocumentId] = useState('')

  const project = projects.find((p) => p.id === projectId)
  const projectTasks = useMemo(() => tasks.filter((t) => t.projectId === projectId), [tasks, projectId])
  const projectRisks = useMemo(() => risks.filter((r) => r.projectId === projectId), [risks, projectId])
  const projectDocs = useMemo(() => documents.filter((d) => d.projectId === projectId), [documents, projectId])
  const projectActivity = useMemo(() => activity.filter((a) => a.project === project?.name), [activity, project?.name])
  const client = clients.find((c) => c.name === project?.client)
  const involvedTeam = useMemo(() => {
    const names = new Set(projectTasks.map((t) => t.assignee))
    if (project?.manager) names.add(project.manager)
    return team.filter((m) => names.has(m.name))
  }, [projectTasks, team, project?.manager])

  const downloadProjectDocument = async (documentItem: DocumentItem) => {
    if (!documentItem.fileId) return
    setDownloadingDocumentId(documentItem.id)
    setDocumentError('')
    try {
      await downloadDocumentFile(documentItem.fileId, documentItem.fileName || documentItem.name)
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'Could not download this project file.')
    } finally {
      setDownloadingDocumentId('')
    }
  }

  if (!project) {
    return (
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <EmptyState
          title="Project not found"
          description="This project may have been archived or deleted."
          action={<Button className="mt-3" onClick={() => navigate('/projects')}>Back to projects</Button>}
        />
      </div>
    )
  }

  const changeRequests = projectRisks.filter((r) => r.category === 'Issue')
  const issues = projectRisks.filter((r) => r.category === 'Risk' || r.category === 'Issue')

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <TextButton onClick={() => navigate('/projects')}>← Back to projects</TextButton>

      <div className="mt-4 mb-5 flex flex-col items-start justify-between gap-4 rounded-card bg-ink p-4 text-white sm:flex-row sm:p-6">
        <div className="flex-1">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#aeb3af]">
            {project.client} · {project.type}
          </p>
          <h1 className="font-heading text-[24px] font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-2 max-w-2xl text-[12px] text-[#b5b7b6]">{project.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="dark">{project.status}</Badge>
            <Badge tone="dark">{project.priority} priority</Badge>
            <Badge tone="dark">Due {project.end}</Badge>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="grid h-[66px] w-[66px] place-items-center rounded-full border-[7px] border-green border-l-[#5a5d5b] font-heading text-[16px] font-semibold">
            {project.progress}%
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(true)}>Edit project</Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (window.confirm(`Archive "${project.name}"?`)) {
                  deleteProject(project.id)
                  navigate('/projects')
                }
              }}
            >
              Archive
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-1 border-b border-line">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-3 py-2 text-[12px] font-medium transition ${
              tab === item ? 'border-b-2 border-ink text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-2">
            <CardTitle title="Project details" subtitle="Core information and tracking" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px]">
              {([
                ['Client', project.client],
                [
                  'Project manager',
                  <div key="pm" className="flex items-center gap-2">
                    <Avatar
                      name={project.manager}
                      src={avatarUrl(project.manager, team.find((m) => m.name === project.manager)?.gender)}
                      className="h-5 w-5 bg-ink text-white"
                    />
                    {project.manager}
                  </div>,
                ],
                ['Status', project.status],
                ['Health', project.health],
                ['Start date', project.start],
                ['Deadline', project.end],
                ['Budget', project.budget],
                ['Estimated hours', `${project.estimatedHours}h`],
                ['Actual hours', `${project.actualHours}h`],
                ['Priority', project.priority],
              ] as [string, ReactNode][]).map(([label, value]) => (
                <div key={label} className="rounded-lg bg-[#fafaf8] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
                  <div className="mt-1 font-medium text-ink">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-[11px]">
                <span>Overall progress</span>
                <b>{project.progress}%</b>
              </div>
              <ProgressBar value={project.progress} />
            </div>
            {project.notes && (
              <div className="mt-4 rounded-lg border border-line bg-[#fafaf8] p-3 text-[11px] text-muted">
                <b className="mb-1 block text-[10px] uppercase tracking-wider text-ink">Internal notes</b>
                {project.notes}
              </div>
            )}
          </Card>
          <Card>
            <CardTitle title="Quick actions" subtitle="Common project operations" />
            <div className="space-y-2">
              <Button className="w-full" onClick={() => setTaskOpen(true)}>
                <span className="flex items-center gap-1.5"><Plus size={14} /> Add task</span>
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => navigate('/risks')}>Log risk or issue</Button>
              <Button variant="secondary" className="w-full" onClick={() => navigate('/meetings')}>Schedule meeting</Button>
              <Button variant="secondary" className="w-full" onClick={() => navigate('/documents')}>Upload document</Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => updateProject(project.id, { status: 'Completed', progress: 100, health: 'Green' })}
              >
                Mark completed
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'Tasks' && (
        <Card>
          <CardTitle
            title="Project tasks"
            subtitle={`${projectTasks.length} tasks connected to this project`}
            action={<Button onClick={() => setTaskOpen(true)}>＋ Add task</Button>}
          />
          {projectTasks.length === 0 ? (
            <EmptyState title="No tasks yet" description="Create the first task to start tracking work." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr>
                    {['Task', 'Assignee', 'Status', 'Priority', 'Due', 'Hours'].map((h) => (
                      <th key={h} className="border-b border-line px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wider text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projectTasks.map((task) => (
                    <tr key={task.id} className="transition hover:bg-[#fafaf8]">
                      <td
                        className="cursor-pointer border-b border-[#efefeb] px-3 py-3 text-[12px] font-medium text-ink hover:underline"
                        onClick={() => navigate(`/projects/${project.id}/tasks/${task.id}`)}
                      >{task.title}</td>
                      <td className="border-b border-[#efefeb] px-3 py-3 text-[11px] text-muted">{task.assignee}</td>
                      <td className="border-b border-[#efefeb] px-3 py-3"><Badge tone={task.status === 'Completed' ? 'green' : task.status === 'Blocked' ? 'red' : 'neutral'}>{task.status}</Badge></td>
                      <td className="border-b border-[#efefeb] px-3 py-3"><Badge tone={task.priority === 'Urgent' ? 'red' : task.priority === 'High' ? 'amber' : 'neutral'}>{task.priority}</Badge></td>
                      <td className="border-b border-[#efefeb] px-3 py-3 text-[11px] text-muted">{task.due}</td>
                      <td className="border-b border-[#efefeb] px-3 py-3 text-[11px] text-muted">{task.actualHours}/{task.estimatedHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'Timeline' && (
        <Card>
          <CardTitle title="Project timeline" subtitle="Tasks and milestones over time" />
          <div className="space-y-4">
            {projectTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 sm:gap-4">
                <span className="w-24 shrink-0 truncate text-[11px] text-ink sm:w-40">{task.title}</span>
                <div className="h-1.5 flex-1 rounded-full bg-[#eeeeeb]">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${task.status === 'Completed' ? 100 : task.status === 'In Progress' ? 60 : 20}%` }} />
                </div>
                <span className="w-14 shrink-0 text-right text-[10px] text-muted sm:w-20">{task.due.slice(5)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'Milestones' && (
        <Card>
          <CardTitle title="Milestones" subtitle="Key moments and deadlines" />
          <div className="space-y-3">
            {projectTasks.slice(0, 4).map((task, i) => (
              <div key={task.id} className="flex items-start gap-3 rounded-lg border border-line p-3">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#f0f1ed] text-[10px] font-bold text-ink">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-[12px] font-semibold text-ink">{task.title}</p>
                  <p className="mt-0.5 text-[10px] text-muted">Due {task.due} · {task.assignee}</p>
                </div>
                <Badge tone={task.status === 'Completed' ? 'green' : 'neutral'}>{task.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'Team' && (
        <Card>
          <CardTitle title="Project team" subtitle="People contributing to this project" />
          {involvedTeam.length === 0 ? (
            <EmptyState title="No team members assigned" description="Assign tasks to team members to build the project team." />
          ) : (
            <div className="space-y-3">
              {involvedTeam.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-lg border border-line p-3">
                  <Avatar
                    name={member.name}
                    src={avatarUrl(member.name, member.gender)}
                    className="h-8 w-8 bg-[#d4d7d2] text-[10px] font-bold text-ink"
                  />
                  <div className="flex-1">
                    <p className="text-[12px] font-semibold text-ink">{member.name}</p>
                    <p className="text-[10px] text-muted">{member.role} · {member.skills}</p>
                  </div>
                  <div className="w-24 shrink-0 sm:w-32">
                    <div className="mb-1 flex justify-between text-[10px] text-muted">
                      <span>Utilization</span>
                      <b>{Math.round((member.utilized / member.capacity) * 100)}%</b>
                    </div>
                    <ProgressBar value={(member.utilized / member.capacity) * 100} className="h-[4px]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'Client' && (
        <Card>
          <CardTitle title="Client information" subtitle={project.client} />
          {client ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px]">
              {[
                ['Company', client.company],
                ['Main contact', client.contact],
                ['Email', client.email],
                ['Phone', client.phone],
                ['Website', client.website],
                ['Pending approvals', client.pendingApprovals],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-[#fafaf8] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
                  <p className="mt-1 font-medium text-ink">{value}</p>
                </div>
              ))}
              <div className="rounded-lg border border-line bg-[#fafaf8] p-3 md:col-span-2">
                <p className="text-[10px] uppercase tracking-wider text-muted">Requirements</p>
                <p className="mt-1 text-[11px] text-ink">{client.requirements}</p>
              </div>
            </div>
          ) : (
            <EmptyState title="Client details not available" description="Add this client in the Clients section to enrich project context." />
          )}
        </Card>
      )}

      {tab === 'Risks & Issues' && (
        <Card>
          <CardTitle title="Risks, issues and blockers" subtitle="Anything that could impact delivery" />
          {issues.length === 0 ? (
            <EmptyState title="No risks logged" description="Keep this project healthy by logging risks early." />
          ) : (
            <div className="space-y-3">
              {issues.map((risk) => (
                <div key={risk.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-ink">{risk.title}</p>
                    <Badge tone={risk.status === 'Resolved' ? 'green' : risk.status === 'Monitoring' ? 'amber' : 'red'}>{risk.status}</Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-muted">{risk.category} · Owner {risk.owner} · Due {risk.targetDate}</p>
                  <p className="mt-2 text-[11px] text-muted">{risk.mitigationPlan || risk.resolutionDetails || 'No action plan recorded.'}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'Change Requests' && (
        <Card>
          <CardTitle title="Change requests" subtitle="Scope changes and approvals" />
          {changeRequests.length === 0 ? (
            <EmptyState title="No change requests" description="Log a change request when scope shifts." />
          ) : (
            <div className="space-y-3">
              {changeRequests.map((risk: Risk) => (
                <div key={risk.id} className="rounded-lg border border-line p-3">
                  <p className="text-[12px] font-semibold text-ink">{risk.title}</p>
                  <p className="mt-1 text-[10px] text-muted">Priority {risk.priority} · Due {risk.targetDate}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'Meetings' && (
        <Card>
          <CardTitle title="Meetings & MOM" subtitle="Decisions stay connected to the work" />
          <div className="space-y-3">
            {meetings.slice(0, 3).map((meeting) => (
              <div key={meeting.id} className="rounded-lg border border-line p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-ink">{meeting.title}</p>
                  <span className="text-[10px] text-muted">{meeting.date} · {meeting.time}</span>
                </div>
                <p className="mt-1 text-[10px] text-muted">{meeting.participants}</p>
                <p className="mt-2 text-[11px] text-muted">{meeting.decisions}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'Documents' && (
        <Card>
          <CardTitle
            title="Project documents"
            subtitle={`${projectDocs.length} file${projectDocs.length === 1 ? '' : 's'} stored with ${project.name}`}
            action={<Button onClick={() => { setEditingDocument(null); setDocumentOpen(true) }}><span className="inline-flex items-center gap-1.5"><Upload size={13} />Add project file</span></Button>}
          />
          {documentError && <div className="mb-3 rounded-lg border border-red/30 bg-red/5 px-3 py-2 text-[11px] text-red" role="alert">{documentError}</div>}
          {projectDocs.length === 0 ? (
            <EmptyState title="No documents yet" description="Upload briefs, guidelines, contracts, or assets to keep them with this project." action={<Button variant="secondary" onClick={() => { setEditingDocument(null); setDocumentOpen(true) }}>Upload first file</Button>} />
          ) : (
            <div className="space-y-2">
              {projectDocs.map((doc) => (
                <div key={doc.id} className="flex flex-col gap-3 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-ink">{doc.name}</p>
                    <p className="text-[10px] text-muted">{doc.fileName ? `${doc.fileName} · ${doc.size}` : 'No file attached · metadata only'} · Updated {doc.updated}</p>
                    {doc.description && <p className="mt-1 text-[10px] text-muted">{doc.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge tone={doc.status === 'Shared' ? 'green' : doc.status === 'In review' ? 'amber' : 'neutral'}>{doc.status}</Badge>
                    {doc.fileId ? <TextButton disabled={downloadingDocumentId === doc.id} onClick={() => void downloadProjectDocument(doc)}><span className="inline-flex items-center gap-1"><Download size={12} />{downloadingDocumentId === doc.id ? 'Loading…' : 'Download'}</span></TextButton> : <TextButton onClick={() => { setEditingDocument(doc); setDocumentOpen(true) }}>Attach file</TextButton>}
                    <TextButton onClick={() => { setEditingDocument(doc); setDocumentOpen(true) }}>Edit</TextButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'Reports' && (
        <Card>
          <CardTitle title="Project reports" subtitle="Automated summaries from live data" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ['Status report', `${project.status} · ${project.progress}% complete`],
              ['Progress report', `${projectTasks.filter((t) => t.status === 'Completed').length}/${projectTasks.length} tasks completed`],
              ['Risk report', `${projectRisks.filter((r) => r.status !== 'Resolved').length} open items`],
              ['Hours report', `${project.actualHours}/${project.estimatedHours}h logged`],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-lg border border-line p-4">
                <p className="font-heading text-[14px] font-semibold text-ink">{title}</p>
                <p className="mt-1 text-[11px] text-muted">{detail}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'Activity' && (
        <Card>
          <CardTitle title="Activity history" subtitle="Everything that happened on this project" />
          {projectActivity.length === 0 ? (
            <EmptyState title="No activity yet" description="Updates will appear here as work progresses." />
          ) : (
            <ul className="space-y-3">
              {projectActivity.map((item) => (
                <li key={item.id} className="flex items-start gap-3 text-[11px]">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#f0f1ed] text-[10px]">•</span>
                  <span>
                    <b className="block font-semibold text-ink">{item.message}</b>
                    <span className="mt-0.5 block text-[10px] text-muted">{item.time}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <ProjectModal open={editOpen} editing={project} onClose={() => setEditOpen(false)} />
      <TaskModal
        open={taskOpen}
        defaultProjectId={project.id}
        onClose={() => setTaskOpen(false)}
        onCreated={(id) => navigate(`/projects/${project.id}/tasks/${id}`)}
      />
      {documentOpen && <DocumentModal open editing={editingDocument} defaultProjectId={project.id} onClose={() => { setDocumentOpen(false); setEditingDocument(null) }} />}
    </div>
  )
}
