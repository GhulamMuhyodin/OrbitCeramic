# Orbit Project Architecture

> Full project context (routes, API inventory, batch scheduling, **migrations**, gaps): **[`CONTEXT.md`](CONTEXT.md)**.

## Overview

Orbit Ceramic is a three-layer system:

- **Angular frontend** (`src/app/`) — storefront + admin CMS
- **PHP API** (`orbit-api/`) — REST endpoints over MySQL
- **Hybrid content** — dynamic catalog in DB; nav/footer (and hero defaults) in `public/data/site-content.json`

```text
Angular (4200)  ──proxy /api──►  PHP API (8080)  ──PDO──►  MySQL
       │                              │                      ▲
       └── site-content.json          └── public/uploads/    │
                                                             │
                              php bin/database migrate ──────┘
                              (orbit-api/database/migrations)
```

## Frontend structure

| Area | Path | Role |
|------|------|------|
| Public pages | `src/app/pages/` | home, batch, collections, journey, about |
| Components | `src/app/components/` | hero, batch, collections, journey, chrome |
| Admin CMS | `src/app/admin/` | login, dashboard, site, batches, about, reviews |
| Models | `src/app/data/site-content.model.ts` | DB types + `assembleSiteContent()` |
| API client | `src/app/config/api.config.ts` | Base URL + site id |

Admin is lazy-loaded at `/admin`. Batch editing (`/admin/batches/:id`) is the primary launch CMS — schedule, products, journey media, hero highlights, atomic save.

## Backend structure

| Area | Path | Role |
|------|------|------|
| Entry | `orbit-api/public/index.php` | Routes + CORS + dispatch |
| Controllers | `orbit-api/src/Controllers/` | HTTP handlers |
| Repositories | `orbit-api/src/Repositories/` | SQL (`ContentRepository`, `AdminRepository`) |
| Auth | `orbit-api/src/AdminAuth.php` | Username/password sessions (Bearer tokens) |
| DB connection | `orbit-api/src/Database.php` | PDO (+ create empty DB if missing) |
| Migrations | `orbit-api/src/Migration/` | Runner, history, SQL executor |
| Migration CLI | `orbit-api/bin/database` | `status` / `migrate` / `create` / `rollback` |
| Migration files | `orbit-api/database/migrations/` | **Source of truth** for schema + seeds |

## Data & migrations

| Concern | Location |
|---------|----------|
| **Schema + seed (source of truth)** | `orbit-api/database/migrations/V00x__*.php` |
| History table | MySQL `database_migrations` |
| Migration docs | [`orbit-api/database/README.md`](orbit-api/database/README.md) |
| Deploy secrets guide | [`orbit-api/database/DEPLOY.md`](orbit-api/database/DEPLOY.md) |
| CI workflow | [`.github/workflows/main.yml`](.github/workflows/main.yml) |
| Entity / API docs | `public/data/API-CATALOG.md`, `CONTENT-SCHEMA.md`, `PHASE-1-DB.md` |

```bat
cd orbit-api
php bin\database migrate
php bin\database migration:create DescribeChange
```

Never edit an applied migration. All schema and seed changes go through new `V0xx` files.

## Development

```bash
# Migrate first (once / after new V00x files)
cd orbit-api && php bin/database migrate

# API (from orbit-api/public, router.php required)
php -S localhost:8080 router.php

# Frontend (proxies /api → :8080)
npm start
```

## Deployment

```text
Build → Deploy API → php bin/database migrate → Deploy Angular → Start
```

## Phases

1. **Now** — Content DB, bootstrap, admin CMS, WhatsApp checkout, versioned migrations
2. **Next** — Guest cart (add as new `V0xx` migrations)
3. **Later** — Orders, COD, customer accounts

Details: [`CONTEXT.md`](CONTEXT.md) §9 / §11 / §12 and [`public/data/API-CATALOG.md`](public/data/API-CATALOG.md).
