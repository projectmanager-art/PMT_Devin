import { useState } from 'react'
import { CURRENT_USER, useApp, type Health, type Project, type ProjectStatus, type StatusUpdate } from '../store'
import { Button, Field, Modal, inputClass } from './ui'

const STATUS_OPTIONS: ProjectStatus[] = ['Planning', 'In Progress', 'On Hold', 'Completed', 'At Risk', 'Backed Off']

const textarea = `${inputClass} min-h-[54px] resize-y`

interface Props {
  project: Project
  /** When set, the modal edits this update (audit trail preserved) instead of creating one */
  editing?: StatusUpdate | null
  onClose: () => void
}

export function StatusUpdateModal({ project, editing, onClose }: Props) {
  const { addStatusUpdate, editStatusUpdate, setHealthOverride } = useApp()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => ({
    status: editing?.status ?? project.status,
    progress: editing?.progress ?? project.progress,
    workCompleted: editing?.workCompleted ?? '',
    currentWork: editing?.currentWork ?? '',
    pendingWork: editing?.pendingWork ?? '',
    blockers: editing?.blockers ?? '',
    blockerSeverity: editing?.blockerSeverity ?? ('none' as const),
    clientUpdate: editing?.clientUpdate ?? '',
    risksDependencies: editing?.risksDependencies ?? '',
    nextSteps: editing?.nextSteps ?? '',
    expectedCompletion: editing?.expectedCompletion ?? '',
    internalRemarks: editing?.internalRemarks ?? '',
    healthOverride: project.healthOverride?.health ?? ('' as '' | Health),
    healthReason: project.healthOverride?.reason ?? '',
  }))

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const save = () => {
    if (saving) return
    setSaving(true)
    const payload = {
      projectId: project.id,
      author: editing ? editing.author : CURRENT_USER,
      status: form.status,
      progress: Math.min(100, Math.max(0, Math.round(form.progress))),
      workCompleted: form.workCompleted.trim(),
      currentWork: form.currentWork.trim(),
      pendingWork: form.pendingWork.trim(),
      blockers: form.blockers.trim(),
      blockerSeverity: form.blockers.trim() ? form.blockerSeverity : ('none' as const),
      clientUpdate: form.clientUpdate.trim(),
      risksDependencies: form.risksDependencies.trim(),
      nextSteps: form.nextSteps.trim(),
      expectedCompletion: form.expectedCompletion,
      internalRemarks: form.internalRemarks.trim(),
      source: 'manual' as const,
    }
    if (editing) {
      editStatusUpdate(editing.id, payload, CURRENT_USER)
    } else {
      addStatusUpdate(payload)
    }
    if (form.healthOverride) {
      setHealthOverride(project.id, {
        health: form.healthOverride,
        reason: form.healthReason.trim() || 'Manual override',
        author: CURRENT_USER,
        at: new Date().toISOString(),
      })
    }
    onClose()
  }

  return (
    <Modal
      open
      wide
      title={editing ? `Edit status report — ${project.name}` : `Add status update — ${project.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{editing ? 'Save changes' : 'Save update'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg bg-[#f7f7f4] px-3 py-2 text-[10px] text-muted">
          <span>Reporting date: <b className="text-ink">{editing ? new Date(editing.createdAt).toLocaleString() : new Date().toLocaleString()}</b></span>
          <span>Author: <b className="text-ink">{editing ? editing.author : CURRENT_USER}</b></span>
          {editing?.editHistory?.length ? <span className="text-amber">Edited {editing.editHistory.length}× — audit trail kept</span> : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Overall project status" required>
            <select className={inputClass} value={form.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
              {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label={`Progress — ${form.progress}%`} required>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={form.progress}
              onChange={(e) => set('progress', Number(e.target.value))}
              className="mt-3 w-full accent-[#252829]"
              aria-label="Progress percentage"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Work completed">
            <textarea className={textarea} value={form.workCompleted} onChange={(e) => set('workCompleted', e.target.value)} placeholder="Done since the last update" />
          </Field>
          <Field label="Current work">
            <textarea className={textarea} value={form.currentWork} onChange={(e) => set('currentWork', e.target.value)} placeholder="In progress right now" />
          </Field>
          <Field label="Pending work">
            <textarea className={textarea} value={form.pendingWork} onChange={(e) => set('pendingWork', e.target.value)} placeholder="Remaining deliverables" />
          </Field>
          <Field label="Blockers / issues">
            <textarea className={textarea} value={form.blockers} onChange={(e) => set('blockers', e.target.value)} placeholder="Technical issues, client delays, approvals" />
          </Field>
        </div>

        {form.blockers.trim() && (
          <Field label="Blocker severity" className="sm:max-w-[260px]">
            <select className={inputClass} value={form.blockerSeverity} onChange={(e) => set('blockerSeverity', e.target.value as typeof form.blockerSeverity)}>
              <option value="non-critical">Non-critical</option>
              <option value="critical">Critical — marks project health Red</option>
            </select>
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Client update">
            <textarea className={textarea} value={form.clientUpdate} onChange={(e) => set('clientUpdate', e.target.value)} placeholder="Latest client feedback or pending response" />
          </Field>
          <Field label="Risks / dependencies">
            <textarea className={textarea} value={form.risksDependencies} onChange={(e) => set('risksDependencies', e.target.value)} placeholder="Assumptions, external dependencies, potential risks" />
          </Field>
          <Field label="Next steps">
            <textarea className={textarea} value={form.nextSteps} onChange={(e) => set('nextSteps', e.target.value)} placeholder="Planned actions after this update" />
          </Field>
          <Field label={`Expected completion${form.expectedCompletion && form.expectedCompletion !== project.end ? ' — will revise the deadline' : ''}`}>
            <input type="date" className={inputClass} value={form.expectedCompletion} onChange={(e) => set('expectedCompletion', e.target.value)} />
          </Field>
        </div>

        <Field label="Internal remarks (internal users only)">
          <textarea className={textarea} value={form.internalRemarks} onChange={(e) => set('internalRemarks', e.target.value)} placeholder="Notes not shared with clients" />
          {project.notes && !editing && (
            <button
              type="button"
              className="mt-1 self-start text-[10px] font-semibold text-muted underline decoration-dotted hover:text-ink"
              onClick={() => set('internalRemarks', form.internalRemarks ? `${form.internalRemarks}\n${project.notes}` : project.notes)}
            >
              Copy imported comment into remarks
            </button>
          )}
        </Field>

        <div className="rounded-lg border border-line p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Health override (optional)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select className={inputClass} value={form.healthOverride} onChange={(e) => set('healthOverride', e.target.value as '' | Health)}>
              <option value="">Auto — computed from signals</option>
              <option value="Green">Green</option>
              <option value="Amber">Amber</option>
              <option value="Red">Red</option>
            </select>
            {form.healthOverride && (
              <input
                className={`${inputClass} sm:col-span-2`}
                value={form.healthReason}
                onChange={(e) => set('healthReason', e.target.value)}
                placeholder="Reason for the override (recorded in the audit log)"
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
