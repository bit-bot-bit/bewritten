import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ContextSidebarProps {
  content: string;
}

interface AnalysisResult {
  characters: string[];
  locations: string[];
}

export const ContextSidebar: React.FC<ContextSidebarProps> = ({ content }) => {
  const [entities, setEntities] = useState<AnalysisResult>({ characters: [], locations: [] });

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const result: AnalysisResult = await invoke('analyze_text', { text: content });
        setEntities(result);
      } catch (err) {
        console.error('Extraction failed:', err);
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [content]);

  return (
    <div className="p-4 bg-gray-50 h-full overflow-y-auto border-l border-gray-200 w-64">
      <h3 className="font-bold text-gray-700 mb-2">Context</h3>

      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-500 mb-1">Characters</h4>
        <ul className="space-y-1">
          {entities.characters.map((char) => (
            <li key={char} className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-sm">
              @{char}
            </li>
          ))}
          {entities.characters.length === 0 && <span className="text-gray-400 text-xs">None</span>}
        </ul>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-500 mb-1">Locations</h4>
        <ul className="space-y-1">
          {entities.locations.map((loc) => (
            <li key={loc} className="text-green-600 bg-green-50 px-2 py-1 rounded text-sm">
              #{loc}
            </li>
          ))}
          {entities.locations.length === 0 && <span className="text-gray-400 text-xs">None</span>}
        </ul>
      </div>
    </div>
  );
};
