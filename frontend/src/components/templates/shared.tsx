import SI_ICONS_MAP, { FALLBACK_BRANDS, ICON_ALIASES } from '@/assets/tool-icons'

// ── Types ──────────────────────────────────────────────────────────────────────

export type SiIcon = { path: string; hex: string; bg?: string; textColor?: string }
export type ToolEntry = { label: string; bg: string; textColor?: string; abbr: string; siIcon?: SiIcon }
export type TemplateProps = { data: Record<string, any>; photo?: string }

// ── Constants ──────────────────────────────────────────────────────────────────

export const PILL_COLORS = ['#1565c0','#00695c','#6a1b9a','#1b5e20','#bf360c','#0277bd','#4a148c','#006064']

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

/**
 * Render a portfolio image grid that looks balanced regardless of count.
 *
 *   1 image  → full-width, 16:9
 *   2 images → 2 cols, 4:3 each
 *   3 images → first image spans full width (16:9), 2 below in 2 cols (4:3)
 *   4 images → 2×2 grid, 4:3 each
 *
 * Anything beyond 4 is truncated. Uses CSS aspect-ratio so the section's
 * total height adapts to the column width and never overflows into the
 * next section.
 */
export function PortfolioGrid({ images, gap = 5, borderRadius = 4 }: { images: string[]; gap?: number; borderRadius?: number }) {
  const imgs = images.slice(0, 4)
  const count = imgs.length
  if (count === 0) return null

  const isSingle = count === 1
  const cols = isSingle ? 1 : 2

  // Per-cell aspect ratio (each image's width:height after objectFit cover)
  const cellAspect = isSingle ? '16 / 9' : '4 / 3'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
      {imgs.map((img, i) => {
        // When count === 3, make the first image span both columns to keep the row balanced
        const span2 = count === 3 && i === 0
        return (
          <div
            key={i}
            style={{
              gridColumn: span2 ? 'span 2' : 'span 1',
              width: '100%',
              aspectRatio: span2 ? '16 / 9' : cellAspect,
              overflow: 'hidden',
              borderRadius,
              background: '#f1f5f9',
            }}
          >
            <img
              src={img}
              crossOrigin="anonymous"
              alt="Project"
              style={{ width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' }}
            />
          </div>
        )
      })}
    </div>
  )
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
