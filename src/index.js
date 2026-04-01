require("dotenv").config();

const path = require("path");
const express = require("express");

const app = express();
app.use(express.json());
app.use("/ui", express.static(path.join(__dirname, "..", "public")));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`,
    );
  });
  next();
});

const PORT = process.env.PORT || 3000;
const APP_VERSION = process.env.APP_VERSION || "1.0.0";
const DATABASE_URL = process.env.POSTGRESQL_ADDON_URI;

// -------------------------------------------------------------------
// Storage — PostgreSQL si POSTGRESQL_ADDON_URI est défini, mémoire sinon
// -------------------------------------------------------------------

let storage;
const sseClients = new Set();
const ALERT_CHANNEL = "todo_alerts";

function toTodoAlertPayload(todo) {
  return {
    id: todo.id,
    title: todo.title,
    status: todo.status,
    due_date: todo.due_date ?? null,
  };
}

function writeSseEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastTodoAlertToLocalClients(payload) {
  for (const client of sseClients) {
    try {
      writeSseEvent(client, "todo_alert", payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

let initAlertStreaming = async () => {};
let publishTodoAlert = async (todo) => {
  broadcastTodoAlertToLocalClients(toTodoAlertPayload(todo));
};

if (DATABASE_URL) {
  const { Client, Pool } = require("pg");
  const pool = new Pool({ connectionString: DATABASE_URL });
  const alertListener = new Client({ connectionString: DATABASE_URL });

  initAlertStreaming = async () => {
    try {
      await alertListener.connect();
      await alertListener.query(`LISTEN ${ALERT_CHANNEL}`);

      alertListener.on("notification", (message) => {
        if (message.channel !== ALERT_CHANNEL || !message.payload) {
          return;
        }

        try {
          const payload = JSON.parse(message.payload);
          broadcastTodoAlertToLocalClients(payload);
        } catch (err) {
          console.error("Payload d'alerte SSE invalide :", err.message);
        }
      });

      alertListener.on("error", (err) => {
        console.error("Erreur listener PostgreSQL (SSE) :", err.message);
      });
    } catch (err) {
      console.error(
        "Impossible d'initialiser LISTEN/NOTIFY (SSE distribué) :",
        err.message,
      );
    }
  };

  publishTodoAlert = async (todo) => {
    const payload = toTodoAlertPayload(todo);
    try {
      await pool.query("SELECT pg_notify($1, $2)", [
        ALERT_CHANNEL,
        JSON.stringify(payload),
      ]);
    } catch (err) {
      console.error("Erreur d'envoi NOTIFY (SSE) :", err.message);
      broadcastTodoAlertToLocalClients(payload);
    }
  };

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

      await initAlertStreaming();
    },

    async healthCheck() {
      await pool.query("SELECT 1");
      return "connected";
    },

    async findAll(status) {
      if (status) {
        const result = await pool.query(
          "SELECT * FROM items WHERE status = $1 ORDER BY created_at DESC",
          [status],
        );
        return result.rows;
      }

      const result = await pool.query(
        "SELECT * FROM items ORDER BY created_at DESC",
      );
      return result.rows;
    },

    async findOverdue() {
      const result = await pool.query(
        "SELECT * FROM items WHERE status = 'pending' AND due_date IS NOT NULL AND due_date < CURRENT_DATE ORDER BY created_at DESC",
      );
      return result.rows;
    },

    async insert({ title, description, dueDate }) {
      const result = await pool.query(
        "INSERT INTO items (title, description, due_date, status) VALUES ($1, $2, $3, $4) RETURNING *",
        [title, description ?? null, dueDate ?? null, "pending"],
      );
      return result.rows[0];
    },

    async updateById(id, { title, status }) {
      const result = await pool.query(
        `UPDATE items
         SET
           title = COALESCE($2, title),
           status = COALESCE($3, status)
         WHERE id = $1
         RETURNING *`,
        [id, title ?? null, status ?? null],
      );

      return result.rows[0] ?? null;
    },

    async deleteById(id) {
      const result = await pool.query(
        "DELETE FROM items WHERE id = $1 RETURNING id",
        [id],
      );
      return result.rowCount > 0;
    },
  };
} else {
  console.warn(
    "POSTGRESQL_ADDON_URI non défini — stockage en mémoire (données perdues au redémarrage)",
  );

  const items = [];
  let nextId = 1;

  storage = {
    async init() {},
    async healthCheck() {
      return "not configured";
    },
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
    async updateById(id, { title, status }) {
      const item = items.find((todo) => todo.id === id);
      if (!item) {
        return null;
      }

      if (title !== undefined) item.title = title;
      if (status !== undefined) item.status = status;

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
  res.json({
    message: `Bienvenue sur l'app de Léo Torres (version ${APP_VERSION})`,
  });
});

// GET /health
app.get("/health", async (req, res) => {
  const health = { status: "ok", name: "todo-torres", version: APP_VERSION };

  if (DATABASE_URL) {
    try {
      await storage.healthCheck();
      health.database = "connected";
    } catch {
      return res.status(503).json({
        status: "error",
        version: APP_VERSION,
        database: "unreachable",
      });
    }
  }

  res.json(health);
});

// GET /alerts (SSE)
app.get("/alerts", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  sseClients.add(res);

  const sendPing = () => {
    writeSseEvent(res, "ping", { timestamp: new Date().toISOString() });
  };

  sendPing();
  const pingInterval = setInterval(sendPing, 30_000);

  req.on("close", () => {
    clearInterval(pingInterval);
    sseClients.delete(res);
    res.end();
  });
});

// GET /todos?status=pending|done
app.get(["/todo", "/todos"], async (req, res) => {
  const { status } = req.query;

  if (status !== undefined && status !== "pending" && status !== "done") {
    return res
      .status(400)
      .json({ error: "Invalid status. Use pending or done." });
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
    console.error(
      "Erreur lors de la récupération des tâches en retard :",
      err.message,
    );
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /todos
app.post("/todos", async (req, res) => {
  const { title, description, due_date: dueDate } = req.body ?? {};

  if (typeof title !== "string" || title.trim().length === 0) {
    return res
      .status(400)
      .json({ error: "title is required and cannot be empty" });
  }

  try {
    const todo = await storage.insert({
      title: title.trim(),
      description,
      dueDate,
    });
    await publishTodoAlert(todo);
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

  const { title, status } = req.body ?? {};
  const updates = {};

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ error: "title cannot be empty" });
    }
    updates.title = title.trim();
  }

  if (status !== undefined) {
    if (status !== "pending" && status !== "done") {
      return res
        .status(400)
        .json({ error: "Invalid status. Use pending or done." });
    }
    updates.status = status;
  }

  try {
    const todo = await storage.updateById(id, updates);
    if (!todo) {
      return res.status(404).json({ error: "Todo not found" });
    }
    await publishTodoAlert(todo);
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

storage
  .init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`App démarrée sur le port ${PORT} (version ${APP_VERSION})`);
      console.log(
        `Base de données : ${DATABASE_URL ? "PostgreSQL" : "mémoire"}`,
      );
    });
  })
  .catch((err) => {
    console.error("Erreur d'initialisation :", err.message);
    process.exit(1);
  });
