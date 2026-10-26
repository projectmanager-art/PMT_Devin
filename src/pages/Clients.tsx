import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useApp, type Client } from '../store'
import { Button, Card, EmptyState, Field, FormErrorSummary, Modal, TextButton, inputClass, invalidInputClass, Avatar, avatarUrl } from '../components/ui'

function ClientModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Client | null }) {
  const { addClient, updateClient } = useApp()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    name: editing?.name ?? '',
    company: editing?.company ?? '',
    contact: editing?.contact ?? '',
    email: editing?.email ?? '',
    phone: editing?.phone ?? '',
    website: editing?.website ?? '',
    notes: editing?.notes ?? '',
    requirements: editing?.requirements ?? '',
    pendingApprovals: editing?.pendingApprovals ?? '',
    gender: editing?.gender ?? 'male' as const,
  })

  const submit = () => {
    const nextErrors: Record<string, string> = {}
    if (!form.name.trim()) nextErrors.name = 'Client name is required.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    if (editing) updateClient(editing.id, form)
    else addClient(form)
    onClose()
  }

  return (
    <Modal
      open={open}
      title={editing ? 'Edit client' : 'Add client'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{editing ? 'Save client' : 'Add client'}</Button>
        </>
      }
    >
      <FormErrorSummary errors={errors} />
      <div className="form-stagger grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Client name" required error={errors.name}><input className={errors.name ? invalidInputClass : inputClass} aria-invalid={!!errors.name} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors((e) => ({ ...e, name: '' })) }} /></Field>
        <Field label="Company"><input className={inputClass} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
        <Field label="Main contact"><input className={inputClass} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
        <Field label="Gender">
          <select
            className={inputClass}
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value as 'male' | 'female' })}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <Field label="Email" error={errors.email}><input className={errors.email ? invalidInputClass : inputClass} aria-invalid={!!errors.email} value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors((e) => ({ ...e, email: '' })) }} /></Field>
        <Field label="Phone"><input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Website"><input className={inputClass} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
        <Field label="Requirements" className="md:col-span-2"><textarea className={inputClass} rows={2} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} /></Field>
        <Field label="Pending approvals" className="md:col-span-2"><input className={inputClass} value={form.pendingApprovals} onChange={(e) => setForm({ ...form, pendingApprovals: e.target.value })} /></Field>
        <Field label="Notes" className="md:col-span-2"><textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

export function Clients() {
  const { clients, projects, deleteClient } = useApp()
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)

  const filtered = clients.filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.company.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#929692]">People & data</p>
          <h1 className="font-heading text-[28px] font-semibold tracking-tight text-ink">Clients</h1>
          <p className="mt-2 text-[13px] text-muted">Relationships, context and commitments in one place.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true) }}>
          <span className="flex items-center gap-1.5"><Plus size={14} /> Add client</span>
        </Button>
      </div>

      <div className="mb-5 flex h-[36px] w-full items-center gap-2 rounded-lg border border-line bg-white px-3 text-muted sm:w-[245px]">
        <Search size={14} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients..." className="w-full bg-transparent text-[11px] text-ink outline-none placeholder:text-[#aaa]" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No clients found" description="Add a client to start managing their projects." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => {
            const clientProjects = projects.filter((p) => p.client === client.name)
            return (
              <Card key={client.id}>
                <div className="flex items-center gap-3">
                  <Avatar
                    name={client.contact}
                    src={avatarUrl(client.contact, client.gender)}
                    className="h-8 w-8 rounded-lg bg-[#d4d7d2] text-[10px] font-bold text-ink"
                  />
                  <div>
                    <p className="font-heading text-[14px] font-semibold text-ink">{client.name}</p>
                    <p className="text-[10px] text-muted">{client.company}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-[11px] text-muted">
                  <p><b className="text-ink">Contact:</b> {client.contact}</p>
                  <p><b className="text-ink">Email:</b> {client.email}</p>
                  <p><b className="text-ink">Phone:</b> {client.phone}</p>
                  <p><b className="text-ink">Projects:</b> {clientProjects.length}</p>
                </div>
                {client.pendingApprovals && client.pendingApprovals !== 'None' && (
                  <p className="mt-3 rounded-lg bg-[#fff3df] px-3 py-2 text-[10px] text-amber">Pending: {client.pendingApprovals}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <TextButton onClick={() => { setEditing(client); setModalOpen(true) }}>Edit</TextButton>
                  <TextButton
                    className="text-red"
                    onClick={() => {
                      if (window.confirm(`Delete client "${client.name}"?`)) deleteClient(client.id)
                    }}
                  >
                    Delete
                  </TextButton>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {modalOpen && <ClientModal open editing={editing} onClose={() => { setModalOpen(false); setEditing(null) }} />}
    </div>
  )
}
