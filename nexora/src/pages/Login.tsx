import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Lock, LogIn, User, UserPlus } from 'lucide-react'

const BRAND_NAME = 'NEXORA'
const COPYRIGHT = '© 2026 NEXORA'

const INJECTED_STYLES = `
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-14px); }
}
@keyframes pulse-ring {
  0%, 100% { transform: scale(1); opacity: 0.45; }
  50% { transform: scale(1.07); opacity: 0.95; }
}
@keyframes aurora {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(24px, -18px); }
  50% { transform: translate(-12px, 12px); }
  75% { transform: translate(18px, 6px); }
}
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes spin-slow {
  to { transform: rotate(360deg); }
}
@keyframes shimmer {
  0% { transform: translateX(-100%) skewX(-16deg); }
  100% { transform: translateX(300%) skewX(-16deg); }
}
.floating-input:not(:placeholder-shown) + label,
.floating-input:focus + label {
  top: 11px;
  left: 16px;
  transform: translateY(0);
  font-size: 11px;
  color: #252829;
}
`

function AbstractVisual() {
  return (
    <svg
      viewBox="0 0 420 340"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[420px]"
      aria-hidden="true"
    >
      <rect x="24" y="40" width="180" height="120" rx="20" fill="#292b2c" />
      <rect x="44" y="70" width="100" height="10" rx="5" fill="#5a5d5c" />
      <rect x="44" y="92" width="140" height="8" rx="4" fill="#4a4d4c" />
      <rect x="44" y="112" width="80" height="8" rx="4" fill="#4a4d4c" />
      <rect x="44" y="132" width="60" height="8" rx="4" fill="#3b8b67" opacity="0.85" />

      <rect x="224" y="20" width="170" height="90" rx="18" fill="#292b2c" />
      <rect x="244" y="48" width="80" height="8" rx="4" fill="#5a5d5c" />
      <rect x="244" y="68" width="130" height="6" rx="3" fill="#4a4d4c" />
      <rect x="244" y="84" width="130" height="6" rx="3" fill="#4a4d4c" />

      <rect x="24" y="180" width="270" height="120" rx="22" fill="#292b2c" />
      <rect x="48" y="212" width="110" height="8" rx="4" fill="#5a5d5c" />
      <rect x="48" y="236" width="222" height="10" rx="5" fill="#4a4d4c" />
      <rect x="48" y="258" width="180" height="10" rx="5" fill="#4a4d4c" />
      <rect x="48" y="280" width="90" height="10" rx="5" fill="#c25555" opacity="0.75" />

      <circle cx="380" cy="260" r="32" fill="#292b2c" />
      <path d="M360 260 L375 275 L405 245" stroke="#3b8b67" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LoginVisualPanel() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 })

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMouse({
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: (e.clientY - rect.top) / rect.height - 0.5,
    })
  }

  const parallax = (factor: number) => ({
    transform: `translate(${mouse.x * factor}px, ${mouse.y * factor}px)`,
    transition: 'transform 0.15s ease-out',
  })

  return (
    <div
      className="relative hidden h-full w-1/2 flex-col overflow-hidden bg-ink lg:flex"
      onMouseMove={handleMove}
      onMouseLeave={() => setMouse({ x: 0, y: 0 })}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            'radial-gradient(circle at 30% 60%, rgba(59,139,103,0.18) 0%, transparent 45%), radial-gradient(circle at 80% 20%, rgba(43,108,176,0.12) 0%, transparent 40%)',
        }}
      />

      <div
        className="pointer-events-none absolute -left-20 top-40 h-64 w-64 rounded-full bg-[#3b8b67]/10 blur-3xl"
        style={{ animation: 'aurora 14s ease-in-out infinite' }}
      />
      <div
        className="pointer-events-none absolute bottom-20 -right-16 h-72 w-72 rounded-full bg-[#2b6cb0]/10 blur-3xl"
        style={{ animation: 'aurora 16s ease-in-out infinite reverse' }}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="h-[500px] w-[500px] rounded-full border border-white/5"
          style={{ animation: 'pulse-ring 6s ease-in-out infinite', ...parallax(-12) }}
        />
        <div
          className="absolute h-[360px] w-[360px] rounded-full border border-white/5"
          style={{ animation: 'pulse-ring 6s ease-in-out infinite 1.5s', ...parallax(-8) }}
        />
        <div
          className="absolute h-[220px] w-[220px] rounded-full border border-white/5"
          style={{ animation: 'pulse-ring 6s ease-in-out infinite 3s', ...parallax(-4) }}
        />
      </div>

      <p className="absolute left-10 top-10 z-10 text-[12px] font-medium tracking-wide text-muted">
        Less chasing. More achieving.
      </p>

      <div className="relative z-10 flex h-full flex-col items-start justify-start p-10 pt-24">
        <h2
          className="w-full max-w-[420px] text-left text-[56px] font-semibold leading-[0.95] tracking-tight text-white lg:text-[64px]"
          style={parallax(8)}
        >
          Make
          <br />
          <span className="text-green">chaos obey.</span>
        </h2>
        <div className="mt-12 w-full max-w-[420px]" style={parallax(20)}>
          <div style={{ animation: 'float 7s ease-in-out infinite' }}>
            <AbstractVisual />
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 left-10 right-10 z-10 flex items-end justify-between">
        <div className="h-2 w-2 rounded-full bg-green" style={{ animation: 'pulse-ring 3s ease-in-out infinite' }} />
        <div className="h-24 w-24 rounded-full border border-white/10" style={{ animation: 'pulse-ring 5s ease-in-out infinite' }} />
      </div>
    </div>
  )
}

export function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState<'email' | 'password' | null>(null)

  const validate = () => {
    const next: { email?: string; password?: string } = {}
    const value = email.trim()
    if (!value) {
      next.email = 'Please enter your email or username.'
    } else if (value.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      next.email = 'Please enter a valid email address.'
    }
    if (!password) next.password = 'Please enter your password.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    window.setTimeout(() => {
      onLogin()
    }, 1200)
  }

  return (
    <>
      <style>{INJECTED_STYLES}</style>
      <div className="flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6 md:p-10">
      <div
        className="flex w-full max-w-[1320px] overflow-hidden rounded-card border border-line bg-paper shadow-lift sm:rounded-[38px]"
        style={{ minHeight: '700px' }}
      >
        <LoginVisualPanel />

        <div className="relative flex w-full flex-col bg-paper md:w-1/2">
          <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-8 md:px-12 lg:px-16 lg:py-10">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-white">
                N
              </div>
              <span className="text-[15px] font-semibold tracking-tight text-ink">{BRAND_NAME}</span>
            </div>
            <Link
              to="/signup"
              className="flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
            >
              <UserPlus size={15} />
              Sign Up
            </Link>
          </div>

          <div className="flex h-full items-center justify-center p-8 pt-28 md:px-12 lg:px-16 lg:pt-20">
            <form
              onSubmit={handleSubmit}
              className="w-full max-w-[420px]"
              noValidate
              aria-label="Sign in form"
              style={{ animation: 'fade-in-up 0.55s ease-out 0.1s forwards', opacity: 0 }}
            >
              <h1 className="font-heading text-[32px] font-semibold tracking-tight text-ink md:text-[38px]">
                Welcome back
              </h1>
              <p className="mb-8 mt-2 text-[14px] text-muted">
                Sign in to continue to your account.
              </p>

              <div className="space-y-5">
                <div className="group/email">
                  <label
                    htmlFor="email"
                    className="mb-1.5 ml-1 block text-[10px] font-semibold uppercase tracking-wider text-muted"
                  >
                    Email or Username
                  </label>
                  <div className="relative">
                    <User
                      size={18}
                      className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
                        focused === 'email' ? 'text-ink' : 'text-muted'
                      }`}
                    />
                    <input
                      id="email"
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocused('email')}
                      onBlur={() => setFocused((f) => f === 'email' ? null : f)}
                      placeholder="you@example.com"
                      className={`h-[54px] w-full rounded-full border bg-white pl-12 pr-5 text-[14px] text-ink outline-none transition-all duration-200 placeholder:text-muted/40 focus:border-ink focus:ring-2 focus:ring-ink/20 ${
                        errors.email ? 'border-red' : 'border-line'
                      }`}
                      aria-invalid={errors.email ? 'true' : 'false'}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                    />
                  </div>
                  {errors.email && (
                    <p id="email-error" className="ml-4 mt-1.5 text-[12px] text-red">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div className="group/password">
                  <label
                    htmlFor="password"
                    className="mb-1.5 ml-1 block text-[10px] font-semibold uppercase tracking-wider text-muted"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={18}
                      className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
                        focused === 'password' ? 'text-ink' : 'text-muted'
                      }`}
                    />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused((f) => f === 'password' ? null : f)}
                      placeholder="••••••••"
                      className={`h-[54px] w-full rounded-full border bg-white pl-12 pr-12 text-[14px] text-ink outline-none transition-all duration-200 placeholder:text-muted/40 focus:border-ink focus:ring-2 focus:ring-ink/20 ${
                        errors.password ? 'border-red' : 'border-line'
                      }`}
                      aria-invalid={errors.password ? 'true' : 'false'}
                      aria-describedby={errors.password ? 'password-error' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p id="password-error" className="ml-4 mt-1.5 text-[12px] text-red">
                      {errors.password}
                    </p>
                  )}
                </div>

                <div className="flex justify-start">
                  <button
                    type="button"
                    className="text-[13px] font-medium text-muted transition-colors hover:text-ink"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative flex h-[54px] w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-ink text-[15px] font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-px hover:bg-[#36393a] hover:shadow-lift active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span
                    className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:animate-[shimmer_1.2s_linear_infinite]"
                    aria-hidden="true"
                  />
                  {loading ? (
                    <Loader2 size={18} style={{ animation: 'spin-slow 1s linear infinite' }} />
                  ) : (
                    <LogIn size={18} />
                  )}
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>

          <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-wrap items-center justify-between gap-3 p-8 text-[12px] text-muted md:px-12 lg:px-16 lg:py-10">
            <span>{COPYRIGHT}</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="transition-colors hover:text-ink"
              >
                Contact Us
              </button>
              <button
                type="button"
                className="flex items-center gap-1 transition-colors hover:text-ink"
              >
                English <span className="text-[10px]">▾</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
