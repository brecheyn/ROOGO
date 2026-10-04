const { Pool } = require('pg');
const logger = require('./logger');

// SSL : nécessaire pour la plupart des PostgreSQL managés (Render, Neon,
// Supabase, …). Désactivé par défaut pour ne pas casser le dev local.
// Activer avec DB_SSL=true dans les variables d'environnement.
const useSSL = String(process.env.DB_SSL || '').toLowerCase() === 'true';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

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
