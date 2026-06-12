import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { tailorApi } from '@/services/api'
import type { ApplicationHistoryItem, ApplicationHistoryPage } from '@/services/api'

const PAGE_SIZE = 25
import type { TailoredApplication } from '@/types'
import { RidaTemplate, WaleedTemplate, ArhamTemplate, SherazTemplate, WaqarTemplate, AdeelTemplate, WaleedV2Template, AdeelV2Template } from '@/components/ResumeTemplates'
import { onePageFitScript } from '@/utils/onePageFit'

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
  1: 'Rida Saeed',
  2: 'Waleed',
  3: 'Arham Saeed',
  4: 'Sheraz Khalid',
  5: 'Muhammad Waqar',
  6: 'Adeel Shahzad',
  7: 'Mirza Waleed',
  8: 'Adeel V2',
}

function openPdfPrintWindow(html: string, name: string, jobTitle: string, onePage = false) {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('Popup blocked — please allow popups for this site.'); return }
  const safeName = name.replace(/\s+/g, '_')
  const safeJob = jobTitle.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeName}_${safeJob}</title>
<link href="https://fonts.googleapis.com/css2?family=Bitter:wght@400;700&family=Montserrat:wght@300;400;500;600;700;900&family=Open+Sans:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box}@page{size:A4 portrait;margin:10mm 0}@page :first{margin-top:0;margin-bottom:10mm}html,body{margin:0;padding:0;background:white}</style>
</head><body><div id="__fit" style="transform-origin:top left">${html}</div><script>window.onload=function(){setTimeout(function(){${onePageFitScript(onePage)}window.print()},800)}<\/script></body></html>`)
  win.document.close()
}

function downloadTextFile(text: string, jobTitle: string, company: string) {
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `resume_${jobTitle}_${company}.txt`.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '')
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Resume modal ──────────────────────────────────────────────────────────────

function TemplateRenderer({ tplId, data, photo }: { tplId: number; data: Record<string, any>; photo?: string }) {
  if (tplId === 1) return <RidaTemplate data={data} photo={photo} />
  if (tplId === 2) return <WaleedTemplate data={data} photo={photo} />
  if (tplId === 3) return <ArhamTemplate data={data} photo={photo} />
  if (tplId === 4) return <SherazTemplate data={data} photo={photo} />
  if (tplId === 5) return <WaqarTemplate data={data} photo={photo} />
  if (tplId === 6) return <AdeelTemplate data={data} photo={photo} />
  if (tplId === 7) return <WaleedV2Template data={data} photo={photo} />
  if (tplId === 8) return <AdeelV2Template data={data} photo={photo} />
  return <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No template selected for this resume.</p>
}

function ResumeModal({
  item,
  onClose,
}: {
  item: ApplicationHistoryItem
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'text' | 'visual'>('text')
  const [refineOpen, setRefineOpen] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [refineError, setRefineError] = useState<string | null>(null)
  const templateRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, isError } = useQuery<TailoredApplication | null>({
    queryKey: ['tailoring', item.job_id],
    queryFn: () => tailorApi.getLast(item.job_id),
  })

  const refineMutation = useMutation({
    mutationFn: () =>
      // Preserve the one-page setting through a refine (was previously dropped → reverted to 2-page)
      tailorApi.generate(
        item.job_id, item.profile_id, customPrompt.trim(), item.template_id ?? undefined,
        data?.one_page ?? item.one_page,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tailoring', item.job_id] })
      qc.invalidateQueries({ queryKey: ['application-history'] })
      setRefineOpen(false)
      setCustomPrompt('')
      setRefineError(null)
    },
    onError: (err: any) => {
      setRefineError(err?.response?.data?.detail ?? 'Refine failed. Please try again.')
    },
  })

  const resumeText = data?.tailored_resume_text
  const resumeData = data?.tailored_resume_data
  const hasTemplate = !!item.template_id && !!resumeData

  function handleDownloadPdf() {
    if (!templateRef.current) { alert('Template not ready yet.'); return }
    const name = (resumeData?.name as string) || 'Resume'
    openPdfPrintWindow(templateRef.current.outerHTML, name, item.job_title, data?.one_page ?? item.one_page)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-2xl overflow-hidden flex flex-col shadow-2xl border"
        style={{
          background: 'var(--bg-modal)',
          borderColor: 'var(--border-default)',
          maxHeight: '92vh',
          width: tab === 'visual' && hasTemplate ? '860px' : '672px',
          transition: 'width 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-muted)' }}>
          <div>
            <h2 className="font-semibold text-white text-base">{item.job_title}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {item.company} · {item.profile_name} · {formatDate(item.tailored_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'text' && resumeText && (
              <button
                onClick={() => downloadTextFile(resumeText, item.job_title, item.company)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(125,194,66,0.12)', color: '#7DC242', border: '1px solid rgba(125,194,66,0.25)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                .txt
              </button>
            )}
            {tab === 'visual' && hasTemplate && (
              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                PDF
              </button>
            )}
            <button onClick={onClose} style={{ color: 'var(--text-faint)' }} className="hover:text-white transition-colors ml-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pt-3 gap-2" style={{ borderBottom: '1px solid var(--border-muted)' }}>
          {(['text', 'visual'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              disabled={t === 'visual' && !hasTemplate}
              className="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed capitalize"
              style={tab === t
                ? { color: '#7DC242', borderBottom: '2px solid #7DC242', marginBottom: '-1px' }
                : { color: 'var(--text-muted)', borderBottom: '2px solid transparent', marginBottom: '-1px' }}
              title={t === 'visual' && !hasTemplate ? 'No template was used for this resume' : undefined}
            >
              {t === 'text' ? 'Resume Text' : 'Visual Preview'}
            </button>
          ))}
        </div>

        {/* Keywords strip */}
        {item.keywords_matched.length > 0 && (
          <div className="px-5 py-2 flex flex-wrap gap-1.5" style={{ borderBottom: '1px solid var(--border-muted)', background: 'var(--bg-surface-hover)' }}>
            <span className="text-xs font-medium mr-1" style={{ color: 'var(--text-muted)' }}>
              {item.keywords_matched.length} keywords:
            </span>
            {item.keywords_matched.slice(0, 12).map(kw => (
              <span key={kw} className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'rgba(125,194,66,0.1)', color: '#7DC242', border: '1px solid rgba(125,194,66,0.15)' }}>
                {kw}
              </span>
            ))}
            {item.keywords_matched.length > 12 && (
              <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>+{item.keywords_matched.length - 12} more</span>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(125,194,66,0.3)', borderTopColor: '#7DC242' }} />
            </div>
          )}
          {isError && (
            <p className="text-sm text-center py-8" style={{ color: '#f87171' }}>Failed to load resume.</p>
          )}
          {data && tab === 'text' && (
            <div className="p-5">
              <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {resumeText || 'No resume text available.'}
              </pre>
            </div>
          )}
          {data && tab === 'visual' && hasTemplate && (
            <div className="overflow-x-auto bg-white">
              <div ref={templateRef} style={{ minWidth: 794 }}>
                <TemplateRenderer tplId={item.template_id!} data={resumeData!} photo={resumeData?.photo} />
              </div>
            </div>
          )}
        </div>

        {/* Refine section */}
        <div style={{ borderTop: '1px solid var(--border-muted)' }}>
          <button
            onClick={() => setRefineOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium transition-colors hover:bg-white/[0.02]"
            style={{ color: refineOpen ? '#7DC242' : 'var(--text-muted)' }}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Refine with Custom Prompt
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${refineOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {refineOpen && (
            <div className="px-5 pb-4 space-y-3">
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder='e.g. "Adjust experience to reflect 10 years instead of 5. Emphasize leadership over individual coding."'
                rows={3}
                className="w-full rounded-xl px-3 py-2.5 text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-[#7DC242]/30 resize-none"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-input)' }}
              />
              {refineError && (
                <p className="text-xs" style={{ color: '#f87171' }}>{refineError}</p>
              )}
              <button
                onClick={() => refineMutation.mutate()}
                disabled={!customPrompt.trim() || refineMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#7DC242 0%,#4CAF50 100%)', color: '#fff' }}
              >
                {refineMutation.isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Regenerating…
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Apply Changes
                  </>
                )}
              </button>
            </div>
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
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(0)

  const { data, isLoading, isError } = useQuery<ApplicationHistoryPage>({
    queryKey: ['application-history', page],
    queryFn: () => tailorApi.getHistory({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const history = data?.items
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const currentPageIds = history?.map(j => j.tailoring_id) ?? []
  const allOnPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedJobs.has(id))
  const someOnPageSelected = currentPageIds.some(id => selectedJobs.has(id))

  function toggleSelectAll() {
    if (allOnPageSelected) {
      setSelectedJobs(prev => { const s = new Set(prev); currentPageIds.forEach(id => s.delete(id)); return s })
    } else {
      setSelectedJobs(prev => new Set([...prev, ...currentPageIds]))
    }
  }

  function toggleRow(id: number) {
    setSelectedJobs(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => tailorApi.deleteHistory(ids),
    onSuccess: () => {
      setSelectedJobs(new Set())
      setDeleteMode(false)
      qc.invalidateQueries({ queryKey: ['application-history'] })
      setPage(0)
    },
    onError: () => {
      alert('Failed to delete. Please try again.')
    },
  })

  function handleDeleteSelected() {
    const ids = [...selectedJobs]
    if (!window.confirm(`Delete ${ids.length} resume log${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return
    deleteMutation.mutate(ids)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Resume Logs</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            All tailored resumes ever generated, grouped by job and profile.
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
            {selectedJobs.size > 0 ? `${selectedJobs.size} selected` : 'Select logs to delete'}
          </span>
          <div className="flex items-center gap-3">
            {selectedJobs.size > 0 && (
              <button onClick={() => setSelectedJobs(new Set())} className="text-xs text-gray-400 hover:text-gray-200">
                Clear
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

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(125,194,66,0.3)', borderTopColor: '#7DC242' }} />
          </div>
        )}

        {isError && (
          <p className="text-sm text-center py-12" style={{ color: '#f87171' }}>Failed to load resume logs.</p>
        )}

        {!isLoading && !isError && (!history || history.length === 0) && (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium text-white">No resumes generated yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Use Manual Tailor or open a job to generate a tailored resume.</p>
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
                {['Job Title', 'Company', 'Profile', 'Template', 'Keywords', 'Date', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', background: 'var(--bg-surface-hover)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((item, i) => (
                <tr
                  key={item.tailoring_id}
                  onClick={() => deleteMode && toggleRow(item.tailoring_id)}
                  style={{ borderBottom: i < history.length - 1 ? '1px solid var(--border-muted)' : 'none' }}
                  className={`transition-colors ${deleteMode ? 'cursor-pointer hover:bg-red-500/5' : 'hover:bg-white/[0.02]'} ${selectedJobs.has(item.tailoring_id) ? 'bg-red-500/10' : ''}`}
                >
                  {deleteMode && (
                    <td className="px-4 py-4 w-10" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedJobs.has(item.tailoring_id)}
                        onChange={() => toggleRow(item.tailoring_id)}
                        className="w-4 h-4 rounded cursor-pointer accent-[#7DC242]"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-white max-w-[180px] truncate">{item.job_title}</td>
                  <td className="px-4 py-3 max-w-[140px] truncate" style={{ color: 'var(--text-secondary)' }}>{item.company}</td>
                  <td className="px-4 py-3 max-w-[120px] truncate" style={{ color: 'var(--text-secondary)' }}>
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}>
                      {item.profile_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-faint)' }}>
                    {item.template_id ? TEMPLATE_NAMES[item.template_id] ?? `Template ${item.template_id}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-faint)' }}>
                    {item.keywords_matched.length > 0 ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'rgba(125,194,66,0.1)', color: '#7DC242' }}>
                        {item.keywords_matched.length} matched
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-faint)' }}>{formatDate(item.tailored_at)}</td>
                  <td className="px-4 py-3">
                    {!deleteMode && (
                      <button
                        onClick={e => { e.stopPropagation(); setSelected(item) }}
                        className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                        style={{ background: 'rgba(125,194,66,0.1)', color: '#7DC242', border: '1px solid rgba(125,194,66,0.25)' }}
                      >
                        View Resume
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !isError && total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Previous
            </button>
            <span className="px-2">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage(p => (p + 1 < totalPages ? p + 1 : p))}
              disabled={page + 1 >= totalPages}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selected && <ResumeModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
