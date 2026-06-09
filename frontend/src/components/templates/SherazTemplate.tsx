import { ensureUrl, cleanText, nonEmpty } from './shared'
import type { TemplateProps } from './shared'

export function SherazTemplate({ data, photo: _photo }: TemplateProps) {
  const skills: string[] = data.skills_list || []
  const experience: any[] = data.experience || []
  const education: any[] = data.education || []
  const expertiseBullets: string[] = data.expertise_bullets || []
  const additionalSkills: string[] = data.additional_skills || []
  const toolsWorkflow: string[] = (data.tools_list || []).slice(0, 6)

  const MP = 'Montserrat, Poppins, Arial, sans-serif'
  const IO = 'Inter, Open Sans, Arial, sans-serif'
  const GOLDEN   = '#df9f28'
  const ACCENT   = '#df9f28'

  const SectionHeader = ({ label }: { label: string }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: MP, fontSize: 16, fontWeight: 700, color: '#1a1a1a', letterSpacing: 2.5, textTransform: 'uppercase' as const }}>{label}</div>
      <div style={{ height: 1, background: '#e0e0e0', marginTop: 6 }} />
    </div>
  )

  return (
    <div style={{ width: 794, minHeight: 1085, fontFamily: IO, background: '#ffffff', boxSizing: 'border-box' as const, position: 'relative' as const, overflow: 'hidden' }}>
      <div style={{ position: 'absolute' as const, top: 4, left: 0, right: 0, fontFamily: MP, fontSize: 120, fontWeight: 700, color: '#fdf2e3', letterSpacing: -3, textAlign: 'center' as const, lineHeight: 1, textTransform: 'lowercase' as const, pointerEvents: 'none' as const, userSelect: 'none' as const, whiteSpace: 'nowrap' as const }}>
        {(data.name || '').toLowerCase()}
      </div>
      <div style={{ padding: '46px 40px 20px 40px', textAlign: 'center' as const, position: 'relative' as const, zIndex: 1 }}>
        <div style={{ fontFamily: MP, fontSize: 48, fontWeight: 700, color: GOLDEN, letterSpacing: 0, lineHeight: 1 }}>{data.name}</div>
        <div style={{ fontFamily: MP, fontSize: 24, fontWeight: 400, color: '#333333', marginTop: 8, letterSpacing: 0.3 }}>{data.role_title || data.title}</div>
      </div>
      <div style={{ height: 1, background: '#e0e0e0', margin: '0 28px', position: 'relative' as const, zIndex: 1 }} />
      <div style={{ display: 'flex', padding: '20px 28px 28px 28px', gap: 26, position: 'relative' as const, zIndex: 1 }}>
        <div style={{ flex: '0 0 31%', minWidth: 0 }}>
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
        <div style={{ flex: 1, minWidth: 0 }}>
          {data.summary && (
            <div style={{ marginBottom: 18 }}>
              <SectionHeader label="Profile" />
              <div style={{ fontFamily: IO, fontSize: 13, fontWeight: 400, color: '#4a4a4a', lineHeight: 1.75 }}>{cleanText(data.summary)}</div>
            </div>
          )}
          {experience.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <SectionHeader label="Experience" />
              {experience.map((exp: any, i: number) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: IO, fontSize: 11, fontWeight: 400, color: '#777777', marginBottom: 3 }}>from {exp.start_date} – {exp.end_date || 'Present'}</div>
                  <div style={{ fontFamily: IO, fontSize: 14, fontWeight: 700, color: '#333333', lineHeight: 1.25 }}>{exp.title}</div>
                  <div style={{ fontFamily: IO, fontSize: 13, fontWeight: 400, color: '#666666', marginBottom: 6, marginTop: 2 }}>{exp.company}</div>
                  {nonEmpty(exp.bullets).map((b: string, j: number) => (
                    <div key={j} style={{ fontFamily: IO, fontSize: 13, fontWeight: 400, color: '#4a4a4a', lineHeight: 1.72, marginBottom: 4 }}>{cleanText(b)}</div>
                  ))}
                </div>
              ))}
            </div>
          )}
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
