
import request from 'supertest';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.resolve('./server/test.db');
const USER_EMAIL = 'test@example.com';
const USER_PASSWORD = 'password123';

describe('API Tests', () => {
  let app;
  let initApp;
  let getDb;
  let userToken;

  beforeAll(async () => {
    // Clean up before starting
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

    // Set env vars before imports
    process.env.BEWRITTEN_DB_PATH = TEST_DB;
    process.env.BEWRITTEN_ADMIN_EMAIL = 'admin@example.com';
    process.env.BEWRITTEN_ADMIN_PASSWORD = 'adminpassword123';
    process.env.NODE_ENV = 'development'; // To use sqlite config

    // Dynamically import app to pick up env vars
    const appModule = await import('../app.js');
    initApp = appModule.initApp;
    const dbModule = await import('../db.js');
    getDb = dbModule.getDb;

    app = await initApp();
  });

  afterAll(async () => {
    // Clean up after finishing
    if (getDb) {
      await getDb().destroy();
    }
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  test('Health Check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.adminBootstrap.email).toBe('admin@example.com');
  });

  test('Register User', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: USER_EMAIL, password: USER_PASSWORD });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(USER_EMAIL);

    userToken = res.body.token;
  });

  test('Get Current User (Me)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe(USER_EMAIL);
  });

  test('Create Story', async () => {
    const storyPayload = { id: 'story-1', title: 'My Epic Tale' };
    const res = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ story: storyPayload });

    expect(res.statusCode).toBe(201);
    expect(res.body.story.title).toBe('My Epic Tale');
  });

  test('List Stories', async () => {
    const res = await request(app)
      .get('/api/stories')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.stories).toHaveLength(1);
    expect(res.body.stories[0].id).toBe('story-1');
  });

  test('Update Story', async () => {
    const storyPayload = { id: 'story-1', title: 'My Epic Tale Updated' };
    const res = await request(app)
      .put('/api/stories/story-1')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ story: storyPayload });

    expect(res.statusCode).toBe(200);
    expect(res.body.story.title).toBe('My Epic Tale Updated');
  });

  test('Delete Story', async () => {
    const res = await request(app)
      .delete('/api/stories/story-1')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.deleted).toBe(true);

    // Verify deletion
    const listRes = await request(app)
      .get('/api/stories')
      .set('Authorization', `Bearer ${userToken}`);
    expect(listRes.body.stories).toHaveLength(0);
  });
});
