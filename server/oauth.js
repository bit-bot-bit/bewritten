import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { getDb } from './db.js';
import { issueSessionForEmail, upsertOAuthUser } from './auth.js';

function nowIso() {
  return new Date().toISOString();
}

const PROVIDERS = {
  google: {
    id: 'google',
    label: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    env: {
      clientId: 'GOOGLE_CLIENT_ID',
      clientSecret: 'GOOGLE_CLIENT_SECRET',
    },
    scopes: ['openid', 'email', 'profile'],
  },
  github: {
    id: 'github',
    label: 'GitHub',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userUrl: 'https://api.github.com/user',
    userEmailUrl: 'https://api.github.com/user/emails',
    env: {
      clientId: 'GITHUB_CLIENT_ID',
      clientSecret: 'GITHUB_CLIENT_SECRET',
    },
    scopes: ['read:user', 'user:email'],
  },
  microsoft: {
    id: 'microsoft',
    label: 'Microsoft',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userUrl: 'https://graph.microsoft.com/v1.0/me',
    env: {
      clientId: 'MICROSOFT_CLIENT_ID',
      clientSecret: 'MICROSOFT_CLIENT_SECRET',
    },
    scopes: ['openid', 'email', 'profile', 'User.Read'],
  },
  apple: {
    id: 'apple',
    label: 'Apple',
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    env: {
      clientId: 'APPLE_CLIENT_ID',
      clientSecret: 'APPLE_CLIENT_SECRET',
    },
    scopes: ['name', 'email'],
  },
};

function getPublicBase(req) {
  return String(process.env.BEWRITTEN_PUBLIC_URL || '').trim() || `${req.protocol}://${req.get('host')}`;
}

function callbackUrl(req, providerId) {
  return `${getPublicBase(req)}/api/auth/oauth/${providerId}/callback`;
}

function isConfigured(p) {
  return Boolean(process.env[p.env.clientId] && process.env[p.env.clientSecret]);
}

function createState(provider, returnTo = '') {
  const db = getDb();
  const state = crypto.randomBytes(24).toString('base64url');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO oauth_states (state, provider, code_verifier, return_to, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(state, provider, codeVerifier, returnTo || '', nowIso(), expiresAt);

  return { state, codeVerifier };
}

function consumeState(state) {
  const db = getDb();
  const row = db.prepare(`SELECT state, provider, code_verifier, return_to, expires_at FROM oauth_states WHERE state = ?`).get(state);
  if (!row) return null;

  db.prepare(`DELETE FROM oauth_states WHERE state = ?`).run(state);
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

function htmlResult({ ok, error, session, returnTo }) {
  const targetOrigin = returnTo || '*';
  const payload = { type: 'bewritten_oauth_result', ok, error: error || null, session: session || null };
  return `<!doctype html><html><body><script>
    (function () {
      const payload = ${JSON.stringify(payload)};
      try {
        if (window.opener) {
          window.opener.postMessage(payload, ${JSON.stringify(targetOrigin)});
        }
      } catch (_e) {}
      window.close();
    })();
  </script></body></html>`;
}

export function listOAuthProviders(req) {
  return Object.values(PROVIDERS)
    .filter((p) => p.id !== 'apple' || process.env.APPLE_CLIENT_ID)
    .map((p) => ({ id: p.id, label: p.label, configured: isConfigured(p), callbackUrl: callbackUrl(req, p.id), requiredEnv: [p.env.clientId, p.env.clientSecret] }));
}

export function getOAuthDiagnostics(req) {
  return listOAuthProviders(req);
}

export function startOAuth(req, res) {
  const providerId = String(req.params.provider || '').toLowerCase();
  const provider = PROVIDERS[providerId];
  if (!provider) return res.status(404).json({ error: 'Unknown provider' });
  if (!isConfigured(provider)) return res.status(400).json({ error: `${provider.label} is not configured` });

  const returnTo = String(req.query.return_to || '').trim();
  const { state } = createState(provider.id, returnTo);

  const redirectUri = callbackUrl(req, provider.id);
  const clientId = process.env[provider.env.clientId];
  const scope = provider.scopes.join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    state,
  });

  if (provider.id === 'google') params.set('access_type', 'offline');
  if (provider.id === 'apple') {
    params.set('response_mode', 'form_post');
  }

  return res.redirect(`${provider.authUrl}?${params.toString()}`);
}

async function exchangeCode(provider, req, code) {
  const redirectUri = callbackUrl(req, provider.id);

  if (provider.id === 'google') {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
    const { tokens } = await client.getToken(code);
    const accessToken = tokens.access_token;
    const resp = await fetch(provider.userUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await resp.json();
    return {
      providerUserId: data.sub || data.id,
      email: data.email,
      displayName: data.name || data.email,
    };
  }

  const tokenBody = new URLSearchParams({
    client_id: process.env[provider.env.clientId],
    client_secret: process.env[provider.env.clientSecret],
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const tokenResp = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: tokenBody.toString(),
  });

  const tokenData = await tokenResp.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) throw new Error('Missing access token');

  if (provider.id === 'github') {
    const userResp = await fetch(provider.userUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
    const user = await userResp.json();
    let email = user.email;
    if (!email) {
      const emailResp = await fetch(provider.userEmailUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
      const emails = await emailResp.json();
      email = Array.isArray(emails) ? (emails.find((e) => e.primary)?.email || emails[0]?.email) : null;
    }
    return {
      providerUserId: String(user.id),
      email,
      displayName: user.name || user.login || email,
    };
  }

  if (provider.id === 'microsoft') {
    const userResp = await fetch(provider.userUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
    const user = await userResp.json();
    return {
      providerUserId: user.id,
      email: user.mail || user.userPrincipalName,
      displayName: user.displayName || user.userPrincipalName,
    };
  }

  throw new Error('Provider flow not fully configured');
}

export async function handleOAuthCallback(req, res) {
  const providerId = String(req.params.provider || '').toLowerCase();
  const provider = PROVIDERS[providerId];
  if (!provider) return res.status(404).json({ error: 'Unknown provider' });

  try {
    const state = String(req.query.state || req.body?.state || '');
    const code = String(req.query.code || req.body?.code || '');
    if (!state || !code) throw new Error('Missing OAuth state or code');

    const saved = consumeState(state);
    if (!saved || saved.provider !== provider.id) throw new Error('Invalid OAuth state');

    const profile = await exchangeCode(provider, req, code);
    if (!profile.email) throw new Error('OAuth provider did not return an email');

    const session = upsertOAuthUser(provider.id, String(profile.providerUserId), String(profile.email), profile.displayName || null);
    return res.status(200).send(htmlResult({ ok: true, session, returnTo: saved.return_to || '*' }));
  } catch (error) {
    const message = String(error?.message || error || 'OAuth failed');
    return res.status(400).send(htmlResult({ ok: false, error: message, returnTo: String(req.query.return_to || '*') }));
  }
}

export function issueSessionForUserEmail(email) {
  const token = issueSessionForEmail(email);
  return token;
}
