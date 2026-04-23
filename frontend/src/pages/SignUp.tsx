import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

// Password strength rules (must match backend RegisterRequest regex)
const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: '1 uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: '1 number', test: (p: string) => /\d/.test(p) },
  { label: '1 special character (!@#$…)', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(p) },
]

function getStrengthScore(password: string): number {
  return PASSWORD_RULES.filter(r => r.test(password)).length
}

const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLOR = ['', '#ef4444', '#f97316', '#eab308', '#7DC242']

export default function SignUp() {
  const { register } = useAuth()

  const [form, setForm] = useState({ username: '', email: '', password: '', confirm_password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!form.username.trim()) newErrors.username = 'Username is required'
    else if (form.username.length < 3) newErrors.username = 'Username must be at least 3 characters'

    if (!form.email.trim()) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Enter a valid email address'

    const score = getStrengthScore(form.password)
    if (!form.password) newErrors.password = 'Password is required'
    else if (score < 4) newErrors.password = 'Password does not meet all requirements'

    if (!form.confirm_password) newErrors.confirm_password = 'Please confirm your password'
    else if (form.password !== form.confirm_password) newErrors.confirm_password = 'Passwords do not match'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setErrors({})
    try {
      const res = await register(form)
      setSuccess(res.message)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') {
        // Map backend error messages to field-level errors
        if (detail.toLowerCase().includes('username')) setErrors({ username: detail })
        else if (detail.toLowerCase().includes('email')) setErrors({ email: detail })
        else if (detail.toLowerCase().includes('password')) setErrors({ password: detail })
        else setErrors({ _global: detail })
      } else if (Array.isArray(detail)) {
        // Pydantic validation errors come as an array
        const fieldErrors: Record<string, string> = {}
        detail.forEach((d: any) => {
          const field = d.loc?.[d.loc.length - 1] || '_global'
          fieldErrors[field] = d.msg
        })
        setErrors(fieldErrors)
      } else {
        setErrors({ _global: 'Something went wrong. Please try again.' })
      }
    } finally {
      setLoading(false)
    }
  }

  const strengthScore = getStrengthScore(form.password)

  const inputClass = "w-full border placeholder-gray-500 rounded-xl px-4 py-2.5 focus:outline-none transition-all"
  const inputStyle = { background: 'var(--bg-input)', borderColor: 'rgba(125,194,66,0.2)', color: 'var(--text-input)' }
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#7DC242'
    e.target.style.boxShadow = '0 0 0 3px rgba(125,194,66,0.2)'
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(125,194,66,0.2)'
    e.target.style.boxShadow = 'none'
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-login)' }}>
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-lime-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="glass-dark rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-500/30" style={{ background: 'linear-gradient(135deg, #7DC242 0%, #4CAF50 100%)' }}>
              <span className="text-white font-extrabold text-xl">H</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">HYBRID</h1>
            <p className="text-[10px] font-medium tracking-widest uppercase mt-1" style={{ color: '#7DC242' }}>Job Agent</p>
          </div>

          {/* Success state — show after successful registration */}
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto bg-green-500/10 border border-green-500/30">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-white font-semibold text-lg">Check your inbox</p>
              <p className="text-gray-400 text-sm leading-relaxed">{success}</p>
              <p className="text-gray-500 text-xs">Didn't receive it? Check your spam folder or{' '}
                <button
                  className="underline transition-colors hover:opacity-80"
                  style={{ color: '#7DC242' }}
                  onClick={() => setSuccess(null)}
                >
                  go back
                </button>.
              </p>
              <Link
                to="/login"
                className="block mt-4 py-2.5 rounded-xl text-white font-semibold text-center transition-all"
                style={{ background: 'linear-gradient(135deg, #7DC242 0%, #4CAF50 100%)', boxShadow: '0 4px 14px rgba(125,194,66,0.35)' }}
              >
                Go to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white text-center mb-6">Create your account</h2>

              {/* Global error */}
              {errors._global && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {errors._global}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Username</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={form.username}
                    onChange={set('username')}
                    className={inputClass}
                    style={{ ...inputStyle, ...(errors.username ? { borderColor: '#ef4444' } : {}) }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    placeholder="yourusername"
                  />
                  {errors.username && <p className="mt-1 text-xs text-red-400">{errors.username}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={set('email')}
                    className={inputClass}
                    style={{ ...inputStyle, ...(errors.email ? { borderColor: '#ef4444' } : {}) }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    placeholder="you@example.com"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={set('password')}
                    className={inputClass}
                    style={{ ...inputStyle, ...(errors.password ? { borderColor: '#ef4444' } : {}) }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    placeholder="••••••••"
                  />

                  {/* Password strength bar */}
                  {form.password.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className="h-1 flex-1 rounded-full transition-all duration-300"
                            style={{ background: i <= strengthScore ? STRENGTH_COLOR[strengthScore] : 'rgba(255,255,255,0.1)' }}
                          />
                        ))}
                      </div>
                      <p className="text-xs" style={{ color: STRENGTH_COLOR[strengthScore] || '#94a3b8' }}>
                        {STRENGTH_LABEL[strengthScore] || 'Enter a password'}
                      </p>
                      <ul className="space-y-0.5">
                        {PASSWORD_RULES.map(rule => (
                          <li key={rule.label} className="flex items-center gap-1.5 text-xs">
                            <span style={{ color: rule.test(form.password) ? '#7DC242' : '#64748b' }}>
                              {rule.test(form.password) ? '✓' : '○'}
                            </span>
                            <span style={{ color: rule.test(form.password) ? '#94a3b8' : '#64748b' }}>{rule.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm password</label>
                  <input
                    type="password"
                    required
                    value={form.confirm_password}
                    onChange={set('confirm_password')}
                    className={inputClass}
                    style={{ ...inputStyle, ...(errors.confirm_password ? { borderColor: '#ef4444' } : {}) }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    placeholder="••••••••"
                  />
                  {errors.confirm_password && <p className="mt-1 text-xs text-red-400">{errors.confirm_password}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 mt-2 rounded-xl text-white font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #7DC242 0%, #4CAF50 100%)', boxShadow: '0 4px 14px rgba(125,194,66,0.35)' }}
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating account...
                    </>
                  ) : 'Create account'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link to="/login" className="font-medium transition-colors hover:opacity-80" style={{ color: '#7DC242' }}>
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          Powered by <span className="font-medium" style={{ color: '#7DC242' }}>Hybrid MediaWorks</span>
        </p>
      </div>
    </div>
  )
}
