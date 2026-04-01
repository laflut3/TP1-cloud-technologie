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

## Interface Web (UI)

Une interface simple est disponible pour tester les requetes API:

- En local: `http://localhost:3000/ui`
- Sur Clever Cloud: `https://app-c1d1d463-f078-4e86-b30d-a1eeda0a839a.cleverapps.io/ui`

Note:
- L'UI a ete vibe coded.
- Les requetes API (`GET/POST/PATCH/DELETE`) ont ete codees a la main.

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

## Configuration Clever Cloud (PostgreSQL)

Ajouter un addon PostgreSQL et lier automatiquement les variables d'environnement a l'application:

```bash
# 1) Creer l'addon PostgreSQL
clever addon create postgresql-addon <ADDON_NAME> --plan dev --org <ORG_ID>

# 2) Lier l'addon a l'application
clever service link-addon <ADDON_NAME>

# 3) Ajouter la version applicative
clever env set APP_VERSION 1.0.0
```

Verifier les variables disponibles:

```bash
clever env
```

Exemple (valeurs masquees):

```bash
APP_VERSION="1.0.0"
POSTGRESQL_ADDON_DB="<db_name>"
POSTGRESQL_ADDON_HOST="<host>"
POSTGRESQL_ADDON_PASSWORD="<password>"
POSTGRESQL_ADDON_PORT="<port>"
POSTGRESQL_ADDON_URI="postgresql://<user>:<password>@<host>:<port>/<db_name>"
POSTGRESQL_ADDON_USER="<user>"
POSTGRESQL_ADDON_VERSION="15"
```

Ne pas commiter ces secrets dans le depot.
