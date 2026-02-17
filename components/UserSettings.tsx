import React, { useEffect, useState } from 'react';
import { apiGet, apiPut } from '../services/apiClient';

const TARGET_LABELS = {
  gemini: 'Gemini',
  openai_compatible: 'OpenAI Compatible',
  shared: 'Shared Key (Managed)',
  disabled: 'Disabled',
};

export const UserSettings = () => {
  const [settings, setSettings] = useState({
    aiTarget: 'gemini',
    aiApiKey: '',
    aiModel: '',
    aiBaseUrl: '',
    hasApiKey: false,
    aiApiKeyMasked: '',
    availableTargets: ['gemini', 'openai_compatible', 'disabled'],
    tier: 'byok',
    credits: null,
    monetizationEnabled: false,
    themeId: 'nexus',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [replaceKey, setReplaceKey] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setStatus('');
    try {
      const data = await apiGet('/user/settings');
      setSettings(data.settings);
      setReplaceKey(false);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const save = async () => {
    setIsSaving(true);
    setStatus('');
    try {
      const data = await apiPut('/user/settings', {
        settings: {
          ...settings,
          aiApiKey: replaceKey ? settings.aiApiKey : '',
        },
        keepExistingKey: !replaceKey,
      });
      setSettings(data.settings);
      setReplaceKey(false);
      setStatus('Settings saved.');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-xl font-bold text-main">User Settings</h3>
        <p className="text-sm text-muted mt-3">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <h3 className="text-xl font-bold text-main">User Settings</h3>
        <p className="text-sm text-muted mt-1">Configure AI target and credentials for your own account.</p>
        <p className="text-xs text-muted mt-2 uppercase tracking-wide">Tier: {settings.tier}</p>
        {settings.credits?.limited && (
          <p className="text-xs text-muted mt-1">
            Tokens: {settings.credits.balance}/{settings.credits.cap} (refill {settings.credits.refillPerDay}/day)
          </p>
        )}
      </div>

      {Object.keys(settings.taskCosts || {}).length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-2 bg-surface/40 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
            Service Costs (Tokens)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 text-xs">
            {Object.entries(settings.taskCosts || {}).map(([task, cost]) => (
              <div key={task} className="flex justify-between items-center bg-card border border-border rounded px-2 py-1.5">
                <span className="text-muted truncate mr-2">{task}</span>
                <span className="font-mono text-accent">{String(cost)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <label className="block text-sm text-muted">AI Target</label>
        <select
          value={settings.aiTarget}
          onChange={(e) => setSettings((prev) => ({ ...prev, aiTarget: e.target.value }))}
          className="themed-control w-full rounded-lg border px-3 py-2 text-main focus:border-accent outline-none"
        >
          {(settings.availableTargets || []).map((target) => (
            <option key={target} value={target}>{TARGET_LABELS[target] || target}</option>
          ))}
        </select>
      </div>

      {settings.aiTarget !== 'disabled' && settings.aiTarget !== 'shared' && (
        <>
          <div className="space-y-3">
            <label className="block text-sm text-muted">API Key</label>
            {settings.hasApiKey && !replaceKey && (
              <div className="text-xs text-muted">
                Stored key: <span className="font-mono">{settings.aiApiKeyMasked || 'configured'}</span>
              </div>
            )}
            <label className="inline-flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={replaceKey}
                onChange={(e) => {
                  setReplaceKey(e.target.checked);
                  setSettings((prev) => ({ ...prev, aiApiKey: '' }));
                }}
              />
              Replace stored API key
            </label>
            <input
              type="password"
              value={settings.aiApiKey}
              onChange={(e) => setSettings((prev) => ({ ...prev, aiApiKey: e.target.value }))}
              placeholder={replaceKey ? (settings.aiTarget === 'gemini' ? 'Gemini API key' : 'OpenAI-compatible API key') : 'Key remains unchanged unless replaced'}
              className="themed-control w-full rounded-lg border px-3 py-2 text-main"
              disabled={!replaceKey}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-3">
              <label className="block text-sm text-muted">Model</label>
              <input
                value={settings.aiModel}
                onChange={(e) => setSettings((prev) => ({ ...prev, aiModel: e.target.value }))}
                placeholder={settings.aiTarget === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini'}
                className="themed-control w-full rounded-lg border px-3 py-2 text-main"
              />
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-muted">Base URL (OpenAI-compatible only)</label>
              <input
                value={settings.aiBaseUrl}
                onChange={(e) => setSettings((prev) => ({ ...prev, aiBaseUrl: e.target.value }))}
                placeholder="https://api.openai.com/v1"
                className="themed-control w-full rounded-lg border px-3 py-2 text-main"
                disabled={settings.aiTarget !== 'openai_compatible'}
              />
            </div>
          </div>
        </>
      )}

      {settings.aiTarget === 'shared' && (
        <div className="text-xs text-muted border border-border rounded-lg p-3 bg-surface/40">
          Shared key mode is managed by admin. Your personal API key is not used for this target.
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => save().catch(() => {})}
          disabled={isSaving}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-accent text-white font-semibold border border-accent/80 shadow-md shadow-accent/25 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-accent/60 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
        {status && <span className="text-sm text-muted">{status}</span>}
      </div>
    </div>
  );
};
