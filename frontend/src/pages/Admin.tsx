/**
 * Admin Panel — User Management
 *
 * Inline pill-toggle permissions — no dropdown, no z-index issues.
 * Each row: avatar + name/email | permission pills | admin toggle | active toggle | save
 */

import { useState, useEffect } from 'react'
import { adminApi } from '@/services/api'
import type { User } from '@/types'
import type { AdminUserUpdate } from '@/services/api'

// ── Permission definitions ────────────────────────────────────────────────────

const PERMS = [
  { key: 'can_fetch_jobs',        label: 'Job Fetch' },
  { key: 'can_run_saved_search',  label: 'Saved Searches' },
  { key: 'can_create_resume',     label: 'Resume' },
] as const

type PermKey = (typeof PERMS)[number]['key']

// ── Row state ─────────────────────────────────────────────────────────────────

interface RowState {
  is_admin: boolean
  can_fetch_jobs: boolean
  can_run_saved_search: boolean
  can_create_resume: boolean
  is_active: boolean
  saving: boolean
  saved: boolean
  error: string | null
  dirty: boolean
}

function toRow(u: User): RowState {
  return {
    is_admin: u.is_admin,
    can_fetch_jobs: u.can_fetch_jobs,
    can_run_saved_search: u.can_run_saved_search,
    can_create_resume: u.can_create_resume,
    is_active: u.is_active,
    saving: false,
    saved: false,
    error: null,
    dirty: false,
  }
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
      style={{
        background: value ? '#7DC242' : 'rgba(255,255,255,0.12)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: value ? 'translateX(16px)' : 'translateX(0px)' }}
      />
    </button>
  )
}

// ── Permission pill ───────────────────────────────────────────────────────────

function PermPill({ label, active, onClick, disabled }: {
  label: string
  active: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 select-none"
      style={{
        background: active ? 'rgba(125,194,66,0.18)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${active ? 'rgba(125,194,66,0.45)' : 'rgba(255,255,255,0.1)'}`,
        color: active ? '#7DC242' : 'rgba(255,255,255,0.35)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: active ? '#7DC242' : 'rgba(255,255,255,0.25)' }}
      />
      {label}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Admin() {
  const [users, setUsers] = useState<User[]>([])
  const [rows, setRows] = useState<Record<number, RowState>>({})
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    adminApi.listUsers()
      .then(data => {
        setUsers(data)
        const init: Record<number, RowState> = {}
        data.forEach(u => { init[u.id] = toRow(u) })
        setRows(init)
      })
      .catch(() => setFetchError('Failed to load users. Make sure you are an admin.'))
      .finally(() => setLoading(false))
  }, [])

  function patch(userId: number, update: Partial<RowState>) {
    setRows(prev => ({ ...prev, [userId]: { ...prev[userId], ...update, dirty: true, saved: false, error: null } }))
  }

  function togglePerm(userId: number, key: PermKey) {
    const row = rows[userId]
    patch(userId, { [key]: !row[key] })
  }

  async function save(userId: number) {
    const row = rows[userId]
    setRows(prev => ({ ...prev, [userId]: { ...prev[userId], saving: true, error: null } }))

    const payload: AdminUserUpdate = {
      is_admin: row.is_admin,
      can_fetch_jobs: row.can_fetch_jobs,
      can_run_saved_search: row.can_run_saved_search,
      can_create_resume: row.can_create_resume,
      is_active: row.is_active,
    }

    try {
      const updated = await adminApi.updateUser(userId, payload)
      setUsers(prev => prev.map(u => u.id === userId ? updated : u))
      setRows(prev => ({ ...prev, [userId]: { ...prev[userId], saving: false, saved: true, dirty: false } }))
      setTimeout(() => setRows(prev => ({ ...prev, [userId]: { ...prev[userId], saved: false } })), 2500)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to save changes'
      setRows(prev => ({ ...prev, [userId]: { ...prev[userId], saving: false, error: msg } }))
    }
  }

  // ── Loading / error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3">
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(125,194,66,0.2)', borderTopColor: '#7DC242' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading users…</p>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-2">
        <p className="text-sm" style={{ color: '#ef4444' }}>{fetchError}</p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          User Management
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Click permission pills to toggle access. Changes take effect after saving.
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{users.length}</span>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>total users</span>
        </div>
        <div className="h-4 w-px" style={{ background: 'var(--border-default)' }} />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold" style={{ color: '#7DC242' }}>
            {users.filter(u => u.is_active).length}
          </span>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>active</span>
        </div>
        <div className="h-4 w-px" style={{ background: 'var(--border-default)' }} />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {users.filter(u => u.is_admin).length}
          </span>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>admins</span>
        </div>
      </div>

      {/* Table — scrollable */}
      <div
        className="rounded-2xl border overflow-hidden flex flex-col"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
      >
        {/* Sticky header */}
        <div
          className="grid text-xs font-semibold uppercase tracking-wider px-5 py-3 border-b sticky top-0 z-10"
          style={{
            gridTemplateColumns: '220px 1fr 80px 80px 80px',
            gap: '16px',
            borderColor: 'var(--border-default)',
            background: 'var(--bg-main)',
            color: 'var(--text-muted)',
          }}
        >
          <span>User</span>
          <span>Permissions</span>
          <span className="text-center">Admin</span>
          <span className="text-center">Active</span>
          <span />
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          {users.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No users found.</p>
            </div>
          ) : (
            users.map((user, idx) => {
              const row = rows[user.id]
              if (!row) return null
              const isLast = idx === users.length - 1

              return (
                <div
                  key={user.id}
                  className="grid items-center px-5 py-3.5 transition-colors hover:bg-white/[0.02]"
                  style={{
                    gridTemplateColumns: '220px 1fr 80px 80px 80px',
                    gap: '16px',
                    borderBottom: isLast ? 'none' : '1px solid var(--border-default)',
                  }}
                >
                  {/* User info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
                      style={{
                        background: row.is_admin
                          ? 'linear-gradient(135deg, #7DC242 0%, #4CAF50 100%)'
                          : 'rgba(255,255,255,0.1)',
                        color: '#fff',
                      }}
                    >
                      {user.username[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {user.username}
                        </p>
                        {row.is_admin && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                            style={{ background: 'rgba(125,194,66,0.15)', color: '#7DC242' }}
                          >
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-faint)' }}>
                        {user.email}
                      </p>
                    </div>
                  </div>

                  {/* Permission pills */}
                  <div className="flex items-center flex-wrap gap-2">
                    {PERMS.map(p => (
                      <PermPill
                        key={p.key}
                        label={p.label}
                        active={row[p.key]}
                        onClick={() => togglePerm(user.id, p.key)}
                        disabled={row.saving}
                      />
                    ))}
                    {/* Quick presets */}
                    {(() => {
                      const allOn = row.can_fetch_jobs && row.can_run_saved_search && row.can_create_resume
                      const allOff = !row.can_fetch_jobs && !row.can_run_saved_search && !row.can_create_resume
                      return (
                        <>
                          <div className="h-4 w-px mx-0.5" style={{ background: 'var(--border-default)' }} />
                          <button
                            type="button"
                            onClick={() => setRows(prev => ({
                              ...prev,
                              [user.id]: { ...prev[user.id], can_fetch_jobs: true, can_run_saved_search: true, can_create_resume: true, dirty: true, saved: false, error: null },
                            }))}
                            disabled={row.saving}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors"
                            style={{
                              color: allOn ? '#7DC242' : 'rgba(255,255,255,0.3)',
                              background: allOn ? 'rgba(125,194,66,0.18)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${allOn ? 'rgba(125,194,66,0.45)' : 'rgba(255,255,255,0.08)'}`,
                            }}
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={() => setRows(prev => ({
                              ...prev,
                              [user.id]: { ...prev[user.id], can_fetch_jobs: false, can_run_saved_search: false, can_create_resume: false, dirty: true, saved: false, error: null },
                            }))}
                            disabled={row.saving}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors"
                            style={{
                              color: allOff ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)',
                              background: allOff ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${allOff ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                            }}
                          >
                            None
                          </button>
                        </>
                      )
                    })()}
                  </div>

                  {/* Admin toggle */}
                  <div className="flex items-center justify-center">
                    <Toggle
                      value={row.is_admin}
                      onChange={v => patch(user.id, { is_admin: v })}
                      disabled={row.saving}
                    />
                  </div>

                  {/* Active toggle */}
                  <div className="flex items-center justify-center">
                    <Toggle
                      value={row.is_active}
                      onChange={v => patch(user.id, { is_active: v })}
                      disabled={row.saving}
                    />
                  </div>

                  {/* Save */}
                  <div className="flex flex-col items-end gap-1">
                    {row.error && (
                      <p className="text-[10px] text-right leading-tight" style={{ color: '#ef4444', maxWidth: '80px' }}>
                        {row.error}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => save(user.id)}
                      disabled={row.saving || (!row.dirty && !row.error)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
                      style={{
                        background: row.saved
                          ? 'rgba(125,194,66,0.15)'
                          : row.dirty
                          ? 'linear-gradient(135deg, #7DC242 0%, #4CAF50 100%)'
                          : 'rgba(255,255,255,0.06)',
                        color: row.saved ? '#7DC242' : row.dirty ? '#fff' : 'rgba(255,255,255,0.25)',
                        cursor: (row.saving || (!row.dirty && !row.error)) ? 'not-allowed' : 'pointer',
                        opacity: row.saving ? 0.6 : 1,
                        border: row.dirty ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {row.saving ? 'Saving…' : row.saved ? '✓ Saved' : 'Save'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pb-2">
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          <span style={{ color: '#7DC242' }}>●</span> Active permission &nbsp;
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>●</span> No access &nbsp;·&nbsp;
          Changes are highlighted — click <strong style={{ color: 'var(--text-muted)' }}>Save</strong> to apply
        </p>
      </div>
    </div>
  )
}
