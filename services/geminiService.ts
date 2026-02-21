import { apiPost } from './apiClient';

export interface AiService {
  checkContinuity(storyText: string, characters: any[], locations: any[], plotPoints: any[]): Promise<any>;
  generateCharacterProfile(description: string): Promise<any>;
  suggestNextPlotPoint(currentPoints: any[], storySummary: string): Promise<any>;
  extractCharactersFromText(text: string, existingCharacters: any[]): Promise<any>;
  extractWorldEventsFromText(text: string, existingLocations: any[]): Promise<any>;
  extractPlotPointsFromText(text: string): Promise<any>;
  estimatePlotConsensus(text: string, existingPlotPoints?: any[], chapterTitle?: string): Promise<any>;
  chatWithBible(query: string, state: any): Promise<string>;
  generateBookLayoutCSS(styleRequest: string): Promise<string>;
  generateStoryBlurb(story: any): Promise<string>;
  generateStoryInsights(story: any, focus?: string): Promise<any>;
  generateStoryReview(story: any, genre?: string): Promise<any>;
  importStoryFromText(text: string): Promise<any>;
}

export class RestAiService implements AiService {
  async checkContinuity(storyText, characters, locations, plotPoints) {
    const data = await apiPost('/ai/continuity', { storyText, characters, locations, plotPoints });
    return data.results || [];
  }

  async generateCharacterProfile(description) {
    const data = await apiPost('/ai/character-profile', { description });
    return data.profile || {};
  }

  async suggestNextPlotPoint(currentPoints, storySummary) {
    const data = await apiPost('/ai/plot-suggestion', { currentPoints, storySummary });
    return data.plotPoint || {};
  }

  async extractCharactersFromText(text, existingCharacters) {
    const data = await apiPost('/ai/extract-characters', { text, existingCharacters });
    return data || { newCharacters: [], updates: [] };
  }

  async extractWorldEventsFromText(text, existingLocations) {
    const data = await apiPost('/ai/extract-world', { text, existingLocations });
    return data.worldEvents || [];
  }

  async extractPlotPointsFromText(text) {
    const data = await apiPost('/ai/extract-plot', { text });
    return data.plotPoints || [];
  }

  async estimatePlotConsensus(text, existingPlotPoints = [], chapterTitle = 'Current Chapter') {
    const data = await apiPost('/ai/plot-consensus', { text, existingPlotPoints, chapterTitle });
    return {
      runs: Array.isArray(data?.runs) ? data.runs : [[], [], []],
      consensus: Array.isArray(data?.consensus) ? data.consensus : [],
    };
  }

  async chatWithBible(query, state) {
    const data = await apiPost('/ai/chat', { query, state, storyId: state?.id || null });
    return data.reply || '';
  }

  async generateBookLayoutCSS(styleRequest) {
    const data = await apiPost('/ai/layout-css', { styleRequest });
    return data.css || '';
  }

  async generateStoryBlurb(story) {
    const data = await apiPost('/ai/blurb', { story, storyId: story?.id || null });
    return data.blurb || '';
  }

  async generateStoryInsights(story, focus = 'all') {
    const data = await apiPost('/ai/story-insights', { story, focus, storyId: story?.id || null });
    return data.insights || {
      synopsis: '',
      backCover: '',
    };
  }

  async generateStoryReview(story, genre = '') {
    const data = await apiPost('/ai/story-review', { story, genre, storyId: story?.id || null });
    return data.review || {
      verdict: '',
      criticalReview: '',
      priorityFixes: [],
      riskScore: 0,
    };
  }

  async importStoryFromText(text) {
    const data = await apiPost('/ai/import-story', { text });
    return data.story || {
      title: 'Imported Story',
      chapters: [{ title: 'Chapter 1', content: text, order: 1 }],
    };
  }
}

let currentAiService: AiService = new RestAiService();

export function setAiService(service: AiService) {
  currentAiService = service;
}

export function getAiService(): AiService {
  return currentAiService;
}

// Proxy exports
export function checkContinuity(storyText, characters, locations, plotPoints) {
  return currentAiService.checkContinuity(storyText, characters, locations, plotPoints);
}

export function generateCharacterProfile(description) {
  return currentAiService.generateCharacterProfile(description);
}

export function suggestNextPlotPoint(currentPoints, storySummary) {
  return currentAiService.suggestNextPlotPoint(currentPoints, storySummary);
}

export function extractCharactersFromText(text, existingCharacters) {
  return currentAiService.extractCharactersFromText(text, existingCharacters);
}

export function extractWorldEventsFromText(text, existingLocations) {
  return currentAiService.extractWorldEventsFromText(text, existingLocations);
}

export function extractPlotPointsFromText(text) {
  return currentAiService.extractPlotPointsFromText(text);
}

export function estimatePlotConsensus(text, existingPlotPoints, chapterTitle) {
  return currentAiService.estimatePlotConsensus(text, existingPlotPoints, chapterTitle);
}

export function chatWithBible(query, state) {
  return currentAiService.chatWithBible(query, state);
}

export function generateBookLayoutCSS(styleRequest) {
  return currentAiService.generateBookLayoutCSS(styleRequest);
}

export function generateStoryBlurb(story) {
  return currentAiService.generateStoryBlurb(story);
}

export function generateStoryInsights(story, focus) {
  return currentAiService.generateStoryInsights(story, focus);
}

export function generateStoryReview(story, genre) {
  return currentAiService.generateStoryReview(story, genre);
}

export function importStoryFromText(text) {
  return currentAiService.importStoryFromText(text);
}
