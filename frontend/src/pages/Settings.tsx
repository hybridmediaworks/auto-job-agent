import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi, type AppSetting } from '@/services/api'
import { useTheme } from '@/contexts/ThemeContext'

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7DC242', borderTopColor: 'transparent' }} />
    </div>
  )
}

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  database: { label: 'Saved in DB', className: 'bg-green-500/20 text-green-300' },
  env:      { label: 'From .env',   className: 'bg-green-500/20 text-green-300' },
  not_set:  { label: 'Not Set',     className: 'bg-gray-500/20 text-gray-400' },
}

function SettingCard({ setting }: { setting: AppSetting }) {
  const queryClient = useQueryClient()
  const [inputValue, setInputValue] = useState('')
  const [editing, setEditing]       = useState(false)
  const [showValue, setShowValue]   = useState(false)

  const mutation = useMutation({
    mutationFn: (value: string) => settingsApi.update(setting.key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setEditing(false)
      setInputValue('')
    },
  })

  const badge = SOURCE_BADGE[setting.source] ?? SOURCE_BADGE.not_set

  const handleSave = () => {
    mutation.mutate(inputValue)
  }

  const handleClear = () => {
    mutation.mutate('')
  }

  const handleCancel = () => {
    setEditing(false)
    setInputValue('')
  }

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-mono font-semibold text-gray-100 text-sm">{setting.key}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">{setting.description}</p>
        </div>
      </div>

      {/* Current value display */}
      {setting.has_value && !editing && (
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs border rounded px-3 py-2 font-mono truncate" style={{ background: 'var(--code-bg)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
            {showValue ? setting.value : '••••••••••••••••'}
          </code>
          <button
            onClick={() => setShowValue(!showValue)}
            className="p-2 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0"
            title={showValue ? 'Hide' : 'Show'}
          >
            {showValue ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      )}

      {!setting.has_value && !editing && (
        <p className="text-sm text-gray-400 italic">No value set</p>
      )}

      {/* Edit form */}
      {editing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Enter ${setting.key}`}
            className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500/50"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-input)' }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={mutation.isPending || !inputValue.trim()}
              className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={mutation.isPending}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
          {mutation.isError && (
            <p className="text-sm text-red-600">Failed to save. Please try again.</p>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditing(true)
              setInputValue('')
            }}
            className="btn-secondary text-sm"
          >
            {setting.has_value ? 'Update' : 'Set Value'}
          </button>
          {setting.source === 'database' && (
            <button
              onClick={handleClear}
              disabled={mutation.isPending}
              className="text-sm px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 rounded-lg transition-colors disabled:opacity-50"
              title="Remove from DB (will fall back to .env)"
            >
              {mutation.isPending ? 'Clearing...' : 'Clear'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const { isDark } = useTheme()
  const { data: settings, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.list,
  })

  if (isLoading) return <Spinner />

  if (isError) return (
    <div className="text-center py-16">
      <p className="text-red-600">Failed to load settings.</p>
    </div>
  )

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">
          Manage API keys and credentials. Values saved here override <code className="text-xs px-1 py-0.5 rounded" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>.env</code> file settings without requiring a restart.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex gap-3 p-4 border rounded-xl text-sm" style={{ background: 'rgba(125,194,66,0.08)', borderColor: 'rgba(125,194,66,0.2)', color: 'var(--info-banner-color)' }}>
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <strong>Priority:</strong> Database values take priority over <code className="text-xs px-1 py-0.5 rounded" style={{ background: 'rgba(125,194,66,0.15)' }}>.env</code> file values.
          Clearing a database value restores the <code className="text-xs px-1 py-0.5 rounded" style={{ background: 'rgba(125,194,66,0.15)' }}>.env</code> fallback.
        </div>
      </div>

      {/* Setting cards */}
      <div className="space-y-4">
        {settings?.map((setting) => (
          <SettingCard key={setting.key} setting={setting} />
        ))}
      </div>

      {/* RapidAPI subscription instructions */}
      <div className="border rounded-xl p-5 space-y-4" style={{ borderColor: 'rgba(245,158,11,0.25)', background: isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.04)' }}>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" style={{ color: isDark ? '#fbbf24' : '#b45309' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="font-semibold text-sm" style={{ color: isDark ? '#fcd34d' : '#92400e' }}>RapidAPI Subscriptions Required</h3>
        </div>
        <p className="text-sm" style={{ color: isDark ? 'rgba(252,211,77,0.8)' : 'var(--text-body)' }}>
          The RAPIDAPI_KEY above won't work unless you're subscribed to each provider's API on RapidAPI.
          Subscribe to the APIs you want to use (free tiers available):
        </p>
        <ul className="space-y-3">
          {[
            {
              provider: 'Indeed',
              host: 'indeed12.p.rapidapi.com',
              url: 'https://rapidapi.com/mantiks-mantiks-default/api/indeed12',
            },
            {
              provider: 'Glassdoor',
              host: 'glassdoor-real-time.p.rapidapi.com',
              url: 'https://rapidapi.com/things4u-api4upro/api/glassdoor-real-time',
            },
            {
              provider: 'ZipRecruiter',
              host: 'jsearch.p.rapidapi.com',
              url: 'https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch',
            },
            {
              provider: 'LinkedIn',
              host: 'linkedin-job-search-api.p.rapidapi.com',
              url: 'https://rapidapi.com/fantastic-jobs-fantastic-jobs-default/api/linkedin-job-search-api',
            },
          ].map(({ provider, host, url }) => (
            <li key={provider} className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: isDark ? '#fbbf24' : '#b45309' }} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: isDark ? '#fde68a' : 'var(--text-primary)' }}>{provider}</span>
                  <code
                    className="text-xs px-1.5 py-0.5 rounded font-mono"
                    style={{
                      background: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(0,0,0,0.06)',
                      color: isDark ? '#fbbf24' : 'var(--text-secondary)',
                    }}
                  >{host}</code>
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs hover:underline break-all"
                  style={{ color: isDark ? '#60a5fa' : '#2563eb' }}
                >
                  {url}
                </a>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs" style={{ color: isDark ? 'rgba(251,191,36,0.7)' : 'var(--text-muted)' }}>
          After subscribing, copy your key from <strong>RapidAPI → Developer Dashboard → Security</strong> and paste it above.
          One key works across all subscribed APIs.
        </p>

        {/* Step-by-step mini guide */}
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(245,158,11,0.15)' }}>
          <h4 className="text-xs font-semibold mb-2" style={{ color: isDark ? '#fcd34d' : '#92400e' }}>🔄 Switching to a New RapidAPI Account (Free Tier Reset)</h4>
          <ol className="text-xs space-y-1.5 list-decimal list-inside" style={{ color: isDark ? 'rgba(245,158,11,0.7)' : 'var(--text-body)' }}>
            <li>Go to <a href="https://rapidapi.com" target="_blank" rel="noopener noreferrer" style={{ color: isDark ? '#60a5fa' : '#2563eb' }} className="hover:underline">rapidapi.com</a> → <strong>Sign Up</strong> with a new email</li>
            <li>Open each API link above → click <strong>"Subscribe to Test"</strong> (free plan)</li>
            <li>Go to <a href="https://rapidapi.com/developer/security" target="_blank" rel="noopener noreferrer" style={{ color: isDark ? '#60a5fa' : '#2563eb' }} className="hover:underline">Dashboard → Security</a> → copy your <strong>Application Key</strong></li>
            <li>Paste the new key in the <code className="text-xs px-1 py-0.5 rounded" style={{ background: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(0,0,0,0.06)', color: isDark ? '#fbbf24' : 'var(--text-secondary)' }}>RAPIDAPI_KEY</code> field above → click <strong>Update</strong></li>
          </ol>
        </div>
      </div>
    </div>
  )
}
