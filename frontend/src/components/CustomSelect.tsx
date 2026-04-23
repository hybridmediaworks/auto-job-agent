import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption {
  value: string
  label: string
  /** 2-letter country/abbr badge shown before the label */
  badge?: string
}

interface CustomSelectProps {
  value: string | number
  onChange: (value: string) => void
  options: SelectOption[]
  /** Applied to the outer wrapper div — use for layout (w-full, max-w-xs, etc.) */
  className?: string
  /**
   * When provided, the trigger button gets this class instead of the default
   * input-style button. Use for coloured status triggers.
   */
  triggerClassName?: string
  placeholder?: string
}

/**
 * Cross-platform custom dropdown that renders entirely via CSS/React —
 * no native OS `<select>` popup, so it looks consistent on Windows and macOS.
 * The dropdown panel is rendered into document.body via a React portal so it
 * is never clipped by `overflow: hidden` containers (e.g. rounded table cards).
 */
export function CustomSelect({
  value,
  onChange,
  options,
  className = '',
  triggerClassName,
  placeholder,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)

  const selected = options.find(o => String(o.value) === String(value))

  const openDropdown = useCallback(() => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      // Flip upward only if there's genuinely not enough space below for the
      // actual content. Estimate height from option count so we don't flip
      // prematurely for short lists (e.g. 3-option profile picker).
      const spaceBelow = window.innerHeight - r.bottom
      const panelMaxH = 240
      const estimatedH = Math.min(options.length * 38 + 8, panelMaxH)
      const top =
        spaceBelow >= estimatedH || spaceBelow >= r.top
          ? r.bottom + 4
          : r.top - Math.min(r.top - 4, estimatedH)

      setPanelStyle({
        position: 'fixed',
        top,
        left: r.left,
        width: Math.max(r.width, 160),
      })
    }
    setOpen(true)
  }, [options])

  const chevron = (
    <svg
      style={{
        width: triggerClassName ? 12 : 16,
        height: triggerClassName ? 12 : 16,
        flexShrink: 0,
        opacity: 0.55,
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform 0.15s',
      }}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )

  const badgeStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: '4px',
    background: 'var(--bg-surface-hover)',
    color: 'var(--text-muted)',
    flexShrink: 0,
    minWidth: '26px',
    textAlign: 'center',
  }

  const portal = open &&
    createPortal(
      <>
        {/* Transparent backdrop — captures outside-clicks to close */}
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          onClick={() => setOpen(false)}
        />
        {/* Dropdown panel */}
        <div
          style={{
            ...panelStyle,
            zIndex: 9999,
            background: 'var(--bg-modal)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            maxHeight: '240px',
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {options.map(opt => {
            const isSel = String(opt.value) === String(value)
            const isHov = hovered === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onMouseEnter={() => setHovered(opt.value)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '13px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: 'none',
                  color: isSel ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: isSel || isHov ? 'var(--bg-surface-hover)' : 'transparent',
                }}
              >
                {opt.badge && <span style={badgeStyle}>{opt.badge}</span>}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opt.label}
                </span>
                {isSel && (
                  <span style={{ marginLeft: 'auto', flexShrink: 0, color: '#7DC242', fontSize: '11px' }}>
                    ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </>,
      document.body,
    )

  // ── Coloured status trigger (no input styling) ────────────────────────────
  if (triggerClassName) {
    return (
      <div className={`relative ${className}`}>
        <button
          ref={triggerRef}
          type="button"
          onClick={open ? () => setOpen(false) : openDropdown}
          className={`flex items-center gap-1.5 ${triggerClassName}`}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected?.label ?? placeholder ?? '—'}
          </span>
          {chevron}
        </button>
        {portal}
      </div>
    )
  }

  // ── Standard input-style trigger ─────────────────────────────────────────
  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={open ? () => setOpen(false) : openDropdown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%',
          padding: '8px 12px',
          borderRadius: '12px',
          fontSize: '14px',
          textAlign: 'left',
          cursor: 'pointer',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-input)',
          transition: 'border-color 0.15s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          {selected?.badge && <span style={badgeStyle}>{selected.badge}</span>}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-input)' }}>
            {selected?.label ?? placeholder ?? 'Select…'}
          </span>
        </span>
        {chevron}
      </button>
      {portal}
    </div>
  )
}
