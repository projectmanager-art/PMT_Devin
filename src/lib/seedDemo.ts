/**
 * Demo-data seeder — fills empty collections and regenerates demo-owned
 * records whenever DEMO_SEED_VERSION bumps, so every module (Workstream,
 * Timeline, Calendar, Meetings, Documents, RAID, Reports) has realistic,
 * cross-linked test data. Records the user created (no `demoSeed` flag)
 * are never touched.
 *
 * Pure functions — exercised by tests/demo-seed.test.cjs.
 */

import type { AppData, Client, DocumentItem, Meeting, Project, StatusUpdate, Task, TeamMember } from '../store'
import { emptyRaid, normalizeRisk } from './raid'

const DEMO_SEED_VERSION = 2

const uid = () => Math.random().toString(36).slice(2, 9)
const dayKey = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const isoAt = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString()
const hash = (s: string) => [...s].reduce((a, c) => ((a * 31 + c.charCodeAt(0)) >>> 0), 7)

/* ----------------------------------- team ----------------------------------- */

const TEAM_SEED: Omit<TeamMember, 'id'>[] = [
  { name: 'Sandeep Rana', role: 'Project Manager', skills: 'Delivery, Client management', capacity: 40, utilized: 0, projects: [], gender: 'male' },
  { name: 'Raunik', role: 'Tech Lead', skills: 'Architecture, Reviews', capacity: 40, utilized: 0, projects: [], gender: 'male' },
  { name: 'Aman', role: 'Developer', skills: 'Frontend, React', capacity: 40, utilized: 0, projects: [], gender: 'male' },
  { name: 'Avinash', role: 'Designer', skills: 'UI/UX, Figma', capacity: 40, utilized: 0, projects: [], gender: 'male' },
  { name: 'Deepak', role: 'Developer', skills: 'Backend, APIs', capacity: 40, utilized: 0, projects: [], gender: 'male' },
  { name: 'Shivam', role: 'Developer', skills: 'Full-stack', capacity: 40, utilized: 0, projects: [], gender: 'male' },
  { name: 'Nikhil', role: 'DevOps', skills: 'CI/CD, Hosting', capacity: 35, utilized: 0, projects: [], gender: 'male' },
  { name: 'Abhijeet', role: 'QA Engineer', skills: 'Testing, UAT', capacity: 40, utilized: 0, projects: [], gender: 'male' },
  { name: 'Suraj', role: 'Content', skills: 'SEO, Copywriting', capacity: 35, utilized: 0, projects: [], gender: 'male' },
]

export const buildTeam = (): TeamMember[] => TEAM_SEED.map((m) => ({ ...m, id: uid() }))

/* --------------------------- industry-aware tasks --------------------------- */

const TASK_SETS: { match: RegExp; tasks: [string, number][] }[] = [
  { match: /driv|motor|vehicle/, tasks: [['Learner booking portal', 14], ['Instructor scheduling module', 16], ['Theory test prep section', 10], ['Payment & package pricing page', 8], ['Student progress dashboard', 12], ['DVLA compliance content', 6]] },
  { match: /tutor|learn|academ|admission|educat|school|course/, tasks: [['Course catalogue & filtering', 14], ['Tutor profile pages', 10], ['Enrollment & payment flow', 18], ['Video lesson player', 16], ['Student quiz engine', 14], ['Certificate generation', 8]] },
  { match: /foot|shoe/, tasks: [['Product catalogue with sizes', 16], ['Cart & checkout flow', 18], ['Inventory stock sync', 12], ['Brand story landing page', 8], ['Order tracking page', 10], ['Wholesale enquiry form', 6]] },
  { match: /clean|maid/, tasks: [['Service booking calendar', 14], ['Instant quote calculator', 12], ['Before/after gallery', 8], ['Team scheduling board', 14], ['Review collection widget', 6], ['Recurring clean plans page', 10]] },
  { match: /insulat|renovat|construc|engg|build/, tasks: [['Project gallery with filters', 10], ['Quote request wizard', 12], ['Materials cost estimator', 14], ['Certifications & accreditations page', 6], ['Site survey booking form', 8], ['Supplier portal integration', 16]] },
  { match: /propert|real ?estate|realty|housing/, tasks: [['Property listing search', 16], ['Listing detail galleries', 10], ['Agent contact routing', 8], ['Valuation request form', 8], ['Saved searches & alerts', 12], ['Tenancy document portal', 14]] },
  { match: /gas|boiler|heating|energy/, tasks: [['Emergency callout banner', 4], ['Boiler service booking', 12], ['Gas Safe certificate display', 6], ['Annual cover plans page', 10], ['Engineer visit tracker', 14], ['Quote comparison tool', 12]] },
  { match: /party|event|suppl|gift/, tasks: [['Theme package pages', 10], ['Date availability checker', 12], ['Custom order form', 14], ['Photo gallery & testimonials', 8], ['Balloon & décor configurator', 12], ['Deposit payment flow', 10]] },
  { match: /care|health|medic|clinic/, tasks: [['Services & treatments pages', 12], ['Appointment request form', 10], ['Team & credentials section', 8], ['Patient resources library', 10], ['Insurance & pricing page', 8], ['Accessibility compliance pass', 12]] },
  { match: /mountain|trek|adventure/, tasks: [['Expedition itinerary pages', 12], ['Difficulty & altitude guide', 8], ['Booking & deposit flow', 14], ['Gear checklist section', 6], ['Guide team profiles', 8], ['Weather & season planner', 10]] },
  { match: /design|studio|creative/, tasks: [['Portfolio case study pages', 12], ['Service packages section', 8], ['Client intake questionnaire', 8], ['Brand process timeline', 6], ['Testimonial carousel', 6], ['Project enquiry form', 8]] },
]
const WEB_TASKS: [string, number][] = [['Homepage hero & layout', 12], ['CMS content structure', 14], ['Contact & enquiry forms', 8], ['SEO metadata & schema', 6], ['Performance optimization', 10], ['Mobile responsiveness pass', 8]]

const taskPoolFor = (p: Project): [string, number][] =>
  TASK_SETS.find((s) => s.match.test(`${p.name} ${p.client} ${p.type}`.toLowerCase()))?.tasks ?? WEB_TASKS

export const buildTasks = (projects: Project[], team: TeamMember[]): Task[] => {
  const people = team.length ? team : buildTeam()
  const tasks: Task[] = []
  projects.forEach((p, pi) => {
    const pool = taskPoolFor(p)
    const closed = p.status === 'Completed' || p.status === 'Backed Off'
    const count = 5 + (pi % 2)
    const doneSoFar = closed ? count : Math.round((p.progress / 100) * count)
    for (let k = 0; k < count; k++) {
      const [title, est] = pool[(pi + k) % pool.length]
      const status: Task['status'] =
        closed || k < doneSoFar ? 'Completed'
        : k === doneSoFar ? 'In Progress'
        : k === count - 1 && pi % 6 === 0 ? 'Blocked'
        : 'To Do'
      const assignee = people[(pi + k) % people.length].name
      const comments =
        status === 'Blocked'
          ? [{ id: uid(), text: 'Waiting on client approval before this can move.', author: assignee, createdAt: isoAt(-3), updatedAt: isoAt(-3), isSystem: false }]
          : status === 'Completed' && k === 0
            ? [{ id: uid(), text: 'Reviewed and signed off with the PM.', author: assignee, createdAt: isoAt(-5), updatedAt: isoAt(-5), isSystem: false }]
            : []
      tasks.push({
        id: uid(), title, projectId: p.id, assignee, status,
        priority: (['High', 'Medium', 'Medium', 'Low', 'High', 'Medium'] as const)[k % 6],
        start: dayKey(-18 + k * 3),
        due: dayKey(-6 + pi + k * 4),
        nextFollowUp: status === 'Blocked' ? dayKey(1) : '',
        estimatedHours: est,
        actualHours: status === 'Completed' ? Math.round(est * 0.9) : status === 'In Progress' ? Math.round(est * 0.4) : 0,
        description: `${title} — ${p.name}`,
        acceptanceCriteria: '', labels: [], taskComments: comments, dependencies: [],
        activity: [{ id: uid(), type: 'create' as const, message: 'Task created', author: 'System', createdAt: isoAt(-18) }],
        demoSeed: true,
      })
    }
  })
  return tasks
}

/* ------------------------------- client contacts ---------------------------- */

const FIRST = ['James', 'Sarah', 'David', 'Priya', 'Michael', 'Emma', 'Raj', 'Laura', 'Tom', 'Aisha']
const LAST = ['Walker', 'Patel', 'Turner', 'Sharma', 'Brooks', 'Hayes', 'Khan', 'Mills', 'Reid', 'Fox']

export const fillClientContacts = (clients: Client[]): Client[] =>
  clients.map((c) => {
    if (c.contact && c.email && c.phone) return c
    const h = hash(c.name)
    const first = FIRST[h % FIRST.length]
    const slug = (c.company || c.name).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'client'
    const digits = String(700000000 + (h % 99999999))
    return {
      ...c,
      contact: c.contact || `${first} ${LAST[(h >> 4) % LAST.length]}`,
      email: c.email || `${first.toLowerCase()}@${slug}.co.uk`,
      phone: c.phone || `+44 ${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`,
      website: c.website || `www.${slug}.co.uk`,
    }
  })

/* ------------------------------- status updates ------------------------------ */

export const buildUpdates = (projects: Project[], existing: StatusUpdate[]): StatusUpdate[] => {
  const covered = new Set(existing.map((u) => u.projectId))
  const updates: StatusUpdate[] = []
  projects.forEach((p) => {
    if (covered.has(p.id)) return
    const author = p.manager || 'Sandeep Rana'
    if (p.status === 'Planning') {
      updates.push({
        id: uid(), projectId: p.id, author, createdAt: isoAt(-6),
        status: 'Planning', progress: 0,
        workCompleted: 'Initial scoping and requirements gathering kicked off.',
        currentWork: 'Drafting the statement of work and confirming deliverables with the client.',
        pendingWork: 'SOW sign-off, resource allocation, kickoff scheduling.',
        blockers: '', blockerSeverity: 'none',
        clientUpdate: 'Awaiting SOW approval from the client.',
        risksDependencies: 'Start date depends on signed SOW.',
        nextSteps: 'Send final SOW and book kickoff call.',
        expectedCompletion: '', internalRemarks: '', source: 'imported-comment', demoSeed: true,
      })
      return
    }
    if (p.status === 'Completed' || p.status === 'Backed Off') {
      updates.push({
        id: uid(), projectId: p.id, author, createdAt: isoAt(-9),
        status: 'In Progress', progress: Math.max(10, p.progress - 40),
        workCompleted: 'Core build and internal QA finished.',
        currentWork: 'Final polish and pre-launch checklist.',
        pendingWork: 'Client UAT and go-live.', blockers: '', blockerSeverity: 'none',
        clientUpdate: 'Shared preview link for final review.',
        risksDependencies: '', nextSteps: 'Collect UAT feedback.',
        expectedCompletion: '', internalRemarks: '', source: 'imported-comment', demoSeed: true,
      })
      updates.push({
        id: uid(), projectId: p.id, author, createdAt: isoAt(-3),
        status: p.status, progress: p.progress,
        workCompleted: 'All deliverables completed and handed over.',
        currentWork: '', pendingWork: '', blockers: '', blockerSeverity: 'none',
        clientUpdate: 'Client confirmed sign-off.',
        risksDependencies: '', nextSteps: 'Close out and archive documentation.',
        expectedCompletion: '', internalRemarks: 'Project wrapped; invoicing tracked separately.', source: 'imported-comment', demoSeed: true,
      })
      return
    }
    // active projects — two-stage report history
    const late = p.status === 'At Risk' || (p.end && p.end < dayKey(0))
    updates.push({
      id: uid(), projectId: p.id, author, createdAt: isoAt(-10),
      status: 'In Progress', progress: Math.max(5, p.progress - 30),
      workCompleted: 'Discovery, wireframes and base build completed.',
      currentWork: 'Feature development and content integration underway.',
      pendingWork: 'Remaining feature work and QA pass.', blockers: '', blockerSeverity: 'none',
      clientUpdate: 'Client reviewed early designs — feedback incorporated.',
      risksDependencies: '', nextSteps: 'Complete development sprint and schedule QA.',
      expectedCompletion: '', internalRemarks: '', source: 'imported-comment', demoSeed: true,
    })
    updates.push({
      id: uid(), projectId: p.id, author, createdAt: isoAt(-2),
      status: p.status, progress: p.progress,
      workCompleted: 'Development completed; internal testing done.',
      currentWork: late ? 'Chasing client-side confirmations to unblock delivery.' : 'Final QA and pre-launch checks.',
      pendingWork: late ? 'Client UAT and content approval.' : 'Deployment checklist and handover docs.',
      blockers: late ? 'Waiting on client UAT sign-off — delivery date at risk.' : '', blockerSeverity: late ? 'non-critical' : 'none',
      clientUpdate: late ? 'UAT pending on client side — follow-up sent.' : 'Weekly status shared with the client.',
      risksDependencies: late ? 'Completion depends on client-side UAT.' : '',
      nextSteps: late ? 'Follow up with client on UAT and reconfirm deadline.' : 'Deploy to staging for client review.',
      expectedCompletion: '', internalRemarks: '', source: 'imported-comment', demoSeed: true,
    })
  })
  return updates
}

/* ---------------------------------- meetings --------------------------------- */

export const buildMeetings = (projects: Project[], clients: Client[], team: TeamMember[]): Meeting[] => {
  const people = team.length ? team : buildTeam()
  const pm = people[0]?.name ?? 'Project Manager'
  const active = projects.filter((p) => p.status !== 'Completed' && p.status !== 'Backed Off')
  const at = (i: number) => active[i % Math.max(1, active.length)] ?? projects[i % Math.max(1, projects.length)]
  const clientName = (p?: Project) => clients.find((c) => c.name === p?.client)?.name ?? p?.client ?? 'Client'
  const specs: Partial<Meeting>[] = [
    { title: 'Weekly delivery sync', type: 'Internal meeting', date: dayKey(1), time: '10:00', participants: people.slice(0, 4).map((m) => m.name).join(', '), status: 'Scheduled', agenda: 'Progress on active projects, blockers, and next-week priorities.', provider: 'Google Meet' },
    { title: `Client UAT review — ${at(0)?.name ?? 'Project'}`, type: 'Client meeting', date: dayKey(2), time: '14:30', participants: `${clientName(at(0))}, ${pm}`, projectId: at(0)?.id, projectName: at(0)?.name, status: 'Scheduled', agenda: 'Walk through UAT findings and agree sign-off criteria.', provider: 'Google Meet' },
    { title: 'Sprint 5 planning', type: 'Sprint review', date: dayKey(3), time: '11:00', participants: people.slice(0, 5).map((m) => m.name).join(', '), status: 'Scheduled', agenda: 'Scope the sprint backlog and confirm capacity.', provider: 'Google Meet' },
    { title: `Discovery call — ${clientName(at(1))}`, type: 'Discovery call', date: dayKey(-3), time: '15:00', participants: `${clientName(at(1))}, ${pm}`, projectId: at(1)?.id, projectName: at(1)?.name, status: 'Completed', discussion: 'Reviewed business goals, target audience and competitor references.', decisions: 'Proceed to SOW with phased delivery approach.', actionItems: 'Send proposal deck and draft timeline.', provider: 'Google Meet' },
    { title: `Design review — ${at(2)?.name ?? 'Project'}`, type: 'Project review', date: dayKey(4), time: '12:00', participants: `${people[3]?.name ?? pm}, ${pm}`, projectId: at(2)?.id, projectName: at(2)?.name, status: 'Scheduled', agenda: 'Review homepage and inner-page designs before client share.', provider: 'Google Meet' },
    { title: 'Sprint 4 retrospective', type: 'Internal meeting', date: dayKey(-2), time: '16:00', participants: people.map((m) => m.name).join(', '), status: 'Completed', discussion: 'Reviewed sprint velocity, delivery RAG and blocked items.', decisions: 'Improve estimate accuracy and tighten client follow-up cadence.', actionItems: 'Log unresolved blockers into next sprint.', provider: 'Google Meet' },
    { title: `Kickoff — ${at(3)?.name ?? 'Project'}`, type: 'Client meeting', date: dayKey(-7), time: '10:30', participants: `${clientName(at(3))}, ${pm}`, projectId: at(3)?.id, projectName: at(3)?.name, status: 'Completed', discussion: 'Confirmed scope, milestones and communication cadence.', decisions: 'Weekly Friday status updates agreed.', actionItems: 'Share access checklist with client.', provider: 'Google Meet' },
    { title: `Content handover — ${clientName(at(4))}`, type: 'Follow-up', date: dayKey(5), time: '13:00', participants: `${clientName(at(4))}, ${people[8]?.name ?? pm}`, projectId: at(4)?.id, projectName: at(4)?.name, status: 'Scheduled', agenda: 'Collect final copy, imagery and brand assets.', provider: 'Google Meet' },
  ]
  return specs.map((s) => ({
    id: uid(), title: s.title ?? 'Meeting', date: s.date ?? dayKey(0), time: s.time ?? '10:00',
    participants: s.participants ?? '', discussion: s.discussion ?? '', decisions: s.decisions ?? '',
    actionItems: s.actionItems ?? '', responsible: pm, deadline: s.date ?? dayKey(0),
    type: s.type, projectId: s.projectId, projectName: s.projectName, status: s.status,
    agenda: s.agenda, provider: s.provider, demoSeed: true,
  }))
}

/* ---------------------------------- documents -------------------------------- */

export const buildDocuments = (projects: Project[]): DocumentItem[] => {
  const act = projects.filter((p) => p.status !== 'Backed Off')
  const pick = (i: number) => act[i % Math.max(1, act.length)]
  const specs: [string, DocumentItem['status'], string, number][] = [
    ['Statement of Work', 'Shared', '420 KB', -20],
    ['Design specification', 'In review', '1.8 MB', -9],
    ['UAT sign-off sheet', 'Draft', '96 KB', -2],
    ['Sprint 4 report', 'Shared', '1.1 MB', -4],
    ['SEO content plan', 'In review', '310 KB', -6],
    ['Hosting & DNS details', 'Shared', '84 KB', -15],
    ['Brand assets package', 'Shared', '6.4 MB', -11],
    ['Invoice schedule', 'Draft', '120 KB', -1],
    ['Technical handover notes', 'In review', '250 KB', -3],
    ['Client feedback log', 'Shared', '140 KB', -5],
  ]
  return specs.map(([kind, status, size, offset], i) => {
    const p = pick(i)
    return { id: uid(), name: `${kind} — ${p?.name ?? 'Portfolio'}`, projectId: p?.id ?? '', updated: dayKey(offset), status, size, demoSeed: true }
  })
}

/* ------------------------------------ raid ----------------------------------- */

export const buildRisks = (projects: Project[], team: TeamMember[]): ReturnType<typeof normalizeRisk>[] => {
  const people = team.length ? team : buildTeam()
  const owner = (i: number) => projects[i]?.manager || people[(i + 1) % people.length]?.name || ''
  const at = (i: number) => projects[i % Math.max(1, projects.length)]
  const specs: [string, string, 'Risk' | 'Assumption' | 'Issue' | 'Dependency', 'Low' | 'Medium' | 'High' | 'Urgent', number][] = [
    ['Awaiting client UAT approval', 'Delivery depends on the client completing UAT sign-off.', 'Dependency', 'High', 0],
    ['Payment gateway integration failing', 'Sandbox transactions intermittently fail — root cause under investigation.', 'Issue', 'Urgent', 1],
    ['Client approval may take another week', 'Decision-maker availability is limited until month end.', 'Risk', 'Medium', 2],
    ['Third-party API rate limits', 'Search API quota may throttle peak traffic at launch.', 'Risk', 'Medium', 3],
    ['Client provides final content before UAT', 'Schedule assumes all copy and imagery arrive on time.', 'Assumption', 'Medium', 4],
    ['Marketing team to supply SEO assets', 'Meta assets and keyword map are external deliverables.', 'Dependency', 'Low', 5],
    ['Staging environment instability', 'Deployments to staging failed twice this week.', 'Issue', 'High', 6],
    ['Scope creep on revision rounds', 'Client requesting changes beyond agreed revision limits.', 'Risk', 'Medium', 7],
  ]
  return specs.map(([title, description, category, priority, pi]) =>
    normalizeRisk({
      ...emptyRaid(at(pi)?.id ?? '', owner(pi)),
      id: uid(), category, title, description, priority,
      targetDate: dayKey(7 + pi), status: 'Open',
      reporter: 'System', sourceReference: 'Demo seed',
      dependencyType: category === 'Dependency' ? 'External' : undefined,
      demoSeed: true,
    }),
  )
}

/* ----------------------------------- ensure ---------------------------------- */

export function ensureDemoData(data: AppData): AppData {
  const stale = data.demoSeedVersion !== DEMO_SEED_VERSION
  const team = data.team.length ? data.team : buildTeam()
  const keep = <T extends { demoSeed?: boolean }>(items: T[]) => items.filter((i) => !i.demoSeed)
  const nonDemoUpdates = data.statusUpdates.filter((u) => !u.demoSeed)
  return {
    ...data,
    demoSeedVersion: DEMO_SEED_VERSION,
    team,
    clients: fillClientContacts(data.clients),
    tasks: stale ? [...keep(data.tasks), ...buildTasks(data.projects, team)] : data.tasks.length ? data.tasks : buildTasks(data.projects, team),
    meetings: stale ? [...keep(data.meetings), ...buildMeetings(data.projects, data.clients, team)] : data.meetings.length ? data.meetings : buildMeetings(data.projects, data.clients, team),
    documents: stale ? [...keep(data.documents), ...buildDocuments(data.projects)] : data.documents.length ? data.documents : buildDocuments(data.projects),
    risks: stale ? [...keep(data.risks), ...buildRisks(data.projects, team)] : data.risks.length ? data.risks : buildRisks(data.projects, team),
    statusUpdates: stale ? [...nonDemoUpdates, ...buildUpdates(data.projects, nonDemoUpdates)] : data.statusUpdates,
    // stamp last-reported on projects that still show none
    projects: stale
      ? data.projects.map((p) => (p.lastReportAt ? p : { ...p, lastReportAt: isoAt(-2), lastReportBy: p.manager || 'Sandeep Rana' }))
      : data.projects,
  }
}
