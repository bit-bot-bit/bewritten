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

export const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

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
      return res.status(401).json({ error: String(error.message || error) });
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
          await chargeTokensForTask(actorEmail, task);
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
      const prompt = `You are a practical writing co-author. Story:${state?.title || ''} Query:${query}`;
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

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('dist')));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  }

  return app;
}
