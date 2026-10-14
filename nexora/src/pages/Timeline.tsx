import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Flag, ListTodo } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../store'
import { Badge, Card, CardTitle, EmptyState } from '../components/ui'

const PAGE_SIZE = 10

type TimelineEvent = {
  id: string
  date: string
  title: string
  detail: string
  kind: 'Project start' | 'Project deadline' | 'Task deadline' | 'Next follow-up'
  projectId: string
  projectName: string
  taskId?: string
  status?: string
  overdue?: boolean
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthLabel(date: string) {
  const [year, month] = date.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function Timeline() {
  const { projects, tasks } = useApp()
  const [currentPage, setCurrentPage] = useState(1)
  const today = dayKey(new Date())

  const events = useMemo(() => {
    const items: TimelineEvent[] = []
    projects.forEach((project) => {
      if (project.start) items.push({
        id: `project-start-${project.id}`,
        date: project.start,
        title: `${project.name} starts`,
        detail: `${project.status} · ${project.progress}% complete · Manager: ${project.manager || 'Unassigned'}`,
        kind: 'Project start',
        projectId: project.id,
        projectName: project.name,
      })
      if (project.end) items.push({
        id: `project-deadline-${project.id}`,
        date: project.end,
        title: `${project.name} deadline`,
        detail: `${project.status} · ${project.progress}% complete · ${project.health} health`,
        kind: 'Project deadline',
        projectId: project.id,
        projectName: project.name,
        overdue: project.status !== 'Completed' && project.end < today,
      })
    })

    tasks.forEach((task) => {
      const project = projects.find((item) => item.id === task.projectId)
      const projectName = project?.name ?? 'Project unavailable'
      if (task.due) items.push({
        id: `task-due-${task.id}`,
        date: task.due,
        title: task.title,
        detail: `Due date · ${task.assignee || 'Unassigned'} · ${task.status}`,
        kind: 'Task deadline',
        projectId: task.projectId,
        projectName,
        taskId: task.id,
        status: task.status,
        overdue: task.status !== 'Completed' && task.due < today,
      })
      if (task.nextFollowUp) items.push({
        id: `task-follow-up-${task.id}`,
        date: task.nextFollowUp,
        title: `Follow up: ${task.title}`,
        detail: `${task.assignee || 'Unassigned'} · ${task.status}`,
        kind: 'Next follow-up',
        projectId: task.projectId,
        projectName,
        taskId: task.id,
        status: task.status,
        overdue: task.status !== 'Completed' && task.nextFollowUp < today,
      })
    })

    return items.sort((a, b) => a.date.localeCompare(b.date) || a.projectName.localeCompare(b.projectName) || a.title.localeCompare(b.title))
  }, [projects, tasks, today])

  const overdueCount = events.filter((event) => event.overdue).length
  const pageCount = Math.max(1, Math.ceil(events.length / PAGE_SIZE))
  const page = Math.min(currentPage, pageCount)
  const pageEvents = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const firstItem = events.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastItem = Math.min(page * PAGE_SIZE, events.length)
  const groupedEvents = useMemo(() => {
    const groups: { month: string; items: TimelineEvent[] }[] = []
    pageEvents.forEach((event) => {
      const month = monthLabel(event.date)
      const current = groups[groups.length - 1]
      if (current?.month === month) current.items.push(event)
      else groups.push({ month, items: [event] })
    })
    return groups
  }, [pageEvents])

  return (
    <div className="mx-auto w-full max-w-[1500px] px-6 py-8 md:px-8">
      <div className="mb-6">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#929692]">Workspace</p>
        <h1 className="font-heading text-[28px] font-semibold tracking-tight text-ink">Timeline</h1>
        <p className="mt-2 text-[13px] text-muted">One chronological view of project milestones, task deadlines, and follow-ups across your portfolio.</p>
      </div>

      <Card className="flex h-[calc(100vh-260px)] min-h-[320px] flex-col overflow-hidden">
        <div className="shrink-0">
          <CardTitle
            title="Portfolio timeline"
            subtitle={`${events.length} dated milestone${events.length === 1 ? '' : 's'} · Projects and tasks combined`}
            action={overdueCount > 0 ? <Badge tone="red">{overdueCount} overdue</Badge> : <Badge tone="green">On track</Badge>}
          />
        </div>
        {events.length === 0 ? (
          <EmptyState title="No timeline events" description="Add project dates, task deadlines, or follow-up dates to see them here." />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="relative">
                <div className="absolute bottom-3 left-[67px] top-3 w-px bg-[#e7e8e3]" aria-hidden="true" />
                <div className="space-y-5">
                  {groupedEvents.map((group) => (
                    <section key={group.month}>
                      <h2 className="mb-2 pl-[90px] text-[10px] font-bold uppercase tracking-[1.2px] text-muted">{group.month}</h2>
                      <div className="space-y-2">
                        {group.items.map((event) => {
                          const Icon = event.kind === 'Project start' ? Flag : event.kind === 'Project deadline' ? CheckCircle2 : event.kind === 'Task deadline' ? ListTodo : CalendarDays
                          const tone = event.overdue ? 'red' : event.kind === 'Project start' ? 'neutral' : event.kind === 'Next follow-up' ? 'blue' : event.status === 'Completed' ? 'green' : 'amber'
                          return (
                            <div key={event.id} className="relative flex items-stretch gap-3">
                              <div className="w-[55px] shrink-0 pt-2.5 text-right">
                                <p className="text-[11px] font-bold text-ink">{Number(event.date.slice(8, 10))}</p>
                                <p className="text-[9px] text-muted">{new Date(`${event.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</p>
                              </div>
                              <div className="relative z-10 flex w-6 shrink-0 justify-center pt-2.5">
                                <span className={`grid h-5 w-5 place-items-center rounded-full border bg-white ${event.overdue ? 'border-red text-red' : 'border-line text-muted'}`}><CircleDot size={11} /></span>
                              </div>
                              <div className={`mb-1 min-w-0 flex-1 rounded-xl border p-2.5 transition hover:shadow-soft ${event.overdue ? 'border-red/20 bg-[#fffafa]' : 'border-line bg-white hover:border-[#c9cbc5]'}`}>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                      <Badge tone={tone}><span className="inline-flex items-center gap-1"><Icon size={11} />{event.kind}</span></Badge>
                                      {event.overdue && <Badge tone="red">Overdue</Badge>}
                                      {event.status === 'Completed' && <Badge tone="green">Completed</Badge>}
                                    </div>
                                    <h3 className="text-[12px] font-semibold text-ink">
                                      {event.taskId ? <Link to={`/tasks/${event.taskId}`} className="hover:text-blue hover:underline">{event.title}</Link> : event.title}
                                    </h3>
                                    <p className="mt-1 text-[10px] text-muted">{event.detail}</p>
                                  </div>
                                  <Link to={`/projects/${event.projectId}`} className="inline-flex shrink-0 items-center rounded-md bg-[#f1f2ef] px-2 py-1 text-[10px] font-semibold text-[#535854] hover:bg-[#e8e9e5]">{event.projectName}</Link>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 flex shrink-0 flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] text-muted">Showing {firstItem}–{lastItem} of {events.length} timeline items · {PAGE_SIZE} per page</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setCurrentPage(page - 1)}
                  className="rounded-lg border border-line bg-white px-3 py-1.5 text-[10px] font-semibold text-ink transition hover:bg-[#f7f7f5] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="inline-flex items-center gap-1"><ChevronLeft size={12} />Previous</span>
                </button>
                <span className="min-w-[72px] text-center text-[10px] font-medium text-muted">Page {page} of {pageCount}</span>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setCurrentPage(page + 1)}
                  className="rounded-lg border border-line bg-white px-3 py-1.5 text-[10px] font-semibold text-ink transition hover:bg-[#f7f7f5] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="inline-flex items-center gap-1">Next<ChevronRight size={12} /></span>
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
