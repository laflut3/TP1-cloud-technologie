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

- En local: `http://localhost:8080/ui`
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
| `PORT` | Clever Cloud (auto) | Port d'ecoute injecte automatiquement. Ne pas le fixer manuellement. |
| `POSTGRESQL_ADDON_URI` | Clever Cloud (add-on, auto) | URI PostgreSQL injectee apres liaison de l'add-on. |
| `APP_NAME` | Vous (manuel) | Nom affiche dans `/health`. |
| `APP_VERSION` | Vous (manuel) | Version affichee dans `GET /` et `/health`. |
| `PG_POOL_MAX` | Vous (manuel, optionnel) | Max connexions PostgreSQL par instance (`1` par defaut, recommande sur petit plan). |
| `ALERTS_POLL_INTERVAL_MS` | Vous (manuel, optionnel) | Intervalle de polling des alertes distribuees (`1000` ms par defaut). |

Si `POSTGRESQL_ADDON_URI` n'est pas definie, `/health` renvoie `database: "not configured"`.

## Commandes Clever Cloud (variables)

Ajouter les variables manuelles:

```bash
clever env set APP_NAME "todo-torres"
clever env set APP_VERSION "2.4.1"
clever env set PG_POOL_MAX "1"
clever env set ALERTS_POLL_INTERVAL_MS "1000"
```

Ne pas ajouter manuellement:

- `PORT` (injecte automatiquement par Clever Cloud)
- `POSTGRESQL_ADDON_URI` (injectee par l'add-on PostgreSQL lie)

## Configuration Clever Cloud (PostgreSQL)

Ajouter un addon PostgreSQL et lier automatiquement les variables d'environnement a l'application:

```bash
# 1) Creer l'addon PostgreSQL
clever addon create postgresql-addon <ADDON_NAME> --plan dev --org <ORG_ID>

# 2) Lier l'addon a l'application
clever service link-addon <ADDON_NAME>
```

Verifier les variables disponibles:

```bash
clever env
```

Exemple (valeurs masquees):

```bash
APP_NAME="todo-torres"
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
