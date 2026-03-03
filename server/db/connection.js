const { Pool } = require('pg');
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

module.exports = {
  query: (...args) => getPool().query(...args),
  getPool,
};
