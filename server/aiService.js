import { GoogleGenAI, Type } from '@google/genai';
import { getUserAiSettings } from './userSettings.js';

const MODEL_FAST = process.env.BEWRITTEN_AI_MODEL || 'gemini-2.5-flash';

function getRuntimeSettings(actorEmail) {
  const user = actorEmail ? getUserAiSettings(actorEmail, { includeSecret: true }) : null;
  const aiTarget = user?.aiTarget || 'gemini';
  return {
    aiTarget,
    aiApiKey: user?.aiApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY || '',
    aiModel: user?.aiModel || MODEL_FAST,
    aiBaseUrl: user?.aiBaseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  };
}

function getClient(apiKey) {
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');
  return new GoogleGenAI({ apiKey });
}

function safeJson(text, fallback) {
  try {
    return JSON.parse(text || '');
  } catch {
    return fallback;
  }
}

async function runOpenAiCompatibleJson({ prompt, fallback, runtime }) {
  if (!runtime.aiApiKey) return fallback;

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

  if (!resp.ok) return fallback;
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return safeJson(text, fallback);
}

async function runOpenAiCompatibleText({ prompt, fallback, runtime }) {
  if (!runtime.aiApiKey) return fallback;

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

  if (!resp.ok) return fallback;
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return (text || fallback || '').replace(/```css/gi, '').replace(/```/g, '').trim();
}

export async function runJsonPrompt({ prompt, schema, fallback, actorEmail = null }) {
  const runtime = getRuntimeSettings(actorEmail);
  if (runtime.aiTarget === 'disabled') return fallback;

  if (runtime.aiTarget === 'openai_compatible') {
    return runOpenAiCompatibleJson({ prompt, fallback, runtime });
  }

  if (!runtime.aiApiKey) return fallback;

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
  const runtime = getRuntimeSettings(actorEmail);
  if (runtime.aiTarget === 'disabled') return fallback;

  if (runtime.aiTarget === 'openai_compatible') {
    return runOpenAiCompatibleText({ prompt, fallback, runtime });
  }

  if (!runtime.aiApiKey) return fallback;

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
};
