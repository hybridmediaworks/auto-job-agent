import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi, profilesApi, tailorApi } from '@/services/api'
import type { TailoredApplication } from '@/types'
import { PIPELINE_STAGES, TERMINAL_STATUSES } from '@/types'
import SI_ICONS_MAP, { FALLBACK_BRANDS, ICON_ALIASES } from '@/assets/tool-icons'
import { CustomSelect } from '@/components/CustomSelect'

const ALL_STATUSES = [...PIPELINE_STAGES, ...TERMINAL_STATUSES]

// ── Resume Template Helpers ────────────────────────────────────────────────────

const PILL_COLORS = ['#1565c0','#00695c','#6a1b9a','#1b5e20','#bf360c','#0277bd','#4a148c','#006064']

type SiIcon = { path: string; hex: string; bg?: string; textColor?: string }
type ToolEntry = { label: string; bg: string; textColor?: string; abbr: string; siIcon?: SiIcon }

// Resolve tool names → display entries using local category icon maps
function resolveTools(toolNames: string[]): ToolEntry[] {
  const seen = new Set<string>()
  const result: ToolEntry[] = []
  for (const name of toolNames) {
    const key = name.toLowerCase().trim()
    if (seen.has(key)) continue
    seen.add(key)
    const resolvedKey = ICON_ALIASES[key] ?? key
    const si = SI_ICONS_MAP[resolvedKey]
    if (si) {
      const bg = si.bg ?? ('#' + si.hex)
      const textColor = si.textColor
      const abbr = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || '??'
      result.push({ label: name, bg, textColor, abbr, siIcon: si })
    } else {
      const fb = FALLBACK_BRANDS[resolvedKey] ?? FALLBACK_BRANDS[key]
      if (fb) {
        result.push({ label: name, bg: fb.bg, textColor: fb.textColor, abbr: fb.abbr })
      } else {
        // Smart prefix-based normalization — avoids all "AMA" boxes
        let abbr: string
        let bg: string
        let textColor: string | undefined

        if (key.startsWith('amazon ') || key === 'amazon') {
          // Extract service name after "amazon " for abbreviation
          const service = key.startsWith('amazon ') ? key.slice(7) : 'aws'
          abbr = service.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'AWS'
          bg = '#FF9900'
          textColor = '#000000'
        } else if (key.startsWith('aws ')) {
          const service = key.slice(4)
          abbr = service.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'AWS'
          bg = '#FF9900'
          textColor = '#000000'
        } else if (key.startsWith('google ')) {
          const service = key.slice(7)
          abbr = service.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'GGL'
          bg = '#4285f4'
        } else if (key.startsWith('microsoft ') || key.startsWith('ms ')) {
          const service = key.startsWith('microsoft ') ? key.slice(10) : key.slice(3)
          abbr = service.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'MS'
          bg = '#0078d4'
        } else {
          // Generic: deterministic color + initials
          abbr = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || '??'
          const colorIdx = Math.abs((key.charCodeAt(0) || 0) + (key.charCodeAt(1) || 0)) % PILL_COLORS.length
          bg = PILL_COLORS[colorIdx]
        }
        result.push({ label: name, bg, textColor, abbr })
      }
    }
  }
  return result
}

function companyBgColor(name: string): string {
  const colors = ['#1565c0','#00695c','#6a1b9a','#1b5e20','#c62828','#0277bd','#e65100','#37474f']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0x7fffffff
  return colors[hash % colors.length]
}

function ToolIconBox({ label, bg, textColor, abbr, siIcon, size = 40 }: ToolEntry & { size?: number }) {
  const iconSz = Math.round(size * 0.58)
  const fill = textColor || 'white'
  return (
    <div
      title={label}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.22), background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
    >
      {siIcon ? (
        <svg viewBox="0 0 24 24" width={iconSz} height={iconSz} fill={fill} style={{ display: 'block' }}>
          <path d={siIcon.path} />
        </svg>
      ) : (
        <span style={{ color: fill, fontSize: Math.max(7, Math.round(size * 0.24)), fontWeight: 700, letterSpacing: -0.5, fontFamily: 'Arial, sans-serif', lineHeight: 1 }}>{abbr}</span>
      )}
    </div>
  )
}

// ── Mirza Waleed Template — exact match to reference ──────────────────────
// Layout: White page. Full-width white header (photo + name + title + green bar + contact row).
// Green thick divider. Left col: Experience + Education. Right col: About Me + Skills + Tools + Portfolio.

function ensureUrl(url: string): string {
  if (!url) return url
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function cleanText(text: string): string {
  if (!text) return text
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^[\-\–\—]\s+/gm, '')
    .replace(/^#+\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
}

function WaleedTemplate({ data, photo }: { data: Record<string, any>; photo?: string }) {
  const tools = resolveTools(data.tools_list || []).slice(0, 7)
  const skills: string[] = data.skills_list || []
  const experience: any[] = data.experience || []
  const education: any[] = data.education || []
  const effectivePhoto = photo || data.photo

  // Shared section header style for this template
  const SectionHeader = ({ label }: { label: string }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', letterSpacing: 2.5, textTransform: 'uppercase' as const }}>{label}</div>
      <div style={{ height: 1.5, background: '#d1d5db', marginTop: 5 }} />
    </div>
  )

  return (
    <div style={{ width: 794, minHeight: 1085, fontFamily: 'Arial, Helvetica, sans-serif', background: '#ffffff', boxSizing: 'border-box' as const }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '26px 32px 18px 32px', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {/* Profile photo */}
          {effectivePhoto ? (
            <img
              src={effectivePhoto}
              crossOrigin="anonymous"
              style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover' as const, flexShrink: 0 }}
              alt="Profile"
            />
          ) : (
            <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#f1f5f9', display: 'inline-block', textAlign: 'center', lineHeight: '90px', fontSize: 34, fontWeight: 800, color: '#7DC242', flexShrink: 0, verticalAlign: 'top' }}>
              {(data.name || '?')[0]?.toUpperCase()}
            </div>
          )}
          {/* Name + title */}
          <div>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#111827', letterSpacing: 0.5, lineHeight: 1.1, textTransform: 'uppercase' as const }}>{data.name}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginTop: 5, letterSpacing: 1.8, textTransform: 'uppercase' as const }}>{data.role_title || data.title}</div>
            <div style={{ height: 3, background: '#7DC242', marginTop: 9, borderRadius: 2 }} />
          </div>
        </div>
        {/* Contact row */}
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '4px 22px', marginTop: 14, fontSize: 10.5, color: '#4b5563' }}>
          {data.location && <span>📍 {data.location}</span>}
          {data.phone && <span>📞 {data.phone}</span>}
          {data.email && <span>✉ <a href={`mailto:${data.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{data.email}</a></span>}
          {data.linkedin && <span>🔗 <a href={ensureUrl(data.linkedin)} style={{ color: 'inherit', textDecoration: 'none' }}>{data.linkedin}</a></span>}
          {data.github && <span>💻 <a href={ensureUrl(data.github)} style={{ color: 'inherit', textDecoration: 'none' }}>{data.github}</a></span>}
          {data.portfolio && <span>🌐 <a href={ensureUrl(data.portfolio)} style={{ color: 'inherit', textDecoration: 'none' }}>{data.portfolio}</a></span>}
        </div>
      </div>

      {/* ── GREEN DIVIDER ── */}
      <div style={{ height: 5, background: '#7DC242' }} />

      {/* ── BODY ── */}
      <div style={{ display: 'flex', padding: '22px 32px 32px 32px', gap: 0 }}>

        {/* LEFT — Experience + Education (~58%) */}
        <div style={{ flex: '0 0 57%', paddingRight: 26, minWidth: 0 }}>

          {experience.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader label="Experience" />
              {experience.map((exp: any, i: number) => {
                const color = companyBgColor(exp.company || '')
                return (
                  <div key={i} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 5 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: color, display: 'inline-block', textAlign: 'center', lineHeight: '36px', color: 'white', fontWeight: 800, fontSize: 16, flexShrink: 0, fontFamily: 'Arial, sans-serif', verticalAlign: 'top' }}>
                        {(exp.company || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#111827', lineHeight: 1.3 }}>{exp.title}</div>
                        <div style={{ fontSize: 11, color, fontWeight: 600 }}>{exp.company}</div>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>{exp.start_date} – {exp.end_date || 'Present'}</div>
                      </div>
                    </div>
                    {(exp.bullets || []).map((b: string, j: number) => (
                      <div key={j} style={{ display: 'flex', gap: 5, marginLeft: 46, marginBottom: 2 }}>
                        <span style={{ color: '#7DC242', fontSize: 11, lineHeight: '1.6', flexShrink: 0 }}>•</span>
                        <span style={{ fontSize: 10.5, color: '#374151', lineHeight: 1.6 }}>{cleanText(b)}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {education.length > 0 && (
            <div>
              <SectionHeader label="Education" />
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' as const }}>
                {education.map((edu: any, i: number) => (
                  <div key={i} style={{ flex: '1 1 180px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 11.5, color: '#111827' }}>{edu.institution}</div>
                    <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>{edu.degree}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{edu.graduation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — About Me + Skills + Tools + Portfolio (~43%) */}
        <div style={{ flex: '0 0 43%', paddingLeft: 22, borderLeft: '1.5px solid #e5e7eb', minWidth: 0 }}>

          {data.summary && (
            <div style={{ marginBottom: 20 }}>
              <SectionHeader label="About Me" />
              <div style={{ fontSize: 10.5, color: '#374151', lineHeight: 1.75 }}>{cleanText(data.summary)}</div>
            </div>
          )}

          {data.role_description && (
            <div style={{ marginBottom: 20 }}>
              <SectionHeader label="Role & Responsibilities" />
              <div style={{ fontSize: 10.5, color: '#374151', lineHeight: 1.75 }}>{cleanText(data.role_description)}</div>
            </div>
          )}

       {skills.length > 0 && (
  <div style={{ marginBottom: 20 }}>
    <SectionHeader label="Skills" />
    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '4px 5px' }}>
      {skills.map((skill: string, i: number) => (
        <span key={i} style={{ background: PILL_COLORS[i % PILL_COLORS.length], color: 'white', fontSize: 9, padding: '0 11px', height: 20, lineHeight: '20px', borderRadius: 20, fontWeight: 600, display: 'inline-block', textAlign: 'center', verticalAlign: 'middle' }}>{skill}</span>
      ))}
    </div>
  </div>
)}

          {tools.length > 0 && (
            <div style={{ marginBottom: 20, breakInside: 'avoid' as const }}>
              <SectionHeader label="Tools" />
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 7 }}>
                {tools.map((tool, i) => <ToolIconBox key={i} {...tool} size={36} />)}
              </div>
            </div>
          )}

          {(data.linkedin || data.github || data.portfolio) && (
            <div>
              <SectionHeader label="Portfolio" />
              {data.linkedin && <div style={{ fontSize: 9.5, color: '#2563eb', marginBottom: 4, wordBreak: 'break-all' as const }}><a href={ensureUrl(data.linkedin)} style={{ color: 'inherit', textDecoration: 'none' }}>{data.linkedin}</a></div>}
              {data.github && <div style={{ fontSize: 9.5, color: '#2563eb', marginBottom: 4, wordBreak: 'break-all' as const }}><a href={ensureUrl(data.github)} style={{ color: 'inherit', textDecoration: 'none' }}>{data.github}</a></div>}
              {data.portfolio && <div style={{ fontSize: 9.5, color: '#2563eb', wordBreak: 'break-all' as const }}><a href={ensureUrl(data.portfolio)} style={{ color: 'inherit', textDecoration: 'none' }}>{data.portfolio}</a></div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Rida Saeed Template — exact match to reference ─────────────────────────
// Layout: Dark teal full-width header (name + title + contact). Dark teal left sidebar
// (About Me + Skills + Tools + Portfolio). White right column (Experience + Education).

function RidaTemplate({ data, photo }: { data: Record<string, any>; photo?: string }) {
  const tools = resolveTools(data.tools_list || []).slice(0, 7)
  const skills: string[] = data.skills_list || []
  const experience: any[] = data.experience || []
  const education: any[] = data.education || []
  const effectivePhoto = photo || data.photo

  const SidebarHeader = ({ label }: { label: string }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#4db6ac', letterSpacing: 2.5, textTransform: 'uppercase' as const }}>{label}</div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', marginTop: 5 }} />
    </div>
  )

  const MainHeader = ({ label }: { label: string }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#0d3b4f', letterSpacing: 2.5, textTransform: 'uppercase' as const }}>{label}</div>
      <div style={{ height: 2, background: '#4db6ac', marginTop: 5 }} />
    </div>
  )

  return (
    <div style={{ width: 794, minHeight: 1085, fontFamily: 'Arial, Helvetica, sans-serif', background: '#ffffff', boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column' }}>

      {/* ── HEADER (dark teal) ── */}
      <div style={{ background: '#0d3b4f', padding: '26px 34px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {effectivePhoto && (
            <img
              src={effectivePhoto}
              crossOrigin="anonymous"
              style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' as const, border: '3px solid #4db6ac', flexShrink: 0 }}
              alt="Profile"
            />
          )}
          <div>
            <div style={{ color: 'white', fontSize: 30, fontWeight: 800, lineHeight: 1.1, letterSpacing: 1, textTransform: 'uppercase' as const }}>{data.name}</div>
            <div style={{ color: '#80cbc4', fontSize: 12, marginTop: 5, letterSpacing: 1.5, fontWeight: 500, textTransform: 'uppercase' as const }}>{data.role_title || data.title}</div>
            <div style={{ height: 2.5, background: '#4db6ac', marginTop: 8, borderRadius: 2 }} />
          </div>
        </div>
        {/* Contact info — right side */}
        <div style={{ color: '#b2dfdb', fontSize: 10.5, textAlign: 'right' as const, lineHeight: 2.1, flexShrink: 0 }}>
          {data.email && <div>✉ <a href={`mailto:${data.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{data.email}</a></div>}
          {data.phone && <div>📱 {data.phone}</div>}
          {data.location && <div>📍 {data.location}</div>}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display: 'flex', flex: 1 }}>

        {/* LEFT sidebar (dark teal, ~32%) */}
        <div style={{ width: 252, background: '#0d3b4f', padding: '22px 16px 22px 20px', boxSizing: 'border-box' as const, flexShrink: 0 }}>

          {data.summary && (
            <div style={{ marginBottom: 20 }}>
              <SidebarHeader label="About Me" />
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, lineHeight: 1.75 }}>{cleanText(data.summary)}</div>
            </div>
          )}

          {skills.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SidebarHeader label="Skills" />
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '4px 5px' }}>
                {skills.map((skill: string, i: number) => (
                  <span key={i} style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.88)', border: '1px solid rgba(255,255,255,0.22)', fontSize: 8.5, padding: '0 10px', height: 20, lineHeight: '20px', borderRadius: 20, fontWeight: 600, display: 'inline-block', textAlign: 'center', verticalAlign: 'middle' }}>{skill}</span>
                ))}
              </div>
            </div>
          )}

          {tools.length > 0 && (
            <div style={{ marginBottom: 20, breakInside: 'avoid' as const }}>
              <SidebarHeader label="Tools" />
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {tools.map((tool, i) => <ToolIconBox key={i} {...tool} size={34} />)}
              </div>
            </div>
          )}

          {(data.linkedin || data.github || data.portfolio) && (
            <div>
              <SidebarHeader label="Portfolio" />
              {data.linkedin && <div style={{ fontSize: 9, color: '#60a5fa', marginBottom: 5, wordBreak: 'break-all' as const }}><a href={ensureUrl(data.linkedin)} style={{ color: 'inherit', textDecoration: 'none' }}>{data.linkedin}</a></div>}
              {data.github && <div style={{ fontSize: 9, color: '#60a5fa', marginBottom: 5, wordBreak: 'break-all' as const }}><a href={ensureUrl(data.github)} style={{ color: 'inherit', textDecoration: 'none' }}>{data.github}</a></div>}
              {data.portfolio && <div style={{ fontSize: 9, color: '#60a5fa', wordBreak: 'break-all' as const }}><a href={ensureUrl(data.portfolio)} style={{ color: 'inherit', textDecoration: 'none' }}>{data.portfolio}</a></div>}
            </div>
          )}
        </div>

        {/* RIGHT main (white, ~68%) */}
        <div style={{ flex: 1, padding: '22px 26px 26px 22px', minWidth: 0 }}>

          {data.role_description && (
            <div style={{ marginBottom: 24 }}>
              <MainHeader label="Role & Responsibilities" />
              <div style={{ fontSize: 10.5, color: '#374151', lineHeight: 1.75 }}>{cleanText(data.role_description)}</div>
            </div>
          )}

          {experience.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <MainHeader label="Experience" />
              {experience.map((exp: any, i: number) => {
                const color = companyBgColor(exp.company || '')
                return (
                  <div key={i} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 5 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: color, display: 'inline-block', textAlign: 'center', lineHeight: '34px', color: 'white', fontWeight: 800, fontSize: 15, flexShrink: 0, fontFamily: 'Arial, sans-serif', verticalAlign: 'top' }}>
                        {(exp.company || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#111827', lineHeight: 1.3 }}>{exp.title}</div>
                        <div style={{ fontSize: 11, color, fontWeight: 600 }}>{exp.company}</div>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>{exp.start_date} – {exp.end_date || 'Present'}</div>
                      </div>
                    </div>
                    {(exp.bullets || []).map((b: string, j: number) => (
                      <div key={j} style={{ display: 'flex', gap: 5, marginLeft: 44, marginBottom: 2 }}>
                        <span style={{ color: '#4db6ac', fontSize: 11, lineHeight: '1.6', flexShrink: 0 }}>•</span>
                        <span style={{ fontSize: 10.5, color: '#374151', lineHeight: 1.6 }}>{cleanText(b)}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {education.length > 0 && (
            <div>
              <MainHeader label="Education" />
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const }}>
                {education.map((edu: any, i: number) => (
                  <div key={i} style={{ flex: '1 1 180px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 11.5, color: '#111827' }}>{edu.institution}</div>
                    <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>{edu.degree}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{edu.graduation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Arham Saeed Template ──────────────────────────────────────────────────────
// Layout: Dark olive sidebar (photo + Education + Contact + Tools + Key Achievements)
// White right main (large name + role title + summary + Experience + Top Skills GREY pills)

function ArhamTemplate({ data, photo }: { data: Record<string, any>; photo?: string }) {
  const tools = resolveTools(data.tools_list || []).slice(0, 7)
  const skills: string[] = data.skills_list || []
  const experience: any[] = data.experience || []
  const education: any[] = data.education || []
  const keyAchievements: string[] = data.key_achievements || []
  const effectivePhoto = photo || data.photo

  const SIDEBAR_BG = '#1a5c2e'  // forest green (lightened a few grades)
  const GOLD = '#FFC000'        // golden yellow for sidebar headings
  const ACCENT = '#FFC000'      // golden for timeline dots

  const M = 'Montserrat, Arial, sans-serif'
  const OS = 'Open Sans, Arial, sans-serif'

  const SidebarHeader = ({ label }: { label: string }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: M, fontSize: 16, fontWeight: 700, color: GOLD, letterSpacing: 2.5, textTransform: 'uppercase' as const }}>{label}</div>
      <div style={{ height: 1.5, background: GOLD, marginTop: 5, opacity: 0.65 }} />
    </div>
  )

  const MainHeader = ({ label }: { label: string }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: M, fontSize: 20, fontWeight: 700, color: '#2b2b2b', letterSpacing: 2, textTransform: 'uppercase' as const }}>{label}</div>
      <div style={{ height: 1, background: '#c8c8c8', marginTop: 6 }} />
    </div>
  )

  return (
    <div style={{ width: 794, minHeight: 1085, fontFamily: OS, background: SIDEBAR_BG, display: 'flex', boxSizing: 'border-box' as const }}>

      {/* LEFT SIDEBAR */}
      <div style={{ width: 258, background: SIDEBAR_BG, padding: '30px 18px', boxSizing: 'border-box' as const, flexShrink: 0 }}>

        {/* Photo */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 26 }}>
          {effectivePhoto ? (
            <img src={effectivePhoto} crossOrigin="anonymous"
              style={{ width: 130, height: 130, borderRadius: '50%', objectFit: 'cover' as const, border: '4px solid #b8a9d4', display: 'block', flexShrink: 0 }} alt="Profile" />
          ) : (
            <div style={{ width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #b8a9d4', fontSize: 44, fontWeight: 700, color: 'white', fontFamily: M, flexShrink: 0, letterSpacing: 2 }}>
              {(() => { const p = (data.name || '').trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (p[0]?.[0] || '?').toUpperCase() })()}
            </div>
          )}
        </div>

        {/* Education */}
        {education.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <SidebarHeader label="Education" />
            {education.map((edu: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
                <span style={{ color: 'white', fontSize: 13, lineHeight: '1.3', flexShrink: 0, marginTop: 1 }}>•</span>
                <div>
                  <div style={{ fontFamily: OS, fontWeight: 700, fontSize: 13, color: '#ffffff', lineHeight: 1.3 }}>{edu.institution}</div>
                  <div style={{ fontFamily: OS, fontSize: 11, color: '#ffffff', marginTop: 2 }}>{edu.degree}</div>
                  <div style={{ fontFamily: OS, fontSize: 11, color: '#ffffff', marginTop: 1 }}>{edu.graduation}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contact */}
        <div style={{ marginBottom: 22 }}>
          <SidebarHeader label="Contact" />
          {data.email && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <span style={{ color: 'white', fontSize: 11, marginTop: 1, flexShrink: 0 }}>✉</span>
              <a href={`mailto:${data.email}`} style={{ fontFamily: OS, fontSize: 11, color: '#ffffff', wordBreak: 'break-all' as const, lineHeight: 1.5, textDecoration: 'none' }}>{data.email}</a>
            </div>
          )}
          {data.location && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <span style={{ color: 'white', fontSize: 11, marginTop: 1, flexShrink: 0 }}>⊙</span>
              <span style={{ fontFamily: OS, fontSize: 11, color: '#ffffff', lineHeight: 1.5 }}>{data.location}</span>
            </div>
          )}
          {data.phone && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: 'white', fontSize: 11, marginTop: 1, flexShrink: 0 }}>☏</span>
              <span style={{ fontFamily: OS, fontSize: 11, color: '#ffffff', lineHeight: 1.5 }}>{data.phone}</span>
            </div>
          )}
        </div>

        {/* Tools */}
        {tools.length > 0 && (
          <div style={{ marginBottom: 22, breakInside: 'avoid' as const }}>
            <SidebarHeader label="Tools" />
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
              {tools.map((tool, i) => <ToolIconBox key={i} {...tool} size={36} />)}
            </div>
          </div>
        )}

        {/* Key Achievements */}
        {keyAchievements.length > 0 && (
          <div>
            <SidebarHeader label="Key Achievements" />
            {keyAchievements.map((ach: string, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
                <span style={{ color: 'white', fontSize: 12, lineHeight: '1.5', flexShrink: 0, marginTop: 1 }}>•</span>
                <span style={{ fontFamily: OS, fontSize: 12, color: '#ffffff', lineHeight: 1.6 }}>{cleanText(ach)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT MAIN */}
      <div style={{ flex: 1, padding: '32px 32px 32px 28px', minWidth: 0, background: '#ffffff' }}>

        {/* Name + title + summary */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: M, fontSize: 42, fontWeight: 700, color: '#2b2b2b', lineHeight: 1.05, letterSpacing: -0.5 }}>{data.name}</div>
          <div style={{ fontFamily: M, fontSize: 18, fontWeight: 500, color: '#4a4a4a', marginTop: 6, letterSpacing: 0.3 }}>{data.role_title || data.title}</div>
          {data.summary && (
            <div style={{ fontFamily: OS, fontSize: 12, fontWeight: 400, color: '#555555', lineHeight: 1.75, marginTop: 12 }}>{cleanText(data.summary)}</div>
          )}
        </div>

        {/* Experience with vertical timeline */}
        {experience.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <MainHeader label="Experience" />
            <div style={{ position: 'relative' as const }}>
              {/* Vertical timeline line */}
              <div style={{ position: 'absolute' as const, left: 3.5, top: 8, bottom: 14, width: 1, background: '#d0d0d0', zIndex: 0 }} />
              {experience.map((exp: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 22, position: 'relative' as const, zIndex: 1 }}>
                  {/* Smaller golden dot on the vertical line */}
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, flexShrink: 0, marginTop: 5, position: 'relative' as const, zIndex: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 3 }}>
                      <div>
                        <div style={{ fontFamily: M, fontSize: 16, fontWeight: 600, color: '#2b2b2b', lineHeight: 1.25 }}>{exp.title}</div>
                        <div style={{ fontFamily: OS, fontSize: 14, fontWeight: 400, color: '#777777', marginTop: 2 }}>{exp.company}</div>
                      </div>
                      {/* Dates: two lines, dark charcoal */}
                      <div style={{ fontFamily: OS, fontSize: 12, fontWeight: 400, color: '#2b2b2b', flexShrink: 0, textAlign: 'right' as const, lineHeight: 1.7, marginLeft: 10 }}>
                        <div>{exp.start_date}</div>
                        <div>{exp.end_date || 'Present'}</div>
                      </div>
                    </div>
                    {(exp.bullets || []).map((b: string, j: number) => (
                      <div key={j} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
                        <span style={{ color: '#555555', fontSize: 12, lineHeight: '1.6', flexShrink: 0 }}>•</span>
                        <span style={{ fontFamily: OS, fontSize: 12, fontWeight: 400, color: '#555555', lineHeight: 1.65 }}>{cleanText(b)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Skills — plain grey tags matching spec */}
        {skills.length > 0 && (
          <div>
            <MainHeader label="Top Skills" />
            <div style={{ marginTop: 4 }}>
              {skills.map((skill: string, i: number) => (
                <span key={i} style={{ fontFamily: OS, background: '#f1f5f9', color: '#2b2b2b', fontSize: 12, fontWeight: 500, padding: '4px 14px', borderRadius: 999, display: 'inline-block', margin: '3px 4px 3px 0', verticalAlign: 'middle', border: '1px solid #e0e0e0' }}>{skill}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sheraz Khalid Template ────────────────────────────────────────────────────
// Exact font spec applied per design table.

function SherazTemplate({ data, photo: _photo }: { data: Record<string, any>; photo?: string }) {
  const skills: string[] = data.skills_list || []
  const experience: any[] = data.experience || []
  const education: any[] = data.education || []
  const expertiseBullets: string[] = data.expertise_bullets || []
  const additionalSkills: string[] = data.additional_skills || []
  const toolsWorkflow: string[] = data.tools_list || []

  // Font families
  const MP = 'Montserrat, Poppins, Arial, sans-serif'
  const IO = 'Inter, Open Sans, Arial, sans-serif'

  // Colors from spec
  const GOLDEN   = '#df9f28'   // name color — Golden Mustard/Orange
  const ACCENT   = '#df9f28'   // bullet dots

  // Section heading: Montserrat 16px Bold #1a1a1a + thin grey separator
  const SectionHeader = ({ label }: { label: string }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: MP, fontSize: 16, fontWeight: 700, color: '#1a1a1a', letterSpacing: 2.5, textTransform: 'uppercase' as const }}>{label}</div>
      <div style={{ height: 1, background: '#e0e0e0', marginTop: 6 }} />
    </div>
  )

  return (
    <div style={{ width: 794, minHeight: 1085, fontFamily: IO, background: '#ffffff', boxSizing: 'border-box' as const, position: 'relative' as const, overflow: 'hidden' }}>

      {/* Watermark — very light cream #fdf2e3 per spec */}
      <div style={{ position: 'absolute' as const, top: 4, left: 0, right: 0, fontFamily: MP, fontSize: 120, fontWeight: 700, color: '#fdf2e3', letterSpacing: -3, textAlign: 'center' as const, lineHeight: 1, textTransform: 'lowercase' as const, pointerEvents: 'none' as const, userSelect: 'none' as const, whiteSpace: 'nowrap' as const }}>
        {(data.name || '').toLowerCase()}
      </div>

      {/* Centered header */}
      <div style={{ padding: '46px 40px 20px 40px', textAlign: 'center' as const, position: 'relative' as const, zIndex: 1 }}>
        {/* Name: Montserrat 48px Bold #df9f28 */}
        <div style={{ fontFamily: MP, fontSize: 48, fontWeight: 700, color: GOLDEN, letterSpacing: 0, lineHeight: 1 }}>{data.name}</div>
        {/* Title: Montserrat 24px Regular #333333 — NOT uppercase */}
        <div style={{ fontFamily: MP, fontSize: 24, fontWeight: 400, color: '#333333', marginTop: 8, letterSpacing: 0.3 }}>{data.role_title || data.title}</div>
      </div>

      {/* Thin separator */}
      <div style={{ height: 1, background: '#e0e0e0', margin: '0 28px', position: 'relative' as const, zIndex: 1 }} />

      {/* Two-column body */}
      <div style={{ display: 'flex', padding: '20px 28px 28px 28px', gap: 26, position: 'relative' as const, zIndex: 1 }}>

        {/* LEFT column (~32%) */}
        <div style={{ flex: '0 0 31%', minWidth: 0 }}>

          {/* Contact — Inter 13px Regular #1a1a1a */}
          <div style={{ marginBottom: 18 }}>
            <SectionHeader label="Contact" />
            {data.email && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: ACCENT, marginTop: 1, flexShrink: 0 }}>✉</span>
                <a href={`mailto:${data.email}`} style={{ fontFamily: IO, fontSize: 13, fontWeight: 400, color: '#1a1a1a', lineHeight: 1.5, wordBreak: 'break-all' as const, textDecoration: 'none' }}>{data.email}</a>
              </div>
            )}
            {data.location && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: ACCENT, marginTop: 1, flexShrink: 0 }}>📍</span>
                <span style={{ fontFamily: IO, fontSize: 13, fontWeight: 400, color: '#1a1a1a', lineHeight: 1.5 }}>{data.location}</span>
              </div>
            )}
            {data.phone && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: ACCENT, marginTop: 1, flexShrink: 0 }}>📱</span>
                <span style={{ fontFamily: IO, fontSize: 13, fontWeight: 400, color: '#1a1a1a', lineHeight: 1.5 }}>{data.phone}</span>
              </div>
            )}
            {data.linkedin && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                <span style={{ fontSize: 11, color: ACCENT, marginTop: 1, flexShrink: 0 }}>🔗</span>
                <a href={ensureUrl(data.linkedin)} style={{ fontFamily: IO, fontSize: 13, fontWeight: 400, color: '#1a1a1a', lineHeight: 1.5, wordBreak: 'break-all' as const, textDecoration: 'none' }}>{data.linkedin}</a>
              </div>
            )}
          </div>

          {/* Education — institution: 14px Bold #333333 / degree: 13px Regular #666666 / date: 11px #777777 */}
          {education.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <SectionHeader label="Education" />
              {education.map((edu: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <span style={{ color: '#1a1a1a', fontSize: 12, flexShrink: 0, lineHeight: '1.4', marginTop: 1 }}>•</span>
                  <div>
                    <div style={{ fontFamily: IO, fontWeight: 700, fontSize: 14, color: '#333333', lineHeight: 1.3 }}>{edu.institution}</div>
                    <div style={{ fontFamily: IO, fontSize: 13, fontWeight: 400, color: '#666666', marginTop: 2 }}>{edu.degree}</div>
                    <div style={{ fontFamily: IO, fontSize: 11, fontWeight: 400, color: '#777777', marginTop: 1 }}>{edu.graduation}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Expertise — body 13px Regular #4a4a4a, black bullets */}
          {expertiseBullets.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <SectionHeader label="Expertise" />
              {expertiseBullets.map((item: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <span style={{ color: '#1a1a1a', fontSize: 11, lineHeight: '1.6', flexShrink: 0 }}>•</span>
                  <span style={{ fontFamily: IO, fontSize: 13, fontWeight: 400, color: '#4a4a4a', lineHeight: 1.6 }}>{cleanText(item)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Additional Skills — no Skills section, black bullets */}
          {additionalSkills.length > 0 && (
            <div>
              <SectionHeader label="Additional Skills" />
              {additionalSkills.map((item: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <span style={{ color: '#1a1a1a', fontSize: 11, lineHeight: '1.6', flexShrink: 0 }}>•</span>
                  <span style={{ fontFamily: IO, fontSize: 13, fontWeight: 400, color: '#4a4a4a', lineHeight: 1.6 }}>{cleanText(item)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT column (~68%) */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Profile — body 13px #4a4a4a */}
          {data.summary && (
            <div style={{ marginBottom: 18 }}>
              <SectionHeader label="Profile" />
              <div style={{ fontFamily: IO, fontSize: 13, fontWeight: 400, color: '#4a4a4a', lineHeight: 1.75 }}>{cleanText(data.summary)}</div>
            </div>
          )}

          {/* Experience */}
          {experience.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <SectionHeader label="Experience" />
              {experience.map((exp: any, i: number) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  {/* Date: Inter 11-12px Regular #777777 */}
                  <div style={{ fontFamily: IO, fontSize: 11, fontWeight: 400, color: '#777777', marginBottom: 3 }}>from {exp.start_date} – {exp.end_date || 'Present'}</div>
                  {/* Job title: Inter 14px Bold #333333 */}
                  <div style={{ fontFamily: IO, fontSize: 14, fontWeight: 700, color: '#333333', lineHeight: 1.25 }}>{exp.title}</div>
                  {/* Company: Inter 13px Regular #666666 */}
                  <div style={{ fontFamily: IO, fontSize: 13, fontWeight: 400, color: '#666666', marginBottom: 6, marginTop: 2 }}>{exp.company}</div>
                  {/* Bullets: Inter 13px Regular #4a4a4a */}
                  {(exp.bullets || []).map((b: string, j: number) => (
                    <div key={j} style={{ fontFamily: IO, fontSize: 13, fontWeight: 400, color: '#4a4a4a', lineHeight: 1.72, marginBottom: 4 }}>{cleanText(b)}</div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Core Technical Skills — one heading, two bold sub-labels */}
          {(skills.length > 0 || toolsWorkflow.length > 0) && (
            <div>
              <SectionHeader label="Core Technical Skills" />
              {skills.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontFamily: IO, fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>Tech Skills: </span>
                  <span style={{ fontFamily: IO, fontSize: 13, fontWeight: 400, color: '#4a4a4a', lineHeight: 1.85 }}>{skills.join('  ·  ')}</span>
                </div>
              )}
              {toolsWorkflow.length > 0 && (
                <div>
                  <span style={{ fontFamily: IO, fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>Tools and Workflow: </span>
                  <span style={{ fontFamily: IO, fontSize: 13, fontWeight: 400, color: '#4a4a4a', lineHeight: 1.85 }}>{toolsWorkflow.join('  ·  ')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Muhammad Waqar Template ──────────────────────────────────────────────────
// Layout: White page. Header: large bold name + blue role title + contact row + blue initials badge (top-right).
// Single-column sections: SUMMARY, EXPERIENCE (dashed separators between entries), EDUCATION, KEY ACHIEVEMENTS.
// SKILLS: full-width bordered table/grid showing all skills + tools combined.

function WaqarTemplate({ data, photo }: { data: Record<string, any>; photo?: string }) {
  // ── Exact Enhancv replica — fonts/colors extracted directly from PDF ──────
  // Fonts confirmed via PyMuPDF embedded font extraction
  const FM = "'Montserrat', 'Arial', sans-serif"   // name, section headers, job/degree/project titles
  const FO = "'Open Sans', 'Arial', sans-serif"    // body, bullets, contact, dates, company names, skills
  const FI = "'Inter', 'Arial', sans-serif"        // badge initials only
  // Colors confirmed via PyMuPDF span color extraction (#RRGGBB)
  const BLUE = '#3c6df0'   // role title, company names, icon glyphs, badge bg
  const DARK = '#19273c'   // name, section headers, job titles, badge initials
  const BODY = '#3e3e3e'   // body text, bullets, contact, dates, skills

  const skills: string[] = data.skills_list
    || (data.skills && typeof data.skills === 'object' && !Array.isArray(data.skills)
        ? Object.values(data.skills as Record<string, string[]>).flat()
        : [])
  const tools: string[] = data.tools_list || []
  const experience: any[] = data.experience || []
  const education: any[] = data.education || []
  const keyAchievements: string[] = data.key_achievements || []
  const languages: any[] = data.languages || []
  const projects: any[] = data.projects || []
  const allSkills = [...skills, ...tools]
  const effectivePhoto = photo || data.photo

  const initials = (() => {
    const parts = (data.name || '').trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return (parts[0]?.[0] || '?').toUpperCase()
  })()

  // Section header: Montserrat Bold 19px, DARK, uppercase, solid bottom border
  const SH = ({ label }: { label: string }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: FM, fontSize: 19, fontWeight: 700, color: DARK, letterSpacing: 0.4, textTransform: 'uppercase' as const, paddingBottom: 4, borderBottom: `2px solid ${DARK}` }}>{label}</div>
    </div>
  )

  return (
    <div style={{ width: 795, minHeight: 1124, fontFamily: FO, background: '#ffffff', boxSizing: 'border-box' as const, padding: '45px 53px 32px 53px' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name — Montserrat Bold 32px #19273c */}
          <div style={{ fontFamily: FM, fontSize: 32, fontWeight: 700, color: DARK, lineHeight: 1.1 }}>{data.name}</div>
          {/* Role title — Montserrat Bold 16px blue */}
          <div style={{ fontFamily: FM, fontSize: 16, fontWeight: 700, color: BLUE, marginTop: 4 }}>{data.role_title || data.title}</div>
          {/* Contact row 1: phone + email — OpenSans Bold 10px */}
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '2px 20px', marginTop: 8, fontFamily: FO, fontSize: 10, fontWeight: 700, color: BODY }}>
            {data.phone && <span>☎ {data.phone}</span>}
            {data.email && <span>✉ <a href={`mailto:${data.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{data.email}</a></span>}
          </div>
          {/* Contact row 2: linkedin + location — OpenSans Bold 10px */}
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '2px 20px', marginTop: 3, fontFamily: FO, fontSize: 10, fontWeight: 700, color: BODY }}>
            {data.linkedin && <span>🔗 <a href={ensureUrl(data.linkedin)} style={{ color: 'inherit', textDecoration: 'none' }}>{data.linkedin}</a></span>}
            {data.location && <span>📍 {data.location}</span>}
          </div>
        </div>
        {/* Profile photo or initials badge — Inter Medium 29px, DARK text on BLUE bg */}
        {effectivePhoto ? (
          <img src={effectivePhoto} crossOrigin="anonymous"
            style={{ width: 114, height: 114, borderRadius: 4, objectFit: 'cover' as const, flexShrink: 0, marginLeft: 16 }}
            alt="Profile" />
        ) : (
          <div style={{ width: 114, height: 114, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 16, borderRadius: 4 }}>
            <span style={{ fontFamily: FI, color: DARK, fontSize: 29, fontWeight: 500 }}>{initials}</span>
          </div>
        )}
      </div>

      {/* ── SUMMARY ── */}
      {data.summary && (
        <div style={{ marginBottom: 20 }}>
          <SH label="Summary" />
          <div style={{ fontFamily: FO, fontSize: 11, color: BODY, lineHeight: 1.8 }}>{cleanText(data.summary)}</div>
        </div>
      )}

      {/* ── EXPERIENCE ── */}
      {experience.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SH label="Experience" />
          {experience.map((exp: any, i: number) => (
            <div key={i}>
              {/* Job title — Montserrat Regular 15px DARK */}
              <div style={{ fontFamily: FM, fontSize: 15, fontWeight: 400, color: DARK, lineHeight: 1.3 }}>{exp.title}</div>
              {/* Company — OpenSans Bold 12px blue */}
              <div style={{ fontFamily: FO, fontSize: 12, fontWeight: 700, color: BLUE, marginTop: 1 }}>{exp.company}</div>
              {/* Date + location — OpenSans 10px BODY */}
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '2px 18px', fontFamily: FO, fontSize: 10, color: BODY, marginTop: 2 }}>
                <span>📅 {exp.start_date} - {exp.end_date || 'Present'}</span>
                {exp.location && <span>📍 {exp.location}</span>}
              </div>
              {/* Company description */}
              {exp.company_description && (
                <div style={{ fontFamily: FO, fontSize: 11, color: BODY, lineHeight: 1.75, marginTop: 4 }}>{cleanText(exp.company_description)}</div>
              )}
              {/* Bullets — OpenSans 11px */}
              <div style={{ marginTop: 5 }}>
                {(exp.bullets || []).map((b: string, j: number) => (
                  <div key={j} style={{ display: 'flex', gap: 7, marginBottom: 2 }}>
                    <span style={{ fontFamily: FO, color: BODY, fontSize: 12, lineHeight: '1.7', flexShrink: 0 }}>•</span>
                    <span style={{ fontFamily: FO, fontSize: 11, color: BODY, lineHeight: 1.7 }}>{cleanText(b)}</span>
                  </div>
                ))}
              </div>
              {/* Dashed separator between entries */}
              {i < experience.length - 1 && (
                <div style={{ borderBottom: '1px dashed #c8c8c8', margin: '12px 0' }} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── EDUCATION ── */}
      {education.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SH label="Education" />
          {education.map((edu: any, i: number) => (
            <div key={i} style={{ marginBottom: i < education.length - 1 ? 12 : 0 }}>
              {/* Degree — Montserrat Regular 15px DARK */}
              <div style={{ fontFamily: FM, fontSize: 15, fontWeight: 400, color: DARK, lineHeight: 1.3 }}>{edu.degree}</div>
              {/* Institution — OpenSans Bold 12px blue */}
              <div style={{ fontFamily: FO, fontSize: 12, fontWeight: 700, color: BLUE, marginTop: 1 }}>{edu.institution}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '2px 18px', fontFamily: FO, fontSize: 10, color: BODY, marginTop: 2 }}>
                {(edu.start_date || edu.graduation) && (
                  <span>📅 {edu.start_date ? `${edu.start_date} - ${edu.graduation || 'Present'}` : edu.graduation}</span>
                )}
                {edu.location && <span>📍 {edu.location}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── KEY ACHIEVEMENTS ── */}
      {keyAchievements.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SH label="Key Achievements" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {keyAchievements.map((ach: string, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* Blue heart icon */}
                <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0, marginTop: 1 }} fill={BLUE}>
                  <path d="M8 14s-6-4.35-6-8a4 4 0 0 1 6-3.46A4 4 0 0 1 14 6c0 3.65-6 8-6 8z"/>
                </svg>
                <span style={{ fontFamily: FO, fontSize: 11, color: BODY, lineHeight: 1.75 }}>{cleanText(ach)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LANGUAGES ── */}
      {languages.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SH label="Languages" />
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px 56px', marginTop: 4 }}>
            {languages.map((lang: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div>
                  <div style={{ fontFamily: FO, fontSize: 12, fontWeight: 700, color: DARK }}>{lang.name}</div>
                  <div style={{ fontFamily: FO, fontSize: 10, color: BODY }}>{lang.level}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {Array.from({ length: 5 }).map((_, d) => (
                    <div key={d} style={{ width: 14, height: 14, borderRadius: '50%', background: d < (lang.proficiency ?? 5) ? BLUE : '#d4d4d8' }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SKILLS — bottom border ONLY, OpenSans Bold ── */}
      {allSkills.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SH label="Skills" />
          <div style={{ display: 'flex', flexWrap: 'wrap' as const }}>
            {allSkills.map((skill: string, i: number) => (
              <span key={i} style={{ fontFamily: FO, fontSize: 12, fontWeight: 700, color: BODY, padding: '6px 10px 6px 10px', borderBottom: '1.5px solid #c8c8c8', whiteSpace: 'nowrap' as const, marginRight: 2 }}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── PROJECTS ── */}
      {projects.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SH label="Projects" />
          {projects.map((proj: any, i: number) => (
            <div key={i}>
              {/* Project name — Montserrat Regular 15px DARK */}
              <div style={{ fontFamily: FM, fontSize: 15, fontWeight: 400, color: DARK, lineHeight: 1.3 }}>{proj.name}</div>
              {(proj.start_date || proj.end_date) && (
                <div style={{ fontFamily: FO, fontSize: 10, color: BODY, marginTop: 2 }}>
                  📅 {proj.start_date}{proj.end_date && proj.end_date !== proj.start_date ? ` - ${proj.end_date}` : ''}
                </div>
              )}
              {proj.description && (
                <div style={{ fontFamily: FO, fontSize: 11, color: BODY, lineHeight: 1.7, marginTop: 3 }}>{cleanText(proj.description)}</div>
              )}
              <div style={{ marginTop: 5 }}>
                {(proj.bullets || []).map((b: string, j: number) => (
                  <div key={j} style={{ display: 'flex', gap: 7, marginBottom: 2 }}>
                    <span style={{ fontFamily: FO, color: BODY, fontSize: 12, lineHeight: '1.7', flexShrink: 0 }}>•</span>
                    <span style={{ fontFamily: FO, fontSize: 11, color: BODY, lineHeight: 1.7 }}>{cleanText(b)}</span>
                  </div>
                ))}
              </div>
              {i < projects.length - 1 && (
                <div style={{ borderBottom: '1px dashed #c8c8c8', margin: '11px 0' }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Resume template picker ─────────────────────────────────────────────────

const RESUME_TEMPLATES = [
  { id: 1, name: 'Rida Saeed', description: 'Teal header & sidebar, skill pills, tool icons.' },
  { id: 2, name: 'Mirza Waleed', description: 'White + green accents, photo in header, experience left.' },
  { id: 3, name: 'Arham Saeed', description: 'Dark olive sidebar, key achievements, bold name right.' },
  { id: 4, name: 'Sheraz Khalid', description: 'White + orange, watermark name, expertise bullets.' },
  { id: 5, name: 'Muhammad Waqar', description: 'White + blue initials badge, bordered skills grid, dashed separators.' },
]

function TemplateSvgWaqar() {
  return (
    <svg viewBox="0 0 110 140" className="w-full h-full">
      {/* White background */}
      <rect x="0" y="0" width="110" height="140" fill="#ffffff"/>
      {/* Name - large bold dark */}
      <rect x="5" y="5" width="68" height="6" rx="0.5" fill="#1a1a1a"/>
      {/* Role title - blue */}
      <rect x="5" y="14" width="42" height="2.5" rx="0.5" fill="#3B5BD9"/>
      {/* Contact row */}
      <rect x="5" y="20" width="16" height="1.5" rx="0.3" fill="#9ca3af"/>
      <rect x="23" y="20" width="22" height="1.5" rx="0.3" fill="#9ca3af"/>
      <rect x="48" y="20" width="20" height="1.5" rx="0.3" fill="#9ca3af"/>
      {/* Initials badge - blue square */}
      <rect x="89" y="4" width="16" height="16" rx="1" fill="#3B5BD9"/>
      <rect x="92" y="9" width="10" height="5" rx="0.5" fill="rgba(255,255,255,0.9)"/>
      {/* SUMMARY section */}
      <rect x="5" y="28" width="24" height="2" rx="0.3" fill="#1a1a1a"/>
      <rect x="5" y="31" width="100" height="1.2" fill="#1a1a1a"/>
      <rect x="5" y="34" width="100" height="1.3" rx="0.3" fill="#d1d5db"/>
      <rect x="5" y="37" width="88" height="1.3" rx="0.3" fill="#d1d5db"/>
      <rect x="5" y="40" width="94" height="1.3" rx="0.3" fill="#d1d5db"/>
      {/* EXPERIENCE section */}
      <rect x="5" y="47" width="30" height="2" rx="0.3" fill="#1a1a1a"/>
      <rect x="5" y="50" width="100" height="1.2" fill="#1a1a1a"/>
      {/* Exp 1 */}
      <rect x="5" y="53" width="38" height="2" rx="0.3" fill="#1a1a1a"/>
      <rect x="5" y="57" width="28" height="1.8" rx="0.3" fill="#3B5BD9"/>
      <rect x="5" y="61" width="44" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="5" y="65" width="97" height="1.3" rx="0.3" fill="#d1d5db"/>
      <rect x="5" y="68" width="87" height="1.3" rx="0.3" fill="#d1d5db"/>
      {/* Dashed separator */}
      <line x1="5" y1="73" x2="105" y2="73" stroke="#d1d5db" strokeDasharray="3,2" strokeWidth="0.8"/>
      {/* Exp 2 */}
      <rect x="5" y="76" width="38" height="2" rx="0.3" fill="#1a1a1a"/>
      <rect x="5" y="80" width="28" height="1.8" rx="0.3" fill="#3B5BD9"/>
      <rect x="5" y="84" width="44" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="5" y="88" width="97" height="1.3" rx="0.3" fill="#d1d5db"/>
      <rect x="5" y="91" width="87" height="1.3" rx="0.3" fill="#d1d5db"/>
      {/* SKILLS section */}
      <rect x="5" y="98" width="18" height="2" rx="0.3" fill="#1a1a1a"/>
      <rect x="5" y="101" width="100" height="1.2" fill="#1a1a1a"/>
      {/* Skills grid rows */}
      <rect x="5" y="104" width="19" height="5" fill="none" stroke="#d0d0d0" strokeWidth="0.5"/>
      <rect x="24" y="104" width="19" height="5" fill="none" stroke="#d0d0d0" strokeWidth="0.5"/>
      <rect x="43" y="104" width="19" height="5" fill="none" stroke="#d0d0d0" strokeWidth="0.5"/>
      <rect x="62" y="104" width="19" height="5" fill="none" stroke="#d0d0d0" strokeWidth="0.5"/>
      <rect x="81" y="104" width="24" height="5" fill="none" stroke="#d0d0d0" strokeWidth="0.5"/>
      <rect x="5" y="109" width="19" height="5" fill="none" stroke="#d0d0d0" strokeWidth="0.5"/>
      <rect x="24" y="109" width="19" height="5" fill="none" stroke="#d0d0d0" strokeWidth="0.5"/>
      <rect x="43" y="109" width="19" height="5" fill="none" stroke="#d0d0d0" strokeWidth="0.5"/>
      <rect x="62" y="109" width="19" height="5" fill="none" stroke="#d0d0d0" strokeWidth="0.5"/>
      <rect x="81" y="109" width="24" height="5" fill="none" stroke="#d0d0d0" strokeWidth="0.5"/>
      <rect x="5" y="114" width="19" height="5" fill="none" stroke="#d0d0d0" strokeWidth="0.5"/>
      <rect x="24" y="114" width="19" height="5" fill="none" stroke="#d0d0d0" strokeWidth="0.5"/>
      <rect x="43" y="114" width="19" height="5" fill="none" stroke="#d0d0d0" strokeWidth="0.5"/>
      <rect x="62" y="114" width="19" height="5" fill="none" stroke="#d0d0d0" strokeWidth="0.5"/>
      <rect x="81" y="114" width="24" height="5" fill="none" stroke="#d0d0d0" strokeWidth="0.5"/>
      {/* Tiny text placeholders in cells */}
      <rect x="7" y="106" width="14" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="26" y="106" width="14" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="45" y="106" width="14" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="64" y="106" width="14" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="83" y="106" width="18" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="7" y="111" width="12" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="26" y="111" width="16" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="45" y="111" width="13" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="64" y="111" width="15" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="83" y="111" width="18" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="7" y="116" width="14" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="26" y="116" width="11" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="45" y="116" width="15" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="64" y="116" width="13" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="83" y="116" width="18" height="1.3" rx="0.3" fill="#9ca3af"/>
    </svg>
  )
}

function TemplateSvg({ id }: { id: number }) {
  if (id === 3) return <TemplateSvgArham />
  if (id === 4) return <TemplateSvgSheraz />
  if (id === 5) return <TemplateSvgWaqar />
  if (id === 2) return (
    <svg viewBox="0 0 110 140" className="w-full h-full">
      {/* White background */}
      <rect x="0" y="0" width="110" height="140" fill="#f8f8f8"/>
      {/* Header: white bg */}
      <rect x="0" y="0" width="110" height="30" fill="#ffffff"/>
      {/* Photo circle top-left */}
      <circle cx="13" cy="15" r="9" fill="#e5e7eb"/>
      {/* Name */}
      <rect x="27" y="6" width="46" height="5" rx="1" fill="#111827"/>
      {/* Title */}
      <rect x="27" y="14" width="32" height="2.5" rx="0.8" fill="#374151"/>
      {/* Green accent bar under title */}
      <rect x="27" y="19" width="20" height="1.5" rx="0.8" fill="#7DC242"/>
      {/* Contact row */}
      <rect x="3" y="26" width="13" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="19" y="26" width="15" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="37" y="26" width="18" height="1.5" rx="0.5" fill="#6b7280"/>
      {/* Green thick divider */}
      <rect x="0" y="30" width="110" height="3" fill="#7DC242"/>
      {/* LEFT col (57%): Experience */}
      <rect x="3" y="37" width="20" height="1.8" rx="0.8" fill="#111827"/>
      <rect x="3" y="40" width="60" height="0.7" fill="#d1d5db"/>
      <circle cx="9" cy="47" r="5" fill="#1565c0"/>
      <rect x="18" y="44" width="26" height="2" rx="0.5" fill="#111827"/>
      <rect x="18" y="48" width="20" height="1.5" rx="0.5" fill="#1565c0"/>
      <rect x="18" y="52" width="40" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="18" y="55" width="35" height="1.5" rx="0.5" fill="#6b7280"/>
      <circle cx="9" cy="64" r="5" fill="#00695c"/>
      <rect x="18" y="61" width="26" height="2" rx="0.5" fill="#111827"/>
      <rect x="18" y="65" width="20" height="1.5" rx="0.5" fill="#00695c"/>
      <rect x="18" y="69" width="40" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="18" y="72" width="34" height="1.5" rx="0.5" fill="#6b7280"/>
      {/* Education */}
      <rect x="3" y="80" width="18" height="1.8" rx="0.8" fill="#111827"/>
      <rect x="3" y="83" width="60" height="0.7" fill="#d1d5db"/>
      <rect x="3" y="87" width="28" height="1.8" rx="0.5" fill="#111827"/>
      <rect x="3" y="91" width="22" height="1.5" rx="0.5" fill="#374151"/>
      {/* Vertical divider */}
      <rect x="67" y="33" width="1" height="104" fill="#e5e7eb"/>
      {/* RIGHT col: About Me */}
      <rect x="71" y="37" width="20" height="1.8" rx="0.8" fill="#111827"/>
      <rect x="71" y="40" width="36" height="0.7" fill="#d1d5db"/>
      <rect x="71" y="43" width="36" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="71" y="46" width="32" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="71" y="49" width="35" height="1.5" rx="0.5" fill="#6b7280"/>
      {/* Skills header */}
      <rect x="71" y="56" width="14" height="1.8" rx="0.8" fill="#111827"/>
      <rect x="71" y="59" width="36" height="0.7" fill="#d1d5db"/>
      {/* Skills pills */}
      <rect x="71" y="62" width="13" height="3.5" rx="1.5" fill="#1565c0"/>
      <rect x="86" y="62" width="16" height="3.5" rx="1.5" fill="#00695c"/>
      <rect x="71" y="67" width="17" height="3.5" rx="1.5" fill="#6a1b9a"/>
      <rect x="90" y="67" width="13" height="3.5" rx="1.5" fill="#bf360c"/>
      {/* Tools header */}
      <rect x="71" y="75" width="13" height="1.8" rx="0.8" fill="#111827"/>
      <rect x="71" y="78" width="36" height="0.7" fill="#d1d5db"/>
      {/* Tool boxes */}
      <rect x="71" y="81" width="8" height="8" rx="2" fill="#21759b"/>
      <rect x="81" y="81" width="8" height="8" rx="2" fill="#777bb3"/>
      <rect x="91" y="81" width="8" height="8" rx="2" fill="#a259ff"/>
      <rect x="101" y="81" width="7" height="8" rx="2" fill="#f7df1e"/>
    </svg>
  )
  // Rida Saeed (id=1)
  return (
    <svg viewBox="0 0 110 140" className="w-full h-full">
      <rect x="0" y="0" width="110" height="140" fill="#f8f8f8"/>
      <rect x="0" y="0" width="110" height="30" fill="#0c3547"/>
      <circle cx="13" cy="15" r="9" fill="rgba(255,255,255,0.15)" stroke="#26a69a" strokeWidth="1.5"/>
      <rect x="26" y="7" width="40" height="4.5" rx="1" fill="white"/>
      <rect x="26" y="14" width="30" height="2.5" rx="1" fill="#80cbc4"/>
      <rect x="26" y="19" width="18" height="1.5" rx="0.5" fill="#26a69a"/>
      <rect x="74" y="7" width="28" height="2" rx="1" fill="rgba(255,255,255,0.5)"/>
      <rect x="74" y="11" width="24" height="2" rx="1" fill="rgba(255,255,255,0.5)"/>
      <rect x="74" y="15" width="26" height="2" rx="1" fill="rgba(255,255,255,0.5)"/>
      <rect x="0" y="30" width="33" height="110" fill="#0c3547"/>
      <rect x="3" y="34" width="19" height="1.8" rx="0.8" fill="#26a69a"/>
      <rect x="3" y="38" width="28" height="18" rx="0.5" fill="rgba(255,255,255,0.07)"/>
      <rect x="3" y="60" width="14" height="1.8" rx="0.8" fill="#26a69a"/>
      <rect x="3" y="64" width="12" height="3.5" rx="1.5" fill="#1565c0"/>
      <rect x="17" y="64" width="13" height="3.5" rx="1.5" fill="#00695c"/>
      <rect x="3" y="69" width="14" height="3.5" rx="1.5" fill="#6a1b9a"/>
      <rect x="19" y="69" width="11" height="3.5" rx="1.5" fill="#1b5e20"/>
      <rect x="3" y="77" width="14" height="1.8" rx="0.8" fill="#26a69a"/>
      <rect x="3" y="81" width="7" height="7" rx="1.5" fill="#21759b"/>
      <rect x="12" y="81" width="7" height="7" rx="1.5" fill="#777bb3"/>
      <rect x="21" y="81" width="7" height="7" rx="1.5" fill="#a259ff"/>
      <rect x="36" y="33" width="36" height="2.5" rx="0.8" fill="#0c3547" opacity="0.9"/>
      <rect x="36" y="37" width="70" height="0.6" fill="#26a69a"/>
      <circle cx="40" cy="46" r="4" fill="#1565c0"/>
      <rect x="47" y="43" width="28" height="2" rx="0.5" fill="#1a1a2e"/>
      <rect x="47" y="47" width="22" height="1.5" rx="0.5" fill="#1565c0"/>
      <rect x="47" y="50" width="18" height="1.5" rx="0.5" fill="#94a3b8"/>
      <rect x="47" y="55" width="55" height="1.5" rx="0.5" fill="#64748b"/>
      <rect x="47" y="58" width="46" height="1.5" rx="0.5" fill="#64748b"/>
      <circle cx="40" cy="69" r="4" fill="#00695c"/>
      <rect x="47" y="66" width="28" height="2" rx="0.5" fill="#1a1a2e"/>
      <rect x="47" y="70" width="22" height="1.5" rx="0.5" fill="#00695c"/>
      <rect x="47" y="73" width="18" height="1.5" rx="0.5" fill="#94a3b8"/>
      <rect x="47" y="78" width="55" height="1.5" rx="0.5" fill="#64748b"/>
      <rect x="47" y="81" width="46" height="1.5" rx="0.5" fill="#64748b"/>
    </svg>
  )
}

function TemplateSvgArham() {
  return (
    <svg viewBox="0 0 110 140" className="w-full h-full">
      {/* White background */}
      <rect x="0" y="0" width="110" height="140" fill="#f8f8f8"/>
      {/* Dark olive sidebar */}
      <rect x="0" y="0" width="35" height="140" fill="#1d2b0d"/>
      {/* Photo circle */}
      <circle cx="17.5" cy="18" r="11" fill="rgba(255,255,255,0.08)" stroke="#8c9a38" strokeWidth="1.5"/>
      {/* Education */}
      <rect x="3" y="34" width="16" height="1.8" rx="0.8" fill="#8c9a38"/>
      <rect x="3" y="37" width="29" height="0.5" fill="rgba(140,154,56,0.4)"/>
      <rect x="5" y="40" width="25" height="1.5" rx="0.5" fill="rgba(255,255,255,0.7)"/>
      <rect x="5" y="43" width="20" height="1.5" rx="0.5" fill="rgba(255,255,255,0.45)"/>
      <rect x="5" y="48" width="25" height="1.5" rx="0.5" fill="rgba(255,255,255,0.7)"/>
      <rect x="5" y="51" width="20" height="1.5" rx="0.5" fill="rgba(255,255,255,0.45)"/>
      {/* Contact */}
      <rect x="3" y="58" width="16" height="1.8" rx="0.8" fill="#8c9a38"/>
      <rect x="3" y="61" width="29" height="0.5" fill="rgba(140,154,56,0.4)"/>
      <rect x="3" y="64" width="26" height="1.5" rx="0.5" fill="rgba(255,255,255,0.6)"/>
      <rect x="3" y="68" width="22" height="1.5" rx="0.5" fill="rgba(255,255,255,0.6)"/>
      {/* Tools */}
      <rect x="3" y="75" width="13" height="1.8" rx="0.8" fill="#8c9a38"/>
      <rect x="3" y="78" width="29" height="0.5" fill="rgba(140,154,56,0.4)"/>
      <rect x="3" y="81" width="7" height="7" rx="1.5" fill="#21759b"/>
      <rect x="12" y="81" width="7" height="7" rx="1.5" fill="#777bb3"/>
      <rect x="21" y="81" width="7" height="7" rx="1.5" fill="#a259ff"/>
      {/* Key Achievements */}
      <rect x="3" y="93" width="26" height="1.8" rx="0.8" fill="#8c9a38"/>
      <rect x="3" y="96" width="29" height="0.5" fill="rgba(140,154,56,0.4)"/>
      <rect x="5" y="99" width="26" height="1.5" rx="0.5" fill="rgba(255,255,255,0.6)"/>
      <rect x="5" y="102" width="22" height="1.5" rx="0.5" fill="rgba(255,255,255,0.6)"/>
      <rect x="5" y="105" width="25" height="1.5" rx="0.5" fill="rgba(255,255,255,0.6)"/>
      {/* Right: Large name */}
      <rect x="40" y="5" width="66" height="7" rx="1" fill="#111827"/>
      {/* Role title */}
      <rect x="40" y="15" width="42" height="2.5" rx="0.8" fill="#9ca3af"/>
      {/* Olive accent */}
      <rect x="40" y="19" width="22" height="2" rx="0.8" fill="#8c9a38"/>
      {/* Summary */}
      <rect x="40" y="25" width="65" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="40" y="28" width="58" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="40" y="31" width="62" height="1.5" rx="0.5" fill="#9ca3af"/>
      {/* Experience header */}
      <rect x="40" y="38" width="24" height="1.8" rx="0.8" fill="#111827"/>
      <rect x="40" y="41" width="22" height="2" rx="0.5" fill="#8c9a38"/>
      {/* Exp 1 */}
      <circle cx="44" cy="50" r="3.5" fill="#8c9a38"/>
      <rect x="50" y="47" width="30" height="2" rx="0.5" fill="#111827"/>
      <rect x="50" y="51" width="22" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="50" y="55" width="54" height="1.5" rx="0.5" fill="#d1d5db"/>
      <rect x="50" y="58" width="46" height="1.5" rx="0.5" fill="#d1d5db"/>
      {/* Exp 2 */}
      <circle cx="44" cy="68" r="3.5" fill="#8c9a38"/>
      <rect x="50" y="65" width="30" height="2" rx="0.5" fill="#111827"/>
      <rect x="50" y="69" width="22" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="50" y="73" width="54" height="1.5" rx="0.5" fill="#d1d5db"/>
      <rect x="50" y="76" width="46" height="1.5" rx="0.5" fill="#d1d5db"/>
      {/* Top Skills header */}
      <rect x="40" y="84" width="24" height="1.8" rx="0.8" fill="#111827"/>
      <rect x="40" y="87" width="22" height="2" rx="0.5" fill="#8c9a38"/>
      {/* Skill pills (rectangular) */}
      <rect x="40" y="92" width="17" height="4" rx="1" fill="#1565c0"/>
      <rect x="59" y="92" width="21" height="4" rx="1" fill="#00695c"/>
      <rect x="82" y="92" width="18" height="4" rx="1" fill="#6a1b9a"/>
      <rect x="40" y="98" width="19" height="4" rx="1" fill="#bf360c"/>
      <rect x="61" y="98" width="15" height="4" rx="1" fill="#0277bd"/>
    </svg>
  )
}

function TemplateSvgSheraz() {
  return (
    <svg viewBox="0 0 110 140" className="w-full h-full">
      {/* White background */}
      <rect x="0" y="0" width="110" height="140" fill="#fafaf8"/>
      {/* Faint watermark */}
      <rect x="8" y="4" width="94" height="14" rx="2" fill="rgba(224,120,32,0.06)"/>
      {/* Orange name centered */}
      <rect x="18" y="20" width="74" height="6" rx="1" fill="#E07820"/>
      {/* Role title */}
      <rect x="28" y="29" width="54" height="2.5" rx="0.8" fill="#d1d5db"/>
      {/* Thin separator */}
      <rect x="5" y="36" width="100" height="0.8" fill="#e5e7eb"/>
      {/* LEFT column */}
      {/* Contact header */}
      <rect x="5" y="41" width="18" height="1.8" rx="0.8" fill="#374151"/>
      <rect x="5" y="44" width="38" height="0.5" fill="#d1d5db"/>
      <rect x="5" y="47" width="32" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="5" y="50" width="28" height="1.5" rx="0.5" fill="#9ca3af"/>
      {/* Education header */}
      <rect x="5" y="56" width="20" height="1.8" rx="0.8" fill="#374151"/>
      <rect x="5" y="59" width="38" height="0.5" fill="#d1d5db"/>
      <rect x="5" y="62" width="34" height="1.5" rx="0.5" fill="#374151"/>
      <rect x="5" y="65" width="26" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="5" y="70" width="34" height="1.5" rx="0.5" fill="#374151"/>
      <rect x="5" y="73" width="26" height="1.5" rx="0.5" fill="#9ca3af"/>
      {/* Expertise header */}
      <rect x="5" y="79" width="20" height="1.8" rx="0.8" fill="#374151"/>
      <rect x="5" y="82" width="38" height="0.5" fill="#d1d5db"/>
      <rect x="7" y="85" width="32" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="7" y="88" width="28" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="7" y="91" width="30" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="7" y="94" width="25" height="1.5" rx="0.5" fill="#6b7280"/>
      {/* RIGHT column */}
      {/* Profile header */}
      <rect x="48" y="41" width="18" height="1.8" rx="0.8" fill="#374151"/>
      <rect x="48" y="44" width="58" height="0.5" fill="#d1d5db"/>
      <rect x="48" y="47" width="56" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="48" y="50" width="50" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="48" y="53" width="54" height="1.5" rx="0.5" fill="#9ca3af"/>
      {/* Experience header */}
      <rect x="48" y="60" width="22" height="1.8" rx="0.8" fill="#374151"/>
      <rect x="48" y="63" width="58" height="0.5" fill="#d1d5db"/>
      <rect x="48" y="66" width="30" height="1.5" rx="0.5" fill="#d1d5db"/>
      <rect x="48" y="69" width="36" height="2" rx="0.5" fill="#111827"/>
      <rect x="48" y="73" width="24" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="48" y="76" width="56" height="1.5" rx="0.5" fill="#d1d5db"/>
      <rect x="48" y="79" width="50" height="1.5" rx="0.5" fill="#d1d5db"/>
      <rect x="48" y="84" width="30" height="1.5" rx="0.5" fill="#d1d5db"/>
      <rect x="48" y="87" width="36" height="2" rx="0.5" fill="#111827"/>
      <rect x="48" y="91" width="24" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="48" y="94" width="56" height="1.5" rx="0.5" fill="#d1d5db"/>
      {/* Core Skills header */}
      <rect x="48" y="101" width="30" height="1.8" rx="0.8" fill="#374151"/>
      <rect x="48" y="104" width="58" height="0.5" fill="#d1d5db"/>
      <rect x="48" y="107" width="56" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="48" y="110" width="46" height="1.5" rx="0.5" fill="#9ca3af"/>
      {/* Tools header */}
      <rect x="48" y="117" width="14" height="1.8" rx="0.8" fill="#374151"/>
      <rect x="48" y="120" width="58" height="0.5" fill="#d1d5db"/>
      <rect x="48" y="123" width="8" height="8" rx="2" fill="#21759b"/>
      <rect x="58" y="123" width="8" height="8" rx="2" fill="#777bb3"/>
      <rect x="68" y="123" width="8" height="8" rx="2" fill="#f7df1e"/>
    </svg>
  )
}

function TemplateCard({ template, isSelected, onClick }: { template: typeof RESUME_TEMPLATES[0]; isSelected: boolean; onClick: () => void }) {
  return (
    <div
      className={`relative group cursor-pointer rounded-xl border-2 p-2.5 transition-all flex-shrink-0 ${
        isSelected ? 'border-[#7DC242] bg-[#7DC242]/10' : 'border-white/10 bg-white/5 hover:border-white/25'
      }`}
      style={{ width: 118 }}
      onClick={onClick}
    >
      {/* Small preview */}
      <div className="rounded-lg overflow-hidden mb-2" style={{ background: '#0c1210', height: 88 }}>
        <TemplateSvg id={template.id} />
      </div>
      <p className="text-xs font-semibold text-white">{template.name}</p>
      <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>{template.description}</p>
      {isSelected && (
        <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#7DC242' }}>
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      {/* Hover large preview */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="rounded-xl border shadow-2xl p-2" style={{ width: 200, background: '#1a2418', borderColor: 'rgba(255,255,255,0.15)' }}>
          <div className="rounded-lg overflow-hidden" style={{ background: '#0c1210', height: 160 }}>
            <TemplateSvg id={template.id} />
          </div>
          <p className="text-xs font-semibold text-white mt-2 text-center">{template.name}</p>
          <p className="text-[10px] text-center mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>{template.description}</p>
        </div>
      </div>
    </div>
  )
}

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

function TailorPanel({ jobId, hasDescription, jobTitle }: { jobId: number; hasDescription: boolean; jobTitle: string }) {
  const queryClient = useQueryClient()
  const [selectedProfileId, setSelectedProfileId] = useState<number | undefined>(undefined)
  const [result, setResult] = useState<TailoredApplication | null>(null)
  const [showCustomPrompt, setShowCustomPrompt] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [useTemplate, setUseTemplate] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(1)
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
    mutationFn: () => tailorApi.generatePreview(
      jobId,
      selectedProfileId,
      showCustomPrompt && customPrompt.trim() ? customPrompt.trim() : undefined,
      useTemplate ? selectedTemplate : undefined,
    ),
    onSuccess: (data) => {
      setPreviewData(data)
      setPreviewOpen(true)
      try { sessionStorage.setItem(previewKey, JSON.stringify(data)) } catch {}
    },
  })

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
  <link href="https://fonts.googleapis.com/css2?family=Bitter:wght@400;700&family=Montserrat:wght@400;500;600;700;900&family=Open+Sans:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; box-sizing: border-box; }
    @page { size: A4 portrait; margin: 10mm 0; }
    @page :first { margin-top: 0; margin-bottom: 10mm; }
    html, body { margin: 0; padding: 0; background: white; }
  </style>
</head>
<body>
  ${html}
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 800); };<\/script>
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
                Generating…
              </>
            ) : displayResult ? 'Regenerate' : 'Generate'}
          </button>

          {!profiles?.length && (
            <a href="/profiles" className="text-sm text-blue-600 hover:underline">
              Create a profile first →
            </a>
          )}

          {/* Reopen preview if closed accidentally */}
          {previewData && !previewOpen && !mutation.isPending && (
            <button
              onClick={() => setPreviewOpen(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium border border-[#7DC242]/40 text-[#7DC242] hover:bg-[#7DC242]/10 transition-colors"
            >
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
          <button
            type="button"
            onClick={() => setShowCustomPrompt(!showCustomPrompt)}
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: showCustomPrompt ? '#7DC242' : 'var(--text-muted)' }}
          >
            <svg className={`w-4 h-4 transition-transform ${showCustomPrompt ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Custom Instructions {showCustomPrompt ? '(enabled)' : ''}
          </button>

          {showCustomPrompt && (
            <div className="space-y-1.5">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={"Add special instructions for the AI, e.g.:\n• Emphasize my WordPress experience\n• Use a more formal tone in the cover letter\n• Highlight my leadership experience\n• Focus on cloud/DevOps skills"}
                className="w-full text-sm border rounded-xl p-3 resize-y placeholder:leading-relaxed"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-input)', minHeight: '90px' }}
                rows={4}
              />
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                These instructions will be appended to both the resume and cover letter generation prompts.
              </p>
            </div>
          )}
        </div>

        {/* Template selector */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useTemplate}
              onChange={e => setUseTemplate(e.target.checked)}
              className="rounded"
              style={{ accentColor: '#7DC242' }}
            />
            <span className="text-sm font-medium" style={{ color: useTemplate ? '#7DC242' : 'var(--text-muted)' }}>
              Use Resume Template
            </span>
          </label>

          {useTemplate && (
            <div className="flex gap-3 flex-wrap">
              {RESUME_TEMPLATES.map(t => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  isSelected={selectedTemplate === t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {mutation.isError && (
          <div className="rounded-lg p-3 text-sm border" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
            {(mutation.error as any)?.response?.data?.detail || 'Generation failed. Check that ANTHROPIC_API_KEY is set in Settings.'}
          </div>
        )}

        {/* Download error */}
        {downloadError && (
          <div className="rounded-lg p-3 text-sm border flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
            <span style={{ flexShrink: 0 }}>⚠</span>
            <span>{downloadError}</span>
            <button onClick={() => setDownloadError(null)} style={{ marginLeft: 'auto', flexShrink: 0, background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* Loading state */}
        {mutation.isPending && (
          <div className="rounded-lg p-4 text-sm flex items-center gap-3 border" style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}>
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            Claude is reading the job description and tailoring your resume and cover letter…
          </div>
        )}

        {/* Results — shown for previously saved tailorings */}
        {displayResult && !mutation.isPending && (
          <div className="space-y-5">
            {/* Tailored Resume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Tailored Resume</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadPdf(displayResult)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg transition-colors font-medium" style={{ background: 'rgba(59,130,246,0.1)' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PDF
                  </button>
                  <CopyButton text={displayResult.tailored_resume_text ?? ''} />
                </div>
              </div>
              <textarea
                className="w-full font-mono text-xs border rounded-lg p-4 leading-relaxed resize-y"
                style={{ background: 'var(--code-bg)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                rows={20}
                value={displayResult.tailored_resume_text ?? ''}
                onChange={() => {}}
                readOnly
              />
            </div>

            {/* Cover Letter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Cover Letter</h3>
                <CopyButton text={displayResult.cover_letter ?? ''} />
              </div>
              <textarea
                className="w-full text-sm border rounded-lg p-4 leading-relaxed resize-y"
                style={{ background: 'var(--code-bg)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                rows={14}
                value={displayResult.cover_letter ?? ''}
                onChange={() => {}}
                readOnly
              />
            </div>
          </div>
        )}

        {/* Hidden off-screen template for existing saved result PDF capture */}
        {displayResult?.tailored_resume_data && (() => {
          const tplId = useTemplate ? selectedTemplate : (displayResult.template_id ?? 1)
          return (
            <div style={{ position: 'absolute', left: -9999, top: 0, zIndex: -1, overflow: 'hidden', width: 794 }} aria-hidden="true">
              <div ref={templateRef}>
                {tplId === 2 ? <WaleedTemplate data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : tplId === 3 ? <ArhamTemplate  data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : tplId === 4 ? <SherazTemplate data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : tplId === 5 ? <WaqarTemplate  data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                  : <RidaTemplate data={displayResult.tailored_resume_data as Record<string,any>} photo={profilePhoto} />
                }
              </div>
            </div>
          )
        })()}
      </div>

      {/* Preview modal — rendered via portal to escape backdrop-filter stacking context */}
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
      </div>

      {/* Details Grid */}
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

      {/* Description */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">Job Description</h2>
        <div className="rounded-lg p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto" style={{ background: 'var(--code-bg)' }}>
          {job.description || 'No description available.'}
        </div>
      </div>

      {/* AI Tailor Panel */}
      <TailorPanel jobId={Number(id)} hasDescription={!!job.description} jobTitle={job.title} />

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
