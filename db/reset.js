const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function reset() {
  console.log('Dropping public schema...');
  await db.query('DROP SCHEMA public CASCADE;');
  await db.query('CREATE SCHEMA public;');

  console.log('Applying base schema.sql...');
  const schemaSql = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
  await db.query(schemaSql);

  console.log('Database reset and base schema applied successfully.');
}

reset()
  .then(() => db.pool.end())
  .catch((error) => {
    console.error('Reset failed:', error.message);
    db.pool.end().finally(() => process.exit(1));
  });
