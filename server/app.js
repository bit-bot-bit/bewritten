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

export const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

export let adminBootstrap = { email: 'pending', created: false };

export async function initApp() {
  await initDb();
  adminBootstrap = await bootstrapAdminUser();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, adminBootstrap });
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
      return res.status(201).json({ story: await createStory(req.auth.email, story) });
    } catch (error) {
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.put('/api/stories/:storyId', requireAuth, requirePasswordFresh, async (req, res) => {
    const story = req.body?.story;
    const storyId = req.params.storyId;
    if (!story || story.id !== storyId) return res.status(400).json({ error: 'matching story is required' });

    try {
      return res.json({ story: await saveStory(req.auth.email, story) });
    } catch (error) {
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.post('/api/stories/sync', requireAuth, requirePasswordFresh, async (req, res) => {
    const stories = req.body?.stories;
    if (!Array.isArray(stories)) return res.status(400).json({ error: 'stories[] are required' });

    try {
      return res.json(await syncStories(req.auth.email, stories));
    } catch (error) {
      return res.status(400).json({ error: String(error.message || error) });
    }
  });

  app.delete('/api/stories/:storyId', requireAuth, requirePasswordFresh, async (req, res) => {
    try {
      return res.json({ deleted: await deleteStory(req.auth.email, req.params.storyId) });
    } catch {
      return res.status(500).json({ error: 'Failed to delete story' });
    }
  });

  async function handleAi(req, res, task, fn) {
    const storyId = req.body?.storyId || null;
    const actorEmail = req.auth?.email || null;

    try {
      await recordAiRun({ storyId, actorEmail, task, status: 'started' });
      const data = await fn();
      await recordAiRun({ storyId, actorEmail, task, status: 'succeeded' });
      return res.json(data);
    } catch (error) {
      await recordAiRun({ storyId, actorEmail, task, status: 'failed', errorMessage: String(error) });
      const message = error instanceof Error ? error.message : String(error || 'AI request failed');
      return res.status(500).json({ error: message });
    }
  }

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
