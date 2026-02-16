import React, { useState } from 'react';
import { PlotPoint, Character, Chapter, Theme } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Plus, Trash2, Zap, ScanSearch, Loader2, BrainCircuit, Layers3 } from 'lucide-react';
import { suggestNextPlotPoint, extractPlotPointsFromText, estimatePlotConsensus } from '../services/geminiService';

interface TimelineManagerProps {
  plotPoints: PlotPoint[];
  setPlotPoints: React.Dispatch<React.SetStateAction<PlotPoint[]>>;
  characters: Character[];
  currentChapter: Chapter;
  currentTheme: Theme;
  chapters: Chapter[];
}

type PlotEstimatePoint = {
  title: string;
  description: string;
  tensionLevel: number;
};

type PlotEstimateResponse = {
  runs: PlotEstimatePoint[][];
  consensus: PlotEstimatePoint[];
};

type RunView = 'consensus' | 'run1' | 'run2' | 'run3';
type ScopeView = 'chapter' | 'all';

const RUN_LABELS: Record<RunView, string> = {
  consensus: 'Consensus',
  run1: 'Run 1',
  run2: 'Run 2',
  run3: 'Run 3',
};

const getEstimateByView = (data: PlotEstimateResponse, runView: RunView) => {
  if (runView === 'run1') return data.runs[0] || [];
  if (runView === 'run2') return data.runs[1] || [];
  if (runView === 'run3') return data.runs[2] || [];
  return data.consensus || [];
};

const clampTension = (value: number) => Math.max(1, Math.min(10, Number(value || 5)));

export const TimelineManager: React.FC<TimelineManagerProps> = ({ plotPoints, setPlotPoints, characters, currentChapter, currentTheme, chapters }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [runView, setRunView] = useState<RunView>('consensus');
  const [scopeView, setScopeView] = useState<ScopeView>('chapter');
  const [chapterEstimate, setChapterEstimate] = useState<PlotEstimateResponse>({ runs: [[], [], []], consensus: [] });
  const [allEstimate, setAllEstimate] = useState<PlotEstimateResponse>({ runs: [[], [], []], consensus: [] });

  const pointsForChapter = plotPoints.filter((p) => (p.chapterId || '') === currentChapter.id);
  const listPoints = pointsForChapter.sort((a, b) => a.order - b.order);

  const addPoint = () => {
    const newPoint: PlotPoint = {
      id: crypto.randomUUID(),
      title: 'New Plot Point',
      description: 'Describe what happens...',
      order: listPoints.length + 1,
      tensionLevel: 5,
      involvedCharacterIds: [],
      chapterId: currentChapter.id
    };
    setPlotPoints([...plotPoints, newPoint]);
  };

  const handleSuggest = async () => {
     try {
         const suggestion = await suggestNextPlotPoint(pointsForChapter, currentChapter.content.substring(0, 1000));
         const newPoint: PlotPoint = {
             id: crypto.randomUUID(),
             title: suggestion.title || 'AI Suggestion',
             description: suggestion.description || '...',
             order: listPoints.length + 1,
             tensionLevel: clampTension(suggestion.tensionLevel),
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
              tensionLevel: clampTension(p.tensionLevel),
              order: listPoints.length + idx + 1,
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

  const runEstimate = async (nextScope: ScopeView) => {
    const isAll = nextScope === 'all';
    const runExistingPoints = isAll ? plotPoints : pointsForChapter;
    const text = isAll
      ? chapters
          .map((ch) => `[${ch.title}]\n${String(ch.content || '').trim()}`)
          .filter(Boolean)
          .join('\n\n')
      : currentChapter.content;
    const chapterTitle = isAll ? 'All Chapters' : currentChapter.title;
    if (!String(text || '').trim()) {
      alert(isAll ? 'No chapter content available yet.' : 'Current chapter is empty!');
      return;
    }

    setIsEstimating(true);
    try {
      const estimation = await estimatePlotConsensus(text, runExistingPoints, chapterTitle);
      if (isAll) setAllEstimate(estimation);
      else setChapterEstimate(estimation);
      setRunView('consensus');
      setScopeView(nextScope);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to estimate plot consensus';
      alert(message);
    } finally {
      setIsEstimating(false);
    }
  };

  const activeEstimate = scopeView === 'all' ? allEstimate : chapterEstimate;
  const estimatePoints = getEstimateByView(activeEstimate, runView);
  const hasEstimate = estimatePoints.length > 0;

  const chartData = hasEstimate
    ? estimatePoints.map((p, index) => ({
        index: index + 1,
        tension: clampTension(p.tensionLevel),
        title: p.title || `Beat ${index + 1}`,
      }))
    : listPoints.map((p, index) => ({
        index: index + 1,
        tension: p.tensionLevel,
        title: p.title,
      }));

  // Use accent color from theme for chart
  const accentColor = currentTheme.colors.accent;
  const gridColor = currentTheme.colors.border;
  const textColor = currentTheme.colors.textMuted;
  const tooltipBg = currentTheme.colors.card;

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-x-hidden">
        {/* Left: List */}
        <div className="w-full lg:w-1/2 p-4 md:p-8 overflow-y-auto border-b lg:border-b-0 lg:border-r border-border">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-main">Plot Outline</h2>
                    <p className="text-xs text-muted mt-1">Events extracted from story or added manually</p>
                </div>
                <div className="flex flex-wrap gap-2">
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
                {listPoints.map((point, index) => (
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
        <div className="w-full lg:w-1/2 p-4 md:p-8 bg-surface/50 flex flex-col">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-xl font-bold text-main">Tension Arc</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => runEstimate('chapter')}
                  disabled={isEstimating}
                  className="p-2 bg-accent-dim text-accent rounded-lg hover:bg-accent/20 transition-colors border border-accent/30 disabled:opacity-50"
                  title={`Estimate for ${currentChapter.title}`}
                >
                  {isEstimating && scopeView === 'chapter' ? <Loader2 size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
                </button>
                <button
                  onClick={() => runEstimate('all')}
                  disabled={isEstimating}
                  className="p-2 bg-accent-dim text-accent rounded-lg hover:bg-accent/20 transition-colors border border-accent/30 disabled:opacity-50"
                  title="Estimate for all chapters"
                >
                  {isEstimating && scopeView === 'all' ? <Loader2 size={18} className="animate-spin" /> : <Layers3 size={18} />}
                </button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {(['consensus', 'run1', 'run2', 'run3'] as RunView[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setRunView(key)}
                  disabled={!activeEstimate.consensus.length && !activeEstimate.runs.some((r) => r.length)}
                  className={`text-xs px-3 py-1 rounded-full border transition ${
                    runView === key ? 'bg-accent text-white border-accent' : 'bg-card text-muted border-border hover:text-main'
                  } disabled:opacity-50`}
                >
                  {RUN_LABELS[key]}
                </button>
              ))}
              <span className="text-xs text-muted self-center">
                Scope: {scopeView === 'all' ? 'All Chapters' : currentChapter.title}
              </span>
            </div>

            <div className="flex-1 min-h-[260px] md:min-h-[300px] w-full bg-card/20 rounded-2xl border border-border p-3 md:p-4">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis
                            dataKey="index"
                            stroke={textColor}
                            interval={0}
                            height={42}
                            label={{ value: 'Plot Point', position: 'insideBottom', offset: -4, fill: textColor }}
                        />
                        <YAxis
                            stroke={textColor}
                            domain={[0, 10]}
                            label={{ value: 'Tension', angle: -90, position: 'insideLeft', fill: textColor }}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: tooltipBg, borderColor: gridColor, color: textColor }}
                            itemStyle={{ color: accentColor }}
                            formatter={(value, _name, payload) => [value, payload?.payload?.title || 'Tension']}
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
                    Scan and suggest work on the selected chapter only. Use the brain buttons to run three AI estimations
                    and switch between consensus and individual runs.
                </p>
            </div>
        </div>
    </div>
  );
};
