import { useState } from 'react'
import { useApp } from '../store'
import { Button, Card, CardTitle, Field, inputClass } from '../components/ui'

const PREFS_KEY = 'nexora-prefs'

interface Prefs {
  workspaceName: string
  timezone: string
  weekStart: string
  weeklySummary: string
  projectView: string
  dateFormat: string
}

const defaultPrefs: Prefs = {
  workspaceName: 'Acme Collective',
  timezone: 'Eastern Time (ET)',
  weekStart: 'Monday',
  weeklySummary: 'Every Monday at 9:00 AM',
  projectView: 'Cards',
  dateFormat: 'MM/DD/YYYY',
}

function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    return raw ? { ...defaultPrefs, ...JSON.parse(raw) } : defaultPrefs
  } catch {
    return defaultPrefs
  }
}

export function Settings() {
  const { resetData } = useApp()
  const [saved, setSaved] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)

  const savePrefs = () => {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#929692]">Workspace</p>
        <h1 className="font-heading text-[28px] font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-2 text-[13px] text-muted">Configure your Nexora workspace.</p>
      </div>

      <Card>
        <CardTitle title="Workspace preferences" subtitle="Changes are saved locally for this workspace." />
        <form
          className="form-stagger grid grid-cols-1 md:grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            savePrefs()
          }}
        >
          <Field label="Workspace name"><input className={inputClass} value={prefs.workspaceName} onChange={(e) => setPrefs({ ...prefs, workspaceName: e.target.value })} /></Field>
          <Field label="Timezone">
            <select className={inputClass} value={prefs.timezone} onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}>
              <option>Eastern Time (ET)</option>
              <option>Pacific Time (PT)</option>
              <option>Central Time (CT)</option>
              <option>Mountain Time (MT)</option>
            </select>
          </Field>
          <Field label="Week starts on">
            <select className={inputClass} value={prefs.weekStart} onChange={(e) => setPrefs({ ...prefs, weekStart: e.target.value })}>
              <option>Monday</option>
              <option>Sunday</option>
            </select>
          </Field>
          <Field label="Weekly summary email">
            <select className={inputClass} value={prefs.weeklySummary} onChange={(e) => setPrefs({ ...prefs, weeklySummary: e.target.value })}>
              <option>Every Monday at 9:00 AM</option>
              <option>Never</option>
            </select>
          </Field>
          <Field label="Default project view">
            <select className={inputClass} value={prefs.projectView} onChange={(e) => setPrefs({ ...prefs, projectView: e.target.value })}>
              <option>Cards</option>
              <option>Table</option>
            </select>
          </Field>
          <Field label="Date format">
            <select className={inputClass} value={prefs.dateFormat} onChange={(e) => setPrefs({ ...prefs, dateFormat: e.target.value })}>
              <option>MM/DD/YYYY</option>
              <option>DD/MM/YYYY</option>
              <option>YYYY-MM-DD</option>
            </select>
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
            <Button type="submit">Save preferences</Button>
            {saved && <span className="text-[11px] text-green">Preferences saved</span>}
          </div>
        </form>
      </Card>

      <Card className="mt-4">
        <CardTitle title="Data management" subtitle="Reset the workspace or clear local changes" />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              if (window.confirm('Reset all workspace data? This clears every project, task, client and record.')) resetData()
            }}
          >
            Reset workspace
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (window.confirm('Clear all local data? This cannot be undone.')) {
                window.localStorage.removeItem('nexora-data-v6')
                window.localStorage.removeItem('nexora-sprints-v3')
                window.location.reload()
              }
            }}
          >
            Clear local data
          </Button>
        </div>
      </Card>
    </div>
  )
}
