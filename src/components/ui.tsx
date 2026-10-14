import { useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'rounded-card border border-line bg-paper p-5 shadow-soft transition-all duration-200 hover:shadow-lift',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="font-heading text-[15px] font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-1 text-[11px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'dark'; children: ReactNode; className?: string }) {
  const tones: Record<string, string> = {
    neutral: 'bg-[#f0f1ee] text-[#656966]',
    green: 'bg-[#dcfce7] text-[#16a34a]',
    amber: 'bg-[#fef3c7] text-[#d97706]',
    red: 'bg-[#fee2e2] text-[#dc2626]',
    blue: 'bg-[#dbeafe] text-[#2563eb]',
    dark: 'bg-[#292b2c] text-white',
  }
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-bold whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  const variants: Record<string, string> = {
    primary: 'bg-ink text-white hover:bg-[#36393a] active:scale-[0.98]',
    secondary: 'border border-line bg-white text-ink hover:bg-[#f7f7f5] active:scale-[0.98]',
    ghost: 'text-muted hover:bg-[#f0f1ed] hover:text-ink active:scale-[0.98]',
  }
  return (
    <button
      className={clsx(
        'rounded-lg px-3 py-2 text-[12px] font-semibold transition-all duration-150',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={clsx('h-[7px] w-full overflow-hidden rounded-full bg-[#eeeeeb]', className)}>
      <div
        className="h-full rounded-full bg-ink transition-all duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function avatarUrl(name: string, gender?: 'male' | 'female') {
  const seed = encodeURIComponent(name)
  const base = 'https://api.dicebear.com/9.x/avataaars/svg'
  const common = `clothing=blazerAndShirt&backgroundColor=e6e6e1`
  if (name === 'Sandeep Rana') {
    return `${base}?seed=${seed}&top=shortFlat&hairColor=1f2937&clothing=blazerAndShirt&clothesColor=334155&skinColor=edb98a&backgroundColor=ef4444`
  }
  if (gender === 'female') {
    return `${base}?seed=${seed}&top=longButNotTooLong&${common}`
  }
  return `${base}?seed=${seed}&top=shortFlat&facialHair=beardMedium&${common}`
}

function initialsFromName(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function Avatar({
  name,
  initials,
  src,
  className,
}: {
  name?: string
  initials?: string
  src?: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const fallback = initials ?? initialsFromName(name ?? '')
  if (!src || failed) {
    return (
      <div
        className={clsx(
          'grid h-7 w-7 place-items-center rounded-full bg-[#d4d7d2] text-[10px] font-bold text-ink',
          className,
        )}
      >
        {fallback}
      </div>
    )
  }
  return (
    <div className={clsx('grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-[#f0f1ed]', className)}>
      <img src={src} alt={name ?? fallback} className="h-full w-full object-cover" onError={() => setFailed(true)} />
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 rounded-card border border-dashed border-line bg-[#fafaf8] px-6 py-12 text-center">
      <p className="font-heading text-[14px] font-semibold text-ink">{title}</p>
      {description && <p className="max-w-md text-[12px] text-muted">{description}</p>}
      {action}
    </div>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  if (!open) return null
  return (
    <div className="modal-backdrop-enter fixed inset-0 z-50 grid place-items-center bg-[rgba(20,21,21,0.38)] p-3 sm:p-5">
      <div className="modal-panel-enter max-h-[92dvh] w-full max-w-[620px] overflow-auto rounded-2xl bg-white p-4 shadow-[0_25px_70px_rgba(0,0,0,0.2)] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading text-[20px] font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="text-[22px] leading-none text-muted hover:text-ink" aria-label="Close">
            ×
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({
  label,
  children,
  className,
  required = false,
  error,
}: {
  label: string
  children: ReactNode
  className?: string
  required?: boolean
  error?: string
}) {
  return (
    <label className={clsx('flex flex-col gap-1.5', className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#858a87]">
        {label}{required && <span className="ml-1 text-red" aria-hidden="true">*</span>}
      </span>
      {children}
      {error && <span className="text-[11px] font-medium text-red" role="alert">{error}</span>}
    </label>
  )
}

export function FormErrorSummary({ errors }: { errors: Record<string, string> }) {
  const messages = Object.values(errors).filter(Boolean)
  if (!messages.length) return null
  return (
    <div className="mb-4 rounded-lg border border-red/30 bg-red/5 px-3 py-2.5 text-[12px] text-red" role="alert" aria-live="assertive">
      <p className="font-semibold">Please fix the following before continuing:</p>
      <ul className="mt-1 list-inside list-disc">
        {messages.map((message) => <li key={message}>{message}</li>)}
      </ul>
    </div>
  )
}

export const inputClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none transition focus:border-ink'

export const invalidInputClass =
  'w-full rounded-lg border border-red bg-red/5 px-3 py-2 text-[13px] text-ink outline-none transition focus:border-red focus:ring-2 focus:ring-red/10'

export function TextButton({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx('text-[11px] font-semibold text-[#666] transition hover:text-ink', className)}
      {...props}
    >
      {children}
    </button>
  )
}
