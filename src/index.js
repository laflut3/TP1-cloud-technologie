const express = require("express");
const { port: PORT, appName: APP_NAME, appVersion: APP_VERSION, databaseUrl: DATABASE_URL } = require("./config/env");

const app = express();
app.use(express.json());

let storage;

if (DATABASE_URL) {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: DATABASE_URL });

  storage = {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS items (
          id          SERIAL PRIMARY KEY,
          name        TEXT NOT NULL,
          description TEXT,
          created_at  TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    },
    async healthCheck() {
      await pool.query("SELECT 1");
      return "connected";
    },
    async findAll() {
      const result = await pool.query("SELECT * FROM items ORDER BY created_at DESC");
      return result.rows;
    },
    async insert(name, description) {
      const result = await pool.query(
        "INSERT INTO items (name, description) VALUES ($1, $2) RETURNING *",
        [name, description ?? null]
      );
      return result.rows[0];
    },
  };
} else {
  console.warn("POSTGRESQL_ADDON_URI non defini - stockage en memoire (donnees perdues au redemarrage)");

  const items = [];
  let nextId = 1;

  storage = {
    async init() {},
    async healthCheck() {
      return "not configured";
    },
    async findAll() {
      return [...items].reverse();
    },
    async insert(name, description) {
      const item = {
        id: nextId++,
        name,
        description: description ?? null,
        created_at: new Date().toISOString(),
      };
      items.push(item);
      return item;
    },
  };
}

app.get("/", async (_req, res) => {
  res.json({ message: `Bienvenue sur l'app de Leo Torres (version ${APP_VERSION})` });
});

app.get("/health", async (_req, res) => {
  const health = {
    status: "ok",
    name: APP_NAME,
    version: APP_VERSION,
  };

  if (DATABASE_URL) {
    try {
      await storage.healthCheck();
      health.database = "connected";
    } catch (_error) {
      return res
        .status(503)
        .json({ status: "error", version: APP_VERSION, database: "unreachable" });
    }
  }

  return res.json(health);
});

storage
  .init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Erreur d'initialisation :", error.message);
    process.exit(1);
  });
