# Site content + commerce schema

**Phase 1 SQL:** [`schema-phase1.sql`](./schema-phase1.sql)  
**Full SQL (all phases):** [`schema.sql`](./schema.sql)  
**APIs:** [`API-CATALOG.md`](./API-CATALOG.md)  
**Phase 1 guide:** [`PHASE-1-DB.md`](./PHASE-1-DB.md)  
**Current runtime:** the Phase 1 bootstrap API owns sites, batches, products, media, journey records, and page copy. `site-content.json` is static chrome only: nav links and footer copy used by the client alongside bootstrap.

---

## Review: does the schema fulfill today’s app?

| App feature | Covered? | Where |
|-------------|----------|--------|
| Brand, active batch | Yes | DB `sites` |
| Contact / WhatsApp / visit | Yes | DB `contacts`, `contact_visit_lines` |
| Header nav | Yes (static) | `site-content.json` `navLinks` — **not** MySQL |
| Batch countdown + celebration copy | Yes | DB `batches` |
| Hero window days + highlights | Yes | DB `batches.hero_window_days`, `hero_highlight_images` |
| Products, colors, images, sold-out | Yes | DB `products`, `product_colors`, `product_images` |
| Journey videos / stills | Yes | DB `journey_videos` (1/batch), `journey_images` → `media`; videos may use `video_url` for an external embed or `video_media_id` for an uploaded file |
| File uploads | Yes | DB `media` (disk_path + public_url) |
| Page copy (hero, about, collections, journey, shop) | Yes | DB `page_*` (+ about children) |
| Footer | Yes (static) | `site-content.json` — **not** MySQL |
| About reviews | Yes | DB `about_reviews` |
| Live / celebration / hero window rules | Derived in app from `launch_at` | — |
| Guest cart | Phase 2 | `carts`, `cart_items` |

### Gaps fixed vs earlier draft

1. **`product_colors` / `product_images` PKs** — JSON reuses ids; tables use `AUTO_INCREMENT`.  
2. **Checkout readiness** — commerce tables present for later phases.  
3. **WhatsApp bridge** — `leads`.  
4. **Admin** — `admin_users` (later).  
5. **Nav / footer out of DB** — chrome stays in JSON; bootstrap merges with DB payload.

---

## Entity map

```
CONTENT (Phase 1 DB)             STATIC JSON              COMMERCE (later)
────────────────────             ───────────              ────────────────
sites ─┬─ media                  navLinks                 carts ─ cart_items     ← Phase 2
       ├─ contacts               footer (+ links)         orders ─ payments      ← Phase 3
       ├─ batches ─┬─ products                            customers / admin      ← Phase 4
       │           │   ├─ colors
       │           │   └─ images → media
       │           ├─ journey_videos (1 per batch) → media
       │           ├─ journey_images → media
       │           └─ hero_highlights → media
       ├─ page_about (+ paragraphs, reviews)
       └─ page_hero / collections / journey / shop
                                 leads (optional Phase 1)
```

**Batch cascade:** deleting a batch removes its products, images, journey rows, and highlights.

---

## Phased rollout

1. **Phase 1 (now)** — DB catalog + about/reviews + `GET /bootstrap`; client merges static nav/footer; WhatsApp buy; **no cart**.  
2. **Phase 2** — Guest cart.  
3. **Phase 3** — Place order + COD / stock.  
4. **Phase 4** — Accounts, payment gateways, admin CMS.

Details: [`PHASE-1-DB.md`](./PHASE-1-DB.md)

---

## Insert order (content)

1. `sites`  
2. `media` (as files are uploaded)  
3. `batches` → set `sites.active_batch_id`  
4. `products` → colors / images (`media_id`)  
5. `journey_videos` (one per batch) + `journey_images` + `hero_highlight_images`  
6. `contacts` + visit lines  
7. `page_about` + paragraphs + reviews; other `page_*` copy  
8. Nav + footer: edit `site-content.json` only  

## Insert order (commerce)

1. `shipping_methods`  
2. `customers` / addresses (optional)  
3. `carts` → items → `orders` → items → `payments`  
4. `inventory_movements` on reserve/commit  
