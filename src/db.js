const { Pool } = require("pg");

const ssl =
  process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false;

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl,
    }
  : {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "postgres",
      ssl,
    };

const pool = new Pool(poolConfig);

async function testConnection() {
  const result = await pool.query("SELECT NOW() AS now");
  return result.rows[0];
}

module.exports = {
  pool,
  testConnection,
};
