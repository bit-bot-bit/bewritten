import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDb } from './db.js';
import { bootstrapAdminUser } from './auth.js';
import { getTransientInfo } from './transientState.js';

import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import storiesRouter from './routes/stories.js';
import aiRouter from './routes/ai.js';
import adminRouter from './routes/admin.js';

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

  // Mount routers
  app.use('/api/auth', authRouter);
  app.use('/api', userRouter); // Mounts /api/user/* and /api/account/* routes
  app.use('/api/stories', storiesRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/admin', adminRouter);

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('dist')));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  }

  return app;
}
