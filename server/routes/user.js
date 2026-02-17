import express from 'express';
import { requireAuth } from '../auth.js';
import { getUserAiSettings, saveUserAiSettings } from '../userSettings.js';
import { buildAccountBackup, restoreAccountBackup } from '../accountBackup.js';
import { withTransientLock } from '../transientState.js';

const router = express.Router();

router.use(requireAuth);

// Original: /api/user/settings
router.get('/user/settings', async (req, res) => {
  try {
    const settings = await getUserAiSettings(req.auth.email);
    return res.json({ settings });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
});

router.put('/user/settings', async (req, res) => {
  const settings = req.body?.settings || {};
  const keepExistingKey = Boolean(req.body?.keepExistingKey ?? true);
  try {
    const saved = await saveUserAiSettings(req.auth.email, settings, { keepExistingKey });
    return res.json({ settings: saved });
  } catch (error) {
    return res.status(400).json({ error: String(error.message || error) });
  }
});

// Original: /api/account/backup
router.get('/account/backup', async (req, res) => {
  try {
    const backup = await buildAccountBackup(req.auth.email);
    return res.json({ backup });
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || 'Failed to build backup') });
  }
});

// Original: /api/account/restore
router.post('/account/restore', async (req, res) => {
  try {
    const backup = req.body?.backup;
    const mode = String(req.body?.mode || 'merge').toLowerCase() === 'replace' ? 'replace' : 'merge';
    const result = await withTransientLock(`account-restore:${req.auth.email}`, 30000, async () =>
      restoreAccountBackup(req.auth.email, backup, mode)
    );
    return res.json({ ok: true, result });
  } catch (error) {
    if (error?.code === 'TRANSIENT_LOCKED') return res.status(409).json({ error: error.message });
    return res.status(400).json({ error: String(error?.message || 'Failed to restore backup') });
  }
});

export default router;
