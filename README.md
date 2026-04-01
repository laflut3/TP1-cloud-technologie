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
- Sur Clever Cloud: `https://<instance>.cleverapps.io/ui`

Note:
- L'UI a ete vibe coded.
- Le plus gros des requetes API (`GET/POST/PATCH/DELETE`) a été codees a la main.

## Endpoints minimum

- `GET /` : message de bienvenue
- `GET /health` : etat de l'application et de la base

## Structure

- `src/index.js` : serveur Express + storage + routes
- `src/config/env.js` : configuration basique

## Variables d'environnement

| Variable | Source | Description |
| --- | --- | --- |
| `PORT` | Clever Cloud | Port d'ecoute. L'application doit ecouter sur cette valeur. |
| `POSTGRESQL_ADDON_URI` | Clever Cloud (add-on) | URI de connexion PostgreSQL. |
| `APP_NAME` | Vous | Nom affiche dans `/health`. |
| `APP_VERSION` | Vous | Version affichee dans `GET /`. |
| `PG_POOL_MAX` | Vous (optionnel) | Nombre max de connexions PostgreSQL par instance (`1` par defaut). |
| `ALERTS_POLL_INTERVAL_MS` | Vous (optionnel) | Intervalle de polling des alertes distribuees (`1000` ms par defaut). |

Si `POSTGRESQL_ADDON_URI` n'est pas definie, `/health` renvoie `database: "not configured"`.

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
