const express = require("express");
const { port, appName, appVersion } = require("./config/env");
const { checkDatabase } = require("./db/postgres");

const app = express();

app.get("/health", async (_req, res) => {
  const payload = {
    status: "ok",
    name: appName,
    version: appVersion,
  };

  try {
    const db = await checkDatabase();
    payload.database = db.status;
    return res.status(200).json(payload);
  } catch (_error) {
    payload.status = "error";
    payload.database = "unreachable";
    return res.status(503).json(payload);
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
