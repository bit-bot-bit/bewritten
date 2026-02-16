import { apiPost } from './apiClient';

export async function checkContinuity(storyText, characters, locations, plotPoints) {
  const data = await apiPost('/ai/continuity', { storyText, characters, locations, plotPoints });
  return data.results || [];
}

export async function generateCharacterProfile(description) {
  const data = await apiPost('/ai/character-profile', { description });
  return data.profile || {};
}

export async function suggestNextPlotPoint(currentPoints, storySummary) {
  const data = await apiPost('/ai/plot-suggestion', { currentPoints, storySummary });
  return data.plotPoint || {};
}

export async function extractCharactersFromText(text, existingCharacters) {
  const data = await apiPost('/ai/extract-characters', { text, existingCharacters });
  return data || { newCharacters: [], updates: [] };
}

export async function extractWorldEventsFromText(text, existingLocations) {
  const data = await apiPost('/ai/extract-world', { text, existingLocations });
  return data.worldEvents || [];
}

export async function extractPlotPointsFromText(text) {
  const data = await apiPost('/ai/extract-plot', { text });
  return data.plotPoints || [];
}

export async function estimatePlotConsensus(text, existingPlotPoints = [], chapterTitle = 'Current Chapter') {
  const data = await apiPost('/ai/plot-consensus', { text, existingPlotPoints, chapterTitle });
  return {
    runs: Array.isArray(data?.runs) ? data.runs : [[], [], []],
    consensus: Array.isArray(data?.consensus) ? data.consensus : [],
  };
}

export async function chatWithBible(query, state) {
  const data = await apiPost('/ai/chat', { query, state, storyId: state?.id || null });
  return data.reply || '';
}

export async function generateBookLayoutCSS(styleRequest) {
  const data = await apiPost('/ai/layout-css', { styleRequest });
  return data.css || '';
}

export async function generateStoryBlurb(story) {
  const data = await apiPost('/ai/blurb', { story, storyId: story?.id || null });
  return data.blurb || '';
}
