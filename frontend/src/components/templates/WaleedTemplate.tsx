import { ensureUrl, cleanText, companyBgColor, resolveTools, ToolIconBox, PILL_COLORS } from './shared'
import type { TemplateProps } from './shared'

export function WaleedTemplate({ data, photo }: TemplateProps) {
  const tools = resolveTools(data.tools_list || []).slice(0, 7)
  const skills: string[] = data.skills_list || []
  const experience: any[] = data.experience || []
  const education: any[] = data.education || []
  const effectivePhoto = photo || data.photo

  const SectionHeader = ({ label }: { label: string }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', letterSpacing: 2.5, textTransform: 'uppercase' as const }}>{label}</div>
      <div style={{ height: 1.5, background: '#d1d5db', marginTop: 5 }} />
    </div>
  )

  return (
    <div style={{ width: 794, minHeight: 1085, fontFamily: 'Arial, Helvetica, sans-serif', background: '#ffffff', boxSizing: 'border-box' as const }}>
      <div style={{ padding: '26px 32px 18px 32px', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {effectivePhoto ? (
            <img src={effectivePhoto} crossOrigin="anonymous" style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover' as const, flexShrink: 0 }} alt="Profile" />
          ) : (
            <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#f1f5f9', display: 'inline-block', textAlign: 'center', lineHeight: '90px', fontSize: 34, fontWeight: 800, color: '#7DC242', flexShrink: 0, verticalAlign: 'top' }}>
              {(data.name || '?')[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#111827', letterSpacing: 0.5, lineHeight: 1.1, textTransform: 'uppercase' as const }}>{data.name}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginTop: 5, letterSpacing: 1.8, textTransform: 'uppercase' as const }}>{data.role_title || data.title}</div>
            <div style={{ height: 3, background: '#7DC242', marginTop: 9, borderRadius: 2 }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '4px 22px', marginTop: 14, fontSize: 10.5, color: '#4b5563' }}>
          {data.location && <span>📍 {data.location}</span>}
          {data.phone && <span>📞 {data.phone}</span>}
          {data.email && <span>✉ <a href={`mailto:${data.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{data.email}</a></span>}
          {data.linkedin && <span>🔗 <a href={ensureUrl(data.linkedin)} style={{ color: 'inherit', textDecoration: 'none' }}>{data.linkedin}</a></span>}
          {data.github && <span>💻 <a href={ensureUrl(data.github)} style={{ color: 'inherit', textDecoration: 'none' }}>{data.github}</a></span>}
          {data.portfolio && <span>🌐 <a href={ensureUrl(data.portfolio)} style={{ color: 'inherit', textDecoration: 'none' }}>{data.portfolio}</a></span>}
        </div>
      </div>
      <div style={{ height: 5, background: '#7DC242' }} />
      <div style={{ display: 'flex', padding: '22px 32px 32px 32px', gap: 0 }}>
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
