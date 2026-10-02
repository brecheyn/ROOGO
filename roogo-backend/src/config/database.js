const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
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
