import React, { useState } from 'react';

export const ForcePasswordChange = ({ onSubmit, email }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit(currentPassword, newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Password Update Required</h1>
          <p className="text-sm text-muted mt-2">Signed in as {email}. Change your password to continue.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm text-muted">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="themed-control w-full rounded-lg border px-3 py-2"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-muted">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="themed-control w-full rounded-lg border px-3 py-2"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-muted">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="themed-control w-full rounded-lg border px-3 py-2"
              required
            />
          </div>

          {error && <div className="text-sm text-red-400">{error}</div>}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full px-4 py-2 rounded-lg bg-accent text-white hover:brightness-110 disabled:opacity-70"
          >
            {isSaving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};
