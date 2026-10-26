import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { dateKey, todayKey } from '../lib/dates'
import { Badge, Card, CardTitle } from '../components/ui'

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CalendarPage() {
  const { tasks, meetings, projects } = useApp()
  const [currentDate, setCurrentDate] = useState(new Date())

  const days = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const startOffset = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: { date: Date; inMonth: boolean }[] = []
    for (let i = 0; i < startOffset; i++) cells.push({ date: new Date(year, month, -startOffset + i + 1), inMonth: false })
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), inMonth: true })
    while (cells.length % 7 !== 0) cells.push({ date: new Date(year, month + 1, cells.length - daysInMonth - startOffset + 1), inMonth: false })
    return cells
  }, [currentDate])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, { title: string; tone: 'red' | 'amber' | 'green' | 'blue' }[]>()
    tasks.forEach((task) => {
      const list = map.get(task.due) ?? []
      const project = projects.find((p) => p.id === task.projectId)
      const taskTone: 'red' | 'amber' | 'green' | 'blue' =
        task.status === 'Completed' ? 'green' : task.status === 'Blocked' ? 'red' : task.status === 'In Progress' ? 'blue' : 'amber'
      list.push({ title: `${task.title}${project ? ` · ${project.name}` : ''}`, tone: taskTone })
      map.set(task.due, list)
    })
    meetings.forEach((meeting) => {
      const list = map.get(meeting.date) ?? []
      list.push({ title: `${meeting.title} · ${meeting.time}`, tone: 'amber' })
      map.set(meeting.date, list)
    })
    return map
  }, [tasks, meetings, projects])

  const today = todayKey()

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#929692]">Workspace</p>
          <h1 className="font-heading text-[28px] font-semibold tracking-tight text-ink">Calendar</h1>
          <p className="mt-2 text-[13px] text-muted">Deadlines, meetings and milestones in one view.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12px] text-ink transition hover:bg-[#f7f7f5]"
          >
            ←
          </button>
          <p className="min-w-[140px] text-center font-heading text-[14px] font-semibold text-ink">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12px] text-ink transition hover:bg-[#f7f7f5]"
          >
            →
          </button>
        </div>
      </div>

      <Card>
        <CardTitle title={`${currentDate.toLocaleDateString('en-US', { month: 'long' })} ${currentDate.getFullYear()}`} subtitle="Tasks, meetings and deadlines" />
        <div className="overflow-x-auto">
        <div key={currentDate.toISOString()} className="page-enter grid min-w-[560px] grid-cols-7 gap-1.5">
          {dayLabels.map((day) => (
            <div key={day} className="pb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">{day}</div>
          ))}
          {days.map(({ date, inMonth }, i) => {
            const iso = dateKey(date)
            const events = eventsByDate.get(iso) ?? []
            return (
              <div
                key={i}
                className={`min-h-[90px] rounded-lg border p-2 transition ${
                  iso === today ? 'border-ink bg-[#fafaf8]' : 'border-line bg-white'
                } ${!inMonth ? 'opacity-40' : ''}`}
              >
                <p className={`text-[10px] ${iso === today ? 'font-bold text-ink' : 'text-muted'}`}>
                  {date.getDate()}
                  {iso === today && <span className="ml-1 text-[8px] uppercase text-ink">Today</span>}
                </p>
                <div className="mt-2 space-y-1">
                  {events.slice(0, 2).map((event, j) => (
                    <div
                      key={j}
                      className={`truncate rounded px-1.5 py-[3px] text-[8px] ${
                        event.tone === 'red'
                          ? 'bg-[#fbeaea] text-red'
                          : event.tone === 'amber'
                            ? 'bg-[#fff3df] text-amber'
                            : event.tone === 'green'
                              ? 'bg-[#e8f2ed] text-green'
                              : 'bg-[#e8effa] text-blue'
                      }`}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                  {events.length > 2 && <p className="text-[8px] text-muted">+{events.length - 2} more</p>}
                </div>
              </div>
            )
          })}
        </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-muted">
          <Badge tone="blue">In Progress</Badge>
          <Badge tone="amber">Scheduled / Review</Badge>
          <Badge tone="green">Done</Badge>
          <Badge tone="red">Blocked / On Hold</Badge>
        </div>
      </Card>
    </div>
  )
}
