import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDb } from './db.js';
import { listStoriesByUser, createStory, saveStory, syncStories, deleteStory, recordAiRun } from './storyStore.js';
import { runJsonPrompt, runTextPrompt, Schema } from './aiService.js';
import {
  registerAndLogin,
  loginAndIssueSession,
  bootstrapAdminUser,
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
  requirePasswordFresh,
  getCurrentUser,
  changePassword,
  isPasswordRecoveryEnabled,
} from './auth.js';
import { listOAuthProviders, getOAuthDiagnostics, startOAuth, handleOAuthCallback } from './oauth.js';
import { getUserAiSettings, saveUserAiSettings } from './userSettings.js';
import { getTransientInfo, incrementTransientCounter, withTransientLock } from './transientState.js';
import {
  chargeTokensForTask,
  getMonetizationConfig,
  getMonetizationDefaults,
  getUserCreditStatus,
  saveMonetizationConfig,
  setUserTierByAdmin,
} from './monetization.js';
import { buildAccountBackup, restoreAccountBackup } from './accountBackup.js';

export const app = express();

function parseOrigin(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function getAllowedCorsOrigins() {
  const origins = new Set();

  const configured = String(process.env.BEWRITTEN_CORS_ORIGINS || '')
    .split(',')
    .map((v) => parseOrigin(v))
    .filter(Boolean);
  configured.forEach((origin) => origins.add(origin));

  const publicOrigin = parseOrigin(process.env.BEWRITTEN_PUBLIC_URL || '');
  if (publicOrigin) origins.add(publicOrigin);

  if (process.env.NODE_ENV !== 'production') {
    ['http://localhost:3000', 'http://localhost:4173', 'http://localhost:5173'].forEach((origin) => origins.add(origin));
  }

  return origins;
}

const allowedCorsOrigins = getAllowedCorsOrigins();
if (allowedCorsOrigins.size > 0) {
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedCorsOrigins.has(origin)) return callback(null, true);
        return callback(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    })
  );
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

export let adminBootstrap = { email: 'pending', created: false };

export async function initApp() {
  await initDb();
  adminBootstrap = await bootstrapAdminUser();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, adminBootstrap, transient: getTransientInfo() });
  });

  app.post('/api/auth/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    try {
      const session = await loginAndIssueSession(email, password);
      return res.json(session);
    } catch (error) {
      const message = String(error?.message || error || 'Login failed');
      const isBackoff = message.toLowerCase().includes('too many login attempts') || message.toLowerCase().includes('try again in');
      return res.status(isBackoff ? 429 : 401).json({ error: message });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!(await getRegistrationEnabled())) return res.status(403).json({ error: 'Account registration is currently disabled' });
    try {
      const session = await registerAndLogin(email, password);
      return res.json(session);
    } catch (error) {
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.get('/api/auth/providers', (req, res) => {
    const providers = listOAuthProviders(req);
    return res.json({ providers });
  });

  app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req.auth);
      return res.json({ user });
    } catch (error) {
      return res.status(401).json({ error: String(error.message || error) });
    }
  });

  app.post('/api/auth/change-password', requireAuth, async (req, res) => {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    try {
      const user = await changePassword(req.auth, currentPassword, newPassword);
      return res.json({ user });
    } catch (error) {
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.post('/api/auth/password-recovery/request', async (_req, res) => {
    if (!isPasswordRecoveryEnabled()) {
      return res.status(503).json({ error: 'Password recovery is disabled. Contact your administrator.' });
    }
    return res.status(501).json({ error: 'Password recovery email flow is not implemented yet.' });
  });

  app.post('/api/auth/password-recovery/reset', async (_req, res) => {
    if (!isPasswordRecoveryEnabled()) {
      return res.status(503).json({ error: 'Password recovery is disabled. Contact your administrator.' });
    }
    return res.status(501).json({ error: 'Password recovery email flow is not implemented yet.' });
  });

  app.get('/api/user/settings', requireAuth, async (req, res) => {
    try {
      const settings = await getUserAiSettings(req.auth.email);
      return res.json({ settings });
    } catch (error) {
      return res.status(500).json({ error: String(error.message || error) });
    }
  });

  app.put('/api/user/settings', requireAuth, async (req, res) => {
    const settings = req.body?.settings || {};
    const keepExistingKey = Boolean(req.body?.keepExistingKey ?? true);
    try {
      const saved = await saveUserAiSettings(req.auth.email, settings, { keepExistingKey });
      return res.json({ settings: saved });
    } catch (error) {
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.get('/api/auth/oauth/:provider/start', startOAuth);
  app.get('/api/auth/oauth/:provider/callback', handleOAuthCallback);

  app.get('/api/admin/settings', requireAuth, requireAdmin, async (req, res) => {
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

  app.put('/api/admin/settings/registration', requireAuth, requireAdmin, async (req, res) => {
    try {
      const enabled = Boolean(req.body?.enabled);
      const registrationEnabled = await setRegistrationEnabled(enabled);
      return res.json({ registrationEnabled });
    } catch (error) {
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.put('/api/admin/settings/monetization', requireAuth, requireAdmin, async (req, res) => {
    const monetization = req.body?.monetization || {};
    const keepExistingSharedKey = Boolean(req.body?.keepExistingSharedKey ?? true);
    try {
      const saved = await saveMonetizationConfig(monetization, { keepExistingSharedKey });
      return res.json({ monetization: saved });
    } catch (error) {
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.put('/api/admin/users/:email/lock', requireAuth, requireAdmin, async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
      const locked = Boolean(req.body?.locked);
      await setUserLockedByAdmin(req.auth.email, email, locked);
      return res.json({ ok: true });
    } catch (error) {
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.put('/api/admin/users/:email/role', requireAuth, requireAdmin, async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
      const role = String(req.body?.role || 'user');
      await setUserRoleByAdmin(req.auth.email, email, role);
      return res.json({ ok: true });
    } catch (error) {
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.put('/api/admin/users/:email/tier', requireAuth, requireAdmin, async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
      const tier = String(req.body?.tier || 'byok').trim().toLowerCase();
      await setUserTierByAdmin(req.auth.email, email, tier);
      return res.json({ ok: true });
    } catch (error) {
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.delete('/api/admin/users/:email', requireAuth, requireAdmin, async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
      await deleteUserByAdmin(req.auth.email, email);
      return res.json({ ok: true });
    } catch (error) {
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.put('/api/admin/users/:email/password', requireAuth, requireAdmin, async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      await resetUserPasswordByAdmin(req.auth.email, email, password);
      return res.json({ ok: true, mustChangePassword: true });
    } catch (error) {
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.get('/api/stories', requireAuth, requirePasswordFresh, async (req, res) => {
    try {
      return res.json({ stories: await listStoriesByUser(req.auth.email) });
    } catch {
      return res.status(500).json({ error: 'Failed to fetch stories' });
    }
  });

  app.post('/api/stories', requireAuth, requirePasswordFresh, async (req, res) => {
    const story = req.body?.story;
    if (!story?.id) return res.status(400).json({ error: 'story payload is required' });
    try {
      const created = await withTransientLock(`story:${req.auth.email}:${story.id}`, 8000, async () =>
        createStory(req.auth.email, story)
      );
      return res.status(201).json({ story: created });
    } catch (error) {
      if (error?.code === 'TRANSIENT_LOCKED') return res.status(409).json({ error: error.message });
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.put('/api/stories/:storyId', requireAuth, requirePasswordFresh, async (req, res) => {
    const story = req.body?.story;
    const storyId = req.params.storyId;
    if (!story || story.id !== storyId) return res.status(400).json({ error: 'matching story is required' });

    try {
      const saved = await withTransientLock(`story:${req.auth.email}:${story.id}`, 8000, async () =>
        saveStory(req.auth.email, story)
      );
      return res.json({ story: saved });
    } catch (error) {
      if (error?.code === 'TRANSIENT_LOCKED') return res.status(409).json({ error: error.message });
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.post('/api/stories/sync', requireAuth, requirePasswordFresh, async (req, res) => {
    const stories = req.body?.stories;
    if (!Array.isArray(stories)) return res.status(400).json({ error: 'stories[] are required' });

    try {
      const result = await withTransientLock(`sync:${req.auth.email}`, 15000, async () => syncStories(req.auth.email, stories));
      return res.json(result);
    } catch (error) {
      if (error?.code === 'TRANSIENT_LOCKED') return res.status(409).json({ error: error.message });
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.delete('/api/stories/:storyId', requireAuth, requirePasswordFresh, async (req, res) => {
    try {
      const deleted = await withTransientLock(`story:${req.auth.email}:${req.params.storyId}`, 8000, async () =>
        deleteStory(req.auth.email, req.params.storyId)
      );
      return res.json({ deleted });
    } catch (error) {
      if (error?.code === 'TRANSIENT_LOCKED') return res.status(409).json({ error: error.message });
      return res.status(500).json({ error: String(error?.message || 'Failed to delete story') });
    }
  });

  app.get('/api/account/backup', requireAuth, requirePasswordFresh, async (req, res) => {
    try {
      const backup = await buildAccountBackup(req.auth.email);
      return res.json({ backup });
    } catch (error) {
      return res.status(500).json({ error: String(error?.message || 'Failed to build backup') });
    }
  });

  app.post('/api/account/restore', requireAuth, requirePasswordFresh, async (req, res) => {
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

  function estimateAiRequestSize(task, body = {}) {
    const chunks = [];
    const addChunk = (value, max = 0) => {
      if (value === undefined || value === null) return;
      const raw = typeof value === 'string' ? value : JSON.stringify(value);
      if (!raw) return;
      chunks.push(max > 0 ? raw.slice(0, max) : raw);
    };

    addChunk(body.query, 8000);
    addChunk(body.text, 50000);
    addChunk(body.storyText, 50000);
    addChunk(body.description, 8000);
    addChunk(body.storySummary, 12000);
    addChunk(body.currentPoints, 12000);
    addChunk(body.existingCharacters, 12000);
    addChunk(body.existingLocations, 12000);
    addChunk(body.existingPlotPoints, 12000);
    addChunk(body.styleRequest, 4000);
    addChunk(body.story, 12000);

    if (task === 'chat' && body.state && typeof body.state === 'object') {
      const state = body.state;
      const chapters = Array.isArray(state.chapters) ? state.chapters : [];
      const currentId = String(state.currentChapterId || '');
      const chapterOrder = chapters
        .map((chapter, index) => ({
          id: String(chapter?.id || `chapter-${index + 1}`),
          order: Number.isFinite(Number(chapter?.order)) ? Number(chapter.order) : index + 1,
          content: String(chapter?.content || ''),
        }))
        .sort((a, b) => a.order - b.order);
      let idx = chapterOrder.findIndex((chapter) => chapter.id === currentId);
      if (idx < 0) idx = chapterOrder.length > 0 ? chapterOrder.length - 1 : -1;
      const currentChapter = idx >= 0 ? chapterOrder[idx] : null;
      const previousChapter = idx > 0 ? chapterOrder[idx - 1] : null;
      addChunk(currentChapter?.content || '', 12000);
      addChunk(previousChapter?.content || '', 8000);
      addChunk(state.characters, 12000);
      addChunk(state.locations, 12000);
      addChunk(state.plotPoints, 12000);
    } else {
      addChunk(body.state, 20000);
    }

    const chars = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    if (chars <= 4000) return 'short';
    if (chars <= 16000) return 'medium';
    return 'long';
  }

  async function handleAi(req, res, task, fn) {
    const storyId = req.body?.storyId || null;
    const actorEmail = req.auth?.email || null;

    try {
      const windowSeconds = Math.max(5, Number(process.env.BEWRITTEN_AI_RATE_WINDOW_SECONDS || 20));
      const maxInWindow = Math.max(1, Number(process.env.BEWRITTEN_AI_RATE_MAX || 8));
      if (actorEmail) {
        const count = await incrementTransientCounter(`ai:${actorEmail}:${task}`, windowSeconds);
        if (count > maxInWindow) {
          return res.status(429).json({ error: 'AI is currently busy. You are trying too much right now, please try again shortly.' });
        }

        try {
          const sizeBucket = estimateAiRequestSize(task, req.body || {});
          await chargeTokensForTask(actorEmail, task, { sizeBucket });
        } catch (e) {
          if (e?.code === 'INSUFFICIENT_TOKENS') {
            const status = await getUserCreditStatus(actorEmail).catch(() => null);
            return res.status(402).json({
              error: String(e.message || 'Not enough tokens'),
              credits: status,
            });
          }
          throw e;
        }
      }

      await recordAiRun({ storyId, actorEmail, task, status: 'started' });
      const data = await fn();
      await recordAiRun({ storyId, actorEmail, task, status: 'succeeded' });
      return res.json(data);
    } catch (error) {
      await recordAiRun({ storyId, actorEmail, task, status: 'failed', errorMessage: String(error) });
      const rawMessage = error instanceof Error ? error.message : String(error || 'AI request failed');
      const lower = rawMessage.toLowerCase();
      const message =
        lower.includes('resource_exhausted') ||
        lower.includes('rate') ||
        lower.includes('quota') ||
        lower.includes('too many requests') ||
        lower.includes('429')
          ? 'AI is currently busy. You are trying too much right now, please try again shortly.'
          : rawMessage;
      return res.status(500).json({ error: message });
    }
  }

  const normalizePlotPoints = (points = []) =>
    (Array.isArray(points) ? points : [])
      .map((p) => ({
        title: String(p?.title || '').trim() || 'Untitled Event',
        description: String(p?.description || '').trim(),
        tensionLevel: Math.max(1, Math.min(10, Number(p?.tensionLevel || 5))),
      }))
      .filter((p) => p.title || p.description);

  const truncateText = (value, max) => {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.length <= max) return text;
    return `${text.slice(0, max)}...`;
  };

  const buildCoAuthorContext = (state) => {
    const storyTitle = String(state?.title || '').trim() || 'Untitled Story';
    const chapters = Array.isArray(state?.chapters) ? state.chapters.slice() : [];
    const normalizedChapters = chapters
      .map((chapter, index) => ({
        id: String(chapter?.id || `chapter-${index + 1}`),
        title: String(chapter?.title || `Chapter ${index + 1}`),
        content: String(chapter?.content || ''),
        order: Number.isFinite(Number(chapter?.order)) ? Number(chapter.order) : index + 1,
      }))
      .sort((a, b) => a.order - b.order);

    const currentChapterId = String(state?.currentChapterId || '');
    let currentIndex = normalizedChapters.findIndex((chapter) => chapter.id === currentChapterId);
    if (currentIndex < 0) currentIndex = normalizedChapters.length > 0 ? normalizedChapters.length - 1 : -1;

    const currentChapter = currentIndex >= 0 ? normalizedChapters[currentIndex] : null;
    const previousChapter = currentIndex > 0 ? normalizedChapters[currentIndex - 1] : null;

    const characters = Array.isArray(state?.characters) ? state.characters : [];
    const characterBrief = characters.slice(0, 12).map((character) => {
      const name = String(character?.name || 'Unnamed');
      const role = String(character?.role || 'Support');
      const desc = truncateText(character?.description, 120);
      const traits = Array.isArray(character?.traits) ? character.traits.slice(0, 3).join(', ') : '';
      return `${name} (${role})${traits ? ` [${traits}]` : ''}${desc ? `: ${desc}` : ''}`;
    });

    const locations = Array.isArray(state?.locations) ? state.locations : [];
    const worldBrief = locations.slice(0, 12).map((location) => {
      const name = String(location?.name || 'Unknown Place');
      const desc = truncateText(location?.description || location?.atmosphere || '', 110);
      const history = Array.isArray(location?.history) ? location.history : [];
      const recent = history
        .slice(-2)
        .map((h) => truncateText(h?.description, 80))
        .filter(Boolean)
        .join(' | ');
      return `${name}${desc ? `: ${desc}` : ''}${recent ? ` (Recent: ${recent})` : ''}`;
    });

    const plotPoints = Array.isArray(state?.plotPoints) ? state.plotPoints : [];
    const chapterPlot = plotPoints
      .filter((point) => String(point?.chapterId || '') === String(currentChapter?.id || '__none__'))
      .slice(0, 8)
      .map((point) => `${point?.title || 'Untitled'} [Tension ${Number(point?.tensionLevel || 5)}]: ${truncateText(point?.description, 110)}`);
    const recentGlobalPlot = plotPoints
      .slice(-8)
      .map((point) => `${point?.title || 'Untitled'} [Tension ${Number(point?.tensionLevel || 5)}]`);

    const currentText = truncateText(currentChapter?.content || '', 9000);
    const previousText = truncateText(previousChapter?.content || '', 5000);

    return {
      storyTitle,
      currentChapterTitle: currentChapter?.title || 'No chapter selected',
      previousChapterTitle: previousChapter?.title || '',
      currentText,
      previousText,
      characterBrief,
      worldBrief,
      chapterPlot,
      recentGlobalPlot,
    };
  };

  const buildConsensus = (runs = []) => {
    const normalizedRuns = runs.map((run) => normalizePlotPoints(run));
    const maxLen = Math.max(0, ...normalizedRuns.map((r) => r.length));
    const consensus = [];

    for (let i = 0; i < maxLen; i += 1) {
      const slice = normalizedRuns.map((r) => r[i]).filter(Boolean);
      if (slice.length === 0) continue;

      const avgTensionRaw = slice.reduce((sum, p) => sum + p.tensionLevel, 0) / slice.length;
      const avgTension = Math.max(1, Math.min(10, Number(avgTensionRaw.toFixed(1))));
      const titleVotes = new Map();
      for (const p of slice) {
        const key = p.title.toLowerCase();
        titleVotes.set(key, (titleVotes.get(key) || 0) + 1);
      }
      const winningTitleKey = [...titleVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      const winningTitle = slice.find((p) => p.title.toLowerCase() === winningTitleKey)?.title || slice[0].title;
      const winningDescription = slice.find((p) => p.description)?.description || '';

      consensus.push({
        title: winningTitle,
        description: winningDescription,
        tensionLevel: avgTension,
      });
    }

    return consensus;
  };

  app.post('/api/ai/continuity', requireAuth, requirePasswordFresh, (req, res) =>
    handleAi(req, res, 'continuity', async () => {
      const { storyText, characters = [], locations = [], plotPoints = [] } = req.body;
      const prompt = `You are a continuity editor.\nCharacters:${JSON.stringify(characters)}\nLocations:${JSON.stringify(locations)}\nPlot:${JSON.stringify(plotPoints)}\nText:${String(storyText || '').slice(0, 40000)}`;
      const results = await runJsonPrompt({ prompt, schema: Schema.continuity, fallback: [], actorEmail: req.auth.email });
      return { results };
    })
  );

  app.post('/api/ai/character-profile', requireAuth, requirePasswordFresh, (req, res) =>
    handleAi(req, res, 'character-profile', async () => {
      const prompt = `Create a concise character profile from this description: \"${req.body?.description || ''}\".`;
      const profile = await runJsonPrompt({
        prompt,
        schema: Schema.characterProfile,
        fallback: { name: 'New Character', role: 'Support', description: String(req.body?.description || ''), traits: [] },
        actorEmail: req.auth.email,
      });
      return { profile };
    })
  );

  app.post('/api/ai/plot-suggestion', requireAuth, requirePasswordFresh, (req, res) =>
    handleAi(req, res, 'plot-suggestion', async () => {
      const { currentPoints = [], storySummary = '' } = req.body;
      const prompt = `Given plot points ${JSON.stringify(currentPoints)} and summary ${storySummary}, suggest next plot point with tensionLevel 1-10.`;
      const plotPoint = await runJsonPrompt({
        prompt,
        schema: Schema.plotPoint,
        fallback: { title: 'Raise the Stakes', description: 'A conflict forces a costly decision.', tensionLevel: 6 },
        actorEmail: req.auth.email,
      });
      return { plotPoint };
    })
  );

  app.post('/api/ai/extract-characters', requireAuth, requirePasswordFresh, (req, res) =>
    handleAi(req, res, 'extract-characters', async () => {
      const { text = '', existingCharacters = [] } = req.body;
      const prompt = `Extract new characters and updates from text. Existing:${JSON.stringify(existingCharacters)} Text:${String(text).slice(0, 30000)}`;
      return await runJsonPrompt({ prompt, schema: Schema.extractedCharacters, fallback: { newCharacters: [], updates: [] }, actorEmail: req.auth.email });
    })
  );

  app.post('/api/ai/extract-world', requireAuth, requirePasswordFresh, (req, res) =>
    handleAi(req, res, 'extract-world', async () => {
      const { text = '', existingLocations = [] } = req.body;
      const prompt = `Extract world events and locations. Existing:${JSON.stringify(existingLocations)} Text:${String(text).slice(0, 30000)}`;
      const worldEvents = await runJsonPrompt({ prompt, schema: Schema.worldEvents, fallback: [], actorEmail: req.auth.email });
      return { worldEvents };
    })
  );

  app.post('/api/ai/extract-plot', requireAuth, requirePasswordFresh, (req, res) =>
    handleAi(req, res, 'extract-plot', async () => {
      const prompt = `Extract plot points from text:${String(req.body?.text || '').slice(0, 30000)}`;
      const plotPoints = await runJsonPrompt({ prompt, schema: Schema.plotList, fallback: [], actorEmail: req.auth.email });
      return { plotPoints };
    })
  );

  app.post('/api/ai/plot-consensus', requireAuth, requirePasswordFresh, (req, res) =>
    handleAi(req, res, 'plot-consensus', async () => {
      const text = String(req.body?.text || '').slice(0, 35000);
      const existingPlotPoints = normalizePlotPoints(req.body?.existingPlotPoints || []);
      const chapterTitle = String(req.body?.chapterTitle || 'Current Chapter');
      if (!text.trim()) return { runs: [[], [], []], consensus: [] };

      const run1Prompt = `Analyze this chapter and return estimated plot beats with tensionLevel 1-10.\nChapter:${chapterTitle}\nText:${text}`;
      const run1 = normalizePlotPoints(
        await runJsonPrompt({ prompt: run1Prompt, schema: Schema.plotList, fallback: [], actorEmail: req.auth.email })
      );

      const sharedContext = JSON.stringify(existingPlotPoints.slice(0, 40));
      const run1Context = JSON.stringify(run1.slice(0, 40));
      const run2Prompt = `Fresh pass. Estimate plot beats and tension for this chapter using story context.\nExisting Plot Context:${sharedContext}\nFirst Pass:${run1Context}\nChapter:${chapterTitle}\nText:${text}`;
      const run2 = normalizePlotPoints(
        await runJsonPrompt({ prompt: run2Prompt, schema: Schema.plotList, fallback: [], actorEmail: req.auth.email })
      );

      const run2Context = JSON.stringify(run2.slice(0, 40));
      const run3Prompt = `Fresh independent pass. Estimate plot beats and tension for this chapter with these references.\nExisting Plot Context:${sharedContext}\nFirst Pass:${run1Context}\nSecond Pass:${run2Context}\nChapter:${chapterTitle}\nText:${text}`;
      const run3 = normalizePlotPoints(
        await runJsonPrompt({ prompt: run3Prompt, schema: Schema.plotList, fallback: [], actorEmail: req.auth.email })
      );

      return {
        runs: [run1, run2, run3],
        consensus: buildConsensus([run1, run2, run3]),
      };
    })
  );

  app.post('/api/ai/chat', requireAuth, requirePasswordFresh, (req, res) =>
    handleAi(req, res, 'chat', async () => {
      const { query = '', state } = req.body;
      const ctx = buildCoAuthorContext(state || {});
      const prompt = [
        'You are a practical writing co-author.',
        'Use only the context below and respond with concise, useful guidance for drafting prose.',
        '',
        `Story Title: ${ctx.storyTitle}`,
        `Current Chapter: ${ctx.currentChapterTitle}`,
        `Previous Chapter: ${ctx.previousChapterTitle || 'N/A (this is likely the first chapter)'}`,
        '',
        'Need-to-Know Characters:',
        ctx.characterBrief.length ? ctx.characterBrief.map((line) => `- ${line}`).join('\n') : '- None provided',
        '',
        'Need-to-Know World:',
        ctx.worldBrief.length ? ctx.worldBrief.map((line) => `- ${line}`).join('\n') : '- None provided',
        '',
        'Current Chapter Plot Points:',
        ctx.chapterPlot.length ? ctx.chapterPlot.map((line) => `- ${line}`).join('\n') : '- None extracted for current chapter',
        '',
        'Recent Global Plot Points:',
        ctx.recentGlobalPlot.length ? ctx.recentGlobalPlot.map((line) => `- ${line}`).join('\n') : '- None provided',
        '',
        'Previous Chapter Text (for continuity only):',
        ctx.previousText || '[No previous chapter text]',
        '',
        'Current Chapter Text (primary context):',
        ctx.currentText || '[No current chapter text]',
        '',
        `User Query: ${query}`,
      ].join('\n');
      const reply = await runTextPrompt({ prompt, fallback: 'Focus next scene on conflict, decision, and consequence.', actorEmail: req.auth.email });
      return { reply };
    })
  );

  app.post('/api/ai/layout-css', requireAuth, requirePasswordFresh, (req, res) =>
    handleAi(req, res, 'layout-css', async () => {
      const prompt = `Generate raw CSS for print book layout style: ${req.body?.styleRequest || 'clean novel formatting'}. Include @page, body, headings, chapter titles, paragraphs.`;
      const css = await runTextPrompt({
        prompt,
        fallback: '@page { margin: 2cm; } body { font-family: serif; line-height: 1.6; } .chapter { page-break-before: always; } p { text-indent: 1.5em; margin: 0; }',
        actorEmail: req.auth.email,
      });
      return { css };
    })
  );

  app.post('/api/ai/blurb', requireAuth, requirePasswordFresh, (req, res) =>
    handleAi(req, res, 'blurb', async () => {
      const story = req.body?.story;
      const prompt = `Write a back-cover blurb under 150 words for this story: ${JSON.stringify(story || {})}`;
      const blurb = await runTextPrompt({ prompt, fallback: 'A gripping story unfolds as hidden truths collide with impossible choices.', actorEmail: req.auth.email });
      return { blurb };
    })
  );

  app.post('/api/ai/story-insights', requireAuth, requirePasswordFresh, (req, res) =>
    handleAi(req, res, 'story-insights', async () => {
      const story = req.body?.story || {};
      const focusRaw = String(req.body?.focus || 'all').trim().toLowerCase();
      const focusMap = {
        all: 'all',
        synopsis: 'synopsis',
        backcover: 'backcover',
        'back-cover': 'backcover',
        detailednotes: 'details',
        details: 'details',
      };
      const focus = focusMap[focusRaw] || 'all';
      const title = String(story?.title || 'Untitled Story').trim() || 'Untitled Story';
      const chapters = Array.isArray(story?.chapters) ? story.chapters : [];
      const manuscript = chapters
        .map((chapter, idx) => {
          const chapterTitle = String(chapter?.title || `Chapter ${idx + 1}`);
          const content = String(chapter?.content || '').trim();
          return `[${chapterTitle}]\n${content}`;
        })
        .join('\n\n')
        .slice(0, 70000);
      const characters = JSON.stringify(Array.isArray(story?.characters) ? story.characters.slice(0, 40) : []);
      const locations = JSON.stringify(Array.isArray(story?.locations) ? story.locations.slice(0, 40) : []);
      const plotPoints = JSON.stringify(Array.isArray(story?.plotPoints) ? story.plotPoints.slice(0, 80) : []);

      const prompt = [
        'You are a fiction editorial assistant.',
        `Return JSON with keys: synopsis, backCover, detailedNotes.`,
        'Requirements:',
        '- synopsis: 120-220 words.',
        '- backCover: 90-150 words in compelling back-cover style, no spoilers beyond midpoint.',
        '- detailedNotes: 6-10 concise bullets about themes, hooks, genre fit, strengths, and revision opportunities.',
        `Current user focus: ${focus}. Prioritize this focus in quality, but still return all keys.`,
        '',
        `Story Title: ${title}`,
        `Characters: ${characters}`,
        `World: ${locations}`,
        `Plot Points: ${plotPoints}`,
        '',
        'Manuscript:',
        manuscript || '[No chapter content provided]',
      ].join('\n');

      const insights = await runJsonPrompt({
        prompt,
        schema: Schema.storyInsights,
        fallback: {
          synopsis: 'No synopsis available yet.',
          backCover: 'No back-cover text available yet.',
          detailedNotes: '- Add more chapter content to generate detailed notes.',
        },
        actorEmail: req.auth.email,
      });
      return { insights };
    })
  );

  app.post('/api/ai/story-review', requireAuth, requirePasswordFresh, (req, res) =>
    handleAi(req, res, 'story-review', async () => {
      const story = req.body?.story || {};
      const genre = String(req.body?.genre || '').trim() || 'unspecified';
      const title = String(story?.title || 'Untitled Story').trim() || 'Untitled Story';
      const chapters = Array.isArray(story?.chapters) ? story.chapters : [];
      const manuscript = chapters
        .map((chapter, idx) => {
          const chapterTitle = String(chapter?.title || `Chapter ${idx + 1}`);
          const content = String(chapter?.content || '').trim();
          return `[${chapterTitle}]\n${content}`;
        })
        .join('\n\n')
        .slice(0, 70000);
      const characters = JSON.stringify(Array.isArray(story?.characters) ? story.characters.slice(0, 40) : []);
      const locations = JSON.stringify(Array.isArray(story?.locations) ? story.locations.slice(0, 40) : []);
      const plotPoints = JSON.stringify(Array.isArray(story?.plotPoints) ? story.plotPoints.slice(0, 80) : []);

      const prompt = [
        'You are a strict senior fiction editor.',
        'Return JSON only with keys: verdict, criticalReview, priorityFixes, riskScore.',
        'Style constraints:',
        '- Be candid and critical, not passively positive.',
        '- Include concrete weaknesses before praise.',
        '- Avoid generic compliments.',
        '- riskScore is 1-10 where 10 means high manuscript risk.',
        '- priorityFixes must be 5-8 actionable items.',
        '',
        `Genre: ${genre}`,
        `Story Title: ${title}`,
        `Characters: ${characters}`,
        `World: ${locations}`,
        `Plot Points: ${plotPoints}`,
        '',
        'Manuscript:',
        manuscript || '[No chapter content provided]',
      ].join('\n');

      const review = await runJsonPrompt({
        prompt,
        schema: Schema.storyReview,
        fallback: {
          verdict: 'Insufficient manuscript data for a rigorous review.',
          criticalReview: 'Provide more chapter content to enable a meaningful critical review.',
          priorityFixes: ['Add at least one complete chapter before requesting review.'],
          riskScore: 7,
        },
        actorEmail: req.auth.email,
      });
      return { review };
    })
  );

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('dist')));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  }

  return app;
}
