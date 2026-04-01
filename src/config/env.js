module.exports = {
  port: Number(process.env.PORT || 3000),
  appName: process.env.APP_NAME || "tp1-cloud-technologie",
  appVersion: process.env.APP_VERSION || "1.0.0",
  databaseUrl: process.env.POSTGRESQL_ADDON_URI || process.env.DATABASE_URL || null,
};
