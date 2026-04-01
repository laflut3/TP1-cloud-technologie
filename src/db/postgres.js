const { Pool } = require("pg");
const { databaseUrl } = require("../config/env");

const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

async function checkDatabase() {
  if (!pool) {
    return { configured: false, status: "not_configured" };
  }

  await pool.query("SELECT 1");
  return { configured: true, status: "up" };
}

module.exports = { checkDatabase };
