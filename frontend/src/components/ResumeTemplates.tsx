import SI_ICONS_MAP, { FALLBACK_BRANDS, ICON_ALIASES } from '@/assets/tool-icons'

// ── Types ──────────────────────────────────────────────────────────────────────

export type SiIcon = { path: string; hex: string; bg?: string; textColor?: string }
export type ToolEntry = { label: string; bg: string; textColor?: string; abbr: string; siIcon?: SiIcon }

// ── Constants ──────────────────────────────────────────────────────────────────

export const PILL_COLORS = ['#1565c0','#00695c','#6a1b9a','#1b5e20','#bf360c','#0277bd','#4a148c','#006064']

export const RESUME_TEMPLATES = [
  { id: 1, name: 'Rida Saeed', description: 'Teal header & sidebar, skill pills, tool icons.' },
  { id: 2, name: 'Mirza Waleed', description: 'White + green accents, photo in header, experience left.' },
  { id: 3, name: 'Arham Saeed', description: 'Dark olive sidebar, key achievements, bold name right.' },
  { id: 4, name: 'Sheraz Khalid', description: 'White + orange, watermark name, expertise bullets.' },
  { id: 5, name: 'Muhammad Waqar', description: 'White + blue initials badge, bordered skills grid, dashed separators.' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

export function ensureUrl(url: string): string {
  if (!url) return url
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export function cleanText(text: string): string {
  if (!text) return text
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^[\-\–\—]\s+/gm, '')
    .replace(/^#+\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
}

export function companyBgColor(name: string): string {
  const colors = ['#1565c0','#00695c','#6a1b9a','#1b5e20','#c62828','#0277bd','#e65100','#37474f']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0x7fffffff
  return colors[hash % colors.length]
}

export function resolveTools(toolNames: string[]): ToolEntry[] {
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
        let abbr: string
        let bg: string
        let textColor: string | undefined

        if (key.startsWith('amazon ') || key === 'amazon') {
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

export function ToolIconBox({ label, bg, textColor, abbr, siIcon, size = 40 }: ToolEntry & { size?: number }) {
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

// ── Template SVGs ──────────────────────────────────────────────────────────────

export function TemplateSvgWaqar() {
  return (
    <svg viewBox="0 0 110 140" className="w-full h-full">
      <rect x="0" y="0" width="110" height="140" fill="#ffffff"/>
      <rect x="5" y="5" width="68" height="6" rx="0.5" fill="#1a1a1a"/>
      <rect x="5" y="14" width="42" height="2.5" rx="0.5" fill="#3B5BD9"/>
      <rect x="5" y="20" width="16" height="1.5" rx="0.3" fill="#9ca3af"/>
      <rect x="23" y="20" width="22" height="1.5" rx="0.3" fill="#9ca3af"/>
      <rect x="48" y="20" width="20" height="1.5" rx="0.3" fill="#9ca3af"/>
      <rect x="89" y="4" width="16" height="16" rx="1" fill="#3B5BD9"/>
      <rect x="92" y="9" width="10" height="5" rx="0.5" fill="rgba(255,255,255,0.9)"/>
      <rect x="5" y="28" width="24" height="2" rx="0.3" fill="#1a1a1a"/>
      <rect x="5" y="31" width="100" height="1.2" fill="#1a1a1a"/>
      <rect x="5" y="34" width="100" height="1.3" rx="0.3" fill="#d1d5db"/>
      <rect x="5" y="37" width="88" height="1.3" rx="0.3" fill="#d1d5db"/>
      <rect x="5" y="40" width="94" height="1.3" rx="0.3" fill="#d1d5db"/>
      <rect x="5" y="47" width="30" height="2" rx="0.3" fill="#1a1a1a"/>
      <rect x="5" y="50" width="100" height="1.2" fill="#1a1a1a"/>
      <rect x="5" y="53" width="38" height="2" rx="0.3" fill="#1a1a1a"/>
      <rect x="5" y="57" width="28" height="1.8" rx="0.3" fill="#3B5BD9"/>
      <rect x="5" y="61" width="44" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="5" y="65" width="97" height="1.3" rx="0.3" fill="#d1d5db"/>
      <rect x="5" y="68" width="87" height="1.3" rx="0.3" fill="#d1d5db"/>
      <line x1="5" y1="73" x2="105" y2="73" stroke="#d1d5db" strokeDasharray="3,2" strokeWidth="0.8"/>
      <rect x="5" y="76" width="38" height="2" rx="0.3" fill="#1a1a1a"/>
      <rect x="5" y="80" width="28" height="1.8" rx="0.3" fill="#3B5BD9"/>
      <rect x="5" y="84" width="44" height="1.3" rx="0.3" fill="#9ca3af"/>
      <rect x="5" y="88" width="97" height="1.3" rx="0.3" fill="#d1d5db"/>
      <rect x="5" y="91" width="87" height="1.3" rx="0.3" fill="#d1d5db"/>
      <rect x="5" y="98" width="18" height="2" rx="0.3" fill="#1a1a1a"/>
      <rect x="5" y="101" width="100" height="1.2" fill="#1a1a1a"/>
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

export function TemplateSvgArham() {
  return (
    <svg viewBox="0 0 110 140" className="w-full h-full">
      <rect x="0" y="0" width="110" height="140" fill="#f8f8f8"/>
      <rect x="0" y="0" width="35" height="140" fill="#1d2b0d"/>
      <circle cx="17.5" cy="18" r="11" fill="rgba(255,255,255,0.08)" stroke="#8c9a38" strokeWidth="1.5"/>
      <rect x="3" y="34" width="16" height="1.8" rx="0.8" fill="#8c9a38"/>
      <rect x="3" y="37" width="29" height="0.5" fill="rgba(140,154,56,0.4)"/>
      <rect x="5" y="40" width="25" height="1.5" rx="0.5" fill="rgba(255,255,255,0.7)"/>
      <rect x="5" y="43" width="20" height="1.5" rx="0.5" fill="rgba(255,255,255,0.45)"/>
      <rect x="5" y="48" width="25" height="1.5" rx="0.5" fill="rgba(255,255,255,0.7)"/>
      <rect x="5" y="51" width="20" height="1.5" rx="0.5" fill="rgba(255,255,255,0.45)"/>
      <rect x="3" y="58" width="16" height="1.8" rx="0.8" fill="#8c9a38"/>
      <rect x="3" y="61" width="29" height="0.5" fill="rgba(140,154,56,0.4)"/>
      <rect x="3" y="64" width="26" height="1.5" rx="0.5" fill="rgba(255,255,255,0.6)"/>
      <rect x="3" y="68" width="22" height="1.5" rx="0.5" fill="rgba(255,255,255,0.6)"/>
      <rect x="3" y="75" width="13" height="1.8" rx="0.8" fill="#8c9a38"/>
      <rect x="3" y="78" width="29" height="0.5" fill="rgba(140,154,56,0.4)"/>
      <rect x="3" y="81" width="7" height="7" rx="1.5" fill="#21759b"/>
      <rect x="12" y="81" width="7" height="7" rx="1.5" fill="#777bb3"/>
      <rect x="21" y="81" width="7" height="7" rx="1.5" fill="#a259ff"/>
      <rect x="3" y="93" width="26" height="1.8" rx="0.8" fill="#8c9a38"/>
      <rect x="3" y="96" width="29" height="0.5" fill="rgba(140,154,56,0.4)"/>
      <rect x="5" y="99" width="26" height="1.5" rx="0.5" fill="rgba(255,255,255,0.6)"/>
      <rect x="5" y="102" width="22" height="1.5" rx="0.5" fill="rgba(255,255,255,0.6)"/>
      <rect x="5" y="105" width="25" height="1.5" rx="0.5" fill="rgba(255,255,255,0.6)"/>
      <rect x="40" y="5" width="66" height="7" rx="1" fill="#111827"/>
      <rect x="40" y="15" width="42" height="2.5" rx="0.8" fill="#9ca3af"/>
      <rect x="40" y="19" width="22" height="2" rx="0.8" fill="#8c9a38"/>
      <rect x="40" y="25" width="65" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="40" y="28" width="58" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="40" y="31" width="62" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="40" y="38" width="24" height="1.8" rx="0.8" fill="#111827"/>
      <rect x="40" y="41" width="22" height="2" rx="0.5" fill="#8c9a38"/>
      <circle cx="44" cy="50" r="3.5" fill="#8c9a38"/>
      <rect x="50" y="47" width="30" height="2" rx="0.5" fill="#111827"/>
      <rect x="50" y="51" width="22" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="50" y="55" width="54" height="1.5" rx="0.5" fill="#d1d5db"/>
      <rect x="50" y="58" width="46" height="1.5" rx="0.5" fill="#d1d5db"/>
      <circle cx="44" cy="68" r="3.5" fill="#8c9a38"/>
      <rect x="50" y="65" width="30" height="2" rx="0.5" fill="#111827"/>
      <rect x="50" y="69" width="22" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="50" y="73" width="54" height="1.5" rx="0.5" fill="#d1d5db"/>
      <rect x="50" y="76" width="46" height="1.5" rx="0.5" fill="#d1d5db"/>
      <rect x="40" y="84" width="24" height="1.8" rx="0.8" fill="#111827"/>
      <rect x="40" y="87" width="22" height="2" rx="0.5" fill="#8c9a38"/>
      <rect x="40" y="92" width="17" height="4" rx="1" fill="#1565c0"/>
      <rect x="59" y="92" width="21" height="4" rx="1" fill="#00695c"/>
      <rect x="82" y="92" width="18" height="4" rx="1" fill="#6a1b9a"/>
      <rect x="40" y="98" width="19" height="4" rx="1" fill="#bf360c"/>
      <rect x="61" y="98" width="15" height="4" rx="1" fill="#0277bd"/>
    </svg>
  )
}

export function TemplateSvgSheraz() {
  return (
    <svg viewBox="0 0 110 140" className="w-full h-full">
      <rect x="0" y="0" width="110" height="140" fill="#fafaf8"/>
      <rect x="8" y="4" width="94" height="14" rx="2" fill="rgba(224,120,32,0.06)"/>
      <rect x="18" y="20" width="74" height="6" rx="1" fill="#E07820"/>
      <rect x="28" y="29" width="54" height="2.5" rx="0.8" fill="#d1d5db"/>
      <rect x="5" y="36" width="100" height="0.8" fill="#e5e7eb"/>
      <rect x="5" y="41" width="18" height="1.8" rx="0.8" fill="#374151"/>
      <rect x="5" y="44" width="38" height="0.5" fill="#d1d5db"/>
      <rect x="5" y="47" width="32" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="5" y="50" width="28" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="5" y="56" width="20" height="1.8" rx="0.8" fill="#374151"/>
      <rect x="5" y="59" width="38" height="0.5" fill="#d1d5db"/>
      <rect x="5" y="62" width="34" height="1.5" rx="0.5" fill="#374151"/>
      <rect x="5" y="65" width="26" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="5" y="70" width="34" height="1.5" rx="0.5" fill="#374151"/>
      <rect x="5" y="73" width="26" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="5" y="79" width="20" height="1.8" rx="0.8" fill="#374151"/>
      <rect x="5" y="82" width="38" height="0.5" fill="#d1d5db"/>
      <rect x="7" y="85" width="32" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="7" y="88" width="28" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="7" y="91" width="30" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="7" y="94" width="25" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="48" y="41" width="18" height="1.8" rx="0.8" fill="#374151"/>
      <rect x="48" y="44" width="58" height="0.5" fill="#d1d5db"/>
      <rect x="48" y="47" width="56" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="48" y="50" width="50" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="48" y="53" width="54" height="1.5" rx="0.5" fill="#9ca3af"/>
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
      <rect x="48" y="101" width="30" height="1.8" rx="0.8" fill="#374151"/>
      <rect x="48" y="104" width="58" height="0.5" fill="#d1d5db"/>
      <rect x="48" y="107" width="56" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="48" y="110" width="46" height="1.5" rx="0.5" fill="#9ca3af"/>
      <rect x="48" y="117" width="14" height="1.8" rx="0.8" fill="#374151"/>
      <rect x="48" y="120" width="58" height="0.5" fill="#d1d5db"/>
      <rect x="48" y="123" width="8" height="8" rx="2" fill="#21759b"/>
      <rect x="58" y="123" width="8" height="8" rx="2" fill="#777bb3"/>
      <rect x="68" y="123" width="8" height="8" rx="2" fill="#f7df1e"/>
    </svg>
  )
}

export function TemplateSvg({ id }: { id: number }) {
  if (id === 3) return <TemplateSvgArham />
  if (id === 4) return <TemplateSvgSheraz />
  if (id === 5) return <TemplateSvgWaqar />
  if (id === 2) return (
    <svg viewBox="0 0 110 140" className="w-full h-full">
      <rect x="0" y="0" width="110" height="140" fill="#f8f8f8"/>
      <rect x="0" y="0" width="110" height="30" fill="#ffffff"/>
      <circle cx="13" cy="15" r="9" fill="#e5e7eb"/>
      <rect x="27" y="6" width="46" height="5" rx="1" fill="#111827"/>
      <rect x="27" y="14" width="32" height="2.5" rx="0.8" fill="#374151"/>
      <rect x="27" y="19" width="20" height="1.5" rx="0.8" fill="#7DC242"/>
      <rect x="3" y="26" width="13" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="19" y="26" width="15" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="37" y="26" width="18" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="0" y="30" width="110" height="3" fill="#7DC242"/>
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
      <rect x="3" y="80" width="18" height="1.8" rx="0.8" fill="#111827"/>
      <rect x="3" y="83" width="60" height="0.7" fill="#d1d5db"/>
      <rect x="3" y="87" width="28" height="1.8" rx="0.5" fill="#111827"/>
      <rect x="3" y="91" width="22" height="1.5" rx="0.5" fill="#374151"/>
      <rect x="67" y="33" width="1" height="104" fill="#e5e7eb"/>
      <rect x="71" y="37" width="20" height="1.8" rx="0.8" fill="#111827"/>
      <rect x="71" y="40" width="36" height="0.7" fill="#d1d5db"/>
      <rect x="71" y="43" width="36" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="71" y="46" width="32" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="71" y="49" width="35" height="1.5" rx="0.5" fill="#6b7280"/>
      <rect x="71" y="56" width="14" height="1.8" rx="0.8" fill="#111827"/>
      <rect x="71" y="59" width="36" height="0.7" fill="#d1d5db"/>
      <rect x="71" y="62" width="13" height="3.5" rx="1.5" fill="#1565c0"/>
      <rect x="86" y="62" width="16" height="3.5" rx="1.5" fill="#00695c"/>
      <rect x="71" y="67" width="17" height="3.5" rx="1.5" fill="#6a1b9a"/>
      <rect x="90" y="67" width="13" height="3.5" rx="1.5" fill="#bf360c"/>
      <rect x="71" y="75" width="13" height="1.8" rx="0.8" fill="#111827"/>
      <rect x="71" y="78" width="36" height="0.7" fill="#d1d5db"/>
      <rect x="71" y="81" width="8" height="8" rx="2" fill="#21759b"/>
      <rect x="81" y="81" width="8" height="8" rx="2" fill="#777bb3"/>
      <rect x="91" y="81" width="8" height="8" rx="2" fill="#a259ff"/>
      <rect x="101" y="81" width="7" height="8" rx="2" fill="#f7df1e"/>
    </svg>
  )
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
    </svg>
  )
}

export function TemplateCard({ template, isSelected, onClick }: { template: typeof RESUME_TEMPLATES[0]; isSelected: boolean; onClick: () => void }) {
  return (
    <div
      className={`relative group cursor-pointer rounded-xl border-2 p-2.5 transition-all flex-shrink-0 ${
        isSelected ? 'border-[#7DC242] bg-[#7DC242]/10' : 'border-white/10 bg-white/5 hover:border-white/25'
      }`}
      style={{ width: 118 }}
      onClick={onClick}
    >
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

// ── Templates ──────────────────────────────────────────────────────────────────

export function WaleedTemplate({ data, photo }: { data: Record<string, any>; photo?: string }) {
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

export function RidaTemplate({ data, photo }: { data: Record<string, any>; photo?: string }) {
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

export function ArhamTemplate({ data, photo }: { data: Record<string, any>; photo?: string }) {
  const tools = resolveTools(data.tools_list || []).slice(0, 7)
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

export function SherazTemplate({ data, photo: _photo }: { data: Record<string, any>; photo?: string }) {
  const skills: string[] = data.skills_list || []
  const experience: any[] = data.experience || []
  const education: any[] = data.education || []
  const expertiseBullets: string[] = data.expertise_bullets || []
  const additionalSkills: string[] = data.additional_skills || []
  const toolsWorkflow: string[] = data.tools_list || []

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
                  {(exp.bullets || []).map((b: string, j: number) => (
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

export function WaqarTemplate({ data, photo }: { data: Record<string, any>; photo?: string }) {
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

  const SH = ({ label }: { label: string }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: FM, fontSize: 19, fontWeight: 700, color: DARK, letterSpacing: 0.4, textTransform: 'uppercase' as const, paddingBottom: 4, borderBottom: `2px solid ${DARK}` }}>{label}</div>
    </div>
  )

  return (
    <div style={{ width: 795, minHeight: 1124, fontFamily: FO, background: '#ffffff', boxSizing: 'border-box' as const, padding: '45px 53px 32px 53px' }}>
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
                {(exp.bullets || []).map((b: string, j: number) => (
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
