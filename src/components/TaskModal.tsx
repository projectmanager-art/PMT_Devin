import { useMemo, useState } from 'react'
import { useApp, type Priority, type Task, type TaskActivityEvent, type TaskComment, type TaskStatus } from '../store'
import { Button, Field, FormErrorSummary, Modal, inputClass, invalidInputClass } from './ui'

const uid = () => Math.random().toString(36).slice(2, 9)

export function TaskModal({
  open,
  onClose,
  editing,
  defaultProjectId,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  editing?: Task | null
  defaultProjectId?: string
  onCreated?: (id: string) => void
}) {
  const { addTask, updateTask, projects, team, tasks } = useApp()
  const otherTasks = useMemo(() => tasks.filter((t) => t.id !== editing?.id), [tasks, editing])

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    title: editing?.title ?? '',
    projectId: editing?.projectId ?? defaultProjectId ?? projects[0]?.id ?? '',
    assignee: editing?.assignee ?? team[0]?.name ?? '',
    status: editing?.status ?? ('To Do' as TaskStatus),
    priority: editing?.priority ?? ('Medium' as Priority),
    start: editing?.start ?? '',
    due: editing?.due ?? '',
    nextFollowUp: editing?.nextFollowUp ?? '',
    estimatedHours: editing?.estimatedHours ?? 0,
    actualHours: editing?.actualHours ?? 0,
    description: editing?.description ?? '',
    acceptanceCriteria: editing?.acceptanceCriteria ?? '',
    initialComment: '',
    dependencies: editing?.dependencies ?? [],
  })

  const setField = (key: string, value: unknown) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const submit = () => {
    const nextErrors: Record<string, string> = {}
    if (!form.title.trim()) nextErrors.title = 'Task title is required.'
    if (!form.projectId) nextErrors.projectId = 'Select a project.'
    if (!form.due) nextErrors.due = 'Due date is required.'
    if (form.start && form.due && form.start > form.due) nextErrors.start = 'Start date must be on or before the due date.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const base = {
      title: form.title.trim(),
      projectId: form.projectId,
      assignee: form.assignee,
      status: form.status,
      priority: form.priority,
      start: form.start,
      due: form.due,
      nextFollowUp: form.nextFollowUp,
      estimatedHours: Number(form.estimatedHours || 0),
      actualHours: Number(form.actualHours || 0),
      description: form.description.trim(),
      acceptanceCriteria: form.acceptanceCriteria.trim(),
      dependencies: form.dependencies,
    }

    if (editing) {
      updateTask(editing.id, base)
      onClose()
      return
    }

    const now = new Date().toISOString()
    const initialComments: TaskComment[] = []
    const initialActivity: TaskActivityEvent[] = [
      { id: uid(), type: 'create', message: 'Task created', author: form.assignee || 'System', createdAt: now },
    ]

    if (form.initialComment.trim()) {
      const comment: TaskComment = {
        id: uid(),
        text: form.initialComment.trim(),
        author: form.assignee || 'System',
        createdAt: now,
        updatedAt: now,
      }
      initialComments.push(comment)
      initialActivity.push({
        id: uid(),
        type: 'comment',
        message: 'Initial comment added',
        author: form.assignee || 'System',
        createdAt: now,
      })
    }

    const id = addTask({ ...base, taskComments: initialComments, activity: initialActivity, labels: [] })
    onCreated?.(id)
    onClose()
  }

  return (
    <Modal
      open={open}
      title={editing ? 'Edit task' : 'Create task'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{editing ? 'Save task' : 'Create task'}</Button>
        </>
      }
    >
      <FormErrorSummary errors={errors} />
      <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
        <Field label="Task title" required error={errors.title} className="col-span-2">
          <input
            className={errors.title ? invalidInputClass : inputClass}
            aria-invalid={!!errors.title}
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="What needs to get done?"
          />
        </Field>
        <Field label="Project" required error={errors.projectId} className="col-span-2 sm:col-span-1">
          <select className={errors.projectId ? invalidInputClass : inputClass} aria-invalid={!!errors.projectId} value={form.projectId} onChange={(e) => setField('projectId', e.target.value)}>
            <option value="">Select a project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Assignee" className="col-span-2 sm:col-span-1">
          <select className={inputClass} value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}>
            {team.map((m) => <option key={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}>
            {(['To Do', 'In Progress', 'Review', 'Blocked', 'Completed'] as TaskStatus[]).map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
            {(['Low', 'Medium', 'High', 'Urgent'] as Priority[]).map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Start date" error={errors.start}>
          <input type="date" className={errors.start ? invalidInputClass : inputClass} aria-invalid={!!errors.start} value={form.start} onChange={(e) => setField('start', e.target.value)} />
        </Field>
        <Field label="Due date" required error={errors.due}>
          <input type="date" className={errors.due ? invalidInputClass : inputClass} aria-invalid={!!errors.due} value={form.due} onChange={(e) => setField('due', e.target.value)} />
        </Field>
        <Field label="Next follow-up date">
          <input type="date" className={inputClass} value={form.nextFollowUp} onChange={(e) => setField('nextFollowUp', e.target.value)} />
        </Field>
        <Field label="Estimated hours">
          <input type="number" min={0} className={inputClass} value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: Number(e.target.value) })} />
        </Field>
        <Field label="Actual hours">
          <input type="number" min={0} className={inputClass} value={form.actualHours} onChange={(e) => setForm({ ...form, actualHours: Number(e.target.value) })} />
        </Field>
        <Field label="Description" className="col-span-2">
          <textarea
            rows={3}
            className={inputClass}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the task, goals, and context..."
          />
        </Field>
        <Field label="Acceptance criteria" className="col-span-2">
          <textarea
            rows={2}
            className={inputClass}
            value={form.acceptanceCriteria}
            onChange={(e) => setForm({ ...form, acceptanceCriteria: e.target.value })}
            placeholder="What must be true for this task to be considered complete?"
          />
        </Field>
        {!editing && (
          <Field label="Initial comment / progress note" className="col-span-2">
            <textarea
              rows={2}
              className={inputClass}
              value={form.initialComment}
              onChange={(e) => setForm({ ...form, initialComment: e.target.value })}
              placeholder="Optional first update, blocker, or context..."
            />
          </Field>
        )}
        <Field label="Dependencies" className="col-span-2">
          <select
            multiple
            className={`${inputClass} min-h-[80px]`}
            value={form.dependencies}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((o) => o.value)
              setForm({ ...form, dependencies: selected })
            }}
          >
            {otherTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <p className="mt-1 text-[10px] text-[#858a87]">Hold Ctrl/Cmd to select multiple dependent tasks.</p>
        </Field>
      </div>
    </Modal>
  )
}
