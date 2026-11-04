import { useState } from 'react'
import { CURRENT_USER, useApp, type Project, type ProjectStatus, type StatusUpdate } from '../store'
import { latestUpdateFor } from '../lib/reporting'
import { emptyRaid } from '../lib/raid'
import { getAiProvider } from '../lib/aiProvider'
import { buildApplyPayload, type AiProposal } from '../lib/aiUpdate'
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
  const { addStatusUpdate, editStatusUpdate, setHealthOverride, statusUpdates, risks, addRisk } = useApp()
  const [saving, setSaving] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [aiError, setAiError] = useState('')
  const [proposal, setProposal] = useState<AiProposal | null>(null)
  const [raidChecks, setRaidChecks] = useState<boolean[]>([])
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
    // Health is always auto-computed from signals — clear any stale manual override.
    if (project.healthOverride) setHealthOverride(project.id, undefined)
    onClose()
  }

  const runAnalysis = async () => {
    const text = aiInput.trim()
    if (!text || analyzing) return
    setAnalyzing(true)
    setAiError('')
    setProposal(null)
    try {
      const openRaids = risks
        .filter((r) => r.projectId === project.id && !['Resolved', 'Closed', 'Cancelled'].includes(r.status))
        .map((r) => ({ title: r.title, status: r.status, projectId: r.projectId }))
      const result = await getAiProvider().analyze(text, {
        project,
        latestUpdate: latestUpdateFor(project.id, statusUpdates),
        openRaids,
      })
      setProposal(result)
      setRaidChecks(result.raidCandidates.map((c) => c.suggested))
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI analysis failed — please retry')
    } finally {
      setAnalyzing(false)
    }
  }

  const applyAi = () => {
    if (!proposal) return
    const payload = buildApplyPayload(proposal, project)
    if (typeof payload === 'string') {
      setAiError(payload)
      return
    }
    const latest = latestUpdateFor(project.id, statusUpdates)
    const changedFields = (Object.keys(payload) as (keyof typeof payload)[]).filter(
      (k) => k !== 'projectId' && (proposal as any)[k]?.present && (proposal as any)[k]?.source === 'explicit',
    )
    addStatusUpdate({
      ...payload,
      author: CURRENT_USER,
      source: 'ai',
      aiAudit: {
        input: aiInput.trim(),
        approvedBy: CURRENT_USER,
        changedFields,
        proposal: Object.fromEntries(
          Object.entries(proposal)
            .filter(([, v]) => v && typeof v === 'object' && 'present' in v)
            .map(([k, v]) => [k, (v as { value: string | number }).value ?? null]),
        ),
        previousValues: {
          status: project.status,
          progress: project.progress,
          end: project.end,
          workCompleted: latest?.workCompleted,
          pendingWork: latest?.pendingWork,
          blockers: latest?.blockers,
        },
      },
    })
    proposal.raidCandidates.forEach((c, i) => {
      if (!raidChecks[i] || !c.suggested) return
      const { id: _id, ...base } = emptyRaid(project.id, project.manager)
      addRisk({
        ...base,
        category: c.category,
        title: c.title,
        description: c.description,
        reporter: CURRENT_USER,
        sourceReference: 'AI status update',
      })
    })
    onClose()
  }

  const aiRow = (label: string, f: { present: boolean; value: string | number; source: string }) =>
    f.present ? (
      <div key={label} className="flex items-start justify-between gap-3 border-b border-[#efefeb] pb-1.5 last:border-0">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">{label}</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[11px] text-ink">{String(f.value) || '—'}</p>
        </div>
        <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${
          f.source === 'explicit' ? 'bg-[#e0e7ff] text-[#4338ca]' : f.source === 'inferred' ? 'bg-amber/10 text-amber' : 'bg-[#f0f0ed] text-[#666a67]'
        }`}>
          {f.source === 'explicit' ? 'New' : f.source === 'inferred' ? 'Inferred' : 'Kept'}
        </span>
      </div>
    ) : null

  return (
    <Modal
      open
      wide
      title={editing ? `Edit status report — ${project.name}` : `Add status update — ${project.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {editing && <Button onClick={save} disabled={saving}>Save changes</Button>}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg bg-[#f7f7f4] px-3 py-2 text-[10px] text-muted">
          <span>Reporting date: <b className="text-ink">{editing ? new Date(editing.createdAt).toLocaleString() : new Date().toLocaleString()}</b></span>
          <span>Author: <b className="text-ink">{editing ? editing.author : CURRENT_USER}</b></span>
          {editing?.editHistory?.length ? <span className="text-amber">Edited {editing.editHistory.length}× — audit trail kept</span> : null}
        </div>

        {!editing && (
          <div className="space-y-3 rounded-xl border border-line bg-[#fafaf8] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">AI quick update</p>
              <span className="text-[9px] text-muted">via {getAiProvider().name}</span>
            </div>
            <textarea
              className={textarea}
              rows={3}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Describe the project situation in plain English — e.g. &quot;Progress is 70%. Client UAT is pending. Internal development and testing are completed. No internal blockers. Follow up with the client.&quot;"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={runAnalysis} disabled={analyzing || !aiInput.trim()}>
                {analyzing ? 'Analyzing…' : 'Analyze update'}
              </Button>
              {aiError && <p className="text-[11px] font-medium text-red">{aiError}</p>}
            </div>

            {proposal && (
              <div className="space-y-2 rounded-lg border border-line bg-white p-3">
                <p className="text-[11px] font-medium text-ink">{proposal.summary}</p>

                {proposal.clarifications.map((c) => (
                  <p key={c} className="rounded-md bg-amber/10 px-2 py-1 text-[10px] text-amber">{c}</p>
                ))}

                {proposal.hasMeaningfulChanges ? (
                  <div className="space-y-1.5 pt-1">
                    {aiRow('Overall status', { ...proposal.status, value: proposal.status.value })}
                    {proposal.progress.present && aiRow('Progress', { ...proposal.progress, value: `${proposal.progress.value}%` })}
                    {aiRow('Work completed', proposal.workCompleted)}
                    {aiRow('Current work', proposal.currentWork)}
                    {aiRow('Pending work', proposal.pendingWork)}
                    {aiRow('Blockers', proposal.blockers)}
                    {aiRow('Client status', proposal.clientUpdate)}
                    {aiRow('Risks / dependencies', proposal.risksDependencies)}
                    {aiRow('Next steps', proposal.nextSteps)}
                    {aiRow('Expected completion', proposal.expectedCompletion)}
                    {aiRow('Internal remarks', proposal.internalRemarks)}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted">No meaningful changes detected — nothing to apply.</p>
                )}

                {proposal.raidCandidates.length > 0 && (
                  <div className="space-y-1 border-t border-[#efefeb] pt-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">Detected RAID items</p>
                    {proposal.raidCandidates.map((c, i) => (
                      <label key={c.dedupKey} className={`flex items-start gap-2 text-[10px] ${c.suggested ? 'cursor-pointer' : 'opacity-50'}`}>
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-[#252829]"
                          checked={!!raidChecks[i]}
                          disabled={!c.suggested}
                          onChange={(e) => setRaidChecks((cur) => cur.map((v, j) => (j === i ? e.target.checked : v)))}
                        />
                        <span>
                          <b className="text-ink">{c.category}</b> — {c.title}
                          {c.reason && <span className="ml-1 text-muted">({c.reason})</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {proposal.hasMeaningfulChanges && (
                  <div className="pt-1">
                    <Button onClick={applyAi}>Apply update</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {editing && (
        <>
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
        </>
        )}
      </div>
    </Modal>
  )
}
