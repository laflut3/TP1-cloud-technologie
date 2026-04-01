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
