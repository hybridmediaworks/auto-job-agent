import { ensureUrl, cleanText, nonEmpty } from './shared'
import type { TemplateProps } from './shared'

export function WaqarTemplate({ data, photo }: TemplateProps) {
  const FM = "'Montserrat', 'Arial', sans-serif"
  const FO = "'Open Sans', 'Arial', sans-serif"
  const FI = "'Inter', 'Arial', sans-serif"
  const BLUE = '#3c6df0'
  const DARK = '#19273c'
  const BODY = '#3e3e3e'

  const skills: string[] = data.skills_list
    || (data.skills && typeof data.skills === 'object' && !Array.isArray(data.skills)
        ? Object.values(data.skills as Record<string, string[]>).flat()
        : [])
  const tools: string[] = (data.tools_list || []).slice(0, 6)
  const experience: any[] = data.experience || []
  const education: any[] = data.education || []
  const keyAchievements: string[] = data.key_achievements || []
  const languages: any[] = data.languages || []
  const projects: any[] = data.projects || []
  // Merge skills + tools for the chip grid, dropping case/".js"/acronym duplicates:
  // tool names are intentionally also placed in skills_list for ATS, and this is the
  // one template that shows both lists together, so without this they render twice
  // (e.g. "Docker" twice, or "Amazon Web Services (AWS)" plus a bare "AWS").
  const allSkills = (() => {
    const seen = new Set<string>()
    const norm = (s: string) => (s || '').trim().toLowerCase().replace(/\.js$/, '')
    return [...skills, ...tools].filter((s) => {
      const label = (s || '').trim()
      if (!label) return false
      const key = norm(label)
      const acro = label.match(/\(([^)]+)\)\s*$/)   // trailing "(AWS)" -> also reserve "aws"
      const acroKey = acro ? norm(acro[1]) : ''
      if (seen.has(key) || (acroKey && seen.has(acroKey))) return false
      seen.add(key)
      if (acroKey) seen.add(acroKey)
      return true
    })
  })()
  const effectivePhoto = photo || data.photo

  const initials = (() => {
    const parts = (data.name || '').trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return (parts[0]?.[0] || '?').toUpperCase()
  })()

  const SH = ({ label }: { label: string }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: FM, fontSize: 19, fontWeight: 700, color: DARK, letterSpacing: 0.4, textTransform: 'uppercase' as const, paddingBottom: 4, borderBottom: `2px solid ${DARK}` }}>{label}</div>
    </div>
  )

  return (
    <div style={{ width: 794, minHeight: 1085, fontFamily: FO, background: '#ffffff', boxSizing: 'border-box' as const, padding: '45px 53px 32px 53px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FM, fontSize: 32, fontWeight: 700, color: DARK, lineHeight: 1.1 }}>{data.name}</div>
          <div style={{ fontFamily: FM, fontSize: 16, fontWeight: 700, color: BLUE, marginTop: 4 }}>{data.role_title || data.title}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '2px 20px', marginTop: 8, fontFamily: FO, fontSize: 10, fontWeight: 700, color: BODY }}>
            {data.phone && <span>☎ {data.phone}</span>}
            {data.email && <span>✉ <a href={`mailto:${data.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{data.email}</a></span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '2px 20px', marginTop: 3, fontFamily: FO, fontSize: 10, fontWeight: 700, color: BODY }}>
            {data.linkedin && <span>🔗 <a href={ensureUrl(data.linkedin)} style={{ color: 'inherit', textDecoration: 'none' }}>{data.linkedin}</a></span>}
            {data.location && <span>📍 {data.location}</span>}
          </div>
        </div>
        {effectivePhoto ? (
          <img src={effectivePhoto} crossOrigin="anonymous" style={{ width: 114, height: 114, borderRadius: 4, objectFit: 'cover' as const, flexShrink: 0, marginLeft: 16 }} alt="Profile" />
        ) : (
          <div style={{ width: 114, height: 114, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 16, borderRadius: 4 }}>
            <span style={{ fontFamily: FI, color: DARK, fontSize: 29, fontWeight: 500 }}>{initials}</span>
          </div>
        )}
      </div>
      {data.summary && (
        <div style={{ marginBottom: 20 }}>
          <SH label="Summary" />
          <div style={{ fontFamily: FO, fontSize: 11, color: BODY, lineHeight: 1.8 }}>{cleanText(data.summary)}</div>
        </div>
      )}
      {experience.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SH label="Experience" />
          {experience.map((exp: any, i: number) => (
            <div key={i}>
              <div style={{ fontFamily: FM, fontSize: 15, fontWeight: 400, color: DARK, lineHeight: 1.3 }}>{exp.title}</div>
              <div style={{ fontFamily: FO, fontSize: 12, fontWeight: 700, color: BLUE, marginTop: 1 }}>{exp.company}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '2px 18px', fontFamily: FO, fontSize: 10, color: BODY, marginTop: 2 }}>
                <span>📅 {exp.start_date} - {exp.end_date || 'Present'}</span>
                {exp.location && <span>📍 {exp.location}</span>}
              </div>
              {exp.company_description && (
                <div style={{ fontFamily: FO, fontSize: 11, color: BODY, lineHeight: 1.75, marginTop: 4 }}>{cleanText(exp.company_description)}</div>
              )}
              <div style={{ marginTop: 5 }}>
                {nonEmpty(exp.bullets).map((b: string, j: number) => (
                  <div key={j} style={{ display: 'flex', gap: 7, marginBottom: 2 }}>
                    <span style={{ fontFamily: FO, color: BODY, fontSize: 12, lineHeight: '1.7', flexShrink: 0 }}>•</span>
                    <span style={{ fontFamily: FO, fontSize: 11, color: BODY, lineHeight: 1.7 }}>{cleanText(b)}</span>
                  </div>
                ))}
              </div>
              {i < experience.length - 1 && (
                <div style={{ borderBottom: '1px dashed #c8c8c8', margin: '12px 0' }} />
              )}
            </div>
          ))}
        </div>
      )}
      {education.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SH label="Education" />
          {education.map((edu: any, i: number) => (
            <div key={i} style={{ marginBottom: i < education.length - 1 ? 12 : 0 }}>
              <div style={{ fontFamily: FM, fontSize: 15, fontWeight: 400, color: DARK, lineHeight: 1.3 }}>{edu.degree}</div>
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
      {keyAchievements.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SH label="Key Achievements" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {keyAchievements.map((ach: string, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0, marginTop: 1 }} fill={BLUE}>
                  <path d="M8 14s-6-4.35-6-8a4 4 0 0 1 6-3.46A4 4 0 0 1 14 6c0 3.65-6 8-6 8z"/>
                </svg>
                <span style={{ fontFamily: FO, fontSize: 11, color: BODY, lineHeight: 1.75 }}>{cleanText(ach)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
      {projects.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SH label="Projects" />
          {projects.map((proj: any, i: number) => (
            <div key={i}>
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
                {nonEmpty(proj.bullets).map((b: string, j: number) => (
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
