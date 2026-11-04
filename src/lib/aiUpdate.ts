/**
 * AI natural-language project update engine — pure, dependency-free.
 *
 * Turns a plain-English status description into a structured, validated
 * proposal that the StatusUpdateModal renders for review before anything
 * is written. Never trusts itself: every extracted field carries a source
 * tag (explicit / inferred / carried) and the apply payload is re-validated.
 *
 * No imports — this file is transpiled and exercised directly by
 * tests/ai-update.test.cjs.
 */

export type AiProjectStatus = 'Planning' | 'In Progress' | 'On Hold' | 'Completed' | 'At Risk' | 'Backed Off'
export type AiRaidCategory = 'Risk' | 'Assumption' | 'Issue' | 'Dependency'

export const AI_STATUSES: AiProjectStatus[] = ['Planning', 'In Progress', 'On Hold', 'Completed', 'At Risk', 'Backed Off']

export interface AiField<T> {
  /** true when the user's text (or a documented carry-forward rule) provides a value */
  present: boolean
  value: T
  /** explicit = stated in text · inferred = derived by a documented rule · carried = preserved from the previous report */
  source: 'explicit' | 'inferred' | 'carried'
}

export interface RaidCandidate {
  category: AiRaidCategory
  title: string
  description: string
  /** normalized key used for duplicate prevention */
  dedupKey: string
  /** false when an equivalent open RAID item already exists */
  suggested: boolean
  reason?: string
}

export interface AiProposal {
  status: AiField<AiProjectStatus>
  progress: AiField<number>
  blockerSeverity: AiField<'none' | 'non-critical' | 'critical'>
  workCompleted: AiField<string>
  currentWork: AiField<string>
  pendingWork: AiField<string>
  blockers: AiField<string>
  clientUpdate: AiField<string>
  risksDependencies: AiField<string>
  nextSteps: AiField<string>
  expectedCompletion: AiField<string>
  internalRemarks: AiField<string>
  teamStatusNote: string
  raidCandidates: RaidCandidate[]
  clarifications: string[]
  summary: string
  hasMeaningfulChanges: boolean
}

export interface AiProjectContext {
  id: string
  name: string
  status: string
  progress: number
  end?: string
}

export interface AiLatestUpdate {
  workCompleted?: string
  currentWork?: string
  pendingWork?: string
  blockers?: string
  clientUpdate?: string
  risksDependencies?: string
  nextSteps?: string
  internalRemarks?: string
}

export interface AiOpenRisk {
  title: string
  status: string
  projectId: string
}

export interface AnalyzeContext {
  project: AiProjectContext
  latestUpdate?: AiLatestUpdate
  openRaids?: AiOpenRisk[]
}

/* ---------------------------------- helpers --------------------------------- */

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9%$]+/g, ' ').replace(/\s+/g, ' ').trim()

const normKey = (s: string) => normalize(s).replace(/ /g, '-')

/** Token-overlap similarity — catches "Client UAT is pending" ≈ "Client-side UAT pending". */
const similarTitle = (a: string, b: string) => {
  const tok = (s: string) => new Set(normalize(s).split(' ').filter((w) => w.length >= 3))
  const ta = tok(a)
  const tb = tok(b)
  if (!ta.size || !tb.size) return false
  let shared = 0
  ta.forEach((t) => { if (tb.has(t)) shared++ })
  return shared / Math.max(ta.size, tb.size) >= 0.6
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Split free text into clauses on sentence boundaries and common conjunctions. */
function clauses(input: string): string[] {
  return input
    .replace(/,?\s+but\s+/gi, '. ')
    .replace(/,?\s+and then\s+/gi, '. ')
    .replace(/,\s+and\s+/gi, '. ')
    .split(/[\n;]+|\.(?:\s+|$)|\?(?:\s+|$)/)
    .map((c) => c.trim().replace(/^[,.-]\s*/, '').replace(/\s+/g, ' '))
    .filter((c) => c.length > 1)
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
}

/** Parse an explicit date mention into YYYY-MM-DD. Returns '' when nothing concrete. */
function extractDate(clause: string): string {
  const iso = clause.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  const now = new Date()
  const mk = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  // "15 Nov", "15th of November", "Nov 15", "November 15th" — optional year
  const dFirst = clause.match(/(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s*,?\s*(20\d{2}))?/i)
  const mFirst = clause.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(20\d{2}))?/i)
  const hit = dFirst ?? mFirst
  if (!hit) return ''
  const m = MONTHS[hit[1].toLowerCase()] ?? MONTHS[hit[2]?.toLowerCase() ?? '']
  const d = Number(dFirst ? hit[1] : hit[2])
  let y = hit[3] ? Number(hit[3]) : now.getFullYear()
  if (!m || d < 1 || d > 31) return ''
  // No year given and the date already passed this year → assume next year
  if (!hit[3] && mk(y, m, d) < mk(now.getFullYear(), now.getMonth() + 1, now.getDate())) y += 1
  return mk(y, m, d)
}

/* ------------------------------- classification ------------------------------ */

const RE = {
  progress: /(\d{1,3})\s*(?:%|percent\b)/i,
  vagueDate: /\b(by|before|until|around)\s+(friday|monday|tuesday|wednesday|thursday|saturday|sunday|eod|eow|end of (the )?(week|month|sprint|quarter|year)|next week|next month)\b/i,
  noBlockers: /\b(no|zero|without any|no internal|none)\b[^.]{0,40}\bblocker|no blockers?|nothing (is )?block|not blocked|no (internal )?issues?\b|no impediments?/i,
  blocker: /\bblock(?:ed|er|ing)?\b|\bstuck\b|\bfail(?:ing|ed|ure|s)?\b|\bbroken\b|\bbug(s)?\b|\bcrash|\bdowntime|\bregression\b|\btechnical (issue|problem|debt)\b|\bresource (constraint|shortage)|short[- ]staffed|blocked by\b/i,
  client: /\bclient|customer|uat\b|user acceptance|sign[- ]?off|approv(?:al|e|ed|ing)|feedback|content|assets?|copy(?:writing)?|brand(ing)?\b|payment (confirm|receiv|approv|pend|delay)|invoice\b|stakeholder|business owner|product owner/i,
  awaiting: /\bawait(?:ing|s)?\b|\bwaiting (for|on)\b|\bpending\b|\boutstanding\b|\bremaining\b|\byet to\b|\bnot yet\b|\bstill (to|need|needs)\b|\bleft to\b|\bto be (done|completed|finished)\b|\bnot started\b|\bnot begun\b|\bTBD\b/i,
  done: /\bcomplet(?:e|ed|ion)\b|\bdone\b|\bfinish(?:ed)?\b|\bwrap(?:ped)? (up)?\b|\bdeliver(?:ed|s)\b|\bdeploy(?:ed)?\b|\breleased?\b|\bmerged\b|\bclosed out\b|\bsigned off\b|\bhanded over\b/i,
  doing: /\bcurrently\b|\bright now\b|\bin progress\b|\bunderway\b|\bongoing\b|\bworking on\b|\bin the middle of\b|\bcontinuing\b|\bstarted\b/i,
  risk: /\brisk\b|\bdepends? on\b|\bdependenc(?:y|ies)\b|\bmay (delay|take|push|slip)\b|\bcould (delay|take|push|slip)\b|\bmight (delay|take|push|slip)\b|\bif .+ then\b|\bslippage\b|\bexposure\b/i,
  assume: /\bassum(?:e|ed|ing|ption)\b|\bpresum/i,
  next: /\bfollow[- ]?up\b|\bnext step\b|\bplan(?:ning)? to\b|\bwe will\b|\bwill (send|schedule|arrange|share|deliver|deploy|start|coordinate|reach)\b|\bschedul(?:e|ing)\b|\breach out\b|\bcoordinate\b|\borganize\b|\bsend\b/i,
  internal: /\binternal|team|our (dev|qa|design|engineering|backend|frontend)|resource|staff/i,
}

interface Clause {
  text: string
  tags: Set<string>
}

function tagClauses(input: string): Clause[] {
  return clauses(input).map((text) => {
    const tags = new Set<string>()
    const add = (tag: string, re: RegExp) => { if (re.test(text)) tags.add(tag) }
    add('progress', RE.progress)
    add('noBlockers', RE.noBlockers)
    add('blocker', RE.blocker)
    add('client', RE.client)
    add('awaiting', RE.awaiting)
    add('done', RE.done)
    add('doing', RE.doing)
    add('risk', RE.risk)
    add('assume', RE.assume)
    add('next', RE.next)
    add('internal', RE.internal)
    if (RE.vagueDate.test(text)) tags.add('vagueDate')
    if (extractDate(text)) tags.add('date')
    // Negated "done" is really pending: "not completed", "not done"
    if (tags.has('done') && /\bnot (yet )?(complet|done|finish|deliver|deploy|releas)/i.test(text)) {
      tags.delete('done'); tags.add('awaiting')
    }
    return { text, tags }
  })
}

function detectStatus(input: string, cls: Clause[]): { status: AiProjectStatus; source: 'explicit' | 'inferred' } | null {
  const low = input.toLowerCase()
  // Explicit project-level completion only — never infer Completed from a phase being done
  if (
    /\b(project|it|everything|all work|deliverable(s)?) (is |was |has been )?(now )?(fully )?(complete|completed|done|delivered|closed)\b|\bcompleted the project\b|\bproject (is )?closed\b/i.test(low) ||
    /\b(mark|set|mov(e|ed)|chang(e|ed)|updat(e|ed)) (it |this |the |project |status |to |as |now )*(as |to )?(complete|completed|done|closed|delivered)\b/i.test(low) ||
    /\b(marked|set|closed) (as |to )?(complete|completed|done|delivered)\b/i.test(low) ||
    /\bclose (the |this |out )?project\b/i.test(low)
  ) {
    return { status: 'Completed', source: 'explicit' }
  }
  if (/\b(backed off|dropped|shelved|cancelled|canceled)\b/.test(low)) return { status: 'Backed Off', source: 'explicit' }
  if (/\bon hold\b|\bpaused\b|\bput on hold\b|\bsuspended\b/.test(low)) return { status: 'On Hold', source: 'explicit' }
  if (/\bat risk\b|\bin jeopardy\b|\bin danger\b|\bgoing red\b|\bturning red\b/.test(low)) return { status: 'At Risk', source: 'explicit' }
  if (/\b(still |currently )?in (the )?planning\b|\bplanning phase\b|\bkick[- ]?off\b/.test(low)) return { status: 'Planning', source: 'explicit' }
  if (/\bin progress\b|\bongoing\b|\bunderway\b|\bproceeding\b|\bwork continues\b/.test(low)) return { status: 'In Progress', source: 'inferred' }
  if (cls.some((c) => c.tags.has('blocker') && !c.tags.has('noBlockers'))) return { status: 'At Risk', source: 'inferred' }
  return null
}

function raidForClause(c: Clause): RaidCandidate | null {
  const key = normKey(c.text)
  if (c.tags.has('blocker') && !c.tags.has('noBlockers') && !c.tags.has('client')) {
    return { category: 'Issue', title: titleCase(c.text), description: `Reported via AI update: "${c.text}"`, dedupKey: key, suggested: true }
  }
  if (c.tags.has('assume')) {
    return { category: 'Assumption', title: titleCase(c.text), description: `Assumption noted via AI update: "${c.text}"`, dedupKey: key, suggested: true }
  }
  if (c.tags.has('risk') || (c.tags.has('client') && c.tags.has('awaiting')) || (c.tags.has('awaiting') && /\bwaiting|await/i.test(c.text))) {
    const isClientDep = c.tags.has('client')
    const isPureWait = /\bwaiting|await/i.test(c.text) && !c.tags.has('risk')
    const category: AiRaidCategory = isClientDep || isPureWait ? 'Dependency' : 'Risk'
    return {
      category,
      title: titleCase(c.text),
      description: `${category} detected via AI update: "${c.text}"`,
      dedupKey: key,
      suggested: true,
    }
  }
  return null
}

/* --------------------------------- analyzer ---------------------------------- */

export function analyzeUpdate(input: string, ctx: AnalyzeContext): AiProposal {
  const clarifications: string[] = []
  const cls = tagClauses(input)
  const empty = <T>(value: T): AiField<T> => ({ present: false, value, source: 'explicit' })

  /* progress — take the first explicit %, warn on extras */
  const progressHits = [...input.matchAll(/(\d{1,3})\s*(?:%|percent\b)/gi)].map((m) => Number(m[1]))
  const progress = empty(ctx.project.progress ?? 0)
  if (progressHits.length) {
    const value = progressHits[0]
    if (value > 100) {
      clarifications.push(`Progress "${value}%" is invalid (0–100). Progress was left at ${ctx.project.progress}%.`)
    } else {
      Object.assign(progress, { present: true, value, source: 'explicit' as const })
    }
    if (progressHits.length > 1) clarifications.push(`Multiple percentages mentioned (${progressHits.join('%, ')}%) — applied ${progressHits[0]}%.`)
  }

  /* status */
  const statusHit = detectStatus(input, cls)
  const status = empty((AI_STATUSES as string[]).includes(ctx.project.status) ? (ctx.project.status as AiProjectStatus) : 'In Progress')
  if (statusHit) Object.assign(status, { present: true, value: statusHit.status, source: statusHit.source })

  /* field buckets — a clause can feed several fields (e.g. "client UAT pending" → client + pending) */
  const bucket = (want: (c: Clause) => boolean) =>
    cls.filter(want).map((c) => titleCase(c.text.replace(/\.$/, ''))).join('. ')

  const noBlockersClause = cls.find((c) => c.tags.has('noBlockers'))
  const teamStatusNote = noBlockersClause ? 'No internal blockers reported.' : ''

  const blockerClauses = cls.filter((c) => c.tags.has('blocker') && !c.tags.has('noBlockers') && !c.tags.has('client'))
  const criticalBlocker = blockerClauses.some((c) => /critical|severe|major|urgent/i.test(c.text))

  const carried = <T extends keyof AiLatestUpdate>(key: T): string => ctx.latestUpdate?.[key]?.trim() ?? ''

  const textField = (value: string, carriedValue: string): AiField<string> =>
    value
      ? { present: true, value, source: 'explicit' }
      : carriedValue
        ? { present: true, value: carriedValue, source: 'carried' }
        : { present: false, value: '', source: 'explicit' }

  const workCompleted = textField(bucket((c) => c.tags.has('done')), carried('workCompleted'))
  const currentWork = textField(bucket((c) => c.tags.has('doing') && !c.tags.has('done')), carried('currentWork'))
  const pendingWork = textField(bucket((c) => c.tags.has('awaiting')), carried('pendingWork'))
  const blockers = textField(
    blockerClauses.map((c) => titleCase(c.text)).join('. '),
    carried('blockers'),
  )
  const clientUpdate = textField(
    bucket((c) => c.tags.has('client')),
    carried('clientUpdate'),
  )
  const risksDependencies = textField(
    bucket((c) => c.tags.has('risk') || (c.tags.has('awaiting') && /\bwaiting|await|depends? on/i.test(c.text))),
    carried('risksDependencies'),
  )
  const nextSteps = textField(bucket((c) => c.tags.has('next')), carried('nextSteps'))

  /* expected completion — explicit dates only */
  const dateClause = cls.find((c) => c.tags.has('date') && /\b(by|on|expected|complet|deliver|deadline|launch|go[- ]?live|finish|end)\b/i.test(c.text))
    ?? cls.find((c) => c.tags.has('date'))
  const expectedCompletion = empty('')
  if (dateClause) {
    Object.assign(expectedCompletion, { present: true, value: extractDate(dateClause.text), source: 'explicit' as const })
  }
  const vague = cls.find((c) => c.tags.has('vagueDate') && !c.tags.has('date'))
  if (vague) clarifications.push(`"${vague.text}" mentions timing but no concrete date — deadline left unchanged.`)

  /* internal remarks — explicit team-status note + internal-tagged leftovers */
  const remarksParts: string[] = []
  if (teamStatusNote) remarksParts.push(teamStatusNote)
  const internalRemark = bucket((c) => c.tags.has('internal') && !c.tags.has('blocker') && !c.tags.has('noBlockers') && !c.tags.has('done') && !c.tags.has('awaiting'))
  if (internalRemark) remarksParts.push(internalRemark)
  const internalRemarks = textField(remarksParts.join(' '), carried('internalRemarks'))

  /* ambiguities worth asking about */
  if (status.present && status.value === 'Completed' && pendingWork.present && pendingWork.source === 'explicit' && pendingWork.value) {
    clarifications.push('The project was described as completed but pending work was also detected — status left as reported; please confirm.')
  }
  if (!progress.present && !status.present && !cls.length) {
    clarifications.push('Could not understand the update — try describing progress, what is done, what is pending, or any blockers.')
  }

  /* RAID candidates with dedup against existing open items */
  const open = ctx.openRaids ?? []
  const candidates: RaidCandidate[] = []
  const seen = new Set<string>()
  for (const c of cls) {
    const cand = raidForClause(c)
    if (!cand || seen.has(cand.dedupKey)) continue
    seen.add(cand.dedupKey)
    const dup = open.some((r) => r.projectId === ctx.project.id && similarTitle(r.title, cand.title))
    if (dup) { cand.suggested = false; cand.reason = 'Already tracked in RAID register' }
    candidates.push(cand)
  }

  const fieldList = [workCompleted, currentWork, pendingWork, blockers, clientUpdate, risksDependencies, nextSteps, internalRemarks, expectedCompletion]
  const hasMeaningfulChanges =
    (status.present && status.source !== 'carried') ||
    progress.present ||
    teamStatusNote !== '' ||
    candidates.some((c) => c.suggested) ||
    fieldList.some((f) => f.present && f.source === 'explicit')

  /* human-readable summary */
  const sumParts: string[] = []
  if (status.present && status.source !== 'carried') sumParts.push(`status → ${status.value}`)
  if (progress.present) sumParts.push(`progress → ${progress.value}%`)
  if (workCompleted.present && workCompleted.source === 'explicit') sumParts.push('completed work recorded')
  if (pendingWork.present && pendingWork.source === 'explicit') sumParts.push('pending items noted')
  if (clientUpdate.present && clientUpdate.source === 'explicit') sumParts.push('client-side update captured')
  if (blockers.present && blockers.source === 'explicit') sumParts.push('blockers flagged')
  if (teamStatusNote) sumParts.push(teamStatusNote.toLowerCase())
  if (candidates.length) sumParts.push(`${candidates.length} RAID item(s) detected`)
  const summary = sumParts.length
    ? `Understood: ${sumParts.join(' · ')}.`
    : 'No actionable update detected — add progress, status, or work details.'

  return {
    status,
    progress,
    blockerSeverity: blockerClauses.length ? { present: true, value: criticalBlocker ? 'critical' : 'non-critical', source: 'explicit' } : empty('none' as const),
    workCompleted, currentWork, pendingWork, blockers, clientUpdate, risksDependencies, nextSteps,
    expectedCompletion, internalRemarks,
    teamStatusNote, raidCandidates: candidates, clarifications, summary, hasMeaningfulChanges,
  }
}

/* ------------------------------ apply-time guard ----------------------------- */

export interface ApplyPayload {
  projectId: string
  status: AiProjectStatus
  progress: number
  blockerSeverity: 'none' | 'non-critical' | 'critical'
  workCompleted: string
  currentWork: string
  pendingWork: string
  blockers: string
  clientUpdate: string
  risksDependencies: string
  nextSteps: string
  expectedCompletion: string
  internalRemarks: string
}

/**
 * Server-side-equivalent validation — rejects anything outside the permitted
 * schema and applies the workflow guards (never auto-Completed while pending
 * work remains, never regress progress silently).
 * Returns the payload or an error string.
 */
export function buildApplyPayload(p: AiProposal, project: AiProjectContext): ApplyPayload | string {
  if (!project?.id) return 'Unknown project'
  const progress = p.progress.present ? p.progress.value : project.progress
  if (typeof progress !== 'number' || !isFinite(progress) || progress < 0 || progress > 100) {
    return `Invalid progress value "${progress}"`
  }
  const status = p.status.present ? p.status.value : (project.status as AiProjectStatus)
  if (!AI_STATUSES.includes(status)) return `Invalid status "${status}"`
  // Guard: "Completed" needs explicit intent AND no explicit pending work
  if (status === 'Completed' && p.status.source !== 'explicit') return 'Cannot mark Completed without an explicit statement'
  if (status === 'Completed' && p.pendingWork.source === 'explicit' && p.pendingWork.value) {
    return 'Project reported as completed but pending work was detected — confirm completion first'
  }
  const date = p.expectedCompletion.present ? p.expectedCompletion.value : ''
  if (date && !/^20\d{2}-\d{2}-\d{2}$/.test(date)) return `Invalid completion date "${date}"`
  const sev = p.blockerSeverity.present ? p.blockerSeverity.value : 'none'
  const str = (f: AiField<string>) => (f.present ? f.value.trim() : '')
  return {
    projectId: project.id,
    status,
    progress: Math.round(progress),
    blockerSeverity: str(p.blockers) ? (sev === 'none' ? 'non-critical' : sev) : 'none',
    workCompleted: str(p.workCompleted),
    currentWork: str(p.currentWork),
    pendingWork: str(p.pendingWork),
    blockers: str(p.blockers),
    clientUpdate: str(p.clientUpdate),
    risksDependencies: str(p.risksDependencies),
    nextSteps: str(p.nextSteps),
    expectedCompletion: date,
    internalRemarks: str(p.internalRemarks),
  }
}

/** Structural validation for an externally produced proposal (HTTP provider). */
export function validateProposal(raw: unknown): raw is AiProposal {
  const p = raw as AiProposal
  if (!p || typeof p !== 'object') return false
  const okField = (f: any) => f && typeof f === 'object' && typeof f.present === 'boolean' && typeof f.source === 'string'
  const textOk = ['workCompleted', 'currentWork', 'pendingWork', 'blockers', 'clientUpdate', 'risksDependencies', 'nextSteps', 'internalRemarks', 'expectedCompletion']
    .every((k) => okField((p as any)[k]) && typeof (p as any)[k].value === 'string')
  return (
    textOk &&
    okField(p.status) && (AI_STATUSES as string[]).includes(p.status.value) &&
    okField(p.progress) && typeof p.progress.value === 'number' &&
    Array.isArray(p.clarifications) &&
    Array.isArray(p.raidCandidates)
  )
}

/* --------------------------------- providers --------------------------------- */

export interface AiUpdateProvider {
  name: string
  analyze(input: string, ctx: AnalyzeContext): Promise<AiProposal>
}

/** Offline deterministic provider — always available, no keys required. */
export const localNlpProvider: AiUpdateProvider = {
  name: 'built-in language engine',
  analyze: async (input, ctx) => analyzeUpdate(input, ctx),
}
