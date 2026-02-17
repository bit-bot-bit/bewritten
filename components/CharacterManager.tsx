import React, { useState } from 'react';
import { Character, Chapter } from '../types';
import { Plus, Trash2, Wand2, User, ScanSearch, Loader2 } from 'lucide-react';
import { generateCharacterProfile, extractCharactersFromText } from '../services/geminiService';

interface CharacterManagerProps {
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  currentChapter: Chapter;
}

export const CharacterManager: React.FC<CharacterManagerProps> = ({ characters, setCharacters, currentChapter }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [newCharPrompt, setNewCharPrompt] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!newCharPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const profile = await generateCharacterProfile(newCharPrompt);
      const newCharacter: Character = {
        id: crypto.randomUUID(),
        name: profile.name || 'Unknown',
        role: profile.role || 'Support',
        description: profile.description || newCharPrompt,
        traits: profile.traits || [],
        relationships: []
      };
      setCharacters([...characters, newCharacter]);
      setNewCharPrompt('');
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Failed to generate character.';
      const message = String(raw).includes('400')
        ? 'AI is currently busy. You are trying too much right now, please try again shortly.'
        : raw;
      alert(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleScanChapter = async () => {
      if (!currentChapter.content.trim()) {
          alert("Current chapter is empty!");
          return;
      }
      setIsScanning(true);
      try {
          const result = await extractCharactersFromText(currentChapter.content, characters);
          
          let updatedCharacters = [...characters];

          // Process updates
          result.updates.forEach(upd => {
              const idx = updatedCharacters.findIndex(c => c.name.toLowerCase() === upd.name.toLowerCase());
              if (idx !== -1) {
                  updatedCharacters[idx] = {
                      ...updatedCharacters[idx],
                      description: updatedCharacters[idx].description + `\n[Update from ${currentChapter.title}]: ${upd.descriptionUpdate}`
                  };
              }
          });

          // Process new
          result.newCharacters.forEach(nc => {
              if (nc.name && !updatedCharacters.find(c => c.name.toLowerCase() === nc.name?.toLowerCase())) {
                  updatedCharacters.push({
                      id: crypto.randomUUID(),
                      name: nc.name,
                      role: nc.role || 'Support',
                      description: nc.description || '',
                      traits: nc.traits || [],
                      relationships: []
                  });
              }
          });

      setCharacters(updatedCharacters);
      alert(`Scan complete. Found ${result.newCharacters.length} new characters and updated ${result.updates.length}.`);

      } catch (e) {
          const raw = e instanceof Error ? e.message : 'Failed to scan chapter.';
          const message = String(raw).includes('400')
            ? 'AI is currently busy. You are trying too much right now, please try again shortly.'
            : raw;
          alert(message);
      } finally {
          setIsScanning(false);
      }
  };

  const deleteCharacter = (id: string) => {
    setCharacters(characters.filter(c => c.id !== id));
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto h-full overflow-y-auto overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-main">Character Bible</h2>
          <p className="text-muted mt-2">Manage your cast. Scan your story to auto-populate or update details.</p>
        </div>
        
        <button 
            onClick={handleScanChapter}
            disabled={isScanning}
            className="bg-accent-dim border border-accent/50 hover:bg-accent/20 text-accent px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 w-full md:w-auto"
        >
            {isScanning ? <Loader2 size={18} className="animate-spin" /> : <ScanSearch size={18} />}
            Scan "{currentChapter.title}"
        </button>
      </div>

      {/* Generator */}
      <div className="bg-surface/50 p-6 rounded-2xl border border-border mb-8">
        <label className="block text-sm font-medium text-muted mb-2">
          AI Character Generator
        </label>
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            value={newCharPrompt}
            onChange={(e) => setNewCharPrompt(e.target.value)}
            placeholder="e.g. A grumpy cyberpunk detective with a cybernetic eye..."
            className="themed-control flex-1 border rounded-xl px-4 py-3 text-main focus:ring-2 focus:ring-accent outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            style={{ color: 'var(--color-text-main)', caretColor: 'var(--color-text-main)' }}
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-accent hover:brightness-110 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors w-full md:w-auto"
          >
            {isGenerating ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Wand2 size={18} />}
            Generate
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {characters.map(char => (
          <div key={char.id} className="bg-card border border-border rounded-2xl p-6 group hover:border-accent/50 transition-all relative">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-muted shrink-0">
                  <User size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-lg text-main truncate pr-2">{char.name}</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface text-muted uppercase tracking-wider">
                    {char.role}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setExpandedId(expandedId === char.id ? null : char.id)}
                  className="text-muted hover:text-accent p-1.5 rounded-lg hover:bg-surface transition-colors"
                  title={expandedId === char.id ? "Collapse" : "Expand"}
                >
                  <Plus size={18} className={`transition-transform duration-200 ${expandedId === char.id ? 'rotate-45' : ''}`} />
                </button>
                <button
                  onClick={() => deleteCharacter(char.id)}
                  className="text-muted hover:text-red-400 p-1.5 rounded-lg hover:bg-red-900/10 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            
            <div className={`text-muted text-sm mb-4 whitespace-pre-line break-words transition-all ${expandedId === char.id ? '' : 'line-clamp-3'}`}>
                {char.description}
            </div>
            
            <div className="flex flex-wrap gap-2">
              {char.traits.map((trait, i) => (
                <span key={i} className="text-xs bg-accent-dim text-accent px-2 py-1 rounded-md border border-accent/20">
                  {trait}
                </span>
              ))}
            </div>
          </div>
        ))}

        <button 
          onClick={() => {
             const newC: Character = { 
                 id: crypto.randomUUID(), 
                 name: 'New Character', 
                 role: 'Support', 
                 description: 'Description here...', 
                 traits: [], 
                 relationships: [] 
             };
             setCharacters([...characters, newC]);
          }}
          className="border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center justify-center text-muted hover:text-accent hover:border-accent/50 transition-all cursor-pointer min-h-[200px]"
        >
          <Plus size={32} className="mb-2" />
          <span className="font-medium">Add Manually</span>
        </button>
      </div>
    </div>
  );
};
