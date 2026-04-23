import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '@/services/api'

type State = 'loading' | 'success' | 'error'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [state, setState] = useState<State>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [resendEmail, setResendEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  useEffect(() => {
    if (!token) {
      setState('error')
      setErrorMessage('No verification token found in the link.')
      return
    }

    authApi.verifyEmail(token)
      .then(() => setState('success'))
      .catch((err) => {
        setState('error')
        setErrorMessage(err.response?.data?.detail || 'Verification failed. The link may have expired.')
      })
  }, [token])

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    setResendLoading(true)
    try {
      await authApi.resendVerification(resendEmail)
      setResendDone(true)
    } catch {
      setResendDone(true) // always show the same message (don't leak email existence)
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-login)' }}>
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

          {/* Loading */}
          {state === 'loading' && (
            <div className="text-center space-y-4">
              <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: 'rgba(125,194,66,0.3)', borderTopColor: '#7DC242' }} />
              <p className="text-gray-400 text-sm">Verifying your email…</p>
            </div>
          )}

          {/* Success */}
          {state === 'success' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto bg-green-500/10 border border-green-500/30">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-semibold text-lg">Email verified!</p>
              <p className="text-gray-400 text-sm">Your account is now active. You can sign in.</p>
              <Link
                to="/login?verified=1"
                className="block mt-4 py-2.5 rounded-xl text-white font-semibold text-center transition-all"
                style={{ background: 'linear-gradient(135deg, #7DC242 0%, #4CAF50 100%)', boxShadow: '0 4px 14px rgba(125,194,66,0.35)' }}
              >
                Sign in
              </Link>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto bg-red-500/10 border border-red-500/30">
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="mt-4 text-white font-semibold text-lg">Verification failed</p>
                <p className="text-gray-400 text-sm mt-1">{errorMessage}</p>
              </div>

              {!resendDone ? (
                <form onSubmit={handleResend} className="space-y-3 pt-2">
                  <p className="text-xs text-gray-500 text-center">Enter your email to get a new link:</p>
                  <input
                    type="email"
                    required
                    value={resendEmail}
                    onChange={e => setResendEmail(e.target.value)}
                    className="w-full border placeholder-gray-500 rounded-xl px-4 py-2.5 focus:outline-none transition-all"
                    style={{ background: 'var(--bg-input)', borderColor: 'rgba(125,194,66,0.2)', color: 'var(--text-input)' }}
                    onFocus={e => { e.target.style.borderColor = '#7DC242'; e.target.style.boxShadow = '0 0 0 3px rgba(125,194,66,0.2)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(125,194,66,0.2)'; e.target.style.boxShadow = 'none' }}
                    placeholder="you@example.com"
                  />
                  <button
                    type="submit"
                    disabled={resendLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #7DC242 0%, #4CAF50 100%)' }}
                  >
                    {resendLoading ? (
                      <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</>
                    ) : 'Resend verification email'}
                  </button>
                </form>
              ) : (
                <p className="text-center text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                  If that email is registered, a new verification link has been sent.
                </p>
              )}

              <p className="text-center">
                <Link to="/login" className="text-sm transition-colors hover:opacity-80" style={{ color: '#7DC242' }}>
                  Back to sign in
                </Link>
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          Powered by <span className="font-medium" style={{ color: '#7DC242' }}>Hybrid MediaWorks</span>
        </p>
      </div>
    </div>
  )
}
