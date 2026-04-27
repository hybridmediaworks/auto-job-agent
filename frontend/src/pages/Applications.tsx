import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tailorApi } from '@/services/api'
import type { ApplicationHistoryItem, TailoredApplication } from '@/services/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return iso
  }
}

const TEMPLATE_NAMES: Record<number, string> = {
  1: 'Classic',
  2: 'Two-Column',
  3: 'Creative',
  4: 'Modern',
}

// ── Materials modal ───────────────────────────────────────────────────────────

function MaterialsModal({
  item,
  onClose,
}: {
  item: ApplicationHistoryItem
  onClose: () => void
}) {
  const [tab, setTab] = useState<'resume' | 'cover'>('resume')

  const { data, isLoading, isError } = useQuery<TailoredApplication | null>({
    queryKey: ['tailoring', item.job_id],
    queryFn: () => tailorApi.getLast(item.job_id),
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-muted)' }}>
          <div>
            <h2 className="font-semibold text-white text-base">{item.job_title}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{item.company} · Tailored {formatDate(item.tailored_at)}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-faint)' }} className="hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex px-5 pt-3 gap-2" style={{ borderBottom: '1px solid var(--border-muted)' }}>
          {(['resume', 'cover'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors"
              style={tab === t
                ? { color: '#7DC242', borderBottom: '2px solid #7DC242', marginBottom: '-1px' }
                : { color: 'var(--text-muted)', borderBottom: '2px solid transparent', marginBottom: '-1px' }}
            >
              {t === 'resume' ? 'Resume' : 'Cover Letter'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(125,194,66,0.3)', borderTopColor: '#7DC242' }} />
            </div>
          )}
          {isError && (
            <p className="text-sm text-center py-8" style={{ color: '#f87171' }}>Failed to load materials.</p>
          )}
          {data && (
            <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {tab === 'resume' ? (data.tailored_resume_text || 'No resume text available.') : (data.cover_letter || 'No cover letter available.')}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Applications() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<ApplicationHistoryItem | null>(null)
  
  // Selection and Bulk Delete state
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set())

  const { data: history, isLoading, isError, refetch } = useQuery<ApplicationHistoryItem[]>({
    queryKey: ['application-history'],
    queryFn: tailorApi.getHistory,
  })

  const currentPageIds = history?.map(j => j.job_id) ?? []
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
    mutationFn: (ids: number[]) => tailorApi.deleteHistory(ids),
    onSuccess: () => {
      setSelectedJobs(new Set())
      setDeleteMode(false)
      qc.invalidateQueries({ queryKey: ['application-history'] })
    },
    onError: () => {
      alert('Failed to delete applications. Please try again.')
    },
  })

  function handleDeleteSelected() {
    const ids = [...selectedJobs]
    if (!window.confirm(`Delete ${ids.length} application${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return
    deleteMutation.mutate(ids)
  }

  return (
    <div className="space-y-6">
      {/* Page header and toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Application History</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            All jobs with a tailored resume and cover letter.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setDeleteMode(d => !d); setSelectedJobs(new Set()) }}
            className={`btn-secondary transition-colors ${deleteMode ? 'border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {deleteMode ? 'Cancel' : 'Delete'}
          </button>
        </div>
      </div>
      
      {/* Selection toolbar */}
      {deleteMode && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}>
          <span className="text-sm font-medium" style={{ color: selectedJobs.size > 0 ? '#fca5a5' : '#9ca3af' }}>
            {selectedJobs.size > 0 ? `${selectedJobs.size} application${selectedJobs.size > 1 ? 's' : ''} selected` : 'Select applications to delete'}
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
              {selectedJobs.size > 0 ? `Delete ${selectedJobs.size}` : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="card overflow-hidden p-0">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(125,194,66,0.3)', borderTopColor: '#7DC242' }} />
          </div>
        )}

        {isError && (
          <p className="text-sm text-center py-12" style={{ color: '#f87171' }}>Failed to load application history.</p>
        )}

        {!isLoading && !isError && (!history || history.length === 0) && (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium text-white">No applications yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Open a job and generate a tailored resume to see it here.</p>
          </div>
        )}

        {!isLoading && !isError && history && history.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
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
                {['Job Title', 'Company', 'Provider', 'Date Tailored', 'Template', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)', background: 'var(--bg-surface-hover)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((item, i) => (
                <tr
                  key={item.job_id}
                  onClick={() => deleteMode && toggleJob(item.job_id)}
                  style={{
                    borderBottom: i < history.length - 1 ? '1px solid var(--border-muted)' : 'none',
                  }}
                  className={`transition-colors ${deleteMode ? 'cursor-pointer hover:bg-red-500/5' : 'hover:bg-white/[0.02]'} ${selectedJobs.has(item.job_id) ? 'bg-red-500/10' : ''}`}
                >
                  {deleteMode && (
                    <td className="px-4 py-4 w-10" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedJobs.has(item.job_id)}
                        onChange={() => toggleJob(item.job_id)}
                        className="w-4 h-4 rounded cursor-pointer accent-[#7DC242]"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-white max-w-[200px] truncate">{item.job_title}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{item.company}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ background: 'rgba(125,194,66,0.1)', color: '#7DC242', border: '1px solid rgba(125,194,66,0.2)' }}>
                      {item.provider || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatDate(item.tailored_at)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-faint)' }}>
                    {item.template_id ? TEMPLATE_NAMES[item.template_id] ?? `Template ${item.template_id}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {!deleteMode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelected(item) }}
                        className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                        style={{ background: 'rgba(125,194,66,0.1)', color: '#7DC242', border: '1px solid rgba(125,194,66,0.25)' }}
                      >
                        View Materials
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Materials modal */}
      {selected && <MaterialsModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
