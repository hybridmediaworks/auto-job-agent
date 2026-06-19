import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi, profilesApi, tailorApi } from '@/services/api'
import type { TailoredApplication } from '@/types'
import { PIPELINE_STAGES, TERMINAL_STATUSES } from '@/types'
import { CustomSelect } from '@/components/CustomSelect'
import { detectOnePageConflict } from '@/utils/prompt-warnings'
import { onePageFitScript } from '@/utils/onePageFit'
import {
  RESUME_TEMPLATES,
  WaleedTemplate,
  RidaTemplate,
  ArhamTemplate,
  SherazTemplate,
  WaqarTemplate,
  AdeelTemplate,
  WaleedV2Template,
  AdeelV2Template,
  TemplateCard,
} from '@/components/ResumeTemplates'

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

const pipelineDotColor: Record<string, string> = {
  DISCOVERED: '#64748b',
  BOOKMARKED: '#f59e0b',
  APPLIED:    '#7DC242',
  SCREENING:  '#3b82f6',
  INTERVIEW:  '#8b5cf6',
  OFFERED:    '#10b981',
  HIRED:      '#22c55e',
}

function PipelineStepper({ currentStatus }: { currentStatus: string }) {
  const currentIdx = PIPELINE_STAGES.indexOf(currentStatus as any)
  const isTerminal = TERMINAL_STATUSES.includes(currentStatus as any)

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {PIPELINE_STAGES.map((stage, idx) => {
        const isPast = idx < currentIdx
        const isCurrent = stage === currentStatus
        const dotColor = pipelineDotColor[stage] ?? '#94a3b8'
        return (
          <div key={stage} className="flex items-center">
            <div className="flex flex-col items-center min-w-[60px]">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                  isCurrent ? 'ring-4 ring-offset-2 ring-offset-[#0c1210] text-white shadow-lg' : isPast ? 'text-white' : 'bg-white/10 text-gray-500'
                }`}
                style={isCurrent || isPast ? { backgroundColor: dotColor } : undefined}
              >
                {isPast ? '✓' : idx + 1}
              </div>
              <span className={`text-[9px] mt-1 font-medium whitespace-nowrap ${isCurrent ? 'text-white font-bold' : isPast ? 'text-gray-400' : 'text-gray-500'}`}>
                {stage}
              </span>
            </div>
            {idx < PIPELINE_STAGES.length - 1 && (
              <div className={`w-6 h-0.5 mt-[-10px] ${idx < currentIdx ? 'bg-green-400' : 'bg-white/10'}`} />
            )}
          </div>
        )
      })}
      {isTerminal && (
        <div className="flex items-center ml-2">
          <div className="w-0.5 h-4 bg-gray-300 mx-2" />
          <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${statusColors[currentStatus] ?? 'bg-gray-100 text-gray-600'}`}>
            {currentStatus}
          </span>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd className="text-sm" style={{ color: 'var(--text-body)' }}>{value ?? '—'}</dd>
    </div>
  )
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors font-medium border border-white/10"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

// ── Tailored badge ────────────────────────────────────────────────────────────

function TailoredBadge() {
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full border bg-green-500/15 text-green-300 border-green-500/30">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      100% Tailored
    </span>
  )
}

// ── Tailor Panel ──────────────────────────────────────────────────────────────

function TailorPanel({ jobId, hasDescription, jobTitle, isManual = false }: { jobId: number; hasDescription: boolean; jobTitle: string; isManual?: boolean }) {
  const queryClient = useQueryClient()
  const [selectedProfileId, setSelectedProfileId] = useState<number | undefined>(undefined)
  const [result, setResult] = useState<TailoredApplication | null>(null)
  const [showCustomPrompt, setShowCustomPrompt] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [mustHaveKeywords, setMustHaveKeywords] = useState('')
  const [useTemplate, setUseTemplate] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(1)
  const [onePage, setOnePage] = useState(false)
  const [tone, setTone] = useState<string>('')
  const [focusAreas, setFocusAreas] = useState<string[]>([])
  const [progressStep, setProgressStep] = useState<'resume' | 'cover'>('resume')
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const templateRef = useRef<HTMLDivElement>(null)
  const previewKey = `preview_job_${jobId}`
  const [previewData, setPreviewData] = useState<TailoredApplication | null>(() => {
    try { const s = sessionStorage.getItem(`preview_job_${jobId}`); return s ? JSON.parse(s) : null } catch { return null }
  })
  const [previewOpen, setPreviewOpen] = useState(false)
  const previewTemplateRef = useRef<HTMLDivElement>(null)


  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: profilesApi.list,
  })

  // Load last saved tailoring on mount
  const { data: savedTailoring } = useQuery({
    queryKey: ['tailoring', jobId],
    queryFn: () => tailorApi.getLast(jobId),
  })

  useEffect(() => {
    const data = savedTailoring as TailoredApplication | null | undefined
    if (data && !result) {
      setResult(data)
      if (data.template_id) {
        setUseTemplate(true)
        setSelectedTemplate(data.template_id)
      }
    }
  }, [savedTailoring])

  // Generate preview (no DB save) → open modal
  const mutation = useMutation({
    mutationFn: () => {
      setProgressStep('resume')
      const mustHave = mustHaveKeywords.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
      return tailorApi.generatePreview(
        jobId,
        selectedProfileId,
        showCustomPrompt && customPrompt.trim() ? customPrompt.trim() : undefined,
        useTemplate ? selectedTemplate : undefined,
        onePage,
        tone || undefined,
        focusAreas.length > 0 ? focusAreas : undefined,
        mustHave.length ? mustHave : undefined,
      )
    },
    onSuccess: (data) => {
      setPreviewData(data)
      setPreviewOpen(true)
      try { sessionStorage.setItem(previewKey, JSON.stringify(data)) } catch {}
    },
  })

  // Switch progress label to "cover letter" after ~30s
  useEffect(() => {
    if (!mutation.isPending) { setProgressStep('resume'); return }
    const t = setTimeout(() => setProgressStep('cover'), 30000)
    return () => clearTimeout(t)
  }, [mutation.isPending])

  // Save previewed result to DB (no AI call)
  const saveMutation = useMutation({
    mutationFn: (data: TailoredApplication) => tailorApi.save(jobId, data),
    onSuccess: (saved) => {
      setResult(saved)
      setPreviewData(null)
      queryClient.invalidateQueries({ queryKey: ['tailoring', jobId] })
      try { sessionStorage.removeItem(previewKey) } catch {}
    },
  })

  const defaultProfile = profiles?.find((p) => p.is_default)
  const effectiveProfileId = selectedProfileId ?? defaultProfile?.id
  const selectedProfile = profiles?.find(p => p.id === effectiveProfileId)
  const profilePhoto = (selectedProfile?.resume_data as any)?.photo as string | undefined

  function handleDownloadPdf(displayResult: TailoredApplication, captureRef?: React.RefObject<HTMLDivElement>) {
    setDownloadError(null)
    const ref = captureRef ?? templateRef
    if (!displayResult.tailored_resume_data) {
      setDownloadError('No resume data found. Try regenerating the resume first.')
      return
    }
    if (!ref.current) {
      setDownloadError('Template not ready. Please wait a moment and try again.')
      return
    }
    const safeName = ((displayResult.tailored_resume_data?.name as string) || 'Resume').replace(/\s+/g, '_')
    const safeJob = jobTitle.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 40)
    const html = ref.current.outerHTML
    const fitScript = onePageFitScript(!!displayResult.one_page)
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      setDownloadError('Popup was blocked. Please allow popups for this site and try again.')
      return
    }
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${safeName}_${safeJob}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bitter:wght@400;700&family=Montserrat:wght@300;400;500;600;700;900&family=Open+Sans:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; box-sizing: border-box; }
    @page { size: A4 portrait; margin: 10mm 0; }
    @page :first { margin: 0; }
    html, body { margin: 0; padding: 0; background: white; }
  </style>
</head>
<body>
  <div id="__fit" style="transform-origin:top left">${html}</div>
  <script>window.onload = function(){ setTimeout(function(){ ${fitScript}window.print(); }, 800); };<\/script>
</body>
</html>`)
    printWindow.document.close()
  }

  function handleSaveAndDownload() {
    if (!previewData) return
    handleDownloadPdf(previewData, previewTemplateRef)
    saveMutation.mutate(previewData)
    setPreviewOpen(false)
  }

  if (!hasDescription) {
    return (
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h2 className="text-base font-semibold text-white">AI Tailoring</h2>
              <p className="text-sm text-gray-400">No description available for this job — AI tailoring requires a job description.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const displayResult = result ?? (savedTailoring as TailoredApplication | null)
  const previewTplId = useTemplate ? selectedTemplate : (previewData?.template_id ?? 1)
  const [showRegenOptions, setShowRegenOptions] = useState(false)

  // For manual jobs with results: show hero results UI
  if (isManual && displayResult && !mutation.isPending) {
    return (
      <>
        {/* ── Hero: Documents Ready ── */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(125,194,66,0.25)', background: 'var(--bg-surface)' }}>
          {/* Green success banner */}
          <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={{ background: 'linear-gradient(135deg, rgba(125,194,66,0.15) 0%, rgba(76,175,80,0.08) 100%)', borderBottom: '1px solid rgba(125,194,66,0.15)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(125,194,66,0.2)', border: '1px solid rgba(125,194,66,0.4)' }}>
                <svg className="w-5 h-5" fill="none" stroke="#7DC242" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Your documents are ready</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Tailored resume and cover letter generated for <span style={{ color: '#7DC242' }}>{jobTitle}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => { if (!previewData) setPreviewData(displayResult); setPreviewOpen(true) }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ borderColor: 'rgba(125,194,66,0.4)', color: '#7DC242', background: 'rgba(125,194,66,0.08)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview Resume
              </button>
              <button
                onClick={() => handleDownloadPdf(displayResult)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                style={{ background: 'linear-gradient(135deg, #7DC242 0%, #4CAF50 100%)', boxShadow: '0 4px 14px rgba(125,194,66,0.35)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDF
              </button>
            </div>
          </div>

          {/* Documents side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
            {/* Resume */}
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <svg className="w-4 h-4" style={{ color: '#7DC242' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Tailored Resume
                </h3>
                <CopyButton text={displayResult.tailored_resume_text ?? ''} />
              </div>
              <textarea
                className="w-full font-mono text-[11px] border rounded-xl p-4 leading-relaxed resize-y"
                style={{ background: 'var(--code-bg)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)', minHeight: 320 }}
                rows={18}
                value={displayResult.tailored_resume_text ?? ''}
                readOnly
              />
            </div>

            {/* Cover Letter */}
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Cover Letter
                </h3>
                <CopyButton text={displayResult.cover_letter ?? ''} />
              </div>
              <textarea
                className="w-full text-xs border rounded-xl p-4 leading-relaxed resize-y"
                style={{ background: 'var(--code-bg)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)', minHeight: 320 }}
                rows={18}
                value={displayResult.cover_letter ?? ''}
                readOnly
              />
            </div>
          </div>

          {/* Regenerate footer */}
          <div className="px-6 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setShowRegenOptions(v => !v)}
              className="text-xs font-medium transition-colors flex items-center gap-1.5"
              style={{ color: showRegenOptions ? '#7DC242' : 'var(--text-faint)' }}
            >
              <svg className={`w-3 h-3 transition-transform ${showRegenOptions ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Need changes? Regenerate with new options
            </button>

            {showRegenOptions && (
              <div className="mt-4 space-y-4 pb-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <CustomSelect
                    value={String(effectiveProfileId ?? '')}
                    onChange={v => setSelectedProfileId(v ? Number(v) : undefined)}
                    options={profiles?.length ? profiles.map(p => ({ value: String(p.id), label: `${p.name}${p.is_default ? ' (default)' : ''}` })) : [{ value: '', label: 'No profiles' }]}
                    className="max-w-xs"
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={onePage} onChange={e => setOnePage(e.target.checked)} className="rounded" style={{ accentColor: '#7DC242' }} />
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>1-Page</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={useTemplate} onChange={e => setUseTemplate(e.target.checked)} className="rounded" style={{ accentColor: '#7DC242' }} />
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Use Template</span>
                  </label>
                </div>
                {useTemplate && (
                  <div className="flex gap-3 flex-wrap">
                    {RESUME_TEMPLATES.map(t => <TemplateCard key={t.id} template={t} isSelected={selectedTemplate === t.id} onClick={() => setSelectedTemplate(t.id)} />)}
                  </div>
                )}
                <textarea
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  placeholder="Custom instructions, e.g. more formal tone, emphasize leadership…"
                  rows={2}
                  className="w-full text-sm border rounded-xl p-3 resize-y"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-input)' }}
                />
                <button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending || !profiles?.length}
                  className="btn-primary disabled:opacity-50"
                >
                  Regenerate Documents
                </button>
                {mutation.isError && (
                  <p className="text-xs" style={{ color: '#fca5a5' }}>
                    {(mutation.error as any)?.response?.data?.detail || 'Generation failed.'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Download error */}
        {downloadError && (
          <div className="rounded-lg p-3 text-sm border flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
            <span>⚠</span><span>{downloadError}</span>
            <button onClick={() => setDownloadError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        )}

        {/* Hidden off-screen template for PDF capture */}
        {displayResult?.tailored_resume_data && (() => {
          const tplId = useTemplate ? selectedTemplate : (displayResult.template_id ?? 1)
          return (
            <div style={{ position: 'absolute', left: -9999, top: 0, zIndex: -1, overflow: 'hidden', width: 794 }} aria-hidden="true">
              <div ref={templateRef}>
                {tplId === 2 ? <WaleedTemplate data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : tplId === 3 ? <ArhamTemplate  data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : tplId === 4 ? <SherazTemplate data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : tplId === 5 ? <WaqarTemplate  data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : tplId === 6 ? <AdeelTemplate  data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : tplId === 7 ? <WaleedV2Template data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : tplId === 8 ? <AdeelV2Template data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : <RidaTemplate data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                }
              </div>
            </div>
          )
        })()}

        {/* Preview modal */}
        {previewOpen && previewData?.tailored_resume_data && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewOpen(false) }}
        >
          <div style={{ background: '#0c1210', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 900, maxHeight: '90vh' }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Resume Preview</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending || saveMutation.isPending}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#d1d5db', cursor: 'pointer', opacity: (mutation.isPending || saveMutation.isPending) ? 0.5 : 1 }}
                >
                  {mutation.isPending
                    ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Regenerating…</>
                    : 'Regenerate'}
                </button>
                <button
                  onClick={handleSaveAndDownload}
                  disabled={saveMutation.isPending || mutation.isPending}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px', background: '#7DC242', borderRadius: 8, color: 'white', cursor: 'pointer', border: 'none', opacity: (saveMutation.isPending || mutation.isPending) ? 0.6 : 1 }}
                >
                  {saveMutation.isPending
                    ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Saving…</>
                    : <><svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Save & Download PDF</>}
                </button>
                <button
                  onClick={() => setPreviewOpen(false)}
                  style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 20, fontWeight: 700, lineHeight: 1 }}
                >×</button>
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ overflowY: 'auto', flex: 1, padding: 16, position: 'relative' }}>
              {mutation.isPending && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'rgba(12,18,16,0.88)', borderRadius: '0 0 16px 16px' }}>
                  <div style={{ width: 28, height: 28, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#7DC242', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ fontSize: 13, color: '#d1d5db' }}>Claude is regenerating your resume…</span>
                </div>
              )}
              <div ref={previewTemplateRef} style={{ width: 794, margin: '0 auto' }}>
                {previewTplId === 2 ? <WaleedTemplate data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                  : previewTplId === 3 ? <ArhamTemplate  data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                  : previewTplId === 4 ? <SherazTemplate data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                  : previewTplId === 5 ? <WaqarTemplate  data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                  : previewTplId === 6 ? <AdeelTemplate  data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                  : previewTplId === 7 ? <WaleedV2Template data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                  : previewTplId === 8 ? <AdeelV2Template data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                  : <RidaTemplate   data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                }
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

  // ── Normal return for non-manual / pending jobs ───────────────────────────
  return (
    <>
      <div className="card space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">AI Tailored Application</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Generate a resume and cover letter tailored specifically for this job.
            </p>
          </div>
          {displayResult && <TailoredBadge />}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <CustomSelect
            value={String(effectiveProfileId ?? '')}
            onChange={v => setSelectedProfileId(v ? Number(v) : undefined)}
            options={
              profiles?.length
                ? profiles.map(p => ({ value: String(p.id), label: `${p.name}${p.is_default ? ' (default)' : ''}` }))
                : [{ value: '', label: 'No profiles — create one first' }]
            }
            className="max-w-xs"
          />
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !profiles?.length}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {progressStep === 'resume' ? 'Tailoring resume…' : 'Generating cover letter…'}
              </>
            ) : displayResult ? 'Regenerate' : 'Generate'}
          </button>
          {!profiles?.length && (
            <a href="/profiles" className="text-sm text-blue-600 hover:underline">Create a profile first →</a>
          )}
          {previewData && !previewOpen && !mutation.isPending && (
            <button onClick={() => setPreviewOpen(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium border border-[#7DC242]/40 text-[#7DC242] hover:bg-[#7DC242]/10 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Preview
            </button>
          )}
        </div>

        {/* Custom prompt toggle */}
        <div className="space-y-2">
          <button type="button" onClick={() => setShowCustomPrompt(!showCustomPrompt)} className="flex items-center gap-2 text-sm font-medium transition-colors" style={{ color: showCustomPrompt ? '#7DC242' : 'var(--text-muted)' }}>
            <svg className={`w-4 h-4 transition-transform ${showCustomPrompt ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Custom Instructions {showCustomPrompt ? '(enabled)' : ''}
          </button>
          {showCustomPrompt && (() => {
            const conflict = detectOnePageConflict(customPrompt, onePage)
            return (
              <div className="space-y-1.5">
                <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder={"Add special instructions for the AI, e.g.:\n• Make ABC company bullets 3 instead of 5\n• Emphasize my WordPress experience\n• Use a more formal tone in the cover letter\n• Focus on cloud/DevOps skills"} className="w-full text-sm border rounded-xl p-3 resize-y placeholder:leading-relaxed" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-input)', minHeight: '90px' }} rows={4} />
                {conflict && (
                  <div className="rounded-lg p-2.5 text-xs flex items-start gap-2 border" style={{ background: 'rgba(234,179,8,0.08)', borderColor: 'rgba(234,179,8,0.25)', color: '#fde047' }}>
                    <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <span>{conflict.message}</span>
                  </div>
                )}
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>These instructions will be appended to both the resume and cover letter generation prompts.</p>
              </div>
            )
          })()}
        </div>

        {/* Must-have keywords — guaranteed into skills + experience, never dropped */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Must-Have Keywords (optional)</label>
          <textarea
            value={mustHaveKeywords}
            onChange={e => setMustHaveKeywords(e.target.value)}
            placeholder={"Comma or line separated keywords the resume MUST include, e.g.:\nReact.js, TypeScript, GraphQL, AWS, CI/CD"}
            className="w-full text-sm border rounded-xl p-3 resize-y placeholder:leading-relaxed"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-input)', minHeight: '72px' }}
            rows={3}
          />
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Every keyword here is guaranteed to appear in both the Skills section and the experience bullets — none is ever dropped.</p>
        </div>

        {/* 1-page toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={onePage} onChange={e => setOnePage(e.target.checked)} className="rounded" style={{ accentColor: '#7DC242' }} />
          <span className="text-sm font-medium" style={{ color: onePage ? '#7DC242' : 'var(--text-muted)' }}>1-Page Resume</span>
          {onePage && <span className="text-xs" style={{ color: '#6b7280' }}>— all roles kept · bullets trimmed · ≤6 tools · fits one page</span>}
        </label>

        {/* Tone */}
        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Tone (optional)</label>
          <div className="flex gap-2 flex-wrap">
            {['Professional', 'Technical', 'Enthusiastic'].map(t => (
              <button
                type="button"
                key={t}
                onClick={() => setTone(tone === t ? '' : t)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                style={tone === t
                  ? { background: 'rgba(125,194,66,0.15)', borderColor: '#7DC242', color: '#7DC242' }
                  : { background: 'transparent', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Focus areas */}
        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Focus areas (optional)</label>
          <div className="flex gap-2 flex-wrap">
            {['Architecture', 'Leadership', 'Coding', 'Product Sense', 'Cloud / DevOps', 'Data / ML'].map(area => {
              const active = focusAreas.includes(area)
              return (
                <button
                  type="button"
                  key={area}
                  onClick={() =>
                    setFocusAreas(prev => active ? prev.filter(a => a !== area) : [...prev, area])
                  }
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                  style={active
                    ? { background: 'rgba(125,194,66,0.15)', borderColor: '#7DC242', color: '#7DC242' }
                    : { background: 'transparent', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  {area}
                </button>
              )
            })}
          </div>
        </div>

        {/* Template selector */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={useTemplate} onChange={e => setUseTemplate(e.target.checked)} className="rounded" style={{ accentColor: '#7DC242' }} />
            <span className="text-sm font-medium" style={{ color: useTemplate ? '#7DC242' : 'var(--text-muted)' }}>Use Resume Template</span>
          </label>
          {useTemplate && (
            <div className="flex gap-3 flex-wrap">
              {RESUME_TEMPLATES.map(t => <TemplateCard key={t.id} template={t} isSelected={selectedTemplate === t.id} onClick={() => setSelectedTemplate(t.id)} />)}
            </div>
          )}
        </div>

        {/* Errors */}
        {mutation.isError && (
          <div className="rounded-lg p-3 text-sm border" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
            {(mutation.error as any)?.response?.data?.detail || 'Generation failed. Check that ANTHROPIC_API_KEY is set in Settings.'}
          </div>
        )}
        {downloadError && (
          <div className="rounded-lg p-3 text-sm border flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
            <span style={{ flexShrink: 0 }}>⚠</span><span>{downloadError}</span>
            <button onClick={() => setDownloadError(null)} style={{ marginLeft: 'auto', flexShrink: 0, background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* Loading */}
        {mutation.isPending && (
          <div className="rounded-lg p-4 text-sm flex items-center gap-3 border" style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}>
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            Claude is reading the job description and tailoring your resume and cover letter…
          </div>
        )}

        {/* Results */}
        {displayResult && !mutation.isPending && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Tailored Resume</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDownloadPdf(displayResult)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg transition-colors font-medium" style={{ background: 'rgba(59,130,246,0.1)' }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download PDF
                  </button>
                  <CopyButton text={displayResult.tailored_resume_text ?? ''} />
                </div>
              </div>
              <textarea className="w-full font-mono text-xs border rounded-lg p-4 leading-relaxed resize-y" style={{ background: 'var(--code-bg)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }} rows={20} value={displayResult.tailored_resume_text ?? ''} onChange={() => {}} readOnly />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Cover Letter</h3>
                <CopyButton text={displayResult.cover_letter ?? ''} />
              </div>
              <textarea className="w-full text-sm border rounded-lg p-4 leading-relaxed resize-y" style={{ background: 'var(--code-bg)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }} rows={14} value={displayResult.cover_letter ?? ''} onChange={() => {}} readOnly />
            </div>
          </div>
        )}

        {/* Hidden off-screen template for PDF capture */}
        {displayResult?.tailored_resume_data && (() => {
          const tplId = useTemplate ? selectedTemplate : (displayResult.template_id ?? 1)
          return (
            <div style={{ position: 'absolute', left: -9999, top: 0, zIndex: -1, overflow: 'hidden', width: 794 }} aria-hidden="true">
              <div ref={templateRef}>
                {tplId === 2 ? <WaleedTemplate data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : tplId === 3 ? <ArhamTemplate  data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : tplId === 4 ? <SherazTemplate data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : tplId === 5 ? <WaqarTemplate  data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : tplId === 6 ? <AdeelTemplate  data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : tplId === 7 ? <WaleedV2Template data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : tplId === 8 ? <AdeelV2Template data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : <RidaTemplate data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                }
              </div>
            </div>
          )
        })()}
      </div>

      {/* Preview modal */}
      {previewOpen && previewData?.tailored_resume_data && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-md transition-all duration-300"
          style={{ background: 'var(--overlay-bg)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewOpen(false) }}
        >
          <div 
            className="flex flex-col w-full max-w-[920px] rounded-2xl overflow-hidden shadow-2xl border"
            style={{ background: 'var(--bg-modal)', borderColor: 'var(--border-default)', maxHeight: '92vh' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-muted)', flexShrink: 0 }}>
              <span className="text-sm font-bold text-white uppercase tracking-wider">Resume Preview</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => mutation.mutate()} 
                  disabled={mutation.isPending || saveMutation.isPending} 
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  {mutation.isPending ? <><div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />Regenerating…</> : 'Regenerate'}
                </button>
                <button 
                  onClick={handleSaveAndDownload} 
                  disabled={saveMutation.isPending || mutation.isPending} 
                  className="btn-primary !px-4 !py-1.5 !text-xs !shadow-none"
                >
                  {saveMutation.isPending ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</> : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Save & Download PDF</>}
                </button>
                <button 
                  onClick={() => setPreviewOpen(false)} 
                  className="ml-1 p-1 rounded-lg transition-colors hover:bg-white/5"
                  style={{ color: 'var(--text-faint)' }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 relative bg-white/5">
              {mutation.isPending && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-sm" style={{ background: 'var(--bg-glass)' }}>
                  <div className="w-8 h-8 border-3 border-white/20 border-t-[#7DC242] rounded-full animate-spin" />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Claude is regenerating your resume…</span>
                </div>
              )}
              <div ref={previewTemplateRef} className="mx-auto shadow-2xl" style={{ width: 794 }}>
                {previewTplId === 2 ? <WaleedTemplate data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                  : previewTplId === 3 ? <ArhamTemplate  data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                  : previewTplId === 4 ? <SherazTemplate data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                  : previewTplId === 5 ? <WaqarTemplate  data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                  : previewTplId === 6 ? <AdeelTemplate  data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                  : previewTplId === 7 ? <WaleedV2Template data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                  : previewTplId === 8 ? <AdeelV2Template data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                  : <RidaTemplate   data={previewData.tailored_resume_data as Record<string, any>} photo={profilePhoto} />
                }
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function JobDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [applyPrompt, setApplyPrompt] = useState(false)

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(Number(id)),
    enabled: !!id,
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => jobsApi.update(Number(id), { status } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job', id] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
      qc.invalidateQueries({ queryKey: ['dashboardStats'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
    },
  })

  if (isLoading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7DC242', borderTopColor: 'transparent' }} />
    </div>
  )

  if (error || !job) return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 text-sm border" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
        Failed to load job details.
      </div>
      <button onClick={() => navigate('/jobs')} className="btn-secondary">← Back to Jobs</button>
    </div>
  )

  const salary = job.salary_min || job.salary_max
    ? `$${job.salary_min?.toLocaleString() ?? '?'} – $${job.salary_max?.toLocaleString() ?? '?'} ${job.salary_currency}`
    : null

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <button onClick={() => navigate('/jobs')} className="btn-secondary">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Jobs
      </button>

      {/* Pipeline Stepper */}
      <div className="card">
        <PipelineStepper currentStatus={job.status} />
      </div>

      {/* "Did you apply?" prompt */}
      {applyPrompt && job.status === 'DISCOVERED' && (
        <div className="card" style={{ borderColor: 'var(--border-brand-lg)', background: 'rgba(125,194,66,0.08)' }}>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-green-300 font-medium">Did you apply to this job?</p>
            <div className="flex gap-2">
              <button
                onClick={() => { statusMutation.mutate('APPLIED'); setApplyPrompt(false) }}
                className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg shadow" style={{ background: 'linear-gradient(135deg, #7DC242, #4CAF50)' }}
              >
                Yes, I applied ✓
              </button>
              <button
                onClick={() => { statusMutation.mutate('BOOKMARKED'); setApplyPrompt(false) }}
                className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-100 rounded-lg"
              >
                Bookmarked
              </button>
              <button onClick={() => setApplyPrompt(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{job.title}</h1>
            <p className="text-lg text-gray-300 mt-1">{job.company}</p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {job.location && (
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {job.location}
                </span>
              )}
              {job.remote_type && (
                <span className="badge bg-indigo-500/20 text-indigo-300 capitalize">{job.remote_type}</span>
              )}
              {job.job_type && (
                <span className="badge bg-white/10 text-gray-300 capitalize">{job.job_type}</span>
              )}
            </div>
          </div>
          {/* Status Dropdown */}
          <CustomSelect
            value={job.status}
            onChange={v => statusMutation.mutate(v)}
            options={ALL_STATUSES.map(s => ({ value: s, label: s }))}
            triggerClassName={`text-sm font-semibold px-3 py-1.5 rounded-xl cursor-pointer ${statusColors[job.status] ?? 'bg-gray-500/20 text-gray-400'}`}
          />
        </div>

        {/* Quick status buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          {PIPELINE_STAGES.filter(s => s !== job.status).slice(0, 4).map(status => (
            <button
              key={status}
              onClick={() => statusMutation.mutate(status)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-all hover:shadow hover:border-green-500/30 ${statusColors[status] ?? 'bg-gray-500/20 text-gray-400'}`}
            >
              → {status}
            </button>
          ))}
        </div>

        {job.provider !== 'manual' && (
          <div className="mt-5 pt-5 border-t border-white/5 flex flex-wrap gap-3">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              onClick={() => { if (job.status === 'DISCOVERED') setApplyPrompt(true) }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View on {job.provider}
            </a>
          </div>
        )}
      </div>

      {/* For manual jobs: show AI panel right after the header */}
      {job.provider === 'manual' && (
        <TailorPanel jobId={Number(id)} hasDescription={!!job.description} jobTitle={job.title} isManual />
      )}

      {/* Details Grid — hidden for manual jobs (not relevant) */}
      {job.provider !== 'manual' && (
        <div className="card">
          <h2 className="text-base font-semibold text-white mb-4">Job Details</h2>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <Field label="Provider" value={job.provider} />
            <Field label="Source ID" value={job.source_job_id} />
            <Field label="Salary" value={salary} />
            <Field label="Job Type" value={job.job_type} />
            <Field label="Remote Type" value={job.remote_type} />
            <Field label="Posted Date" value={job.posted_date ? new Date(job.posted_date).toLocaleDateString() : null} />
            <Field label="Easy Apply" value={job.easy_apply ? 'Yes' : 'No'} />
            <Field label="Created" value={new Date(job.created_at).toLocaleString()} />
            <Field label="Updated" value={new Date(job.updated_at).toLocaleString()} />
          </dl>
        </div>
      )}

      {/* Description */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">Job Description</h2>
        <div className="rounded-lg p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto" style={{ background: 'var(--code-bg)' }}>
          {job.description || 'No description available.'}
        </div>
      </div>

      {/* AI Tailor Panel — non-manual jobs only */}
      {job.provider !== 'manual' && (
        <TailorPanel jobId={Number(id)} hasDescription={!!job.description} jobTitle={job.title} />
      )}

      {/* Notes & Errors */}
      {job.notes && (
        <div className="card">
          <h2 className="text-base font-semibold text-white mb-3">Notes</h2>
          <p className="text-sm text-gray-300">{job.notes}</p>
        </div>
      )}
      {job.error_message && (
        <div className="rounded-xl p-4 border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <h2 className="text-sm font-semibold text-red-300 mb-1">Error</h2>
          <p className="text-sm text-red-400">{job.error_message}</p>
        </div>
      )}
    </div>
  )
}
