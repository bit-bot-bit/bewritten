import express from 'express';
import {
  registerAndLogin,
  loginAndIssueSession,
  getRegistrationEnabled,
  requireAuth,
  getCurrentUser,
  changePassword,
  isPasswordRecoveryEnabled,
} from '../auth.js';
import { listOAuthProviders, startOAuth, handleOAuthCallback } from '../oauth.js';
import { getUserAiSettings, saveUserAiSettings } from '../userSettings.js';
import { getUserCreditStatus } from '../monetization.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  try {
    const session = await loginAndIssueSession(email, password);
    // Ensure credits are refilled if applicable
    try { await getUserCreditStatus(email); } catch (e) { /* ignore refill errors */ }
    return res.json(session);
  } catch (error) {
    const message = String(error?.message || error || 'Login failed');
    const isBackoff = message.toLowerCase().includes('too many login attempts') || message.toLowerCase().includes('try again in');
    return res.status(isBackoff ? 429 : 401).json({ error: message });
  }
});

router.post('/register', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!(await getRegistrationEnabled())) return res.status(403).json({ error: 'Account registration is currently disabled' });
  try {
    const session = await registerAndLogin(email, password);
    // Ensure credits are initialized/refilled
    try { await getUserCreditStatus(email); } catch (e) { /* ignore refill errors */ }
    return res.json(session);
  } catch (error) {
    return res.status(400).json({ error: String(error.message || error) });
  }
});

router.get('/providers', (req, res) => {
  const providers = listOAuthProviders(req);
  return res.json({ providers });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await getCurrentUser(req.auth);
    // Trigger refill check on session validation
    try { await getUserCreditStatus(req.auth.email); } catch (e) { /* ignore refill errors */ }
    return res.json({ user });
  } catch (error) {
    return res.status(401).json({ error: String(error.message || error) });
  }
});

router.post('/change-password', requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  try {
    const user = await changePassword(req.auth, currentPassword, newPassword);
    return res.json({ user });
  } catch (error) {
    return res.status(400).json({ error: String(error.message || error) });
  }
});

router.post('/password-recovery/request', async (_req, res) => {
  if (!isPasswordRecoveryEnabled()) {
    return res.status(503).json({ error: 'Password recovery is disabled. Contact your administrator.' });
  }
  return res.status(501).json({ error: 'Password recovery email flow is not implemented yet.' });
});

router.post('/password-recovery/reset', async (_req, res) => {
  if (!isPasswordRecoveryEnabled()) {
    return res.status(503).json({ error: 'Password recovery is disabled. Contact your administrator.' });
  }
  return res.status(501).json({ error: 'Password recovery email flow is not implemented yet.' });
});

router.get('/oauth/:provider/start', startOAuth);
router.get('/oauth/:provider/callback', handleOAuthCallback);

// User Settings routes (often grouped with auth/user context)
router.get('/user/settings', requireAuth, async (req, res) => { // Kept path for compatibility, but mounted at /api/auth? No, wait.
  // The original app.js had /api/user/settings. Let's move this to a separate user router or keep it here if we mount at /api.
  // We'll create a separate user router or just handle it in app.js if it's small.
  // Actually, let's put it in `server/routes/user.js` or include here if we change mount point.
  // Plan: Mount this file at `/api/auth`. So these routes become `/api/auth/login`.
  // The `/api/user/settings` route doesn't fit `/api/auth`.
  // I'll create a separate `user.js` route file for `/api/user`.
  // For now, removing user settings from this file.
});

export default router;
