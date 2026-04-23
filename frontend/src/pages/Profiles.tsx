import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profilesApi } from '@/services/api'
import type { Profile } from '@/types'
import { useAuth } from '@/contexts/AuthContext'

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7DC242', borderTopColor: 'transparent' }} />
    </div>
  )
}

function ProfileCard({ profile, onSetDefault, onDelete }: {
  profile: Profile
  onSetDefault: (id: number) => void
  onDelete: (id: number) => void
}) {
  const navigate = useNavigate()
  const resumeData = profile.resume_data

  return (
    <div className={`card relative ${profile.is_default ? 'ring-2' : ''}`} style={profile.is_default ? { boxShadow: '0 0 0 2px rgba(125,194,66,0.5)' } : undefined}>
      {profile.is_default && (
        <span className="absolute top-4 right-4 text-xs text-white px-2 py-0.5 rounded-full font-medium" style={{ background: 'linear-gradient(135deg, #7DC242, #4CAF50)' }}>
          Default
        </span>
      )}

      <div className="space-y-3">
        <div>
          <h3 className="font-semibold text-white text-lg">{profile.name}</h3>
          {resumeData?.title && (
            <p className="text-sm text-gray-400 mt-0.5">{resumeData.title}</p>
          )}
        </div>

        {/* Resume summary */}
        <div className="text-sm text-gray-300 space-y-1">
          {resumeData?.name && (
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{resumeData.name}</span>
            </div>
          )}
          {resumeData?.email && (
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>{resumeData.email}</span>
            </div>
          )}
          {resumeData?.experience && resumeData.experience.length > 0 && (
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>{resumeData.experience.length} experience {resumeData.experience.length === 1 ? 'entry' : 'entries'}</span>
            </div>
          )}
          {!resumeData && (
            <p className="text-amber-600 text-xs italic">No resume data — click Edit to fill in</p>
          )}
        </div>

        {/* Skills preview */}
        {resumeData?.skills && Object.values(resumeData.skills).flat().length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Object.values(resumeData.skills).flat().slice(0, 8).map((skill) => (
              <span key={skill} className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">{skill}</span>
            ))}
            {Object.values(resumeData.skills).flat().length > 8 && (
              <span className="text-xs text-gray-400">+{Object.values(resumeData.skills).flat().length - 8} more</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-white/5">
          <button
            onClick={() => navigate(`/profiles/${profile.id}/edit`)}
            className="btn-primary text-sm flex-1"
          >
            Edit
          </button>
          {!profile.is_default && (
            <button
              onClick={() => onSetDefault(profile.id)}
              className="btn-secondary text-sm"
              title="Set as default profile"
            >
              Set Default
            </button>
          )}
          <button
            onClick={() => onDelete(profile.id)}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Delete profile"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Profiles() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canCreate = user?.is_admin || user?.can_create_resume
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)

  const { data: profiles, isLoading, isError } = useQuery({
    queryKey: ['profiles'],
    queryFn: profilesApi.list,
  })

  const createMutation = useMutation({
    mutationFn: () => profilesApi.create({ name: newName.trim(), is_default: !profiles?.length }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      setNewName('')
      setShowNew(false)
      navigate(`/profiles/${created.id}/edit`)
    },
  })

  const setDefaultMutation = useMutation({
    mutationFn: profilesApi.setDefault,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: profilesApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })

  const handleDelete = (id: number) => {
    if (window.confirm('Delete this profile? This cannot be undone.')) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) return <Spinner />

  if (isError) return (
    <div className="text-center py-16 text-red-600">Failed to load profiles.</div>
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Profiles</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage resume profiles for different job types. The default profile is used for AI tailoring.
          </p>
        </div>
        {canCreate ? (
          <button onClick={() => setShowNew(true)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Profile
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            No Access
          </div>
        )}
      </div>

      {/* New profile form */}
      {showNew && (
        <div className="card border-2 border-dashed" style={{ borderColor: 'rgba(125,194,66,0.3)', background: 'rgba(125,194,66,0.05)' }}>
          <h3 className="font-medium text-white mb-3">New Profile</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder='Profile name (e.g. "WordPress Dev", "Shopify Specialist")'
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-input)' }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) createMutation.mutate()
                if (e.key === 'Escape') { setShowNew(false); setNewName('') }
              }}
            />
            <button
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating…' : 'Create & Edit'}
            </button>
            <button onClick={() => { setShowNew(false); setNewName('') }} className="btn-secondary text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Profile grid */}
      {profiles && profiles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {profiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              onSetDefault={(id) => setDefaultMutation.mutate(id)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <p>No profiles yet. Click "New Profile" to create one.</p>
        </div>
      )}
    </div>
  )
}
