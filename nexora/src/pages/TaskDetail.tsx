import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, CheckCircle2, Clock, MessageSquare, ShieldAlert, User } from 'lucide-react'
import { useApp, type Task, type TaskActivityEvent, type TaskComment } from '../store'
import { analyzeComment, analyzeTaskStatus } from '../lib/aiTaskIntelligence'
import { calculateRiskScore, emptyRaid, makeScore, type AiFinding, type RaidItem } from '../lib/raid'
import { Avatar, Badge, Button, Card, CardTitle, EmptyState, Field, TextButton, inputClass, invalidInputClass } from '../components/ui'
import { TaskModal } from '../components/TaskModal'

const uid = () => Math.random().toString(36).slice(2, 9)

type TabKey = 'overview' | 'comments' | 'dependencies' | 'activity' | 'raid'

const statusTones: Record<string, 'neutral' | 'green' | 'amber' | 'red' | 'blue'> = {
  'To Do': 'neutral',
  'In Progress': 'blue',
  'Review': 'amber',
  'Blocked': 'red',
  'Completed': 'green',
}

const priorityTones: Record<string, 'neutral' | 'green' | 'amber' | 'red' | 'blue'> = {
  'Low': 'neutral',
  'Medium': 'blue',
  'High': 'amber',
  'Urgent': 'red',
}

function formatDate(iso: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function activityIcon(type: TaskActivityEvent['type']) {
  switch (type) {
    case 'comment': return <MessageSquare className="h-3.5 w-3.5" />
    case 'status': return <CheckCircle2 className="h-3.5 w-3.5" />
    case 'priority': return <ShieldAlert className="h-3.5 w-3.5" />
    case 'assignee': return <User className="h-3.5 w-3.5" />
    case 'due': return <Calendar className="h-3.5 w-3.5" />
    case 'raid': return <ShieldAlert className="h-3.5 w-3.5" />
    default: return <Clock className="h-3.5 w-3.5" />
  }
}

export function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const {
    tasks,
    projects,
    team,
    aiFindings,
    risks,
    updateTask,
    addAiFinding,
    updateAiFinding,
    addRisk,
  } = useApp()

  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [commentText, setCommentText] = useState('')
  const [commentError, setCommentError] = useState('')
  const [isBlocker, setIsBlocker] = useState(false)
  const [analysisState, setAnalysisState] = useState<'idle' | 'analyzing' | 'done' | 'none'>('idle')
  const [editOpen, setEditOpen] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentText, setEditCommentText] = useState('')

  const task = useMemo(() => tasks.find((t) => t.id === taskId), [tasks, taskId])
  const project = useMemo(() => projects.find((p) => p.id === task?.projectId), [projects, task])
  const assignee = useMemo(() => team.find((m) => m.name === task?.assignee), [team, task])

  const taskAiFindings = useMemo(
    () => aiFindings.filter((f) => task && f.sourceIds.includes(task.id)),
    [aiFindings, task],
  )

  const dependencyTasks = useMemo(
    () => (task ? tasks.filter((t) => task.dependencies.includes(t.id)) : []),
    [tasks, task],
  )

  if (!task || !project) {
    return (
      <div className="p-6 lg:p-10">
        <EmptyState title="Task not found" description="The task you are looking for does not exist." action={<Button onClick={() => navigate('/tasks')}>Back to tasks</Button>} />
      </div>
    )
  }

  const postComment = () => {
    if (!commentText.trim()) {
      setCommentError('Enter a comment before posting.')
      return
    }
    setCommentError('')
    const now = new Date().toISOString()
    const comment: TaskComment = {
      id: uid(),
      text: commentText.trim(),
      author: task.assignee || 'System',
      createdAt: now,
      updatedAt: now,
    }
    const activity: TaskActivityEvent = {
      id: uid(),
      type: 'comment',
      message: isBlocker ? 'Blocker / progress update posted' : 'Comment added',
      author: task.assignee || 'System',
      createdAt: now,
    }
    const updatedTask: Task = {
      ...task,
      taskComments: [...task.taskComments, comment],
      activity: [activity, ...task.activity],
    }
    updateTask(task.id, updatedTask)
    setCommentText('')
    setIsBlocker(false)

    setAnalysisState('analyzing')
    const findings = analyzeComment(comment, task, project, aiFindings, risks, tasks)
    findings.forEach(addAiFinding)
    setAnalysisState(findings.length ? 'done' : 'none')
  }

  const saveCommentEdit = (commentId: string) => {
    if (!editCommentText.trim()) return
    const now = new Date().toISOString()
    const updatedComments = task.taskComments.map((c) =>
      c.id === commentId ? { ...c, text: editCommentText.trim(), updatedAt: now } : c,
    )
    const activity: TaskActivityEvent = {
      id: uid(),
      type: 'comment',
      message: 'Comment edited',
      author: task.assignee || 'System',
      createdAt: now,
    }
    updateTask(task.id, { ...task, taskComments: updatedComments, activity: [activity, ...task.activity] })

    const comment = updatedComments.find((c) => c.id === commentId)
    if (comment) {
      setAnalysisState('analyzing')
      const findings = analyzeComment(comment, task, project, aiFindings, risks, tasks)
      findings.forEach(addAiFinding)
      setAnalysisState(findings.length ? 'done' : 'none')
    }
    setEditingCommentId(null)
    setEditCommentText('')
  }

  const deleteComment = (commentId: string) => {
    const updatedComments = task.taskComments.filter((c) => c.id !== commentId)
    const activity: TaskActivityEvent = {
      id: uid(),
      type: 'comment',
      message: 'Comment deleted',
      author: task.assignee || 'System',
      createdAt: new Date().toISOString(),
    }
    updateTask(task.id, { ...task, taskComments: updatedComments, activity: [activity, ...task.activity] })
  }

  const acceptFinding = (finding: AiFinding) => {
    const score = calculateRiskScore(finding.suggestedProbability, finding.suggestedImpact)
    const payload: Omit<RaidItem, 'id'> = {
      ...emptyRaid(project.id, finding.recommendedOwner),
      title: finding.title,
      category: finding.category,
      description: finding.explanation,
      evidence: finding.evidence,
      sourceReference: `AI finding ${finding.id} from task ${task.id} comment ${finding.sourceIds[0]}`,
      affectedTaskIds: [task.id],
      priority: score.score >= 10 ? 'High' : 'Medium',
      inherent: makeScore(finding.suggestedProbability, finding.suggestedImpact, 'ai-proposed', `Initial AI assessment from comment analysis`),
      current: makeScore(finding.suggestedProbability, finding.suggestedImpact, 'ai-proposed', `Initial AI assessment from comment analysis`),
      residual: makeScore(finding.suggestedProbability, finding.suggestedImpact, 'ai-proposed', `Initial AI assessment from comment analysis`),
      owner: finding.recommendedOwner,
      reporter: 'AI Assistant',
    }
    addRisk(payload)
    updateAiFinding(finding.id, { status: 'accepted' })
  }

  const rejectFinding = (finding: AiFinding) => {
    updateAiFinding(finding.id, { status: 'rejected' })
  }

  const runTaskAnalysis = () => {
    setAnalysisState('analyzing')
    const findings = analyzeTaskStatus(task, project, aiFindings, risks)
    findings.forEach(addAiFinding)
    setAnalysisState(findings.length ? 'done' : 'none')
  }

  const statusSelect = (
    <select
      className={inputClass}
      value={task.status}
      onChange={(e) => updateTask(task.id, { status: e.target.value as Task['status'] })}
    >
      {(['To Do', 'In Progress', 'Review', 'Blocked', 'Completed'] as Task['status'][]).map((s) => <option key={s}>{s}</option>)}
    </select>
  )

  return (
    <div className="min-h-screen bg-canvas p-6 lg:p-10">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)} className="px-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-heading text-[20px] font-semibold text-ink">{task.title}</h1>
        <Badge tone={statusTones[task.status] ?? 'neutral'}>{task.status}</Badge>
        <Badge tone={priorityTones[task.priority] ?? 'neutral'}>{task.priority}</Badge>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted">
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {task.assignee || 'Unassigned'}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Due {task.due || '—'}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Next follow-up {task.nextFollowUp || 'Not scheduled'}</span>
            {task.start && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Start {task.start}</span>}
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {task.estimatedHours}h est / {task.actualHours}h actual</span>
          </div>
        </Card>
        <Card className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={assignee?.name ?? task.assignee} src={assignee ? `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(assignee.name)}` : undefined} />
            <div>
              <p className="text-[11px] text-muted">Assignee</p>
              <p className="text-[13px] font-semibold text-ink">{task.assignee || 'Unassigned'}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => setEditOpen(true)}>Edit</Button>
        </Card>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-line pb-1">
        {(['overview', 'comments', 'activity', 'dependencies', 'raid'] as TabKey[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-t-lg px-4 py-2 text-[12px] font-semibold transition ${activeTab === tab ? 'border-b-2 border-ink text-ink' : 'text-muted hover:text-ink'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardTitle title="Overview" />
            <div className="space-y-4">
              <Field label="Description">
                <div className="rounded-lg border border-line bg-[#fafaf8] p-3 text-[13px] text-ink min-h-[80px]">
                  {task.description || <span className="text-muted">No description provided.</span>}
                </div>
              </Field>
              <Field label="Acceptance criteria">
                <div className="rounded-lg border border-line bg-[#fafaf8] p-3 text-[13px] text-ink min-h-[60px]">
                  {task.acceptanceCriteria || <span className="text-muted">No acceptance criteria.</span>}
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Status">{statusSelect}</Field>
                <Field label="Priority">
                  <select
                    className={inputClass}
                    value={task.priority}
                    onChange={(e) => updateTask(task.id, { priority: e.target.value as Task['priority'] })}
                  >
                    {(['Low', 'Medium', 'High', 'Urgent'] as Task['priority'][]).map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          </Card>
          <Card>
            <CardTitle title="Details" />
            <div className="space-y-3 text-[12px]">
              <div className="flex justify-between"><span className="text-muted">Project</span><span className="font-medium text-ink">{project.name}</span></div>
              <div className="flex justify-between"><span className="text-muted">Start</span><span className="font-medium text-ink">{task.start || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted">Due</span><span className="font-medium text-ink">{task.due || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted">Next follow-up</span><span className="font-medium text-ink">{task.nextFollowUp || 'Not scheduled'}</span></div>
              <div className="flex justify-between"><span className="text-muted">Estimated</span><span className="font-medium text-ink">{task.estimatedHours}h</span></div>
              <div className="flex justify-between"><span className="text-muted">Actual</span><span className="font-medium text-ink">{task.actualHours}h</span></div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'comments' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardTitle title="Comments" subtitle="Persistent task discussion" />
            {task.taskComments.length === 0 ? (
              <EmptyState title="No comments yet" description="Start the discussion with an update or blocker note." />
            ) : (
              <div className="space-y-4">
                {task.taskComments.map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-line bg-[#fafaf8] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar name={comment.author} />
                        <span className="text-[12px] font-semibold text-ink">{comment.author}</span>
                        <span className="text-[10px] text-muted">{formatDate(comment.createdAt)}</span>
                        {comment.updatedAt !== comment.createdAt && <span className="text-[10px] text-muted">(edited)</span>}
                      </div>
                      {!comment.isSystem && (
                        <div className="flex gap-2">
                          <TextButton onClick={() => { setEditingCommentId(comment.id); setEditCommentText(comment.text) }}>Edit</TextButton>
                          <TextButton onClick={() => deleteComment(comment.id)}>Delete</TextButton>
                        </div>
                      )}
                    </div>
                    {editingCommentId === comment.id ? (
                      <div className="space-y-2">
                        <textarea className={inputClass} rows={3} value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} />
                        <div className="flex gap-2">
                          <Button onClick={() => saveCommentEdit(comment.id)}>Save</Button>
                          <Button variant="secondary" onClick={() => { setEditingCommentId(null); setEditCommentText('') }}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-[13px] text-ink">{comment.text}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 rounded-lg border border-line bg-white p-4">
              <Field label="Add a comment or daily update" required error={commentError}>
                <textarea
                  rows={3}
                  className={commentError ? invalidInputClass : inputClass}
                  aria-invalid={!!commentError}
                  value={commentText}
                  onChange={(e) => { setCommentText(e.target.value); setCommentError('') }}
                  placeholder="E.g. Completed homepage design. Waiting for client approval before development can begin."
                />
              </Field>
              <div className="mt-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-[12px] text-ink">
                  <input type="checkbox" checked={isBlocker} onChange={(e) => setIsBlocker(e.target.checked)} />
                  Flag as blocker / risk signal
                </label>
                <Button onClick={postComment}>Post comment</Button>
              </div>
              {analysisState === 'analyzing' && <p className="mt-2 text-[11px] text-amber-600">Analyzing comment for RAID implications...</p>}
              {analysisState === 'done' && <p className="mt-2 text-[11px] text-green-600">RAID suggestion created and is awaiting review.</p>}
              {analysisState === 'none' && <p className="mt-2 text-[11px] text-muted">No RAID implications detected.</p>}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'activity' && (
        <Card>
          <CardTitle title="Activity" subtitle="History of changes and comments" />
          {task.activity.length === 0 ? (
            <EmptyState title="No activity yet" description="Task events will appear here." />
          ) : (
            <div className="space-y-3">
              {[...task.activity].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((event) => (
                <div key={event.id} className="flex items-start gap-3 rounded-lg border border-line p-3">
                  <div className="mt-0.5 text-muted">{activityIcon(event.type)}</div>
                  <div className="flex-1">
                    <p className="text-[13px] text-ink">{event.message}</p>
                    <p className="text-[10px] text-muted">{event.author} · {formatDate(event.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'dependencies' && (
        <Card>
          <CardTitle title="Dependencies" subtitle="Tasks this item relies on" />
          {dependencyTasks.length === 0 ? (
            <EmptyState title="No dependencies" description="This task does not depend on other tasks." />
          ) : (
            <div className="space-y-2">
              {dependencyTasks.map((dep) => (
                <div key={dep.id} className="flex items-center justify-between rounded-lg border border-line p-3">
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{dep.title}</p>
                    <p className="text-[11px] text-muted">Due {dep.due} · {dep.assignee || 'Unassigned'}</p>
                  </div>
                  <Badge tone={statusTones[dep.status] ?? 'neutral'}>{dep.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'raid' && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle title="RAID Insights" subtitle="AI-detected suggestions from this task" />
            <Button variant="secondary" onClick={runTaskAnalysis}>Analyze task status</Button>
          </div>
          {analysisState === 'analyzing' && <p className="text-[12px] text-amber-600">Analyzing task status...</p>}
          {taskAiFindings.length === 0 ? (
            <EmptyState title="No RAID insights" description="Add a comment with blocker, risk, or dependency language, or run the task status analysis." />
          ) : (
            <div className="space-y-3">
              {taskAiFindings.map((finding) => (
                <div key={finding.id} className="rounded-lg border border-line p-4 transition hover:shadow-lift">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone={finding.category === 'Risk' ? 'red' : finding.category === 'Issue' ? 'amber' : finding.category === 'Dependency' ? 'blue' : 'neutral'}>{finding.category}</Badge>
                        <span className="text-[10px] text-muted">Confidence: {finding.confidence}</span>
                      </div>
                      <h4 className="mt-1 text-[14px] font-semibold text-ink">{finding.title}</h4>
                      <p className="text-[12px] text-muted">{finding.explanation}</p>
                      <p className="mt-1 text-[11px] text-ink"><span className="font-semibold">Evidence:</span> {finding.evidence}</p>
                      <p className="text-[10px] text-muted">Suggested owner: {finding.recommendedOwner} · P{finding.suggestedProbability}×I{finding.suggestedImpact}</p>
                    </div>
                    {finding.status === 'awaiting review' && (
                      <div className="flex gap-2">
                        <Button onClick={() => acceptFinding(finding)}>Accept</Button>
                        <Button variant="secondary" onClick={() => rejectFinding(finding)}>Reject</Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <TaskModal open={editOpen} editing={task} onClose={() => setEditOpen(false)} />
    </div>
  )
}
