require("dotenv").config();

const express = require("express");

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

const PORT = process.env.PORT || 3000;
const APP_VERSION = process.env.APP_VERSION || "1.0.0";
const APP_NAME = process.env.APP_NAME || "my-app";
const DATABASE_URL = process.env.POSTGRESQL_ADDON_URI;

// -------------------------------------------------------------------
// Storage — PostgreSQL si POSTGRESQL_ADDON_URI est défini, mémoire sinon
// -------------------------------------------------------------------

let storage;

if (DATABASE_URL) {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: DATABASE_URL });

  storage = {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS items (
          id          SERIAL PRIMARY KEY,
          title       TEXT NOT NULL,
          description TEXT,
          due_date    DATE,
          status      TEXT,
          created_at  TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    },
    async healthCheck() {
      await pool.query("SELECT 1");
      return "connected";
    },
    async findAll(status) {
      if (status) {
        const result = await pool.query(
          "SELECT * FROM items WHERE status = $1 ORDER BY created_at DESC",
          [status]
        );
        return result.rows;
      }

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
  console.warn("POSTGRESQL_ADDON_URI non défini — stockage en mémoire (données perdues au redémarrage)");

  const items = [];
  let nextId = 1;

  storage = {
    async init() {},
    async healthCheck() { return "not configured"; },
    async findAll(status) {
      const sorted = [...items].reverse();
      if (!status) {
        return sorted;
      }

      return sorted.filter((item) => item.status === status);
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

// -------------------------------------------------------------------
// Routes
// -------------------------------------------------------------------

app.get("/", async (req, res) => {
  res.json({ message: `Bienvenue sur l'app de Léo Torres (version ${APP_VERSION})` });
});

// GET /health
app.get("/health", async (req, res) => {
  const health = { status: "ok", name: "todo-torres", version: APP_VERSION };

  if (DATABASE_URL) {
    try {
      await storage.healthCheck();
      health.database = "connected";
    } catch {
      return res.status(503).json({ status: "error", version: APP_VERSION, database: "unreachable" });
    }
  }

  res.json(health);
});

// GET /todos?status=pending|done
app.get(["/todo", "/todos"], async (req, res) => {
  const { status } = req.query;

  if (status !== undefined && status !== "pending" && status !== "done") {
    return res.status(400).json({ error: "Invalid status. Use pending or done." });
  }

  const todos = await storage.findAll(status);
  return res.status(200).json(todos);
});



// -------------------------------------------------------------------
// Démarrage
// -------------------------------------------------------------------

storage.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`App démarrée sur le port ${PORT} (version ${APP_VERSION})`);
      console.log(`Base de données : ${DATABASE_URL ? "PostgreSQL" : "mémoire"}`);
    });
  })
  .catch((err) => {
    console.error("Erreur d'initialisation :", err.message);
    process.exit(1);
  });
