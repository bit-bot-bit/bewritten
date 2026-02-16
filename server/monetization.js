import crypto from 'node:crypto';
import { getDb } from './db.js';
import { withTransientLock } from './transientState.js';

const ALLOWED_TIERS = new Set(['free', 'pro', 'byok']);
const ALLOWED_TARGETS = new Set(['gemini', 'openai_compatible', 'disabled']);
const KNOWN_TASKS = [
  'continuity',
  'character-profile',
  'plot-suggestion',
  'extract-characters',
  'extract-world',
  'extract-plot',
  'plot-consensus',
  'chat',
  'layout-css',
  'blurb',
];

const DEFAULT_TIER_RULES = {
  free: { cap: 100, refillPerDay: 20 },
  pro: { cap: 2000, refillPerDay: 20 },
  byok: { cap: 0, refillPerDay: 0 },
};

const DEFAULT_TASK_COSTS = {
  continuity: 12,
  'character-profile': 8,
  'plot-suggestion': 8,
  'extract-characters': 10,
  'extract-world': 10,
  'extract-plot': 10,
  'plot-consensus': 24,
  chat: 6,
  'layout-css': 8,
  blurb: 8,
  default: 10,
};

function nowIso() {
  return new Date().toISOString();
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function clampInt(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function parseJson(raw, fallback) {
  try {
    return JSON.parse(String(raw || ''));
  } catch {
    return fallback;
  }
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

function maskSecret(value) {
  const plain = decryptSecret(value);
  if (!plain) return '';
  return `••••••••${plain.slice(-4)}`;
}

async function getSystemSetting(key, fallback = null) {
  const db = getDb();
  const row = await db('system_settings').select('value').where('key', key).first();
  return row?.value ?? fallback;
}

async function setSystemSetting(key, value) {
  const db = getDb();
  await db('system_settings')
    .insert({ key, value: String(value ?? ''), updated_at: nowIso() })
    .onConflict('key')
    .merge({ value: String(value ?? ''), updated_at: nowIso() });
}

function normalizeTierRules(raw) {
  const next = { ...DEFAULT_TIER_RULES };
  const src = raw && typeof raw === 'object' ? raw : {};
  for (const tier of Object.keys(DEFAULT_TIER_RULES)) {
    const r = src[tier] || {};
    next[tier] = {
      cap: clampInt(r.cap ?? next[tier].cap, 0, 1000000),
      refillPerDay: clampInt(r.refillPerDay ?? next[tier].refillPerDay, 0, 1000000),
    };
  }
  return next;
}

function normalizeTaskCosts(raw) {
  const next = { ...DEFAULT_TASK_COSTS };
  const src = raw && typeof raw === 'object' ? raw : {};
  for (const [k, v] of Object.entries(src)) {
    next[k] = clampInt(v, 0, 1000000);
  }
  return next;
}

function normalizeShared(raw, current = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const target = ALLOWED_TARGETS.has(src.target) ? src.target : current.target || 'gemini';
  return {
    target,
    model: String(src.model ?? current.model ?? process.env.BEWRITTEN_AI_MODEL ?? 'gemini-2.5-flash'),
    baseUrl: String(src.baseUrl ?? current.baseUrl ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'),
  };
}

export async function getUserTier(email) {
  const db = getDb();
  const row = await db('users').select('tier').where('email', email).first();
  const tier = String(row?.tier || 'byok').toLowerCase();
  return ALLOWED_TIERS.has(tier) ? tier : 'byok';
}

export async function setUserTierByAdmin(actorEmail, targetEmail, tier) {
  const db = getDb();
  const actor = String(actorEmail || '').trim().toLowerCase();
  const target = String(targetEmail || '').trim().toLowerCase();
  const nextTier = String(tier || '').trim().toLowerCase();
  if (!target.includes('@')) throw new Error('Valid target email is required');
  if (!ALLOWED_TIERS.has(nextTier)) throw new Error('Invalid tier');
  if (actor === target && nextTier === 'free') throw new Error('Admins cannot downgrade themselves to free tier');

  const exists = await db('users').select('email').where('email', target).first();
  if (!exists) throw new Error('User not found');

  await db('users').where('email', target).update({ tier: nextTier, updated_at: nowIso() });
  await ensureCreditsRow(target, nextTier);

  if (nextTier === 'byok') {
    await db('user_settings')
      .where('user_email', target)
      .andWhere('ai_target', 'shared')
      .update({ ai_target: 'gemini', updated_at: nowIso() });
  }
}

export async function getMonetizationConfig(options = {}) {
  const { includeSecret = false } = options;
  const enabledRaw = await getSystemSetting('monetization_enabled', 'false');
  const tiersRaw = await getSystemSetting('monetization_tiers', JSON.stringify(DEFAULT_TIER_RULES));
  const costsRaw = await getSystemSetting('monetization_task_costs', JSON.stringify(DEFAULT_TASK_COSTS));
  const sharedRaw = await getSystemSetting('monetization_shared', '');

  const enabled = String(enabledRaw).toLowerCase() === 'true';
  const tiers = normalizeTierRules(parseJson(tiersRaw, DEFAULT_TIER_RULES));
  const taskCosts = normalizeTaskCosts(parseJson(costsRaw, DEFAULT_TASK_COSTS));
  const sharedStored = parseJson(sharedRaw, {});
  const shared = normalizeShared(sharedStored, sharedStored);
  const sharedApiKey = decryptSecret(sharedStored?.apiKey || '');

  return {
    enabled,
    tiers,
    taskCosts,
    shared: {
      ...shared,
      hasApiKey: Boolean(sharedApiKey),
      apiKeyMasked: includeSecret ? '' : maskSecret(sharedStored?.apiKey || ''),
      apiKey: includeSecret ? sharedApiKey : '',
    },
  };
}

export async function saveMonetizationConfig(next, options = {}) {
  const { keepExistingSharedKey = true } = options;
  const current = await getMonetizationConfig({ includeSecret: true });
  const merged = {
    enabled: typeof next?.enabled === 'boolean' ? next.enabled : current.enabled,
    tiers: normalizeTierRules(next?.tiers || current.tiers),
    taskCosts: normalizeTaskCosts(next?.taskCosts || current.taskCosts),
    shared: normalizeShared(next?.shared || current.shared, current.shared),
  };

  const incomingApiKey = typeof next?.shared?.apiKey === 'string' ? next.shared.apiKey.trim() : null;
  let resolvedSharedApiKey = current.shared.apiKey || '';
  if (incomingApiKey !== null) {
    if (incomingApiKey.length > 0) resolvedSharedApiKey = incomingApiKey;
    else if (!keepExistingSharedKey) resolvedSharedApiKey = '';
  }

  const sharedStored = {
    target: merged.shared.target,
    model: merged.shared.model,
    baseUrl: merged.shared.baseUrl,
    apiKey: resolvedSharedApiKey ? encryptSecret(resolvedSharedApiKey) : '',
  };

  const wasEnabled = current.enabled;
  await setSystemSetting('monetization_enabled', merged.enabled ? 'true' : 'false');
  await setSystemSetting('monetization_tiers', JSON.stringify(merged.tiers));
  await setSystemSetting('monetization_task_costs', JSON.stringify(merged.taskCosts));
  await setSystemSetting('monetization_shared', JSON.stringify(sharedStored));

  // If monetization is switched off, force invalid shared target back to BYOK default.
  if (wasEnabled && !merged.enabled) {
    const db = getDb();
    await db('user_settings')
      .where('ai_target', 'shared')
      .update({ ai_target: 'gemini', updated_at: nowIso() });
  }

  return getMonetizationConfig();
}

function daysBetween(fromDay, toDay) {
  const a = Date.parse(`${fromDay}T00:00:00.000Z`);
  const b = Date.parse(`${toDay}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.floor((b - a) / 86400000);
}

export async function ensureCreditsRow(email, tier = null) {
  const db = getDb();
  const effectiveTier = tier || (await getUserTier(email));
  const cfg = await getMonetizationConfig();
  const rules = cfg.tiers[effectiveTier] || DEFAULT_TIER_RULES.byok;
  const cap = clampInt(rules.cap, 0, 1000000);
  const today = utcDay();
  const now = nowIso();

  await db('user_credits')
    .insert({
      user_email: email,
      balance: cap,
      last_refill_day: today,
      created_at: now,
      updated_at: now,
    })
    .onConflict('user_email')
    .ignore();

  const row = await db('user_credits').select('balance').where('user_email', email).first();
  if (row && Number(row.balance) > cap) {
    await db('user_credits').where('user_email', email).update({ balance: cap, updated_at: now });
  }
}

export async function getUserCreditStatus(email) {
  const tier = await getUserTier(email);
  const cfg = await getMonetizationConfig();
  if (!cfg.enabled || tier === 'byok') {
    return {
      tier,
      monetizationEnabled: cfg.enabled,
      limited: false,
      balance: null,
      cap: null,
      refillPerDay: null,
      taskCosts: cfg.taskCosts,
    };
  }

  const rules = cfg.tiers[tier] || DEFAULT_TIER_RULES.free;
  const cap = clampInt(rules.cap, 0, 1000000);
  const refillPerDay = clampInt(rules.refillPerDay, 0, 1000000);
  const today = utcDay();

  await ensureCreditsRow(email, tier);
  const db = getDb();
  const row = await db('user_credits').select('balance', 'last_refill_day').where('user_email', email).first();
  if (!row) {
    return { tier, monetizationEnabled: cfg.enabled, limited: true, balance: 0, cap, refillPerDay, taskCosts: cfg.taskCosts };
  }

  const elapsedDays = daysBetween(String(row.last_refill_day || today), today);
  let balance = clampInt(row.balance, 0, cap);
  if (elapsedDays > 0 && refillPerDay > 0) {
    balance = Math.min(cap, balance + elapsedDays * refillPerDay);
    await db('user_credits')
      .where('user_email', email)
      .update({ balance, last_refill_day: today, updated_at: nowIso() });
  }

  return {
    tier,
    monetizationEnabled: cfg.enabled,
    limited: true,
    balance,
    cap,
    refillPerDay,
    taskCosts: cfg.taskCosts,
  };
}

export async function chargeTokensForTask(email, task) {
  const cfg = await getMonetizationConfig();
  const tier = await getUserTier(email);
  const taskName = String(task || '').trim();
  const taskCost = clampInt(cfg.taskCosts[taskName] ?? cfg.taskCosts.default ?? DEFAULT_TASK_COSTS.default, 0, 1000000);

  if (!cfg.enabled || tier === 'byok' || taskCost <= 0 || cfg.shared?.target === 'disabled') {
    return { charged: false, tier, cost: 0, remaining: null, limited: false };
  }

  const key = `credits:${email}`;
  return withTransientLock(key, 5000, async () => {
    const state = await getUserCreditStatus(email);
    const remaining = Number(state.balance || 0);
    if (remaining < taskCost) {
      const err = new Error(`Not enough tokens. Required ${taskCost}, remaining ${remaining}.`);
      err.code = 'INSUFFICIENT_TOKENS';
      throw err;
    }

    const db = getDb();
    const next = remaining - taskCost;
    await db('user_credits')
      .where('user_email', email)
      .update({ balance: next, updated_at: nowIso(), last_refill_day: utcDay() });

    return { charged: true, tier, cost: taskCost, remaining: next, limited: true };
  });
}

export async function resolveRuntimeForUser(email, userSettings, fallbackRuntime) {
  const tier = await getUserTier(email);
  const cfg = await getMonetizationConfig({ includeSecret: true });
  const byokRuntime = {
    aiTarget: userSettings?.aiTarget || fallbackRuntime.aiTarget,
    aiApiKey: userSettings?.aiApiKey || fallbackRuntime.aiApiKey,
    aiModel: userSettings?.aiModel || fallbackRuntime.aiModel,
    aiBaseUrl: userSettings?.aiBaseUrl || fallbackRuntime.aiBaseUrl,
    runtimeSource: 'user',
    tier,
  };

  if (!cfg.enabled || tier === 'byok') return byokRuntime;

  return {
    aiTarget: cfg.shared.target || 'gemini',
    aiApiKey: cfg.shared.apiKey || '',
    aiModel: cfg.shared.model || fallbackRuntime.aiModel,
    aiBaseUrl: cfg.shared.baseUrl || fallbackRuntime.aiBaseUrl,
    runtimeSource: 'shared',
    tier,
  };
}

export function getMonetizationDefaults() {
  return {
    tiers: DEFAULT_TIER_RULES,
    taskCosts: DEFAULT_TASK_COSTS,
    knownTasks: KNOWN_TASKS,
    allowedTiers: [...ALLOWED_TIERS],
    allowedTargets: [...ALLOWED_TARGETS],
  };
}
