export enum AppTab {
  STORIES = 'stories',
  WRITE = 'write',
  CHARACTERS = 'characters',
  WORLD = 'world',
  PLOT = 'plot',
  SETTINGS = 'settings'
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  order: number;
}

export interface Character {
  id: string;
  name: string;
  role: string; // Protagonist, Antagonist, Support
  description: string;
  traits: string[];
  relationships: { targetId: string; type: string }[];
}

export interface LocationEvent {
  id: string;
  chapterId: string;
  description: string;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  atmosphere: string;
  history: LocationEvent[];
  firstAppearanceChapterId?: string;
}

export interface PlotPoint {
  id: string;
  title: string;
  description: string;
  order: number;
  tensionLevel: number; // 1-10
  involvedCharacterIds: string[];
  chapterId?: string;
}

export interface PlotEstimatePoint {
  title: string;
  description: string;
  tensionLevel: number;
}

export interface PlotEstimateResponse {
  runs: PlotEstimatePoint[][];
  consensus: PlotEstimatePoint[];
}

export interface StoryPlotConsensusCache {
  byChapter: Record<string, PlotEstimateResponse>;
  all: PlotEstimateResponse;
}

export interface StorySnapshot {
  title: string;
  chapters: Chapter[];
  currentChapterId: string;
  characters: Character[];
  locations: Location[];
  plotPoints: PlotPoint[];
  plotConsensusCache?: StoryPlotConsensusCache;
  aiInsights?: {
    synopsis?: string;
    backCover?: string;
    detailedNotes?: string;
  };
  genre?: string;
  aiReviews?: Array<{
    id: string;
    createdAt: string;
    genre: string;
    verdict: string;
    criticalReview: string;
    priorityFixes: string[];
    riskScore: number;
  }>;
  storyNotes?: string;
}

export interface StoryVersion {
  id: string;
  name: string;
  createdAt: string;
  snapshot: StorySnapshot;
}

export interface StoryState {
  id: string;
  title: string;
  chapters: Chapter[];
  currentChapterId: string;
  characters: Character[];
  locations: Location[];
  plotPoints: PlotPoint[];
  plotConsensusCache?: StoryPlotConsensusCache;
  aiInsights?: {
    synopsis?: string;
    backCover?: string;
    detailedNotes?: string;
  };
  storyNotes?: string;
  preservedVersions?: StoryVersion[];
  genre?: string;
  aiReviews?: Array<{
    id: string;
    createdAt: string;
    genre: string;
    verdict: string;
    criticalReview: string;
    priorityFixes: string[];
    riskScore: number;
  }>;
}

export interface AnalysisResult {
  type: 'continuity' | 'suggestion' | 'check';
  message: string;
  details?: string[];
  severity?: 'info' | 'warning' | 'error';
}

export type ThemeId = 'nexus' | 'grimm' | 'nebula' | 'solstice' | 'fjord';

export interface Theme {
  id: ThemeId;
  name: string;
  colors: {
    bg: string;
    surface: string;
    card: string;
    border: string;
    textMain: string;
    textMuted: string;
    accent: string;
    accentDim: string;
  };
}

export type ExportFormat = 'html' | 'md' | 'txt';

export interface BookFormat {
  id: string;
  name: string;
  width: string; // CSS width
  heightPx: number; // Approximate height in pixels for visualization (96DPI)
  pageCss: string; // @page rule
}
