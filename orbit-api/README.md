# Orbit Ceramic API (Phase 1)

Separate PHP API for the Orbit Angular storefront.

- **Schema / seeds:** versioned migrations in [`database/migrations/`](database/migrations/) — run `php bin/database migrate`  
  Guide: [`database/README.md`](database/README.md)
- **In DB:** admin users/sessions, batches, products, about, reviews, media, page copy, contact, leads  
- **Not in DB:** header nav + footer (Angular keeps `site-content.json` chrome)
- Domain notes: [`../public/data/PHASE-1-DB.md`](../public/data/PHASE-1-DB.md), [`../CONTEXT.md`](../CONTEXT.md)

Requires **PHP 8.1+** with `pdo_mysql`, `fileinfo`, and **MySQL 8 / MariaDB 10.5+**.

---

## Setup

1. Copy config:

```bash
cp config/config.example.php config/config.php
```

Edit `config/config.php` — DB credentials, `public_base_url`, `api_key`, CORS origins.

2. Apply database migrations (creates empty DB if missing; schema + idempotent seeds):

```bat
cd orbit-api
php bin\database migrate
php bin\database status
```

See [`database/README.md`](database/README.md). Admin login defaults: `admin` / `change-me-admin-password` (from **V003**). Change immediately on shared hosts.

CI deploy + migrate: [`database/DEPLOY.md`](database/DEPLOY.md).

3. Start the API (Windows + XAMPP):

```bat
orbit-api\run-local.bat
```

Or manually (**`router.php` is required** — without it you get `No such file or directory` on `/api/...`):

```bat
cd orbit-api\public
C:\xampp\php\php.exe -S localhost:8080 router.php
```

Open **http://localhost:8080/api/v1/health** (not only `127.0.0.1` if the browser uses IPv6 `[::1]`).

---

## Phase 1 endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/v1/bootstrap` | — | Full catalog payload (no nav/footer) |
| `GET` | `/api/v1/server-time` | — | ISO clock for countdown |
| `POST` | `/api/v1/media` | `X-Api-Key` | Upload image/video → `media` row |
| `POST` | `/api/v1/leads` | — | Log WhatsApp buy/custom intent |
| `GET` | `/api/v1/site` | — | Brand + activeBatchId |
| `GET` | `/api/v1/contact` | — | WhatsApp / email / visit lines |
| `GET` | `/api/v1/page/hero` | — | Hero copy |
| `GET` | `/api/v1/page/about` | — | About + published reviews |
| `GET` | `/api/v1/page/collections` | — | Collections labels |
| `GET` | `/api/v1/page/journey` | — | Journey page labels |
| `GET` | `/api/v1/page/batch-shop` | — | Shop labels / currency |
| `GET` | `/api/v1/batches` | — | All batches + products |
| `GET` | `/api/v1/batches/active` | — | Active batch |
| `GET` | `/api/v1/batches/:id` | — | One batch |
| `GET` | `/api/v1/batches/:id/journey` | — | Story video + images |
| `GET` | `/api/v1/batches/:id/hero-highlights` | — | Pre-launch highlight photos |
| `GET` | `/api/v1/products` | — | Flat catalog (`?batchId&available&page&limit`) |
| `GET` | `/api/v1/products/:id` | — | Product + colors + images |
| `GET` | `/api/v1/health` | — | Liveness |

Optional query on most reads: `?siteId=site-orbit` (default from config).

### Bootstrap shape

Returns Angular-friendly camelCase close to `SiteContentDb`, **without** `navLinks` / `pageCopy.footer`:

```json
{
  "version": 1,
  "serverTime": "2026-07-31T22:00:00+05:00",
  "site": { "id": "site-orbit", "brand": "Orbit Ceramic", "activeBatchId": "batch-001" },
  "contact": {},
  "batches": [],
  "journeyVideos": [],
  "journeyImages": [],
  "heroHighlightImages": [],
  "pageCopy": { "hero": {}, "about": {}, "collections": {}, "journey": {}, "batchShop": {} }
}
```

Angular should merge static nav + footer from `site-content.json`.

### Upload media

```bash
curl -X POST http://localhost:8080/api/v1/media \
  -H "X-Api-Key: change-me-orbit-media-key" \
  -F "file=@photo.jpg" \
  -F "siteId=site-orbit"
```

Files land in `public/uploads/` and a `media` row is inserted.

### Create lead

```bash
curl -X POST http://localhost:8080/api/v1/leads \
  -H "Content-Type: application/json" \
  -d '{"type":"buy","siteId":"site-orbit","batchId":"batch-001","productId":"product-1"}'
```

---

## Hostinger notes

1. Create MySQL DB in hPanel; put credentials in GitHub Environment secrets (see [`database/DEPLOY.md`](database/DEPLOY.md)).  
2. Enable **Remote MySQL** so GitHub Actions can run `php bin/database migrate`.  
3. Push to `uat` / `prod` — workflow deploys Angular + `php/` API and runs migrations.  
4. Ensure `php/public/uploads` is writable.  
5. Site `.htaccess` rewrites `/api/*` → `php/public/index.php` and `/uploads/*` → API uploads.  
6. Set `ORBIT_PUBLIC_BASE_URL` / `ORBIT_CORS_ORIGINS` secrets to your live domain.

## Admin APIs (insert / manage content)

All admin routes (except login) require a session token:

```http
Authorization: Bearer <token-from-login>
```

Public `POST /api/v1/media` still accepts `X-Api-Key` for legacy/scripts; admin uploads use `POST /api/v1/admin/media` with Bearer auth.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/admin/auth/login` | Body `{ "username", "password" }` → Bearer session token |
| `GET/PUT` | `/api/v1/admin/site` | Brand + create/update site |
| `PUT` | `/api/v1/admin/sites/active-batch` | `{ "activeBatchId": "batch-001" }` |
| `GET/PUT` | `/api/v1/admin/contact` | WhatsApp / email / visit lines |
| `GET/POST` | `/api/v1/admin/batches` | List / **create batch** |
| `GET/PUT/DELETE` | `/api/v1/admin/batches/:id` | Read / update / delete batch |
| `PUT` | `/api/v1/admin/batches/:id/journey` | Batch story video + images |
| `PUT` | `/api/v1/admin/batches/:id/hero-highlights` | Pre-launch highlight photos |
| `GET/POST` | `/api/v1/admin/products` | List / **create product** |
| `GET/PUT/DELETE` | `/api/v1/admin/products/:id` | Product + colors + images |
| `GET/PUT` | `/api/v1/admin/page/:section` | `hero` \| `about` \| `collections` \| `journey` \| `batch-shop` |
| `GET/POST` | `/api/v1/admin/reviews` | List / create review |
| `PUT/DELETE` | `/api/v1/admin/reviews/:id` | Update / delete review |
| `POST` | `/api/v1/admin/media` | Upload file → `media` row |
| `PUT` | `/api/v1/admin/batches/:id/transaction` | Save batch + products + journey + highlights in one transaction |
| `GET` | `/api/v1/admin/leads` | Lead list |

### Recommended insert order (admin UI)

1. `PUT /admin/site` — ensure `site-orbit` exists  
2. `PUT /admin/contact`  
3. `POST /admin/media` — upload photos (keep returned `id` + `publicUrl`)  
4. `POST /admin/batches` — create batch with `launchAt`  
5. `POST /admin/products` — `batchId` + colors; images need `mediaId` + `url` from step 3  
6. `PUT .../journey` + `PUT .../hero-highlights`  
7. `PUT /admin/page/about` + `POST /admin/reviews`  
8. `PUT /admin/page/countdown` — site-wide countdown & celebration copy  
9. `PUT /admin/sites/active-batch`

### Create batch example

```bash
curl -X POST http://127.0.0.1:8080/api/v1/admin/batches ^
  -H "Content-Type: application/json" ^
  -H "X-Api-Key: change-me-orbit-media-key" ^
  -d "{\"label\":\"Batch-002\",\"launchAt\":\"2026-08-15T22:00:00+05:00\",\"launchDisplay\":\"Aug 15\",\"heroWindowDays\":10}"
```

### Countdown & celebration example

```bash
curl -X PUT http://127.0.0.1:8080/api/v1/admin/page/countdown ^
  -H "Content-Type: application/json" ^
  -H "X-Api-Key: change-me-orbit-media-key" ^
  -d "{\"countdownEyebrow\":\"Next\",\"countdownHeading\":\"Batch launching soon\",\"countdownLede\":\"...\",\"celebrationHeading\":\"Live\",\"celebrationLede\":\"...\"}"
```

### Create product example

```bash
curl -X POST http://127.0.0.1:8080/api/v1/admin/products ^
  -H "Content-Type: application/json" ^
  -H "X-Api-Key: change-me-orbit-media-key" ^
  -d "{\"batchId\":\"batch-001\",\"name\":\"Orbit Bowl\",\"price\":6500,\"description\":\"...\",\"summary\":\"...\",\"dimensions\":\"H 8 cm\",\"alt\":\"Bowl\",\"colors\":[{\"name\":\"Ash\",\"hex\":\"#C7C1AD\"}],\"images\":[{\"mediaId\":\"media-xxx\",\"url\":\"http://127.0.0.1:8080/uploads/media-xxx.jpg\"}]}"
```

Nav / footer stay in Angular `site-content.json` (not these APIs).
