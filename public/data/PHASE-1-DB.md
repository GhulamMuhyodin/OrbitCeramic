# Phase 1 — DB integration (content only, no cart)

Phase 1 moves **product / batch / about / review** content onto MySQL.  
**Header nav and footer stay in `site-content.json`** (static chrome — not in DB).  
**No cart, no orders, no payments** in this phase. Buy/custom stay on WhatsApp.

---

## How to create / update the database

**Source of truth:** versioned migrations in [`orbit-api/database/migrations/`](../../orbit-api/database/migrations/).

```bat
cd orbit-api
php bin\database migrate
```

| Version | Purpose |
|---------|---------|
| V001 | Initial Phase 1 schema |
| V002 | `leads` table |
| V003 | Seed admin user (idempotent) |
| V004 | `page_about.image_alt` column |
| V005 | Seed default site / contact / page copy (idempotent) |

Full CLI (status, create, rollback): [`orbit-api/database/README.md`](../../orbit-api/database/README.md)  
Project context: [`../../CONTEXT.md`](../../CONTEXT.md) §9

---

## Batch-centric domain

```
sites
 └─ media                          ← file metadata (disk + public_url)
 └─ batches (launch_at required)
     ├─ products
     │    ├─ product_colors
     │    └─ product_images → media
     ├─ journey_videos (UNIQUE batch_id — one video)
     │    └─ poster_media_id / video_media_id → media
     ├─ journey_images → media     ← many stills
     └─ hero_highlight_images → media
 └─ page_about
     └─ reviews
 └─ leads                          ← V002
 └─ admin_users / admin_sessions
 └─ database_migrations            ← migration history
```

**Static (not MySQL):** `navLinks`, footer copy / explore / social links in JSON.

Deleting a **batch** cascades products, colors, product_images, journey rows, and highlights.  
`media` rows are RESTRICT on product/journey/highlight FKs (delete media only when unused) or SET NULL on optional poster/video refs.

---

## Phase map

| Phase | Scope | Tables | APIs |
|-------|--------|--------|------|
| **1 (now)** | Catalog + about/reviews from DB + media uploads | Content + `media` + `leads` + auth | Bootstrap + admin CMS + optional leads |
| **2** | Guest **cart** | + `carts`, `cart_items` (new migrations) | Cart CRUD |
| **3** | Place order + COD | + orders, payments, shipping, inventory | Checkout |
| **4** | Accounts + gateways | + customers | Auth, pay |

Future phase tables must be added as **new `V0xx__…` migrations**, never by editing V001.

---

## Phase 1 tables

Applied by migrations **V001–V005** (see chain above).

### Included
`sites`, `contacts`, **`media`**, `batches`, `products`, `product_colors`, `product_images`, `journey_videos` (1 per batch), `journey_images`, `hero_highlight_images`, `page_about`, `page_reviews`, `reviews`, `page_collections`, `page_journey`, `page_batch_shop`, **`leads`**, `admin_users`, `admin_sessions`, `database_migrations`.

### Not in Phase 1 DB
- **Chrome:** `nav_links`, `page_footer`, `footer_explore_links`, `footer_social_links` (live in JSON)
- **Hero page copy:** no `page_hero` table — defaults merged from JSON in Angular
- **Commerce:** `carts`, `cart_items`, `orders`, `order_items`, `payments`, `customers`, `customer_addresses`, `shipping_methods`, `inventory_movements`

### Auth
- **`admin_users`**, **`admin_sessions`** — username/password login for `/admin` (seeded by **V003**)

---

## Media upload

1. Client uploads file → `POST /api/v1/admin/media` (Bearer) or legacy `POST /api/v1/media` (`X-Api-Key`)
2. PHP writes under `uploads/…`, inserts `media` row
3. Admin attaches `media_id` on product/journey/highlight rows
4. Bootstrap joins or uses denormalized `url` / `public_url`

---

## Phase 1 APIs

Implemented in the separate PHP project: **[`orbit-api/`](../../orbit-api/README.md)**.

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | `GET` | `/api/v1/bootstrap` | Assembled DB payload (no nav/footer — client merges static chrome) |
| 2 | `POST` | `/api/v1/media` | Upload image/video → `media` row (`X-Api-Key`) |
| 3 | `GET` | `/api/v1/server-time` | ISO now for countdown (optional) |
| 4 | `POST` | `/api/v1/leads` | Optional WhatsApp lead log |

Admin batch CRUD endpoints are implemented under `/api/v1/admin/*` in [`orbit-api/`](../../orbit-api/README.md) (auth via **username/password → Bearer session token**; legacy `X-Api-Key` only for public `POST /media`).

---

## Angular admin (this repo)

**Batches → [batch]** is the single launch editor: launch date, products + images, one journey video + journey stills, highlight images, Save.

**Routed admin pages:** dashboard, site, batches (+ detail), about, reviews.  
**Not routed yet:** hero/journey/collections label editors, leads list, guide page.  
Nav / footer: edit in JSON — not MySQL CMS.

Master context doc: [`../../CONTEXT.md`](../../CONTEXT.md)

---

## Seed checklist (fresh install)

```bat
php bin\database migrate
```

That applies admin user (V003) + default site/contact/page copy (V005). Then create batches/products in Admin CMS.

Nav + footer remain in `site-content.json`.  
Insert order for content: [`CONTENT-SCHEMA.md`](./CONTENT-SCHEMA.md)
