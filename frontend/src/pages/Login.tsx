import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Show success banner if user just verified their email
  const justVerified = searchParams.get('verified') === '1'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ identifier, password })
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-login)' }}>
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-lime-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div className="glass-dark rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-500/30" style={{ background: 'linear-gradient(135deg, #7DC242 0%, #4CAF50 100%)' }}>
              <span className="text-white font-extrabold text-xl">H</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">HYBRID</h1>
            <p className="text-[10px] font-medium tracking-widest uppercase mt-1" style={{ color: '#7DC242' }}>Job Agent</p>
          </div>

          {/* Email verified success banner */}
          {justVerified && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2 text-green-400 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Email verified! You can now sign in.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Username or Email</label>
              <input
                type="text"
                required
                autoFocus
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                className="w-full border placeholder-gray-500 rounded-xl px-4 py-2.5 focus:outline-none transition-all"
                style={{ background: 'var(--bg-input)', borderColor: 'rgba(125,194,66,0.2)', color: 'var(--text-input)' }}
                onFocus={e => (e.target.style.borderColor = '#7DC242', e.target.style.boxShadow = '0 0 0 3px rgba(125,194,66,0.2)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(125,194,66,0.2)', e.target.style.boxShadow = 'none')}
                placeholder="Username or email"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-300">Password</label>
                <Link to="/forgot-password" className="text-xs transition-colors hover:opacity-80" style={{ color: '#7DC242' }}>
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border placeholder-gray-500 rounded-xl px-4 py-2.5 focus:outline-none transition-all"
                style={{ background: 'var(--bg-input)', borderColor: 'rgba(125,194,66,0.2)', color: 'var(--text-input)' }}
                onFocus={e => (e.target.style.borderColor = '#7DC242', e.target.style.boxShadow = '0 0 0 3px rgba(125,194,66,0.2)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(125,194,66,0.2)', e.target.style.boxShadow = 'none')}
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
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : 'Sign in'}
            </button>
          </form>

          {/* Sign up link */}
          <p className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium transition-colors hover:opacity-80" style={{ color: '#7DC242' }}>
              Create one
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-600">
          Powered by <span className="font-medium" style={{ color: '#7DC242' }}>Hybrid MediaWorks</span>
        </p>
      </div>
    </div>
  )
}
