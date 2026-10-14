import { useMemo, useState } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '../store'
import {
  calculateRiskScore,
  computeRaidMetrics,
  emptyRaid,
  makeScore,
  normalizeRisk,
  today,
  type AiFinding,
  type RaidCategory,
  type RaidItem,
  type RaidStatus,
} from '../lib/raid'
import { Badge, Button, Card, CardTitle, EmptyState, Field, FormErrorSummary, Modal, TextButton, inputClass, invalidInputClass } from '../components/ui'

const statusTones: Record<string, 'neutral' | 'green' | 'amber' | 'red' | 'blue'> = {
  Open: 'red',
  Monitoring: 'amber',
  'In Progress': 'blue',
  Resolved: 'green',
  Closed: 'neutral',
  Invalidated: 'neutral',
  Superseded: 'neutral',
  Cancelled: 'neutral',
}

const healthTones: Record<string, 'green' | 'amber' | 'red' | 'neutral'> = {
  Healthy: 'green',
  'At Risk': 'amber',
  Critical: 'red',
  Unknown: 'neutral',
}

function severityTone(s: string) {
  if (s === 'Critical') return 'red'
  if (s === 'High') return 'amber'
  if (s === 'Moderate') return 'blue'
  return 'neutral'
}

const categoryColors: Record<RaidCategory, string> = {
  Risk: '#dc2626',
  Assumption: '#7c3aed',
  Issue: '#d97706',
  Dependency: '#2563eb',
}

const severityColors = {
  Low: '#16a34a',
  Moderate: '#2563eb',
  High: '#d97706',
  Critical: '#dc2626',
}

function RaidModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: RaidItem | null }) {
  const { addRisk, updateRisk, projects, team } = useApp()
  const empty = useMemo(() => emptyRaid(projects[0]?.id ?? '', team[0]?.name ?? ''), [projects, team])
  const [form, setForm] = useState<Partial<RaidItem>>(() => (editing ? { ...editing } : { ...empty }))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const update = (patch: Partial<RaidItem>) => {
    setForm((f) => ({ ...f, ...patch }))
    setErrors((current) => {
      const next = { ...current }
      Object.keys(patch).forEach((key) => delete next[key])
      return next
    })
  }

  const onScoreChange = (kind: 'inherent' | 'current' | 'residual', which: 'probability' | 'impact', value: number) => {
    const existing = (form as any)[kind] ?? makeScore(3, 3, 'manual', '')
    const next = { ...existing, [which]: Math.min(5, Math.max(1, Number(value) || 1)) }
    const { score, severity } = calculateRiskScore(next.probability, next.impact)
    update({ [kind]: { ...next, score, severity, rationale: existing.rationale, source: existing.source, scoredAt: new Date().toISOString() } })
  }

  const submit = () => {
    const payload = normalizeRisk({ ...(form as any), id: editing ? editing.id : '' })
    const nextErrors: Record<string, string> = {}
    if (!payload.title.trim()) nextErrors.title = 'RAID item title is required.'
    if (!payload.projectId) nextErrors.projectId = 'Select a project.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    if (editing) updateRisk(editing.id, form)
    else addRisk(payload as any)
    onClose()
  }

  const category = (form.category as RaidCategory) ?? 'Risk'

  return (
    <Modal
      open={open}
      title={editing ? 'Edit RAID item' : 'New RAID item'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{editing ? 'Save changes' : 'Create item'}</Button>
        </>
      }
    >
      <FormErrorSummary errors={errors} />
      <div className="grid max-h-[68vh] grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2">
        <Field label="Project" required error={errors.projectId} className="md:col-span-2">
          <select className={errors.projectId ? invalidInputClass : inputClass} aria-invalid={!!errors.projectId} value={form.projectId ?? ''} onChange={(e) => update({ projectId: e.target.value })}>
            <option value="">Select a project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>

        <Field label="Category">
          <select className={inputClass} value={category} onChange={(e) => update({ category: e.target.value as RaidCategory })}>
            {(['Risk', 'Assumption', 'Issue', 'Dependency'] as RaidCategory[]).map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Priority">
          <select className={inputClass} value={form.priority ?? 'Medium'} onChange={(e) => update({ priority: e.target.value as any })}>
            {(['Low', 'Medium', 'High', 'Urgent'] as const).map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>

        <Field label="Title" required error={errors.title} className="md:col-span-2">
          <input className={errors.title ? invalidInputClass : inputClass} aria-invalid={!!errors.title} value={form.title ?? ''} onChange={(e) => update({ title: e.target.value })} placeholder="Short title" />
        </Field>

        <Field label="Description" className="md:col-span-2">
          <textarea className={inputClass} rows={3} value={form.description ?? ''} onChange={(e) => update({ description: e.target.value })} placeholder="Detailed description" />
        </Field>

        <Field label="Owner">
          <select className={inputClass} value={form.owner ?? ''} onChange={(e) => update({ owner: e.target.value })}>
            {team.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </Field>

        <Field label="Reporter">
          <input className={inputClass} value={form.reporter ?? ''} onChange={(e) => update({ reporter: e.target.value })} placeholder="Who raised this?" />
        </Field>

        <Field label="Target date">
          <input type="date" className={inputClass} value={form.targetDate ?? today()} onChange={(e) => update({ targetDate: e.target.value })} />
        </Field>

        <Field label="Status">
          <select className={inputClass} value={form.status ?? 'Open'} onChange={(e) => update({ status: e.target.value as RaidStatus })}>
            {(['Open', 'Monitoring', 'In Progress', 'Resolved', 'Closed', 'Invalidated', 'Superseded', 'Cancelled'] as RaidStatus[]).map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>

        {(['inherent', 'current', 'residual'] as const).map((kind) => (
          <div key={kind} className="md:col-span-2 rounded-lg border border-line bg-[#fafaf8] p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{kind} risk</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Probability (1-5)">
                <input type="number" min={1} max={5} className={inputClass} value={((form as any)[kind]?.probability) ?? 3} onChange={(e) => onScoreChange(kind, 'probability', Number(e.target.value))} />
              </Field>
              <Field label="Impact (1-5)">
                <input type="number" min={1} max={5} className={inputClass} value={((form as any)[kind]?.impact) ?? 3} onChange={(e) => onScoreChange(kind, 'impact', Number(e.target.value))} />
              </Field>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-ink">
              <span className="uppercase">Score:</span>
              <span>{(form as any)[kind]?.score ?? 9}</span>
              <Badge tone={severityTone((form as any)[kind]?.severity ?? 'Moderate')}>{(form as any)[kind]?.severity ?? 'Moderate'}</Badge>
            </div>
          </div>
        ))}

        <Field label="Business impact" className="md:col-span-2">
          <input className={inputClass} value={form.businessImpact ?? ''} onChange={(e) => update({ businessImpact: e.target.value })} placeholder="Effect on business outcomes" />
        </Field>

        <Field label="Schedule impact" className="md:col-span-2">
          <input className={inputClass} value={form.scheduleImpact ?? ''} onChange={(e) => update({ scheduleImpact: e.target.value })} placeholder="Effect on schedule" />
        </Field>

        <Field label="Mitigation plan" className="md:col-span-2">
          <textarea className={inputClass} rows={3} value={form.mitigationPlan ?? ''} onChange={(e) => update({ mitigationPlan: e.target.value })} placeholder="How will this be prevented or reduced?" />
        </Field>

        <Field label="Contingency plan" className="md:col-span-2">
          <textarea className={inputClass} rows={3} value={form.contingencyPlan ?? ''} onChange={(e) => update({ contingencyPlan: e.target.value })} placeholder="Fallback if the event occurs" />
        </Field>

        <Field label="Action items" className="md:col-span-2">
          <textarea className={inputClass} rows={2} value={form.actionItems ?? ''} onChange={(e) => update({ actionItems: e.target.value })} placeholder="Next steps" />
        </Field>

        {category === 'Assumption' && (
          <>
            <Field label="Rationale" className="md:col-span-2"><input className={inputClass} value={form.rationale ?? ''} onChange={(e) => update({ rationale: e.target.value })} placeholder="Why is this believed?" /></Field>
            <Field label="Validation method" className="md:col-span-2"><input className={inputClass} value={form.validationMethod ?? ''} onChange={(e) => update({ validationMethod: e.target.value })} /></Field>
            <Field label="Validation outcome" className="md:col-span-2"><input className={inputClass} value={form.validationOutcome ?? ''} onChange={(e) => update({ validationOutcome: e.target.value })} /></Field>
          </>
        )}

        {category === 'Issue' && (
          <>
            <Field label="Discovery date"><input type="date" className={inputClass} value={form.discoveryDate ?? today()} onChange={(e) => update({ discoveryDate: e.target.value })} /></Field>
            <Field label="Root cause" className="md:col-span-2"><input className={inputClass} value={form.rootCause ?? ''} onChange={(e) => update({ rootCause: e.target.value })} /></Field>
            <Field label="Escalation status">
              <select className={inputClass} value={form.escalationStatus ?? 'None'} onChange={(e) => update({ escalationStatus: e.target.value as any })}>
                {(['None', 'Escalated', 'Resolved'] as const).map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </>
        )}

        {category === 'Dependency' && (
          <>
            <Field label="Prerequisite" className="md:col-span-2"><input className={inputClass} value={form.prerequisite ?? ''} onChange={(e) => update({ prerequisite: e.target.value })} placeholder="What must be delivered?" /></Field>
            <Field label="Provider"><input className={inputClass} value={form.provider ?? ''} onChange={(e) => update({ provider: e.target.value })} /></Field>
            <Field label="Dependency type">
              <select className={inputClass} value={form.dependencyType ?? 'Internal'} onChange={(e) => update({ dependencyType: e.target.value as any })}>
                {(['Internal', 'External', 'Cross-team', 'Technical'] as const).map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Delay impact" className="md:col-span-2"><input className={inputClass} value={form.delayImpact ?? ''} onChange={(e) => update({ delayImpact: e.target.value })} /></Field>
          </>
        )}

        {category === 'Risk' && (
          <Field label="Trigger" className="md:col-span-2"><input className={inputClass} value={form.trigger ?? ''} onChange={(e) => update({ trigger: e.target.value })} placeholder="Event that would cause this risk to occur" /></Field>
        )}

        <Field label="Evidence / source" className="md:col-span-2">
          <input className={inputClass} value={form.evidence ?? ''} onChange={(e) => update({ evidence: e.target.value })} placeholder="Links, references, source of the record" />
        </Field>
      </div>
    </Modal>
  )
}

function MetricCard({ label, value, tone = 'neutral', onClick }: { label: string; value: string | number; tone?: string; onClick?: () => void }) {
  const tones: Record<string, string> = {
    neutral: 'bg-paper text-ink',
    green: 'bg-green/10 text-green',
    amber: 'bg-amber/10 text-amber',
    red: 'bg-red/10 text-red',
    blue: 'bg-blue/10 text-blue',
  }
  return (
    <button
      onClick={onClick}
      className={`rounded-card border border-line p-4 text-left shadow-soft transition hover:shadow-lift ${onClick ? 'cursor-pointer' : ''} ${tones[tone] ?? tones.neutral}`}
    >
      <p className="text-[20px] font-bold leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
    </button>
  )
}

export function Risks() {
  const { risks, projects, tasks, aiFindings, addRisk, deleteRisk, updateAiFinding } = useApp()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RaidItem | null>(null)

  const displayRisks = useMemo(() => {
    return [...risks].sort((a, b) => (b.current?.score ?? 0) - (a.current?.score ?? 0))
  }, [risks])

  const metrics = useMemo(() => {
    return computeRaidMetrics(risks, tasks, projects)
  }, [risks, tasks, projects])

  const openItems = useMemo(() => risks.filter((item) => !['Resolved', 'Closed', 'Cancelled'].includes(item.status)), [risks])
  const categoryData = useMemo(() =>
    (['Risk', 'Assumption', 'Issue', 'Dependency'] as RaidCategory[])
      .map((category) => ({ name: category, value: openItems.filter((item) => item.category === category).length }))
      .filter((item) => item.value > 0),
    [openItems],
  )
  const riskSeverityByProject = useMemo(() => projects.map((project) => {
    const projectRisks = openItems.filter((item) => item.projectId === project.id && item.category === 'Risk')
    const counts = { Low: 0, Moderate: 0, High: 0, Critical: 0 }
    projectRisks.forEach((item) => {
      const severity = item.current?.severity
      if (severity && severity in counts) counts[severity as keyof typeof counts] += 1
    })
    return { name: project.name, ...counts }
  }).filter((project) => project.Low + project.Moderate + project.High + project.Critical > 0), [openItems, projects])
  const pendingFindings = useMemo(() => aiFindings.filter((f) => f.status === 'awaiting review'), [aiFindings])

  const acceptFinding = (finding: AiFinding) => {
    const taskId = finding.sourceIds.find((id) => tasks.some((t) => t.id === id))
    const projectId = taskId ? tasks.find((t) => t.id === taskId)?.projectId : finding.sourceIds.find((id) => projects.some((p) => p.id === id))
    const resolvedProjectId = projectId ?? projects[0]?.id ?? ''
    const score = calculateRiskScore(finding.suggestedProbability, finding.suggestedImpact)
    const payload: Omit<RaidItem, 'id'> = {
      ...emptyRaid(resolvedProjectId, finding.recommendedOwner),
      title: finding.title,
      category: finding.category,
      description: finding.explanation,
      evidence: finding.evidence,
      sourceReference: `AI finding ${finding.id} from task ${taskId ?? ''}`,
      affectedTaskIds: taskId ? [taskId] : [],
      priority: (score.score >= 15 ? 'Urgent' : score.score >= 10 ? 'High' : 'Medium') as any,
      inherent: makeScore(finding.suggestedProbability, finding.suggestedImpact, 'ai-proposed', `Initial AI assessment from comment analysis`),
      current: makeScore(finding.suggestedProbability, finding.suggestedImpact, 'ai-proposed', `Initial AI assessment from comment analysis`),
      residual: makeScore(finding.suggestedProbability, finding.suggestedImpact, 'ai-proposed', `Initial AI assessment from comment analysis`),
      owner: finding.recommendedOwner,
      reporter: 'AI Assistant',
      targetDate: finding.reviewBy,
      mitigationPlan: finding.recommendedMitigation,
    }
    addRisk(payload as any)
    updateAiFinding(finding.id, { status: 'accepted' })
  }

  const rejectFinding = (finding: AiFinding) => {
    updateAiFinding(finding.id, { status: 'rejected' })
  }

  const openNew = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const findingProjectAndTask = (finding: AiFinding) => {
    const taskId = finding.sourceIds.find((id) => tasks.some((t) => t.id === id))
    const projectId = taskId ? tasks.find((t) => t.id === taskId)?.projectId : finding.sourceIds.find((id) => projects.some((p) => p.id === id))
    const project = projects.find((p) => p.id === projectId)
    const task = tasks.find((t) => t.id === taskId)
    return { project, task }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#929692]">RAID Intelligence</p>
          <h1 className="font-heading text-[28px] font-semibold tracking-tight text-ink">RAID Command Center</h1>
          <p className="mt-2 text-[13px] text-muted">Track risks, assumptions, issues and dependencies with deterministic scoring.</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <MetricCard tone={healthTones[metrics.projectHealth] ?? 'neutral'} label="Health" value={metrics.projectHealth} />
        <MetricCard label="Open RAID" value={metrics.totalOpen} />
        <MetricCard tone="red" label="Critical risks" value={metrics.criticalRisks} />
        <MetricCard tone="amber" label="High risks" value={metrics.highRisks} />
        <MetricCard tone="red" label="Overdue" value={metrics.overdueActions} />
        <MetricCard tone="blue" label="Risk exposure" value={metrics.overallRiskExposure} />
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle title="Open RAID mix" subtitle={`${openItems.length} open items by category`} />
          {categoryData.length === 0 ? (
            <div className="grid h-[220px] place-items-center text-center text-[11px] text-muted">No open RAID items to chart.</div>
          ) : (
            <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
              <div className="h-[220px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3} stroke="none">
                      {categoryData.map((entry) => <Cell key={entry.name} fill={categoryColors[entry.name as RaidCategory]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [`${value} open`, name]} contentStyle={{ borderRadius: 10, border: '1px solid #e7e7e2', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                {categoryData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between gap-2 rounded-lg bg-[#fafaf8] px-2.5 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-[10px] text-ink"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: categoryColors[entry.name as RaidCategory] }} />{entry.name}</span>
                    <span className="text-[11px] font-semibold text-ink">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle title="Open risk severity by project" subtitle="Count of open risk records by current severity" />
          {riskSeverityByProject.length === 0 ? (
            <div className="grid h-[220px] place-items-center text-center text-[11px] text-muted">No open risk records to chart.</div>
          ) : (
            <div className="h-[220px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskSeverityByProject} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ecece8" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 9, fill: '#858a87' }} />
                  <YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 9, fill: '#555a56' }} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e7e7e2', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Low" stackId="severity" fill={severityColors.Low} />
                  <Bar dataKey="Moderate" stackId="severity" fill={severityColors.Moderate} />
                  <Bar dataKey="High" stackId="severity" fill={severityColors.High} />
                  <Bar dataKey="Critical" stackId="severity" fill={severityColors.Critical} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <CardTitle
          title="AI Findings Awaiting Review"
          subtitle={`${pendingFindings.length} suggestion${pendingFindings.length !== 1 ? 's' : ''} from task comments and status analysis`}
          action={<Sparkles size={18} className="text-amber" />}
        />
        {pendingFindings.length === 0 ? (
          <EmptyState title="No AI findings awaiting review" description="Task comments and status changes will be analyzed for RAID implications automatically." />
        ) : (
          <div className="space-y-3">
            {pendingFindings.map((finding) => {
              const { project, task } = findingProjectAndTask(finding)
              const score = calculateRiskScore(finding.suggestedProbability, finding.suggestedImpact)
              return (
                <div key={finding.id} className="rounded-lg border border-line p-4 transition hover:shadow-lift">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={finding.category === 'Risk' ? 'red' : finding.category === 'Issue' ? 'amber' : finding.category === 'Dependency' ? 'blue' : 'neutral'}>{finding.category}</Badge>
                        <Badge tone={severityTone(score.severity)}>{score.severity}</Badge>
                        <span className="text-[10px] text-muted">Confidence: {finding.confidence}</span>
                      </div>
                      <h4 className="mt-1 text-[14px] font-semibold text-ink">{finding.title}</h4>
                      <p className="text-[12px] text-muted">{finding.explanation}</p>
                      <p className="mt-1 text-[11px] text-ink"><span className="font-semibold">Evidence:</span> {finding.evidence}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted">
                        {project && <span>Project: <button className="font-medium text-ink hover:underline" onClick={() => navigate(`/projects/${project.id}`)}>{project.name}</button></span>}
                        {task && <span>Task: <button className="font-medium text-ink hover:underline" onClick={() => navigate(`/tasks/${task.id}`)}>{task.title}</button></span>}
                        <span>Suggested owner: {finding.recommendedOwner}</span>
                        <span>Score: {finding.suggestedProbability}×{finding.suggestedImpact} = {score.score}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 md:flex-col">
                      <Button onClick={() => acceptFinding(finding)}>Accept</Button>
                      <Button variant="secondary" onClick={() => rejectFinding(finding)}>Reject</Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle title="RAID Register" subtitle={`${displayRisks.length} record(s) · Refreshed ${metrics.lastRefresh}`} action={
          <Button onClick={openNew}><span className="flex items-center gap-1.5"><Plus size={14} /> Add</span></Button>
        } />
        {displayRisks.length === 0 ? (
          <EmptyState title="No records" description="Add a RAID item or accept an AI suggestion to populate this view." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  {['ID', 'Project', 'Category', 'Title', 'Owner', 'Score', 'Severity', 'Priority', 'Due', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="border-b border-line px-3 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wider text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRisks.map((risk) => {
                  const project = projects.find((p) => p.id === risk.projectId)
                  return (
                    <tr key={risk.id} className="transition hover:bg-[#fafaf8]">
                      <td className="border-b border-[#efefeb] px-3 py-3 text-[11px] font-mono text-muted">{risk.id}</td>
                      <td className="border-b border-[#efefeb] px-3 py-3 text-[11px] text-muted">{project?.name ?? '—'}</td>
                      <td className="border-b border-[#efefeb] px-3 py-3"><Badge tone="neutral">{risk.category}</Badge></td>
                      <td className="border-b border-[#efefeb] px-3 py-3 text-[12px] font-medium text-ink">{risk.title}</td>
                      <td className="border-b border-[#efefeb] px-3 py-3 text-[11px] text-ink">{risk.owner}</td>
                      <td className="border-b border-[#efefeb] px-3 py-3 text-[11px] font-semibold text-ink">{risk.current?.score ?? '—'}</td>
                      <td className="border-b border-[#efefeb] px-3 py-3"><Badge tone={severityTone(risk.current?.severity ?? 'Low')}>{risk.current?.severity ?? '—'}</Badge></td>
                      <td className="border-b border-[#efefeb] px-3 py-3"><Badge tone={risk.priority === 'Urgent' ? 'red' : risk.priority === 'High' ? 'amber' : 'neutral'}>{risk.priority}</Badge></td>
                      <td className="border-b border-[#efefeb] px-3 py-3 text-[11px] text-muted">{risk.targetDate}</td>
                      <td className="border-b border-[#efefeb] px-3 py-3"><Badge tone={statusTones[risk.status] ?? 'neutral'}>{risk.status}</Badge></td>
                      <td className="border-b border-[#efefeb] px-3 py-3">
                        <div className="flex gap-2">
                          <TextButton onClick={() => { setEditing(risk); setModalOpen(true) }}>Edit</TextButton>
                          <TextButton className="text-red" onClick={() => { if (window.confirm(`Delete "${risk.title}"?`)) deleteRisk(risk.id) }}>Delete</TextButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RaidModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} />
    </div>
  )
}
