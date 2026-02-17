import crypto from 'node:crypto';
import Redis from 'ioredis';

function getRedisConfig() {
  const raw = process.env.BEWRITTEN_REDIS_URL || process.env.REDIS_URL || '';
  if (raw) return raw;

  const host = String(process.env.BEWRITTEN_REDIS_HOST || '').trim();
  if (!host) return null;

  return {
    host,
    port: Number(process.env.BEWRITTEN_REDIS_PORT || 6379),
    password: String(process.env.BEWRITTEN_REDIS_PASSWORD || '').trim() || undefined,
    db: Number(process.env.BEWRITTEN_REDIS_DB || 0),
    tls: String(process.env.BEWRITTEN_REDIS_TLS || 'false').toLowerCase() === 'true' ? {} : undefined,
  };
}

const redisConfig = getRedisConfig();
const redisClient = redisConfig ? new Redis(redisConfig, {
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 1,
  showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
}) : null;

if (redisClient) {
  redisClient.on('error', (err) => {
    // Suppress connectivity errors to avoid crashing, but log them
    console.warn('Redis connection error:', err.message);
  });
}

export function getTransientInfo() {
  return {
    enabled: Boolean(redisClient),
    backend: redisClient ? 'redis' : 'none',
    redisUrlConfigured: Boolean(process.env.BEWRITTEN_REDIS_URL || process.env.REDIS_URL || process.env.BEWRITTEN_REDIS_HOST),
  };
}

export async function withTransientLock(key, ttlMs, fn) {
  if (!redisClient) return await fn();

  const token = crypto.randomUUID();
  const lockKey = `bewritten:lock:${key}`;

  try {
    const acquired = await redisClient.set(lockKey, token, 'NX', 'PX', ttlMs);
    if (acquired !== 'OK') {
      const err = new Error('This content is currently being updated in another request. Please retry.');
      err.code = 'TRANSIENT_LOCKED';
      throw err;
    }
  } catch (error) {
    // If Redis is down, fallback to no lock (optimistic concurrency)
    // or rethrow if it was the lock contention error
    if (error?.code === 'TRANSIENT_LOCKED') throw error;
    console.warn('Redis lock failed, falling back to unlocked execution:', error.message);
    return await fn();
  }

  try {
    return await fn();
  } finally {
    try {
      // Safe release using Lua script
      await redisClient.eval(
        "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
        1,
        lockKey,
        token
      );
    } catch (e) {
      console.warn('Failed to release lock:', e.message);
    }
  }
}

export async function incrementTransientCounter(key, windowSeconds) {
  if (!redisClient) return 0;

  const counterKey = `bewritten:counter:${key}`;
  try {
    const pipeline = redisClient.pipeline();
    pipeline.incr(counterKey);
    pipeline.expire(counterKey, windowSeconds);
    const results = await pipeline.exec();

    // results[0] is [error, count]
    if (results?.[0]?.[0]) throw results[0][0];
    return Number(results?.[0]?.[1] || 0);
  } catch (error) {
    console.warn('Redis counter failed:', error.message);
    return 0;
  }
}
