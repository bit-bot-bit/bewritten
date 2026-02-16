import crypto from 'node:crypto';
import { getDb } from './db.js';
import { getMonetizationConfig, getUserCreditStatus, getUserTier } from './monetization.js';

const ALLOWED_THEME_IDS = new Set(['nexus', 'grimm', 'nebula', 'solstice', 'fjord']);

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
    availableTargets: ['gemini', 'openai_compatible', 'disabled'],
    tier: 'byok',
    credits: null,
    monetizationEnabled: false,
    themeId: 'nexus',
  };
}

async function getAvailableTargetsForUser(email) {
  const tier = await getUserTier(email);
  const monetization = await getMonetizationConfig();
  if (!monetization.enabled) return ['gemini', 'openai_compatible', 'disabled'];
  if (tier === 'byok') return ['gemini', 'openai_compatible', 'disabled'];
  return ['shared', 'disabled'];
}

export async function getUserAiSettings(email, options = {}) {
  const { includeSecret = false } = options;
  const db = getDb();
  const row = await db('user_settings')
    .select('ai_target', 'ai_api_key', 'ai_model', 'ai_base_url', 'theme_id')
    .where('user_email', email)
    .first();
  const availableTargets = await getAvailableTargetsForUser(email);
  const tier = await getUserTier(email);
  const credits = await getUserCreditStatus(email);
  if (!row) {
    return {
      ...getDefaultUserAiSettings(),
      aiTarget: availableTargets[0] || 'disabled',
      availableTargets,
      tier,
      credits,
      monetizationEnabled: Boolean(credits?.monetizationEnabled),
    };
  }

  const plainKey = decryptSecret(row.ai_api_key || '');
  const target = row.ai_target || 'gemini';
  const aiTarget = availableTargets.includes(target) ? target : availableTargets[0];
  const themeIdRaw = String(row.theme_id || '').trim().toLowerCase();
  const themeId = ALLOWED_THEME_IDS.has(themeIdRaw) ? themeIdRaw : 'nexus';
  return {
    aiTarget,
    aiModel: row.ai_model || '',
    aiBaseUrl: row.ai_base_url || '',
    hasApiKey: Boolean(plainKey),
    aiApiKey: includeSecret ? plainKey : '',
    aiApiKeyMasked: includeSecret ? '' : getMaskedKey(row.ai_api_key || ''),
    availableTargets,
    tier,
    credits,
    monetizationEnabled: Boolean(credits?.monetizationEnabled),
    themeId,
  };
}

export async function saveUserAiSettings(email, next, options = {}) {
  const { keepExistingKey = true } = options;
  const db = getDb();
  const current = await getUserAiSettings(email, { includeSecret: true });
  const merged = { ...current, ...next };

  const availableTargets = await getAvailableTargetsForUser(email);
  const allowedTargets = new Set([...availableTargets, 'shared']);
  if (!allowedTargets.has(merged.aiTarget)) throw new Error('Invalid AI target');
  if (!availableTargets.includes(merged.aiTarget)) {
    throw new Error('AI target is not allowed for your tier');
  }
  const themeIdRaw = String(merged.themeId || current.themeId || 'nexus').trim().toLowerCase();
  const themeId = ALLOWED_THEME_IDS.has(themeIdRaw) ? themeIdRaw : 'nexus';

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
      theme_id: themeId,
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .onConflict('user_email')
    .merge({
      ai_target: merged.aiTarget,
      ai_api_key: storedApiKey,
      ai_model: merged.aiModel || '',
      ai_base_url: merged.aiBaseUrl || '',
      theme_id: themeId,
      updated_at: nowIso(),
    });

  return getUserAiSettings(email);
}
