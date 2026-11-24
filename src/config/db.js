const { Pool } = require('pg');
const env = require('./env');

const isProduction = env.nodeEnv === 'production' || env.databaseUrl.includes('neon.tech');

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  withTransaction,
  pool,
};
