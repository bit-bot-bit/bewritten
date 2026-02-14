import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ProvenanceEntry {
  id: string;
  timestamp: string;
  file_path: string;
  range_start: number;
  range_end: number;
  author_action: string;
  ai_involved: boolean;
  suggestion_id: string | null;
  diff_hash: string;
}

interface ProvenanceViewProps {
  filePath: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ProvenanceView: React.FC<ProvenanceViewProps> = ({ filePath, isOpen, onClose }) => {
  const [entries, setEntries] = useState<ProvenanceEntry[]>([]);

  useEffect(() => {
    if (isOpen && filePath) {
      invoke('get_provenance', { file_path: filePath })
        .then((res: any) => setEntries(res as ProvenanceEntry[]))
        .catch(console.error);
    }
  }, [isOpen, filePath]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="bg-white w-96 h-full shadow-lg p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className="font-bold text-lg">Provenance History</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-black font-semibold">X</button>
        </div>
        <div className="space-y-4">
            {entries.length === 0 ? (
                <div className="text-gray-500 text-center mt-10">No history found.</div>
            ) : (
                entries.map(entry => (
                    <div key={entry.id} className="border border-gray-200 p-3 rounded text-sm hover:bg-gray-50">
                        <div className="flex justify-between text-gray-500 text-xs mb-1">
                            <span>{new Date(entry.timestamp).toLocaleString()}</span>
                            {entry.ai_involved && <span className="bg-purple-100 text-purple-700 px-1 rounded text-[10px] font-bold">AI</span>}
                        </div>
                        <div className="font-semibold text-gray-800">{entry.author_action}</div>
                        <div className="text-xs text-gray-400 font-mono mt-1 truncate">Hash: {entry.diff_hash}</div>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
};
