import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[150] flex items-center justify-center p-4">
      <div
        className="relative border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 sm:p-7 animate-in fade-in zoom-in duration-200"
        style={{ backgroundColor: 'var(--color-bg)', opacity: 1 }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl" style={{ background: 'linear-gradient(90deg, transparent, rgba(248,113,113,0.85), transparent)' }} />

        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-400/30 flex items-center justify-center text-red-400 shrink-0 shadow-sm shadow-red-900/20">
            <AlertTriangle size={22} />
          </div>
          <div className="pt-0.5">
            <h3 className="text-2xl font-bold text-main tracking-tight leading-none">{title}</h3>
            <p className="text-sm text-muted mt-2 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="h-px bg-border/80 mb-5" />

        <div className="flex justify-end gap-3">
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="px-4 py-2.5 text-sm font-medium text-muted hover:text-main transition-colors rounded-lg border border-transparent hover:border-border hover:bg-card">
            Cancel
          </button>
          <button onClick={(e) => { e.stopPropagation(); onConfirm(); onClose(); }} className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-red-900/30 ring-1 ring-red-400/30">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
