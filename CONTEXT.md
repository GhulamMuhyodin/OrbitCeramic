# Orbit Ceramic — Project Context

> **Purpose:** Single reference for how the Orbit storefront, admin CMS, and PHP API fit together.  
> Use this before implementing features, onboarding, or planning new work.  
> **Last reviewed:** August 2026 — includes versioned DB migrations (`orbit-api/database/`)

---

## 1. What this project is

**Orbit Ceramic** is a handmade pottery storefront with a launch-driven commerce model:

- Customers browse batches (timed drops), collections, journey stories, and about/reviews.
- Purchases happen via **WhatsApp** (no cart/checkout in Phase 1).
- Staff manage content through an **Angular admin CMS** backed by a **PHP + MySQL API**.

| Layer | Location | Role |
|-------|----------|------|
| Storefront + Admin UI | `src/app/` | Angular 21 SPA (SSR-capable) |
| REST API | `orbit-api/` | PHP 8.1+ front controller |
| Database | MySQL (`orbit_ceramic`) | Schema via versioned migrations; history in `database_migrations` |
| Static chrome | `public/data/site-content.json` | Nav links + footer (not in DB) |
| Static assets | `public/images/` | Versioned brand/product photos |
| Uploads | `orbit-api/public/uploads/` | Admin-uploaded media served by API |

---

## 2. Repository layout

```text
Orbit/
├── src/app/                    # Angular application
│   ├── app.routes.ts           # Public routes
│   ├── admin/                  # CMS (lazy-loaded at /admin)
│   ├── components/             # Reusable storefront blocks
│   ├── pages/                  # Route-level pages
│   ├── services/               # SiteContentService, LaunchCelebrationService, …
│   ├── data/site-content.model.ts  # Types + assembleSiteContent()
│   └── config/api.config.ts    # API base URL + default site id
├── public/
│   ├── data/                   # Docs, site-content.json
│   └── images/                 # Static images (hero, products, journey)
├── orbit-api/
│   ├── database/
│   │   ├── migrations/         # ★ Source of truth — V001__, V002__, …
│   │   ├── README.md
│   │   └── DEPLOY.md           # CI secrets for API + migrate deploy
│   ├── bin/database            # Migration CLI
│   ├── bin/ci-write-config.php # Generate config.php from ORBIT_* env (CI)
│   ├── bin/deploy-ftp.sh       # FTP deploy API (preserves uploads)
│   ├── public/index.php        # Route registration + dispatch
│   ├── public/router.php       # Required for PHP built-in server
│   ├── src/
│   │   ├── Controllers/        # HTTP handlers
│   │   ├── Repositories/       # SQL / business logic
│   │   ├── Migration/          # MigrationRunner, history, SQL executor
│   │   └── Database.php        # PDO connection (+ auto-create empty DB)
│   └── config/config.php       # DB, CORS, api_key (gitignored)
├── .github/workflows/main.yml  # Build → migrate → FTP API → FTP Angular
├── proxy.conf.json             # ng serve: /api → localhost:8080
├── ARCHITECTURE.md
└── CONTEXT.md                  # ← this file
```

**Database changes:** add a new `V0xx__Name.php` under `orbit-api/database/migrations/` and run `php bin/database migrate`. Never edit an already-applied migration.

## 3. High-level runtime flow

```text
┌─────────────────────────────────────────────────────────────────┐
│  Browser (localhost:4200 or Hostinger static host)              │
│  Angular storefront + /admin CMS                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  orbit-api (localhost:8080 or Hostinger …/php/public)           │
│  index.php → Router → Controllers → Repositories                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ PDO
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  MySQL — orbit_ceramic                                          │
│  Schema via versioned migrations (orbit-api/database/migrations)│
│  History: database_migrations                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         ▼                                     ▼
  public/data/site-content.json          orbit-api/public/uploads/
  (nav + footer only)                    (uploaded media files)
```

### Database migrate flow (CLI)

```text
php bin/database migrate
        │
        ├─ Connect (create empty DB if missing)
        ├─ Ensure database_migrations history table
        ├─ Discover V00x__*.php (sorted)
        ├─ Legacy baseline if schema already present
        ├─ Validate checksums of applied files
        ├─ Apply pending UP scripts (locked via GET_LOCK)
        └─ Record success only (failed stay pending)
```
### Storefront data load

1. `SiteContentService` fetches **`GET /api/v1/bootstrap`** (catalog from DB).
2. In parallel, loads **`/data/site-content.json`** for `navLinks` + `footer`.
3. `assembleSiteContent()` in `site-content.model.ts` merges DB + chrome into `SiteContent` for components.

### Admin data load

1. User signs in at `/admin/login` → **`POST /api/v1/admin/auth/login`** (username/password).
2. Bearer token stored in `AdminSessionService`; `adminApiInterceptor` attaches it to admin routes.
3. `AdminDbService.load()` pulls bootstrap + chrome + batch list + reviews into an in-memory `SiteContentDb`.
4. Per-page **Save** calls write back via admin API (batch saves use atomic transaction endpoint).

---

## 4. Tech stack

| Area | Choice |
|------|--------|
| Frontend | Angular 21, standalone components, signals, RxJS |
| UI | PrimeNG 21, Tailwind CSS 4, Angular Material CDK (breakpoints) |
| SSR | `@angular/ssr` with client hydration |
| API | Plain PHP 8.1+, custom router, PDO |
| DB | MySQL 8 / MariaDB 10.5+, utf8mb4 |
| Dev proxy | `proxy.conf.json` → `http://localhost:8080` |
| Deploy | GitHub Actions → Hostinger FTP (`prod` / `uat` branches) |

---

## 5. Domain model (Phase 1)

### Batch-centric content

Everything sellable and visual revolves around **batches**:

```text
sites
 ├── contacts
 ├── media (upload metadata)
 └── batches (launch_at required)
      ├── products → product_colors, product_images → media
      ├── journey_videos (1 per batch, UNIQUE batch_id)
      ├── journey_images → media
      └── hero_highlight_images → media

page_about (+ paragraphs via JSON in row)
page_reviews (section headings for About page)
reviews (client quotes)
page_collections | page_journey | page_batch_shop (label copy)
admin_users + admin_sessions
```

**Static (NOT in MySQL):** `navLinks`, footer copy/links in `public/data/site-content.json`.

**Hero homepage copy** (title, lede, CTA labels) also comes from JSON defaults today — there is no `page_hero` table or public `GET /page/hero` route.

### Batch schedule states (client-derived)

Logic lives in `site-content.model.ts`:

| State | Rule |
|-------|------|
| `scheduled` | `launchAt` is in the future |
| `live` | Launch passed and within **24h celebration window** |
| `complete` | Launch passed and celebration window ended |

Additional rules:

- **Hero window:** `heroWindowDays` (default 10) — days before/after launch when batch highlight images replace default hero.
- **Journey unlock:** Journey cards appear only after batch is live **and** has video and/or stills.
- **Sold out:** Batch-level or product-level flag blocks WhatsApp buy UI.

### Admin batch workflow (upload + schedule)

1. **Batches list** (`/admin/batches`) → **Add batch** creates a local draft (`createEmptyBatch()` — launch defaults to **+7 days**).
2. **Batch editor** (`/admin/batches/:id`) — single screen for:
   - Launch date/time (scheduled vs live mode)
   - Countdown + celebration copy
   - Products (images uploaded via `POST /admin/media`)
   - Journey video + stills
   - Hero highlight images
3. **Save** → `PUT /api/v1/admin/batches/:id/transaction` (atomic: batch + products + journey + highlights).
4. Optionally set **active batch** from list or Site page → `PUT /admin/sites/active-batch`.

Draft batches exist in Angular memory until first successful save; `AdminDbService.isBatchPersisted()` tracks server-known IDs.

---

## 6. Public storefront

### Routes (`src/app/app.routes.ts`)

| Path | Page | Notes |
|------|------|-------|
| `/` | Home | Hero, highlights, active/scheduled batch CTA |
| `/batch` | Batch shop | Countdown, celebration, product grid, WhatsApp buy |
| `/collections` | Collections | All products by batch |
| `/journey` | Journey | Batch story cards (post-launch) |
| `/about` | About | Bio + reviews |
| `/view-all`, `/all` | → collections | Redirects |
| `/studio` | → journey | Redirect |
| `/admin` | Admin CMS | Lazy-loaded |

### Components (`src/app/components/`)

| Component | Used for |
|-----------|----------|
| `hero` | Homepage hero + highlight carousel |
| `batch`, `batch-live`, `batch-celebration` | Batch page states |
| `collections` | Product grids |
| `journey` | Journey cards / gallery |
| `about` | About section |
| `site-header`, `site-footer` | Global chrome |

### Key services

| Service | File | Role |
|---------|------|------|
| `SiteContentService` | `services/site-content.service.ts` | Bootstrap + JSON merge, cached `SiteContent` |
| `LaunchCelebrationService` | `services/launch-celebration.service.ts` | Session dismiss for confetti overlay |
| `ApiLoadingService` | `services/api-loading.service.ts` | Global spinner during HTTP |

---

## 7. Admin CMS

### Routes (`src/app/admin/admin.routes.ts`) — **actual**

| Route | Page | Purpose |
|-------|------|---------|
| `/admin/login` | Login | Username + password |
| `/admin` | Dashboard | Stats + module shortcuts |
| `/admin/site` | Site & Contact | Brand, site image, active batch, WhatsApp/email |
| `/admin/batches` | Batch list | Add/delete batch, sold-out toggles, set active |
| `/admin/batches/:batchId` | Batch editor | Full launch CMS (schedule + products + media) |
| `/admin/about` | About | Bio copy, image, show/hide on site |
| `/admin/reviews` | Reviews | Client review CRUD |

### Admin services

| Service | Role |
|---------|------|
| `AdminAuthService` | Login/logout/password change |
| `AdminSessionService` | Bearer token + user in sessionStorage |
| `AdminApiService` | Typed HTTP wrappers for all admin endpoints |
| `AdminDbService` | In-memory CMS state, save orchestration, `createEmptyBatch()` |
| `adminApiInterceptor` | Attach Bearer token; 401 clears session |

### Files present but **not routed**

These exist under `src/app/admin/pages/` but are **not** registered in `admin.routes.ts`:

- `guide/` — publish how-to (orphan)
- No dedicated pages for: hero copy, journey labels, collections labels, batch-shop labels, leads list

Page copy for collections/journey/batch-shop **is in the DB** and can be updated via API (`PUT /admin/page/:section`), but there is **no admin UI** for those sections yet. Hero copy is JSON-only.

---

## 8. API reference (implemented)

Base: **`/api/v1`** · Default site: **`?siteId=site-orbit`**

### Public read endpoints

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/bootstrap` | Full catalog payload (no nav/footer) |
| `GET` | `/server-time` | ISO timestamp for countdown |
| `GET` | `/site` | Brand + activeBatchId |
| `GET` | `/contact` | WhatsApp, email, Instagram |
| `GET` | `/page/about` | About + published reviews |
| `GET` | `/page/collections` | Collections labels |
| `GET` | `/page/journey` | Journey page labels |
| `GET` | `/page/batch-shop` | Shop labels + currency |
| `GET` | `/batches` | All batches with nested products |
| `GET` | `/batches/active` | Active batch |
| `GET` | `/batches/:id` | Single batch |
| `GET` | `/batches/:id/journey` | Journey video + images |
| `GET` | `/batches/:id/hero-highlights` | Pre-launch hero photos |
| `GET` | `/products` | Flat catalog (`?batchId&available&page&limit`) |
| `GET` | `/products/:id` | Product detail |
| `GET` | `/health` | Liveness + DB check |
| `POST` | `/leads` | Log WhatsApp intent (**requires `leads` table** — see gaps) |
| `POST` | `/media` | Legacy upload; requires `X-Api-Key` |

### Documented but **NOT implemented**

| Method | Path | Status |
|--------|------|--------|
| `GET` | `/page/hero` | No route, no DB table — hero from JSON |

### Admin endpoints (Bearer session token)

All routes under `/admin/*` except `POST /admin/auth/login` require authentication.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/admin/auth/login` | `{ username, password }` → token |
| `GET` | `/admin/auth/me` | Current user |
| `POST` | `/admin/auth/logout` | Revoke session |
| `POST` | `/admin/auth/password` | Change password |
| `GET/PUT` | `/admin/site` | Site row |
| `PUT` | `/admin/sites/active-batch` | Set active batch |
| `GET/PUT` | `/admin/contact` | Contact row |
| `GET/POST` | `/admin/batches` | List / create |
| `GET/PUT/DELETE` | `/admin/batches/:id` | CRUD |
| `PUT` | `/admin/batches/:id/transaction` | **Atomic batch save** |
| `PUT` | `/admin/batches/:id/journey` | Journey video + images |
| `PUT` | `/admin/batches/:id/hero-highlights` | Highlight images |
| `GET/POST` | `/admin/products` | List / create |
| `GET/PUT/DELETE` | `/admin/products/:id` | Product CRUD |
| `GET/PUT` | `/admin/page/:section` | `about`, `collections`, `journey`, `batch-shop` only |
| `GET/POST` | `/admin/reviews` | Review list / create |
| `PUT/DELETE` | `/admin/reviews/:id` | Update / delete |
| `GET` | `/admin/leads` | Lead list (no admin UI yet) |
| `POST` | `/admin/media` | Upload file → `media` row |

### Auth model (two mechanisms)

1. **Admin CMS:** Username/password → `admin_users` → Bearer token in `admin_sessions` (8h default TTL).
2. **Legacy public upload:** `POST /api/v1/media` accepts `X-Api-Key` matching `config.php` `api_key`. Admin uploads use session Bearer via `/admin/media` instead.

---

## 9. Database (Phase 1) — migrations

**Source of truth:** `orbit-api/database/migrations/`

Full guide: [`orbit-api/database/README.md`](orbit-api/database/README.md)

### Commands

```bat
cd orbit-api
php bin\database status
php bin\database migrate
php bin\database migration:create AddSomeColumn
php bin\database migration:create SeedSomething --type=seed
php bin\database rollback-last
php bin\database rollback-to V005
```

Windows: `database.bat migrate`

### Migration chain

| Version | Name | Type | Purpose |
|---------|------|------|---------|
| V001 | InitialSchema | schema | Phase 1 tables |
| V002 | CreateLeads | schema | WhatsApp leads |
| V003 | SeedAdminUser | seed | Default admin (idempotent) |
| V004 | AddPageAboutImageAlt | schema | Legacy column alignment |
| V005 | SeedDefaultSiteContent | seed | Site / contact / page copy (idempotent) |
| V006 | CreatePayments | schema | Example future table (`payment_types`) |
| V007 | SeedPaymentTypes | seed | Example idempotent seeder |

### History table

```text
database_migrations
  version | name | type | checksum | applied_at | execution_time_ms | success
```

Rules:

- Never edit an already-applied migration — create `V0xx__…` instead.
- Seeders must be idempotent (`ON DUPLICATE KEY` / existence checks).
- Failed migrations are **not** marked successful; re-run `migrate` after fixing.
- Checksum mismatch on an applied file aborts the run.
- Concurrency: MySQL `GET_LOCK('orbit_ceramic_migrations')`.

### Fresh vs existing DB

| Situation | Behavior |
|-----------|----------|
| Empty / new database | Create DB if needed → run all pending migrations |
| Existing schema, no history | Baseline complete V001 (and V002 if `leads` exists) → run remaining |
| Already migrated | `No pending migrations. Database is up to date.` |
---

## 10. Local development

### Prerequisites

- Node 20+ / npm
- PHP 8.1+ with `pdo_mysql`, `fileinfo`
- MySQL 8+ (XAMPP works on Windows)

### Start everything

```bash
# 0) Config + migrate (once / after pulling new V00x files)
cd orbit-api
# copy config/config.example.php → config/config.php if needed
php bin/database migrate

# Terminal 1 — API
# Windows: START-API.bat or run-local.bat
cd public && php -S localhost:8080 router.php

# Terminal 2 — Angular (repo root)
npm install
npm start   # http://localhost:4200 — proxies /api to :8080
```

### Verify

- API health: http://localhost:8080/api/v1/health
- Storefront: http://localhost:4200
- Admin: http://localhost:4200/admin/login  
  Seed user from **V003** (`admin` / `change-me-admin-password`) — change on shared hosts.
### Config must align

| Setting | Angular | PHP |
|---------|---------|-----|
| API base | `src/app/config/api.config.ts` → `apiBase: '/api/v1'` | — |
| Site id | `defaultSiteId: 'site-orbit'` | `default_site_id` in config.php |
| Legacy media key | `apiKey` (rarely used now) | `api_key` in config.php |
| Timezone | — | `Asia/Karachi` (batch launch display) |

---

## 11. Deployment

```text
Push to prod / uat
     ↓
Build Angular
     ↓
Write config.php from GitHub Environment secrets
     ↓
php bin/database migrate   ← pending schema + seed migrations (remote MySQL)
     ↓
FTP deploy orbit-api → {public_html}/php  (uploads preserved)
     ↓
FTP deploy Angular → {public_html}/
     ↓
Application live
```

- **Workflow:** [`.github/workflows/main.yml`](.github/workflows/main.yml)
- **Secrets guide:** [`orbit-api/database/DEPLOY.md`](orbit-api/database/DEPLOY.md)
- **Environments:** GitHub `production` (branch `prod`) and `uat` (branch `uat`)
- Ensure Hostinger **Remote MySQL** allows the GitHub Actions runner (or `%`)
- Ensure `php/public/uploads/` is writable on the host
---

## 12. Phase roadmap

| Phase | Scope | Status |
|-------|--------|--------|
| **1** | Content DB, bootstrap API, admin CMS, WhatsApp buy | **Current** |
| **2** | Guest cart | Planned — tables in `schema.sql` |
| **3** | Checkout, COD, orders admin | Planned |
| **4** | Customer accounts, payment gateways | Planned |

See [`public/data/API-CATALOG.md`](public/data/API-CATALOG.md) for full endpoint inventory (~48 designed).

---

## 13. Known gaps & doc drift (action items)

| Item | Detail |
|------|--------|
| **`GET /page/hero` not implemented** | Documented in API-CATALOG; hero copy lives in JSON defaults only. |
| **Admin hero/journey/collections pages** | No routes yet. Page copy editable via `PUT /admin/page/:section` (except hero). |
| **Admin leads UI** | API + `leads` table (V002) exist; no Angular page. |
| **`savePageSection('hero')`** | `AdminDbService` can call it, but API rejects unknown section `hero`. |
| **Dashboard chart** | Placeholder demo data — not connected to real sales. |
| **Example migrations V006–V007** | Demo `payment_types` table/seed — rollback to V005 if not wanted on a given environment. |
---

## 14. Related documentation

| File | Contents |
|------|----------|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Short layered overview |
| [`orbit-api/database/README.md`](orbit-api/database/README.md) | **Migrations:** status, migrate, create, rollback |
| [`orbit-api/database/DEPLOY.md`](orbit-api/database/DEPLOY.md) | **CI deploy:** FTP + migrate secrets |
| [`orbit-api/README.md`](orbit-api/README.md) | API setup, curl examples |
| [`public/data/API-CATALOG.md`](public/data/API-CATALOG.md) | Full API inventory by phase |
| [`public/data/CONTENT-SCHEMA.md`](public/data/CONTENT-SCHEMA.md) | Entity map + insert order |
| [`public/data/PHASE-1-DB.md`](public/data/PHASE-1-DB.md) | Phase 1 DB integration guide |
| [`public/data/ADMIN.md`](public/data/ADMIN.md) | Admin CMS quick reference |

---

## 15. Quick decision guide

**Adding a new DB table or column?**  
→ `php bin/database migration:create DescribeChange` → edit `up`/`down` → `php bin/database migrate` → update repositories + Angular models/UI.

**Adding seed / reference data?**  
→ `php bin/database migration:create SeedThing --type=seed` with idempotent SQL → `migrate`. Never edit an applied seeder; add `V0xx__Update…` instead.

**Adding a new product field?**  
→ New migration + `ContentRepository` / `AdminRepository` + `site-content.model.ts` + batch editor UI + bootstrap assembly.

**Changing nav or footer?**  
→ Edit `public/data/site-content.json` only.

**New batch with schedule?**  
→ Admin → Batches → Add batch → set launch date → add products/media → Save (transaction endpoint).

**New public page?**  
→ Add route in `app.routes.ts`, page under `pages/`, optionally new `page_*` via migration + API if DB-backed.

**Protected write from Angular admin?**  
→ Add method to `AdminApiService` + `AdminRepository`; register route in `orbit-api/public/index.php`; use Bearer auth (not api key).
