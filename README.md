# TP1-cloud-technologie

Projet Node.js minimal avec Express et PostgreSQL.

## Prerequis

- Node.js 18+
- PostgreSQL (optionnel)

## Installation

```bash
npm install
```

## Lancement

```bash
npm run dev
```

ou en mode normal:

```bash
npm start
```

## Endpoints minimum

- `GET /` : message de bienvenue
- `GET /health` : etat de l'application et de la base

## Structure

- `src/index.js` : serveur Express + storage + routes
- `src/config/env.js` : configuration basique

## Variables d'environnement

- `PORT` (optionnel)
- `APP_NAME` (optionnel)
- `APP_VERSION` (optionnel)
- `POSTGRESQL_ADDON_URI` ou `DATABASE_URL` (optionnel)

Si l'URL PostgreSQL n'est pas definie, `/health` renvoie `database: "not_configured"`.
