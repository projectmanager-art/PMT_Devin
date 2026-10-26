import type { Project, Task, TaskComment } from '../store'
import { type AiFinding, type Probability, type Impact, type RaidCategory, today } from './raid'

const uid = () => Math.random().toString(36).slice(2, 9)

export interface AnalysisContext {
  task: Task
  project: Project
  comment: TaskComment
  existingFindings: AiFinding[]
  existingRaids: RaidItem[]
  allTasks: Task[]
}

type RaidItem = import('./raid').RaidItem

interface MatchResult {
  category: RaidCategory
  confidence: 'Low' | 'Medium' | 'High'
  title: string
  explanation: string
  probability: Probability
  impact: Impact
  owner: string
  mitigation: string
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function containsAny(text: string, phrases: string[]) {
  const n = normalize(text)
  return phrases.some((p) => n.includes(p.toLowerCase()))
}

function snippet(text: string, max = 160) {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + '…'
}

function scoreKeywords(text: string, groups: Record<string, string[]>) {
  const n = normalize(text)
  let bestKey = ''
  let bestScore = 0
  for (const [key, phrases] of Object.entries(groups)) {
    const score = phrases.reduce((sum, phrase) => sum + (n.includes(phrase.toLowerCase()) ? 1 : 0), 0)
    if (score > bestScore) {
      bestScore = score
      bestKey = key
    }
  }
  return { bestKey, bestScore }
}

function inferProbability(text: string): Probability {
  if (containsAny(text, ['certain', 'definitely', 'will', 'already'])) return 5
  if (containsAny(text, ['likely', 'probably', 'almost', 'expected'])) return 4
  if (containsAny(text, ['possible', 'maybe', 'might', 'could', 'may', 'potential'])) return 3
  if (containsAny(text, ['unlikely', 'rare', 'improbable'])) return 2
  return 3
}

function inferImpact(text: string): Impact {
  if (containsAny(text, ['critical', 'severe', 'catastrophic', 'huge', 'significant delay'])) return 5
  if (containsAny(text, ['major', 'important', 'substantial', 'affects milestone'])) return 4
  if (containsAny(text, ['moderate', 'some', 'slight delay'])) return 3
  if (containsAny(text, ['minor', 'small', 'low'])) return 2
  return 3
}

export function isRoutineComment(text: string): boolean {
  return containsAny(text, [
    'completed', 'done', 'finished', 'in progress', 'working on', 'started', 'continuing', 'all good', 'on track', 'no blockers', 'as planned', 'updated', 'progress is good',
  ])
}

function classifyComment(text: string, task: Task, project: Project): MatchResult | null {
  if (isRoutineComment(text)) return null

  const n = normalize(text)
  const issuePhrases = ['blocked', 'blocker', 'problem', 'issue', 'not working', 'broken', 'failed', 'failure', 'bug', 'cannot start', 'stuck', 'error', 'missing']
  const dependencyPhrases = ['waiting for', 'depends on', 'requires', 'needs', 'need', 'dependent on', 'reliant on', 'pending', 'approval', 'client approval', 'api credentials', 'access', 'server access', 'before we can', 'before development']
  const riskPhrases = ['risk', 'concern', 'might', 'may', 'could', 'threaten', 'delay', 'overrun', 'shortage', 'uncertain', 'unknown', 'not sure', 'worried', 'affect delivery', 'affect the date']
  const assumptionPhrases = ['assume', 'assumption', 'expect', 'expected', 'we believe', 'hope', 'should be', 'planning on', 'assuming', 'presume']

  const groups = { Issue: issuePhrases, Dependency: dependencyPhrases, Risk: riskPhrases, Assumption: assumptionPhrases }
  const { bestKey, bestScore } = scoreKeywords(text, groups)

  if (bestScore === 0 && n.split(' ').length < 5) return null
  if (bestScore === 0) return null

  const category = bestKey as RaidCategory
  const confidence = bestScore >= 2 ? 'High' : bestScore === 1 ? 'Medium' : 'Low'
  const impact = inferImpact(text)
  const probability = category === 'Risk' ? inferProbability(text) : (3 as Probability)

  let title = task.title
  if (category === 'Dependency') title = `Pending dependency for: ${task.title}`
  if (category === 'Issue') title = `Issue flagged on: ${task.title}`
  if (category === 'Risk') title = `Potential risk on: ${task.title}`
  if (category === 'Assumption') title = `Assumption noted for: ${task.title}`

  const explanation = `The comment on task "${task.title}" suggests a ${category.toLowerCase()} that may affect the project. Review the source comment and confirm before adding it to the RAID register.`
  const mitigation = category === 'Risk'
    ? 'Define mitigation, assign owner, and set a target review date.'
    : category === 'Issue'
      ? 'Investigate root cause and assign an owner with a due date.'
      : category === 'Dependency'
        ? 'Identify the required input or approval, owner, and due date.'
        : 'Validate the assumption and record the validation method and date.'

  return {
    category,
    confidence,
    title,
    explanation,
    probability,
    impact,
    owner: task.assignee || project.manager || 'Unassigned',
    mitigation,
  }

}

function titleKey(title: string) {
  return normalize(title).replace(/\s+/g, ' ')
}

function isDuplicate(finding: AiFinding, existing: AiFinding[], raids: RaidItem[], taskId: string): boolean {
  const dupByFinding = existing.some(
    (e) => e.status !== 'rejected' && e.sourceIds.includes(finding.sourceIds[0]) && titleKey(e.title) === titleKey(finding.title),
  )
  if (dupByFinding) return true
  const dupByRaid = raids.some(
    (r) =>
      r.category === finding.category &&
      r.affectedTaskIds.includes(taskId) &&
      (titleKey(r.title) === titleKey(finding.title) || r.evidence.toLowerCase().includes(finding.evidence.toLowerCase().slice(0, 80))),
  )
  return dupByRaid
}

export function analyzeComment(
  comment: TaskComment,
  task: Task,
  project: Project,
  existingFindings: AiFinding[],
  existingRaids: RaidItem[],
  allTasks: Task[],
): AiFinding[] {
  const match = classifyComment(comment.text, task, project)
  if (!match) return []

  const relatedTaskIds = allTasks
    .filter((t) => t.projectId === project.id && t.id !== task.id && (t.title.toLowerCase().includes(normalize(comment.text).slice(0, 20)) || task.dependencies.includes(t.id)))
    .map((t) => t.id)

  const finding: AiFinding = {
    id: `ai-${uid()}`,
    category: match.category,
    title: match.title,
    explanation: match.explanation,
    evidence: snippet(comment.text),
    sourceIds: [comment.id, task.id, project.id, ...relatedTaskIds],
    sourceType: 'task',
    detectedAt: new Date().toISOString(),
    confidence: match.confidence,
    suggestedProbability: match.probability,
    suggestedImpact: match.impact,
    recommendedMitigation: match.mitigation,
    recommendedOwner: match.owner,
    reviewBy: today(),
    status: 'awaiting review',
  }

  if (isDuplicate(finding, existingFindings, existingRaids, task.id)) return []

  return [finding]
}

export function analyzeTaskStatus(
  task: Task,
  project: Project,
  existingFindings: AiFinding[],
  existingRaids: RaidItem[],
): AiFinding[] {
  const findings: AiFinding[] = []
  const now = new Date().toISOString()

  if (task.status === 'Blocked') {
    const id = `ai-${uid()}`
    const finding: AiFinding = {
      id,
      category: 'Issue',
      title: `Blocked task: ${task.title}`,
      explanation: `The task is marked Blocked and may delay the project.`,
      evidence: `Task status is Blocked on ${now.slice(0, 10)}.`,
      sourceIds: [task.id, project.id],
      sourceType: 'task',
      detectedAt: now,
      confidence: 'High',
      suggestedProbability: 4,
      suggestedImpact: 4,
      recommendedMitigation: 'Identify the blocker and assign an owner to resolve it.',
      recommendedOwner: task.assignee || project.manager || 'Unassigned',
      reviewBy: today(),
      status: 'awaiting review',
    }
    if (!isDuplicate(finding, existingFindings, existingRaids, task.id)) findings.push(finding)
  }

  if (task.due && new Date(task.due) < new Date() && task.status !== 'Completed') {
    const id = `ai-${uid()}`
    const finding: AiFinding = {
      id,
      category: 'Risk',
      title: `Overdue task: ${task.title}`,
      explanation: `The task is overdue and may impact the schedule.`,
      evidence: `Task due date ${task.due} has passed while status is ${task.status}.`,
      sourceIds: [task.id, project.id],
      sourceType: 'task',
      detectedAt: now,
      confidence: 'High',
      suggestedProbability: 4,
      suggestedImpact: 4,
      recommendedMitigation: 'Assess schedule impact and update the plan or escalate.',
      recommendedOwner: task.assignee || project.manager || 'Unassigned',
      reviewBy: today(),
      status: 'awaiting review',
    }
    if (!isDuplicate(finding, existingFindings, existingRaids, task.id)) findings.push(finding)
  }

  return findings
}
