import { useState } from 'react'
import { useApp } from '../store'
import { Button, Card, CardTitle, Field, inputClass } from '../components/ui'

export function Settings() {
  const { resetData } = useApp()
  const [saved, setSaved] = useState(false)

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
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
          }}
        >
          <Field label="Workspace name"><input className={inputClass} defaultValue="Acme Collective" /></Field>
          <Field label="Timezone">
            <select className={inputClass} defaultValue="Eastern Time (ET)">
              <option>Eastern Time (ET)</option>
              <option>Pacific Time (PT)</option>
              <option>Central Time (CT)</option>
              <option>Mountain Time (MT)</option>
            </select>
          </Field>
          <Field label="Week starts on">
            <select className={inputClass} defaultValue="Monday">
              <option>Monday</option>
              <option>Sunday</option>
            </select>
          </Field>
          <Field label="Weekly summary email">
            <select className={inputClass} defaultValue="Every Monday at 9:00 AM">
              <option>Every Monday at 9:00 AM</option>
              <option>Never</option>
            </select>
          </Field>
          <Field label="Default project view">
            <select className={inputClass} defaultValue="Cards">
              <option>Cards</option>
              <option>Table</option>
            </select>
          </Field>
          <Field label="Date format">
            <select className={inputClass} defaultValue="MM/DD/YYYY">
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
        <CardTitle title="Data management" subtitle="Reset to sample data or clear local changes" />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              if (window.confirm('Reset all data to the original sample dataset?')) resetData()
            }}
          >
            Reset to sample data
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (window.confirm('Clear all local data? This cannot be undone.')) {
                window.localStorage.removeItem('nexora-data-v1')
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
