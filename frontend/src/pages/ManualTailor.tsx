import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { profilesApi, tailorApi } from '@/services/api'

// ── Constants ──────────────────────────────────────────────────────────────────

const RESUME_TEMPLATES = [
  { id: 1, name: 'Rida Saeed',      description: 'Teal header & sidebar',    accent: '#00b4b4', bg: '#0d3333' },
  { id: 2, name: 'Mirza Waleed',    description: 'Green accents, photo',      accent: '#4CAF50', bg: '#0d1f0d' },
  { id: 3, name: 'Arham Saeed',     description: 'Dark olive sidebar',        accent: '#8B7355', bg: '#1e2a0f' },
  { id: 4, name: 'Sheraz Khalid',   description: 'Orange, watermark name',    accent: '#FF6B35', bg: '#2a150a' },
  { id: 5, name: 'Muhammad Waqar',  description: 'Blue initials, grid skills',accent: '#3B5BD9', bg: '#0a1528' },
]

const TONES = ['Professional', 'Technical', 'Enthusiastic']

const FOCUS_AREAS = [
  'Architecture', 'Leadership', 'Coding',
  'Communication', 'Problem Solving', 'Systems Design',
]

// ── Mini template preview card ────────────────────────────────────────────────

function TemplateCard({
  id, name, description, accent, bg, isSelected, onClick,
}: typeof RESUME_TEMPLATES[0] & { isSelected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl p-2 border-2 text-left transition-all cursor-pointer"
      style={{
        background: 'var(--bg-surface)',
        borderColor: isSelected ? '#7DC242' : 'transparent',
        width: 100,
        outline: 'none',
      }}
    >
      {/* Mini visual swatch */}
      <div
        style={{
          width: '100%',
          height: 70,
          borderRadius: 6,
          background: bg,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Header bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: id === 1 || id === 3 ? 20 : 14, background: accent, opacity: 0.85 }} />
        {/* Body lines */}
        <div style={{ position: 'absolute', top: id === 1 || id === 3 ? 24 : 18, left: 6, right: 6 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ height: 3, borderRadius: 1, background: 'rgba(255,255,255,0.18)', marginBottom: 4, width: i % 2 === 0 ? '90%' : '70%' }} />
          ))}
        </div>
        {/* Accent dot */}
        <div style={{ position: 'absolute', bottom: 5, right: 6, width: 10, height: 10, borderRadius: '50%', background: accent, opacity: 0.7 }} />
      </div>
      <p className="text-xs font-semibold mt-1.5" style={{ color: 'var(--text-primary)' }}>{name}</p>
      <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
    </button>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
      <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#7DC242' }}>{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass = 'w-full rounded-xl px-3 py-2.5 text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-[#7DC242]/30'
const inputStyle = { background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-input)' }

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ManualTailor() {
  const navigate = useNavigate()

  // ── Form state ──────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [tone, setTone] = useState('Professional')
  const [focusAreas, setFocusAreas] = useState<string[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<number | undefined>()
  const [useTemplate, setUseTemplate] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(1)
  const [progressStep, setProgressStep] = useState<'resume' | 'cover'>('resume')
  const [error, setError] = useState<string | null>(null)

  // ── Profiles ────────────────────────────────────────────────────────────────
  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: profilesApi.list,
  })

  useEffect(() => {
    if (profiles && !selectedProfileId) {
      const def = profiles.find(p => p.is_default) ?? profiles[0]
      if (def) setSelectedProfileId(def.id)
    }
  }, [profiles])

  // ── Submit ──────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () => {
      setError(null)
      setProgressStep('resume')
      return tailorApi.manualTailor({
        title: title.trim(),
        company: company.trim(),
        description: description.trim(),
        location: location.trim() || undefined,
        address: address.trim() || undefined,
        url: url.trim() || undefined,
        profile_id: selectedProfileId,
        template_id: useTemplate ? selectedTemplate : undefined,
        tone,
        focus_areas: focusAreas.length > 0 ? focusAreas : undefined,
      })
    },
    onSuccess: (data) => {
      navigate(`/jobs/${data.job_id}`)
    },
    onError: (err: any) => {
      setError(err?.response?.data?.detail ?? 'Something went wrong. Please try again.')
    },
  })

  // Cycle progress label
  useEffect(() => {
    if (!mutation.isPending) { setProgressStep('resume'); return }
    const t = setTimeout(() => setProgressStep('cover'), 30000)
    return () => clearTimeout(t)
  }, [mutation.isPending])

  const toggleFocus = (area: string) =>
    setFocusAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area])

  const canSubmit = title.trim() && company.trim() && description.trim() && !mutation.isPending

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Manual Tailor</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Paste any job listing and generate a tailored resume and cover letter.
        </p>
      </div>

      {/* ── Job Details ── */}
      <Section title="Job Details">
        <div className="grid grid-cols-2 gap-4 auto-rows-auto">
          <Field label="Job Title" required>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="Company" required>
            <input
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Acme Corp"
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="Your Location">
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Remote, New York, NY"
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="Your Address">
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. 123 Main St, New York, NY 10001"
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="Job URL">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className={inputClass}
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Job Description" required>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Paste the full job description here..."
            rows={10}
            className={`${inputClass} resize-y`}
            style={{ ...inputStyle, minHeight: 200 }}
          />
        </Field>
      </Section>

      {/* ── Options + Template side by side ── */}
      <div className="grid grid-cols-2 gap-6">

        {/* Left: Profile + Tone + Focus + Research */}
        <Section title="Options">
          {/* Profile */}
          <Field label="Profile">
            {profiles?.length ? (
              <select
                value={selectedProfileId ?? ''}
                onChange={e => setSelectedProfileId(Number(e.target.value))}
                className={inputClass}
                style={inputStyle}
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.is_default ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <a href="/profiles" className="text-sm" style={{ color: '#7DC242' }}>
                Create a profile first →
              </a>
            )}
          </Field>

          {/* Tone */}
          <Field label="Tone">
            <select
              value={tone}
              onChange={e => setTone(e.target.value)}
              className={inputClass}
              style={inputStyle}
            >
              {TONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>

          {/* Focus Areas */}
          <Field label="Focus Areas">
            <div className="flex flex-wrap gap-2 pt-0.5">
              {FOCUS_AREAS.map(area => {
                const active = focusAreas.includes(area)
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleFocus(area)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
                    style={{
                      borderColor: active ? '#7DC242' : 'var(--border-default)',
                      background: active ? 'rgba(125,194,66,0.12)' : 'var(--bg-input)',
                      color: active ? '#7DC242' : 'var(--text-muted)',
                    }}
                  >
                    {area}
                  </button>
                )
              })}
            </div>
          </Field>

        </Section>

        {/* Right: Template */}
        <Section title="Resume Template">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useTemplate}
              onChange={e => setUseTemplate(e.target.checked)}
              className="rounded"
              style={{ accentColor: '#7DC242' }}
            />
            <span className="text-sm font-medium" style={{ color: useTemplate ? '#7DC242' : 'var(--text-muted)' }}>
              Use a template
            </span>
          </label>

          {useTemplate && (
            <div className="flex flex-wrap gap-3 pt-1">
              {RESUME_TEMPLATES.map(t => (
                <TemplateCard
                  key={t.id}
                  {...t}
                  isSelected={selectedTemplate === t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                />
              ))}
            </div>
          )}

          {!useTemplate && (
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
              Enable to choose a visual resume layout.
            </p>
          )}
        </Section>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl p-4 text-sm border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* ── Submit ── */}
      <div className="flex items-center gap-4 pb-8">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => mutation.mutate()}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: canSubmit ? 'linear-gradient(135deg,#7DC242 0%,#4CAF50 100%)' : 'var(--bg-surface)', color: canSubmit ? '#fff' : 'var(--text-muted)' }}
        >
          {mutation.isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {progressStep === 'resume' ? 'Tailoring resume…' : 'Generating cover letter…'}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Tailored Resume
            </>
          )}
        </button>

        {!profiles?.length && (
          <p className="text-sm" style={{ color: '#fca5a5' }}>
            You need a profile before generating.{' '}
            <a href="/profiles" style={{ color: '#7DC242', textDecoration: 'underline' }}>Create one →</a>
          </p>
        )}
      </div>
    </div>
  )
}
