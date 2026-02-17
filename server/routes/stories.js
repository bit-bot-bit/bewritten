import express from 'express';
import { listStoriesByUser, getStoryById, createStory, saveStory, syncStories, deleteStory } from '../storyStore.js';
import { requireAuth, requirePasswordFresh } from '../auth.js';
import { withTransientLock } from '../transientState.js';

const router = express.Router();

router.use(requireAuth);
router.use(requirePasswordFresh);

router.get('/', async (req, res) => {
  try {
    return res.json({ stories: await listStoriesByUser(req.auth.email) });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

router.post('/', async (req, res) => {
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

router.get('/:storyId', async (req, res) => {
  try {
    const storyId = req.params.storyId;
    const story = await getStoryById(req.auth.email, storyId);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    return res.json({ story });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || 'Failed to fetch story') });
  }
});

router.put('/:storyId', async (req, res) => {
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

router.post('/sync', async (req, res) => {
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

router.delete('/:storyId', async (req, res) => {
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

export default router;
