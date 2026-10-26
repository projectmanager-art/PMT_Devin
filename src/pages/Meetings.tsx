import { useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Copy, ExternalLink, Filter, Plus, Search, Settings2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp, type Meeting, type MeetingType } from '../store'
import { Badge, Button, Card, CardTitle, EmptyState, Field, FormErrorSummary, Modal, TextButton, inputClass, invalidInputClass } from '../components/ui'

const meetingTypes: MeetingType[] = ['Client meeting', 'Internal meeting', 'Project review', 'Discovery call', 'Sprint review', 'Follow-up', 'Other']
const localToday = () => dateKey(new Date())
const uid = () => Math.random().toString(36).slice(2, 9)

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function to24Hour(time: string) {
  if (!time) return ''
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return /^\d{2}:\d{2}$/.test(time) ? time : ''
  let hour = Number(match[1]) % 12
  if (match[3].toUpperCase() === 'PM') hour += 12
  return `${String(hour).padStart(2, '0')}:${match[2]}`
}

function displayTime(meeting: Meeting) {
  if (meeting.startTime && meeting.endTime) return `${meeting.startTime}–${meeting.endTime}`
  return meeting.time || 'Time not set'
}

function safeMeetUrl(value?: string) {
  if (!value) return ''
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return ''
  }
}

function displayDate(date: string) {
  if (!date) return 'Date not set'
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function parseList(value: string) {
  return value.split(/[;,\n]/).map((entry) => entry.trim()).filter(Boolean)
}

function parseActionItems(value: string) {
  return value.split('\n').map((entry) => entry.trim()).filter(Boolean)
}

function actionItemKey(index: number, text: string) {
  return `${index}:${text.trim()}`
}

export function ScheduleMeetingModal({
  open,
  onClose,
  editing,
  defaultDate,
  defaultProjectId,
}: {
  open: boolean
  onClose: () => void
  editing?: Meeting | null
  defaultDate: string
  defaultProjectId?: string
}) {
  const { addMeeting, updateMeeting, projects, clients, tasks, team } = useApp()
  const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const [errors, setErrors] = useState<Record<string, string>>({})
  const initialForm = () => ({
    title: editing?.title ?? '',
    description: editing?.description ?? '',
    type: editing?.type ?? ('Client meeting' as MeetingType),
    clientId: editing?.clientId ?? '',
    projectId: editing?.projectId ?? defaultProjectId ?? '',
    taskId: editing?.taskId ?? '',
    date: editing?.date ?? defaultDate,
    startTime: editing?.startTime ?? to24Hour(editing?.time ?? ''),
    endTime: editing?.endTime ?? '',
    timezone: editing?.timezone ?? (editing ? '' : currentTimezone),
    responsible: editing?.responsible ?? team[0]?.name ?? '',
    participants: editing?.participants ?? '',
    attendeeEmails: (editing?.attendeeEmails ?? []).join(', '),
    agenda: editing?.agenda ?? editing?.discussion ?? '',
    notes: editing?.notes ?? '',
    discussion: editing?.discussion ?? '',
    decisions: editing?.decisions ?? '',
    actionItems: editing?.actionItems ?? '',
    deadline: editing?.deadline ?? '',
    provider: editing?.provider ?? 'Not set',
    reminderMinutes: editing?.reminderMinutes ?? [60],
  })
  const [form, setForm] = useState(initialForm)

  const update = (key: string, value: unknown) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const submit = () => {
    const next: Record<string, string> = {}
    if (!form.title.trim()) next.title = 'Meeting title is required.'
    if (!form.date) next.date = 'Meeting date is required.'
    if (!form.startTime) next.startTime = 'Start time is required.'
    if (!form.endTime) next.endTime = 'End time is required.'
    if (form.startTime && form.endTime && form.startTime >= form.endTime) next.endTime = 'End time must be after the start time.'
    if (!form.timezone) next.timezone = 'Choose the meeting timezone.'
    if (form.attendeeEmails.trim()) {
      const invalidEmail = parseList(form.attendeeEmails).find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      if (invalidEmail) next.attendeeEmails = `Enter a valid email address for ${invalidEmail}.`
    }
    if (form.deadline && form.date && form.deadline < form.date) next.deadline = 'Action deadline cannot be before the meeting date.'
    setErrors(next)
    if (Object.keys(next).length) return

    const selectedProject = projects.find((project) => project.id === form.projectId)
    const selectedClient = clients.find((client) => client.id === form.clientId)
    const legacyTime = new Date(`2000-01-01T${form.startTime}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      clientId: form.clientId,
      projectId: form.projectId,
      taskId: form.taskId,
      date: form.date,
      time: legacyTime,
      startTime: form.startTime,
      endTime: form.endTime,
      timezone: form.timezone,
      responsible: form.responsible,
      participants: form.participants.trim(),
      attendeeEmails: parseList(form.attendeeEmails),
      agenda: form.agenda.trim(),
      notes: form.notes.trim(),
      discussion: form.discussion.trim() || form.agenda.trim(),
      decisions: form.decisions.trim(),
      actionItems: form.actionItems.trim(),
      deadline: form.deadline,
      provider: form.provider as Meeting['provider'],
      conferenceStatus: 'not-configured' as const,
      syncStatus: 'not-configured' as const,
      reminderMinutes: form.reminderMinutes,
      clientName: selectedClient?.name ?? '',
      projectName: selectedProject?.name ?? '',
      status: editing?.status ?? 'Scheduled' as const,
      convertedActionItemLines: editing?.convertedActionItemLines ?? [],
      linkedTaskIds: editing?.linkedTaskIds ?? {},
      history: editing?.history ?? [],
    }
    if (editing) updateMeeting(editing.id, payload)
    else addMeeting(payload)
    onClose()
  }

  const timezones = Array.from(new Set([currentTimezone, 'UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'Europe/London', 'Europe/Paris', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney']))
  const relatedTasks = tasks.filter((task) => !form.projectId || task.projectId === form.projectId)

  return (
    <Modal
      open={open}
      title={editing ? 'Edit / reschedule meeting' : 'Schedule meeting'}
      onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>{editing ? 'Save changes' : 'Save meeting'}</Button></>}
    >
      <FormErrorSummary errors={errors} />
      <div className="form-stagger grid max-h-[72vh] grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2">
        <Field label="Meeting title" required error={errors.title} className="md:col-span-2">
          <input className={errors.title ? invalidInputClass : inputClass} aria-invalid={!!errors.title} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Atlas project kickoff" />
        </Field>
        <Field label="Meeting type">
          <select className={inputClass} value={form.type} onChange={(e) => update('type', e.target.value)}>{meetingTypes.map((type) => <option key={type}>{type}</option>)}</select>
        </Field>
        <Field label="Organizer">
          <select className={inputClass} value={form.responsible} onChange={(e) => update('responsible', e.target.value)}>
            <option value="">Select organizer</option>
            {team.map((member) => <option key={member.id}>{member.name}</option>)}
          </select>
        </Field>
        <Field label="Client">
          <select className={inputClass} value={form.clientId} onChange={(e) => update('clientId', e.target.value)}>
            <option value="">No client linked</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </Field>
        <Field label="Project">
          <select className={inputClass} value={form.projectId} onChange={(e) => { update('projectId', e.target.value); update('taskId', '') }}>
            <option value="">No project linked</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </Field>
        <Field label="Related task">
          <select className={inputClass} value={form.taskId} onChange={(e) => update('taskId', e.target.value)}>
            <option value="">No task linked</option>
            {relatedTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
          </select>
        </Field>
        <Field label="Date" required error={errors.date}>
          <input type="date" className={errors.date ? invalidInputClass : inputClass} aria-invalid={!!errors.date} value={form.date} onChange={(e) => update('date', e.target.value)} />
        </Field>
        <Field label="Timezone" required error={errors.timezone}>
          <select className={errors.timezone ? invalidInputClass : inputClass} aria-invalid={!!errors.timezone} value={form.timezone} onChange={(e) => update('timezone', e.target.value)}>
            <option value="">Select timezone</option>
            {timezones.map((zone) => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
          </select>
        </Field>
        <Field label="Start time" required error={errors.startTime}>
          <input type="time" className={errors.startTime ? invalidInputClass : inputClass} aria-invalid={!!errors.startTime} value={form.startTime} onChange={(e) => update('startTime', e.target.value)} />
        </Field>
        <Field label="End time" required error={errors.endTime}>
          <input type="time" className={errors.endTime ? invalidInputClass : inputClass} aria-invalid={!!errors.endTime} value={form.endTime} onChange={(e) => update('endTime', e.target.value)} />
        </Field>
        <p className="col-span-full -mt-2 text-[10px] text-muted">Times will be interpreted in the selected timezone: {form.timezone || 'choose a timezone'}.</p>
        <Field label="Internal participants" className="md:col-span-2">
          <input className={inputClass} value={form.participants} onChange={(e) => update('participants', e.target.value)} placeholder="Names, comma separated" />
        </Field>
        <Field label="Client attendee emails" error={errors.attendeeEmails} className="md:col-span-2">
          <input className={errors.attendeeEmails ? invalidInputClass : inputClass} aria-invalid={!!errors.attendeeEmails} value={form.attendeeEmails} onChange={(e) => update('attendeeEmails', e.target.value)} placeholder="name@example.com, other@example.com" />
        </Field>
        <Field label="Description" className="md:col-span-2">
          <textarea rows={2} className={inputClass} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Purpose and context for this meeting" />
        </Field>
        <Field label="Agenda" className="md:col-span-2">
          <textarea rows={3} className={inputClass} value={form.agenda} onChange={(e) => update('agenda', e.target.value)} placeholder="Topics to cover" />
        </Field>
        <Field label="Discussion / MOM" className="md:col-span-2">
          <textarea rows={3} className={inputClass} value={form.discussion} onChange={(e) => update('discussion', e.target.value)} placeholder="Discussion notes (can be completed after the meeting)" />
        </Field>
        <Field label="Decisions" className="md:col-span-2">
          <textarea rows={2} className={inputClass} value={form.decisions} onChange={(e) => update('decisions', e.target.value)} placeholder="Decisions made" />
        </Field>
        <Field label="Action items" className="md:col-span-2">
          <textarea rows={3} className={inputClass} value={form.actionItems} onChange={(e) => update('actionItems', e.target.value)} placeholder="One action per line" />
        </Field>
        <Field label="Action deadline">
          <input type="date" className={errors.deadline ? invalidInputClass : inputClass} aria-invalid={!!errors.deadline} value={form.deadline} onChange={(e) => update('deadline', e.target.value)} />
        </Field>
        <Field label="Video meeting provider">
          <select className={inputClass} value={form.provider} onChange={(e) => update('provider', e.target.value)}>
            <option value="Not set">Not set</option>
            <option value="Google Meet">Google Meet (requires Google connection)</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label="Reminders">
          <select multiple className={`${inputClass} min-h-[74px]`} value={form.reminderMinutes.map(String)} onChange={(e) => update('reminderMinutes', Array.from(e.target.selectedOptions).map((option) => Number(option.value)))}>
            <option value="1440">24 hours before</option>
            <option value="60">1 hour before</option>
            <option value="15">15 minutes before</option>
          </select>
        </Field>
        <div className="col-span-full rounded-lg border border-[#f1ddbd] bg-[#fff9ed] p-3 text-[11px] text-[#815e27]">
          Google Calendar, Meet link generation, and email invitations are not configured in this workspace. Saving here stores the meeting in NexORA only; it does not send invitations or create a video link.
        </div>
      </div>
    </Modal>
  )
}

function MiniCalendar({
  meetings,
  selectedDate,
  month,
  onSelectDate,
  onChangeMonth,
  onSelectMeeting,
  expanded,
  view,
  onViewChange,
  onToggleExpanded,
  onSchedule,
}: {
  meetings: Meeting[]
  selectedDate: string
  month: Date
  onSelectDate: (date: string) => void
  onChangeMonth: (month: Date) => void
  onSelectMeeting: (meeting: Meeting) => void
  expanded: boolean
  view: 'month' | 'week' | 'day'
  onViewChange: (view: 'month' | 'week' | 'day') => void
  onToggleExpanded: () => void
  onSchedule: (date: string) => void
}) {
  const days = useMemo(() => {
    if (view === 'day') return [new Date(`${selectedDate}T12:00:00`)]
    if (view === 'week') {
      const date = new Date(`${selectedDate}T12:00:00`)
      const mondayOffset = (date.getDay() + 6) % 7
      date.setDate(date.getDate() - mondayOffset)
      return Array.from({ length: 7 }, (_, index) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + index))
    }
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const mondayOffset = (first.getDay() + 6) % 7
    return Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - mondayOffset + 1))
  }, [view, selectedDate, month])
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const title = view === 'day'
    ? displayDate(selectedDate)
    : view === 'week'
      ? `Week of ${displayDate(dateKey(days[0]))}`
      : month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const shiftRange = (direction: -1 | 1) => {
    if (view === 'month') {
      onChangeMonth(new Date(month.getFullYear(), month.getMonth() + direction, 1))
      return
    }
    const date = new Date(`${selectedDate}T12:00:00`)
    date.setDate(date.getDate() + direction * (view === 'week' ? 7 : 1))
    onSelectDate(dateKey(date))
    onChangeMonth(new Date(date.getFullYear(), date.getMonth(), 1))
  }

  return (
    <Card className={expanded ? 'w-full' : ''}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button className="rounded-lg p-1.5 text-muted hover:bg-[#f0f1ed] hover:text-ink" aria-label="Previous" onClick={() => shiftRange(-1)}><ChevronLeft size={16} /></button>
          <p className="min-w-[120px] text-center text-[12px] font-semibold text-ink">{title}</p>
          <button className="rounded-lg p-1.5 text-muted hover:bg-[#f0f1ed] hover:text-ink" aria-label="Next" onClick={() => shiftRange(1)}><ChevronRight size={16} /></button>
        </div>
        <div className="flex items-center gap-1">
          {(['month', 'week', 'day'] as const).map((item) => (
            <button key={item} onClick={() => onViewChange(item)} className={`rounded px-2 py-1 text-[9px] font-semibold capitalize ${view === item ? 'bg-ink text-white' : 'text-muted hover:bg-[#f0f1ed]'}`}>{item}</button>
          ))}
          <button className="rounded p-1 text-muted hover:bg-[#f0f1ed]" title={expanded ? 'Collapse calendar' : 'Expand calendar'} onClick={onToggleExpanded}><ExternalLink size={13} /></button>
        </div>
      </div>
      <div key={`${month.toISOString()}-${view}`} className="page-enter grid grid-cols-7 gap-1">
        {weekdays.map((day) => <div key={day} className="pb-1 text-center text-[9px] font-semibold uppercase text-muted">{day}</div>)}
        {days.map((date) => {
          const key = dateKey(date)
          const dayMeetings = meetings.filter((meeting) => meeting.date === key)
          const inMonth = date.getMonth() === month.getMonth()
          return (
            <button
              key={key}
              onClick={() => { onSelectDate(key); onSchedule(key) }}
              className={`min-h-[74px] overflow-hidden rounded-md border p-1 text-left transition hover:border-ink/40 hover:bg-[#fafaf8] ${selectedDate === key ? 'border-ink bg-[#f6f6f3]' : 'border-line bg-white'} ${view === 'month' && !inMonth ? 'opacity-40' : ''} ${view !== 'month' ? 'min-h-[115px]' : ''}`}
              title={`Schedule meeting on ${displayDate(key)}`}
            >
              <span className={`block text-[9px] ${key === localToday() ? 'font-bold text-blue' : 'text-muted'}`}>{date.getDate()}</span>
              <span className="mt-1 block space-y-1">
                {dayMeetings.slice(0, expanded ? 3 : 1).map((meeting) => (
                  <span
                    key={meeting.id}
                    role="button"
                    tabIndex={0}
                    onClick={(event) => { event.stopPropagation(); onSelectMeeting(meeting) }}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); onSelectMeeting(meeting) } }}
                    className="block truncate rounded bg-[#fff3df] px-1 py-0.5 text-[8px] font-medium text-amber hover:bg-[#ffe8c2]"
                    title={meeting.title}
                  >{meeting.startTime ? `${meeting.startTime} ` : ''}{meeting.title}</span>
                ))}
                {dayMeetings.length > (expanded ? 3 : 1) && <span className="block text-[8px] text-muted">+{dayMeetings.length - (expanded ? 3 : 1)} more</span>}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button className="text-[10px] font-semibold text-muted hover:text-ink" onClick={() => { onChangeMonth(new Date()); onSelectDate(localToday()) }}>Today</button>
        <Button variant="secondary" onClick={() => onSchedule(selectedDate)}><Plus size={12} className="mr-1 inline" />Schedule</Button>
      </div>
    </Card>
  )
}

function MeetingDetail({
  meeting,
  onClose,
  onEdit,
  onCancelMeeting,
  onDelete,
  onConvert,
  projects,
  clients,
  tasks,
}: {
  meeting: Meeting
  onClose: () => void
  onEdit: () => void
  onCancelMeeting: () => void
  onDelete: () => void
  onConvert: (index: number, item: string) => void
  projects: ReturnType<typeof useApp>['projects']
  clients: ReturnType<typeof useApp>['clients']
  tasks: ReturnType<typeof useApp>['tasks']
}) {
  const [copied, setCopied] = useState(false)
  const actionLines = parseActionItems(meeting.actionItems)
  const project = projects.find((item) => item.id === meeting.projectId)
  const client = clients.find((item) => item.id === meeting.clientId)
  const relatedTask = tasks.find((item) => item.id === meeting.taskId)
  const meetUrl = safeMeetUrl(meeting.meetUrl)

  const copyDetails = async () => {
    const details = `${meeting.title}\n${displayDate(meeting.date)} · ${displayTime(meeting)} (${meeting.timezone ?? 'timezone not specified'})\n${meeting.agenda || meeting.discussion || ''}${meeting.attendeeEmails?.length ? `\nAttendees: ${meeting.attendeeEmails.join(', ')}` : ''}`
    try {
      await navigator.clipboard.writeText(details)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const copyMeetLink = async () => {
    if (!meetUrl) return
    try {
      await navigator.clipboard.writeText(meetUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Modal open title={meeting.title} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button variant="secondary" onClick={onEdit}>Edit / reschedule</Button>{meeting.status !== 'Cancelled' && <Button variant="secondary" onClick={onCancelMeeting}>Cancel meeting</Button>}</>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meeting.status === 'Cancelled' ? 'red' : meeting.status === 'Completed' ? 'green' : 'blue'}>{meeting.status ?? 'Scheduled'}</Badge>
          <Badge tone="neutral">{meeting.type ?? 'Meeting'}</Badge>
          {(meeting.conferenceStatus ?? 'not-configured') === 'ready' && meetUrl ? <><a className="text-[11px] font-semibold text-blue underline" href={meetUrl} target="_blank" rel="noreferrer">Join Google Meet</a><TextButton onClick={copyMeetLink}><span className="inline-flex items-center gap-1"><Copy size={11} />{copied ? 'Copied' : 'Copy link'}</span></TextButton></> : <span className="text-[10px] text-muted">{meeting.conferenceStatus === 'pending' ? 'Google Meet link is being generated.' : meeting.conferenceStatus === 'failed' ? `Meet link generation failed: ${meeting.lastSyncError ?? 'Google connection unavailable.'}` : 'Meet link unavailable — Google connection is not configured.'}</span>}
        </div>
        <div className="grid gap-3 rounded-lg bg-[#fafaf8] p-3 text-[12px] sm:grid-cols-2">
          <p><span className="text-muted">When:</span> <span className="font-medium text-ink">{displayDate(meeting.date)} · {displayTime(meeting)}</span></p>
          <p><span className="text-muted">Timezone:</span> <span className="font-medium text-ink">{meeting.timezone ?? 'Not specified'}</span></p>
          <p><span className="text-muted">Organizer:</span> <span className="font-medium text-ink">{meeting.responsible || '—'}</span></p>
          <p><span className="text-muted">Client:</span> <span className="font-medium text-ink">{client?.name ?? meeting.clientName ?? '—'}</span></p>
          <p><span className="text-muted">Project:</span> <span className="font-medium text-ink">{project?.name ?? meeting.projectName ?? '—'}</span></p>
          <p><span className="text-muted">Related task:</span> <span className="font-medium text-ink">{relatedTask?.title ?? '—'}</span></p>
        </div>
        {meeting.description && <section><h3 className="text-[11px] font-bold uppercase text-muted">Description</h3><p className="mt-1 whitespace-pre-wrap text-[12px] text-ink">{meeting.description}</p></section>}
        {meeting.notes && <section><h3 className="text-[11px] font-bold uppercase text-muted">Preparation notes</h3><p className="mt-1 whitespace-pre-wrap text-[12px] text-ink">{meeting.notes}</p></section>}
        <section><h3 className="text-[11px] font-bold uppercase text-muted">Attendees</h3><p className="mt-1 text-[12px] text-ink">{meeting.participants || 'No internal participants listed.'}</p>{meeting.attendeeEmails?.length ? <p className="mt-1 text-[11px] text-muted">{meeting.attendeeEmails.join(', ')}</p> : null}</section>
        <section><h3 className="text-[11px] font-bold uppercase text-muted">Agenda</h3><p className="mt-1 whitespace-pre-wrap text-[12px] text-ink">{meeting.agenda || meeting.discussion || 'No agenda recorded.'}</p></section>
        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded-lg border border-line p-3"><h3 className="text-[10px] font-bold uppercase text-muted">Discussion / MOM</h3><p className="mt-1 whitespace-pre-wrap text-[12px] text-ink">{meeting.discussion || '—'}</p></section>
          <section className="rounded-lg border border-line p-3"><h3 className="text-[10px] font-bold uppercase text-muted">Decisions</h3><p className="mt-1 whitespace-pre-wrap text-[12px] text-ink">{meeting.decisions || '—'}</p></section>
        </div>
        <section>
          <h3 className="mb-2 text-[11px] font-bold uppercase text-muted">Action items</h3>
          {actionLines.length === 0 ? <p className="text-[12px] text-muted">No action items.</p> : <div className="space-y-2">{actionLines.map((item, index) => {
            const actionId = actionItemKey(index, item)
            const converted = meeting.convertedActionItemLines?.includes(actionId) ?? false
            const linkedTaskId = meeting.linkedTaskIds?.[actionId]
            const linkedTask = linkedTaskId ? tasks.find((task) => task.id === linkedTaskId) : undefined
            return <div key={`${actionId}-${item}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2.5"><span className="text-[12px] text-ink">{item}</span>{linkedTask ? <Link to={`/tasks/${linkedTask.id}`} onClick={onClose} className="text-[10px] font-semibold text-blue hover:underline">Task: {linkedTask.title}</Link> : converted ? <Badge tone="green">Task linked</Badge> : <Button variant="secondary" onClick={() => onConvert(index, item)}>Convert to task</Button>}</div>
          })}</div>}
          {meeting.deadline && <p className="mt-2 text-[10px] text-muted">Target deadline: {meeting.deadline} · Responsible: {meeting.responsible || 'Unassigned'}</p>}
          {!!meeting.reminderMinutes?.length && <p className="mt-1 text-[10px] text-muted">Reminder preferences saved: {meeting.reminderMinutes.map((minutes) => minutes === 1440 ? '24h' : `${minutes}m`).join(', ')} (notifications are not scheduled in this frontend-only app).</p>}
        </section>
        <section className="rounded-lg border border-line p-3">
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[11px] font-bold uppercase text-muted">Meeting history</h3><TextButton onClick={copyDetails}><span className="inline-flex items-center gap-1"><Copy size={12} />{copied ? 'Copied details' : 'Copy details'}</span></TextButton></div>
          {(meeting.history ?? []).length ? <div className="space-y-1">{[...(meeting.history ?? [])].reverse().map((event) => <p key={event.id} className="text-[10px] text-muted">{new Date(event.at).toLocaleString()} · {event.message}</p>)}</div> : <p className="text-[10px] text-muted">No history available for this legacy meeting.</p>}
        </section>
        {meeting.googleCalendarEventId && <p className="text-[10px] text-muted">Google Calendar event reference: {meeting.googleCalendarEventId}</p>}
        <Button variant="ghost" className="text-red" onClick={onDelete}>Delete meeting</Button>
      </div>
    </Modal>
  )
}

export function Meetings() {
  const { meetings, deleteMeeting, addTask, updateMeeting, projects, clients, tasks } = useApp()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Meeting | null>(null)
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [selectedDate, setSelectedDate] = useState(localToday())
  const [month, setMonth] = useState(() => new Date())
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [expandedCalendar, setExpandedCalendar] = useState(false)
  const [tab, setTab] = useState<'upcoming' | 'past' | 'client'>('upcoming')
  const [query, setQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const convertingActionItems = useRef(new Set<string>())

  const selectDate = (date: string) => {
    setSelectedDate(date)
    const [year, monthIndex] = date.split('-').map(Number)
    setMonth(new Date(year, monthIndex - 1, 1))
  }

  const openCreate = (date = selectedDate) => {
    setEditing(null)
    selectDate(date)
    setModalOpen(true)
  }

  const filteredMeetings = useMemo(() => {
    const today = localToday()
    const q = query.trim().toLowerCase()
    return meetings
      .filter((meeting) => tab === 'client' ? (meeting.type === 'Client meeting' || !!meeting.clientId) : tab === 'past' ? (meeting.date < today || meeting.status === 'Completed') : (meeting.date >= today && meeting.status !== 'Cancelled'))
      .filter((meeting) => projectFilter === 'all' || meeting.projectId === projectFilter)
      .filter((meeting) => clientFilter === 'all' || meeting.clientId === clientFilter)
      .filter((meeting) => typeFilter === 'all' || meeting.type === typeFilter)
      .filter((meeting) => !q || meeting.title.toLowerCase().includes(q) || meeting.participants.toLowerCase().includes(q) || meeting.attendeeEmails?.some((email) => email.toLowerCase().includes(q)))
      .sort((a, b) => `${a.date}T${a.startTime ?? ''}`.localeCompare(`${b.date}T${b.startTime ?? ''}`))
  }, [meetings, tab, projectFilter, clientFilter, typeFilter, query])

  const selectedDayMeetings = useMemo(() => meetings.filter((meeting) => meeting.date === selectedDate).sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')), [meetings, selectedDate])

  const convertActionItem = (meeting: Meeting, index: number, text: string) => {
    const actionId = actionItemKey(index, text)
    const conversionKey = `${meeting.id}:${actionId}`
    if (meeting.convertedActionItemLines?.includes(actionId) || convertingActionItems.current.has(conversionKey)) return
    const projectId = meeting.projectId || projects[0]?.id || ''
    if (!projectId) {
      window.alert('Link this meeting to a project before converting its action item to a task.')
      return
    }
    convertingActionItems.current.add(conversionKey)
    const now = new Date().toISOString()
    const id = addTask({
      title: text,
      projectId,
      assignee: meeting.responsible || 'Unassigned',
      status: 'To Do',
      priority: 'Medium',
      due: meeting.deadline || meeting.date,
      estimatedHours: 4,
      actualHours: 0,
      description: `Action item created from meeting: ${meeting.title}`,
      acceptanceCriteria: '',
      labels: [],
      taskComments: [{ id: uid(), text: `From meeting: ${meeting.title}`, author: meeting.responsible || 'Unassigned', createdAt: now, updatedAt: now }],
      activity: [],
      dependencies: [],
    })
    const lines = [...(meeting.convertedActionItemLines ?? []), actionId]
    const taskIds = { ...(meeting.linkedTaskIds ?? {}), [actionId]: id }
    updateMeeting(meeting.id, { convertedActionItemLines: lines, linkedTaskIds: taskIds })
    setSelectedMeeting({ ...meeting, convertedActionItemLines: lines, linkedTaskIds: taskIds })
    navigate(`/tasks/${id}`)
  }

  const cancelSelectedMeeting = () => {
    if (!selectedMeeting || !window.confirm(`Cancel "${selectedMeeting.title}" in NexORA? No external invitation will be sent.`)) return
    updateMeeting(selectedMeeting.id, { status: 'Cancelled' })
    setSelectedMeeting({ ...selectedMeeting, status: 'Cancelled' })
  }

  const deleteSelectedMeeting = () => {
    if (!selectedMeeting || !window.confirm(`Delete meeting "${selectedMeeting.title}" from NexORA?`)) return
    deleteMeeting(selectedMeeting.id)
    setSelectedMeeting(null)
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#929692]">Operations</p>
          <h1 className="font-heading text-[28px] font-semibold tracking-tight text-ink">Meetings &amp; MOM</h1>
          <p className="mt-2 text-[13px] text-muted">Schedule client sessions, capture decisions, and keep follow-up work connected.</p>
        </div>
        <Button onClick={() => openCreate()}><span className="flex items-center gap-1.5"><Plus size={14} /> Schedule meeting</span></Button>
      </div>

      <div className={`grid gap-5 ${expandedCalendar ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_370px]'}`}>
        {expandedCalendar && (
          <div className="section-enter">
            <MiniCalendar meetings={meetings} selectedDate={selectedDate} month={month} onSelectDate={selectDate} onChangeMonth={setMonth} onSelectMeeting={setSelectedMeeting} expanded={expandedCalendar} view={view} onViewChange={setView} onToggleExpanded={() => setExpandedCalendar(false)} onSchedule={openCreate} />
          </div>
        )}
        <section className="min-w-0 space-y-5">
          <Card className="pb-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-1 rounded-xl bg-[#f0f1ed] p-1">
                {(['upcoming', 'past', 'client'] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-lg px-3 py-2 text-[11px] font-semibold capitalize transition ${tab === item ? 'bg-white text-ink shadow-soft' : 'text-muted hover:text-ink'}`}>{item === 'client' ? 'Client meetings' : `${item} meetings`}</button>)}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-[36px] min-w-[190px] flex-1 items-center gap-2 rounded-lg border border-line bg-white px-3 text-muted xl:flex-none"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search meetings..." className="w-full bg-transparent text-[11px] text-ink outline-none placeholder:text-[#aaa]" /></div>
                <select aria-label="Filter by project" className="h-[36px] rounded-lg border border-line bg-white px-2 text-[10px] text-ink" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}><option value="all">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
                <select aria-label="Filter by client" className="h-[36px] rounded-lg border border-line bg-white px-2 text-[10px] text-ink" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}><option value="all">All clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
                <select aria-label="Filter by type" className="h-[36px] rounded-lg border border-line bg-white px-2 text-[10px] text-ink" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">All types</option>{meetingTypes.map((type) => <option key={type}>{type}</option>)}</select>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between px-1">
            <div><h2 className="font-heading text-[16px] font-semibold text-ink">{tab === 'client' ? 'Client meetings' : tab === 'past' ? 'Past meetings' : 'Upcoming meetings'}</h2><p className="mt-0.5 text-[10px] text-muted">{filteredMeetings.length} meeting{filteredMeetings.length === 1 ? '' : 's'}</p></div>
            <span className="flex items-center gap-1 text-[10px] text-muted"><Filter size={12} /> Local NexORA meetings</span>
          </div>
          {filteredMeetings.length === 0 ? (
            <EmptyState title="No meetings match" description="Schedule a meeting or adjust the current search and filters." action={<Button onClick={() => openCreate()}>Schedule meeting</Button>} />
          ) : (
            <div key={tab} className="page-enter space-y-3">
              {filteredMeetings.map((meeting) => {
                const project = projects.find((item) => item.id === meeting.projectId)
                const client = clients.find((item) => item.id === meeting.clientId)
                return (
                  <Card key={meeting.id} className="cursor-pointer p-4 hover:border-[#c9cbc5]" onClick={() => setSelectedMeeting(meeting)}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#f0f1ed] text-center"><span className="text-[9px] font-bold uppercase text-muted">{meeting.date ? meeting.date.slice(5, 7) : '—'}</span><span className="text-[16px] font-bold leading-none text-ink">{meeting.date ? Number(meeting.date.slice(8, 10)) : '—'}</span></div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-heading text-[14px] font-semibold text-ink">{meeting.title}</h3><Badge tone={meeting.status === 'Cancelled' ? 'red' : meeting.status === 'Completed' ? 'green' : 'blue'}>{meeting.status ?? 'Scheduled'}</Badge></div>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted"><span className="flex items-center gap-1"><CalendarDays size={11} />{displayDate(meeting.date)}</span><span className="flex items-center gap-1"><Clock3 size={11} />{displayTime(meeting)}</span><span>{meeting.timezone ?? 'Legacy timezone not specified'}</span></p>
                          <p className="mt-2 flex flex-wrap gap-x-3 text-[10px] text-muted"><span>{project?.name ?? meeting.projectName ?? 'No project'}</span>{client && <span>Client: {client.name}</span>}<span>{meeting.type ?? 'Meeting'}</span></p>
                          <p className="mt-2 line-clamp-2 text-[11px] text-ink">{meeting.agenda || meeting.discussion || meeting.description || 'No agenda added.'}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                        <Badge tone={safeMeetUrl(meeting.meetUrl) ? 'green' : 'neutral'}>{safeMeetUrl(meeting.meetUrl) ? 'Meet ready' : 'No video link'}</Badge>
                        <TextButton onClick={(event) => { event.stopPropagation(); setEditing(meeting); setModalOpen(true) }}>Edit</TextButton>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {!expandedCalendar && (
          <aside className="space-y-5">
            <MiniCalendar meetings={meetings} selectedDate={selectedDate} month={month} onSelectDate={selectDate} onChangeMonth={setMonth} onSelectMeeting={setSelectedMeeting} expanded={expandedCalendar} view={view} onViewChange={setView} onToggleExpanded={() => setExpandedCalendar(true)} onSchedule={openCreate} />
            <Card>
              <CardTitle title="Selected day" subtitle={displayDate(selectedDate)} />
              {selectedDayMeetings.length ? <div className="space-y-2">{selectedDayMeetings.map((meeting) => <button key={meeting.id} onClick={() => setSelectedMeeting(meeting)} className="w-full rounded-lg border border-line p-2.5 text-left transition hover:bg-[#fafaf8]"><p className="text-[11px] font-semibold text-ink">{meeting.title}</p><p className="mt-1 text-[10px] text-muted">{displayTime(meeting)} · {meeting.timezone ?? 'timezone unspecified'}</p></button>)}</div> : <p className="text-[11px] text-muted">No NexORA meetings on this date.</p>}
            </Card>
            <Card>
              <CardTitle title="Google Calendar" subtitle="Per-user account connection" action={<Settings2 size={16} className="text-muted" />} />
              <div className="rounded-lg border border-[#f1ddbd] bg-[#fff9ed] p-3">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber" /><p className="text-[11px] font-semibold text-ink">Not configured</p></div>
                <p className="mt-2 text-[10px] leading-relaxed text-muted">No Google account is connected. Configure a server-side OAuth service before Calendar sync, invitations, or real Meet generation can be enabled.</p>
                <p className="mt-2 text-[9px] text-muted">Last successful synchronization: none · Reauthorization: not available until server OAuth is configured.</p>
                <Button className="mt-3 w-full" variant="secondary" disabled title="Google OAuth server is not configured">Connect Google Calendar</Button>
              </div>
              <p className="mt-2 text-[9px] text-muted">No external calendar events are shown. No invitation or reminder is sent from this page.</p>
            </Card>
          </aside>
        )}
      </div>

      {modalOpen && <ScheduleMeetingModal open editing={editing} defaultDate={selectedDate} onClose={() => { setModalOpen(false); setEditing(null) }} />}
      {selectedMeeting && <MeetingDetail meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} onEdit={() => { setEditing(selectedMeeting); setSelectedMeeting(null); setModalOpen(true) }} onCancelMeeting={cancelSelectedMeeting} onDelete={deleteSelectedMeeting} onConvert={(index, text) => convertActionItem(selectedMeeting, index, text)} projects={projects} clients={clients} tasks={tasks} />}
    </div>
  )
}
