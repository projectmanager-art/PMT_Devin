import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Avatar, Button, Field, FormErrorSummary, Modal, avatarUrl, inputClass, invalidInputClass } from '../components/ui'
import {
  BarChart3,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronsUpDown,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Settings,
  TriangleAlert,
  UserRound,
  Users,
  Video,
  CalendarClock,
  Gauge,
} from 'lucide-react'

const mainLinks = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, liquid: true, color: 'text-[#2b6cb0]' },
  { to: '/projects', label: 'Projects', icon: FolderKanban, color: 'text-[#3b8b67]' },
  { to: '/tasks', label: 'Workstream', icon: CheckSquare, color: 'text-[#b87b2c]' },
  { to: '/timeline', label: 'Timeline', icon: CalendarClock, color: 'text-[#7955a9]' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, color: 'text-[#c25555]' },
]

const peopleLinks = [
  { to: '/clients', label: 'Clients', icon: Users, color: 'text-[#0f766e]' },
  { to: '/team', label: 'Team', icon: UserRound, color: 'text-[#2b6cb0]' },
  { to: '/reports', label: 'Reports', icon: BarChart3, color: 'text-[#3b8b67]' },
]

const operationsLinks = [
  { to: '/risks', label: 'RAID Intelligence', icon: TriangleAlert, color: 'text-[#c25555]' },
  { to: '/sprintiq', label: 'SprintIQ', icon: Gauge, color: 'text-[#e63946]' },
  { to: '/meetings', label: 'Meetings', icon: Video, color: 'text-[#7955a9]' },
  { to: '/documents', label: 'Documents', icon: FileText, color: 'text-[#b87b2c]' },
]

function NavGroup({ label, links }: { label: string; links: typeof mainLinks }) {
  return (
    <div className="mb-5">
      <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[1.2px] text-[#a1a3a1]">{label}</p>
      <nav className="space-y-0.5">
        {links.map(({ to, label, icon: Icon, liquid, color }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'group flex h-[38px] items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-all duration-150',
                isActive ? 'bg-[#e8e9e5] font-semibold text-ink' : 'text-[#686c6d] hover:translate-x-[2px] hover:bg-[#eeeeeb] hover:text-ink',
              )
            }
          >
            <span className="relative grid h-[17px] w-[17px] place-items-center">
              <Icon size={17} strokeWidth={2} className={clsx('transition-all duration-200 group-hover:scale-110 group-hover:-translate-y-0.5', color)} />
              {liquid && <span className="overview-liquid" aria-hidden="true" />}
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [showWorkspace, setShowWorkspace] = useState(false)
  const [workspaces, setWorkspaces] = useState([
    { id: 'w1', name: 'NexTask', role: 'Admin' },
  ])
  const [currentWorkspace, setCurrentWorkspace] = useState('w1')
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false)
  const [newWorkspace, setNewWorkspace] = useState('')
  const [workspaceError, setWorkspaceError] = useState('')
  const workspaceRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (workspaceRef.current && !workspaceRef.current.contains(e.target as Node)) {
        setShowWorkspace(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const addWorkspace = () => {
    const name = newWorkspace.trim()
    if (!name) {
      setWorkspaceError('Workspace name is required.')
      return
    }
    setWorkspaceError('')
    const id = `w-${Date.now()}`
    setWorkspaces((items) => [...items, { id, name, role: 'Admin' }])
    setCurrentWorkspace(id)
    setNewWorkspace('')
    setWorkspaceModalOpen(false)
  }

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 z-30 flex h-full w-[245px] flex-col border-r border-line bg-[#fafaf8] px-4 pb-4 pt-6 transition-transform duration-300 ease-in-out lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className="mb-6 flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-black">
            <img src="/nexora-mark.png" alt="NEXORA" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="font-heading text-[17px] font-bold leading-none tracking-tight text-ink">NEXORA</p>
            <p className="mt-1 text-[8px] leading-tight text-[#8d918e]">Project Management, Simplified.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-[#eeeeeb] hover:text-ink lg:hidden"
          aria-label="Close sidebar"
        >
          ×
        </button>
      </div>

      <div className="relative mb-6" ref={workspaceRef}>
        <button
          type="button"
          onClick={() => setShowWorkspace((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-[10px] border border-[#e7e7e3] bg-[#f0f0ed] px-2.5 py-2.5 text-left transition hover:border-[#dcdcd7]"
          aria-expanded={showWorkspace}
          aria-haspopup="listbox"
        >
          <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-lg bg-[#d4d7d2]">
            <img src="/briefcase.svg" alt="NexTask" className="h-full w-full object-cover" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-ink">
              {workspaces.find((w) => w.id === currentWorkspace)?.name ?? 'Acme Collective'}
            </span>
            <span className="block text-[10px] text-muted">Workspace</span>
          </span>
          <ChevronsUpDown size={14} className="text-[#9a9a97]" />
        </button>

        {showWorkspace && (
          <div className="dropdown-enter absolute left-0 right-0 top-[calc(100%+4px)] z-40 rounded-xl border border-line bg-white p-1.5 shadow-lift">
            <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Workspace</p>
            {workspaces.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  setCurrentWorkspace(w.id)
                  setShowWorkspace(false)
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[12px] transition hover:bg-[#f4f4f1]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{w.name}</span>
                  <span className="block text-[10px] text-muted">{w.role}</span>
                </span>
                {w.id === currentWorkspace && <Check size={14} className="text-green" />}
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <button
              type="button"
              onClick={() => {
                setWorkspaceModalOpen(true)
                setShowWorkspace(false)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-ink transition hover:bg-[#f4f4f1]"
            >
              <Plus size={14} className="text-muted" />
              Add workspace
            </button>
            <button
              type="button"
              onClick={() => {
                navigate('/team')
                setShowWorkspace(false)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-ink transition hover:bg-[#f4f4f1]"
            >
              <Users size={14} className="text-muted" />
              Manage access
            </button>
            <button
              type="button"
              onClick={() => {
                navigate('/settings')
                setShowWorkspace(false)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-ink transition hover:bg-[#f4f4f1]"
            >
              <Settings size={14} className="text-muted" />
              Workspace settings
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <NavGroup label="Main" links={mainLinks} />
        <NavGroup label="People & data" links={peopleLinks} />
        <NavGroup label="Operations" links={operationsLinks} />
      </div>

      <div className="mt-auto space-y-1 border-t border-line pt-4">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(
              'group flex h-[38px] items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-all',
              isActive ? 'bg-[#e8e9e5] font-semibold text-ink' : 'text-[#686c6d] hover:bg-[#eeeeeb] hover:text-ink',
            )
          }
        >
          <Settings size={17} className="text-[#2b6cb0] transition-all duration-200 group-hover:scale-110 group-hover:-translate-y-0.5" />
          Settings
        </NavLink>

        <div className="mt-4 flex items-center gap-2.5 px-1">
          <Avatar
            name="Sandeep Rana"
            src={avatarUrl('Sandeep Rana', 'male')}
            className="h-7 w-7 bg-ink text-white"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-semibold text-ink">Sandeep Rana</span>
            <span className="block text-[10px] text-muted">Project Manager</span>
          </span>
        </div>
      </div>

      <Modal
        open={workspaceModalOpen}
        title="Add workspace"
        onClose={() => setWorkspaceModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setWorkspaceModalOpen(false)}>Cancel</Button>
            <Button onClick={addWorkspace}>Create workspace</Button>
          </>
        }
      >
        <FormErrorSummary errors={{ workspace: workspaceError }} />
        <Field label="Workspace name" required error={workspaceError}>
          <input
            className={workspaceError ? invalidInputClass : inputClass}
            aria-invalid={!!workspaceError}
            value={newWorkspace}
            onChange={(e) => { setNewWorkspace(e.target.value); setWorkspaceError('') }}
            placeholder="e.g. Nexus Studio"
            onKeyDown={(e) => {
              if (e.key === 'Enter') addWorkspace()
            }}
          />
        </Field>
      </Modal>
    </aside>
  )
}
