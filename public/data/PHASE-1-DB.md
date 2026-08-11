# Phase 1 — DB integration (content only, no cart)

Phase 1 moves **product / batch / about / review** content onto MySQL.  
**Header nav and footer stay in `site-content.json`** (static chrome — not in DB).  
**No cart, no orders, no payments** in this phase. Buy/custom stay on WhatsApp.

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
     ├─ about_paragraphs
     └─ about_reviews
```

**Static (not MySQL):** `navLinks`, footer copy / explore / social links in JSON.

Deleting a **batch** cascades products, colors, product_images, journey rows, and highlights.  
`media` rows are RESTRICT on product/journey/highlight FKs (delete media only when unused) or SET NULL on optional poster/video refs.

---

## Phase map

| Phase | Scope | Tables | APIs |
|-------|--------|--------|------|
| **1 (now)** | Catalog + about/reviews from DB + media uploads | Content + `media` | Bootstrap + `POST /media` (+ optional server-time, leads) |
| **2** | Guest **cart** | + `carts`, `cart_items` | Cart CRUD |
| **3** | Place order + COD | + orders, payments, shipping, inventory | Checkout |
| **4** | Accounts + gateways + admin | + customers, admin_users | Auth, pay, CMS |

---

## Phase 1 tables

Import **[`schema-phase1.sql`](./schema-phase1.sql)** (**19** tables).  

### Included
`sites`, `contacts` (`line_text`), **`media`**, `batches`, `products`, `product_colors`, `product_images`, `journey_videos` (1 per batch), `journey_images`, `hero_highlight_images`,  `page_about`, `about_paragraphs`, `about_reviews`, `page_collections`, `page_journey`, `page_batch_shop`, optional `leads`.

### Not in Phase 1 DB
- **Chrome:** `nav_links`, `page_footer`, `footer_explore_links`, `footer_social_links` (live in JSON)
- **Commerce:** `carts`, `cart_items`, `orders`, `order_items`, `payments`, `customers`, `customer_addresses`, `shipping_methods`, `inventory_movements`, `admin_users`

---

## Media upload (PHP later)

1. Client uploads file → `POST /api/v1/media`  
2. PHP writes under `uploads/…`, inserts `media` row  
3. Admin attaches `media_id` on product/journey/highlight rows  
4. Bootstrap joins or uses denormalized `url` / `public_url`

Until PHP exists, Angular admin stores preview URLs (data URLs or `/images/…` paths) in the JSON draft.

---

## Phase 1 APIs

Implemented in the separate PHP project: **[`orbit-api/`](../../orbit-api/README.md)**.

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | `GET` | `/api/v1/bootstrap` | Assembled DB payload (no nav/footer — client merges static chrome) |
| 2 | `POST` | `/api/v1/media` | Upload image/video → `media` row (`X-Api-Key`) |
| 3 | `GET` | `/api/v1/server-time` | ISO now for countdown (optional) |
| 4 | `POST` | `/api/v1/leads` | Optional WhatsApp lead log |

Admin batch CRUD endpoints are implemented under `/api/v1/admin/*` in [`orbit-api/`](../../orbit-api/README.md) (auth via `X-Api-Key`).

---

## Angular admin (this repo)

**Batches → [batch]** is the single launch editor: launch date, products + images, one journey video + journey stills, highlight images, Save.

Hero / Journey admin pages edit **page copy only** (not per-batch media).  
Nav / footer: edit in JSON (or leave as shipped defaults) — not MySQL CMS.

---

## Seed checklist

- [ ] 1 `sites` row  
- [ ] `media` rows as needed  
- [ ] `contacts` + visit lines  
- [ ] `batches` + `active_batch_id`  
- [ ] `products` + colors + images (`media_id`)  
- [ ] one `journey_videos` per batch + `journey_images`  
- [ ] `hero_highlight_images`  
- [ ] `page_about` + paragraphs + reviews  
- [ ] Other `page_*` copy (hero, collections, journey, shop)  
- [ ] Nav + footer remain in `site-content.json`

Insert order: [`CONTENT-SCHEMA.md`](./CONTENT-SCHEMA.md)
