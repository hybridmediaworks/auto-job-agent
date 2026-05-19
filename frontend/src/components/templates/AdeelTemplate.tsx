import { ensureUrl, cleanText, resolveTools, ToolIconBox, PortfolioGrid, nonEmpty } from './shared'
import type { TemplateProps } from './shared'

export function AdeelTemplate({ data, photo: _photo }: TemplateProps) {
  const tools = resolveTools(nonEmpty(data.tools_list)).slice(0, 8)
  const skills: string[] = nonEmpty(data.skills_list)
  const experience: any[] = data.experience || []
  const education: any[] = data.education || []
  const usefulLinks: string[] = nonEmpty(data.useful_links)

  const BLUE = '#1565c0'
  const TEAL = '#4db6ac'
  const TEXT = '#1a1a1a'
  const M = 'Montserrat, Arial, sans-serif'
  const OS = 'Open Sans, Arial, sans-serif'

  const SectionHeader = ({ label }: { label: string }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: M, fontSize: 16, fontWeight: 800, color: BLUE, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ height: 2, background: TEAL, marginTop: 4, width: '100%' }} />
    </div>
  )

  return (
    <div style={{ width: 794, minHeight: 1085, fontFamily: OS, background: '#ffffff', boxSizing: 'border-box' as const }}>
      {/* Header */}
      <div style={{ background: BLUE, padding: '32px 40px 16px 40px', textAlign: 'center' as const }}>
        <div style={{ fontFamily: M, fontSize: 44, fontWeight: 800, color: '#FFC107', letterSpacing: 1.5, textTransform: 'uppercase' as const }}>{data.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
          <div style={{ flex: 1, height: 2, background: TEAL }} />
          <div style={{ fontFamily: M, fontSize: 13, fontWeight: 600, color: 'white', letterSpacing: 1.5, textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const }}>{data.role_title || data.title}</div>
          <div style={{ flex: 1, height: 2, background: TEAL }} />
        </div>
      </div>

      {/* Contact Bar — same blue as header, teal circle SVG icons */}
      <div style={{ background: BLUE, padding: '14px 40px 20px 40px', display: 'flex', justifyContent: 'center', gap: 40 }}>
        {data.email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
            </div>
            <a href={`mailto:${data.email}`} style={{ fontSize: 11, fontWeight: 600, color: 'white', textDecoration: 'none' }}>{data.email}</a>
          </div>
        )}
        {data.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V21c0 .6-.4 1-1 1C10.4 22 2 13.6 2 4.5c0-.6.4-1 1-1H7c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.3 1L6.6 10.8z"/>
              </svg>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'white' }}>{data.phone}</span>
          </div>
        )}
        {data.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'white' }}>{data.location}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', padding: '28px 40px 40px 40px' }}>
        {/* Left Column */}
        <div style={{ width: '34%', paddingRight: 28 }}>
          {data.summary && (
            <div style={{ marginBottom: 28 }}>
              <SectionHeader label="About Me" />
              <div style={{ fontSize: 10.5, color: TEXT, lineHeight: 1.6, textAlign: 'justify' as const }}>{cleanText(data.summary)}</div>
            </div>
          )}

          {skills.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SectionHeader label="Skills:" />
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
                {skills.map((skill, i) => (
                  <span key={i} style={{ background: BLUE, color: 'white', fontSize: 9.5, fontWeight: 700, padding: '4px 10px', borderRadius: 2 }}>{skill}</span>
                ))}
              </div>
            </div>
          )}

          {tools.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SectionHeader label="Tools:" />
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                {tools.map((tool, i) => <ToolIconBox key={i} {...tool} size={38} />)}
              </div>
            </div>
          )}

          {data.portfolio_images && data.portfolio_images.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: M, fontSize: 16, fontWeight: 800, color: BLUE, letterSpacing: 0.5 }}>Portfolio: <span style={{ fontSize: 13 }}>✦</span></div>
                <div style={{ height: 2, background: TEAL, marginTop: 4, width: '100%' }} />
              </div>
              <PortfolioGrid images={data.portfolio_images} />
            </div>
          )}

          {usefulLinks.length > 0 && (
            <div>
              <SectionHeader label="Useful Links:" />
              {usefulLinks.map((link, i) => (
                <div key={i} style={{ fontSize: 10, color: TEXT, marginBottom: 5, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span style={{ color: BLUE, fontWeight: 700, flexShrink: 0 }}>•</span>
                  <a href={ensureUrl(link)} style={{ color: BLUE, textDecoration: 'none', wordBreak: 'break-all' as const }}>{link}</a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column Divider */}
        <div style={{ width: '1.5px', background: TEAL, flexShrink: 0, alignSelf: 'stretch' }} />

        {/* Right Column */}
        <div style={{ flex: 1, paddingLeft: 28 }}>
          {experience.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <SectionHeader label="Experience" />
              {experience.map((exp: any, i: number) => (
                <div key={i} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontFamily: M, fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{exp.title}</span>
                      <span style={{ margin: '0 6px', color: '#cbd5e1' }}>|</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: BLUE }}>{exp.company}</span>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', whiteSpace: 'nowrap' as const }}>
                      | {exp.start_date} - {exp.end_date || 'Present'} |
                    </div>
                  </div>
                  {nonEmpty(exp.bullets).map((b: string, j: number) => (
                    <div key={j} style={{ display: 'flex', gap: 8, marginBottom: 4, paddingLeft: 4 }}>
                      <span style={{ color: BLUE, fontSize: 14, flexShrink: 0, lineHeight: 1.4 }}>•</span>
                      <span style={{ fontSize: 10.5, color: TEXT, lineHeight: 1.55, textAlign: 'justify' as const }}>{cleanText(b)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {education.length > 0 && (
            <div>
              <SectionHeader label="Education" />
              <div style={{ display: 'flex', gap: 40 }}>
                {education.map((edu: any, i: number) => (
                  <div key={i} style={{ flex: 1 }}>
                    <div style={{ fontFamily: M, fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{edu.institution}</div>
                    <div style={{ fontSize: 11, color: TEXT, marginTop: 3 }}>{edu.degree}</div>
                    <div style={{ fontSize: 10.5, color: '#4b5563', marginTop: 2 }}>{edu.graduation}</div>
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
