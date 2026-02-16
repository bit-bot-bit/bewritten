import React, { useState } from 'react';
import { PlotPoint, Character, Chapter, Theme } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Plus, Trash2, Zap, ScanSearch, Loader2 } from 'lucide-react';
import { suggestNextPlotPoint, extractPlotPointsFromText } from '../services/geminiService';

interface TimelineManagerProps {
  plotPoints: PlotPoint[];
  setPlotPoints: React.Dispatch<React.SetStateAction<PlotPoint[]>>;
  characters: Character[];
  currentChapter: Chapter;
  currentTheme: Theme;
}

export const TimelineManager: React.FC<TimelineManagerProps> = ({ plotPoints, setPlotPoints, characters, currentChapter, currentTheme }) => {
  const [isScanning, setIsScanning] = useState(false);

  const addPoint = () => {
    const newPoint: PlotPoint = {
      id: crypto.randomUUID(),
      title: 'New Plot Point',
      description: 'Describe what happens...',
      order: plotPoints.length + 1,
      tensionLevel: 5,
      involvedCharacterIds: [],
      chapterId: currentChapter.id
    };
    setPlotPoints([...plotPoints, newPoint]);
  };

  const handleSuggest = async () => {
     try {
         const suggestion = await suggestNextPlotPoint(plotPoints, currentChapter.content.substring(0, 1000));
         const newPoint: PlotPoint = {
             id: crypto.randomUUID(),
             title: suggestion.title || 'AI Suggestion',
             description: suggestion.description || '...',
             order: plotPoints.length + 1,
             tensionLevel: suggestion.tensionLevel || 5,
             involvedCharacterIds: [],
             chapterId: currentChapter.id
         };
         setPlotPoints([...plotPoints, newPoint]);
     } catch (e) {
         const message = e instanceof Error ? e.message : 'Could not generate suggestion';
         alert(message);
     }
  };

  const handleScan = async () => {
      if (!currentChapter.content.trim()) return;
      setIsScanning(true);
      try {
          const points = await extractPlotPointsFromText(currentChapter.content);
          const newPoints = points.map((p, idx) => ({
              id: crypto.randomUUID(),
              title: p.title || 'Untitled Event',
              description: p.description || '',
              tensionLevel: p.tensionLevel || 5,
              order: plotPoints.length + idx + 1,
              involvedCharacterIds: [],
              chapterId: currentChapter.id
          }));
          setPlotPoints([...plotPoints, ...newPoints]);
      } catch (e) {
          const message = e instanceof Error ? e.message : 'Failed to scan for plot points';
          alert(message);
      } finally {
          setIsScanning(false);
      }
  };

  const updatePoint = (id: string, updates: Partial<PlotPoint>) => {
    setPlotPoints(plotPoints.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePoint = (id: string) => {
    setPlotPoints(plotPoints.filter(p => p.id !== id));
  };

  const sortedPoints = [...plotPoints].sort((a, b) => a.order - b.order);

  const chartData = sortedPoints.map((p, index) => ({
    name: index + 1, 
    tension: p.tensionLevel,
    title: p.title
  }));

  // Use accent color from theme for chart
  const accentColor = currentTheme.colors.accent;
  const gridColor = currentTheme.colors.border;
  const textColor = currentTheme.colors.textMuted;
  const tooltipBg = currentTheme.colors.card;

  return (
    <div className="flex h-full">
        {/* Left: List */}
        <div className="w-1/2 p-8 overflow-y-auto border-r border-border">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-main">Plot Outline</h2>
                    <p className="text-xs text-muted mt-1">Events extracted from story or added manually</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleScan} 
                        disabled={isScanning}
                        className="p-2 bg-accent-dim text-accent rounded-lg hover:bg-accent/20 transition-colors border border-accent/30 disabled:opacity-50" 
                        title="Scan Chapter for Plot Points"
                    >
                        {isScanning ? <Loader2 size={20} className="animate-spin"/> : <ScanSearch size={20} />}
                    </button>
                    <button onClick={handleSuggest} className="p-2 bg-purple-900/50 text-purple-400 rounded-lg hover:bg-purple-900 hover:text-white transition-colors border border-purple-500/30" title="AI Suggest Next">
                        <Zap size={20} />
                    </button>
                    <button onClick={addPoint} className="p-2 bg-card text-main rounded-lg hover:bg-surface transition-colors border border-border">
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {sortedPoints.map((point, index) => (
                    <div key={point.id} className="bg-card border border-border rounded-lg p-4 group">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-muted font-mono text-sm">#{index + 1}</span>
                            <input 
                                value={point.title}
                                onChange={(e) => updatePoint(point.id, { title: e.target.value })}
                                className="themed-control flex-1 font-semibold text-main focus:text-accent outline-none px-2 py-1 rounded border border-transparent"
                                style={{ color: 'var(--color-text-main)', caretColor: 'var(--color-text-main)' }}
                            />
                            <button onClick={() => deletePoint(point.id)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400">
                                <Trash2 size={16} />
                            </button>
                        </div>
                        <textarea 
                            value={point.description}
                            onChange={(e) => updatePoint(point.id, { description: e.target.value })}
                            className="themed-control w-full rounded p-2 text-sm text-main mb-3 outline-none resize-none h-20 border"
                            style={{ color: 'var(--color-text-main)', caretColor: 'var(--color-text-main)' }}
                        />
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-muted">Tension</label>
                                <input 
                                    type="range" 
                                    min="1" max="10" 
                                    value={point.tensionLevel}
                                    onChange={(e) => updatePoint(point.id, { tensionLevel: parseInt(e.target.value) })}
                                    className="w-24 h-1 bg-surface rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-xs font-mono text-accent">{point.tensionLevel}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Right: Visualization */}
        <div className="w-1/2 p-8 bg-surface/50 flex flex-col">
            <h3 className="text-xl font-bold text-main mb-6">Tension Arc</h3>
            <div className="flex-1 min-h-[300px] w-full bg-card/20 rounded-2xl border border-border p-4">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="name" stroke={textColor} />
                        <YAxis stroke={textColor} domain={[0, 10]} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: tooltipBg, borderColor: gridColor, color: textColor }}
                            itemStyle={{ color: accentColor }}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="tension" 
                            stroke={accentColor} 
                            strokeWidth={3}
                            dot={{ fill: accentColor, strokeWidth: 2 }}
                            activeDot={{ r: 8 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            
            <div className="mt-8 p-6 bg-card/40 rounded-xl border border-border">
                <h4 className="font-semibold text-main mb-2">Plot Tracker</h4>
                <p className="text-sm text-muted">
                    Use the scan button to automatically pull plot points from your written chapters.
                    This helps visualize if your story's pacing matches your intended arc.
                </p>
            </div>
        </div>
    </div>
  );
};
