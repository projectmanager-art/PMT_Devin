import { useMemo, useState } from 'react'
import { CalendarDays, Clock3, GripVertical, MessageSquare, Plus, ShieldAlert } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useApp, type Task, type TaskStatus, type TeamMember } from '../store'
import { Avatar, Badge, Button, EmptyState, Modal } from '../components/ui'
import { TaskModal } from '../components/TaskModal'

const taskStatuses: TaskStatus[] = ['To Do', 'In Progress', 'Review', 'Blocked', 'Completed']
function TaskCard({
  task,
  projectName,
  projectId,
  team,
  onOpen,
}: {
  task: Task
  projectName: string
  projectId: string
  team: TeamMember[]
  onOpen: (task: Task) => void
}) {
  const member = team.find((person) => person.name === task.assignee)
  const isFollowUpOverdue = task.status !== 'Completed' && !!task.nextFollowUp && task.nextFollowUp < new Date().toISOString().slice(0, 10)

  return (
    <article
      draggable
      onClick={(event) => {
        if (!(event.target instanceof Element) || !event.target.closest('a, button')) onOpen(task)
      }}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/task-id', task.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      className="group cursor-pointer rounded-xl border border-line bg-white p-3.5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-[#c9cbc5] hover:shadow-lift"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-[#b4b7b2] opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
        <button type="button" className="min-w-0 flex-1 text-left font-heading text-[13px] font-semibold leading-snug text-ink hover:text-blue hover:underline" onClick={() => onOpen(task)}>
          {task.title}
        </button>
        <Badge tone={task.priority === 'Urgent' ? 'red' : task.priority === 'High' ? 'amber' : 'neutral'}>{task.priority}</Badge>
      </div>

      <div className="ml-6 mt-2.5">
        {projectId ? (
          <Link
            to={`/projects/${projectId}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-[#f1f2ef] px-2 py-1 text-[10px] font-semibold text-[#535854] transition hover:bg-[#e8e9e5] hover:text-ink"
            title={`Open ${projectName}`}
            onClick={(event) => event.stopPropagation()}
          >
            <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-white text-[8px] font-bold text-blue">{projectName.charAt(0).toUpperCase()}</span>
            <span className="truncate">{projectName}</span>
          </Link>
        ) : (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-[#f1f2ef] px-2 py-1 text-[10px] font-semibold text-muted">{projectName}</span>
        )}


        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1" title="Next follow-up date"><CalendarDays size={11} className={isFollowUpOverdue ? 'text-red' : ''} /><span className={isFollowUpOverdue ? 'font-semibold text-red' : ''}>Follow-up: {task.nextFollowUp || 'Not scheduled'}</span></span>
          <span className="inline-flex items-center gap-1" title="Estimated hours"><Clock3 size={11} />{task.actualHours}/{task.estimatedHours}h</span>
        </div>

        <div className="mt-3 flex items-center border-t border-[#f0f0ed] pt-2.5">
          <button onClick={() => onOpen(task)} className="flex min-w-0 items-center gap-1.5 rounded-full pr-2 text-left hover:bg-[#f6f6f3]" title={`Open ${task.assignee || 'unassigned task'}`}>
            <Avatar name={member?.name ?? 'Unassigned'} className="h-6 w-6 text-[9px]" />
            <span className="truncate text-[10px] font-medium text-ink">{task.assignee || 'Unassigned'}</span>
          </button>
        </div>
      </div>
    </article>
  )
}

function taskDateTime(value: string) {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

function TaskDetailsModal({
  task,
  projects,
  tasks,
  team,
  aiFindings,
  raids,
  onClose,
  onEdit,
}: {
  task: Task
  projects: ReturnType<typeof useApp>['projects']
  tasks: Task[]
  team: TeamMember[]
  aiFindings: ReturnType<typeof useApp>['aiFindings']
  raids: ReturnType<typeof useApp>['risks']
  onClose: () => void
  onEdit: (task: Task) => void
}) {
  const project = projects.find((item) => item.id === task.projectId)
  const dependencies = tasks.filter((item) => task.dependencies.includes(item.id))
  const findings = aiFindings.filter((finding) => finding.sourceIds.includes(task.id))
  const linkedRaids = raids.filter((raid) => raid.affectedTaskIds.includes(task.id))
  const comments = [...(task.taskComments ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const activity = [...(task.activity ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const assignee = team.find((member) => member.name === task.assignee)

  return (
    <Modal
      open
      title={task.title}
      onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button onClick={() => onEdit(task)}>Edit task</Button></>}
    >
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={task.status === 'Completed' ? 'green' : task.status === 'Blocked' ? 'red' : task.status === 'In Progress' ? 'blue' : 'neutral'}>{task.status}</Badge>
          <Badge tone={task.priority === 'Urgent' ? 'red' : task.priority === 'High' ? 'amber' : 'neutral'}>{task.priority} priority</Badge>
          {project ? <Link to={`/projects/${project.id}`} onClick={onClose} className="rounded-md bg-[#f1f2ef] px-2.5 py-1 text-[10px] font-semibold text-ink hover:bg-[#e8e9e5]">{project.name}</Link> : <Badge>Project unavailable</Badge>}
        </div>

        <div className="grid gap-3 rounded-xl bg-[#f7f7f4] p-3 sm:grid-cols-2">
          <div><p className="text-[9px] font-semibold uppercase tracking-wide text-muted">Assignee</p><div className="mt-1 flex items-center gap-2"><Avatar name={assignee?.name ?? 'Unassigned'} className="h-6 w-6 text-[9px]" /><span className="text-[11px] font-medium text-ink">{task.assignee || 'Unassigned'}</span></div></div>
          <div><p className="text-[9px] font-semibold uppercase tracking-wide text-muted">Due date</p><p className="mt-1 text-[11px] font-medium text-ink">{task.due || 'Not set'}</p></div>
          <div><p className="text-[9px] font-semibold uppercase tracking-wide text-muted">Time</p><p className="mt-1 text-[11px] font-medium text-ink">{task.actualHours}h logged / {task.estimatedHours}h estimated</p></div>
          <div><p className="text-[9px] font-semibold uppercase tracking-wide text-muted">Start date</p><p className="mt-1 text-[11px] font-medium text-ink">{task.start || 'Not set'}</p></div>
          <div><p className="text-[9px] font-semibold uppercase tracking-wide text-muted">Next follow-up</p><p className="mt-1 text-[11px] font-medium text-ink">{task.nextFollowUp || 'Not scheduled'}</p></div>
        </div>

        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-muted">Description</h3>
          <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-ink">{task.description || 'No description provided.'}</p>
        </section>
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-muted">Acceptance criteria</h3>
          <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-ink">{task.acceptanceCriteria || 'No acceptance criteria added.'}</p>
        </section>
        <section>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">Dependencies</h3>
          {dependencies.length ? <div className="space-y-1">{dependencies.map((dependency) => <Link key={dependency.id} to={`/tasks/${dependency.id}`} onClick={onClose} className="block rounded-lg border border-line px-3 py-2 text-[11px] font-medium text-ink hover:bg-[#fafaf8]">{dependency.title} <span className="ml-1 text-muted">· {dependency.status}</span></Link>)}</div> : <p className="text-[11px] text-muted">No dependencies linked.</p>}
        </section>
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted"><MessageSquare size={12} /> Comments ({comments.length})</h3>
          {comments.length ? <div className="space-y-2">{comments.map((comment) => <div key={comment.id} className="rounded-lg border border-line p-3"><div className="mb-1 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold text-ink">{comment.author}</span><span className="text-[9px] text-muted">{taskDateTime(comment.updatedAt || comment.createdAt)}{comment.updatedAt !== comment.createdAt ? ' · edited' : ''}</span></div><p className="whitespace-pre-wrap text-[11px] text-ink">{comment.text}</p></div>)}</div> : <p className="text-[11px] text-muted">No comments yet.</p>}
        </section>
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted"><ShieldAlert size={12} /> RAID insights ({findings.length + linkedRaids.length})</h3>
          {findings.length || linkedRaids.length ? <div className="space-y-2">{findings.map((finding) => <div key={finding.id} className="rounded-lg border border-line p-3"><div className="flex items-center gap-2"><Badge tone="amber">{finding.category}</Badge><span className="text-[11px] font-semibold text-ink">{finding.title}</span></div><p className="mt-1 text-[10px] text-muted">{finding.explanation}</p><p className="mt-1 text-[10px] text-ink">Evidence: {finding.evidence}</p></div>)}{linkedRaids.map((raid) => <Link key={raid.id} to="/risks" onClick={onClose} className="block rounded-lg border border-line p-3 hover:bg-[#fafaf8]"><div className="flex items-center gap-2"><Badge tone="neutral">{raid.category}</Badge><span className="text-[11px] font-semibold text-ink">{raid.title}</span></div><p className="mt-1 text-[10px] text-muted">{raid.status} · {raid.owner || 'Unassigned'}</p></Link>)}</div> : <p className="text-[11px] text-muted">No RAID insights or linked RAID records.</p>}
        </section>
        <section>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">History</h3>
          {activity.length ? <div className="space-y-1.5">{activity.map((event) => <p key={event.id} className="text-[10px] text-muted">{taskDateTime(event.createdAt)} · {event.message}</p>)}</div> : <p className="text-[11px] text-muted">No task history recorded.</p>}
        </section>
      </div>
    </Modal>
  )
}

export function Tasks() {
  const { tasks, projects, team, updateTask, aiFindings, risks } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [statusFilter] = useState<'All' | TaskStatus>(() => {
    const incoming = location.state?.statusFilter as TaskStatus | undefined
    return incoming && taskStatuses.includes(incoming) ? incoming : 'All'
  })
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const selectedTask = tasks.find((task) => task.id === selectedTaskId)

  const openCreateTask = () => {
    setEditingTask(null)
    setTaskModalOpen(true)
  }

  const openEditTask = (task: Task) => {
    setSelectedTaskId(null)
    setEditingTask(task)
    setTaskModalOpen(true)
  }

  const filtered = useMemo(
    () => tasks.filter((task) => statusFilter === 'All' || task.status === statusFilter),
    [tasks, statusFilter],
  )

  const overdueCount = tasks.filter((task) => task.status !== 'Completed' && task.due < new Date().toISOString().slice(0, 10)).length
  const visibleColumns = statusFilter === 'All' ? taskStatuses : [statusFilter]
  const moveTask = (taskId: string, status: TaskStatus) => {
    const task = tasks.find((item) => item.id === taskId)
    if (task && task.status !== status) updateTask(taskId, { status })
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-7 md:px-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#929692]">Workspace</p>
          <h1 className="font-heading text-[28px] font-semibold tracking-tight text-ink">Tasks</h1>
          <p className="mt-2 text-[13px] text-muted">Project-linked work across NexORA.{overdueCount > 0 && <span className="ml-1 font-medium text-red">{overdueCount} overdue</span>}</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No tasks found" description="There are no tasks in this view yet. Create one to get started." action={<Button onClick={openCreateTask}><span className="inline-flex items-center gap-1.5"><Plus size={13} />Add task</span></Button>} />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex min-h-[65vh] min-w-max items-start gap-3">
            {visibleColumns.map((status) => {
              const columnTasks = filtered.filter((task) => task.status === status)
              return (
                <section
                  key={status}
                  className="flex w-[270px] shrink-0 flex-col rounded-xl border border-line bg-[#f3f4f1] p-2.5 transition-colors data-[drag-over=true]:border-blue data-[drag-over=true]:bg-[#edf3fb]"
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; event.currentTarget.dataset.dragOver = 'true' }}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) delete event.currentTarget.dataset.dragOver }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const taskId = event.dataTransfer.getData('text/task-id')
                    if (taskId) moveTask(taskId, status)
                    delete event.currentTarget.dataset.dragOver
                  }}
                >
                  <div className="mb-2 flex items-center justify-between px-1 py-1">
                    <h2 className="text-[11px] font-bold text-ink">{status}</h2>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-muted">{columnTasks.length}</span>
                  </div>
                  <div className="flex-1 space-y-2.5">
                    {columnTasks.map((task) => {
                      const project = projects.find((item) => item.id === task.projectId)
                      return (
                        <TaskCard
                          key={task.id}
                          task={task}
                          projectName={project?.name ?? 'Project unavailable'}
                          projectId={project?.id ?? task.projectId}
                          team={team}
                          onOpen={(selectedTask) => setSelectedTaskId(selectedTask.id)}
                        />
                      )
                    })}
                    {columnTasks.length === 0 && <div className="rounded-lg border border-dashed border-[#d9dbd5] px-3 py-6 text-center text-[10px] text-muted">Drop a task here</div>}
                  </div>
                  <button onClick={openCreateTask} className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-semibold text-muted transition hover:bg-white hover:text-ink"><Plus size={13} /> Add task</button>
                </section>
              )
            })}
          </div>
        </div>
      )}

      {selectedTask && <TaskDetailsModal task={selectedTask} projects={projects} tasks={tasks} team={team} aiFindings={aiFindings} raids={risks} onClose={() => setSelectedTaskId(null)} onEdit={openEditTask} />}
      {taskModalOpen && <TaskModal open editing={editingTask} onClose={() => { setTaskModalOpen(false); setEditingTask(null) }} onCreated={(id) => navigate(`/tasks/${id}`)} />}
    </div>
  )
}
