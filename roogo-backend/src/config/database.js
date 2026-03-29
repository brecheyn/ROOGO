const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,  // ← Important: parseInt()
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'phares',
  database: process.env.DB_NAME || 'roogo_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erreur de connexion à PostgreSQL:', err.message);
  } else {
    console.log('✅ Connecté à PostgreSQL avec succès');
    release();
  }
});

pool.on('error', (err) => {
  console.error('❌ Erreur inattendue du pool PostgreSQL:', err);
});

module.exports = pool;