import { GoogleGenAI, Type } from '@google/genai';
import { getUserAiSettings } from './userSettings.js';
import { resolveRuntimeForUser } from './monetization.js';

const MODEL_FAST = process.env.BEWRITTEN_AI_MODEL || 'gemini-2.5-flash';

async function getRuntimeSettings(actorEmail) {
  const fallbackRuntime = {
    aiTarget: 'gemini',
    aiApiKey: '',
    aiModel: MODEL_FAST,
    aiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  };
  if (!actorEmail) return fallbackRuntime;
  const user = await getUserAiSettings(actorEmail, { includeSecret: true });
  const byokRuntime = {
    aiTarget: user?.aiTarget || fallbackRuntime.aiTarget,
    aiApiKey: user?.aiApiKey || '',
    aiModel: user?.aiModel || fallbackRuntime.aiModel,
    aiBaseUrl: user?.aiBaseUrl || fallbackRuntime.aiBaseUrl,
  };
  return resolveRuntimeForUser(actorEmail, user, byokRuntime);
}

function getClient(apiKey) {
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');
  return new GoogleGenAI({ apiKey });
}

function safeJson(text, fallback) {
  const raw = String(text || '').trim();
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    // Handle common fenced code block output (```json ... ```).
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1]);
      } catch {}
    }

    // Fallback: attempt to parse the largest object/array slice.
    const firstBrace = raw.indexOf('{');
    const firstBracket = raw.indexOf('[');
    const starts = [firstBrace, firstBracket].filter((n) => n >= 0);
    if (starts.length === 0) return fallback;
    const start = Math.min(...starts);

    const lastBrace = raw.lastIndexOf('}');
    const lastBracket = raw.lastIndexOf(']');
    const end = Math.max(lastBrace, lastBracket);
    if (end <= start) return fallback;

    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return fallback;
    }
  }
}

async function runOpenAiCompatibleJson({ prompt, fallback, runtime }) {
  if (!runtime.aiApiKey) {
    throw new Error('No API key configured for OpenAI-compatible target.');
  }

  const payload = {
    model: runtime.aiModel || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Return only valid JSON matching the requested structure.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
  };

  const resp = await fetch(`${runtime.aiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${runtime.aiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`OpenAI-compatible API error ${resp.status}: ${body.slice(0, 400)}`);
  }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return safeJson(text, fallback);
}

async function runOpenAiCompatibleText({ prompt, fallback, runtime }) {
  if (!runtime.aiApiKey) {
    throw new Error('No API key configured for OpenAI-compatible target.');
  }

  const payload = {
    model: runtime.aiModel || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  };

  const resp = await fetch(`${runtime.aiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${runtime.aiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`OpenAI-compatible API error ${resp.status}: ${body.slice(0, 400)}`);
  }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return (text || fallback || '').replace(/```css/gi, '').replace(/```/g, '').trim();
}

export async function runJsonPrompt({ prompt, schema, fallback, actorEmail = null }) {
  const runtime = await getRuntimeSettings(actorEmail);
  if (runtime.aiTarget === 'disabled') return fallback;

  if (runtime.aiTarget === 'openai_compatible') {
    return runOpenAiCompatibleJson({ prompt, fallback, runtime });
  }

  if (!runtime.aiApiKey) {
    throw new Error('No API key configured for Gemini target.');
  }

  const ai = getClient(runtime.aiApiKey);
  const resp = await ai.models.generateContent({
    model: runtime.aiModel,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  });

  return safeJson(resp.text, fallback);
}

export async function runTextPrompt({ prompt, fallback, actorEmail = null }) {
  const runtime = await getRuntimeSettings(actorEmail);
  if (runtime.aiTarget === 'disabled') return fallback;

  if (runtime.aiTarget === 'openai_compatible') {
    return runOpenAiCompatibleText({ prompt, fallback, runtime });
  }

  if (!runtime.aiApiKey) {
    throw new Error('No API key configured for Gemini target.');
  }

  const ai = getClient(runtime.aiApiKey);
  const resp = await ai.models.generateContent({
    model: runtime.aiModel,
    contents: prompt,
  });

  return (resp.text || fallback || '').replace(/```css/gi, '').replace(/```/g, '').trim();
}

export const Schema = {
  continuity: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ['continuity', 'suggestion'] },
        message: { type: Type.STRING },
        details: { type: Type.ARRAY, items: { type: Type.STRING } },
        severity: { type: Type.STRING, enum: ['info', 'warning', 'error'] },
      },
    },
  },
  characterProfile: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      role: { type: Type.STRING, enum: ['Protagonist', 'Antagonist', 'Support'] },
      description: { type: Type.STRING },
      traits: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
  },
  plotPoint: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      tensionLevel: { type: Type.NUMBER },
    },
  },
  extractedCharacters: {
    type: Type.OBJECT,
    properties: {
      newCharacters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING },
            description: { type: Type.STRING },
            traits: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
      updates: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            descriptionUpdate: { type: Type.STRING },
          },
        },
      },
    },
  },
  worldEvents: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        locationName: { type: Type.STRING },
        eventDescription: { type: Type.STRING },
        isNewLocation: { type: Type.BOOLEAN },
      },
    },
  },
  plotList: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        tensionLevel: { type: Type.NUMBER },
      },
    },
  },
  storyInsights: {
    type: Type.OBJECT,
    properties: {
      synopsis: { type: Type.STRING },
      backCover: { type: Type.STRING },
    },
  },
  storyReview: {
    type: Type.OBJECT,
    properties: {
      verdict: { type: Type.STRING },
      criticalReview: { type: Type.STRING },
      priorityFixes: { type: Type.ARRAY, items: { type: Type.STRING } },
      riskScore: { type: Type.NUMBER },
    },
  },
  storyImport: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      chapters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            order: { type: Type.NUMBER },
          },
        },
      },
    },
  },
};
