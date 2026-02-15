import crypto from 'node:crypto';
import { getDb } from './db.js';

const SESSION_TTL_DAYS = 30;

function nowIso() {
  return new Date().toISOString();
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function makePasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [algo, salt, hashHex] = String(stored || '').split(':');
  if (algo !== 'scrypt' || !salt || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const actual = Buffer.from(hashPassword(password, salt), 'hex');
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueSession(userEmail) {
  const db = getDb();
  const token = crypto.randomBytes(48).toString('base64url');
  const hash = tokenHash(token);
  const now = new Date();

  await db('sessions').insert({
    token_hash: hash,
    user_email: userEmail,
    created_at: nowIso(),
    last_seen_at: nowIso(),
    expires_at: addDays(now, SESSION_TTL_DAYS).toISOString(),
  });

  return token;
}

export async function issueSessionForEmail(email) {
  return issueSession(email);
}

async function getUserByEmail(email) {
  const db = getDb();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return db('users')
    .select('email', 'role', 'locked', 'must_change_password', 'password_hash')
    .where('email', normalizedEmail)
    .first();
}

function sanitizeUser(row) {
  return {
    email: row.email,
    role: row.role || 'user',
    locked: Boolean(row.locked),
    mustChangePassword: Boolean(row.must_change_password),
  };
}

async function countAdmins() {
  const db = getDb();
  const res = await db('users').count('* as count').where('role', 'admin').first();
  return Number(res?.count || 0);
}

export function getSessionTtlDays() {
  return SESSION_TTL_DAYS;
}

export async function getRegistrationEnabled() {
  const db = getDb();
  const row = await db('system_settings').select('value').where('key', 'registration_enabled').first();
  return String(row?.value || 'true').toLowerCase() !== 'false';
}

export async function setRegistrationEnabled(enabled) {
  const db = getDb();
  await db('system_settings')
    .insert({
      key: 'registration_enabled',
      value: enabled ? 'true' : 'false',
      updated_at: nowIso(),
    })
    .onConflict('key')
    .merge();

  return getRegistrationEnabled();
}

export async function bootstrapAdminUser() {
  const db = getDb();
  const adminEmail = String(process.env.BEWRITTEN_ADMIN_EMAIL || 'admin@bewritten.local').trim().toLowerCase();
  const adminPassword = String(process.env.BEWRITTEN_ADMIN_PASSWORD || 'ChangeMeNow123!');
  const now = nowIso();

  if (!adminEmail.includes('@')) throw new Error('Invalid BEWRITTEN_ADMIN_EMAIL');
  if (adminPassword.length < 8) throw new Error('BEWRITTEN_ADMIN_PASSWORD must be at least 8 characters');

  const existing = await getUserByEmail(adminEmail);
  if (!existing) {
    await db('users').insert({
      email: adminEmail,
      password_hash: makePasswordHash(adminPassword),
      role: 'admin',
      locked: 0,
      must_change_password: 1,
      created_at: now,
      updated_at: now,
    });
    return { email: adminEmail, created: true };
  }

  if ((existing.role || 'user') !== 'admin') {
    await db('users').where('email', adminEmail).update({ role: 'admin', updated_at: now });
  }

  return { email: adminEmail, created: false };
}

export async function registerAndLogin(email, password) {
  const db = getDb();
  if (!(await getRegistrationEnabled())) throw new Error('Account registration is currently disabled');

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail.includes('@')) throw new Error('Valid email is required');
  if (typeof password !== 'string' || password.length < 8) throw new Error('Password must be at least 8 characters');

  const existing = await db('users').select('email').where('email', normalizedEmail).first();
  if (existing) throw new Error('Account already exists');

  const now = nowIso();
  await db('users').insert({
    email: normalizedEmail,
    password_hash: makePasswordHash(password),
    role: 'user',
    locked: 0,
    must_change_password: 0,
    created_at: now,
    updated_at: now,
  });

  const token = await issueSession(normalizedEmail);
  return { user: { email: normalizedEmail, role: 'user', locked: false, mustChangePassword: false }, token };
}

export async function loginAndIssueSession(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail.includes('@')) throw new Error('Valid email is required');
  if (typeof password !== 'string' || password.length < 1) throw new Error('Password is required');

  const existing = await getUserByEmail(normalizedEmail);
  if (!existing || !existing.password_hash) throw new Error('Invalid credentials');
  if (existing.locked) throw new Error('Account is locked');
  if (!verifyPassword(password, existing.password_hash)) throw new Error('Invalid credentials');

  const token = await issueSession(normalizedEmail);
  return { user: sanitizeUser(existing), token };
}

export async function upsertOAuthUser(provider, providerUserId, email, displayName = null) {
  const db = getDb();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail.includes('@')) throw new Error('Valid email is required');
  if (!provider || !providerUserId) throw new Error('Invalid OAuth identity');

  const now = nowIso();
  const existing = await db('users').select('email').where('email', normalizedEmail).first();
  if (!existing) {
    if (!(await getRegistrationEnabled())) throw new Error('Account registration is currently disabled');
    await db('users').insert({
      email: normalizedEmail,
      password_hash: null,
      role: 'user',
      locked: 0,
      must_change_password: 0,
      created_at: now,
      updated_at: now,
    });
  } else {
    await db('users').where('email', normalizedEmail).update({ updated_at: now });
  }

  await db('oauth_accounts')
    .insert({
      provider,
      provider_user_id: providerUserId,
      user_email: normalizedEmail,
      display_name: displayName,
      created_at: now,
      updated_at: now,
    })
    .onConflict(['provider', 'provider_user_id'])
    .merge({
      user_email: normalizedEmail,
      display_name: displayName,
      updated_at: now,
    });

  const token = await issueSession(normalizedEmail);
  return { user: { email: normalizedEmail, role: 'user', locked: false, mustChangePassword: false }, token };
}

export async function resolveSession(token) {
  const db = getDb();
  if (!token) return null;

  const hash = tokenHash(token);
  const row = await db('sessions')
    .select('sessions.user_email', 'sessions.expires_at', 'users.role', 'users.locked', 'users.must_change_password')
    .join('users', 'users.email', 'sessions.user_email')
    .where('sessions.token_hash', hash)
    .first();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db('sessions').where('token_hash', hash).del();
    return null;
  }
  if (row.locked) {
    await db('sessions').where('token_hash', hash).del();
    return null;
  }

  await db('sessions').where('token_hash', hash).update({ last_seen_at: nowIso() });
  return {
    email: row.user_email,
    role: row.role || 'user',
    locked: Boolean(row.locked),
    mustChangePassword: Boolean(row.must_change_password),
  };
}

export async function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const session = await resolveSession(token);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  req.auth = session;
  return next();
}

export function requirePasswordFresh(req, res, next) {
  if (req.auth?.mustChangePassword) return res.status(403).json({ error: 'Password change required' });
  return next();
}

export function requireAdmin(req, res, next) {
  if (req.auth?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  return next();
}

export async function getCurrentUser(auth) {
  const user = await getUserByEmail(auth?.email);
  if (!user) throw new Error('User not found');
  return sanitizeUser(user);
}

export async function changePassword(auth, currentPassword, newPassword) {
  const db = getDb();
  const user = await getUserByEmail(auth?.email);
  if (!user || !user.password_hash) throw new Error('Invalid credentials');
  if (!verifyPassword(String(currentPassword || ''), user.password_hash)) throw new Error('Current password is incorrect');
  if (typeof newPassword !== 'string' || newPassword.length < 8) throw new Error('New password must be at least 8 characters');

  await db('users')
    .where('email', user.email)
    .update({
      password_hash: makePasswordHash(newPassword),
      must_change_password: 0,
      updated_at: nowIso(),
    });

  return { email: user.email, role: user.role || 'user', locked: false, mustChangePassword: false };
}

export async function listUsersForAdmin() {
  const db = getDb();
  const rows = await db('users')
    .select(
      'users.email',
      'users.role',
      'users.locked',
      'users.must_change_password',
      'users.created_at',
      'users.updated_at',
      db.raw('(SELECT MAX(last_seen_at) FROM sessions WHERE user_email = users.email) as last_seen_at')
    )
    .orderBy('created_at', 'desc');

  return rows.map((row) => ({
    email: row.email,
    role: row.role || 'user',
    locked: Boolean(row.locked),
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at || null,
  }));
}

export async function setUserLockedByAdmin(actorEmail, targetEmail, locked) {
  const db = getDb();
  const actor = String(actorEmail || '').trim().toLowerCase();
  const target = String(targetEmail || '').trim().toLowerCase();
  if (!target.includes('@')) throw new Error('Valid target email is required');
  if (actor === target && locked) throw new Error('You cannot lock your own account');

  const existing = await getUserByEmail(target);
  if (!existing) throw new Error('User not found');
  if ((existing.role || 'user') === 'admin' && locked && (await countAdmins()) <= 1) throw new Error('Cannot lock the last admin account');

  await db('users').where('email', target).update({ locked: locked ? 1 : 0, updated_at: nowIso() });
  if (locked) await db('sessions').where('user_email', target).del();
}

export async function setUserRoleByAdmin(actorEmail, targetEmail, role) {
  const db = getDb();
  const actor = String(actorEmail || '').trim().toLowerCase();
  const target = String(targetEmail || '').trim().toLowerCase();
  const nextRole = role === 'admin' ? 'admin' : 'user';
  if (!target.includes('@')) throw new Error('Valid target email is required');

  const existing = await getUserByEmail(target);
  if (!existing) throw new Error('User not found');
  if ((existing.role || 'user') === 'admin' && nextRole !== 'admin' && (await countAdmins()) <= 1) throw new Error('Cannot demote the last admin account');
  if (actor === target && nextRole !== 'admin') throw new Error('You cannot remove your own admin role');

  await db('users').where('email', target).update({ role: nextRole, updated_at: nowIso() });
}

export async function deleteUserByAdmin(actorEmail, targetEmail) {
  const db = getDb();
  const actor = String(actorEmail || '').trim().toLowerCase();
  const target = String(targetEmail || '').trim().toLowerCase();
  if (!target.includes('@')) throw new Error('Valid target email is required');
  if (actor === target) throw new Error('You cannot delete your own account');

  const existing = await getUserByEmail(target);
  if (!existing) throw new Error('User not found');
  if ((existing.role || 'user') === 'admin' && (await countAdmins()) <= 1) throw new Error('Cannot delete the last admin account');

  await db('users').where('email', target).del();
}

export async function resetUserPasswordByAdmin(actorEmail, targetEmail, newPassword) {
  const db = getDb();
  const actor = String(actorEmail || '').trim().toLowerCase();
  const target = String(targetEmail || '').trim().toLowerCase();
  const nextPassword = String(newPassword || '');

  if (!target.includes('@')) throw new Error('Valid target email is required');
  if (actor === target) throw new Error('Use your own Change Password flow to update your password');
  if (nextPassword.length < 8) throw new Error('Temporary password must be at least 8 characters');

  const existing = await getUserByEmail(target);
  if (!existing) throw new Error('User not found');

  await db('users')
    .where('email', target)
    .update({
      password_hash: makePasswordHash(nextPassword),
      must_change_password: 1,
      updated_at: nowIso(),
    });

  await db('sessions').where('user_email', target).del();
}
