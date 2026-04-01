# TP1-cloud-technologie

API Node.js avec Express et PostgreSQL.

## Prerequis

- Node.js 18+
- PostgreSQL

## Installation

```bash
npm install
cp .env.example .env
```

## Lancement

```bash
npm run dev
```

ou en mode normal:

```bash
npm start
```

## Routes

- `GET /health` : verifie que l'API tourne
- `GET /db-health` : verifie la connexion PostgreSQL
