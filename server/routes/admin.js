import express from 'express';
import {
  getSessionTtlDays,
  getRegistrationEnabled,
  setRegistrationEnabled,
  listUsersForAdmin,
  setUserLockedByAdmin,
  setUserRoleByAdmin,
  deleteUserByAdmin,
  resetUserPasswordByAdmin,
  requireAuth,
  requireAdmin,
  isPasswordRecoveryEnabled,
} from '../auth.js';
import {
  getMonetizationConfig,
  getMonetizationDefaults,
  saveMonetizationConfig,
  setUserTierByAdmin,
} from '../monetization.js';
import { getOAuthDiagnostics } from '../oauth.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/settings', async (req, res) => {
  return res.json({
    auth: {
      passwordLoginEnabled: true,
      sessionTtlDays: getSessionTtlDays(),
      registrationEnabled: await getRegistrationEnabled(),
      passwordRecoveryEnabled: isPasswordRecoveryEnabled(),
    },
    monetization: await getMonetizationConfig(),
    monetizationDefaults: getMonetizationDefaults(),
    oauthProviders: getOAuthDiagnostics(req),
    users: await listUsersForAdmin(),
    publicUrl: process.env.BEWRITTEN_PUBLIC_URL || null,
    user: req.auth,
  });
});

router.put('/settings/registration', async (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const registrationEnabled = await setRegistrationEnabled(enabled);
    return res.json({ registrationEnabled });
  } catch (error) {
    return res.status(400).json({ error: String(error.message || error) });
  }
});

router.put('/settings/monetization', async (req, res) => {
  const monetization = req.body?.monetization || {};
  const keepExistingSharedKey = Boolean(req.body?.keepExistingSharedKey ?? true);
  try {
    const saved = await saveMonetizationConfig(monetization, { keepExistingSharedKey });
    return res.json({ monetization: saved });
  } catch (error) {
    return res.status(400).json({ error: String(error.message || error) });
  }
});

router.put('/users/:email/lock', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
    const locked = Boolean(req.body?.locked);
    await setUserLockedByAdmin(req.auth.email, email, locked);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: String(error.message || error) });
  }
});

router.put('/users/:email/role', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
    const role = String(req.body?.role || 'user');
    await setUserRoleByAdmin(req.auth.email, email, role);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: String(error.message || error) });
  }
});

router.put('/users/:email/tier', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
    const tier = String(req.body?.tier || 'byok').trim().toLowerCase();
    await setUserTierByAdmin(req.auth.email, email, tier);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: String(error.message || error) });
  }
});

router.delete('/users/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
    await deleteUserByAdmin(req.auth.email, email);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: String(error.message || error) });
  }
});

router.put('/users/:email/password', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    await resetUserPasswordByAdmin(req.auth.email, email, password);
    return res.json({ ok: true, mustChangePassword: true });
  } catch (error) {
    return res.status(400).json({ error: String(error.message || error) });
  }
});

export default router;
