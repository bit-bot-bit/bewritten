import crypto from 'node:crypto';
import { getDb } from './db.js';

function nowIso() {
  return new Date().toISOString();
}

function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function listStoriesByUser(email) {
  const db = getDb();
  const rows = await db('stories')
    .select('id', 'title', 'updated_at', 'created_at')
    .where('user_email', email)
    .orderBy('updated_at', 'desc');

  // Return lightweight metadata only.
  // The frontend will need to fetch the full story content individually.
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
  }));
}

export async function getStoryById(email, storyId) {
  const db = getDb();
  const row = await db('stories')
    .select('payload_json')
    .where({ user_email: email, id: storyId })
    .first();

  if (!row) return null;
  try {
    return JSON.parse(row.payload_json);
  } catch {
    return null;
  }
}

export async function createStory(email, story) {
  const db = getDb();
  const payloadJson = JSON.stringify(story);
  const payloadHash = hashPayload(story);
  const now = nowIso();

  await db('stories').insert({
    id: story.id,
    user_email: email,
    title: story.title || 'Untitled Story',
    payload_json: payloadJson,
    payload_hash: payloadHash,
    version: 1,
    created_at: now,
    updated_at: now,
  });

  await db('story_versions').insert({
    story_id: story.id,
    user_email: email,
    version: 1,
    payload_hash: payloadHash,
    payload_json: payloadJson,
    created_at: now,
  });

  return story;
}

export async function saveStory(email, story) {
  const db = getDb();
  const payloadJson = JSON.stringify(story);
  const payloadHash = hashPayload(story);
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const existing = await db('stories')
      .select('version', 'payload_hash')
      .where({ id: story.id, user_email: email })
      .first();

    if (!existing) throw new Error('Story not found');
    if (existing.payload_hash === payloadHash) return story;

    const currentVersion = Number(existing.version || 1);
    const nextVersion = currentVersion + 1;
    const now = nowIso();

    const updatedRows = await db('stories')
      .where({ id: story.id, user_email: email, version: currentVersion })
      .update({
        title: story.title || 'Untitled Story',
        payload_json: payloadJson,
        payload_hash: payloadHash,
        version: nextVersion,
        updated_at: now,
      });

    if (updatedRows === 0) {
      if (attempt === maxAttempts) throw new Error('Story update conflict. Please retry.');
      continue;
    }

    await db('story_versions').insert({
      story_id: story.id,
      user_email: email,
      version: nextVersion,
      payload_hash: payloadHash,
      payload_json: payloadJson,
      created_at: now,
    });

    return story;
  }

  throw new Error('Story update conflict. Please retry.');
}

export async function syncStories(email, stories) {
  let saved = 0;
  let unchanged = 0;

  // For sync, we still need to check existence.
  // Optimization: Fetch only IDs and hashes to compare.
  const db = getDb();
  const existingRows = await db('stories')
    .select('id', 'payload_hash')
    .where('user_email', email);

  const existingMap = new Map(existingRows.map((r) => [r.id, r.payload_hash]));

  for (const story of stories) {
    if (!story?.id) continue;

    if (!existingMap.has(story.id)) {
      await createStory(email, story);
      saved += 1;
      continue;
    }

    const currentHash = existingMap.get(story.id);
    const nextHash = hashPayload(story);
    if (currentHash === nextHash) {
      unchanged += 1;
      continue;
    }

    await saveStory(email, story);
    saved += 1;
  }

  return { saved, unchanged };
}

export async function deleteStory(email, storyId) {
  const db = getDb();
  const deleted = await db.transaction(async (trx) => {
    await trx('story_versions').where({ story_id: storyId, user_email: email }).del();
    return await trx('stories').where({ id: storyId, user_email: email }).del();
  });
  return deleted > 0;
}

export async function recordAiRun({ storyId = null, actorEmail = null, task, status, model = null, errorMessage = null }) {
  const db = getDb();
  try {
    await db('ai_runs').insert({
      story_id: storyId,
      actor_email: actorEmail,
      task,
      model,
      status,
      error_message: errorMessage,
      created_at: nowIso(),
    });
  } catch (e) {
    console.error('Failed to record AI run', e);
  }
}
