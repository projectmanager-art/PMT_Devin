/**
 * Demo-data seeder — fills ONLY empty collections with realistic records
 * derived from the existing projects/clients/team, so every module
 * (Workstream, Timeline, Calendar, Meetings, Documents, RAID) has linked,
 * testable data. Existing records are never touched.
 *
 * Pure functions — exercised by tests/demo-seed.test.cjs.
 */

import type { AppData, Client, DocumentItem, Meeting, Project, Task, TeamMember } from '../store'
import { emptyRaid, normalizeRisk } from './raid'

const uid = () => Math.random().toString(36).slice(2, 9)
const dayKey = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const isoAt = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString()

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

/* ----------------------------------- tasks ---------------------------------- */

const TASK_POOL: { title: string; est: number }[] = [
  { title: 'Discovery & requirements', est: 6 },
  { title: 'Wireframes & UI design', est: 12 },
  { title: 'Frontend development', est: 20 },
  { title: 'Backend / API integration', est: 16 },
  { title: 'Content & SEO setup', est: 8 },
  { title: 'QA & cross-browser testing', est: 10 },
  { title: 'Client review / UAT', est: 6 },
  { title: 'Deployment & handover', est: 4 },
]

export const buildTasks = (projects: Project[], team: TeamMember[]): Task[] => {
  const people = team.length ? team : buildTeam()
  const tasks: Task[] = []
  projects.forEach((p, pi) => {
    const done = p.status === 'Completed' || p.status === 'Backed Off'
    // 4-5 tasks per project, sliced deterministically from the pool
    const count = 4 + (pi % 2)
    const start = (pi * 2) % TASK_POOL.length
    for (let k = 0; k < count; k++) {
      const t = TASK_POOL[(start + k) % TASK_POOL.length]
      const doneSoFar = done ? count : Math.round((p.progress / 100) * count)
      const status: Task['status'] =
        done || k < doneSoFar ? 'Completed'
        : k === doneSoFar ? 'In Progress'
        : k === count - 1 && pi % 6 === 0 ? 'Blocked'
        : 'To Do'
      tasks.push({
        id: uid(),
        title: t.title,
        projectId: p.id,
        assignee: people[(pi + k) % people.length].name,
        status,
        priority: (['Medium', 'High', 'Medium', 'Low', 'High'] as const)[k % 5],
        start: dayKey(-14 + k * 3),
        due: dayKey(-7 + pi + k * 4),
        nextFollowUp: status === 'Blocked' ? dayKey(1) : '',
        estimatedHours: t.est,
        actualHours: status === 'Completed' ? Math.round(t.est * 0.9) : status === 'In Progress' ? Math.round(t.est * 0.4) : 0,
        description: `${t.title} for ${p.name}`,
        acceptanceCriteria: '',
        labels: [],
        taskComments: [],
        dependencies: [],
        activity: [{ id: uid(), type: 'create' as const, message: 'Task created', author: 'System', createdAt: isoAt(-14) }],
      })
    }
  })
  return tasks
}

/* ---------------------------------- meetings --------------------------------- */

export const buildMeetings = (projects: Project[], clients: Client[], team: TeamMember[]): Meeting[] => {
  const people = team.length ? team : buildTeam()
  const pm = people[0]?.name ?? 'Project Manager'
  const active = projects.filter((p) => p.status !== 'Completed' && p.status !== 'Backed Off')
  const at = (i: number) => active[i % Math.max(1, active.length)] ?? projects[i % Math.max(1, projects.length)]
  const clientName = (p?: Project) => clients.find((c) => c.name === p?.client)?.name ?? p?.client ?? 'Client'
  const specs: Partial<Meeting>[] = [
    { title: 'Weekly delivery sync', type: 'Internal meeting', date: dayKey(1), time: '10:00', participants: people.slice(0, 4).map((m) => m.name).join(', '), status: 'Scheduled' },
    { title: `Client UAT review — ${at(0)?.name ?? 'Project'}`, type: 'Client meeting', date: dayKey(2), time: '14:30', participants: `${clientName(at(0))}, ${pm}`, projectId: at(0)?.id, projectName: at(0)?.name, status: 'Scheduled' },
    { title: 'Sprint 5 planning', type: 'Sprint review', date: dayKey(3), time: '11:00', participants: people.slice(0, 5).map((m) => m.name).join(', '), status: 'Scheduled' },
    { title: `Discovery call — ${clientName(at(1))}`, type: 'Discovery call', date: dayKey(-3), time: '15:00', participants: `${clientName(at(1))}, ${pm}`, projectId: at(1)?.id, projectName: at(1)?.name, status: 'Completed' },
    { title: `Design review — ${at(2)?.name ?? 'Project'}`, type: 'Project review', date: dayKey(4), time: '12:00', participants: `${people[3]?.name ?? pm}, ${pm}`, projectId: at(2)?.id, projectName: at(2)?.name, status: 'Scheduled' },
    { title: 'Sprint 4 retrospective', type: 'Internal meeting', date: dayKey(-2), time: '16:00', participants: people.map((m) => m.name).join(', '), status: 'Completed' },
    { title: `Kickoff — ${at(3)?.name ?? 'Project'}`, type: 'Client meeting', date: dayKey(-7), time: '10:30', participants: `${clientName(at(3))}, ${pm}`, projectId: at(3)?.id, projectName: at(3)?.name, status: 'Completed' },
  ]
  return specs.map((s) => ({
    id: uid(), title: s.title ?? 'Meeting', date: s.date ?? dayKey(0), time: s.time ?? '10:00',
    participants: s.participants ?? '', discussion: '', decisions: '', actionItems: '',
    responsible: pm, deadline: s.date ?? dayKey(0), type: s.type, projectId: s.projectId,
    projectName: s.projectName, status: s.status,
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
  ]
  return specs.map(([kind, status, size, offset], i) => {
    const p = pick(i)
    return { id: uid(), name: `${kind} — ${p?.name ?? 'Portfolio'}`, projectId: p?.id ?? '', updated: dayKey(offset), status, size }
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
  ]
  return specs.map(([title, description, category, priority, pi]) =>
    normalizeRisk({
      ...emptyRaid(at(pi)?.id ?? '', owner(pi)),
      id: uid(),
      category, title, description, priority,
      targetDate: dayKey(7 + pi), status: 'Open',
      reporter: 'System', sourceReference: 'Demo seed',
      dependencyType: category === 'Dependency' ? 'External' : undefined,
    }),
  )
}

/* ----------------------------------- ensure ---------------------------------- */

export function ensureDemoData(data: AppData): AppData {
  const team = data.team.length ? data.team : buildTeam()
  return {
    ...data,
    team,
    tasks: data.tasks.length ? data.tasks : buildTasks(data.projects, team),
    meetings: data.meetings.length ? data.meetings : buildMeetings(data.projects, data.clients, team),
    documents: data.documents.length ? data.documents : buildDocuments(data.projects),
    risks: data.risks.length ? data.risks : buildRisks(data.projects, team),
  }
}
