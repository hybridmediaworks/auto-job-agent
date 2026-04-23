import { useState, useEffect, useRef } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { jobsApi, providersApi, savedSearchesApi } from '@/services/api'
import { PIPELINE_STAGES, TERMINAL_STATUSES } from '@/types'
import { CustomSelect } from '@/components/CustomSelect'
import { useTheme } from '@/contexts/ThemeContext'

const ALL_STATUSES = [...PIPELINE_STAGES, ...TERMINAL_STATUSES]

const statusColors: Record<string, string> = {
  DISCOVERED: 'bg-slate-500/20 text-slate-300',
  BOOKMARKED: 'bg-amber-500/20 text-amber-300',
  APPLIED:    'bg-green-500/20 text-green-300',
  SCREENING:  'bg-blue-500/20 text-blue-300',
  INTERVIEW:  'bg-violet-500/20 text-violet-300',
  OFFERED:    'bg-emerald-500/20 text-emerald-300',
  HIRED:      'bg-green-500/30 text-green-200',
  REJECTED:   'bg-red-500/20 text-red-300',
  CLOSED:     'bg-gray-500/20 text-gray-400',
  SKIPPED:    'bg-gray-500/15 text-gray-500',
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative rounded-2xl shadow-2xl w-full max-w-lg border" style={{ background: 'var(--bg-modal)', borderColor: 'var(--border-brand-md)' }}>{children}</div>
    </div>
  )
}

const PROVIDER_META: Record<string, { label: string; abbr: string; activeCls: string; iconCls: string }> = {
  indeed:       { label: 'Indeed',       abbr: 'IN', activeCls: 'border-blue-500/50 bg-blue-500/15 text-blue-300',      iconCls: 'bg-blue-500/25 text-blue-300' },
  glassdoor:    { label: 'Glassdoor',    abbr: 'GD', activeCls: 'border-green-500/50 bg-green-500/15 text-green-300',    iconCls: 'bg-green-500/25 text-green-300' },
  ziprecruiter: { label: 'ZipRecruiter', abbr: 'ZR', activeCls: 'border-purple-500/50 bg-purple-500/15 text-purple-300', iconCls: 'bg-purple-500/25 text-purple-300' },
  linkedin:     { label: 'LinkedIn',     abbr: 'LI', activeCls: 'border-sky-500/50 bg-sky-500/15 text-sky-300',         iconCls: 'bg-sky-500/25 text-sky-300' },
}

function getDateLabel(dateStr: string | null): string {
  if (!dateStr) return 'Unknown Date'
  // posted_date is YYYY-MM-DD — compare as local date, not UTC
  const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (year === today.getFullYear() && month === today.getMonth() + 1 && day === today.getDate()) return 'Today'
  if (year === yesterday.getFullYear() && month === yesterday.getMonth() + 1 && day === yesterday.getDate()) return 'Yesterday'
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export default function Jobs() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isDark } = useTheme()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState(() => sessionStorage.getItem('jf_search') || '')
  const [locationInput, setLocationInput] = useState(() => sessionStorage.getItem('jf_location') || '')
  const [providerFilter, setProviderFilter] = useState(() => sessionStorage.getItem('jf_provider') || '')
  const [statusFilter, setStatusFilter] = useState(() => sessionStorage.getItem('jf_status') || '')
  const [deleteMode, setDeleteMode] = useState(false)
  const [fetchOpen, setFetchOpen] = useState(false)
  const [saveSearchOpen, setSaveSearchOpen] = useState(false)
  const [saveSearchName, setSaveSearchName] = useState('')
  const [saveSearchInterval, setSaveSearchInterval] = useState(24)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState(() => sessionStorage.getItem('jf_date') || '')
  const [customDate, setCustomDate] = useState(() => sessionStorage.getItem('jf_custom_date') || '')

  // Persist list filters to sessionStorage whenever they change
  useEffect(() => { sessionStorage.setItem('jf_search', searchInput) }, [searchInput])
  useEffect(() => { sessionStorage.setItem('jf_location', locationInput) }, [locationInput])
  useEffect(() => { sessionStorage.setItem('jf_provider', providerFilter) }, [providerFilter])
  useEffect(() => { sessionStorage.setItem('jf_status', statusFilter) }, [statusFilter])
  useEffect(() => { sessionStorage.setItem('jf_date', dateFilter) }, [dateFilter])
  useEffect(() => { sessionStorage.setItem('jf_custom_date', customDate) }, [customDate])

  // Fetch dialog state
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['indeed', 'glassdoor', 'ziprecruiter', 'linkedin'])
  const [query, setQuery] = useState('AI, ML, Python Developer')
  const [location, setLocation] = useState('Remote')
  const [locality, setLocality] = useState(() => localStorage.getItem('job_locality') || 'us')
  const [remoteOnly, setRemoteOnly] = useState(true)
  const [limit, setLimit] = useState(10)
  const [maxAgeDays, setMaxAgeDays] = useState<number | undefined>(undefined)

  const search = useDebounce(searchInput)
  const locationFilter = useDebounce(locationInput)

  // Reset to page 1 whenever a debounced filter changes
  useEffect(() => { setPage(1) }, [search, locationFilter])

  const LOCALITY_OPTIONS = [
    { code: 'us', label: 'United States' },
    { code: 'ca', label: 'Canada' },
    { code: 'gb', label: 'United Kingdom' },
    { code: 'au', label: 'Australia' },
    { code: 'nz', label: 'New Zealand' },
    { code: 'de', label: 'Germany' },
    { code: 'fr', label: 'France' },
    { code: 'nl', label: 'Netherlands' },
    { code: 'es', label: 'Spain' },
    { code: 'in', label: 'India' },
    { code: 'sg', label: 'Singapore' },
    { code: 'ae', label: 'UAE' },
    { code: 'pk', label: 'Pakistan' },
  ]

  const PAGE_SIZE = 20

  // Resolve date filter to { date_from, date_to } params
  const resolvedDate = (() => {
    if (customDate) return { date_from: customDate, date_to: customDate }
    if (!dateFilter) return {}
    const today = new Date()
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (dateFilter === 'today') return { date_from: fmt(today), date_to: fmt(today) }
    if (dateFilter === 'yesterday') {
      const y = new Date(today); y.setDate(y.getDate() - 1)
      return { date_from: fmt(y), date_to: fmt(y) }
    }
    if (dateFilter === '2days') {
      const d = new Date(today); d.setDate(d.getDate() - 2)
      return { date_from: fmt(d), date_to: fmt(d) }
    }
    if (dateFilter === '7days') {
      const d = new Date(today); d.setDate(d.getDate() - 7)
      return { date_from: fmt(d), date_to: fmt(today) }
    }
    if (dateFilter === '30days') {
      const d = new Date(today); d.setDate(d.getDate() - 30)
      return { date_from: fmt(d), date_to: fmt(today) }
    }
    return {}
  })()

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['jobs', page, search, providerFilter, statusFilter, dateFilter, customDate, locationFilter],
    queryFn: () => jobsApi.list({
      page,
      page_size: PAGE_SIZE,
      search: search || undefined,
      provider: providerFilter || undefined,
      status: statusFilter || undefined,
      location: locationFilter || undefined,
      ...resolvedDate,
    }),
  })

  const { data: providersData } = useQuery({
    queryKey: ['providers'],
    queryFn: providersApi.list,
  })

  const [statusError, setStatusError] = useState<string | null>(null)
  const [refreshed, setRefreshed] = useState(false)
  useEffect(() => {
    if (!isFetching && refreshed) {
      const t = setTimeout(() => setRefreshed(false), 2000)
      return () => clearTimeout(t)
    }
  }, [isFetching, refreshed])

  type FetchResult = {
    message: string
    new_jobs: number
    duplicate_jobs: number
    total_fetched: number
    no_desc_dropped: number
    provider_errors: Array<{ provider: string; error_type: string; message: string }>
  }
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchMutation = useMutation({
    mutationFn: (request: Parameters<typeof providersApi.fetchJobs>[0]) => {
      abortControllerRef.current = new AbortController()
      return providersApi.fetchJobs(request, abortControllerRef.current.signal)
    },
    onSuccess: (data: any) => {
      setFetchOpen(false)
      refetch()
      setFetchResult(data)
    },
    onError: (err: any) => {
      if (err?.code === 'ERR_CANCELED') return  // user cancelled intentionally
      alert(err.response?.data?.detail || 'Failed to fetch jobs')
    },
  })

  function handleCancelFetch() {
    if (fetchMutation.isPending) {
      abortControllerRef.current?.abort()
      fetchMutation.reset()
    }
    setFetchOpen(false)
    setSaveSearchOpen(false)
  }

  const SAVE_INTERVAL_OPTIONS = [
    { value: 1, label: 'Every hour' },
    { value: 6, label: 'Every 6 hours' },
    { value: 12, label: 'Every 12 hours' },
    { value: 24, label: 'Every 24 hours' },
    { value: 48, label: 'Every 2 days' },
    { value: 168, label: 'Every week' },
  ]

  const saveSearchMutation = useMutation({
    mutationFn: savedSearchesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-searches'] })
      setSaveSearchOpen(false)
      setSaveSearchName('')
      setSaveMsg('Search saved! It will run automatically on your chosen schedule.')
      setTimeout(() => setSaveMsg(null), 5000)
    },
    onError: () => setSaveMsg('Failed to save search.'),
  })

  function handleSaveSearch() {
    if (!saveSearchName.trim()) return
    saveSearchMutation.mutate({
      name: saveSearchName.trim(),
      query,
      location,
      locality,
      providers: selectedProviders,
      remote_only: remoteOnly,
      limit,
      interval_hours: saveSearchInterval,
      is_active: true,
    })
  }

  const toggleProvider = (name: string) => {
    setSelectedProviders(prev =>
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    )
  }

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE)

  // ── Selection & bulk delete ─────────────────────────────────────────────────
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set())

  // Clear selection and exit delete mode when page or filters change
  useEffect(() => { setSelectedJobs(new Set()); setDeleteMode(false) }, [page, search, providerFilter, statusFilter, dateFilter, customDate, locationFilter])

  const currentPageIds = data?.jobs.map(j => j.id) ?? []
  const allOnPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedJobs.has(id))
  const someOnPageSelected = currentPageIds.some(id => selectedJobs.has(id))

  function toggleSelectAll() {
    if (allOnPageSelected) {
      setSelectedJobs(prev => { const s = new Set(prev); currentPageIds.forEach(id => s.delete(id)); return s })
    } else {
      setSelectedJobs(prev => new Set([...prev, ...currentPageIds]))
    }
  }

  function toggleJob(id: number) {
    setSelectedJobs(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => ids.length === 1 ? jobsApi.delete(ids[0]).then(() => {}) : jobsApi.deleteMultiple(ids),
    onSuccess: () => {
      setSelectedJobs(new Set())
      setDeleteMode(false)
      qc.invalidateQueries({ queryKey: ['jobs'] })
      qc.invalidateQueries({ queryKey: ['dashboardStats'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
    },
    onError: () => {
      setStatusError('Failed to delete jobs. Please try again.')
      setTimeout(() => setStatusError(null), 3000)
    },
  })

  function handleDeleteSelected() {
    const ids = [...selectedJobs]
    if (!window.confirm(`Delete ${ids.length} job${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return
    deleteMutation.mutate(ids)
  }

  const errorTypeIcon: Record<string, string> = {
    rate_limit: '⏱',
    auth: '🔑',
    timeout: '🔌',
    unknown: '⚠️',
  }

  return (
    <div className="space-y-6">
      {/* Save search success banner */}
      {saveMsg && (
        <div className="rounded-xl border px-4 py-3 flex items-center justify-between" style={{ borderColor: 'rgba(125,194,66,0.3)', background: 'rgba(125,194,66,0.1)' }}>
          <p className="text-sm text-green-300">🔔 {saveMsg}</p>
          <button onClick={() => setSaveMsg(null)} className="text-gray-500 hover:text-gray-300 text-base leading-none">✕</button>
        </div>
      )}

      {/* Fetch result banner */}
      {fetchResult && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-brand-md)', background: 'var(--code-bg)' }}>
          {/* Success row */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ background: 'rgba(125,194,66,0.1)', borderColor: 'var(--border-brand-md)' }}>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm font-semibold text-green-300">
                ✅ {fetchResult.new_jobs} new jobs added
                {fetchResult.duplicate_jobs > 0 && (
                  <span className="font-normal text-green-400/70"> · {fetchResult.duplicate_jobs} already existed</span>
                )}
              </p>
              {fetchResult.no_desc_dropped > 0 && (
                <span className="text-orange-400 text-sm">
                  {fetchResult.no_desc_dropped} dropped (no description)
                </span>
              )}
            </div>
            <button onClick={() => setFetchResult(null)} className="text-gray-500 hover:text-gray-300 text-base leading-none">✕</button>
          </div>

          {/* Per-provider errors */}
          {fetchResult.provider_errors?.length > 0 && (
            <div className="divide-y divide-white/5">
              {fetchResult.provider_errors.map((pe) => (
                <div key={pe.provider} className="px-4 py-3 flex items-start gap-3">
                  <span className="text-base flex-shrink-0 mt-0.5">{errorTypeIcon[pe.error_type] ?? '⚠️'}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-200 capitalize">{pe.provider}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{pe.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status update error toast */}
      {statusError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg border" style={{ background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>
          {statusError}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          <p className="text-gray-400 text-sm mt-1">
            {data?.total ?? 0} jobs found
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setRefreshed(true); refetch() }}
            disabled={isFetching}
            className="btn-secondary disabled:opacity-60"
          >
            {refreshed && !isFetching ? (
              <>
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span style={{ color: '#7DC242' }}>Done</span>
              </>
            ) : (
              <>
                <svg
                  className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isFetching ? 'Refreshing…' : 'Refresh'}
              </>
            )}
          </button>
          <button
            onClick={() => { setDeleteMode(d => !d); setSelectedJobs(new Set()) }}
            className={`btn-secondary transition-colors ${deleteMode ? 'border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {deleteMode ? 'Cancel' : 'Delete'}
          </button>
          <button onClick={() => setFetchOpen(true)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Fetch Jobs
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search title, company..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="input pl-9"
            />
          </div>
          <div className="relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <input
              type="text"
              placeholder="Filter by location..."
              value={locationInput}
              onChange={e => setLocationInput(e.target.value)}
              className="input pl-9"
            />
          </div>
          <CustomSelect
            value={providerFilter}
            onChange={v => { setProviderFilter(v); setPage(1) }}
            options={[
              { value: '', label: 'All Providers' },
              ...(providersData?.providers ?? []).map(p => ({ value: p.name, label: p.display_name })),
            ]}
            className="w-full"
          />
          <CustomSelect
            value={statusFilter}
            onChange={v => { setStatusFilter(v); setPage(1) }}
            options={[
              { value: '', label: 'All Statuses' },
              ...ALL_STATUSES.map(s => ({ value: s, label: s })),
            ]}
            className="w-full"
          />
        </div>

        {/* Date filter row */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-muted)' }}>
          <span className="text-xs font-medium text-gray-400 mr-1">
            <svg className="w-3.5 h-3.5 inline -mt-0.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Fetched:
          </span>
          {[
            { key: '', label: 'All Time' },
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: '2days', label: '2 Days Ago' },
            { key: '7days', label: 'Last 7 Days' },
            { key: '30days', label: 'Last 30 Days' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => { setDateFilter(opt.key); setCustomDate(''); setPage(1) }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                dateFilter === opt.key && !customDate
                  ? 'bg-[#7DC242]/20 text-[#7DC242] border border-[#7DC242]/40'
                  : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10 hover:text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <div className="h-4 w-px bg-white/10 mx-1" />
          <input
            type="date"
            value={customDate}
            onChange={e => { setCustomDate(e.target.value); setDateFilter(''); setPage(1) }}
            className="input text-xs px-2 py-1 w-36"
            style={{ colorScheme: isDark ? 'dark' : 'light' }}
          />
          {(dateFilter || customDate) && (
            <button
              onClick={() => { setDateFilter(''); setCustomDate(''); setPage(1) }}
              className="text-xs text-gray-500 hover:text-red-400 ml-1"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Selection toolbar */}
      {deleteMode && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}>
          <span className="text-sm font-medium" style={{ color: selectedJobs.size > 0 ? '#fca5a5' : '#9ca3af' }}>
            {selectedJobs.size > 0 ? `${selectedJobs.size} job${selectedJobs.size > 1 ? 's' : ''} selected` : 'Select jobs to delete'}
          </span>
          <div className="flex items-center gap-3">
            {selectedJobs.size > 0 && (
              <button onClick={() => setSelectedJobs(new Set())} className="text-xs text-gray-400 hover:text-gray-200">
                Clear selection
              </button>
            )}
            <button
              onClick={handleDeleteSelected}
              disabled={selectedJobs.size === 0 || deleteMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
              style={{ background: 'rgba(239,68,68,0.7)' }}
            >
              {deleteMutation.isPending ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              {selectedJobs.size > 0 ? `Delete ${selectedJobs.size} job${selectedJobs.size > 1 ? 's' : ''}` : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--code-bg)', borderColor: 'var(--border-brand)' }}>
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7DC242', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'rgba(125,194,66,0.1)', background: 'var(--bg-surface-alt)' }}>
                    {deleteMode && (
                      <th className="px-4 py-3 w-10" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={allOnPageSelected}
                          ref={el => { if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected }}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded cursor-pointer accent-[#7DC242]"
                        />
                      </th>
                    )}
                    <th className="text-left px-5 py-3 font-semibold text-gray-400">Job Title</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-400">Company</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-400 hidden md:table-cell">Location</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-400 hidden lg:table-cell">Provider</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-400">Status</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-400 hidden xl:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const jobs = [...(data?.jobs ?? [])]
                    const colSpan = deleteMode ? 7 : 6

                    // Sort by posted_date descending (nulls last), then group
                    jobs.sort((a, b) => {
                      if (!a.posted_date && !b.posted_date) return 0
                      if (!a.posted_date) return 1
                      if (!b.posted_date) return -1
                      return b.posted_date.localeCompare(a.posted_date)
                    })

                    const groups: { label: string; jobs: typeof jobs }[] = []
                    for (const job of jobs) {
                      const label = getDateLabel(job.posted_date)
                      if (!groups.length || groups[groups.length - 1].label !== label) {
                        groups.push({ label, jobs: [job] })
                      } else {
                        groups[groups.length - 1].jobs.push(job)
                      }
                    }

                    return groups.map(({ label, jobs: groupJobs }) => (
                      <>
                        {/* Slack-style date separator */}
                        <tr key={`sep-${label}`}>
                          <td colSpan={colSpan} className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
                              <span
                                className="px-3 py-0.5 rounded-full text-xs font-medium whitespace-nowrap border"
                                style={{ color: '#7DC242', borderColor: 'rgba(125,194,66,0.4)', background: 'rgba(125,194,66,0.08)' }}
                              >
                                {label}
                              </span>
                              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
                            </div>
                          </td>
                        </tr>

                        {/* Jobs in this group */}
                        {groupJobs.map((job, i) => (
                          <tr
                            key={job.id}
                            onClick={() => deleteMode && toggleJob(job.id)}
                            className={`transition-colors ${deleteMode ? 'cursor-pointer hover:bg-red-500/5' : 'cursor-pointer hover:bg-white/[0.04]'} ${selectedJobs.has(job.id) ? 'bg-red-500/10' : ''}`}
                            style={{ borderBottom: i < groupJobs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                          >
                            {deleteMode && (
                              <td className="px-4 py-4 w-10" onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedJobs.has(job.id)}
                                  onChange={() => toggleJob(job.id)}
                                  className="w-4 h-4 rounded cursor-pointer accent-[#7DC242]"
                                />
                              </td>
                            )}
                            <td className="px-5 py-4" onClick={() => !deleteMode && navigate(`/jobs/${job.id}`)}>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-100 truncate max-w-xs">{job.title}</p>
                                {!job.description && (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                    No Desc
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-gray-300 truncate max-w-[160px]" onClick={() => !deleteMode && navigate(`/jobs/${job.id}`)}>{job.company}</td>
                            <td className="px-5 py-4 text-gray-400 hidden md:table-cell truncate max-w-[140px]" onClick={() => !deleteMode && navigate(`/jobs/${job.id}`)}>{job.location || '—'}</td>
                            <td className="px-5 py-4 hidden lg:table-cell" onClick={() => !deleteMode && navigate(`/jobs/${job.id}`)}>
                              <span className="capitalize text-gray-400">{job.provider}</span>
                            </td>
                            <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                              <CustomSelect
                                value={job.status}
                                onChange={async newStatus => {
                                  try {
                                    await jobsApi.update(job.id, { status: newStatus as any })
                                    qc.invalidateQueries({ queryKey: ['jobs'] })
                                    qc.invalidateQueries({ queryKey: ['dashboardStats'] })
                                    qc.invalidateQueries({ queryKey: ['summary'] })
                                  } catch {
                                    setStatusError('Failed to update status. Please try again.')
                                    setTimeout(() => setStatusError(null), 3000)
                                  }
                                }}
                                options={ALL_STATUSES.map(s => ({ value: s, label: s }))}
                                triggerClassName={`text-xs font-semibold px-2 py-1 rounded-lg cursor-pointer ${statusColors[job.status] ?? 'bg-gray-500/20 text-gray-400'}`}
                              />
                            </td>
                            <td className="px-5 py-4 text-gray-400 text-xs hidden xl:table-cell" onClick={() => !deleteMode && navigate(`/jobs/${job.id}`)}>
                              {job.posted_date ? new Date(job.posted_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </>
                    ))
                  })()}
                  {!data?.jobs.length && (
                    <tr>
                      <td colSpan={deleteMode ? 7 : 6} className="px-5 py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-gray-400">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <p className="text-sm">No jobs found. Fetch some jobs to get started!</p>
                          <button onClick={() => setFetchOpen(true)} className="btn-primary mt-2">Fetch Jobs</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t flex items-center justify-between text-sm text-gray-400" style={{ borderColor: 'var(--border-brand)' }}>
                <span>Page {page} of {totalPages} ({data?.total} total)</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary py-1 px-3 disabled:opacity-40"
                  >← Prev</button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-secondary py-1 px-3 disabled:opacity-40"
                  >Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Fetch Jobs Modal */}
      <Modal open={fetchOpen} onClose={handleCancelFetch}>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-white mb-5">Fetch Jobs from Providers</h2>

          {/* Provider selection */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Providers</label>
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedProviders(
                    (providersData?.providers ?? []).filter(p => p.name !== 'jsearch').map(p => p.name)
                  )}
                  className="text-green-400 hover:text-green-300 font-medium"
                >Select all</button>
                <span className="text-gray-600">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedProviders([])}
                  className="text-gray-500 hover:text-gray-300"
                >Clear</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(providersData?.providers ?? [])
                .filter(p => p.name !== 'jsearch')
                .map(p => {
                  const meta = PROVIDER_META[p.name]
                  const selected = selectedProviders.includes(p.name)
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => toggleProvider(p.name)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left w-full ${
                        selected
                          ? (meta?.activeCls ?? 'border-gray-500/50 bg-gray-500/15 text-gray-300')
                          : 'border-white/10 bg-white/[0.03] text-gray-500 hover:border-white/20 hover:text-gray-300'
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        selected ? (meta?.iconCls ?? 'bg-gray-500/25 text-gray-300') : 'bg-white/5 text-gray-500'
                      }`}>
                        {meta?.abbr ?? p.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-sm font-medium">{meta?.label ?? p.display_name}</span>
                      {selected && <span className="ml-auto text-xs">✓</span>}
                    </button>
                  )
                })}
            </div>
            {selectedProviders.length === 0 && (
              <p className="text-xs text-red-500 mt-1">Select at least one provider</p>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Job Title / Keywords</label>
              <input type="text" value={query} onChange={e => setQuery(e.target.value)} className="input" placeholder="e.g. AI, ML, Python Developer" />
              <p className="text-xs text-gray-400 mt-1">Separate with commas for multi-keyword search</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Country
                </label>
                <CustomSelect
                  value={locality}
                  onChange={v => { setLocality(v); localStorage.setItem('job_locality', v) }}
                  options={LOCALITY_OPTIONS.map(opt => ({ value: opt.code, label: opt.label, badge: opt.code.toUpperCase() }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  City / Region
                  <span className="ml-1 text-xs text-gray-500 font-normal">(optional)</span>
                </label>
                <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="input" placeholder="e.g. Toronto, Remote" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Limit (per provider)
                <span className="ml-1 text-xs text-gray-500 font-normal">max 100</span>
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={limit}
                onChange={e => setLimit(Math.min(100, Math.max(1, Number(e.target.value))))}
                className="input"
              />
              {selectedProviders.includes('linkedin') && limit > 25 && (
                <p className="text-xs text-amber-600 mt-1">
                  LinkedIn API may return fewer than {limit} — actual results depend on available listings.
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-sm text-gray-300">Remote jobs only</span>
            </label>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Posted within
              </label>
              <CustomSelect
                value={String(maxAgeDays ?? '')}
                onChange={v => setMaxAgeDays(v === '' ? undefined : Number(v))}
                className="w-full"
                options={[
                  { value: '', label: 'Any time' },
                  { value: '1', label: 'Today (1 day)' },
                  { value: '2', label: 'Past 2 days' },
                  { value: '3', label: 'Past 3 days' },
                  { value: '4', label: 'Past 4 days' },
                  { value: '5', label: 'Past 5 days' },
                  { value: '6', label: 'Past 6 days' },
                  { value: '7', label: 'Past 1 week' },
                  { value: '10', label: 'Past 10 days' },
                  { value: '14', label: 'Past 2 weeks' },
                ]}
              />
            </div>
          </div>
        </div>
        {/* Save search inline panel */}
        {saveSearchOpen && (
          <div className="mx-6 mb-4 p-4 rounded-xl space-y-3 border" style={{ background: 'rgba(125,194,66,0.08)', borderColor: 'rgba(125,194,66,0.2)' }}>
            <p className="text-sm font-medium text-green-300">Save this search configuration</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Search name</label>
                <input
                  autoFocus
                  value={saveSearchName}
                  onChange={e => setSaveSearchName(e.target.value)}
                  placeholder='e.g. "WP Dev – Pakistan"'
                  className="input text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleSaveSearch()}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Auto-run frequency</label>
                <CustomSelect
                  value={String(saveSearchInterval)}
                  onChange={v => setSaveSearchInterval(Number(v))}
                  options={SAVE_INTERVAL_OPTIONS.map(o => ({ value: String(o.value), label: o.label }))}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setSaveSearchOpen(false)} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1">
                Cancel
              </button>
              <button
                onClick={handleSaveSearch}
                disabled={saveSearchMutation.isPending || !saveSearchName.trim()}
                className="px-3 py-1.5 text-xs text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #7DC242, #4CAF50)' }}
              >
                {saveSearchMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          <button
            onClick={() => { setSaveSearchOpen(s => !s) }}
            className="text-sm font-medium flex items-center gap-1" style={{ color: '#7DC242' }}
          >
            🔔 Save this search
          </button>
          <div className="flex gap-3">
            <button onClick={handleCancelFetch} className="btn-secondary">
              {fetchMutation.isPending ? 'Cancel Fetch' : 'Cancel'}
            </button>
            <button
              onClick={() => fetchMutation.mutate({ providers: selectedProviders, query, location, locality, remote_only: remoteOnly, limit, max_age_days: maxAgeDays })}
              disabled={fetchMutation.isPending || selectedProviders.length === 0}
              className="btn-primary"
            >
              {fetchMutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Fetching...
                </>
              ) : 'Fetch Jobs'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
