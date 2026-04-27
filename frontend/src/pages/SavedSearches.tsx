import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { savedSearchesApi, providersApi } from '@/services/api';
import type { SavedSearch, SavedSearchCreate } from '@/types';
import { CustomSelect } from '@/components/CustomSelect';
import { useTheme } from '@/contexts/ThemeContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const LOCALITY_OPTIONS = [
  { code: 'us', label: 'United States' },
  { code: 'ca', label: 'Canada' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'au', label: 'Australia' },
  { code: 'pk', label: 'Pakistan' },
  { code: 'in', label: 'India' },
  { code: 'de', label: 'Germany' },
  { code: 'fr', label: 'France' },
  { code: 'ae', label: 'UAE' },
  { code: 'sg', label: 'Singapore' },
  { code: 'nz', label: 'New Zealand' },
  { code: 'nl', label: 'Netherlands' },
  { code: 'ie', label: 'Ireland' },
];

const INTERVAL_OPTIONS = [
  { value: 1,   label: 'Every hour',     short: '1 h',   desc: 'Best for fast-moving roles' },
  { value: 6,   label: 'Every 6 hours',  short: '6 h',   desc: 'Good for daily monitoring' },
  { value: 12,  label: 'Every 12 hours', short: '12 h',  desc: 'Twice a day' },
  { value: 24,  label: 'Every 24 hours', short: '24 h',  desc: 'Recommended for most searches' },
  { value: 48,  label: 'Every 2 days',   short: '2 d',   desc: 'Low frequency' },
  { value: 168, label: 'Every week',     short: '1 wk',  desc: 'Passive monitoring' },
];

function formatLastRun(lastRunAt: string | null): string {
  if (!lastRunAt) return 'Never';
  const d = new Date(lastRunAt + 'Z');
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function nextRunIn(intervalHours: number, lastRunAt: string | null): string {
  if (!lastRunAt) return 'Immediately on save';
  const d = new Date(lastRunAt + 'Z');
  const next = new Date(d.getTime() + intervalHours * 3600_000);
  const now = new Date();
  const diffMs = next.getTime() - now.getTime();
  if (diffMs <= 0) return 'Due now';
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `in ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `in ${diffH}h`;
  return `in ${Math.floor(diffH / 24)}d`;
}

function intervalLabel(hours: number): string {
  return INTERVAL_OPTIONS.find(o => o.value === hours)?.label ?? `Every ${hours}h`;
}

// ── Step indicator ─────────────────────────────────────────────────────────────

function WizardSteps({ current, total }: { current: number; total: number }) {
  const steps = ['Search', 'Providers', 'Schedule', 'Review'];
  return (
    <div className="flex items-center gap-1 px-6 py-3" style={{ borderBottom: '1px solid var(--border-muted)' }}>
      {steps.slice(0, total).map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center gap-1 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              active ? 'text-white shadow-lg shadow-green-500/30' : done ? 'text-white' : ''
            }`} style={{
              background: active
                ? 'linear-gradient(135deg, #7DC242, #4CAF50)'
                : done ? '#4CAF50' : 'var(--bg-input)',
              color: !active && !done ? 'var(--text-faint)' : '#fff',
              border: !active && !done ? '1px solid var(--border-default)' : 'none',
            }}>
              {done ? '✓' : step}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${active ? '' : ''}`} style={{ color: active ? '#7DC242' : done ? 'var(--text-secondary)' : 'var(--text-faint)' }}>
              {label}
            </span>
            {i < total - 1 && (
              <div className="flex-1 h-px mx-2" style={{ background: done ? '#4CAF50' : 'var(--border-default)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Wizard Modal ───────────────────────────────────────────────────────────────

interface WizardModalProps {
  initial?: SavedSearch;
  providers: string[];
  onSave: (data: SavedSearchCreate) => void;
  onClose: () => void;
  saving: boolean;
}

function WizardModal({ initial, providers, onSave, onClose, saving }: WizardModalProps) {
  const isEdit = !!initial;
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // Form state
  const [name, setName] = useState(initial?.name ?? '');
  const [query, setQuery] = useState(initial?.query ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [locality, setLocality] = useState(initial?.locality ?? 'us');
  const [selectedProviders, setSelectedProviders] = useState<string[]>(initial?.providers ?? providers);
  const [remoteOnly, setRemoteOnly] = useState(initial?.remote_only ?? false);
  const [limit, setLimit] = useState(initial?.limit ?? 10);
  const [maxAgeDays, setMaxAgeDays] = useState<number | null>(initial?.max_age_days ?? null);
  const [intervalHours, setIntervalHours] = useState(initial?.interval_hours ?? 24);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  function toggleProvider(p: string) {
    setSelectedProviders(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  }

  function canGoNext(): boolean {
    switch (step) {
      case 1: return name.trim().length > 0 && query.trim().length > 0;
      case 2: return selectedProviders.length > 0;
      case 3: return true;
      default: return true;
    }
  }

  function handleSave() {
    onSave({
      name: name.trim(),
      query: query.trim(),
      location: location.trim(),
      locality,
      providers: selectedProviders,
      remote_only: remoteOnly,
      limit,
      max_age_days: maxAgeDays,
      interval_hours: intervalHours,
      is_active: isActive,
    });
  }

  const PROVIDER_META: Record<string, { emoji: string; color: string }> = {
    indeed:       { emoji: '🔵', color: '#6366f1' },
    glassdoor:    { emoji: '🟢', color: '#22c55e' },
    ziprecruiter: { emoji: '🟣', color: '#a855f7' },
    linkedin:     { emoji: '🔷', color: '#0ea5e9' },
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-2xl shadow-2xl w-full max-w-lg border overflow-hidden" style={{ background: 'var(--bg-modal)', borderColor: 'var(--border-brand-md)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-muted)' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isEdit ? '✏️ Edit Search' : '🚀 New Scheduled Search'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
              {isEdit ? 'Update your automated search' : 'Set up an automated job search in 4 easy steps'}
            </p>
          </div>
          <button onClick={onClose} className="text-xl font-bold rounded-lg w-8 h-8 flex items-center justify-center transition-colors" style={{ color: 'var(--text-faint)' }}>×</button>
        </div>

        {/* Steps indicator */}
        <WizardSteps current={step} total={totalSteps} />

        {/* Step content */}
        <div className="px-6 py-5 min-h-[260px]">
          {/* ── Step 1: What are you looking for? ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  📝 What are you looking for?
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Search Name <span style={{ color: '#f87171' }}>*</span></label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder='e.g. "WordPress Dev – Remote"'
                  className="input"
                  autoFocus
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>A label to identify this search</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Keywords / Job Title</label>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Python Developer, AI, ML Engineer"
                  className="input"
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Comma-separated keywords to search for</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>City / Region</label>
                  <input
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="Remote"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Country</label>
                  <CustomSelect
                    value={locality}
                    onChange={setLocality}
                    options={LOCALITY_OPTIONS.map(o => ({ value: o.code, label: o.label, badge: o.code.toUpperCase() }))}
                    className="w-full"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input type="checkbox" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)} className="w-4 h-4 rounded accent-green-500" />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Remote jobs only</span>
              </label>
            </div>
          )}

          {/* ── Step 2: Choose providers ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  🌐 Where should we search?
                </p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-faint)' }}>Select one or more job boards to scan</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {providers.map(p => {
                  const meta = PROVIDER_META[p] ?? { emoji: '🔘', color: '#6b7280' };
                  const isSelected = selectedProviders.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggleProvider(p)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${isSelected ? 'ring-1' : ''}`}
                      style={{
                        background: isSelected ? `${meta.color}15` : 'var(--bg-surface)',
                        borderColor: isSelected ? `${meta.color}50` : 'var(--border-default)',
                      }}
                    >
                      <span className="text-xl">{meta.emoji}</span>
                      <div>
                        <p className="text-sm font-medium capitalize" style={{ color: isSelected ? meta.color : 'var(--text-primary)' }}>{p}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                          {isSelected ? '✓ Selected' : 'Click to add'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Results per run</label>
                  <CustomSelect
                    value={String(limit)}
                    onChange={v => setLimit(Number(v))}
                    options={[5, 10, 20, 30, 50].map(n => ({ value: String(n), label: `${n} jobs` }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Posted within</label>
                  <CustomSelect
                    value={maxAgeDays === null ? '' : String(maxAgeDays)}
                    onChange={v => setMaxAgeDays(v === '' ? null : Number(v))}
                    options={[
                      { value: '', label: 'Any time' },
                      { value: '1', label: 'Today (1 day)' },
                      { value: '2', label: 'Past 2 days' },
                      { value: '3', label: 'Past 3 days' },
                      { value: '4', label: 'Past 4 days' },
                      { value: '5', label: 'Past 5 days' },
                      { value: '6', label: 'Past 6 days' },
                      { value: '7', label: 'Past 1 week' },
                      { value: '10', label: 'Past 10 days' },
                      { value: '14', label: 'Past 2 weeks' },
                    ]}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Schedule ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  ⏰ How often should it run?
                </p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-faint)' }}>Choose how frequently this search should automatically fetch new jobs</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {INTERVAL_OPTIONS.map(opt => {
                  const active = intervalHours === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setIntervalHours(opt.value)}
                      className={`p-3 rounded-xl border text-center transition-all ${active ? 'ring-1' : ''}`}
                      style={{
                        background: active ? 'rgba(125,194,66,0.12)' : 'var(--bg-surface)',
                        borderColor: active ? 'rgba(125,194,66,0.4)' : 'var(--border-default)',
                      }}
                    >
                      <p className="text-base font-bold" style={{ color: active ? '#7DC242' : 'var(--text-primary)' }}>
                        {opt.short}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
              <div className="rounded-xl p-3 border" style={{ background: 'rgba(125,194,66,0.06)', borderColor: 'var(--border-brand)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">📅</span>
                  <div>
                    <p className="text-xs font-medium" style={{ color: '#7DC242' }}>
                      Runs {intervalLabel(intervalHours).toLowerCase()}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                      First run: immediately after saving &bull; Slack notifications included
                    </p>
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 rounded accent-green-500" />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Start running immediately</span>
              </label>
            </div>
          )}

          {/* ── Step 4: Review ── */}
          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                ✅ Review your search
              </p>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
                {[
                  { label: 'Name', value: name },
                  { label: 'Keywords', value: query },
                  { label: 'Location', value: (() => { const country = LOCALITY_OPTIONS.find(o => o.code === locality)?.label ?? locality; const city = location.trim(); return city && city.toLowerCase() !== 'remote' ? `${city}, ${country}` : country; })() },
                  { label: 'Providers', value: selectedProviders.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ') },
                  { label: 'Results/Run', value: `${limit} jobs` },
                  { label: 'Posted within', value: maxAgeDays === null ? 'Any time' : maxAgeDays === 1 ? 'Today (1 day)' : maxAgeDays === 7 ? 'Past 1 week' : maxAgeDays === 14 ? 'Past 2 weeks' : `Past ${maxAgeDays} days` },
                  { label: 'Frequency', value: intervalLabel(intervalHours) },
                  { label: 'Remote Only', value: remoteOnly ? 'Yes ✓' : 'No' },
                  { label: 'Auto-Run', value: isActive ? 'Active ✓' : 'Paused' },
                ].map((row, i) => (
                  <div
                    key={row.label}
                    className="flex justify-between items-center px-4 py-2.5 text-sm"
                    style={{
                      background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-surface-alt)',
                      borderBottom: i < 8 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
              {isActive && (
                <div className="rounded-lg p-3 text-xs flex items-center gap-2" style={{ background: 'rgba(125,194,66,0.08)', color: '#7DC242' }}>
                  <span>⚡</span>
                  <span>This search will start running immediately once saved and notify you via Slack when new jobs are found.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid var(--border-muted)' }}>
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                ← Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="text-sm px-4 py-2" style={{ color: 'var(--text-faint)' }}>
              Cancel
            </button>
            {step < totalSteps ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canGoNext()}
                className="btn-primary text-sm disabled:opacity-50"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {saving ? 'Saving…' : isEdit ? 'Update Search' : '🚀 Create Search'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SavedSearches() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SavedSearch | null>(null);
  const [runningIds, setRunningIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [runMsgs, setRunMsgs] = useState<Map<number, { text: string; success: boolean }>>(new Map());

  const { data: searches = [], isLoading } = useQuery({
    queryKey: ['saved-searches'],
    queryFn: savedSearchesApi.list,
    refetchInterval: 30_000,
  });

  const { data: providersData } = useQuery({
    queryKey: ['providers'],
    queryFn: providersApi.list,
  });
  const providers = providersData?.providers?.map(p => p.name).filter(n => n !== 'jsearch') ?? [];

  const { data: recentJobsData, isLoading: recentJobsLoading } = useQuery({
    queryKey: ['saved-search-recent-jobs', expandedId],
    queryFn: () => savedSearchesApi.recentJobs(expandedId!),
    enabled: expandedId !== null,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: savedSearchesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['saved-searches'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SavedSearchCreate> }) =>
      savedSearchesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['saved-searches'] }); setEditing(null); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: savedSearchesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      savedSearchesApi.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }),
  });

  async function handleRunNow(s: SavedSearch) {
    setRunningIds(prev => new Set(prev).add(s.id));
    setRunMsgs(prev => { const m = new Map(prev); m.delete(s.id); return m; });
    try {
      const res = await savedSearchesApi.runNow(s.id);
      setRunMsgs(prev => new Map(prev).set(s.id, { text: res.message, success: res.new_jobs > 0 }));
      qc.invalidateQueries({ queryKey: ['saved-searches'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['dashboardStats'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      // Auto-expand summary if new jobs were found
      if (res.new_jobs > 0) setExpandedId(s.id);
      qc.invalidateQueries({ queryKey: ['saved-search-recent-jobs', s.id] });
      setTimeout(() => setRunMsgs(prev => { const m = new Map(prev); m.delete(s.id); return m; }), 8000);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to run. Check API key is configured.'
      setRunMsgs(prev => new Map(prev).set(s.id, { text: msg, success: false }));
    } finally {
      setRunningIds(prev => { const s2 = new Set(prev); s2.delete(s.id); return s2; });
    }
  }

  function handleDelete(s: SavedSearch) {
    if (confirm(`Delete saved search "${s.name}"?`)) {
      deleteMutation.mutate(s.id);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Saved Searches</h1>
          <p className="text-sm text-gray-400 mt-1">
            Searches run automatically on a schedule and send Slack notifications when new jobs are found.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary"
        >
          <span className="text-lg leading-none">+</span>
          New Search
        </button>
      </div>


      {/* Empty state */}
      {!isLoading && searches.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-lg font-medium text-gray-400">No saved searches yet</p>
          <p className="text-sm mt-1">Create a search and it will run automatically on your chosen schedule.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 btn-primary"
          >
            Create First Search
          </button>
        </div>
      )}

      {/* Search cards */}
      <div className="space-y-4">
        {searches.map(s => {
          const countryLabel = LOCALITY_OPTIONS.find(o => o.code === s.locality)?.label ?? s.locality.toUpperCase();
          const cityPart = s.location && s.location.toLowerCase() !== 'remote' ? s.location : null;
          const displayLocation = cityPart ? `${cityPart}, ${countryLabel}` : countryLabel;
          const isRunning = runningIds.has(s.id);
          const msg = runMsgs.get(s.id);
          const isExpanded = expandedId === s.id;

          const PROVIDER_CHIP: Record<string, { bg: string; color: string; label: string }> = {
            indeed:       { bg: isDark ? 'rgba(99,102,241,0.18)'  : 'rgba(99,102,241,0.12)',  color: isDark ? '#818cf8' : '#4338ca', label: 'Indeed' },
            glassdoor:    { bg: isDark ? 'rgba(34,197,94,0.18)'   : 'rgba(34,197,94,0.12)',   color: isDark ? '#4ade80' : '#166534', label: 'Glassdoor' },
            ziprecruiter: { bg: isDark ? 'rgba(168,85,247,0.18)'  : 'rgba(168,85,247,0.12)',  color: isDark ? '#c084fc' : '#6b21a8', label: 'ZipRecruiter' },
            linkedin:     { bg: isDark ? 'rgba(14,165,233,0.18)'  : 'rgba(14,165,233,0.12)',  color: isDark ? '#38bdf8' : '#0369a1', label: 'LinkedIn' },
          };

          return (
            <div
              key={s.id}
              className="rounded-xl border transition-colors"
              style={{
                background: 'var(--bg-surface)',
                borderColor: s.is_active ? (isDark ? 'rgba(125,194,66,0.25)' : 'rgba(125,194,66,0.45)') : 'var(--border-default)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  {/* Info — dims when paused */}
                  <div className={`flex-1 min-w-0 transition-opacity ${!s.is_active ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{s.name}</h3>
                      {s.is_active ? (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.15)', color: isDark ? '#4ade80' : '#166534' }}>Active</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ background: isDark ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.15)', color: isDark ? '#fbbf24' : '#92400e' }}>⏸ Paused</span>
                      )}
                      {s.last_new_jobs > 0 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          className="px-2 py-0.5 text-xs font-medium rounded-full transition-all hover:opacity-80 flex items-center gap-1"
                          style={{ background: isDark ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.12)', color: isDark ? '#60a5fa' : '#1d4ed8' }}
                        >
                          +{s.last_new_jobs} last run {isExpanded ? '▲' : '▼'}
                        </button>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                      <span style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Keywords:</span>{' '}{s.query}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Location:</span>{' '}{displayLocation}
                        {s.remote_only && (
                          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.12)', color: isDark ? '#a5b4fc' : '#4338ca' }}>Remote</span>
                        )}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                      <span className="flex items-center gap-1 flex-wrap">
                        {s.providers.map(p => {
                          const chip = PROVIDER_CHIP[p] ?? { bg: isDark ? 'rgba(107,114,128,0.18)' : 'rgba(107,114,128,0.12)', color: 'var(--text-muted)', label: p };
                          return (
                            <span key={p} className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: chip.bg, color: chip.color }}>
                              {chip.label}
                            </span>
                          );
                        })}
                      </span>
                      <span style={{ color: 'var(--text-faint)' }}>{intervalLabel(s.interval_hours)}</span>
                      <span style={{ color: 'var(--text-faint)' }}>{s.limit} jobs/run</span>
                      {s.max_age_days && <span style={{ color: 'var(--text-faint)' }}>≤{s.max_age_days === 1 ? 'today' : s.max_age_days === 7 ? '1wk' : s.max_age_days === 14 ? '2wk' : `${s.max_age_days}d`}</span>}
                      <span style={{ color: 'var(--text-faint)' }}>Last run: {formatLastRun(s.last_run_at)}</span>
                      {s.is_active && (
                        <span style={{ color: '#7DC242' }}>⏱ Next: {nextRunIn(s.interval_hours, s.last_run_at)}</span>
                      )}
                    </div>

                    {msg && (
                      <div className="mt-3 px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 border"
                        style={msg.success
                          ? { background: isDark ? 'rgba(125,194,66,0.08)' : 'rgba(125,194,66,0.1)', borderColor: isDark ? 'rgba(125,194,66,0.25)' : 'rgba(125,194,66,0.4)', color: isDark ? '#86efac' : '#166534' }
                          : { background: isDark ? 'rgba(251,191,36,0.06)' : 'rgba(251,191,36,0.1)', borderColor: isDark ? 'rgba(251,191,36,0.2)' : 'rgba(251,191,36,0.4)', color: isDark ? '#fde68a' : '#92400e' }
                        }
                      >
                        <span>{msg.text}</span>
                        <button onClick={() => setRunMsgs(prev => { const m = new Map(prev); m.delete(s.id); return m; })} className="opacity-50 hover:opacity-100 flex-shrink-0">✕</button>
                      </div>
                    )}
                  </div>

                  {/* Actions — always full opacity */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRunNow(s)}
                      disabled={isRunning}
                      title="Run now"
                      className="px-3 py-1.5 text-xs border rounded-lg font-medium transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: isDark ? 'rgba(125,194,66,0.12)' : 'rgba(125,194,66,0.15)', color: isDark ? '#86efac' : '#166534', borderColor: isDark ? 'rgba(125,194,66,0.35)' : 'rgba(125,194,66,0.5)' }}
                    >
                      {isRunning ? (
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Running…
                        </span>
                      ) : '▶ Run Now'}
                    </button>

                    {s.is_active ? (
                      <button
                        onClick={() => toggleMutation.mutate({ id: s.id, is_active: false })}
                        title="Pause"
                        className="px-3 py-1.5 text-xs border rounded-lg font-medium transition-all hover:brightness-110"
                        style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
                      >
                        ⏸ Pause
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleMutation.mutate({ id: s.id, is_active: true })}
                        title="Resume"
                        className="px-3 py-1.5 text-xs border rounded-lg font-semibold transition-all hover:brightness-110"
                        style={{ background: isDark ? 'rgba(251,191,36,0.18)' : 'rgba(251,191,36,0.15)', color: isDark ? '#fbbf24' : '#92400e', borderColor: isDark ? 'rgba(251,191,36,0.45)' : 'rgba(251,191,36,0.5)' }}
                      >
                        ▶ Resume
                      </button>
                    )}

                    <button
                      onClick={() => { setEditing(s); setShowForm(true); }}
                      title="Edit"
                      className="px-3 py-1.5 text-xs border rounded-lg font-medium transition-all hover:brightness-110"
                      style={{ background: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.1)', color: isDark ? '#93c5fd' : '#1d4ed8', borderColor: isDark ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.4)' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      title="Delete"
                      className="px-3 py-1.5 text-xs border rounded-lg font-medium transition-all hover:brightness-110"
                      style={{ background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.08)', color: isDark ? '#fca5a5' : '#991b1b', borderColor: isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.4)' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* ── Last Run Summary Panel ── */}
                {isExpanded && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-muted)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Last Run Results</span>
                      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        {formatLastRun(s.last_run_at)} · {s.last_new_jobs} new job{s.last_new_jobs !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {recentJobsLoading ? (
                      <div className="flex items-center justify-center py-6 gap-2" style={{ color: 'var(--text-faint)' }}>
                        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Loading jobs…</span>
                      </div>
                    ) : !recentJobsData || recentJobsData.length === 0 ? (
                      <div className="text-xs text-center py-5 rounded-lg" style={{ color: 'var(--text-faint)', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                        No jobs from this run available yet.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {recentJobsData.slice(0, 8).map(job => {
                          const chip = PROVIDER_CHIP[job.provider] ?? { bg: isDark ? 'rgba(107,114,128,0.18)' : 'rgba(107,114,128,0.12)', color: 'var(--text-muted)', label: job.provider };
                          return (
                            <a
                              key={job.id}
                              href={job.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between px-3 py-2.5 rounded-lg group transition-all"
                              style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: '1px solid var(--border-subtle)' }}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate group-hover:underline" style={{ color: 'var(--text-primary)' }}>{job.title}</p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{job.company}{job.location ? ` · ${job.location}` : ''}</p>
                              </div>
                              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: chip.bg, color: chip.color }}>{chip.label}</span>
                                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>↗</span>
                              </div>
                            </a>
                          );
                        })}
                        {recentJobsData.length > 8 && (
                          <p className="text-xs text-center pt-1" style={{ color: 'var(--text-faint)' }}>
                            +{recentJobsData.length - 8} more from this run
                          </p>
                        )}
                        <div className="pt-3 text-center">
                          <button
                            onClick={() => navigate('/jobs')}
                            className="text-xs font-semibold px-4 py-2 rounded-lg border transition-all hover:brightness-110"
                            style={{ background: isDark ? 'rgba(125,194,66,0.1)' : 'rgba(125,194,66,0.12)', color: isDark ? '#86efac' : '#166534', borderColor: isDark ? 'rgba(125,194,66,0.3)' : 'rgba(125,194,66,0.4)' }}
                          >
                            View all {s.last_new_jobs} jobs in Jobs tab →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Wizard modal */}
      {showForm && (
        <WizardModal
          initial={editing ?? undefined}
          providers={providers}
          saving={createMutation.isPending || updateMutation.isPending}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={data => {
            if (editing) {
              updateMutation.mutate({ id: editing.id, data });
            } else {
              createMutation.mutate(data);
            }
          }}
        />
      )}
    </div>
  );
}