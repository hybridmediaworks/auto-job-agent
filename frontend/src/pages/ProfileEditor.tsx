import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profilesApi } from '@/services/api'
import type { ResumeData, ResumeExperience, ResumeEducation, ResumeLanguage, ResumeProject } from '@/types'

type Tab = 'resume' | 'personal' | 'availability'

/**
 * Strip empty strings out of resume arrays before save.
 * Empty link/image/bullet entries would otherwise render as empty bullets in
 * the generated resume templates.
 */
function sanitizeResumeForSave(resume: any): any {
  const clean = { ...resume }

  // String arrays — drop empty/whitespace-only entries
  for (const field of ['useful_links', 'portfolio_images', 'skills_list', 'tools_list', 'key_achievements', 'expertise_bullets', 'additional_skills', 'skills_bullets'] as const) {
    if (Array.isArray(clean[field])) {
      clean[field] = clean[field].filter((s: any) => typeof s === 'string' && s.trim().length > 0)
    }
  }

  // Experience bullets
  if (Array.isArray(clean.experience)) {
    clean.experience = clean.experience.map((exp: any) => ({
      ...exp,
      bullets: Array.isArray(exp?.bullets)
        ? exp.bullets.filter((b: any) => typeof b === 'string' && b.trim().length > 0)
        : exp?.bullets,
    }))
  }

  // Project bullets
  if (Array.isArray(clean.projects)) {
    clean.projects = clean.projects.map((proj: any) => ({
      ...proj,
      bullets: Array.isArray(proj?.bullets)
        ? proj.bullets.filter((b: any) => typeof b === 'string' && b.trim().length > 0)
        : proj?.bullets,
    }))
  }

  return clean
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7DC242', borderTopColor: 'transparent' }} />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ExperienceEntry({
  exp,
  index,
  onChange,
  onRemove,
}: {
  exp: ResumeExperience
  index: number
  onChange: (index: number, updated: ResumeExperience) => void
  onRemove: (index: number) => void
}) {
  const update = (field: keyof ResumeExperience, value: string | string[]) =>
    onChange(index, { ...exp, [field]: value })

  const updateBullet = (bi: number, val: string) => {
    const bullets = [...exp.bullets]
    bullets[bi] = val
    update('bullets', bullets)
  }

  const addBullet = () => update('bullets', [...exp.bullets, ''])
  const removeBullet = (bi: number) => update('bullets', exp.bullets.filter((_, i) => i !== bi))

  return (
    <div className="border rounded-xl p-4 space-y-3" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-surface-alt)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Experience #{index + 1}</span>
        <button onClick={() => onRemove(index)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Job Title</label>
          <input className="input" value={exp.title} onChange={(e) => update('title', e.target.value)} placeholder="Senior Developer" />
        </div>
        <div>
          <label className="label">Company</label>
          <input className="input" value={exp.company} onChange={(e) => update('company', e.target.value)} placeholder="Acme Corp" />
        </div>
        <div>
          <label className="label">Start Date</label>
          <input className="input" value={exp.start_date} onChange={(e) => update('start_date', e.target.value)} placeholder="Jan 2021" />
        </div>
        <div>
          <label className="label">End Date</label>
          <input className="input" value={exp.end_date} onChange={(e) => update('end_date', e.target.value)} placeholder="Present" />
        </div>
        <div className="col-span-2">
          <label className="label">Location</label>
          <input className="input" value={exp.location || ''} onChange={(e) => update('location', e.target.value)} placeholder="Remote" />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Bullet Points</label>
          <button onClick={addBullet} className="text-xs text-green-400 hover:text-green-300 font-medium">+ Add bullet</button>
        </div>
        <div className="space-y-2">
          {exp.bullets.map((bullet, bi) => (
            <div key={bi} className="flex gap-2 items-start">
              <span className="text-gray-400 mt-2 text-sm flex-shrink-0">•</span>
              <textarea
                className="input resize-none flex-1 text-sm"
                rows={2}
                value={bullet}
                onChange={(e) => updateBullet(bi, e.target.value)}
                placeholder="Describe your achievement with metrics..."
              />
              <button onClick={() => removeBullet(bi)} className="text-gray-300 hover:text-red-400 mt-2 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {exp.bullets.length === 0 && (
            <button onClick={addBullet} className="text-sm text-gray-500 hover:text-green-400 italic">Click to add first bullet</button>
          )}
        </div>
      </div>
    </div>
  )
}

function SkillsEditor({
  skills,
  onChange,
}: {
  skills: Record<string, string[]>
  onChange: (skills: Record<string, string[]>) => void
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({})

  const addSkill = (category: string) => {
    const val = (inputs[category] || '').trim()
    if (!val) return
    onChange({ ...skills, [category]: [...(skills[category] || []), val] })
    setInputs({ ...inputs, [category]: '' })
  }

  const removeSkill = (category: string, idx: number) => {
    const updated = skills[category].filter((_, i) => i !== idx)
    onChange({ ...skills, [category]: updated })
  }

  const categories = Object.keys(skills).length > 0 ? Object.keys(skills) : ['languages', 'frameworks', 'tools']

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat}>
          <label className="label capitalize">{cat}</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(skills[cat] || []).map((skill, idx) => (
              <span key={idx} className="inline-flex items-center justify-center gap-1 text-xs bg-green-500/20 text-green-300 border border-green-500/30 px-2.5 py-1 rounded-full leading-none">
                {skill}
                <button onClick={() => removeSkill(cat, idx)} className="hover:text-red-500 ml-0.5">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input text-sm flex-1"
              value={inputs[cat] || ''}
              onChange={(e) => setInputs({ ...inputs, [cat]: e.target.value })}
              placeholder={`Add ${cat} skill...`}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(cat) } }}
            />
            <button onClick={() => addSkill(cat)} className="btn-secondary text-sm px-3">Add</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Empty resume template ─────────────────────────────────────────────────────

const EMPTY_RESUME: ResumeData = {
  name: '', title: '', email: '', phone: '', location: '',
  linkedin: '', github: '', portfolio: '', photo: '',
  summary: '',
  experience: [],
  education: [],
  skills: { languages: [], frameworks: [], tools: [] },
  languages: [],
  projects: [],
}

const EMPTY_PROFILE_DATA = {
  personal: { first_name: '', last_name: '', email: '', phone: '', city: '', state: '', country: '', linkedin: '', github: '', portfolio: '' },
  work_authorization: { authorized_to_work_in_us: true, requires_sponsorship: false, citizenship_status: '' },
  salary: { desired_min: 0, desired_max: 0, currency: 'USD', negotiable: true },
  availability: { notice_period_weeks: 2, remote_preferred: true, willing_to_relocate: false },
  screening_defaults: { how_did_you_hear: 'LinkedIn', have_non_compete: false, felony_conviction: false },
}

// ── Skill input helper (used inside modal) ────────────────────────────────────

function SkillInput({ onAdd }: { onAdd: (val: string) => void }) {
  const [val, setVal] = useState('')
  const submit = () => { if (val.trim()) { onAdd(val.trim()); setVal('') } }
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      <input
        className="input"
        style={{ flex: 1 }}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        placeholder="Add skill…"
      />
      <button onClick={submit} className="btn-secondary" style={{ flexShrink: 0 }}>Add</button>
    </div>
  )
}

// ── Resume Import Preview Modal ───────────────────────────────────────────────

type ImportTab = 'contact' | 'experience' | 'education' | 'skills'

function ResumeImportModal({
  parsed,
  onApply,
  onCancel,
}: {
  parsed: ResumeData
  onApply: (data: ResumeData) => void
  onCancel: () => void
}) {
  const [data, setData] = useState<ResumeData>(parsed)
  const [tab, setTab] = useState<ImportTab>('contact')
  const set = (field: keyof ResumeData, value: any) => setData(d => ({ ...d, [field]: value }))

  const tabs: { key: ImportTab; label: string; count?: number }[] = [
    { key: 'contact',    label: 'Contact' },
    { key: 'experience', label: 'Experience', count: data.experience.length },
    { key: 'education',  label: 'Education',  count: data.education.length },
    { key: 'skills',     label: 'Skills',     count: Object.values(data.skills).flat().length },
  ]

  return createPortal(
    <div
      onClick={onCancel}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '660px', background: '#16181e', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', height: '82vh', maxHeight: '700px' }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>Resume Parsed — Review &amp; Edit</h2>
            <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: 0 }}>✕</button>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6b7280' }}>
            Review each section, make any edits, then click <strong style={{ color: '#d1d5db' }}>Apply to Profile</strong>.
          </p>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '8px 16px', fontSize: '13px', fontWeight: tab === t.key ? 600 : 400,
                  color: tab === t.key ? '#7DC242' : '#6b7280',
                  borderBottom: tab === t.key ? '2px solid #7DC242' : '2px solid transparent',
                  marginBottom: '-1px', display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'color 0.15s',
                }}
              >
                {t.label}
                {t.count !== undefined && (
                  <span style={{ fontSize: '11px', background: tab === t.key ? 'rgba(125,194,66,0.15)' : 'rgba(255,255,255,0.06)', color: tab === t.key ? '#7DC242' : '#6b7280', borderRadius: '999px', padding: '1px 7px', fontWeight: 500 }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minHeight: 0 }}>

          {/* ── Contact tab ── */}
          {tab === 'contact' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {([['name','Full Name'],['title','Professional Title'],['email','Email'],['phone','Phone'],['location','Location'],['linkedin','LinkedIn'],['github','GitHub'],['portfolio','Portfolio']] as [keyof ResumeData, string][]).map(([field, label]) => (
                  <div key={field}>
                    <label className="label">
                      {label}
                      {(field === 'name' || field === 'email') && <span style={{ color: '#f87171', marginLeft: '4px' }}>*</span>}
                      {field === 'name' && <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '4px' }}>(letters only)</span>}
                      {(field === 'linkedin' || field === 'github' || field === 'portfolio' || field === 'phone') && <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '4px' }}>(optional)</span>}
                    </label>                    <input
                      className="input"
                      type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                      value={(data[field] as string) || ''}
                      onChange={(e) => {
                        const v = e.target.value
                        if (field === 'name') set(field, v.replace(/[0-9]/g, ''))
                        else if (field === 'phone') set(field, v.replace(/[^0-9+\-()\s]/g, ''))
                        else set(field, v)
                      }}
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="label">Summary</label>
                <textarea className="input resize-none" rows={5} value={data.summary} onChange={(e) => set('summary', e.target.value)} />
              </div>
            </div>
          )}

          {/* ── Experience tab ── */}
          {tab === 'experience' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => set('experience', [...data.experience, { title: '', company: '', location: '', start_date: '', end_date: 'Present', bullets: [''] }])}
                  className="btn-secondary" style={{ fontSize: '13px' }}
                >+ Add Experience</button>
              </div>
              {data.experience.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#4b5563', fontSize: '14px' }}>No experience entries. Click + Add Experience to add one.</div>
              )}
              {data.experience.map((exp, i) => {
                const upd = (u: ResumeExperience) => { const a = [...data.experience]; a[i] = u; set('experience', a) }
                return (
                  <div key={i} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden' }}>
                    {/* Entry header */}
                    <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#d1d5db' }}>{exp.title || exp.company || `Experience #${i + 1}`}</span>
                      <button onClick={() => set('experience', data.experience.filter((_, idx) => idx !== i))} style={{ fontSize: '12px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                    </div>
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div><label className="label">Title</label><input className="input" value={exp.title} onChange={(e) => upd({ ...exp, title: e.target.value })} /></div>
                        <div><label className="label">Company</label><input className="input" value={exp.company} onChange={(e) => upd({ ...exp, company: e.target.value })} /></div>
                        <div><label className="label">Start</label><input className="input" value={exp.start_date} onChange={(e) => upd({ ...exp, start_date: e.target.value })} /></div>
                        <div><label className="label">End</label><input className="input" value={exp.end_date} onChange={(e) => upd({ ...exp, end_date: e.target.value })} /></div>
                        <div style={{ gridColumn: 'span 2' }}><label className="label">Location</label><input className="input" value={exp.location || ''} onChange={(e) => upd({ ...exp, location: e.target.value })} /></div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label className="label" style={{ marginBottom: 0 }}>Bullet Points</label>
                          <button onClick={() => upd({ ...exp, bullets: [...exp.bullets, ''] })} style={{ fontSize: '12px', color: '#4ade80', background: 'none', border: 'none', cursor: 'pointer' }}>+ Add</button>
                        </div>
                        {exp.bullets.map((b, bi) => (
                          <div key={bi} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '5px' }}>
                            <span style={{ color: '#6b7280', flexShrink: 0 }}>•</span>
                            <input className="input" style={{ flex: 1 }} value={b} onChange={(e) => { const bs = [...exp.bullets]; bs[bi] = e.target.value; upd({ ...exp, bullets: bs }) }} />
                            <button onClick={() => upd({ ...exp, bullets: exp.bullets.filter((_, idx) => idx !== bi) })} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Education tab ── */}
          {tab === 'education' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => set('education', [...data.education, { degree: '', institution: '', location: '', start_date: '', graduation: '' }])}
                  className="btn-secondary" style={{ fontSize: '13px' }}
                >+ Add Education</button>
              </div>
              {data.education.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#4b5563', fontSize: '14px' }}>No education entries.</div>
              )}
              {data.education.map((edu, i) => {
                const upd = (u: ResumeEducation) => { const a = [...data.education]; a[i] = u; set('education', a) }
                return (
                  <div key={i} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#d1d5db' }}>{edu.degree || edu.institution || `Education #${i + 1}`}</span>
                      <button onClick={() => set('education', data.education.filter((_, idx) => idx !== i))} style={{ fontSize: '12px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                    </div>
                    <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div><label className="label">Degree</label><input className="input" value={edu.degree} onChange={(e) => upd({ ...edu, degree: e.target.value })} /></div>
                      <div><label className="label">Institution</label><input className="input" value={edu.institution} onChange={(e) => upd({ ...edu, institution: e.target.value })} /></div>
                      <div><label className="label">Location</label><input className="input" value={edu.location || ''} onChange={(e) => upd({ ...edu, location: e.target.value })} /></div>
                      <div><label className="label">Start Date</label><input className="input" value={edu.start_date || ''} onChange={(e) => upd({ ...edu, start_date: e.target.value })} placeholder="Sep 2014" /></div>
                      <div><label className="label">Graduation</label><input className="input" value={edu.graduation} onChange={(e) => upd({ ...edu, graduation: e.target.value })} placeholder="Jun 2018" /></div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Skills tab ── */}
          {tab === 'skills' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {Object.entries(data.skills).map(([category, items]) => (
                <div key={category}>
                  <label className="label" style={{ textTransform: 'capitalize', marginBottom: '8px' }}>{category}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px', minHeight: '28px' }}>
                    {items.length === 0 && <span style={{ fontSize: '12px', color: '#4b5563', fontStyle: 'italic' }}>No {category} yet</span>}
                    {items.map((skill, si) => (
                      <span key={si} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(125,194,66,0.12)', border: '1px solid rgba(125,194,66,0.2)', color: '#7DC242', borderRadius: '999px', padding: '3px 10px', fontSize: '12px' }}>
                        {skill}
                        <button onClick={() => { const s = { ...data.skills }; s[category] = items.filter((_, idx) => idx !== si); set('skills', s) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7DC242', fontSize: '13px', padding: 0, lineHeight: 1, opacity: 0.7 }}>✕</button>
                      </span>
                    ))}
                  </div>
                  <SkillInput onAdd={(val) => { const s = { ...data.skills }; s[category] = [...items, val]; set('skills', s) }} />
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '10px', flexShrink: 0 }}>
          <button onClick={() => onApply(data)} className="btn-primary" style={{ flex: 1 }}>Apply to Profile</button>
          <button onClick={onCancel} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<Tab>('resume')
  const [profileName, setProfileName] = useState('')
  const [resume, setResume] = useState<ResumeData>(EMPTY_RESUME)
  const [profileData, setProfileData] = useState<Record<string, any>>(EMPTY_PROFILE_DATA)
  const [saved, setSaved] = useState(false)

  // Resume import state
  const [importParsing, setImportParsing] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<ResumeData | null>(null)

  // Portfolio image state — per-image load status and full-screen preview
  const [imgStatus, setImgStatus] = useState<Record<number, 'ok' | 'error'>>({})
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

  // Reset per-image status when the image list changes (re-validates on edit)
  useEffect(() => {
    setImgStatus({})
  }, [(resume as any).portfolio_images?.length])

  // Close preview with ESC
  useEffect(() => {
    if (!previewSrc) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewSrc(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewSrc])

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', id],
    queryFn: () => profilesApi.get(Number(id)),
    enabled: !!id,
  })

  useEffect(() => {
    if (profile) {
      setProfileName(profile.name)
      setResume(profile.resume_data ? { ...EMPTY_RESUME, ...profile.resume_data } : EMPTY_RESUME)
      setProfileData(profile.profile_data ? { ...EMPTY_PROFILE_DATA, ...profile.profile_data } : EMPTY_PROFILE_DATA)
    }
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: () => profilesApi.update(Number(id), {
      name: profileName,
      resume_data: sanitizeResumeForSave(resume),
      profile_data: profileData,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      queryClient.invalidateQueries({ queryKey: ['profile', id] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const addExperience = () => {
    setResume({
      ...resume,
      experience: [...resume.experience, {
        title: '', company: '', location: 'Remote', start_date: '', end_date: 'Present', bullets: [''],
      }],
    })
  }

  const addEducation = () => {
    setResume({
      ...resume,
      education: [...resume.education, { degree: '', institution: '', location: '', start_date: '', graduation: '' }],
    })
  }

  const handleResumeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportError(null)
    setImportParsing(true)
    try {
      const parsed = await profilesApi.parseResume(file)
      setImportPreview(parsed)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to parse resume.'
      setImportError(msg)
    } finally {
      setImportParsing(false)
    }
  }

  if (isLoading) return <Spinner />

  const tabs: { key: Tab; label: string }[] = [
    { key: 'resume', label: 'Resume' },
    { key: 'personal', label: 'Personal Info' },
    { key: 'availability', label: 'Availability & Screening' },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/profiles')} className="btn-secondary text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
        <div className="flex-1">
          <input
            className="text-2xl font-bold bg-transparent border-b-2 border-transparent hover:border-white/20 focus:border-green-500 focus:outline-none w-full py-0.5"
            style={{ color: 'var(--text-primary)' }}
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Profile name"
          />
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="btn-primary"
        >
          {saveMutation.isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border-muted)' }}>
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.key
                  ? '-mb-px text-green-400 font-semibold'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              style={activeTab === tab.key ? { background: 'rgba(125,194,66,0.1)', borderBottom: '2px solid #7DC242' } : {}}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Resume tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'resume' && (
        <div className="space-y-6">
          {/* Contact */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Contact Information</h3>
              <div className="flex items-center gap-2">
                {importParsing && (
                  <span className="text-xs text-gray-400 animate-pulse">Parsing resume...</span>
                )}
                {importError && (
                  <span className="text-xs text-red-400">{importError}</span>
                )}
                <label htmlFor="resume-import-upload" className="btn-secondary text-sm cursor-pointer">
                  Import from Resume
                </label>
                <input
                  type="file"
                  id="resume-import-upload"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={handleResumeFileChange}
                  disabled={importParsing}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name</label>
                <input className="input" value={resume.name} onChange={(e) => setResume({ ...resume, name: e.target.value })} placeholder="John Doe" />
              </div>
              <div>
                <label className="label">Professional Title</label>
                <input className="input" value={resume.title} onChange={(e) => setResume({ ...resume, title: e.target.value })} placeholder="Full Stack WordPress Developer" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={resume.email} onChange={(e) => setResume({ ...resume, email: e.target.value })} placeholder="john@email.com" />
              </div>
              <div>
                <label className="label">Phone <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '4px' }}>(numeric value only)</span></label>
                <input className="input" type="tel" value={resume.phone} onChange={(e) => setResume({ ...resume, phone: e.target.value.replace(/[^0-9+\-()\s]/g, '') })} placeholder="+1-555-000-0000" />
              </div>
              <div>
                <label className="label">Location</label>
                <input className="input" value={resume.location} onChange={(e) => setResume({ ...resume, location: e.target.value })} placeholder="New York, NY (Remote)" />
              </div>
              <div>
                <label className="label">LinkedIn URL <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '4px' }}>(optional)</span></label>
                <input className="input" value={resume.linkedin || ''} onChange={(e) => setResume({ ...resume, linkedin: e.target.value })} placeholder="linkedin.com/in/johndoe" />
              </div>
              <div>
                <label className="label">GitHub URL <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '4px' }}>(optional)</span></label>
                <input className="input" value={resume.github || ''} onChange={(e) => setResume({ ...resume, github: e.target.value })} placeholder="github.com/johndoe" />
              </div>
              <div>
                <label className="label">Portfolio URL <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '4px' }}>(optional)</span></label>
                <input className="input" value={resume.portfolio || ''} onChange={(e) => setResume({ ...resume, portfolio: e.target.value })} placeholder="johndoe.dev" />
              </div>
              <div className="col-span-2">
                <label className="label">Profile Photo <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '4px' }}>(optional)</span></label>
                <div className="flex items-center gap-4">
                  {resume.photo ? (
                    <img src={resume.photo} className="w-16 h-16 rounded-full object-cover flex-shrink-0" style={{ border: '2px solid #7DC242' }} alt="Profile" />
                  ) : (
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0" style={{ background: 'var(--bg-surface-hover)', border: '2px solid var(--border-default)', color: '#7DC242' }}>
                      {resume.name ? resume.name[0].toUpperCase() : '?'}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <label htmlFor="photo-upload" className="btn-secondary text-sm cursor-pointer">
                      {resume.photo ? 'Change Photo' : 'Upload Photo'}
                    </label>
                    <input
                      type="file"
                      id="photo-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = (ev) => setResume({ ...resume, photo: ev.target?.result as string })
                        reader.readAsDataURL(file)
                      }}
                    />
                    {resume.photo && (
                      <button onClick={() => setResume({ ...resume, photo: '' })} className="text-sm text-red-400 hover:text-red-300">Remove</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-white">Professional Summary</h3>
            <p className="text-xs text-gray-500">This is tailored by AI for each job — write your base summary here.</p>
            <textarea
              className="input resize-none"
              rows={4}
              value={resume.summary}
              onChange={(e) => setResume({ ...resume, summary: e.target.value })}
              placeholder="Full Stack Developer with 5+ years building scalable WordPress solutions..."
            />
          </div>

          {/* Experience */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Experience</h3>
              <button onClick={addExperience} className="btn-secondary text-sm">+ Add Experience</button>
            </div>
            {resume.experience.length === 0 && (
              <p className="text-sm text-gray-400 italic text-center py-4">No experience entries yet.</p>
            )}
            {resume.experience.map((exp, idx) => (
              <ExperienceEntry
                key={idx}
                exp={exp}
                index={idx}
                onChange={(i, updated) => {
                  const exps = [...resume.experience]
                  exps[i] = updated
                  setResume({ ...resume, experience: exps })
                }}
                onRemove={(i) => setResume({ ...resume, experience: resume.experience.filter((_, x) => x !== i) })}
              />
            ))}
          </div>

          {/* Education */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Education</h3>
              <button onClick={addEducation} className="btn-secondary text-sm">+ Add Education</button>
            </div>
            {resume.education.map((edu, idx) => (
              <div key={idx} className="border rounded-xl p-4 grid grid-cols-2 gap-3" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-surface-alt)' }}>
                <div>
                  <label className="label">Degree</label>
                  <input className="input" value={edu.degree} onChange={(e) => {
                    const ed = [...resume.education]; ed[idx] = { ...ed[idx], degree: e.target.value }; setResume({ ...resume, education: ed })
                  }} placeholder="B.S. Computer Science" />
                </div>
                <div>
                  <label className="label">Institution</label>
                  <input className="input" value={edu.institution} onChange={(e) => {
                    const ed = [...resume.education]; ed[idx] = { ...ed[idx], institution: e.target.value }; setResume({ ...resume, education: ed })
                  }} placeholder="State University" />
                </div>
                <div>
                  <label className="label">Start Date</label>
                  <input className="input" value={edu.start_date || ''} onChange={(e) => {
                    const ed = [...resume.education]; ed[idx] = { ...ed[idx], start_date: e.target.value }; setResume({ ...resume, education: ed })
                  }} placeholder="Sep 2014" />
                </div>
                <div>
                  <label className="label">Graduation</label>
                  <input className="input" value={edu.graduation} onChange={(e) => {
                    const ed = [...resume.education]; ed[idx] = { ...ed[idx], graduation: e.target.value }; setResume({ ...resume, education: ed })
                  }} placeholder="May 2019" />
                </div>
                <div className="col-span-2 flex justify-end">
                  <button
                    onClick={() => setResume({ ...resume, education: resume.education.filter((_, x) => x !== idx) })}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {resume.education.length === 0 && (
              <p className="text-sm text-gray-400 italic text-center py-4">No education entries yet.</p>
            )}
          </div>

          {/* Skills */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-white">Skills</h3>
            <SkillsEditor
              skills={resume.skills}
              onChange={(skills) => setResume({ ...resume, skills })}
            />
          </div>

          {/* Key Achievements */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Key Achievements</h3>
                <p className="text-xs text-gray-500 mt-0.5">Optional — used by the Arham template. If empty, Claude will generate them from your experience.</p>
              </div>
              <button
                onClick={() => setResume({ ...resume, key_achievements: [...(resume.key_achievements || []), ''] })}
                className="btn-secondary text-sm"
              >+ Add Achievement</button>
            </div>
            <div className="space-y-2">
              {(resume.key_achievements || []).map((ach, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="text-gray-400 mt-2 text-sm flex-shrink-0">•</span>
                  <textarea
                    className="input resize-none flex-1 text-sm"
                    rows={2}
                    value={ach}
                    onChange={(e) => {
                      const achs = [...(resume.key_achievements || [])]
                      achs[idx] = e.target.value
                      setResume({ ...resume, key_achievements: achs })
                    }}
                    placeholder="Built and delivered 50+ custom WordPress websites on time and on budget…"
                  />
                  <button
                    onClick={() => setResume({ ...resume, key_achievements: (resume.key_achievements || []).filter((_, i) => i !== idx) })}
                    className="text-gray-300 hover:text-red-400 mt-2 flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {!(resume.key_achievements || []).length && (
                <button
                  onClick={() => setResume({ ...resume, key_achievements: [''] })}
                  className="text-sm text-gray-500 hover:text-green-400 italic"
                >Click to add first achievement</button>
              )}
            </div>
          </div>

          {/* Languages */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Languages</h3>
                <p className="text-xs text-gray-500 mt-0.5">Spoken/written languages — shown in the Muhammad Waqar template.</p>
              </div>
              <button
                onClick={() => setResume({ ...resume, languages: [...(resume.languages || []), { name: '', level: 'Native', proficiency: 5 }] })}
                className="btn-secondary text-sm"
              >+ Add Language</button>
            </div>
            {(resume.languages || []).map((lang: ResumeLanguage, idx: number) => (
              <div key={idx} className="border rounded-xl p-4 grid grid-cols-3 gap-3" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-surface-alt)' }}>
                <div>
                  <label className="label">Language</label>
                  <input className="input" value={lang.name} onChange={(e) => {
                    const ls = [...(resume.languages || [])]; ls[idx] = { ...ls[idx], name: e.target.value }; setResume({ ...resume, languages: ls })
                  }} placeholder="English" />
                </div>
                <div>
                  <label className="label">Level</label>
                  <input className="input" value={lang.level} onChange={(e) => {
                    const ls = [...(resume.languages || [])]; ls[idx] = { ...ls[idx], level: e.target.value }; setResume({ ...resume, languages: ls })
                  }} placeholder="Native" />
                </div>
                <div>
                  <label className="label">Proficiency (1–5)</label>
                  <input className="input" type="number" min={1} max={5} value={lang.proficiency} onChange={(e) => {
                    const ls = [...(resume.languages || [])]; ls[idx] = { ...ls[idx], proficiency: Math.min(5, Math.max(1, Number(e.target.value))) }; setResume({ ...resume, languages: ls })
                  }} />
                </div>
                <div className="col-span-3 flex justify-end">
                  <button onClick={() => setResume({ ...resume, languages: (resume.languages || []).filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
                </div>
              </div>
            ))}
            {!(resume.languages || []).length && (
              <p className="text-sm text-gray-400 italic text-center py-2">No languages added yet.</p>
            )}
          </div>

          {/* Projects */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Projects</h3>
                <p className="text-xs text-gray-500 mt-0.5">Side projects, personal projects, final year projects — shown in the Muhammad Waqar template.</p>
              </div>
              <button
                onClick={() => setResume({ ...resume, projects: [...(resume.projects || []), { name: '', start_date: '', end_date: '', description: '', bullets: [''] }] })}
                className="btn-secondary text-sm"
              >+ Add Project</button>
            </div>
            {(resume.projects || []).map((proj: ResumeProject, idx: number) => (
              <div key={idx} className="border rounded-xl p-4 space-y-3" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-surface-alt)' }}>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3">
                    <label className="label">Project Name</label>
                    <input className="input" value={proj.name} onChange={(e) => {
                      const ps = [...(resume.projects || [])]; ps[idx] = { ...ps[idx], name: e.target.value }; setResume({ ...resume, projects: ps })
                    }} placeholder="Face Recognition Attendance System" />
                  </div>
                  <div>
                    <label className="label">Start Date</label>
                    <input className="input" value={proj.start_date || ''} onChange={(e) => {
                      const ps = [...(resume.projects || [])]; ps[idx] = { ...ps[idx], start_date: e.target.value }; setResume({ ...resume, projects: ps })
                    }} placeholder="Jan 2020" />
                  </div>
                  <div>
                    <label className="label">End Date</label>
                    <input className="input" value={proj.end_date || ''} onChange={(e) => {
                      const ps = [...(resume.projects || [])]; ps[idx] = { ...ps[idx], end_date: e.target.value }; setResume({ ...resume, projects: ps })
                    }} placeholder="Mar 2020" />
                  </div>
                  <div className="col-span-3">
                    <label className="label">Description</label>
                    <input className="input" value={proj.description || ''} onChange={(e) => {
                      const ps = [...(resume.projects || [])]; ps[idx] = { ...ps[idx], description: e.target.value }; setResume({ ...resume, projects: ps })
                    }} placeholder="A real-time attendance system using face recognition" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="label">Bullets</label>
                  {(proj.bullets || []).map((b: string, bi: number) => (
                    <div key={bi} className="flex gap-2 items-start">
                      <span className="text-gray-400 mt-2 text-sm flex-shrink-0">•</span>
                      <input className="input flex-1 text-sm" value={b} onChange={(e) => {
                        const ps = [...(resume.projects || [])]; const bs = [...ps[idx].bullets]; bs[bi] = e.target.value; ps[idx] = { ...ps[idx], bullets: bs }; setResume({ ...resume, projects: ps })
                      }} placeholder="Built using Python and OpenCV…" />
                      <button onClick={() => {
                        const ps = [...(resume.projects || [])]; ps[idx] = { ...ps[idx], bullets: ps[idx].bullets.filter((_, i) => i !== bi) }; setResume({ ...resume, projects: ps })
                      }} className="text-gray-400 hover:text-red-400 mt-2 flex-shrink-0">✕</button>
                    </div>
                  ))}
                  <button onClick={() => {
                    const ps = [...(resume.projects || [])]; ps[idx] = { ...ps[idx], bullets: [...ps[idx].bullets, ''] }; setResume({ ...resume, projects: ps })
                  }} className="text-xs text-gray-500 hover:text-green-400">+ Add bullet</button>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setResume({ ...resume, projects: (resume.projects || []).filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-300 text-sm">Remove Project</button>
                </div>
              </div>
            ))}
            {!(resume.projects || []).length && (
              <p className="text-sm text-gray-400 italic text-center py-2">No projects added yet.</p>
            )}
          </div>

          {/* Useful Links */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Useful Links</h3>
                <p className="text-xs text-gray-500 mt-0.5">Portfolio/project URLs shown in the Adeel Shahzad and Mirza Waleed templates.</p>
              </div>
              <button
                onClick={() => setResume({ ...resume, useful_links: [...(resume.useful_links || []), ''] })}
                className="btn-secondary text-sm"
              >+ Add Link</button>
            </div>
            {(resume.useful_links || []).map((link: string, idx: number) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  className="input flex-1 text-sm"
                  value={link}
                  onChange={(e) => {
                    const ls = [...(resume.useful_links || [])]; ls[idx] = e.target.value; setResume({ ...resume, useful_links: ls })
                  }}
                  placeholder="https://yourproject.com"
                />
                <button onClick={() => setResume({ ...resume, useful_links: (resume.useful_links || []).filter((_: string, i: number) => i !== idx) })} className="text-red-400 hover:text-red-300 text-sm flex-shrink-0">✕</button>
              </div>
            ))}
            {!(resume.useful_links || []).length && (
              <p className="text-sm text-gray-400 italic text-center py-2">No links added yet.</p>
            )}
          </div>

          {/* Portfolio Images */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Portfolio Screenshots</h3>
                <p className="text-xs text-gray-500 mt-0.5">Up to 4 screenshots — shown as a fixed-size grid in the Adeel Shahzad and Mirza Waleed templates.</p>
              </div>
              <div className="flex gap-2">
                <label className="btn-secondary text-sm cursor-pointer">
                  ↑ Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = (ev) => {
                        const dataUrl = ev.target?.result as string
                        setResume((r: any) => ({ ...r, portfolio_images: [...(r.portfolio_images || []), dataUrl] }))
                      }
                      reader.readAsDataURL(file)
                      e.target.value = ''
                    }}
                  />
                </label>
                <button
                  onClick={() => setResume({ ...resume, portfolio_images: [...(resume.portfolio_images || []), ''] })}
                  className="btn-secondary text-sm"
                >+ URL</button>
              </div>
            </div>
            {(resume.portfolio_images || []).length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {(resume.portfolio_images || []).slice(0, 4).map((img: string, idx: number) => {
                  const failed = imgStatus[idx] === 'error'
                  const isEmpty = !img || !img.trim()
                  return (
                    <div key={idx} className="relative group">
                      {failed || isEmpty ? (
                        <div className="w-full h-24 rounded flex flex-col items-center justify-center text-center px-2"
                             style={{ background: 'rgba(239,68,68,0.08)', border: '1px dashed rgba(239,68,68,0.35)' }}>
                          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#fca5a5' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z" />
                          </svg>
                          <span className="text-[10px] font-medium leading-tight" style={{ color: '#fca5a5' }}>
                            {isEmpty ? 'No URL provided' : 'Image not accessible'}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPreviewSrc(img)}
                          className="w-full h-24 rounded overflow-hidden block cursor-zoom-in"
                          style={{ padding: 0, border: 'none', background: 'rgba(255,255,255,0.04)' }}
                          title="Click to preview full-size"
                        >
                          <img
                            src={img}
                            alt=""
                            className="w-full h-full object-cover"
                            onLoad={() => setImgStatus(s => ({ ...s, [idx]: 'ok' }))}
                            onError={() => setImgStatus(s => ({ ...s, [idx]: 'error' }))}
                          />
                        </button>
                      )}
                      <button
                        onClick={() => setResume({ ...resume, portfolio_images: (resume.portfolio_images || []).filter((_: string, i: number) => i !== idx) })}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove image"
                      >✕</button>
                    </div>
                  )
                })}
              </div>
            )}
            {(resume.portfolio_images || []).some((img: string) => !img.startsWith('data:')) && (
              <div className="space-y-2">
                {(resume.portfolio_images || []).map((img: string, idx: number) => !img.startsWith('data:') && (
                  <div key={idx} className="flex flex-col gap-1">
                    <div className="flex gap-2 items-center">
                      <input
                        className="input flex-1 text-sm"
                        value={img}
                        onChange={(e) => {
                          const imgs = [...(resume.portfolio_images || [])]; imgs[idx] = e.target.value; setResume({ ...resume, portfolio_images: imgs })
                        }}
                        placeholder="https://cdn.yoursite.com/screenshot.png"
                      />
                      <button onClick={() => setResume({ ...resume, portfolio_images: (resume.portfolio_images || []).filter((_: string, i: number) => i !== idx) })} className="text-red-400 hover:text-red-300 text-sm flex-shrink-0">✕</button>
                    </div>
                    {img.trim() && imgStatus[idx] === 'error' && (
                      <p className="text-xs flex items-center gap-1.5" style={{ color: '#fca5a5' }}>
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Image URL is not accessible — check the link or hosting permissions.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!(resume.portfolio_images || []).length && (
              <p className="text-sm text-gray-400 italic text-center py-2">Upload images or paste direct image URLs — max 4.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Personal Info tab ────────────────────────────────────────────────── */}
      {activeTab === 'personal' && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <h3 className="font-semibold text-white">Personal Details</h3>
            <p className="text-xs text-gray-500">Used for job application form auto-fill (future feature).</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['first_name', 'First Name', 'John'],
                ['last_name', 'Last Name', 'Doe'],
                ['email', 'Email', 'john@email.com'],
                ['phone', 'Phone', '+1-555-000-0000'],
                ['city', 'City', 'New York'],
                ['state', 'State', 'NY'],
                ['country', 'Country', 'United States'],
              ].map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input
                    className="input"
                    value={(profileData.personal?.[key] as string) || ''}
                    onChange={(e) => setProfileData({
                      ...profileData,
                      personal: { ...profileData.personal, [key]: e.target.value }
                    })}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="card space-y-4">
            <h3 className="font-semibold text-white">Work Authorization</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auth_us"
                  checked={!!profileData.work_authorization?.authorized_to_work_in_us}
                  onChange={(e) => setProfileData({
                    ...profileData,
                    work_authorization: { ...profileData.work_authorization, authorized_to_work_in_us: e.target.checked }
                  })}
                  className="w-4 h-4 rounded border-white/20 text-green-500 focus:ring-green-500 bg-white/5"
                />
                <label htmlFor="auth_us" className="text-sm text-gray-300">Authorized to work in US</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sponsorship"
                  checked={!!profileData.work_authorization?.requires_sponsorship}
                  onChange={(e) => setProfileData({
                    ...profileData,
                    work_authorization: { ...profileData.work_authorization, requires_sponsorship: e.target.checked }
                  })}
                  className="w-4 h-4 rounded border-white/20 text-green-500 focus:ring-green-500 bg-white/5"
                />
                <label htmlFor="sponsorship" className="text-sm text-gray-300">Requires sponsorship</label>
              </div>
              <div className="col-span-2">
                <label className="label">Citizenship Status</label>
                <input
                  className="input"
                  value={(profileData.work_authorization?.citizenship_status as string) || ''}
                  onChange={(e) => setProfileData({
                    ...profileData,
                    work_authorization: { ...profileData.work_authorization, citizenship_status: e.target.value }
                  })}
                  placeholder="US Citizen / Permanent Resident / OPT / H1B..."
                />
              </div>
            </div>
          </div>

          <div className="card space-y-4">
            <h3 className="font-semibold text-white">Salary Expectations</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Minimum (USD/yr)</label>
                <input
                  className="input" type="number"
                  value={(profileData.salary?.desired_min as number) || ''}
                  onChange={(e) => setProfileData({ ...profileData, salary: { ...profileData.salary, desired_min: Number(e.target.value.replace(/[^0-9]/g, '')) } })}
                  placeholder="80000"
                />
              </div>
              <div>
                <label className="label">Maximum (USD/yr)</label>
                <input
                  className="input" type="number"
                  value={(profileData.salary?.desired_max as number) || ''}
                  onChange={(e) => setProfileData({ ...profileData, salary: { ...profileData.salary, desired_max: Number(e.target.value) } })}
                  placeholder="120000"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox" id="negotiable"
                  checked={!!profileData.salary?.negotiable}
                  onChange={(e) => setProfileData({ ...profileData, salary: { ...profileData.salary, negotiable: e.target.checked } })}
                  className="w-4 h-4 rounded border-white/20 text-green-500 focus:ring-green-500 bg-white/5"
                />
                <label htmlFor="negotiable" className="text-sm text-gray-300">Negotiable</label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Availability tab ─────────────────────────────────────────────────── */}
      {activeTab === 'availability' && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <h3 className="font-semibold text-white">Availability</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Notice Period (weeks)</label>
                <input
                  className="input" type="number"
                  value={(profileData.availability?.notice_period_weeks as number) || 2}
                  onChange={(e) => setProfileData({ ...profileData, availability: { ...profileData.availability, notice_period_weeks: Number(e.target.value) } })}
                />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox" id="remote_pref"
                  checked={!!profileData.availability?.remote_preferred}
                  onChange={(e) => setProfileData({ ...profileData, availability: { ...profileData.availability, remote_preferred: e.target.checked } })}
                  className="w-4 h-4 rounded border-white/20 text-green-500 focus:ring-green-500 bg-white/5"
                />
                <label htmlFor="remote_pref" className="text-sm text-gray-300">Prefer remote work</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox" id="relocate"
                  checked={!!profileData.availability?.willing_to_relocate}
                  onChange={(e) => setProfileData({ ...profileData, availability: { ...profileData.availability, willing_to_relocate: e.target.checked } })}
                  className="w-4 h-4 rounded border-white/20 text-green-500 focus:ring-green-500 bg-white/5"
                />
                <label htmlFor="relocate" className="text-sm text-gray-300">Willing to relocate</label>
              </div>
            </div>
          </div>

          <div className="card space-y-4">
            <h3 className="font-semibold text-white">Screening Defaults</h3>
            <p className="text-xs text-gray-500">Default answers for common application screening questions.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">How did you hear about us?</label>
                <input
                  className="input"
                  value={(profileData.screening_defaults?.how_did_you_hear as string) || 'LinkedIn'}
                  onChange={(e) => setProfileData({ ...profileData, screening_defaults: { ...profileData.screening_defaults, how_did_you_hear: e.target.value } })}
                  placeholder="LinkedIn"
                />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox" id="non_compete"
                  checked={!!profileData.screening_defaults?.have_non_compete}
                  onChange={(e) => setProfileData({ ...profileData, screening_defaults: { ...profileData.screening_defaults, have_non_compete: e.target.checked } })}
                  className="w-4 h-4 rounded border-white/20 text-green-500 focus:ring-green-500 bg-white/5"
                />
                <label htmlFor="non_compete" className="text-sm text-gray-300">Has non-compete agreement</label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky save bar */}
      <div className="-mx-8 px-8 py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-muted)' }}>
        {saveMutation.isError && (
          <p className="text-sm text-red-400">Save failed — please try again.</p>
        )}
        {saved && <p className="text-sm text-green-400 font-medium">✓ Profile saved successfully</p>}
        {!saveMutation.isError && !saved && <span />}
        <div className="flex gap-3">
          <button onClick={() => navigate('/profiles')} className="btn-secondary">Back to Profiles</button>
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary">
            {saveMutation.isPending ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Resume Import Preview Modal */}
      {importPreview && (
        <ResumeImportModal
          parsed={importPreview}
          onApply={(data) => {
            setResume(data)
            setImportPreview(null)
          }}
          onCancel={() => setImportPreview(null)}
        />
      )}

      {/* Full-screen image preview */}
      {previewSrc && createPortal(
        <div
          onClick={() => setPreviewSrc(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 32, cursor: 'zoom-out',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setPreviewSrc(null) }}
            aria-label="Close preview"
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)', color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 18, lineHeight: 1,
            }}
          >✕</button>
          <img
            src={previewSrc}
            alt="Preview"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '92vw', maxHeight: '88vh',
              objectFit: 'contain',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              borderRadius: 8, cursor: 'default',
            }}
          />
        </div>,
        document.body
      )}
    </div>
  )
}
