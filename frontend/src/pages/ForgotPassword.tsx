import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/services/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setDone(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
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

          {done ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto bg-green-500/10 border border-green-500/30">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-white font-semibold text-lg">Check your email</p>
              <p className="text-gray-400 text-sm">If that email is registered, a password reset link has been sent. The link expires in 1 hour.</p>
              <Link
                to="/login"
                className="block mt-4 py-2.5 rounded-xl text-white font-semibold text-center transition-all"
                style={{ background: 'linear-gradient(135deg, #7DC242 0%, #4CAF50 100%)', boxShadow: '0 4px 14px rgba(125,194,66,0.35)' }}
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-white font-semibold text-lg">Forgot your password?</h2>
                <p className="text-gray-400 text-sm mt-1">Enter your email and we'll send you a reset link.</p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border placeholder-gray-500 rounded-xl px-4 py-2.5 focus:outline-none transition-all"
                    style={{ background: 'var(--bg-input)', borderColor: 'rgba(125,194,66,0.2)', color: 'var(--text-input)' }}
                    onFocus={e => { e.target.style.borderColor = '#7DC242'; e.target.style.boxShadow = '0 0 0 3px rgba(125,194,66,0.2)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(125,194,66,0.2)'; e.target.style.boxShadow = 'none' }}
                    placeholder="you@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 mt-2 rounded-xl text-white font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #7DC242 0%, #4CAF50 100%)', boxShadow: '0 4px 14px rgba(125,194,66,0.35)' }}
                >
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</>
                  ) : 'Send reset link'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                Remember it?{' '}
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
