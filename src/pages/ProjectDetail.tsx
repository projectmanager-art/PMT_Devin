import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Download, FileText, Plus, Upload } from 'lucide-react'
import { useApp, type DocumentItem, type Risk, type StatusUpdate } from '../store'
import { todayKey } from '../lib/dates'
import { downloadDocumentFile } from '../lib/documentFiles'
import { effectiveHealth, isOverdue, latestUpdateFor, updatesFor } from '../lib/reporting'
import { StatusUpdateModal } from '../components/StatusUpdateModal'
import { Badge, Button, Card, CardTitle, EmptyState, Modal, ProgressBar, ProgressRing, TextButton, Avatar, avatarUrl } from '../components/ui'
import { DocumentModal } from './Documents'
import { RaidModal } from './Risks'
import { ScheduleMeetingModal } from './Meetings'
import { ProjectModal } from '../components/ProjectModal'
import { TaskModal } from '../components/TaskModal'

const tabs = [
  'Overview',
  'Status Updates',
  'Tasks',
  'Timeline',
  'Milestones',
  'Team',
  'Client',
  'Risks & Issues',
  'Issues',
  'Meetings',
  'Documents',
  'Reports',
  'Activity',
] as const

type Tab = (typeof tabs)[number]

export function ProjectDetail() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { projects, tasks, clients, team, risks, meetings, documents, activity, statusUpdates, updateProject, deleteProject, updateTeamMember } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('Overview')
  const [editOpen, setEditOpen] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [editingUpdate, setEditingUpdate] = useState<StatusUpdate | null>(null)
  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [riskOpen, setRiskOpen] = useState(false)
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [documentOpen, setDocumentOpen] = useState(false)
  const [editingDocument, setEditingDocument] = useState<DocumentItem | null>(null)
  const [documentError, setDocumentError] = useState('')
  const [downloadingDocumentId, setDownloadingDocumentId] = useState('')

  const project = projects.find((p) => p.id === projectId)
  const projectUpdates = useMemo(() => (projectId ? updatesFor(projectId, statusUpdates) : []), [statusUpdates, projectId])
  const latestReport = useMemo(() => (projectId ? latestUpdateFor(projectId, statusUpdates) : undefined), [statusUpdates, projectId])
  const projectTasks = useMemo(() => tasks.filter((t) => t.projectId === projectId), [tasks, projectId])
  const projectRisks = useMemo(() => risks.filter((r) => r.projectId === projectId), [risks, projectId])
  const projectDocs = useMemo(() => documents.filter((d) => d.projectId === projectId), [documents, projectId])
  const projectActivity = useMemo(() => activity.filter((a) => a.project === project?.name), [activity, project?.name])
  const client = clients.find((c) => c.name === project?.client)
  const involvedTeam = useMemo(() => {
    const name = project?.name ?? ''
    const assignees = new Set(projectTasks.map((t) => t.assignee))
    return team
      .filter((m) => (m.projects ?? []).includes(name) || assignees.has(m.name) || m.name === project?.manager)
      .map((m) => ({
        ...m,
        explicit: (m.projects ?? []).includes(name),
        isManager: m.name === project?.manager,
        isAssignee: assignees.has(m.name),
      }))
  }, [projectTasks, team, project?.name, project?.manager])

  const availableMembers = useMemo(
    () => team.filter((m) => !(m.projects ?? []).includes(project?.name ?? '') && m.name !== project?.manager),
    [team, project?.name, project?.manager],
  )

  const addProjectMember = (memberId: string) => {
    const member = team.find((m) => m.id === memberId)
    if (!member || !project) return
    updateTeamMember(member.id, { projects: [...(member.projects ?? []), project.name] })
  }

  const removeProjectMember = (memberId: string) => {
    const member = team.find((m) => m.id === memberId)
    if (!member || !project) return
    updateTeamMember(member.id, { projects: (member.projects ?? []).filter((n) => n !== project.name) })
  }

  // Dashboard "Add update" action lands here via ?newUpdate=1
  useEffect(() => {
    if (searchParams.get('newUpdate') === '1') {
      setUpdateOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

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

  const projectMeetings = meetings.filter((m) => m.projectId === project.id)
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
            <Badge tone="dark">Due {project.end || '—'}</Badge>
            {isOverdue(project, todayKey()) && <Badge tone="dark" className="!bg-red/20 !text-[#ffb4b4]">Overdue</Badge>}
          </div>
          <p className="mt-3 text-[10px] text-[#8d918e]">
            {latestReport
              ? `Last reported ${new Date(latestReport.createdAt).toLocaleString()} by ${latestReport.author}`
              : 'No status report yet — awaiting first update'}
            {project.healthOverride && ` · Health ${project.healthOverride.health} (manual: ${project.healthOverride.reason})`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <ProgressRing value={project.progress} />
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

      <div key={tab} className="page-enter">
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
                ['Health', `${effectiveHealth(project, latestReport, todayKey())}${project.healthOverride ? ' (manual)' : ' (auto)'}`],
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
            {(project.invoiceValue || project.collectedAmount || project.amountPending || project.paymentFrequency) && (
              <div className="mt-4 rounded-lg border border-line bg-[#fafaf8] p-3">
                <b className="mb-2 block text-[10px] uppercase tracking-wider text-ink">Billing</b>
                <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                  {([
                    ['Invoice (inc. VAT)', project.invoiceValue],
                    ['Collected', project.collectedAmount],
                    ['Pending', project.amountPending],
                    ['Payment frequency', project.paymentFrequency],
                  ] as [string, string | undefined][]).map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[9px] uppercase tracking-wider text-muted">{label}</p>
                      <p className="mt-0.5 font-medium text-ink">{value || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {project.importMeta && (
              <p className="mt-3 text-[9px] text-muted">
                Imported from {project.importMeta.sourceFile} · {project.importMeta.sourceSheet} row {project.importMeta.sourceRow}
                {project.importMeta.sourceStatus && project.importMeta.sourceStatus !== project.status ? ` · source status "${project.importMeta.sourceStatus}"` : ''}
                {project.importMeta.projectClass ? ` · class "${project.importMeta.projectClass}"` : ''}
              </p>
            )}
          </Card>
          <Card>
            <CardTitle title="Quick actions" subtitle="Common project operations" />
            <div className="space-y-2">
              <Button className="w-full" onClick={() => setUpdateOpen(true)}>
                <span className="flex items-center gap-1.5"><FileText size={14} /> Add status update</span>
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => setTaskOpen(true)}>
                <span className="flex items-center gap-1.5"><Plus size={14} /> Add task</span>
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => setRiskOpen(true)}>Log risk or issue</Button>
              <Button variant="secondary" className="w-full" onClick={() => setMeetingOpen(true)}>Schedule meeting</Button>
              <Button variant="secondary" className="w-full" onClick={() => { setEditingDocument(null); setDocumentOpen(true) }}>Upload document</Button>
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

      {tab === 'Status Updates' && (
        <Card>
          <CardTitle
            title="Status updates"
            subtitle={`${projectUpdates.length} report${projectUpdates.length === 1 ? '' : 's'} — newest first`}
            action={<Button onClick={() => { setEditingUpdate(null); setUpdateOpen(true) }}><span className="inline-flex items-center gap-1.5"><Plus size={13} /> Add update</span></Button>}
          />
          {projectUpdates.length === 0 ? (
            <EmptyState
              title="No status reports yet"
              description="Submit the first project status update — it takes under a minute and feeds the dashboard."
              action={<Button className="mt-2" onClick={() => { setEditingUpdate(null); setUpdateOpen(true) }}>Add first update</Button>}
            />
          ) : (
            <ul className="space-y-3">
              {projectUpdates.map((u, i) => (
                <li key={u.id} className="relative rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={u.status === 'Completed' ? 'green' : u.status === 'At Risk' || u.status === 'Backed Off' ? 'red' : u.status === 'On Hold' ? 'amber' : 'blue'}>{u.status}</Badge>
                      <Badge tone="neutral">{u.progress}%</Badge>
                      {i === 0 && <Badge tone="dark">Current</Badge>}
                      {u.editHistory?.length ? <span className="text-[9px] text-muted">edited {u.editHistory.length}×</span> : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted">{new Date(u.createdAt).toLocaleString()} · {u.author}</span>
                      <TextButton onClick={() => { setEditingUpdate(u); setUpdateOpen(true) }}>Edit</TextButton>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
                    {([
                      ['Work completed', u.workCompleted],
                      ['Current work', u.currentWork],
                      ['Pending work', u.pendingWork],
                      ['Blockers', u.blockers ? `${u.blockers}${u.blockerSeverity === 'critical' ? ' (critical)' : ''}` : ''],
                      ['Client update', u.clientUpdate],
                      ['Risks / dependencies', u.risksDependencies],
                      ['Next steps', u.nextSteps],
                      ['Expected completion', u.expectedCompletion],
                    ] as [string, string | undefined][])
                      .filter(([, v]) => v?.trim())
                      .map(([label, v]) => (
                        <div key={label} className={`rounded-lg p-2.5 ${label === 'Blockers' ? 'bg-red/5' : 'bg-[#fafaf8]'}`}>
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">{label}</p>
                          <p className="mt-0.5 whitespace-pre-wrap text-ink">{v}</p>
                        </div>
                      ))}
                  </div>
                  {u.internalRemarks && (
                    <div className="mt-2.5 rounded-lg border border-dashed border-line bg-[#fafaf8] p-2.5 text-[11px]">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">Internal remarks</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-muted">{u.internalRemarks}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
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
          <CardTitle
            title="Project team"
            subtitle="People contributing to this project"
            action={<Button variant="secondary" onClick={() => setMemberModalOpen(true)}><span className="inline-flex items-center gap-1.5"><Plus size={13} />Add member</span></Button>}
          />
          {involvedTeam.length === 0 ? (
            <EmptyState
              title="No team members assigned"
              description="Add people to this project to build the team."
              action={<Button className="mt-1" variant="secondary" onClick={() => setMemberModalOpen(true)}><span className="inline-flex items-center gap-1.5"><Plus size={13} />Add member</span></Button>}
            />
          ) : (
            <div className="space-y-3">
              {involvedTeam.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-lg border border-line p-3">
                  <Avatar
                    name={member.name}
                    src={avatarUrl(member.name, member.gender)}
                    className="h-8 w-8 bg-[#d4d7d2] text-[10px] font-bold text-ink"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[12px] font-semibold text-ink">
                      <span className="truncate">{member.name}</span>
                      {member.isManager && <Badge tone="dark" className="px-1.5 py-px text-[8px]">PM</Badge>}
                      {!member.explicit && <span className="text-[9px] font-medium uppercase tracking-wide text-muted">via tasks</span>}
                    </p>
                    <p className="truncate text-[10px] text-muted">{member.role} · {member.skills}</p>
                  </div>
                  <div className="hidden w-24 shrink-0 sm:block sm:w-32">
                    <div className="mb-1 flex justify-between text-[10px] text-muted">
                      <span>Utilization</span>
                      <b>{member.capacity > 0 ? Math.round((member.utilized / member.capacity) * 100) : 0}%</b>
                    </div>
                    <ProgressBar value={member.capacity > 0 ? (member.utilized / member.capacity) * 100 : 0} className="h-[4px]" />
                  </div>
                  {member.explicit && !member.isManager ? (
                    <TextButton
                      className="shrink-0 text-red"
                      onClick={() => removeProjectMember(member.id)}
                    >
                      Remove
                    </TextButton>
                  ) : (
                    !member.isManager && (
                      <span className="shrink-0 text-[9px] text-muted" title="Unassign their tasks first">—</span>
                    )
                  )}
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
          {(() => {
            // Aggregate reported blockers/risks, deduplicated by text — same issue
            // reported twice shows once, at its most recent timestamp.
            const seen = new Map<string, { text: string; kind: 'Blocker' | 'Risk / dependency'; lastAt: string; critical: boolean }>()
            for (const u of projectUpdates) {
              for (const [kind, text, critical] of [
                ['Blocker', u.blockers, u.blockerSeverity === 'critical'],
                ['Risk / dependency', u.risksDependencies, false],
              ] as const) {
                if (!text?.trim()) continue
                const key = text.trim().toLowerCase().replace(/\s+/g, ' ')
                const existing = seen.get(key)
                if (!existing || u.createdAt > existing.lastAt) {
                  seen.set(key, { text: text.trim(), kind, lastAt: u.createdAt, critical })
                }
              }
            }
            const reported = [...seen.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt))
            return reported.length > 0 ? (
              <div className="mb-4 rounded-xl border border-amber/40 bg-amber/5 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber">Reported in status updates</p>
                <div className="space-y-2">
                  {reported.map((r) => (
                    <div key={r.text} className="flex items-start justify-between gap-3 text-[11px]">
                      <span className="min-w-0 text-ink">
                        <b className="mr-1.5 rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">{r.kind}</b>
                        {r.critical && <b className="mr-1.5 rounded bg-red/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red">Critical</b>}
                        {r.text}
                      </span>
                      <span className="shrink-0 text-[9px] text-muted">{new Date(r.lastAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          })()}
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

      {tab === 'Issues' && (
        <Card>
          <CardTitle title="Issues" subtitle="Open issues on this project" />
          {changeRequests.length === 0 ? (
            <EmptyState title="No issues" description="Log an issue when something blocks delivery." />
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
          {projectMeetings.length === 0 ? (
            <EmptyState title="No meetings yet" description="Schedule a meeting from Quick actions above." />
          ) : (
          <div className="space-y-3">
            {projectMeetings.map((meeting) => (
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
          )}
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
      </div>

      {updateOpen && (
        <StatusUpdateModal
          project={project}
          editing={editingUpdate}
          onClose={() => { setUpdateOpen(false); setEditingUpdate(null) }}
        />
      )}
      {editOpen && <ProjectModal open editing={project} onClose={() => setEditOpen(false)} />}
      {taskOpen && <TaskModal
        open
        defaultProjectId={project.id}
        onClose={() => setTaskOpen(false)}
        onCreated={(id) => navigate(`/projects/${project.id}/tasks/${id}`)}
      />}
      {documentOpen && <DocumentModal open editing={editingDocument} defaultProjectId={project.id} onClose={() => { setDocumentOpen(false); setEditingDocument(null) }} />}
      {riskOpen && <RaidModal open defaultProjectId={project.id} onClose={() => setRiskOpen(false)} />}
      {meetingOpen && <ScheduleMeetingModal open defaultDate={todayKey()} defaultProjectId={project.id} onClose={() => setMeetingOpen(false)} />}

      <Modal open={memberModalOpen} title={`Add member to ${project.name}`} onClose={() => setMemberModalOpen(false)}>
        {availableMembers.length === 0 ? (
          <EmptyState title="Everyone is on this project" description="All team members have been added already." />
        ) : (
          <div className="space-y-2">
            {availableMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-3 rounded-lg border border-line p-3">
                <Avatar
                  name={member.name}
                  src={avatarUrl(member.name, member.gender)}
                  className="h-8 w-8 bg-[#d4d7d2] text-[10px] font-bold text-ink"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-ink">{member.name}</p>
                  <p className="truncate text-[10px] text-muted">
                    {member.role} · {member.capacity > 0 ? Math.round((member.utilized / member.capacity) * 100) : 0}% utilized
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    addProjectMember(member.id)
                  }}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => setMemberModalOpen(false)}>Done</Button>
        </div>
      </Modal>
    </div>
  )
}
