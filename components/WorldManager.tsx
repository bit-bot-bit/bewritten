import React, { useState } from 'react';
import { Location, Chapter } from '../types';
import { MapPin, Plus, Trash2, ScanSearch, Loader2, BookOpen } from 'lucide-react';
import { extractWorldEventsFromText } from '../services/geminiService';

interface WorldManagerProps {
  locations: Location[];
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  currentChapter: Chapter;
  chapters: Chapter[];
}

export const WorldManager: React.FC<WorldManagerProps> = ({ locations, setLocations, currentChapter, chapters }) => {
  const [newLocName, setNewLocName] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const addLocation = () => {
    if (!newLocName.trim()) return;
    const loc: Location = {
      id: crypto.randomUUID(),
      name: newLocName,
      description: 'A place of mystery...',
      atmosphere: 'Neutral',
      history: []
    };
    setLocations([...locations, loc]);
    setNewLocName('');
  };

  const updateLocation = (id: string, field: keyof Location, value: string) => {
    setLocations(locations.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleScanChapter = async () => {
      if (!currentChapter.content.trim()) return;
      setIsScanning(true);
      try {
          const events = await extractWorldEventsFromText(currentChapter.content, locations);
          let updatedLocations = [...locations];

          events.forEach(evt => {
              let locIndex = updatedLocations.findIndex(l => l.name.toLowerCase() === evt.locationName.toLowerCase());
              
              if (locIndex === -1 && evt.isNewLocation) {
                  // Create new
                  const newLoc: Location = {
                      id: crypto.randomUUID(),
                      name: evt.locationName,
                      description: 'Auto-detected location.',
                      atmosphere: 'Unknown',
                      firstAppearanceChapterId: currentChapter.id,
                      history: []
                  };
                  updatedLocations.push(newLoc);
                  locIndex = updatedLocations.length - 1;
              }

              if (locIndex !== -1) {
                  // Add history event
                  updatedLocations[locIndex].history.push({
                      id: crypto.randomUUID(),
                      chapterId: currentChapter.id,
                      description: evt.eventDescription
                  });
              }
          });

          setLocations(updatedLocations);
      } catch (e) {
          alert("Scan failed");
      } finally {
          setIsScanning(false);
      }
  };

  const getChapterName = (id: string) => chapters.find(c => c.id === id)?.title || 'Unknown Chapter';

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
           <h2 className="text-3xl font-bold text-main">World Building</h2>
           <p className="text-muted mt-2">Map out locations. Track events per chapter.</p>
        </div>
        <button 
            onClick={handleScanChapter}
            disabled={isScanning}
            className="bg-accent-dim border border-accent/50 hover:bg-accent/20 text-accent px-4 py-2 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
        >
            {isScanning ? <Loader2 size={18} className="animate-spin" /> : <ScanSearch size={18} />}
            Scan Events in "{currentChapter.title}"
        </button>
      </div>

      <div className="flex gap-4 mb-8">
        <input
          type="text"
          value={newLocName}
          onChange={(e) => setNewLocName(e.target.value)}
          placeholder="New Location Name..."
          className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-main focus:ring-2 focus:ring-accent outline-none placeholder-muted"
          onKeyDown={(e) => e.key === 'Enter' && addLocation()}
        />
        <button
          onClick={addLocation}
          className="bg-accent hover:brightness-110 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2"
        >
          <Plus size={18} />
          Add Location
        </button>
      </div>

      <div className="space-y-4">
        {locations.map(loc => (
          <div key={loc.id} className="bg-card border border-border rounded-xl p-6">
            <div className="flex gap-6 mb-6">
                <div className="bg-surface w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 text-accent">
                <MapPin size={24} />
                </div>
                
                <div className="flex-1 space-y-4">
                <div className="flex justify-between items-start">
                    <input 
                        value={loc.name}
                        onChange={(e) => updateLocation(loc.id, 'name', e.target.value)}
                        className="bg-transparent text-xl font-bold text-main border-b border-transparent hover:border-border focus:border-accent outline-none"
                    />
                    <button 
                        onClick={() => setLocations(locations.filter(l => l.id !== loc.id))}
                        className="text-muted hover:text-red-400"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                    <label className="text-xs text-muted uppercase font-bold tracking-wider mb-1 block">Description</label>
                    <textarea
                        value={loc.description}
                        onChange={(e) => updateLocation(loc.id, 'description', e.target.value)}
                        className="w-full bg-surface/50 border border-border rounded-lg p-3 text-sm text-main focus:ring-1 focus:ring-accent outline-none h-24 resize-none placeholder-muted"
                    />
                    </div>
                    <div>
                    <label className="text-xs text-muted uppercase font-bold tracking-wider mb-1 block">Atmosphere</label>
                    <input
                        value={loc.atmosphere}
                        onChange={(e) => updateLocation(loc.id, 'atmosphere', e.target.value)}
                        className="w-full bg-surface/50 border border-border rounded-lg p-3 text-sm text-main focus:ring-1 focus:ring-accent outline-none placeholder-muted"
                    />
                    </div>
                </div>
                </div>
            </div>

            {/* History Section */}
            <div className="bg-surface/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-muted mb-3 flex items-center gap-2">
                    <BookOpen size={14} /> Location History
                </h4>
                {loc.history.length === 0 ? (
                    <p className="text-xs text-muted italic">No events recorded yet. Write in chapters and scan to populate.</p>
                ) : (
                    <div className="space-y-3">
                        {loc.history.map((evt, idx) => (
                            <div key={idx} className="flex gap-3 text-sm">
                                <span className="text-accent whitespace-nowrap text-xs font-mono py-1 px-2 bg-accent-dim rounded h-fit">
                                    {getChapterName(evt.chapterId)}
                                </span>
                                <p className="text-main opacity-90">{evt.description}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};