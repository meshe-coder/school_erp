const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDirectory = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const existing = await db.query(
      'SELECT 1 FROM schema_migrations WHERE name = $1',
      [file]
    );

    if (existing.rows.length > 0) {
      console.log(`Already applied: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDirectory, file), 'utf8');
    const client = await db.getClient();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (name) VALUES ($1)',
        [file]
      );
      await client.query('COMMIT');
      console.log(`Applied: ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Failed: ${file}`);
      throw error;
    } finally {
      client.release();
    }
  }
}

migrate()
  .then(() => db.pool.end())
  .catch((error) => {
    console.error(error.message);
    db.pool.end().finally(() => process.exit(1));
  });
