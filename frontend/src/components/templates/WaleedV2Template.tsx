import { ensureUrl, cleanText, resolveTools, ToolIconBox, PortfolioGrid, nonEmpty } from './shared'
import type { TemplateProps } from './shared'

export function WaleedV2Template({ data, photo }: TemplateProps) {
  const tools = resolveTools(nonEmpty(data.tools_list)).slice(0, 6)
  const skills: string[] = nonEmpty(data.skills_list)
  const experience: any[] = data.experience || []
  const education: any[] = data.education || []
  const usefulLinks: string[] = nonEmpty(data.useful_links)
  const effectivePhoto = photo || data.photo

  const GREEN = '#72ff4f'
  const LINE_GREEN = '#72ff4f'
  const TEXT_GREEN = '#0beb22'
  const TEXT_DARK = '#111827'
  const TEXT_BLACK = '#000000'
  const M = 'Montserrat, Arial, sans-serif'
  const OS = 'Open Sans, Arial, sans-serif'

  const SectionHeader = ({ label }: { label: string }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: M, fontSize: 13, fontWeight: 800, color: TEXT_DARK, letterSpacing: 1.5, textTransform: 'uppercase' as const }}>{label}</div>
      <div style={{ height: 2, background: LINE_GREEN, marginTop: 5, width: '100%' }} />
    </div>
  )

  return (
    <div style={{ width: 794, minHeight: 1123, fontFamily: OS, background: '#ffffff', boxSizing: 'border-box' as const }}>

      {/* ── Solid Green Header Banner ──────────────────────────────── */}
      <div style={{ background: GREEN, padding: '30px 44px 26px 44px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {effectivePhoto && (
            <img src={effectivePhoto} crossOrigin="anonymous"
              style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover' as const, border: '3px solid rgba(255,255,255,0.55)', flexShrink: 0 }}
              alt="Profile" />
          )}
          <div style={{ flex: 1, textAlign: effectivePhoto ? 'left' as const : 'center' as const }}>
            <div style={{ fontFamily: M, fontSize: 44, fontWeight: 900, color: TEXT_DARK, letterSpacing: 0.5, textTransform: 'uppercase' as const, lineHeight: 1.1 }}>
              {data.name}
            </div>
            <div style={{ fontFamily: M, fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginTop: 8, letterSpacing: 2.5, textTransform: 'uppercase' as const }}>
              {data.role_title || data.title}
            </div>
          </div>
        </div>
      </div>

      {/* ── Contact Row ────────────────────────────────────────────── */}
      <div style={{ background: 'white', padding: '14px 44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `3px solid ${LINE_GREEN}`, fontSize: 12, color: TEXT_DARK, fontWeight: 600 }}>
        {data.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={TEXT_DARK} style={{ flexShrink: 0 }}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span>{data.location}</span>
          </div>
        )}
        {data.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={TEXT_DARK} style={{ flexShrink: 0 }}>
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V21c0 .6-.4 1-1 1C10.4 22 2 13.6 2 4.5c0-.6.4-1 1-1H7c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.3 1L6.6 10.8z"/>
            </svg>
            <span>{data.phone}</span>
          </div>
        )}
        {data.email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={TEXT_DARK} style={{ flexShrink: 0 }}>
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
            <a href={`mailto:${data.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{data.email}</a>
          </div>
        )}
      </div>

      {/* ── Two Columns ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', padding: '22px 44px 32px 44px', gap: 0, alignItems: 'stretch' }}>

        {/* Left Column */}
        <div style={{ width: '37%', paddingRight: 26 }}>

          {data.summary && (
            <div style={{ marginBottom: 20 }}>
              <SectionHeader label="About Me" />
              <div style={{ fontSize: 10.5, color: TEXT_BLACK, lineHeight: 1.75, textAlign: 'justify' as const }}>{cleanText(data.summary)}</div>
            </div>
          )}

          {skills.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionHeader label="Skills" />
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '5px 5px' }}>
                {skills.map((skill, i) => (
                  <span key={i} style={{ background: '#e5e7eb', color: '#111827', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 4, border: '1px solid #d1d5db' }}>{skill}</span>
                ))}
              </div>
            </div>
          )}

          {data.portfolio_images && data.portfolio_images.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: M, fontSize: 13, fontWeight: 800, color: TEXT_DARK, letterSpacing: 1.5, textTransform: 'uppercase' as const }}>
                  Portfolio <span style={{ fontSize: 11, verticalAlign: 'middle' }}>✦</span>
                </div>
                <div style={{ height: 2, background: LINE_GREEN, marginTop: 5, width: '100%' }} />
              </div>
              <PortfolioGrid images={data.portfolio_images} />
            </div>
          )}

          {usefulLinks.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionHeader label="Useful Links" />
              {usefulLinks.map((link, i) => (
                <div key={i} style={{ fontSize: 9.5, color: TEXT_DARK, marginBottom: 5, display: 'flex', gap: 7 }}>
                  <span style={{ color: TEXT_GREEN, fontWeight: 700, flexShrink: 0 }}>•</span>
                  <a href={ensureUrl(link)} style={{ color: 'inherit', textDecoration: 'none', wordBreak: 'break-all' as const }}>{link}</a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column Divider */}
        <div style={{ width: '1.5px', background: '#9ca3af', flexShrink: 0, alignSelf: 'stretch' }} />

        {/* Right Column */}
        <div style={{ flex: 1, paddingLeft: 26 }}>

          {experience.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionHeader label="Experience" />
              {experience.map((exp: any, i: number) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: TEXT_GREEN, fontFamily: M }}>{exp.company}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2, marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: TEXT_BLACK }}>{exp.title}</div>
                    <div style={{ fontSize: 10.5, color: TEXT_BLACK, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>({exp.start_date} – {exp.end_date || 'Present'})</div>
                  </div>
                  {exp.description && (
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: TEXT_BLACK, lineHeight: 1.55, marginBottom: 4, textAlign: 'justify' as const }}>
                      {cleanText(exp.description)}
                    </div>
                  )}
                  {nonEmpty(exp.bullets).map((b: string, j: number) => (
                    <div key={j} style={{ display: 'flex', gap: 7, marginBottom: 3 }}>
                      <span style={{ color: TEXT_GREEN, fontSize: 11, lineHeight: '1.6', flexShrink: 0 }}>•</span>
                      <span style={{ fontSize: 10.5, color: TEXT_BLACK, lineHeight: 1.6, textAlign: 'justify' as const }}>{cleanText(b)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {education.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionHeader label="Education" />
              <div style={{ display: 'flex', gap: 24 }}>
                {education.map((edu: any, i: number) => (
                  <div key={i} style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: TEXT_DARK, fontFamily: M }}>{edu.institution}</div>
                    <div style={{ fontSize: 11, color: TEXT_DARK, marginTop: 2 }}>{edu.degree}</div>
                    <div style={{ fontSize: 10, color: TEXT_DARK, marginTop: 1 }}>{edu.graduation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tools.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionHeader label="Tools" />
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                {tools.map((tool, i) => <ToolIconBox key={i} {...tool} size={40} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Green Bar ───────────────────────────────────────── */}
      <div style={{ height: 8, background: GREEN }} />
    </div>
  )
}
