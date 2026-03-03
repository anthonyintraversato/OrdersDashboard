require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { config } = require('../config');

async function migrate() {
  const cfg = config();
  const pool = new Pool({
    connectionString: cfg.databaseUrl,
    ssl: cfg.isProduction ? { rejectUnauthorized: false } : false,
  });

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
    console.log(`Completed: ${file}`);
  }

  await pool.end();
  console.log('All migrations complete.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
