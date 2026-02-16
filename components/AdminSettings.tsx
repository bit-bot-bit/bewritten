import React, { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPut } from '../services/apiClient';
import { CheckCircle2, XCircle, Shield, Link as LinkIcon, RefreshCw, Lock, Unlock, Trash2, UserCog, KeyRound } from 'lucide-react';

export const AdminSettings = ({ compact = false }) => {
  const [data, setData] = useState(null);
  const [monetization, setMonetization] = useState(null);
  const [replaceSharedKey, setReplaceSharedKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiGet('/admin/settings');
      setData(res);
      setMonetization(res.monetization || null);
      setReplaceSharedKey(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load admin settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const withRefresh = async (work) => {
    setIsSaving(true);
    setError(null);
    try {
      await work();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Admin action failed');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRegistration = (enabled) => {
    withRefresh(async () => {
      await apiPut('/admin/settings/registration', { enabled });
    }).catch(() => {});
  };

  const toggleUserLock = (email, locked) => {
    withRefresh(async () => {
      await apiPut(`/admin/users/${encodeURIComponent(email)}/lock`, { locked });
    }).catch(() => {});
  };

  const setUserRole = (email, role) => {
    withRefresh(async () => {
      await apiPut(`/admin/users/${encodeURIComponent(email)}/role`, { role });
    }).catch(() => {});
  };

  const setUserTier = (email, tier) => {
    withRefresh(async () => {
      await apiPut(`/admin/users/${encodeURIComponent(email)}/tier`, { tier });
    }).catch(() => {});
  };

  const deleteUser = (email) => {
    if (!window.confirm(`Delete user ${email}? This removes all their stories and settings.`)) return;
    withRefresh(async () => {
      await apiDelete(`/admin/users/${encodeURIComponent(email)}`);
    }).catch(() => {});
  };

  const resetPassword = (email) => {
    const temporary = window.prompt(`Set a temporary password for ${email} (min 8 chars):`);
    if (temporary === null) return;
    const password = temporary.trim();
    if (password.length < 8) {
      setError('Temporary password must be at least 8 characters');
      return;
    }

    withRefresh(async () => {
      await apiPut(`/admin/users/${encodeURIComponent(email)}/password`, { password });
    }).catch(() => {});
  };

  const saveMonetization = () => {
    if (!monetization) return;
    withRefresh(async () => {
      await apiPut('/admin/settings/monetization', {
        monetization: {
          ...monetization,
          shared: {
            ...monetization.shared,
            apiKey: replaceSharedKey ? monetization.shared?.apiKey : '',
          },
        },
        keepExistingSharedKey: !replaceSharedKey,
      });
    }).catch(() => {});
  };

  if (isLoading) {
    return (
      <div className={compact ? 'bg-card border border-border rounded-xl p-4 md:p-5 min-w-0' : 'p-8 max-w-5xl mx-auto h-full overflow-y-auto'}>
        <div className="text-muted">Loading admin settings...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={compact ? 'bg-card border border-border rounded-xl p-4 md:p-5 min-w-0 space-y-4' : 'p-8 max-w-5xl mx-auto h-full overflow-y-auto space-y-4'}>
        <h2 className="text-3xl font-bold text-main">Admin Settings</h2>
        <p className="text-red-400 text-sm">{error || 'Unable to load settings'}</p>
        <button onClick={() => load().catch(() => {})} className="px-4 py-2 rounded-lg bg-card border border-border text-main hover:bg-surface">Retry</button>
      </div>
    );
  }

  return (
    <div className={compact ? 'bg-card border border-border rounded-xl p-4 md:p-5 min-w-0 space-y-6' : 'p-4 md:p-8 max-w-5xl mx-auto h-full overflow-y-auto space-y-8'}>
      <div className="flex flex-col md:flex-row items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-main">Admin Settings</h2>
          <p className="text-muted mt-2">Configure and validate authentication providers.</p>
          <p className="text-xs text-muted mt-1">Signed in as {data.user.email}</p>
        </div>
        <button
          onClick={() => load().catch(() => {})}
          className="px-4 py-2 rounded-lg bg-card border border-border text-main hover:bg-surface flex items-center gap-2 disabled:opacity-60"
          disabled={isSaving}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-main font-semibold"><Shield size={16} /> Auth Runtime</div>
        <div className="text-sm text-muted">Password login: {data.auth.passwordLoginEnabled ? 'Enabled' : 'Disabled'}</div>
        <div className="text-sm text-muted">Session TTL: {data.auth.sessionTtlDays} days</div>
        <div className="text-sm text-muted">Self-service registration: {data.auth.registrationEnabled ? 'Enabled' : 'Disabled'}</div>
        <div className="text-sm text-muted">Public URL: {data.publicUrl || '(not set, using request host)'}</div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button onClick={() => toggleRegistration(true)} disabled={isSaving || data.auth.registrationEnabled} className="px-3 py-2 rounded-lg border border-border bg-card text-main hover:bg-surface disabled:opacity-50">Enable Signups</button>
          <button onClick={() => toggleRegistration(false)} disabled={isSaving || !data.auth.registrationEnabled} className="px-3 py-2 rounded-lg border border-border bg-card text-main hover:bg-surface disabled:opacity-50">Lock Signups</button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-main font-semibold">Monetization</div>
          <label className="inline-flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={Boolean(monetization?.enabled)}
              onChange={(e) => setMonetization((prev) => ({ ...(prev || {}), enabled: e.target.checked }))}
            />
            Enabled
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs text-muted uppercase tracking-wide">Free Cap</label>
            <input
              type="number"
              min="0"
              value={monetization?.tiers?.free?.cap ?? 100}
              onChange={(e) => setMonetization((prev) => ({ ...prev, tiers: { ...prev.tiers, free: { ...prev.tiers?.free, cap: Number(e.target.value || 0) } } }))}
              className="themed-control w-full rounded-lg border px-3 py-2 text-main"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted uppercase tracking-wide">Free Daily Refill</label>
            <input
              type="number"
              min="0"
              value={monetization?.tiers?.free?.refillPerDay ?? 20}
              onChange={(e) => setMonetization((prev) => ({ ...prev, tiers: { ...prev.tiers, free: { ...prev.tiers?.free, refillPerDay: Number(e.target.value || 0) } } }))}
              className="themed-control w-full rounded-lg border px-3 py-2 text-main"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted uppercase tracking-wide">Pro Cap</label>
            <input
              type="number"
              min="0"
              value={monetization?.tiers?.pro?.cap ?? 2000}
              onChange={(e) => setMonetization((prev) => ({ ...prev, tiers: { ...prev.tiers, pro: { ...prev.tiers?.pro, cap: Number(e.target.value || 0) } } }))}
              className="themed-control w-full rounded-lg border px-3 py-2 text-main"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted uppercase tracking-wide">Pro Daily Refill</label>
            <input
              type="number"
              min="0"
              value={monetization?.tiers?.pro?.refillPerDay ?? 20}
              onChange={(e) => setMonetization((prev) => ({ ...prev, tiers: { ...prev.tiers, pro: { ...prev.tiers?.pro, refillPerDay: Number(e.target.value || 0) } } }))}
              className="themed-control w-full rounded-lg border px-3 py-2 text-main"
            />
          </div>
        </div>

        <div className="border border-border rounded-xl p-4 space-y-3">
          <div className="text-sm font-semibold text-main">Shared Key Runtime (Admin Only)</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs text-muted uppercase tracking-wide">Target</label>
              <select
                value={monetization?.shared?.target || 'gemini'}
                onChange={(e) => setMonetization((prev) => ({ ...prev, shared: { ...prev.shared, target: e.target.value } }))}
                className="themed-control w-full rounded-lg border px-3 py-2 text-main"
              >
                <option value="gemini">Gemini</option>
                <option value="openai_compatible">OpenAI Compatible</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted uppercase tracking-wide">Model</label>
              <input
                value={monetization?.shared?.model || ''}
                onChange={(e) => setMonetization((prev) => ({ ...prev, shared: { ...prev.shared, model: e.target.value } }))}
                className="themed-control w-full rounded-lg border px-3 py-2 text-main"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs text-muted uppercase tracking-wide">Base URL (OpenAI-compatible)</label>
              <input
                value={monetization?.shared?.baseUrl || ''}
                onChange={(e) => setMonetization((prev) => ({ ...prev, shared: { ...prev.shared, baseUrl: e.target.value } }))}
                className="themed-control w-full rounded-lg border px-3 py-2 text-main"
              />
            </div>
          </div>

          {monetization?.shared?.hasApiKey && !replaceSharedKey && (
            <div className="text-xs text-muted">Stored shared key: <span className="font-mono">{monetization.shared.apiKeyMasked || 'configured'}</span></div>
          )}
          <label className="inline-flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={replaceSharedKey}
              onChange={(e) => {
                setReplaceSharedKey(e.target.checked);
                setMonetization((prev) => ({ ...prev, shared: { ...prev.shared, apiKey: '' } }));
              }}
            />
            Replace shared API key
          </label>
          <input
            type="password"
            value={monetization?.shared?.apiKey || ''}
            onChange={(e) => setMonetization((prev) => ({ ...prev, shared: { ...prev.shared, apiKey: e.target.value } }))}
            placeholder={replaceSharedKey ? 'Shared API key' : 'Key remains unchanged unless replaced'}
            className="themed-control w-full rounded-lg border px-3 py-2 text-main"
            disabled={!replaceSharedKey}
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-main">Interface Token Costs (Estimate Per Action)</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {(data?.monetizationDefaults?.knownTasks || Object.keys(monetization?.taskCosts || {})).map((task) => (
              <label key={task} className="text-xs text-muted space-y-1">
                <div>{task}</div>
                <input
                  type="number"
                  min="0"
                  value={monetization?.taskCosts?.[task] ?? 0}
                  onChange={(e) => setMonetization((prev) => ({ ...prev, taskCosts: { ...prev.taskCosts, [task]: Number(e.target.value || 0) } }))}
                  className="themed-control w-full rounded border px-2 py-1 text-main"
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <button
            onClick={saveMonetization}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-accent text-white hover:brightness-110 disabled:opacity-70"
          >
            Save Monetization
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xl font-bold text-main">Users</h3>
        <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs uppercase tracking-wide text-muted border-b border-border">
            <div className="col-span-4">Email</div><div className="col-span-2">Role</div><div className="col-span-2">Status</div><div className="col-span-2">Last Seen</div><div className="col-span-2 text-right">Actions</div>
          </div>
          {data.users.map((u) => (
            <div key={u.email} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-b last:border-b-0 border-border items-center">
              <div className="col-span-4 font-mono text-main break-all">{u.email}</div>
              <div className="col-span-2 flex flex-col gap-1">
                <span className={`px-2 py-1 rounded text-xs border w-fit ${u.role === 'admin' ? 'border-accent text-accent bg-accent/10' : 'border-border text-muted bg-surface'}`}>{u.role}</span>
                <select
                  value={u.tier || 'byok'}
                  onChange={(e) => setUserTier(u.email, e.target.value)}
                  disabled={isSaving}
                  className="themed-control text-xs rounded border px-2 py-1"
                >
                  <option value="free">free</option>
                  <option value="pro">pro</option>
                  <option value="byok">byok</option>
                </select>
              </div>
              <div className="col-span-2 text-muted">{u.locked ? 'Locked' : 'Active'}{u.mustChangePassword ? ' · Reset Required' : ''}</div>
              <div className="col-span-2 text-muted text-xs">
                <div>{u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : 'Never'}</div>
                <div>Tokens: {u.tokenBalance ?? '—'}</div>
              </div>
              <div className="col-span-2 flex justify-end gap-1">
                <button onClick={() => setUserRole(u.email, u.role === 'admin' ? 'user' : 'admin')} disabled={isSaving || u.email === data.user.email} className="p-2 rounded border border-border hover:bg-surface text-main disabled:opacity-40" title={u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}><UserCog size={14} /></button>
                <button onClick={() => toggleUserLock(u.email, !u.locked)} disabled={isSaving || u.email === data.user.email} className="p-2 rounded border border-border hover:bg-surface text-main disabled:opacity-40" title={u.locked ? 'Unlock account' : 'Lock account'}>{u.locked ? <Unlock size={14} /> : <Lock size={14} />}</button>
                <button onClick={() => resetPassword(u.email)} disabled={isSaving || u.email === data.user.email} className="p-2 rounded border border-amber-700/40 text-amber-300 hover:bg-amber-900/20 disabled:opacity-40" title="Reset password and force change on login"><KeyRound size={14} /></button>
                <button onClick={() => deleteUser(u.email)} disabled={isSaving || u.email === data.user.email} className="p-2 rounded border border-red-700/40 text-red-400 hover:bg-red-900/20 disabled:opacity-40" title="Delete user"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="md:hidden space-y-3">
          {data.users.map((u) => (
            <div key={u.email} className="bg-card border border-border rounded-xl p-3 space-y-2">
              <div className="font-mono text-main text-sm break-all">{u.email}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`px-2 py-1 rounded border ${u.role === 'admin' ? 'border-accent text-accent bg-accent/10' : 'border-border text-muted bg-surface'}`}>{u.role}</span>
                <span className="text-muted">{u.locked ? 'Locked' : 'Active'}{u.mustChangePassword ? ' · Reset Required' : ''}</span>
              </div>
              <div>
                <label className="text-xs text-muted mr-2">Tier</label>
                <select
                  value={u.tier || 'byok'}
                  onChange={(e) => setUserTier(u.email, e.target.value)}
                  disabled={isSaving}
                  className="themed-control text-xs rounded border px-2 py-1"
                >
                  <option value="free">free</option>
                  <option value="pro">pro</option>
                  <option value="byok">byok</option>
                </select>
              </div>
              <div className="text-xs text-muted">Last Seen: {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : 'Never'}</div>
              <div className="text-xs text-muted">Tokens: {u.tokenBalance ?? '—'}</div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={() => setUserRole(u.email, u.role === 'admin' ? 'user' : 'admin')} disabled={isSaving || u.email === data.user.email} className="px-2 py-2 rounded border border-border hover:bg-surface text-main disabled:opacity-40 text-xs flex items-center justify-center gap-1" title={u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}><UserCog size={13} />Role</button>
                <button onClick={() => toggleUserLock(u.email, !u.locked)} disabled={isSaving || u.email === data.user.email} className="px-2 py-2 rounded border border-border hover:bg-surface text-main disabled:opacity-40 text-xs flex items-center justify-center gap-1" title={u.locked ? 'Unlock account' : 'Lock account'}>{u.locked ? <Unlock size={13} /> : <Lock size={13} />}Lock</button>
                <button onClick={() => resetPassword(u.email)} disabled={isSaving || u.email === data.user.email} className="px-2 py-2 rounded border border-amber-700/40 text-amber-300 hover:bg-amber-900/20 disabled:opacity-40 text-xs flex items-center justify-center gap-1" title="Reset password and force change on login"><KeyRound size={13} />Reset</button>
                <button onClick={() => deleteUser(u.email)} disabled={isSaving || u.email === data.user.email} className="px-2 py-2 rounded border border-red-700/40 text-red-400 hover:bg-red-900/20 disabled:opacity-40 text-xs flex items-center justify-center gap-1" title="Delete user"><Trash2 size={13} />Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xl font-bold text-main">OAuth Providers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.oauthProviders.map((provider) => (
            <div key={provider.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-main">{provider.label}</div>
                <div className={`text-xs font-bold px-2 py-1 rounded ${provider.configured ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'}`}>
                  {provider.configured ? 'Configured' : 'Missing env'}
                </div>
              </div>
              <div className="text-xs text-muted flex items-center gap-2"><LinkIcon size={12} /> Callback URL</div>
              <div className="text-xs font-mono text-main/90 bg-surface border border-border rounded p-2 break-all">{provider.callbackUrl}</div>
              <div className="space-y-1">
                {provider.requiredEnv.map((envName) => (
                  <div key={envName} className="text-xs text-muted flex items-center gap-2">
                    {provider.configured ? <CheckCircle2 size={12} className="text-emerald-400" /> : <XCircle size={12} className="text-rose-400" />}
                    {envName}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
