const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { config } = require('../config');

let pool = null;

function getPool() {
  if (!pool) {
    const cfg = config();
    pool = new Pool({
      connectionString: cfg.databaseUrl,
      ssl: cfg.isProduction ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    await getPool().query(sql);
    console.log(`Completed: ${file}`);
  }

  console.log('All migrations complete.');
}

module.exports = {
  query: (...args) => getPool().query(...args),
  getPool,
  runMigrations,
};
