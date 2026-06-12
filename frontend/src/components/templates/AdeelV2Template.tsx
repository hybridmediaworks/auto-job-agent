import { ensureUrl, cleanText, resolveTools, ToolIconBox, PortfolioGrid, nonEmpty } from './shared'
import type { TemplateProps } from './shared'

/**
 * Adeel V2 — pixel replica of the Canva "Adeel Shahzad / Technical Web Manager" resume.
 * Measured from the reference PDF (816x1056 Letter, scaled to the 794px A4 canvas):
 *   header #8b52ff inset 11px, name #f8e53c 47px, cyan #5ce1e6 5px column divider,
 *   headings Montserrat 400 19.5px #8c52ff over a 2px #818181 rule with #dcdcdc shadow,
 *   skill pills #8c52ff, bullets Roboto 10px #222121.
 * Canva Sans (not on Google Fonts) is stood in by Poppins (bold display) / Inter (regular).
 */
export function AdeelV2Template({ data, photo: _photo }: TemplateProps) {
  const tools = resolveTools(nonEmpty(data.tools_list)).slice(0, 6)
  const skills: string[] = nonEmpty(data.skills_list)
  const experience: any[] = data.experience || []
  const education: any[] = data.education || []
  const usefulLinks: string[] = nonEmpty(data.useful_links)

  const PURPLE = '#8b52ff'
  const YELLOW = '#f8e53c'
  const CYAN = '#5ce1e6'
  const TEXT = '#222121'
  const P = 'Poppins, Arial, sans-serif'
  const I = 'Inter, Arial, sans-serif'
  const R = 'Roboto, Arial, sans-serif'
  const M = 'Montserrat, Arial, sans-serif'

  // 19.5px Montserrat REGULAR purple heading over a dark rule with a light shadow line
  const SectionHeader = ({ label, sparkle }: { label: string; sparkle?: boolean }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: M, fontSize: 19.5, fontWeight: 400, color: PURPLE }}>
        {label}{sparkle && <span style={{ color: CYAN, fontSize: 14, marginLeft: 4 }}>✦₊</span>}
      </div>
      <div style={{ height: 2, background: '#818181', marginTop: 7 }} />
      <div style={{ height: 1.5, background: '#dcdcdc' }} />
    </div>
  )

  const ContactIcon = ({ path }: { path: string }) => (
    <div style={{ width: 19, height: 19, borderRadius: '50%', background: CYAN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d={path} /></svg>
    </div>
  )

  return (
    <div style={{ width: 794, minHeight: 1085, fontFamily: I, background: '#ffffff', boxSizing: 'border-box' as const, padding: '11px 11px 0 11px' }}>
      {/* ── Purple header: name, title with flanking lines, contact row ── */}
      <div style={{ background: PURPLE, padding: '4px 36px 11px 36px' }}>
        <div style={{ fontFamily: P, fontSize: 47, fontWeight: 700, color: YELLOW, textAlign: 'center' as const, lineHeight: 1.12 }}>{data.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 3 }}>
          <div style={{ width: 130, height: 1.5, background: '#ffffff' }} />
          <div style={{ fontFamily: R, fontSize: 14.3, fontWeight: 400, color: '#ffffff', letterSpacing: 1.2, textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const }}>{data.role_title || data.title}</div>
          <div style={{ width: 130, height: 1.5, background: '#ffffff' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          {data.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <ContactIcon path="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              <a href={`mailto:${data.email}`} style={{ fontFamily: I, fontSize: 11, color: '#ffffff', textDecoration: 'underline' }}>{data.email}</a>
            </div>
          )}
          {data.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <ContactIcon path="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V21c0 .6-.4 1-1 1C10.4 22 2 13.6 2 4.5c0-.6.4-1 1-1H7c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.3 1L6.6 10.8z" />
              <span style={{ fontFamily: I, fontSize: 11, color: '#ffffff' }}>{data.phone}</span>
            </div>
          )}
          {data.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <ContactIcon path="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              <span style={{ fontFamily: P, fontSize: 11, fontWeight: 600, color: '#ffffff' }}>{data.location}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Two-column body split by the 5px cyan bar (flush with header bottom) ── */}
      <div style={{ display: 'flex', padding: '0 7px 28px 7px' }}>
        {/* Left column */}
        <div style={{ width: 294, flexShrink: 0, paddingRight: 13, paddingTop: 26 }}>
          {data.summary && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader label="About Me" />
              <div style={{ fontFamily: I, fontSize: 9.6, color: '#010101', lineHeight: 1.42, textAlign: 'justify' as const }}>{cleanText(data.summary)}</div>
            </div>
          )}

          {skills.length > 0 && (
            <div style={{ marginBottom: 24, breakInside: 'avoid' as const }}>
              <SectionHeader label="Skills:" />
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                {skills.map((skill, i) => (
                  <span key={i} style={{ fontFamily: P, background: PURPLE, color: '#ffffff', fontSize: 12.3, fontWeight: 600, padding: '1px 8px 2px 8px', borderRadius: 2, lineHeight: 1.5 }}>{skill}</span>
                ))}
              </div>
            </div>
          )}

          {tools.length > 0 && (
            <div style={{ marginBottom: 24, breakInside: 'avoid' as const }}>
              <SectionHeader label="Tools:" />
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 9 }}>
                {tools.map((tool, i) => <ToolIconBox key={i} {...tool} size={40} />)}
              </div>
            </div>
          )}

          {data.portfolio_images && data.portfolio_images.length > 0 && (
            <div style={{ marginBottom: 24, breakInside: 'avoid' as const }}>
              <SectionHeader label="Portfolio:" sparkle />
              <PortfolioGrid images={data.portfolio_images} />
            </div>
          )}

          {usefulLinks.length > 0 && (
            <div style={{ marginBottom: 24, breakInside: 'avoid' as const }}>
              <SectionHeader label="Useful Links:" />
              {usefulLinks.map((link, i) => (
                <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 4 }}>
                  <span style={{ color: '#000000', fontSize: 10.3, lineHeight: 1.4, flexShrink: 0 }}>•</span>
                  <a href={ensureUrl(link)} style={{ fontFamily: M, fontSize: 10.3, color: '#000000', textDecoration: 'none', wordBreak: 'break-all' as const, lineHeight: 1.4 }}>{link}</a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cyan divider */}
        <div style={{ width: 5, background: CYAN, flexShrink: 0, alignSelf: 'stretch' }} />

        {/* Right column */}
        <div style={{ flex: 1, paddingLeft: 17, paddingTop: 26, minWidth: 0 }}>
          {experience.length > 0 && (
            <div style={{ marginBottom: 26 }}>
              <SectionHeader label="Experience" />
              {experience.map((exp: any, i: number) => (
                <div key={i} style={{ marginBottom: 19, breakInside: 'avoid' as const }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontFamily: I, fontSize: 12.9, color: '#010101', textDecoration: 'underline', textUnderlineOffset: 3 }}>{exp.title}</span>
                      <span style={{ fontFamily: I, fontSize: 12.9, color: '#010101' }}> | </span>
                      <span style={{ fontFamily: P, fontSize: 12.6, fontWeight: 600, color: PURPLE }}>{exp.company}</span>
                    </div>
                    <div style={{ fontFamily: I, fontSize: 12, color: '#010101', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>| {exp.start_date} - {exp.end_date || 'Present'} |</div>
                  </div>
                  {nonEmpty(exp.bullets).map((b: string, j: number) => (
                    <div key={j} style={{ display: 'flex', gap: 9, marginBottom: 3, paddingLeft: 6 }}>
                      <span style={{ color: TEXT, fontSize: 11, flexShrink: 0, lineHeight: 1.3 }}>•</span>
                      <span style={{ fontFamily: R, fontSize: 10, color: TEXT, lineHeight: 1.38, textAlign: 'justify' as const }}>{cleanText(b)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {education.length > 0 && (
            <div style={{ marginBottom: 24, breakInside: 'avoid' as const }}>
              <SectionHeader label="Education" />
              <div style={{ display: 'flex', gap: 26, marginTop: 14 }}>
                {education.map((edu: any, i: number) => (
                  <div key={i} style={{ flex: 1, borderLeft: '1.5px solid #b9b9b9', paddingLeft: 13 }}>
                    <div style={{ fontFamily: M, fontSize: 13.4, fontWeight: 400, color: '#000000' }}>{edu.institution}</div>
                    <div style={{ fontFamily: M, fontSize: 10.8, fontWeight: 300, color: '#3d3d3d', marginTop: 3 }}>{edu.degree}</div>
                    <div style={{ fontFamily: M, fontSize: 10.8, fontWeight: 300, color: '#3d3d3d', marginTop: 1 }}>{edu.graduation}</div>
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
