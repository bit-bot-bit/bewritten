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

function issueSession(userEmail) {
  const db = getDb();
  const token = crypto.randomBytes(48).toString('base64url');
  const hash = tokenHash(token);
  const now = new Date();

  db.prepare(
    `INSERT INTO sessions (token_hash, user_email, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(hash, userEmail, nowIso(), nowIso(), addDays(now, SESSION_TTL_DAYS).toISOString());

  return token;
}

function getUserByEmail(email) {
  const db = getDb();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return db.prepare(
    `SELECT email, role, locked, must_change_password, password_hash
     FROM users
     WHERE email = ?`
  ).get(normalizedEmail);
}

function sanitizeUser(row) {
  return {
    email: row.email,
    role: row.role || 'user',
    locked: Boolean(row.locked),
    mustChangePassword: Boolean(row.must_change_password),
  };
}

function countAdmins() {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'admin'`).get();
  return Number(row?.count || 0);
}

export function getSessionTtlDays() {
  return SESSION_TTL_DAYS;
}

export function getRegistrationEnabled() {
  const db = getDb();
  const row = db.prepare(`SELECT value FROM system_settings WHERE key = 'registration_enabled'`).get();
  return String(row?.value || 'true').toLowerCase() !== 'false';
}

export function setRegistrationEnabled(enabled) {
  const db = getDb();
  db.prepare(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ('registration_enabled', ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`
  ).run(enabled ? 'true' : 'false', nowIso());

  return getRegistrationEnabled();
}

export function bootstrapAdminUser() {
  const db = getDb();
  const adminEmail = String(process.env.BEWRITTEN_ADMIN_EMAIL || 'admin@bewritten.local').trim().toLowerCase();
  const adminPassword = String(process.env.BEWRITTEN_ADMIN_PASSWORD || 'ChangeMeNow123!');
  const now = nowIso();

  if (!adminEmail.includes('@')) throw new Error('Invalid BEWRITTEN_ADMIN_EMAIL');
  if (adminPassword.length < 8) throw new Error('BEWRITTEN_ADMIN_PASSWORD must be at least 8 characters');

  const existing = getUserByEmail(adminEmail);
  if (!existing) {
    db.prepare(
      `INSERT INTO users (email, password_hash, role, locked, must_change_password, created_at, updated_at)
       VALUES (?, ?, 'admin', 0, 1, ?, ?)`
    ).run(adminEmail, makePasswordHash(adminPassword), now, now);
    return { email: adminEmail, created: true };
  }

  if ((existing.role || 'user') !== 'admin') {
    db.prepare(`UPDATE users SET role = 'admin', updated_at = ? WHERE email = ?`).run(now, adminEmail);
  }

  return { email: adminEmail, created: false };
}

export function registerAndLogin(email, password) {
  const db = getDb();
  if (!getRegistrationEnabled()) throw new Error('Account registration is currently disabled');

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail.includes('@')) throw new Error('Valid email is required');
  if (typeof password !== 'string' || password.length < 8) throw new Error('Password must be at least 8 characters');

  const existing = db.prepare('SELECT email FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) throw new Error('Account already exists');

  const now = nowIso();
  db.prepare(
    `INSERT INTO users (email, password_hash, role, locked, must_change_password, created_at, updated_at)
     VALUES (?, ?, 'user', 0, 0, ?, ?)`
  ).run(normalizedEmail, makePasswordHash(password), now, now);

  const token = issueSession(normalizedEmail);
  return { user: { email: normalizedEmail, role: 'user', locked: false, mustChangePassword: false }, token };
}

export function loginAndIssueSession(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail.includes('@')) throw new Error('Valid email is required');
  if (typeof password !== 'string' || password.length < 1) throw new Error('Password is required');

  const existing = getUserByEmail(normalizedEmail);
  if (!existing || !existing.password_hash) throw new Error('Invalid credentials');
  if (existing.locked) throw new Error('Account is locked');
  if (!verifyPassword(password, existing.password_hash)) throw new Error('Invalid credentials');

  const token = issueSession(normalizedEmail);
  return { user: sanitizeUser(existing), token };
}

export function upsertOAuthUser(provider, providerUserId, email, displayName = null) {
  const db = getDb();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail.includes('@')) throw new Error('Valid email is required');
  if (!provider || !providerUserId) throw new Error('Invalid OAuth identity');

  const now = nowIso();
  const existing = db.prepare('SELECT email FROM users WHERE email = ?').get(normalizedEmail);
  if (!existing) {
    if (!getRegistrationEnabled()) throw new Error('Account registration is currently disabled');
    db.prepare(
      `INSERT INTO users (email, password_hash, role, locked, must_change_password, created_at, updated_at)
       VALUES (?, NULL, 'user', 0, 0, ?, ?)`
    ).run(normalizedEmail, now, now);
  } else {
    db.prepare('UPDATE users SET updated_at = ? WHERE email = ?').run(now, normalizedEmail);
  }

  db.prepare(
    `INSERT INTO oauth_accounts (provider, provider_user_id, user_email, display_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider, provider_user_id) DO UPDATE SET
       user_email = excluded.user_email,
       display_name = excluded.display_name,
       updated_at = excluded.updated_at`
  ).run(provider, providerUserId, normalizedEmail, displayName, now, now);

  const token = issueSession(normalizedEmail);
  return { user: { email: normalizedEmail, role: 'user', locked: false, mustChangePassword: false }, token };
}

export function resolveSession(token) {
  const db = getDb();
  if (!token) return null;

  const hash = tokenHash(token);
  const row = db.prepare(
    `SELECT s.user_email, s.expires_at, u.role, u.locked, u.must_change_password
     FROM sessions s
     JOIN users u ON u.email = s.user_email
     WHERE s.token_hash = ?`
  ).get(hash);

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
    return null;
  }
  if (row.locked) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
    return null;
  }

  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(nowIso(), hash);
  return {
    email: row.user_email,
    role: row.role || 'user',
    locked: Boolean(row.locked),
    mustChangePassword: Boolean(row.must_change_password),
  };
}

export function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const session = resolveSession(token);
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

export function getCurrentUser(auth) {
  const user = getUserByEmail(auth?.email);
  if (!user) throw new Error('User not found');
  return sanitizeUser(user);
}

export function changePassword(auth, currentPassword, newPassword) {
  const db = getDb();
  const user = getUserByEmail(auth?.email);
  if (!user || !user.password_hash) throw new Error('Invalid credentials');
  if (!verifyPassword(String(currentPassword || ''), user.password_hash)) throw new Error('Current password is incorrect');
  if (typeof newPassword !== 'string' || newPassword.length < 8) throw new Error('New password must be at least 8 characters');

  db.prepare(
    `UPDATE users
     SET password_hash = ?, must_change_password = 0, updated_at = ?
     WHERE email = ?`
  ).run(makePasswordHash(newPassword), nowIso(), user.email);

  return { email: user.email, role: user.role || 'user', locked: false, mustChangePassword: false };
}

export function listUsersForAdmin() {
  const db = getDb();
  return db.prepare(
    `SELECT
      u.email,
      u.role,
      u.locked,
      u.must_change_password,
      u.created_at,
      u.updated_at,
      (
        SELECT MAX(s.last_seen_at)
        FROM sessions s
        WHERE s.user_email = u.email
      ) AS last_seen_at
    FROM users u
    ORDER BY u.created_at DESC`
  ).all().map((row) => ({
    email: row.email,
    role: row.role || 'user',
    locked: Boolean(row.locked),
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at || null,
  }));
}

export function setUserLockedByAdmin(actorEmail, targetEmail, locked) {
  const db = getDb();
  const actor = String(actorEmail || '').trim().toLowerCase();
  const target = String(targetEmail || '').trim().toLowerCase();
  if (!target.includes('@')) throw new Error('Valid target email is required');
  if (actor === target && locked) throw new Error('You cannot lock your own account');

  const existing = getUserByEmail(target);
  if (!existing) throw new Error('User not found');
  if ((existing.role || 'user') === 'admin' && locked && countAdmins() <= 1) throw new Error('Cannot lock the last admin account');

  db.prepare('UPDATE users SET locked = ?, updated_at = ? WHERE email = ?').run(locked ? 1 : 0, nowIso(), target);
  if (locked) db.prepare('DELETE FROM sessions WHERE user_email = ?').run(target);
}

export function setUserRoleByAdmin(actorEmail, targetEmail, role) {
  const db = getDb();
  const actor = String(actorEmail || '').trim().toLowerCase();
  const target = String(targetEmail || '').trim().toLowerCase();
  const nextRole = role === 'admin' ? 'admin' : 'user';
  if (!target.includes('@')) throw new Error('Valid target email is required');

  const existing = getUserByEmail(target);
  if (!existing) throw new Error('User not found');
  if ((existing.role || 'user') === 'admin' && nextRole !== 'admin' && countAdmins() <= 1) throw new Error('Cannot demote the last admin account');
  if (actor === target && nextRole !== 'admin') throw new Error('You cannot remove your own admin role');

  db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE email = ?').run(nextRole, nowIso(), target);
}

export function deleteUserByAdmin(actorEmail, targetEmail) {
  const db = getDb();
  const actor = String(actorEmail || '').trim().toLowerCase();
  const target = String(targetEmail || '').trim().toLowerCase();
  if (!target.includes('@')) throw new Error('Valid target email is required');
  if (actor === target) throw new Error('You cannot delete your own account');

  const existing = getUserByEmail(target);
  if (!existing) throw new Error('User not found');
  if ((existing.role || 'user') === 'admin' && countAdmins() <= 1) throw new Error('Cannot delete the last admin account');

  db.prepare('DELETE FROM users WHERE email = ?').run(target);
}
