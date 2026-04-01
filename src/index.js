require("dotenv").config();

const express = require("express");
const { testConnection } = require("./db");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "tp1-cloud-technologie-api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/db-health", async (_req, res) => {
  try {
    const data = await testConnection();
    res.status(200).json({
      status: "ok",
      dbTime: data.now,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Impossible de se connecter a PostgreSQL",
      error: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`API en ligne sur http://localhost:${port}`);
});
