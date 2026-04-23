import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { statsApi, jobsApi } from '@/services/api'
import { PIPELINE_STAGES, ApplicationStatus } from '@/types'
import type { Job } from '@/types'

const statusColors: Record<string, { bg: string; text: string }> = {
  DISCOVERED: { bg: 'bg-slate-500/20', text: 'text-slate-300' },
  BOOKMARKED: { bg: 'bg-amber-500/20', text: 'text-amber-300' },
  APPLIED:    { bg: 'bg-green-500/20', text: 'text-green-300' },
  SCREENING:  { bg: 'bg-blue-500/20', text: 'text-blue-300' },
  INTERVIEW:  { bg: 'bg-violet-500/20', text: 'text-violet-300' },
  OFFERED:    { bg: 'bg-emerald-500/20', text: 'text-emerald-300' },
  HIRED:      { bg: 'bg-green-500/30', text: 'text-green-200' },
  REJECTED:   { bg: 'bg-red-500/20', text: 'text-red-300' },
  CLOSED:     { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  SKIPPED:    { bg: 'bg-gray-500/15', text: 'text-gray-500' },
}

const providerColors: Record<string, string> = {
  indeed:       'bg-blue-500',
  glassdoor:    'bg-green-500',
  ziprecruiter: 'bg-purple-500',
  linkedin:     'bg-sky-500',
}

const providerIcons: Record<string, { color: string; label: string }> = {
  indeed:       { color: '#6366f1', label: 'IN' },
  glassdoor:    { color: '#22c55e', label: 'GD' },
  ziprecruiter: { color: '#a855f7', label: 'ZR' },
  linkedin:     { color: '#0ea5e9', label: 'LI' },
}

type FeedTab = 'all' | 'recent' | 'bookmarked' | 'applied' | 'interviews'

const FEED_TABS: { key: FeedTab; label: string; icon: string }[] = [
  { key: 'all',        label: 'All Jobs',    icon: '📋' },
  { key: 'recent',     label: 'Most Recent', icon: '🕐' },
  { key: 'bookmarked', label: 'Bookmarked',  icon: '⭐' },
  { key: 'applied',    label: 'Applied',     icon: '✅' },
  { key: 'interviews', label: 'Interviews',  icon: '🎯' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatSalary(min: number | null, max: number | null, _currency: string = 'USD'): string | null {
  if (!min && !max) return null
  const fmt = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`)
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `From ${fmt(min)}`
  return `Up to ${fmt(max!)}`
}

function truncateText(text: string | null, maxLen: number = 200): string {
  if (!text) return ''
  const clean = text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLen) return clean
  return clean.slice(0, maxLen).trim() + '…'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7DC242', borderTopColor: 'transparent' }} />
    </div>
  )
}

function StatCard({ label, value, sub, gradient }: {
  label: string; value: number | string; sub?: string; gradient: string
}) {
  return (
    <div className="card relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -mr-6 -mt-6" style={{ background: gradient }} />
      <p className="text-sm text-gray-400 font-medium">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

/* ── Timeline Job Card (Upwork-style) ──────────────────────────────────────── */

function JobFeedCard({ job, onStatusChange }: {
  job: Job
  onStatusChange: (id: number, status: ApplicationStatus) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const sc = statusColors[job.status] ?? statusColors.DISCOVERED
  const provider = providerIcons[job.provider] ?? { color: '#6b7280', label: job.provider.slice(0, 2).toUpperCase() }
  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_currency)

  return (
    <div
      className="group relative transition-all duration-200"
      style={{
        background: 'var(--bg-surface-alt)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Left accent line on hover */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 transition-all duration-300 opacity-0 group-hover:opacity-100"
        style={{ background: 'linear-gradient(180deg, #7DC242, #4CAF50)' }}
      />

      <div className="px-6 py-5">
        {/* Top row: Time + Status + Actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: provider.color }}
              title={job.provider}
            >
              {provider.label}
            </div>
            <span className="text-xs text-gray-500">
              Posted {timeAgo(job.posted_date || job.created_at)}
            </span>
            {job.easy_apply && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                ⚡ Easy Apply
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${sc.bg} ${sc.text}`}>
              {job.status}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3
          className="text-base font-semibold text-gray-100 hover:text-green-400 cursor-pointer transition-colors leading-tight mb-1"
          onClick={() => navigate(`/jobs/${job.id}`)}
        >
          {job.title}
        </h3>

        {/* Company + Location */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
          <span className="font-medium text-gray-300">{job.company}</span>
          {job.location && (
            <>
              <span className="text-gray-600">•</span>
              <span>{job.location}</span>
            </>
          )}
        </div>

        {/* Meta chips row */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {salary && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/15">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {salary}
            </span>
          )}
          {job.job_type && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/15">
              {job.job_type}
            </span>
          )}
          {job.remote_type && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/15">
              {job.remote_type === 'remote' ? '🏠 Remote' : job.remote_type === 'hybrid' ? '🏢 Hybrid' : '📍 On-site'}
            </span>
          )}
          <span className="text-xs font-medium px-2.5 py-1 rounded-lg capitalize" style={{ background: `${provider.color}15`, color: provider.color, border: `1px solid ${provider.color}25` }}>
            {job.provider}
          </span>
        </div>

        {/* Description snippet */}
        {job.description && (
          <div className="mb-3">
            <p className="text-sm text-gray-400 leading-relaxed">
              {expanded ? truncateText(job.description, 600) : truncateText(job.description, 180)}
              {job.description.length > 180 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="ml-1 text-green-400 hover:text-green-300 font-medium text-xs"
                >
                  {expanded ? 'less' : 'more'}
                </button>
              )}
            </p>
          </div>
        )}

        {/* Action buttons row */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => navigate(`/jobs/${job.id}`)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all text-gray-400 hover:text-white"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-muted)' }}
          >
            View Details →
          </button>

          {job.status === ApplicationStatus.DISCOVERED && (
            <>
              <button
                onClick={() => onStatusChange(job.id, ApplicationStatus.BOOKMARKED)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all text-amber-400 hover:text-amber-300"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}
              >
                ⭐ Bookmark
              </button>
              <button
                onClick={() => onStatusChange(job.id, ApplicationStatus.SKIPPED)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all text-gray-500 hover:text-gray-300"
                style={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border-subtle)' }}
              >
                Skip
              </button>
            </>
          )}

          {job.status === ApplicationStatus.BOOKMARKED && (
            <button
              onClick={() => onStatusChange(job.id, ApplicationStatus.APPLIED)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all text-green-400 hover:text-green-300"
              style={{ background: 'rgba(125,194,66,0.08)', border: '1px solid rgba(125,194,66,0.15)' }}
            >
              ✓ Mark Applied
            </button>
          )}

          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg transition-all text-gray-500 hover:text-gray-300"
              style={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border-subtle)' }}
            >
              Open ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<FeedTab>('all')
  const [feedPage, setFeedPage] = useState(1)
  const FEED_PAGE_SIZE = 15

  const { data: stats, isLoading: l1 } = useQuery({ queryKey: ['dashboardStats'], queryFn: statsApi.dashboard })
  const { data: summary, isLoading: l2 } = useQuery({ queryKey: ['summary'], queryFn: statsApi.summary })

  const feedStatus = useMemo(() => {
    switch (activeTab) {
      case 'bookmarked': return ApplicationStatus.BOOKMARKED
      case 'applied': return ApplicationStatus.APPLIED
      case 'interviews': return ApplicationStatus.INTERVIEW
      default: return undefined
    }
  }, [activeTab])

  const { data: feedData, isLoading: feedLoading } = useQuery({
    queryKey: ['dashboardFeed', activeTab, feedPage],
    queryFn: () => jobsApi.list({
      page: feedPage,
      page_size: FEED_PAGE_SIZE,
      status: feedStatus,
      today_only: activeTab === 'recent',
    }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ApplicationStatus }) =>
      jobsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardFeed'] })
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
    },
  })

  const handleStatusChange = (id: number, status: ApplicationStatus) => {
    statusMutation.mutate({ id, status })
  }

  if (l1 || l2) return <Spinner />

  const pipelineCounts = PIPELINE_STAGES.map(stage => ({
    stage,
    count: stats?.jobs_by_status?.[stage] ?? 0,
  }))
  const maxPipelineCount = Math.max(...pipelineCounts.map(p => p.count), 1)

  const feedJobs = feedData?.jobs ?? []
  const totalFeedJobs = feedData?.total ?? 0
  const totalPages = Math.ceil(totalFeedJobs / FEED_PAGE_SIZE)

  const tabCounts: Record<FeedTab, number> = {
    all: summary?.total_jobs ?? 0,
    recent: stats?.jobs_fetched_today ?? 0,
    bookmarked: stats?.jobs_by_status?.[ApplicationStatus.BOOKMARKED] ?? 0,
    applied: stats?.jobs_by_status?.[ApplicationStatus.APPLIED] ?? 0,
    interviews: stats?.jobs_by_status?.[ApplicationStatus.INTERVIEW] ?? 0,
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Pipeline overview &amp; job discovery feed</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Jobs" value={summary?.total_jobs ?? 0} gradient="linear-gradient(135deg, #7DC242, #4CAF50)" />
        <StatCard label="Discovered" value={summary?.discovered ?? 0} gradient="linear-gradient(135deg, #64748b, #334155)" />
        <StatCard label="Applied" value={summary?.applied ?? 0} gradient="linear-gradient(135deg, #7DC242, #4CAF50)" />
        <StatCard label="Interview" value={summary?.interview ?? 0} gradient="linear-gradient(135deg, #8b5cf6, #6d28d9)" />
        <StatCard label="Offered" value={summary?.offered ?? 0} gradient="linear-gradient(135deg, #10b981, #059669)" />
        <StatCard label="Hired" value={summary?.hired ?? 0} gradient="linear-gradient(135deg, #22c55e, #16a34a)" />
      </div>

      {/* Two-column layout: Feed + Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

        {/* ── Left: Job Feed (Upwork-style) ────────────────────────────────── */}
        <div className="xl:col-span-3">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white mb-1">Jobs you might like</h2>
            <p className="text-xs text-gray-500">
              Browse discovered jobs from all providers. Bookmark the ones you like, skip the rest.
            </p>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {FEED_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setFeedPage(1) }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all rounded-t-lg ${
                  activeTab === tab.key ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'
                }`}
                style={activeTab === tab.key ? { background: 'rgba(125,194,66,0.08)', borderBottom: '2px solid #7DC242' } : {}}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tabCounts[tab.key] > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key ? 'bg-green-500/20 text-green-300' : 'bg-white/5 text-gray-500'
                  }`}>
                    {tabCounts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Feed content */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-surface-alt)', border: '1px solid rgba(125,194,66,0.06)' }}
          >
            {feedLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7DC242', borderTopColor: 'transparent' }} />
                <span className="ml-3 text-sm text-gray-500">Loading jobs…</span>
              </div>
            ) : feedJobs.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-gray-400 font-medium">No jobs found</p>
                <p className="text-gray-600 text-sm mt-1">Try fetching new jobs from the Jobs page</p>
              </div>
            ) : (
              <>
                {feedJobs.map((job) => (
                  <JobFeedCard key={job.id} job={job} onStatusChange={handleStatusChange} />
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <p className="text-xs text-gray-500">
                      Showing {(feedPage - 1) * FEED_PAGE_SIZE + 1}–{Math.min(feedPage * FEED_PAGE_SIZE, totalFeedJobs)} of {totalFeedJobs} jobs
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setFeedPage(p => Math.max(1, p - 1))}
                        disabled={feedPage === 1}
                        className="text-xs px-3 py-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-muted)' }}
                      >
                        ← Prev
                      </button>
                      <span className="text-xs text-gray-500">{feedPage} / {totalPages}</span>
                      <button
                        onClick={() => setFeedPage(p => Math.min(totalPages, p + 1))}
                        disabled={feedPage === totalPages}
                        className="text-xs px-3 py-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-muted)' }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Right Sidebar ────────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Application Pipeline (compact) */}
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-4">Application Pipeline</h2>
            <div className="space-y-2.5">
              {pipelineCounts.map(({ stage, count }) => {
                const sc = statusColors[stage] ?? statusColors.DISCOVERED
                const widthPct = Math.max(count / maxPipelineCount * 100, 4)
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className={`text-[10px] font-semibold w-20 text-right ${sc.text}`}>{stage}</span>
                    <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden relative">
                      <div
                        className={`h-full rounded ${sc.bg} flex items-center justify-end pr-2 transition-all duration-700`}
                        style={{ width: `${widthPct}%`, minWidth: count > 0 ? '28px' : '0' }}
                      >
                        <span className={`text-[10px] font-bold ${sc.text}`}>{count}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-3">
              {(['REJECTED', 'CLOSED', 'SKIPPED'] as ApplicationStatus[]).map(status => {
                const sc = statusColors[status] ?? statusColors.CLOSED
                return (
                  <div key={status} className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${sc.bg} ${sc.text}`}>{status}</span>
                    <span className="text-xs font-bold text-gray-300">{stats?.jobs_by_status?.[status] ?? 0}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Jobs by Provider */}
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-4">By Provider</h2>
            <div className="space-y-3">
              {stats?.jobs_by_provider && Object.entries(stats.jobs_by_provider).length > 0
                ? Object.entries(stats.jobs_by_provider).map(([prov, count]) => (
                  <div key={prov} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${providerColors[prov] ?? 'bg-gray-400'}`} />
                    <span className="flex-1 capitalize text-sm text-gray-300">{prov}</span>
                    <span className="text-sm font-bold text-white">{count as number}</span>
                  </div>
                ))
                : <p className="text-gray-500 text-sm">No data yet</p>
              }
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-4">Quick Stats</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)' }}>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  <span className="text-xs font-medium text-indigo-300">Remote</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-indigo-200">{summary?.remote_jobs ?? 0}</p>
                  <p className="text-[10px] text-indigo-400">{summary?.remote_percentage ?? 0}%</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(249,115,22,0.1)' }}>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs font-medium text-orange-300">Today</span>
                </div>
                <p className="text-sm font-bold text-orange-200">{stats?.jobs_fetched_today ?? 0}</p>
              </div>
              {summary?.avg_salary_min && summary?.avg_salary_max && (
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium text-emerald-300">Avg Salary</span>
                  </div>
                  <p className="text-xs font-bold text-emerald-200">
                    {formatSalary(summary.avg_salary_min, summary.avg_salary_max)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
