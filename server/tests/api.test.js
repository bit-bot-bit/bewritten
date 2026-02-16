
import request from 'supertest';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.resolve('./server/test.db');
const USER_EMAIL = 'test@example.com';
const USER_PASSWORD = 'password123';
const USER_TEMP_PASSWORD = 'TempPass123!';
const USER_FINAL_PASSWORD = 'FinalPass123!';

describe('API Tests', () => {
  let app;
  let initApp;
  let getDb;
  let userToken;
  let adminToken;

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

  test('Admin can reset user password and force password change flow', async () => {
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'adminpassword123' });
    expect(adminLogin.statusCode).toBe(200);
    adminToken = adminLogin.body.token;

    const resetRes = await request(app)
      .put(`/api/admin/users/${encodeURIComponent(USER_EMAIL)}/password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: USER_TEMP_PASSWORD });
    expect(resetRes.statusCode).toBe(200);
    expect(resetRes.body.mustChangePassword).toBe(true);

    const oldPasswordLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: USER_EMAIL, password: USER_PASSWORD });
    expect(oldPasswordLogin.statusCode).toBe(401);

    const tempPasswordLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: USER_EMAIL, password: USER_TEMP_PASSWORD });
    expect(tempPasswordLogin.statusCode).toBe(200);
    expect(tempPasswordLogin.body.user.mustChangePassword).toBe(true);
    userToken = tempPasswordLogin.body.token;

    const blockedStories = await request(app)
      .get('/api/stories')
      .set('Authorization', `Bearer ${userToken}`);
    expect(blockedStories.statusCode).toBe(403);

    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ currentPassword: USER_TEMP_PASSWORD, newPassword: USER_FINAL_PASSWORD });
    expect(changeRes.statusCode).toBe(200);
    expect(changeRes.body.user.mustChangePassword).toBe(false);

    const finalLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: USER_EMAIL, password: USER_FINAL_PASSWORD });
    expect(finalLogin.statusCode).toBe(200);
    userToken = finalLogin.body.token;

    const storiesAllowed = await request(app)
      .get('/api/stories')
      .set('Authorization', `Bearer ${userToken}`);
    expect(storiesAllowed.statusCode).toBe(200);
  });

  test('Admin cannot delete self account', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${encodeURIComponent('admin@example.com')}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(400);
    expect(String(res.body.error || '')).toMatch(/cannot delete your own account/i);
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

  test('Export and Restore Account Backup', async () => {
    const exportRes = await request(app)
      .get('/api/account/backup')
      .set('Authorization', `Bearer ${userToken}`);
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.body.backup.format).toBe('bewritten.account-backup');
    expect(Array.isArray(exportRes.body.backup.payload.stories)).toBe(true);
    expect(exportRes.body.backup.payload.stories.length).toBeGreaterThan(0);

    const delRes = await request(app)
      .delete('/api/stories/story-1')
      .set('Authorization', `Bearer ${userToken}`);
    expect(delRes.statusCode).toBe(200);
    expect(delRes.body.deleted).toBe(true);

    const restoreRes = await request(app)
      .post('/api/account/restore')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ backup: exportRes.body.backup, mode: 'replace' });
    expect(restoreRes.statusCode).toBe(200);
    expect(restoreRes.body.result.mode).toBe('replace');

    const listRes = await request(app)
      .get('/api/stories')
      .set('Authorization', `Bearer ${userToken}`);
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.stories).toHaveLength(1);
    expect(listRes.body.stories[0].id).toBe('story-1');
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
