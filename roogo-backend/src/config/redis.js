const Redis = require('ioredis');
const logger = require('./logger');

let redis = null;

// REDIS_HOST absent (cas Render sans Redis) : on n'essaie même pas de se
// connecter, sinon ioredis retente en boucle et noie les logs d'avertissements.
if (process.env.REDIS_HOST) {
  try {
    redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    let warnedOnce = false;
    redis.on('connect', () => logger.info('Redis connecté'));
    redis.on('error', (err) => {
      if (warnedOnce) return; // une seule alerte, pas une par tentative
      warnedOnce = true;
      logger.warn({ err: err.message }, 'Redis non disponible — cache désactivé');
    });
    redis.on('ready', () => {
      warnedOnce = false;
      logger.info('Redis prêt');
    });

    redis.connect().catch(() => {
      logger.warn('Redis non disponible — le cache sera désactivé');
    });
  } catch (err) {
    logger.warn({ err: err.message }, 'Impossible de se connecter à Redis');
  }
} else {
  logger.info('Redis non configuré (REDIS_HOST absent) — cache désactivé');
}

// Helper: get avec JSON parse
async function cacheGet(key) {
  if (!redis || redis.status !== 'ready') return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// Helper: set avec JSON stringify + TTL
async function cacheSet(key, value, ttlSeconds = 300) {
  if (!redis || redis.status !== 'ready') return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // silent fail
  }
}

// Helper: delete pattern
async function cacheDelPattern(pattern) {
  if (!redis || redis.status !== 'ready') return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // silent fail
  }
}

module.exports = { redis, cacheGet, cacheSet, cacheDelPattern };
