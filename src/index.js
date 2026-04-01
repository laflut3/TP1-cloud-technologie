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
    async findOverdue() {
      const result = await pool.query(
        "SELECT * FROM items WHERE status = 'pending' AND due_date IS NOT NULL AND due_date < CURRENT_DATE ORDER BY created_at DESC"
      );
      return result.rows;
    },
    async insert({ title, description, dueDate }) {
      const result = await pool.query(
        "INSERT INTO items (title, description, due_date, status) VALUES ($1, $2, $3, $4) RETURNING *",
        [title, description ?? null, dueDate ?? null, "pending"]
      );
      return result.rows[0];
    },
    async updateById(id, updates) {
      const hasTitle = Object.prototype.hasOwnProperty.call(updates, "title");
      const hasDescription = Object.prototype.hasOwnProperty.call(updates, "description");
      const hasDueDate = Object.prototype.hasOwnProperty.call(updates, "dueDate");
      const hasStatus = Object.prototype.hasOwnProperty.call(updates, "status");

      const result = await pool.query(
        `UPDATE items
         SET
           title = CASE WHEN $2 THEN $3 ELSE title END,
           description = CASE WHEN $4 THEN $5 ELSE description END,
           due_date = CASE WHEN $6 THEN $7::date ELSE due_date END,
           status = CASE WHEN $8 THEN $9 ELSE status END
         WHERE id = $1
         RETURNING *`,
        [
          id,
          hasTitle,
          hasTitle ? updates.title : null,
          hasDescription,
          hasDescription ? updates.description : null,
          hasDueDate,
          hasDueDate ? updates.dueDate : null,
          hasStatus,
          hasStatus ? updates.status : null,
        ]
      );

      return result.rows[0] ?? null;
    },
    async deleteById(id) {
      const result = await pool.query("DELETE FROM items WHERE id = $1 RETURNING id", [id]);
      return result.rowCount > 0;
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
    async findOverdue() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return [...items]
        .reverse()
        .filter((item) => item.status === "pending" && item.due_date)
        .filter((item) => {
          const dueDate = new Date(item.due_date);
          return !Number.isNaN(dueDate.getTime()) && dueDate < today;
        });
    },
    async insert({ title, description, dueDate }) {
      const item = {
        id: nextId++,
        title,
        description: description ?? null,
        due_date: dueDate ?? null,
        status: "pending",
        created_at: new Date().toISOString(),
      };
      items.push(item);
      return item;
    },
    async updateById(id, updates) {
      const item = items.find((todo) => todo.id === id);
      if (!item) {
        return null;
      }

      if (Object.prototype.hasOwnProperty.call(updates, "title")) {
        item.title = updates.title;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "description")) {
        item.description = updates.description ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "dueDate")) {
        item.due_date = updates.dueDate ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "status")) {
        item.status = updates.status;
      }

      return item;
    },
    async deleteById(id) {
      const index = items.findIndex((todo) => todo.id === id);
      if (index === -1) {
        return false;
      }

      items.splice(index, 1);
      return true;
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

// GET /todos/overdue
app.get("/todos/overdue", async (req, res) => {
  try {
    const overdueTodos = await storage.findOverdue();
    return res.status(200).json(overdueTodos);
  } catch (err) {
    console.error("Erreur lors de la récupération des tâches en retard :", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /todos
app.post("/todos", async (req, res) => {
  const { title, description, due_date: dueDate } = req.body ?? {};

  if (typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({ error: "title is required and cannot be empty" });
  }

  try {
    const todo = await storage.insert({
      title: title.trim(),
      description,
      dueDate,
    });
    return res.status(201).json(todo);
  } catch (err) {
    console.error("Erreur lors de la création de la tâche :", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /todos/:id
app.patch("/todos/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const body = req.body ?? {};
  const updates = {};

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      return res.status(400).json({ error: "title cannot be empty" });
    }
    updates.title = body.title.trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    updates.description = body.description;
  }

  if (Object.prototype.hasOwnProperty.call(body, "due_date")) {
    updates.dueDate = body.due_date;
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    if (body.status !== "pending" && body.status !== "done") {
      return res.status(400).json({ error: "Invalid status. Use pending or done." });
    }
    updates.status = body.status;
  }

  try {
    const todo = await storage.updateById(id, updates);
    if (!todo) {
      return res.status(404).json({ error: "Todo not found" });
    }
    return res.status(200).json(todo);
  } catch (err) {
    console.error("Erreur lors de la mise à jour de la tâche :", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /todos/:id
app.delete("/todos/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const deleted = await storage.deleteById(id);
    if (!deleted) {
      return res.status(404).json({ error: "Todo not found" });
    }
    return res.status(204).send();
  } catch (err) {
    console.error("Erreur lors de la suppression de la tâche :", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
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
