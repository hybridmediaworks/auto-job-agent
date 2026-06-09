import { ensureUrl, cleanText, companyBgColor, resolveTools, ToolIconBox, nonEmpty } from './shared'
import type { TemplateProps } from './shared'

export function RidaTemplate({ data, photo }: TemplateProps) {
  const tools = resolveTools(data.tools_list || []).slice(0, 6)
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
      <div style={{ background: '#0d3b4f', padding: '26px 34px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {effectivePhoto && (
            <img src={effectivePhoto} crossOrigin="anonymous" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' as const, border: '3px solid #4db6ac', flexShrink: 0 }} alt="Profile" />
          )}
          <div>
            <div style={{ color: 'white', fontSize: 30, fontWeight: 800, lineHeight: 1.1, letterSpacing: 1, textTransform: 'uppercase' as const }}>{data.name}</div>
            <div style={{ color: '#80cbc4', fontSize: 12, marginTop: 5, letterSpacing: 1.5, fontWeight: 500, textTransform: 'uppercase' as const }}>{data.role_title || data.title}</div>
            <div style={{ height: 2.5, background: '#4db6ac', marginTop: 8, borderRadius: 2 }} />
          </div>
        </div>
        <div style={{ color: '#b2dfdb', fontSize: 10.5, textAlign: 'right' as const, lineHeight: 2.1, flexShrink: 0 }}>
          {data.email && <div>✉ <a href={`mailto:${data.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{data.email}</a></div>}
          {data.phone && <div>📱 {data.phone}</div>}
          {data.location && <div>📍 {data.location}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', flex: 1 }}>
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
                    {nonEmpty(exp.bullets).map((b: string, j: number) => (
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
