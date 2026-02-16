import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';

function parseRedisUrl() {
  const raw = process.env.BEWRITTEN_REDIS_URL || process.env.REDIS_URL || '';
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') return null;
    return {
      raw,
      host: url.hostname,
      port: Number(url.port || 6379),
      tls: url.protocol === 'rediss:',
      password: url.password || null,
      db: Number((url.pathname || '/0').replace('/', '')) || 0,
    };
  } catch {
    return null;
  }
}

function encodeCommand(parts) {
  const chunks = [`*${parts.length}\r\n`];
  for (const part of parts) {
    const value = String(part ?? '');
    chunks.push(`$${Buffer.byteLength(value)}\r\n${value}\r\n`);
  }
  return Buffer.from(chunks.join(''), 'utf8');
}

function parseOneValue(buffer, offset = 0) {
  if (offset >= buffer.length) return null;
  const prefix = String.fromCharCode(buffer[offset]);
  const lineEnd = buffer.indexOf('\r\n', offset);
  if (lineEnd === -1) return null;

  if (prefix === '+' || prefix === '-' || prefix === ':') {
    const raw = buffer.toString('utf8', offset + 1, lineEnd);
    const nextOffset = lineEnd + 2;
    if (prefix === '-') return { value: new Error(raw), nextOffset };
    if (prefix === ':') return { value: Number(raw), nextOffset };
    return { value: raw, nextOffset };
  }

  if (prefix === '$') {
    const len = Number(buffer.toString('utf8', offset + 1, lineEnd));
    const next = lineEnd + 2;
    if (len === -1) return { value: null, nextOffset: next };
    const end = next + len;
    if (buffer.length < end + 2) return null;
    return { value: buffer.toString('utf8', next, end), nextOffset: end + 2 };
  }

  if (prefix === '*') {
    const count = Number(buffer.toString('utf8', offset + 1, lineEnd));
    if (count === -1) return { value: null, nextOffset: lineEnd + 2 };
    let nextOffset = lineEnd + 2;
    const arr = [];
    for (let i = 0; i < count; i += 1) {
      const parsed = parseOneValue(buffer, nextOffset);
      if (!parsed) return null;
      arr.push(parsed.value);
      nextOffset = parsed.nextOffset;
    }
    return { value: arr, nextOffset };
  }

  return null;
}

class RedisRawClient {
  constructor(config) {
    this.config = config;
  }

  command(parts) {
    return new Promise((resolve, reject) => {
      const { host, port, tls: useTls, password, db } = this.config;
      const socket = useTls ? tls.connect({ host, port, servername: host }) : net.createConnection({ host, port });
      let settled = false;
      let recv = Buffer.alloc(0);
      const queue = [];

      const finish = (err, value) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (err) reject(err);
        else resolve(value);
      };

      socket.on('error', (err) => finish(err));
      socket.setTimeout(4000, () => finish(new Error('Redis command timeout')));
      socket.on('connect', () => {
        if (password) queue.push(['AUTH', password]);
        if (db) queue.push(['SELECT', String(db)]);
        queue.push(parts);
        socket.write(Buffer.concat(queue.map((cmd) => encodeCommand(cmd))));
      });

      socket.on('data', (chunk) => {
        recv = Buffer.concat([recv, chunk]);
        let parsed = parseOneValue(recv, 0);
        if (!parsed) return;

        const values = [];
        while (parsed) {
          values.push(parsed.value);
          recv = recv.subarray(parsed.nextOffset);
          parsed = parseOneValue(recv, 0);
        }

        if (values.length < queue.length) return;
        const firstError = values.find((v) => v instanceof Error);
        if (firstError) return finish(firstError);
        const last = values[values.length - 1];
        finish(null, last);
      });
    });
  }
}

const redisConfig = parseRedisUrl();
const redisClient = redisConfig ? new RedisRawClient(redisConfig) : null;

export function getTransientInfo() {
  return {
    enabled: Boolean(redisClient),
    backend: redisClient ? 'redis' : 'none',
    redisUrlConfigured: Boolean(redisConfig?.raw),
  };
}

export async function withTransientLock(key, ttlMs, fn) {
  if (!redisClient) return await fn();

  const token = crypto.randomUUID();
  const lockKey = `bewritten:lock:${key}`;
  const acquired = await redisClient.command(['SET', lockKey, token, 'NX', 'PX', String(ttlMs)]);
  if (acquired !== 'OK') {
    const err = new Error('This content is currently being updated in another request. Please retry.');
    err.code = 'TRANSIENT_LOCKED';
    throw err;
  }

  try {
    return await fn();
  } finally {
    try {
      await redisClient.command([
        'EVAL',
        "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
        '1',
        lockKey,
        token,
      ]);
    } catch {
      // ignore release errors for transient locks
    }
  }
}

export async function incrementTransientCounter(key, windowSeconds) {
  if (!redisClient) return 0;
  const counterKey = `bewritten:counter:${key}`;
  const count = await redisClient.command(['INCR', counterKey]);
  if (Number(count) === 1) {
    await redisClient.command(['EXPIRE', counterKey, String(windowSeconds)]);
  }
  return Number(count || 0);
}
