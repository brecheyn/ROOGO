const { Pool } = require('pg');
const logger = require('./logger');

// Configuration DB :
// - DATABASE_URL  → Vercel/Neon (chaine postgres://…?sslmode=require)
// - DB_HOST etc.  → développement local
function buildConfig() {
  const base = {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  if (process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    const noSsl = u.searchParams.get('sslmode') === 'disable';
    return {
      ...base,
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : 5432,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
      ...(noSsl ? {} : { ssl: { rejectUnauthorized: false } }),
    };
  }

  return {
    ...base,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

const pool = new Pool(buildConfig());

pool.connect((err, client, release) => {
  if (err) {
    logger.error({ err: err.message }, 'Erreur de connexion à PostgreSQL');
  } else {
    logger.info('Connecté à PostgreSQL avec succès');
    release();
  }
});

pool.on('error', (err) => {
  logger.error({ err }, 'Erreur inattendue du pool PostgreSQL');
});

module.exports = pool;
