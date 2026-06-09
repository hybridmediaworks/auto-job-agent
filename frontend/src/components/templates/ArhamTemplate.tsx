import { cleanText, resolveTools, ToolIconBox, nonEmpty } from './shared'
import type { TemplateProps } from './shared'

export function ArhamTemplate({ data, photo }: TemplateProps) {
  const tools = resolveTools(data.tools_list || []).slice(0, 6)
  const skills: string[] = data.skills_list || []
  const experience: any[] = data.experience || []
  const education: any[] = data.education || []
  const keyAchievements: string[] = data.key_achievements || []
  const effectivePhoto = photo || data.photo

  const SIDEBAR_BG = '#1a5c2e'
  const GOLD = '#FFC000'
  const ACCENT = '#FFC000'
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
      <div style={{ width: 258, background: SIDEBAR_BG, padding: '30px 18px', boxSizing: 'border-box' as const, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 26 }}>
          {effectivePhoto ? (
            <img src={effectivePhoto} crossOrigin="anonymous" style={{ width: 130, height: 130, borderRadius: '50%', objectFit: 'cover' as const, border: '4px solid #b8a9d4', display: 'block', flexShrink: 0 }} alt="Profile" />
          ) : (
            <div style={{ width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #b8a9d4', fontSize: 44, fontWeight: 700, color: 'white', fontFamily: M, flexShrink: 0, letterSpacing: 2 }}>
              {(() => { const p = (data.name || '').trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (p[0]?.[0] || '?').toUpperCase() })()}
            </div>
          )}
        </div>
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
        {tools.length > 0 && (
          <div style={{ marginBottom: 22, breakInside: 'avoid' as const }}>
            <SidebarHeader label="Tools" />
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
              {tools.map((tool, i) => <ToolIconBox key={i} {...tool} size={36} />)}
            </div>
          </div>
        )}
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
      <div style={{ flex: 1, padding: '32px 32px 32px 28px', minWidth: 0, background: '#ffffff' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: M, fontSize: 42, fontWeight: 700, color: '#2b2b2b', lineHeight: 1.05, letterSpacing: -0.5 }}>{data.name}</div>
          <div style={{ fontFamily: M, fontSize: 18, fontWeight: 500, color: '#4a4a4a', marginTop: 6, letterSpacing: 0.3 }}>{data.role_title || data.title}</div>
          {data.summary && (
            <div style={{ fontFamily: OS, fontSize: 12, fontWeight: 400, color: '#555555', lineHeight: 1.75, marginTop: 12 }}>{cleanText(data.summary)}</div>
          )}
        </div>
        {experience.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <MainHeader label="Experience" />
            <div style={{ position: 'relative' as const }}>
              <div style={{ position: 'absolute' as const, left: 3.5, top: 8, bottom: 14, width: 1, background: '#d0d0d0', zIndex: 0 }} />
              {experience.map((exp: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 22, position: 'relative' as const, zIndex: 1 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, flexShrink: 0, marginTop: 5, position: 'relative' as const, zIndex: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 3 }}>
                      <div>
                        <div style={{ fontFamily: M, fontSize: 16, fontWeight: 600, color: '#2b2b2b', lineHeight: 1.25 }}>{exp.title}</div>
                        <div style={{ fontFamily: OS, fontSize: 14, fontWeight: 400, color: '#777777', marginTop: 2 }}>{exp.company}</div>
                      </div>
                      <div style={{ fontFamily: OS, fontSize: 12, fontWeight: 400, color: '#2b2b2b', flexShrink: 0, textAlign: 'right' as const, lineHeight: 1.7, marginLeft: 10 }}>
                        <div>{exp.start_date}</div>
                        <div>{exp.end_date || 'Present'}</div>
                      </div>
                    </div>
                    {nonEmpty(exp.bullets).map((b: string, j: number) => (
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
