import { useState } from 'react'
import { todayKey } from '../lib/dates'
import { CURRENT_USER, useApp, type Project, type ProjectStatus } from '../store'
import { Button, Field, FormErrorSummary, Modal, inputClass, invalidInputClass } from './ui'

export function ProjectModal({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Project | null
}) {
  const { addProject, updateProject, addClient, clients, team } = useApp()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newClientOpen, setNewClientOpen] = useState(clients.length === 0)
  const [clientForm, setClientForm] = useState({ name: '', company: '', contact: '', email: '' })
  const [form, setForm] = useState({
    name: editing?.name ?? '',
    client: editing?.client ?? clients[0]?.name ?? '',
    manager: editing?.manager ?? team[0]?.name ?? '',
    status: editing?.status ?? ('Planning' as ProjectStatus),
    health: editing?.healthOverride?.health ?? editing?.health ?? ('Green' as Project['health']),
    progress: editing?.progress ?? 0,
    priority: editing?.priority ?? ('Medium' as Project['priority']),
    start: editing?.start ?? todayKey(),
    end: editing?.end ?? '',
    type: editing?.type ?? '',
    budget: editing?.budget ?? '',
    estimatedHours: editing?.estimatedHours ?? 0,
    actualHours: editing?.actualHours ?? 0,
    description: editing?.description ?? '',
    notes: editing?.notes ?? '',
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
    if (!form.name.trim()) nextErrors.name = 'Project name is required.'
    if (!form.end) nextErrors.end = 'Project deadline is required.'
    if (form.start && form.end && form.start > form.end) nextErrors.start = 'Start date must be on or before the deadline.'
    if (newClientOpen && !clientForm.name.trim()) nextErrors.clientName = 'Client name is required.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const clientName = newClientOpen ? clientForm.name.trim() : form.client
    if (newClientOpen) {
      addClient({
        name: clientName,
        company: clientForm.company.trim() || clientName,
        contact: clientForm.contact.trim(),
        email: clientForm.email.trim(),
        phone: '',
        website: '',
        notes: '',
        requirements: '',
        pendingApprovals: 'None',
      })
    }
    const payload = { ...form, client: clientName, progress: Number(form.progress), estimatedHours: Number(form.estimatedHours), actualHours: Number(form.actualHours) }
    if (editing) {
      // A manually chosen health is stored as an audited override — auto health
      // applies when the manager clears it or leaves the stored baseline.
      const healthOverride =
        form.health !== (editing.healthOverride?.health ?? editing.health)
          ? { health: form.health, reason: 'Manual override via project edit', author: CURRENT_USER, at: new Date().toISOString() }
          : editing.healthOverride
      updateProject(editing.id, { ...payload, healthOverride })
    } else addProject(payload)
    onClose()
  }

  return (
    <Modal
      open={open}
      title={editing ? 'Edit project' : 'Create project'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{editing ? 'Save changes' : 'Create project'}</Button>
        </>
      }
    >
      <FormErrorSummary errors={errors} />
      <div className="form-stagger grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Project name" required error={errors.name}>
          <input className={errors.name ? invalidInputClass : inputClass} aria-invalid={!!errors.name} value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Phoenix Website" />
        </Field>
        <Field label="Client" required={newClientOpen} error={errors.clientName}>
          <select
            className={inputClass}
            value={newClientOpen ? '__new__' : form.client}
            onChange={(e) => {
              if (e.target.value === '__new__') {
                setNewClientOpen(true)
              } else {
                setNewClientOpen(false)
                setForm({ ...form, client: e.target.value })
              }
            }}
          >
            {clients.map((c) => <option key={c.id}>{c.name}</option>)}
            <option value="__new__">＋ New client…</option>
          </select>
        </Field>
        {newClientOpen && (
          <div className="section-enter col-span-full grid grid-cols-1 gap-3 rounded-xl border border-line bg-[#fafaf8] p-3 sm:grid-cols-2">
            <p className="col-span-full text-[10px] font-semibold uppercase tracking-wider text-muted">New client details</p>
            <Field label="Client name" required error={errors.clientName}>
              <input
                className={errors.clientName ? invalidInputClass : inputClass}
                aria-invalid={!!errors.clientName}
                value={clientForm.name}
                onChange={(e) => {
                  setClientForm({ ...clientForm, name: e.target.value })
                  setErrors((current) => {
                    if (!current.clientName) return current
                    const next = { ...current }
                    delete next.clientName
                    return next
                  })
                }}
                placeholder="e.g. Horizon Retail"
              />
            </Field>
            <Field label="Company">
              <input className={inputClass} value={clientForm.company} onChange={(e) => setClientForm({ ...clientForm, company: e.target.value })} placeholder="Company name" />
            </Field>
            <Field label="Contact person">
              <input className={inputClass} value={clientForm.contact} onChange={(e) => setClientForm({ ...clientForm, contact: e.target.value })} placeholder="Main contact" />
            </Field>
            <Field label="Email">
              <input type="email" className={inputClass} value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} placeholder="client@company.com" />
            </Field>
          </div>
        )}
        <Field label="Project manager">
          <select className={inputClass} value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })}>
            {team.map((m) => <option key={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Project type">
          <input className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Web platform" />
        </Field>
        <Field label="Start date" error={errors.start}>
          <input type="date" className={errors.start ? invalidInputClass : inputClass} aria-invalid={!!errors.start} value={form.start} onChange={(e) => setField('start', e.target.value)} />
        </Field>
        <Field label="Deadline" required error={errors.end}>
          <input type="date" className={errors.end ? invalidInputClass : inputClass} aria-invalid={!!errors.end} value={form.end} onChange={(e) => setField('end', e.target.value)} />
        </Field>
        <Field label="Status">
          <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
            {(['Planning', 'In Progress', 'On Hold', 'Completed', 'At Risk', 'Backed Off'] as ProjectStatus[]).map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Health">
          <select className={inputClass} value={form.health} onChange={(e) => setForm({ ...form, health: e.target.value as Project['health'] })}>
            {(['Green', 'Amber', 'Red'] as Project['health'][]).map((h) => <option key={h}>{h}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Project['priority'] })}>
            {(['Low', 'Medium', 'High', 'Urgent'] as Project['priority'][]).map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Progress %">
          <input type="number" min={0} max={100} className={inputClass} value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} />
        </Field>
        <Field label="Budget">
          <input className={inputClass} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="$00,000" />
        </Field>
        <Field label="Estimated hours">
          <input type="number" min={0} className={inputClass} value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: Number(e.target.value) })} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does success look like?" />
        </Field>
        <Field label="Internal notes" className="sm:col-span-2">
          <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  )
}
