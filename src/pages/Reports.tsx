import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, PauseCircle, X } from 'lucide-react'
import { useApp, type Project, type Task } from '../store'
import { todayKey } from '../lib/dates'
import { Badge, Button, Card, CardTitle, EmptyState, Modal, ProgressBar, TextButton } from '../components/ui'

const reportDefs = [
  { id: 'status', title: 'Project status report', description: 'Executive snapshot of scope, progress, health and next steps.' },
  { id: 'weekly', title: 'Weekly project report', description: 'A shareable view of this week’s progress and priorities.' },
  { id: 'sprint', title: 'Sprint report', description: 'Completed vs pending work, velocity and retrospective.' },
  { id: 'rag', title: 'RAG portfolio report', description: 'All projects grouped by Green, Amber and Red health.' },
  { id: 'workload', title: 'Team workload report', description: 'Capacity, utilization and allocation by team member.' },
  { id: 'overdue', title: 'Overdue task report', description: 'Every late task, owner and next action.' },
]

function toCsv(rows: (string | number)[][]) {
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function WeeklyKeyPoints({
  projects,
  tasks,
  navigate,
}: {
  projects: Project[]
  tasks: Task[]
  navigate: (to: string) => void
}) {
  const today = todayKey()
  const completed = projects.filter((p) => p.status === 'Completed').length
  const onHold = projects.filter((p) => p.status === 'On Hold').length
  const active = projects.filter((p) => p.status === 'In Progress').length
  const blockers = tasks.filter((t) => t.status === 'Blocked').length
  const overdue = tasks.filter((t) => t.status !== 'Completed' && !!t.due && t.due < today).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Completed</p>
          <p className="mt-1 font-heading text-[22px] font-semibold text-ink">{completed}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">On Hold</p>
          <p className="mt-1 font-heading text-[22px] font-semibold text-ink">{onHold}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Active</p>
          <p className="mt-1 font-heading text-[22px] font-semibold text-ink">{active}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Blockers</p>
          <p className="mt-1 font-heading text-[22px] font-semibold text-red">{blockers}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Overdue</p>
          <p className="mt-1 font-heading text-[22px] font-semibold text-amber">{overdue}</p>
        </Card>
      </div>

      {projects.map((p) => {
        const blockerCount = tasks.filter((t) => t.projectId === p.id && t.status === 'Blocked').length
        const overdueCount = tasks.filter((t) => t.projectId === p.id && t.status !== 'Completed' && !!t.due && t.due < today).length
        const healthTone = p.health === 'Green' ? 'green' : p.health === 'Amber' ? 'amber' : 'red'
        return (
          <Card key={p.id} className="p-3">
            <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-start">
              <div>
                <h3 className="font-heading text-[14px] font-semibold text-ink">{p.name}</h3>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                  <span>{p.client}</span>
                  <span>·</span>
                  <span className="text-ink">{p.status}</span>
                  <span>·</span>
                  <span>{p.progress}% complete</span>
                  <span>·</span>
                  <span>Deadline {p.end}</span>
                </p>
              </div>
              <Badge tone={healthTone}>{p.health}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {blockerCount > 0 && (
                <Badge tone="red"><AlertTriangle size={10} /> {blockerCount} blocker{blockerCount > 1 ? 's' : ''}</Badge>
              )}
              {overdueCount > 0 && (
                <Badge tone="amber"><Clock size={10} /> {overdueCount} overdue</Badge>
              )}
              {p.status === 'On Hold' && (
                <Badge tone="amber"><PauseCircle size={10} /> On hold: {p.notes}</Badge>
              )}
              {blockerCount === 0 && overdueCount === 0 && p.status !== 'On Hold' && (
                <Badge tone="green"><CheckCircle2 size={10} /> On track</Badge>
              )}
              <div className="ml-auto flex gap-2">
                <TextButton onClick={() => navigate(`/projects/${p.id}`)}>Open</TextButton>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function WeeklyPulse({
  projects,
  tasks,
  updateTask,
  navigate,
}: {
  projects: Project[]
  tasks: Task[]
  updateTask: (id: string, patch: Partial<Task>) => void
  navigate: (to: string) => void
}) {
  const today = todayKey()
  const completed = projects.filter((p) => p.status === 'Completed').length
  const onHold = projects.filter((p) => p.status === 'On Hold').length
  const active = projects.filter((p) => p.status === 'In Progress').length
  const blockers = tasks.filter((t) => t.status === 'Blocked').length
  const overdue = tasks.filter((t) => t.status !== 'Completed' && !!t.due && t.due < today).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Completed</p>
          <p className="mt-1 font-heading text-[22px] font-semibold text-ink">{completed}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">On Hold</p>
          <p className="mt-1 font-heading text-[22px] font-semibold text-ink">{onHold}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Active</p>
          <p className="mt-1 font-heading text-[22px] font-semibold text-ink">{active}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Blockers</p>
          <p className="mt-1 font-heading text-[22px] font-semibold text-red">{blockers}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Overdue</p>
          <p className="mt-1 font-heading text-[22px] font-semibold text-amber">{overdue}</p>
        </Card>
      </div>

      {projects.map((p) => {
        const projectBlockers = tasks.filter((t) => t.projectId === p.id && t.status === 'Blocked')
        const projectOverdue = tasks.filter((t) => t.projectId === p.id && t.status !== 'Completed' && !!t.due && t.due < today)
        const healthTone = p.health === 'Green' ? 'green' : p.health === 'Amber' ? 'amber' : 'red'
        return (
          <Card key={p.id} className="p-4">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h3 className="font-heading text-[16px] font-semibold text-ink">{p.name}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <span>{p.client}</span>
                  <span>·</span>
                  <span className="text-ink">{p.status}</span>
                  <span>·</span>
                  <span>{p.progress}% complete</span>
                  <span>·</span>
                  <Badge tone={healthTone}>{p.health}</Badge>
                  <span>· Deadline {p.end}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => navigate(`/projects/${p.id}`)}>Open project</Button>
                <Button onClick={() => navigate('/tasks')}>View tasks</Button>
              </div>
            </div>

            {projectBlockers.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-red">
                  <AlertTriangle size={12} /> {projectBlockers.length} blocker{projectBlockers.length > 1 ? 's' : ''}
                </p>
                {projectBlockers.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col items-start justify-between gap-2 rounded-lg border border-red/10 bg-[#fff5f5] p-3 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="text-[12px] font-semibold text-ink">{t.title}</p>
                      <p className="text-[10px] text-muted">Owner: {t.assignee} · Due {t.due} · Priority: {t.priority}</p>
                    </div>
                    <TextButton onClick={() => updateTask(t.id, { status: 'In Progress' })}>Mark in progress</TextButton>
                  </div>
                ))}
              </div>
            )}

            {projectOverdue.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber">
                  <Clock size={12} /> {projectOverdue.length} overdue task{projectOverdue.length > 1 ? 's' : ''}
                </p>
                {projectOverdue.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col items-start justify-between gap-2 rounded-lg border border-amber/10 bg-[#fffbea] p-3 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="text-[12px] font-semibold text-ink">{t.title}</p>
                      <p className="text-[10px] text-muted">Owner: {t.assignee} · Due {t.due} · Priority: {t.priority}</p>
                    </div>
                    <TextButton onClick={() => navigate('/tasks')}>Open</TextButton>
                  </div>
                ))}
              </div>
            )}

            {p.status === 'On Hold' && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber/10 bg-[#fffbea] p-3 text-[12px] text-amber">
                <PauseCircle size={14} className="mt-0.5 shrink-0" />
                <span>On hold: {p.notes}</span>
              </div>
            )}

            {projectBlockers.length === 0 && projectOverdue.length === 0 && p.status !== 'On Hold' && (
              <div className="mt-4 flex items-center gap-2 text-[11px] text-green">
                <CheckCircle2 size={14} />
                <span>No blockers or overdue tasks this week.</span>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

export function Reports() {
  const { projects, tasks, team, risks, updateTask } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [selected, setSelected] = useState<string | null>(() => (location.state?.selected as string | undefined) ?? null)
  const [showPulse, setShowPulse] = useState(() => Boolean(location.state?.showPulse))

  const today = todayKey()
  const activeProjects = projects.filter((project) => project.status !== 'Completed').length
  const completedTasks = tasks.filter((task) => task.status === 'Completed').length
  const blockedTasks = tasks.filter((task) => task.status === 'Blocked').length
  const overdueTasks = tasks.filter((task) => task.status !== 'Completed' && !!task.due && task.due < today)
  const atRiskProjects = projects.filter((project) => project.status !== 'Completed' && project.health !== 'Green').length
  const averageProgress = projects.length ? Math.round(projects.reduce((total, project) => total + project.progress, 0) / projects.length) : 0
  const healthCounts = {
    Green: projects.filter((project) => project.health === 'Green').length,
    Amber: projects.filter((project) => project.health === 'Amber').length,
    Red: projects.filter((project) => project.health === 'Red').length,
  }
  const attentionTasks = tasks
    .filter((task) => task.status === 'Blocked' || (task.status !== 'Completed' && !!task.due && task.due < today))
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''))
    .slice(0, 8)
  const openRaids = risks.filter((risk) => !['Resolved', 'Closed', 'Cancelled'].includes(risk.status)).length

  const reportData = useMemo(() => {
    switch (selected) {
      case 'status':
        return projects.map((p) => [p.name, p.client, p.status, `${p.progress}%`, p.health, p.end])
      case 'weekly':
        return projects.map((p) => [p.name, p.status, `${p.progress}%`, tasks.filter((t) => t.projectId === p.id && t.status === 'Completed').length])
      case 'sprint':
        return tasks.map((t) => [t.title, t.status, t.assignee, t.due, `${t.actualHours}/${t.estimatedHours}h`])
      case 'rag':
        return projects.map((p) => [p.name, p.health, p.status, `${p.progress}%`])
      case 'workload':
        return team.map((m) => [m.name, m.role, `${m.utilized}/${m.capacity}h`, `${m.capacity > 0 ? Math.round((m.utilized / m.capacity) * 100) : 0}%`])
      case 'overdue':
        return tasks.filter((t) => t.status !== 'Completed' && !!t.due && t.due < todayKey()).map((t) => [t.title, t.assignee, t.due, t.status])
      default:
        return []
    }
  }, [selected, projects, tasks, team])

  const headers = useMemo(() => {
    switch (selected) {
      case 'status': return ['Project', 'Client', 'Status', 'Progress', 'Health', 'Deadline']
      case 'weekly': return ['Project', 'Status', 'Progress', 'Completed tasks']
      case 'sprint': return ['Task', 'Status', 'Assignee', 'Due', 'Hours']
      case 'rag': return ['Project', 'Health', 'Status', 'Progress']
      case 'workload': return ['Member', 'Role', 'Hours', 'Utilization']
      case 'overdue': return ['Task', 'Owner', 'Due', 'Status']
      default: return []
    }
  }, [selected])

  const onSelectReport = (id: string) => {
    setSelected(id)
  }

  const metrics = [
    { label: 'Active projects', value: activeProjects, note: `${projects.length} total`, tone: 'text-ink' },
    { label: 'Portfolio progress', value: `${averageProgress}%`, note: 'Average project completion', tone: 'text-blue' },
    { label: 'Tasks completed', value: completedTasks, note: `${tasks.length} total tasks`, tone: 'text-green' },
    { label: 'Blocked tasks', value: blockedTasks, note: 'Needs an unblock plan', tone: blockedTasks ? 'text-red' : 'text-ink' },
    { label: 'Overdue tasks', value: overdueTasks.length, note: 'Past due and incomplete', tone: overdueTasks.length ? 'text-amber' : 'text-ink' },
    { label: 'Open RAID', value: openRaids, note: `${atRiskProjects} project${atRiskProjects === 1 ? '' : 's'} at risk`, tone: openRaids ? 'text-amber' : 'text-ink' },
  ]
  const healthTotal = projects.length || 1

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#929692]">Analytics workspace · As of {today}</p>
          <h1 className="font-heading text-[28px] font-semibold tracking-tight text-ink">Reports &amp; insights</h1>
          <p className="mt-1.5 text-[13px] text-muted">A consolidated view of delivery, project health, workload, and immediate priorities.</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => (
          <Card key={metric.label} className="p-4">
            <p className="text-[9px] font-semibold uppercase tracking-[1.1px] text-muted">{metric.label}</p>
            <p className={`mt-1 font-heading text-[24px] font-semibold leading-none ${metric.tone}`}>{metric.value}</p>
            <p className="mt-1.5 text-[9px] text-muted">{metric.note}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.9fr)]">
        <Card className="min-w-0">
          <CardTitle title="Project portfolio" subtitle={`${projects.length} projects · health and delivery at a glance`} />
          {projects.length === 0 ? <EmptyState title="No project data yet" description="Create a project to populate the portfolio report." /> : (
            <>
              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between text-[9px] text-muted">
                  <span>Health distribution</span><span>{healthCounts.Green} Green · {healthCounts.Amber} Amber · {healthCounts.Red} Red</span>
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-[#eeeeeb]" aria-label="Project health distribution">
                  {healthCounts.Green > 0 && <div className="bg-green" style={{ width: `${healthCounts.Green / healthTotal * 100}%` }} />}
                  {healthCounts.Amber > 0 && <div className="bg-amber" style={{ width: `${healthCounts.Amber / healthTotal * 100}%` }} />}
                  {healthCounts.Red > 0 && <div className="bg-red" style={{ width: `${healthCounts.Red / healthTotal * 100}%` }} />}
                </div>
              </div>
              <div className="space-y-1">
                {projects.map((project) => {
                  const projectTasks = tasks.filter((task) => task.projectId === project.id)
                  const blockers = projectTasks.filter((task) => task.status === 'Blocked').length
                  const overdue = projectTasks.filter((task) => task.status !== 'Completed' && !!task.due && task.due < today).length
                  const healthTone = project.health === 'Green' ? 'green' : project.health === 'Amber' ? 'amber' : 'red'
                  return (
                    <div key={project.id} className="grid gap-2 rounded-lg px-2 py-3 transition hover:bg-[#fafaf8] sm:grid-cols-[minmax(125px,1.2fr)_minmax(120px,1.5fr)_auto_auto_auto] sm:items-center">
                      <div className="min-w-0">
                        <Link to={`/projects/${project.id}`} className="block truncate text-[11px] font-semibold text-ink hover:text-blue hover:underline">{project.name}</Link>
                        <p className="truncate text-[9px] text-muted">{project.client} · {project.status}</p>
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 flex justify-between text-[9px] text-muted"><span>Progress</span><span>{project.progress}%</span></div>
                        <ProgressBar value={project.progress} className="h-[5px]" />
                      </div>
                      <Badge tone={healthTone}>{project.health}</Badge>
                      <span className={`text-[9px] ${blockers ? 'font-semibold text-red' : 'text-muted'}`}>{blockers} blocked</span>
                      <span className={`text-[9px] ${overdue ? 'font-semibold text-amber' : 'text-muted'}`}>{overdue} overdue</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </Card>

        <Card className="min-w-0">
          <CardTitle title="Needs attention" subtitle={`${attentionTasks.length} blocked or overdue task${attentionTasks.length === 1 ? '' : 's'}`} action={<AlertTriangle size={15} className={attentionTasks.length ? 'text-amber' : 'text-green'} />} />
          {attentionTasks.length === 0 ? (
            <EmptyState title="Nothing urgent" description="No blocked or overdue tasks in the current workspace data." />
          ) : (
            <div className="space-y-2">
              {attentionTasks.map((task) => {
                const project = projects.find((item) => item.id === task.projectId)
                const isOverdue = task.status !== 'Completed' && !!task.due && task.due < today
                return (
                  <Link key={task.id} to={`/tasks/${task.id}`} className="block rounded-lg border border-line p-3 transition hover:border-[#c9cbc5] hover:bg-[#fafaf8]">
                    <div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-[11px] font-semibold text-ink">{task.title}</p><div className="flex shrink-0 gap-1">{task.status === 'Blocked' && <Badge tone="red">Blocked</Badge>}{isOverdue && <Badge tone="amber">Overdue</Badge>}</div></div>
                    <p className="mt-1 text-[9px] text-muted">{project?.name ?? 'Project unavailable'} · {task.assignee || 'Unassigned'}{task.due ? ` · Due ${task.due}` : ''}</p>
                  </Link>
                )
              })}
              <Button variant="secondary" className="mt-1 w-full" onClick={() => navigate('/tasks')}>View task board</Button>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle title="Report studio" subtitle="Generate and export a live report from the selected NexORA data." action={
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!selected} onClick={() => window.print()}>Print / Save PDF</Button>
            <Button disabled={!selected} onClick={() => selected && downloadCsv(`${selected}-report.csv`, [headers, ...reportData])}>Export CSV</Button>
          </div>
        } />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Choose a report</span>
            <select className="h-[38px] w-full rounded-lg border border-line bg-white px-3 text-[11px] text-ink" value={selected ?? ''} onChange={(event) => onSelectReport(event.target.value)}>
              <option value="">Select report type</option>
              {reportDefs.map((report) => <option key={report.id} value={report.id}>{report.title}</option>)}
            </select>
          </label>
          <p className="pb-2 text-[10px] text-muted">Preview updates from current project, task, and team records.</p>
        </div>

        {selected && (
          <div key={selected} className="page-enter mt-5 border-t border-line pt-4">
            <div className="mb-4">
              <p className="text-[14px] font-semibold text-ink">{reportDefs.find((report) => report.id === selected)?.title ?? 'Report preview'}</p>
              <p className="mt-1 text-[10px] text-muted">{reportDefs.find((report) => report.id === selected)?.description} · {reportData.length} row{reportData.length === 1 ? '' : 's'} · Refreshed {new Date().toLocaleString()}</p>
            </div>
            {selected === 'weekly' ? (
              <WeeklyPulse projects={projects} tasks={tasks} updateTask={updateTask} navigate={navigate} />
            ) : reportData.length === 0 ? (
              <EmptyState title={selected === 'overdue' ? 'No overdue tasks' : 'No data for this report'} description={selected === 'overdue' ? 'All incomplete tasks are currently within their due dates.' : 'Add projects or tasks to populate this report.'} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px]">
                  <thead><tr>{headers.map((heading) => <th key={heading} className="border-b border-line px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wider text-muted">{heading}</th>)}</tr></thead>
                  <tbody>{reportData.map((row, rowIndex) => <tr key={rowIndex} className="transition hover:bg-[#fafaf8]">{row.map((cell, cellIndex) => <td key={cellIndex} className="border-b border-[#efefeb] px-3 py-2.5 text-[11px] text-ink">{cell}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      <Modal
        open={showPulse}
        title="Weekly project key points"
        onClose={() => setShowPulse(false)}
        footer={<Button onClick={() => setShowPulse(false)}><span className="flex items-center gap-1.5"><X size={14} /> Close</span></Button>}
      >
        <WeeklyKeyPoints projects={projects} tasks={tasks} navigate={navigate} />
      </Modal>
    </div>
  )
}
