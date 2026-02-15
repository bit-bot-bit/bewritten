import crypto from 'node:crypto';
import { getDb } from './db.js';

function nowIso() {
  return new Date().toISOString();
}

function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function listStoriesByUser(email) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT payload_json FROM stories WHERE user_email = ? ORDER BY updated_at DESC`
  ).all(email);

  return rows.map((r) => {
    try {
      return JSON.parse(r.payload_json);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

export function createStory(email, story) {
  const db = getDb();
  const payloadJson = JSON.stringify(story);
  const payloadHash = hashPayload(story);
  const now = nowIso();

  db.prepare(
    `INSERT INTO stories (id, user_email, title, payload_json, payload_hash, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(story.id, email, story.title || 'Untitled Story', payloadJson, payloadHash, now, now);

  db.prepare(
    `INSERT INTO story_versions (story_id, user_email, version, payload_hash, payload_json, created_at)
     VALUES (?, ?, 1, ?, ?, ?)`
  ).run(story.id, email, payloadHash, payloadJson, now);

  return story;
}

export function saveStory(email, story) {
  const db = getDb();
  const existing = db.prepare(`SELECT version, payload_hash FROM stories WHERE id = ? AND user_email = ?`).get(story.id, email);
  if (!existing) throw new Error('Story not found');

  const payloadJson = JSON.stringify(story);
  const payloadHash = hashPayload(story);
  if (existing.payload_hash === payloadHash) return story;

  const nextVersion = Number(existing.version || 1) + 1;
  const now = nowIso();

  db.prepare(
    `UPDATE stories
     SET title = ?, payload_json = ?, payload_hash = ?, version = ?, updated_at = ?
     WHERE id = ? AND user_email = ?`
  ).run(story.title || 'Untitled Story', payloadJson, payloadHash, nextVersion, now, story.id, email);

  db.prepare(
    `INSERT INTO story_versions (story_id, user_email, version, payload_hash, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(story.id, email, nextVersion, payloadHash, payloadJson, now);

  return story;
}

export function syncStories(email, stories) {
  let saved = 0;
  let unchanged = 0;
  const existingById = new Map(listStoriesByUser(email).map((s) => [s.id, s]));

  for (const story of stories) {
    if (!story?.id) continue;
    if (!existingById.has(story.id)) {
      createStory(email, story);
      saved += 1;
      continue;
    }

    const currentHash = hashPayload(existingById.get(story.id));
    const nextHash = hashPayload(story);
    if (currentHash === nextHash) {
      unchanged += 1;
      continue;
    }

    saveStory(email, story);
    saved += 1;
  }

  return { saved, unchanged };
}

export function deleteStory(email, storyId) {
  const db = getDb();
  const result = db.prepare('DELETE FROM stories WHERE id = ? AND user_email = ?').run(storyId, email);
  db.prepare('DELETE FROM story_versions WHERE story_id = ? AND user_email = ?').run(storyId, email);
  return result.changes > 0;
}

export function recordAiRun({ storyId = null, actorEmail = null, task, status, model = null, errorMessage = null }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO ai_runs (story_id, actor_email, task, model, status, error_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(storyId, actorEmail, task, model, status, errorMessage, nowIso());
}
