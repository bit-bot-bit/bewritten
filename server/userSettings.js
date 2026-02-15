import crypto from 'node:crypto';
import { getDb } from './db.js';

function nowIso() {
  return new Date().toISOString();
}

function keyMaterial() {
  const raw = String(process.env.BEWRITTEN_SECRET_KEY || '');
  if (raw.length >= 32) return crypto.createHash('sha256').update(raw).digest();
  return crypto.createHash('sha256').update('bewritten-dev-secret-key').digest();
}

function encryptSecret(plainText) {
  const iv = crypto.randomBytes(12);
  const key = keyMaterial();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plainText || ''), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

function decryptSecret(value) {
  const raw = String(value || '');
  if (!raw) return '';
  if (!raw.startsWith('enc:v1:')) return raw;

  const parts = raw.split(':');
  if (parts.length !== 5) return '';
  try {
    const iv = Buffer.from(parts[2], 'base64url');
    const tag = Buffer.from(parts[3], 'base64url');
    const data = Buffer.from(parts[4], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyMaterial(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

function getMaskedKey(stored) {
  const plain = decryptSecret(stored);
  if (!plain) return '';
  return `••••••••${plain.slice(-4)}`;
}

export function getDefaultUserAiSettings() {
  return {
    aiTarget: 'gemini',
    aiModel: '',
    aiBaseUrl: '',
    aiApiKey: '',
    aiApiKeyMasked: '',
    hasApiKey: false,
  };
}

export async function getUserAiSettings(email, options = {}) {
  const { includeSecret = false } = options;
  const db = getDb();
  const row = await db('user_settings')
    .select('ai_target', 'ai_api_key', 'ai_model', 'ai_base_url')
    .where('user_email', email)
    .first();

  if (!row) return getDefaultUserAiSettings();

  const plainKey = decryptSecret(row.ai_api_key || '');
  return {
    aiTarget: row.ai_target || 'gemini',
    aiModel: row.ai_model || '',
    aiBaseUrl: row.ai_base_url || '',
    hasApiKey: Boolean(plainKey),
    aiApiKey: includeSecret ? plainKey : '',
    aiApiKeyMasked: includeSecret ? '' : getMaskedKey(row.ai_api_key || ''),
  };
}

export async function saveUserAiSettings(email, next, options = {}) {
  const { keepExistingKey = true } = options;
  const db = getDb();
  const current = await getUserAiSettings(email, { includeSecret: true });
  const merged = { ...current, ...next };

  const allowedTargets = new Set(['gemini', 'openai_compatible', 'disabled']);
  if (!allowedTargets.has(merged.aiTarget)) throw new Error('Invalid AI target');

  const incomingKey = typeof next.aiApiKey === 'string' ? next.aiApiKey.trim() : null;
  let resolvedApiKey = current.aiApiKey || '';
  if (incomingKey !== null) {
    if (incomingKey.length > 0) resolvedApiKey = incomingKey;
    else if (!keepExistingKey) resolvedApiKey = '';
  }

  const storedApiKey = resolvedApiKey ? encryptSecret(resolvedApiKey) : '';

  await db('user_settings')
    .insert({
      user_email: email,
      ai_target: merged.aiTarget,
      ai_api_key: storedApiKey,
      ai_model: merged.aiModel || '',
      ai_base_url: merged.aiBaseUrl || '',
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .onConflict('user_email')
    .merge({
      ai_target: merged.aiTarget,
      ai_api_key: storedApiKey,
      ai_model: merged.aiModel || '',
      ai_base_url: merged.aiBaseUrl || '',
      updated_at: nowIso(),
    });

  return getUserAiSettings(email);
}
