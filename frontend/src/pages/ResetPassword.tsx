import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '@/services/api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-login)' }}>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-lime-500/10 rounded-full blur-3xl" />
        </div>
        <div className="w-full max-w-md relative z-10">
          <div className="glass-dark rounded-2xl shadow-2xl p-8 text-center space-y-4">
            <Logo />
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto bg-red-500/10 border border-red-500/30">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-white font-semibold text-lg">Invalid reset link</p>
            <p className="text-gray-400 text-sm">This link is missing a token. Please request a new password reset.</p>
            <Link
              to="/forgot-password"
              className="block py-2.5 rounded-xl text-white font-semibold text-center transition-all"
              style={{ background: 'linear-gradient(135deg, #7DC242 0%, #4CAF50 100%)', boxShadow: '0 4px 14px rgba(125,194,66,0.35)' }}
            >
              Request new link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await authApi.resetPassword(token, newPassword, confirmPassword)
      setDone(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Something went wrong. The link may have expired.')
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
          <div className="flex flex-col items-center mb-8">
            <Logo />
          </div>

          {done ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto bg-green-500/10 border border-green-500/30">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-semibold text-lg">Password reset!</p>
              <p className="text-gray-400 text-sm">Your password has been updated. You can now sign in with your new password.</p>
              <Link
                to="/login"
                className="block mt-4 py-2.5 rounded-xl text-white font-semibold text-center transition-all"
                style={{ background: 'linear-gradient(135deg, #7DC242 0%, #4CAF50 100%)', boxShadow: '0 4px 14px rgba(125,194,66,0.35)' }}
              >
                Sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-white font-semibold text-lg">Set a new password</h2>
                <p className="text-gray-400 text-sm mt-1">Must be at least 8 characters with 1 uppercase letter, 1 number, and 1 special character.</p>
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
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">New password</label>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full border placeholder-gray-500 rounded-xl px-4 py-2.5 focus:outline-none transition-all"
                    style={{ background: 'var(--bg-input)', borderColor: 'rgba(125,194,66,0.2)', color: 'var(--text-input)' }}
                    onFocus={e => { e.target.style.borderColor = '#7DC242'; e.target.style.boxShadow = '0 0 0 3px rgba(125,194,66,0.2)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(125,194,66,0.2)'; e.target.style.boxShadow = 'none' }}
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm new password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full border placeholder-gray-500 rounded-xl px-4 py-2.5 focus:outline-none transition-all"
                    style={{ background: 'var(--bg-input)', borderColor: 'rgba(125,194,66,0.2)', color: 'var(--text-input)' }}
                    onFocus={e => { e.target.style.borderColor = '#7DC242'; e.target.style.boxShadow = '0 0 0 3px rgba(125,194,66,0.2)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(125,194,66,0.2)'; e.target.style.boxShadow = 'none' }}
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 mt-2 rounded-xl text-white font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #7DC242 0%, #4CAF50 100%)', boxShadow: '0 4px 14px rgba(125,194,66,0.35)' }}
                >
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Resetting…</>
                  ) : 'Reset password'}
                </button>
              </form>

              <p className="mt-6 text-center">
                <Link to="/login" className="text-sm transition-colors hover:opacity-80" style={{ color: '#7DC242' }}>
                  Back to sign in
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

function Logo() {
  return (
    <>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-500/30" style={{ background: 'linear-gradient(135deg, #7DC242 0%, #4CAF50 100%)' }}>
        <span className="text-white font-extrabold text-xl">H</span>
      </div>
      <h1 className="text-2xl font-bold text-white tracking-wide">HYBRID</h1>
      <p className="text-[10px] font-medium tracking-widest uppercase mt-1" style={{ color: '#7DC242' }}>Job Agent</p>
    </>
  )
}
