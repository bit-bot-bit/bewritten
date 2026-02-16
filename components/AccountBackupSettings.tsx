import React, { useRef, useState } from 'react';
import { Download, Upload, ShieldCheck } from 'lucide-react';
import { exportAccountBackup, importAccountBackup } from '../services/storyService';

export const AccountBackupSettings = ({ onRestoreComplete }) => {
  const [status, setStatus] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [restoreMode, setRestoreMode] = useState('merge');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = async () => {
    setStatus('');
    setIsExporting(true);
    try {
      const backup = await exportAccountBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/x-bewritten-backup+json' });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bewritten-account-${date}.bwrx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('Backup exported.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to export backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setStatus('');
    setIsImporting(true);
    try {
      const raw = await file.text();
      const backup = JSON.parse(raw);

      if (restoreMode === 'replace') {
        const ok = window.confirm(
          'Replace mode will remove your current stories before restoring this backup. Continue?'
        );
        if (!ok) {
          setIsImporting(false);
          return;
        }
      }

      const result = await importAccountBackup(backup, restoreMode);
      setStatus(`Backup restored (${result.restoredStories} stories, mode: ${result.mode}).`);
      if (onRestoreComplete) onRestoreComplete();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to import backup');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <section className="bg-surface border border-border rounded-2xl p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-main">Account Backup</h3>
          <p className="text-muted">
            Export or restore all stories, chapters, characters, world, and plot data using the versioned `.bwrx` format.
          </p>
        </div>
        <ShieldCheck className="text-accent shrink-0" size={20} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] items-end">
        <label className="text-sm text-main">
          Restore Mode
          <select
            value={restoreMode}
            onChange={(e) => setRestoreMode(e.target.value)}
            className="themed-control w-full mt-1 border border-border rounded-lg px-3 py-2 text-main"
            style={{ color: 'var(--color-text-main)', backgroundColor: 'var(--color-surface)' }}
          >
            <option value="merge">Merge with existing stories</option>
            <option value="replace">Replace existing stories</option>
          </select>
        </label>

        <button
          onClick={handleExport}
          disabled={isExporting || isImporting}
          className="h-10 px-4 rounded-lg border border-border bg-card hover:bg-card/80 text-main flex items-center gap-2 disabled:opacity-60"
        >
          <Download size={16} />
          {isExporting ? 'Exporting...' : 'Export .bwrx'}
        </button>

        <button
          onClick={handleImportClick}
          disabled={isExporting || isImporting}
          className="h-10 px-4 rounded-lg border border-border bg-accent-dim text-accent hover:brightness-110 flex items-center gap-2 disabled:opacity-60"
        >
          <Upload size={16} />
          {isImporting ? 'Importing...' : 'Import .bwrx'}
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept=".bwrx,.json,application/json" className="hidden" onChange={handleImportFile} />

      <p className="mt-3 text-xs text-muted">Backup files are versioned and include checksum validation for compatibility and integrity.</p>
      {status && <p className="mt-2 text-sm text-main">{status}</p>}
    </section>
  );
};
