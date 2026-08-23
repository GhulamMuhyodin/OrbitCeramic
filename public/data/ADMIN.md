# Admin CMS (Phase 1)

Public URL: **`/admin/login`**

Requires **orbit-api** running (`START-API.bat` or `php -S localhost:8080 router.php` in `orbit-api/public`) and `ng serve` (proxies `/api` → `:8080`).

## Authentication

- Sign in with **username + password** (seeded by migration **V003** — default `admin` / `change-me-admin-password`).
- Session Bearer token is stored client-side and sent on all `/api/v1/admin/*` requests.
- Change password from the admin sidebar.

## Routes (implemented)

| Route | Purpose |
|-------|---------|
| `/admin/login` | Sign in |
| `/admin` | Dashboard — batch/product/review counts |
| `/admin/site` | Brand, site image, active batch, WhatsApp, email |
| `/admin/batches` | Batch list — add, delete, sold-out, set active |
| `/admin/batches/:id` | **Full batch editor** (see below) |
| `/admin/about` | About page copy + image |
| `/admin/reviews` | Client reviews shown on About |

### Not routed (yet)

These were planned or exist as orphan files but have **no admin route** today:

- Hero page copy editor (hero stays in `site-content.json` defaults)
- Journey / collections / batch-shop label editors (editable via API only: `PUT /admin/page/:section`)
- Leads list (`GET /admin/leads` exists; no UI)
- Guide page (`admin/pages/guide/` — file exists, not in router)

## Batches = launch CMS

Open **Batches → Add batch** or edit an existing batch. One screen owns:

1. **Launch schedule** — date/time; status: scheduled → live (24h celebration) → complete  
2. **Batch copy** — countdown + celebration headings  
3. **Products** — upload images → `POST /api/v1/admin/media`  
4. **Journey** — one video + stills per batch  
5. **Hero highlights** — pre-launch homepage images  
6. **Save** → `PUT /api/v1/admin/batches/:id/transaction` (atomic write)

New batches start as a **local draft** (launch defaults to +7 days) until Save persists to MySQL.

## Other content

| Content | Where to edit |
|---------|----------------|
| Nav links | `public/data/site-content.json` |
| Footer | `public/data/site-content.json` |
| Hero homepage copy | JSON defaults (no DB table yet) |
| Collections / journey / shop labels | API: `PUT /admin/page/collections` etc. (no admin UI) |

## Config alignment

| Angular | PHP |
|---------|-----|
| `src/app/config/api.config.ts` (`defaultSiteId`) | `orbit-api/config/config.php` (`default_site_id`) |
| Proxy `/api` → `:8080` | `cors_origins` includes `http://localhost:4200` |

## Database

Admin seed user comes from migration **V003** (`php bin/database migrate`).  
Schema changes: add a new migration — see [`../../orbit-api/database/README.md`](../../orbit-api/database/README.md).

Full project context: [`../../CONTEXT.md`](../../CONTEXT.md)
