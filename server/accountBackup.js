import crypto from 'node:crypto';
import { getDb } from './db.js';
import { listStoriesByUser, syncStories } from './storyStore.js';

const BACKUP_FORMAT = 'bewritten.account-backup';
const CURRENT_FORMAT_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function checksumForPayload(payload) {
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function asString(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toInt(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.round(num);
}

function sanitizeStory(story, index = 0) {
  const baseId = asString(story?.id, `restored-story-${index + 1}`);
  const chapters = asArray(story?.chapters)
    .map((chapter, chapterIndex) => ({
      id: asString(chapter?.id, `${baseId}-chapter-${chapterIndex + 1}`),
      title: asString(chapter?.title, `Chapter ${chapterIndex + 1}`),
      content: String(chapter?.content ?? ''),
      order: Math.max(1, toInt(chapter?.order, chapterIndex + 1)),
    }))
    .sort((a, b) => a.order - b.order);

  const safeChapters = chapters.length > 0
    ? chapters
    : [{ id: `${baseId}-chapter-1`, title: 'Chapter 1', content: '', order: 1 }];

  const firstChapterId = safeChapters[0].id;
  const currentChapterId = asString(story?.currentChapterId, firstChapterId);
  const chapterIds = new Set(safeChapters.map((c) => c.id));

  return {
    id: baseId,
    title: asString(story?.title, `Recovered Story ${index + 1}`),
    chapters: safeChapters,
    currentChapterId: chapterIds.has(currentChapterId) ? currentChapterId : firstChapterId,
    characters: asArray(story?.characters),
    locations: asArray(story?.locations),
    plotPoints: asArray(story?.plotPoints),
  };
}

function migrateBackup(raw) {
  const version = Number(raw?.formatVersion || 1);
  if (version > CURRENT_FORMAT_VERSION) {
    throw new Error(`Backup format version ${version} is newer than this server supports.`);
  }

  // Placeholder migration chain for future versions.
  if (version <= 1) return raw;
  return raw;
}

export async function buildAccountBackup(email) {
  const db = getDb();
  const stories = await listStoriesByUser(email);
  const userSettings = await db('user_settings')
    .select('ai_target', 'ai_model', 'ai_base_url')
    .where('user_email', email)
    .first();
  const user = await db('users').select('tier').where('email', email).first();

  const payload = {
    stories,
    preferences: {
      tier: asString(user?.tier, 'byok'),
      aiTarget: asString(userSettings?.ai_target, 'gemini'),
      aiModel: asString(userSettings?.ai_model, ''),
      aiBaseUrl: asString(userSettings?.ai_base_url, ''),
    },
  };

  return {
    format: BACKUP_FORMAT,
    formatVersion: CURRENT_FORMAT_VERSION,
    createdAt: nowIso(),
    app: {
      name: 'bewritten',
    },
    account: {
      email,
    },
    payload,
    checksum: checksumForPayload(payload),
  };
}

export function validateAndNormalizeBackup(backup) {
  if (!backup || typeof backup !== 'object') throw new Error('Backup payload is required');
  if (backup.format !== BACKUP_FORMAT) throw new Error('Unsupported backup format');

  const migrated = migrateBackup(backup);
  const payload = migrated?.payload;
  if (!payload || typeof payload !== 'object') throw new Error('Backup payload is invalid');

  const checksum = asString(migrated.checksum);
  const expected = checksumForPayload(payload);
  if (!checksum || checksum !== expected) throw new Error('Backup checksum validation failed');

  const stories = asArray(payload.stories).map((story, idx) => sanitizeStory(story, idx));
  const uniqueStories = [];
  const seen = new Set();
  for (const story of stories) {
    if (seen.has(story.id)) continue;
    seen.add(story.id);
    uniqueStories.push(story);
  }

  return {
    stories: uniqueStories,
    preferences: {
      tier: asString(payload?.preferences?.tier, ''),
      aiTarget: asString(payload?.preferences?.aiTarget, ''),
      aiModel: asString(payload?.preferences?.aiModel, ''),
      aiBaseUrl: asString(payload?.preferences?.aiBaseUrl, ''),
    },
  };
}

export async function restoreAccountBackup(email, backup, mode = 'merge') {
  const db = getDb();
  const normalizedMode = mode === 'replace' ? 'replace' : 'merge';
  const normalized = validateAndNormalizeBackup(backup);
  const stories = normalized.stories;

  if (normalizedMode === 'replace') {
    await db.transaction(async (trx) => {
      await trx('story_versions').where('user_email', email).del();
      await trx('stories').where('user_email', email).del();
    });
  }

  if (stories.length > 0) {
    await syncStories(email, stories);
  }

  const aiTarget = normalized.preferences.aiTarget;
  const aiModel = normalized.preferences.aiModel;
  const aiBaseUrl = normalized.preferences.aiBaseUrl;
  if (aiTarget || aiModel || aiBaseUrl) {
    const row = await db('user_settings').select('ai_api_key').where('user_email', email).first();
    const existingEncryptedKey = asString(row?.ai_api_key, '');
    await db('user_settings')
      .insert({
        user_email: email,
        ai_target: aiTarget || 'gemini',
        ai_api_key: existingEncryptedKey,
        ai_model: aiModel,
        ai_base_url: aiBaseUrl,
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      .onConflict('user_email')
      .merge({
        ai_target: aiTarget || 'gemini',
        ai_api_key: existingEncryptedKey,
        ai_model: aiModel,
        ai_base_url: aiBaseUrl,
        updated_at: nowIso(),
      });
  }

  return {
    restoredStories: stories.length,
    mode: normalizedMode,
  };
}

