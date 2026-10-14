import { useMemo, useState } from 'react'
import { Download, FileText, Plus, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp, type DocumentItem } from '../store'
import { deleteDocumentFile, downloadDocumentFile, storeDocumentFile } from '../lib/documentFiles'
import { Badge, Button, Card, CardTitle, EmptyState, Field, FormErrorSummary, Modal, TextButton, inputClass, invalidInputClass } from '../components/ui'

const uid = () => Math.random().toString(36).slice(2, 10)

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentModal({
  open,
  onClose,
  editing,
  defaultProjectId,
}: {
  open: boolean
  onClose: () => void
  editing?: DocumentItem | null
  defaultProjectId?: string
}) {
  const { addDocument, updateDocument, projects } = useApp()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    name: editing?.name ?? '',
    description: editing?.description ?? '',
    projectId: editing?.projectId ?? defaultProjectId ?? projects[0]?.id ?? '',
    updated: editing?.updated ?? new Date().toISOString().slice(0, 10),
    status: editing?.status ?? ('Draft' as DocumentItem['status']),
  })

  const submit = async () => {
    if (saving) return
    const nextErrors: Record<string, string> = {}
    if (!form.name.trim()) nextErrors.name = 'Document name is required.'
    if (!form.projectId) nextErrors.projectId = 'Select a project.'
    if (!file && !editing?.fileId) nextErrors.file = 'Choose a file to attach to this document.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    try {
      const fileId = file ? uid() : editing?.fileId
      if (file && fileId) await storeDocumentFile(fileId, file)
      const metadata: Omit<DocumentItem, 'id'> = {
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        size: file ? formatSize(file.size) : editing?.size ?? '',
        fileId,
        fileName: file?.name ?? editing?.fileName,
        mimeType: file?.type || editing?.mimeType,
      }
      if (editing) updateDocument(editing.id, metadata)
      else addDocument(metadata)
      onClose()
    } catch (error) {
      setErrors({ storage: error instanceof Error ? error.message : 'Could not save this document. Try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={editing ? 'Edit project document' : 'Add project document'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving file…' : editing ? 'Save document' : 'Add document'}</Button>
        </>
      }
    >
      <FormErrorSummary errors={errors} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Document name" required error={errors.name} className="md:col-span-2">
          <input className={errors.name ? invalidInputClass : inputClass} aria-invalid={!!errors.name} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors((current) => ({ ...current, name: '' })) }} placeholder="Brief, guidelines, contract..." />
        </Field>
        <Field label="Project" required error={errors.projectId}>
          <select className={errors.projectId ? invalidInputClass : inputClass} aria-invalid={!!errors.projectId} value={form.projectId} onChange={(e) => { setForm({ ...form, projectId: e.target.value }); setErrors((current) => ({ ...current, projectId: '' })) }}>
            <option value="">Select a project</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as DocumentItem['status'] })}>
            {(['Draft', 'In review', 'Shared'] as DocumentItem['status'][]).map((status) => <option key={status}>{status}</option>)}
          </select>
        </Field>
        <Field label="File attachment" required error={errors.file} className="md:col-span-2">
          <div className={`rounded-lg border p-3 ${errors.file ? 'border-red bg-red/5' : 'border-line bg-[#fafaf8]'}`}>
            <input
              type="file"
              aria-invalid={!!errors.file}
              className="block w-full text-[11px] text-muted file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-[10px] file:font-semibold file:text-white hover:file:bg-[#36393a]"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null
                setFile(selected)
                setErrors((current) => ({ ...current, file: '' }))
                if (selected && !form.name.trim()) setForm((current) => ({ ...current, name: selected.name }))
              }}
            />
            <p className="mt-2 text-[10px] text-muted">{file ? `${file.name} · ${formatSize(file.size)}` : editing?.fileName ? `Attached: ${editing.fileName} · ${editing.size}` : 'Choose a file to keep it available from this browser on this device.'}</p>
          </div>
        </Field>
        <Field label="Description" className="md:col-span-2">
          <textarea rows={3} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this file for? Add context or version notes." />
        </Field>
        <Field label="Updated date">
          <input type="date" className={inputClass} value={form.updated} onChange={(e) => setForm({ ...form, updated: e.target.value })} />
        </Field>
        <p className="self-end pb-2 text-[10px] text-muted">Files are stored in this browser's IndexedDB; they are not uploaded to a shared server.</p>
      </div>
    </Modal>
  )
}

export function Documents() {
  const { documents, projects, deleteDocument } = useApp()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DocumentItem | null>(null)
  const [defaultProjectId, setDefaultProjectId] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const matchingDocuments = useMemo(() => {
    const search = query.trim().toLowerCase()
    return documents
      .filter((doc) => projectFilter === 'all' || doc.projectId === projectFilter)
      .filter((doc) => {
        const project = projects.find((item) => item.id === doc.projectId)
        return !search || doc.name.toLowerCase().includes(search) || doc.description?.toLowerCase().includes(search) || doc.fileName?.toLowerCase().includes(search) || project?.name.toLowerCase().includes(search)
      })
      .sort((a, b) => b.updated.localeCompare(a.updated))
  }, [documents, projects, projectFilter, query])

  const displayedProjects = projectFilter === 'all' ? projects : projects.filter((project) => project.id === projectFilter)
  const groups = displayedProjects.map((project) => ({ project, items: matchingDocuments.filter((doc) => doc.projectId === project.id) }))
  const unlinkedDocuments = matchingDocuments.filter((doc) => !projects.some((project) => project.id === doc.projectId))

  const openCreate = (projectId = '') => {
    setEditing(null)
    setDefaultProjectId(projectId)
    setModalOpen(true)
  }

  const download = async (doc: DocumentItem) => {
    if (!doc.fileId) return
    setError('')
    setBusyId(doc.id)
    try {
      await downloadDocumentFile(doc.fileId, doc.fileName || doc.name)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not open the attached file.')
    } finally {
      setBusyId('')
    }
  }

  const remove = async (doc: DocumentItem) => {
    if (!window.confirm(`Delete "${doc.name}" from the project?`)) return
    setError('')
    setBusyId(doc.id)
    try {
      if (doc.fileId) await deleteDocumentFile(doc.fileId)
      deleteDocument(doc.id)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this document.')
    } finally {
      setBusyId('')
    }
  }

  const renderDocument = (doc: DocumentItem) => (
    <div key={doc.id} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 transition hover:border-[#c9cbc5] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f0f1ed] text-muted"><FileText size={17} /></span>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-ink">{doc.name}</p>
          <p className="mt-1 text-[10px] text-muted">{doc.fileName ? `${doc.fileName} · ${doc.size}` : 'No file attached · metadata only'} · Updated {doc.updated}</p>
          {doc.description && <p className="mt-1 line-clamp-2 text-[10px] text-muted">{doc.description}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Badge tone={doc.status === 'Shared' ? 'green' : doc.status === 'In review' ? 'amber' : 'neutral'}>{doc.status}</Badge>
        {doc.fileId ? <TextButton disabled={busyId === doc.id} onClick={() => void download(doc)}><span className="inline-flex items-center gap-1"><Download size={12} />{busyId === doc.id ? 'Loading…' : 'Download'}</span></TextButton> : <TextButton onClick={() => { setEditing(doc); setDefaultProjectId(doc.projectId); setModalOpen(true) }}>Attach file</TextButton>}
        <TextButton onClick={() => { setEditing(doc); setDefaultProjectId(doc.projectId); setModalOpen(true) }}>Edit</TextButton>
        <TextButton className="text-red" disabled={busyId === doc.id} onClick={() => void remove(doc)}>Delete</TextButton>
      </div>
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#929692]">Operations</p>
        <h1 className="font-heading text-[28px] font-semibold tracking-tight text-ink">Project documents</h1>
        <p className="mt-2 text-[13px] text-muted">Keep briefs, contracts, designs, and project files grouped and ready to download.</p>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red/30 bg-red/5 px-3 py-2 text-[12px] text-red" role="alert">{error}</div>}

      <Card className="mb-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-white px-3 text-muted md:max-w-md"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents, files, descriptions..." className="w-full bg-transparent text-[11px] text-ink outline-none placeholder:text-[#aaa]" /></div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted" htmlFor="document-project-filter">Project</label>
            <select id="document-project-filter" className="h-[38px] min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-[11px] text-ink sm:w-auto sm:min-w-[190px] sm:flex-none" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}><option value="all">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
          </div>
        </div>
      </Card>

      {matchingDocuments.length === 0 && (query || projectFilter !== 'all') ? (
        <EmptyState title="No matching project documents" description="Try another search or add the first document for this project." action={<Button onClick={() => openCreate(projectFilter === 'all' ? '' : projectFilter)}>Add document</Button>} />
      ) : (
        <div className="space-y-5">
          {groups.filter((group) => group.items.length > 0 || projectFilter !== 'all').map(({ project, items }) => (
            <Card key={project.id}>
              <CardTitle
                title={project.name}
                subtitle={`${items.length} document${items.length === 1 ? '' : 's'} · ${project.client}`}
                action={<div className="flex items-center gap-2"><TextButton onClick={() => navigate(`/projects/${project.id}`)}>Open project</TextButton><Button variant="secondary" onClick={() => openCreate(project.id)}><Plus size={12} className="mr-1 inline" />Add file</Button></div>}
              />
              {items.length ? <div className="space-y-2">{items.map(renderDocument)}</div> : <EmptyState title="No files for this project yet" description="Add a file here to keep project documents together." action={<Button variant="secondary" onClick={() => openCreate(project.id)}>Upload first file</Button>} />}
            </Card>
          ))}
          {unlinkedDocuments.length > 0 && <Card><CardTitle title="Other documents" subtitle="Linked project is no longer available" /><div className="space-y-2">{unlinkedDocuments.map(renderDocument)}</div></Card>}
          {projectFilter === 'all' && !query && groups.every((group) => group.items.length === 0) && (
            <EmptyState title="No project files yet" description="Choose a project and upload a brief, contract, design, or other file to make it easy to find later." action={<Button onClick={() => openCreate()}><span className="flex items-center gap-1.5"><Plus size={13} />Add project document</span></Button>} />
          )}
        </div>
      )}

      {modalOpen && <DocumentModal open editing={editing} defaultProjectId={defaultProjectId} onClose={() => { setModalOpen(false); setEditing(null) }} />}
    </div>
  )
}
