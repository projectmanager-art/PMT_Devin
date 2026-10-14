import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp, type TeamMember } from '../store'
import { Badge, Button, Card, CardTitle, EmptyState, Field, FormErrorSummary, Modal, ProgressBar, TextButton, inputClass, invalidInputClass, Avatar, avatarUrl } from '../components/ui'

function TeamModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: TeamMember | null }) {
  const { addTeamMember, updateTeamMember, projects } = useApp()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    name: editing?.name ?? '',
    role: editing?.role ?? '',
    skills: editing?.skills ?? '',
    capacity: editing?.capacity ?? 40,
    utilized: editing?.utilized ?? 0,
    projects: editing?.projects ?? [],
    gender: editing?.gender ?? 'male' as const,
  })

  const submit = () => {
    const nextErrors: Record<string, string> = {}
    if (!form.name.trim()) nextErrors.name = 'Team member name is required.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const payload = { ...form, capacity: Number(form.capacity), utilized: Number(form.utilized) }
    if (editing) updateTeamMember(editing.id, payload)
    else addTeamMember(payload)
    onClose()
  }

  return (
    <Modal
      open={open}
      title={editing ? 'Edit team member' : 'Add team member'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{editing ? 'Save member' : 'Add member'}</Button>
        </>
      }
    >
      <FormErrorSummary errors={errors} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Name" required error={errors.name}><input className={errors.name ? invalidInputClass : inputClass} aria-invalid={!!errors.name} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors((current) => ({ ...current, name: '' })) }} /></Field>
        <Field label="Role"><input className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Designer, Engineer..." /></Field>
        <Field label="Gender" className="md:col-span-2">
          <select
            className={inputClass}
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value as 'male' | 'female' })}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <Field label="Skills" className="md:col-span-2"><input className={inputClass} value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="UX, Frontend, QA" /></Field>
        <Field label="Capacity (hours/week)"><input type="number" min={0} className={inputClass} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></Field>
        <Field label="Utilized hours"><input type="number" min={0} className={inputClass} value={form.utilized} onChange={(e) => setForm({ ...form, utilized: Number(e.target.value) })} /></Field>
        <Field label="Assigned projects" className="md:col-span-2">
          <select
            multiple
            className={`${inputClass} h-24`}
            value={form.projects}
            onChange={(e) => setForm({ ...form, projects: Array.from(e.target.selectedOptions).map((o) => o.value) })}
          >
            {projects.map((p) => <option key={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  )
}

export function Team() {
  const { team, tasks, deleteTeamMember } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TeamMember | null>(null)

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#929692]">People & data</p>
          <h1 className="font-heading text-[28px] font-semibold tracking-tight text-ink">Team workload</h1>
          <p className="mt-2 text-[13px] text-muted">Keep capacity balanced and spot bottlenecks early.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true) }}>
          <span className="flex items-center gap-1.5"><Plus size={14} /> Add member</span>
        </Button>
      </div>

      <Card>
        <CardTitle title="Capacity overview" subtitle={`Weekly hours · ${team.length} team members`} />
        {team.length === 0 ? (
          <EmptyState title="No team members" description="Add team members to track workload." />
        ) : (
          <div className="space-y-1">
            {team.map((member) => {
              const utilization = Math.round((member.utilized / member.capacity) * 100)
              const openTasks = tasks.filter((t) => t.assignee === member.name && t.status !== 'Completed').length
              return (
                <div key={member.id} className="flex items-center gap-3 border-b border-[#f0f0ed] py-3 last:border-0 sm:gap-4">
                  <Avatar
                    name={member.name}
                    src={avatarUrl(member.name, member.gender)}
                    className="h-8 w-8 shrink-0 bg-ink text-white"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-ink">{member.name}</p>
                    <p className="truncate text-[10px] text-muted">{member.role} · {member.skills}</p>
                  </div>
                  <div className="hidden w-40 md:block">
                    <p className="mb-1 text-[10px] text-muted">{openTasks} open task{openTasks !== 1 ? 's' : ''}</p>
                    <p className="text-[10px] text-muted">{member.projects.length} project{member.projects.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="w-[70px] shrink-0 text-right sm:w-32">
                    <p className="whitespace-nowrap text-[11px] font-semibold text-ink">{member.utilized} / {member.capacity}h</p>
                    <p className="text-[10px] text-muted">{utilization}% utilized</p>
                  </div>
                  <div className="hidden w-20 sm:block md:w-28">
                    <ProgressBar value={utilization} className="h-[5px]" />
                  </div>
                  <div className="hidden w-24 md:block">
                    <Badge tone={utilization > 85 ? 'red' : utilization > 70 ? 'amber' : 'green'}>{utilization > 85 ? 'Overloaded' : utilization > 70 ? 'Busy' : 'Balanced'}</Badge>
                  </div>
                  <div className="flex w-auto shrink-0 items-center justify-end gap-2 whitespace-nowrap sm:w-24">
                    <TextButton onClick={() => { setEditing(member); setModalOpen(true) }}>Edit</TextButton>
                    <TextButton
                      className="text-red"
                      onClick={() => {
                        if (window.confirm(`Remove ${member.name} from the team?`)) deleteTeamMember(member.id)
                      }}
                    >
                      Remove
                    </TextButton>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <TeamModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} />
    </div>
  )
}
