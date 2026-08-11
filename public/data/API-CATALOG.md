# Orbit Ceramic — API catalog

Base path (suggested): `/api/v1`  
Auth: public endpoints are open; admin endpoints require Bearer token (`admin_users`).

**Total endpoints designed: ~48** (nav/footer are static JSON — no DB APIs)

| Group | Count | When needed |
|-------|------:|-------------|
| A. Public content (replace JSON catalog) | 10 | **Phase 1** |
| B. Leads (WhatsApp bridge) | 2 | Phase 1 optional |
| C. Catalog extras | 4 | Phase 1–2 |
| D1. Cart | 6 | **Phase 2** |
| D2. Checkout place / pay | 8 | Phase 3 |
| E. Customer account | 6 | Phase 4 |
| F. Admin CMS + orders | 12 | Phase 3–4 |

> **Phase 1 = content DB only (no cart).** Nav + footer stay in `site-content.json`. See [`PHASE-1-DB.md`](./PHASE-1-DB.md).

---

## A. Public content — **10 APIs** (DB-backed)

These replace the catalog parts of `GET /data/site-content.json`.  
Client merges static `navLinks` + footer from JSON with the bootstrap/DB payload.

| # | Method | Path | Serves |
|---|--------|------|--------|
| 1 | `GET` | `/site` | Brand, activeBatchId, currency, timezone |
| 2 | `GET` | `/contact` | WhatsApp, email, Instagram, visit lines |
| 3 | `GET` | `/page/hero` | Default hero copy + image |
| 4 | `GET` | `/page/about` | About + paragraphs + published reviews |
| 5 | `GET` | `/page/collections` | Collections labels / empty states |
| 6 | `GET` | `/page/journey` | Journey page copy |
| 7 | `GET` | `/page/batch-shop` | Shop labels + currency display |
| 8 | `GET` | `/batches` | All batches (for collections + journey filter) |
| 9 | `GET` | `/batches/active` | Active batch + products + countdown/celebration |
| 10 | `GET` | `/batches/:id` | One batch detail (future deep links) |

**Not DB APIs (static chrome):** `/nav`, `/page/footer` — read from `site-content.json` in Angular.

**Convenience (optional instead of 1–10):**

| # | Method | Path | Serves |
|---|--------|------|--------|
| — | `GET` | `/bootstrap` | Assembled DB payload (omit `nav` / `footer`; client merges static) |

Journey / hero media can be nested under batch responses **or**:

| # | Method | Path | Serves |
|---|--------|------|--------|
| 13* | `GET` | `/batches/:id/journey` | Videos + images for journey card |
| 14* | `GET` | `/batches/:id/hero-highlights` | Hero highlight images |

\*Count as **C** below if split; if nested in #8–9, keep public content at **10**.

**Recommended Phase 1 minimum for parity with the Angular app:**

1. `GET /bootstrap` **or** endpoints **1–10**  
2. Client merges static nav + footer from JSON  
3. Client keeps assemble rules: live, hero window, celebration day, journey unlock  

---

## B. Leads — **2 APIs**

| # | Method | Path | Body | Serves |
|---|--------|------|------|--------|
| 15 | `POST` | `/leads` | `{ type: buy\|custom, productId, batchId, message?, meta? }` | Log intent before opening WhatsApp |
| 16 | `GET` | `/admin/leads` | — | Admin list (auth) |

---

## C. Catalog extras — **4 APIs**

| # | Method | Path | Serves |
|---|--------|------|--------|
| 17 | `GET` | `/products` | Flat catalog (collections view-all) `?batchId&available&page&limit` |
| 18 | `GET` | `/products/:id` | Product detail + colors + images |
| 19 | `GET` | `/server-time` | ISO now (reliable countdown vs client clock) |
| 20 | `GET` | `/batches/:id/journey` | Journey media (if not nested) |

---

## D. Checkout — **14 APIs** (future)

| # | Method | Path | Serves |
|---|--------|------|--------|
| 21 | `POST` | `/cart` | Create / resume guest cart (`sessionKey`) |
| 22 | `GET` | `/cart` | Current cart + lines |
| 23 | `POST` | `/cart/items` | Add product (+ optional colorId, qty) |
| 24 | `PATCH` | `/cart/items/:id` | Update quantity |
| 25 | `DELETE` | `/cart/items/:id` | Remove line |
| 26 | `GET` | `/shipping-methods` | Active shipping options |
| 27 | `POST` | `/checkout/preview` | Totals (subtotal, shipping, grand) |
| 28 | `POST` | `/checkout/place` | Create `orders` + reserve stock |
| 29 | `GET` | `/orders/:orderNumber` | Guest order status (tokenized) |
| 30 | `POST` | `/payments/intent` | Start payment (JazzCash/Stripe/COD) |
| 31 | `POST` | `/payments/webhook` | Provider callback |
| 32 | `POST` | `/payments/confirm` | Client confirm after redirect |
| 33 | `GET` | `/checkout/config` | Enabled gateways, COD on/off |
| 34 | `POST` | `/cart/merge` | Merge guest cart after login |

---

## E. Customer account — **6 APIs** (future)

| # | Method | Path | Serves |
|---|--------|------|--------|
| 35 | `POST` | `/auth/register` | Create customer |
| 36 | `POST` | `/auth/login` | Session / JWT |
| 37 | `POST` | `/auth/logout` | End session |
| 38 | `GET` | `/me` | Profile |
| 39 | `GET` | `/me/orders` | Order history |
| 40 | `GET/POST/PATCH` | `/me/addresses` | Address book (treat as 1 resource group → count **1** here; expand later) |

*(If addresses are split CRUD: +3 endpoints → total public commerce rises accordingly. Catalog above keeps addresses as one grouped resource for the **48** total.)*

**Addresses expanded (optional +3):** `GET/POST /me/addresses`, `PATCH/DELETE /me/addresses/:id` → replace #40 with 3 → **50** total. Documented as **6** including grouped addresses.

---

## F. Admin CMS + fulfillment — **12 APIs**

| # | Method | Path | Serves |
|---|--------|------|--------|
| 41 | `POST` | `/admin/auth/login` | Admin JWT |
| 42 | `GET/PUT` | `/admin/batches` | List / update batch schedule & copy |
| 43 | `GET/PUT` | `/admin/products` | List / upsert products + stock |
| 44 | `PUT` | `/admin/sites/active-batch` | Set `active_batch_id` |
| 45 | `GET/PUT` | `/admin/page/:section` | Edit page copy sections |
| 46 | `GET` | `/admin/orders` | Filter by status |
| 47 | `PATCH` | `/admin/orders/:id/status` | processing → shipped → delivered |
| 48 | `GET/PATCH` | `/admin/leads/:id` | Lead triage |
| 49 | `POST` | `/admin/media` | Upload image → URL |
| 50 | `GET/PUT` | `/admin/reviews` | Moderate about reviews |

*(Admin group: **12** endpoints numbered 41–50; expand further as needed.)*

---

## Mapping: screen → APIs

| Screen | APIs used today (Phase 1) | Later |
|--------|---------------------------|--------|
| Home | `/bootstrap` or site+hero+active batch+highlights | celebration stays client |
| Batch | active batch + batch-shop + contact | cart add `#23`, checkout |
| Collections | batches + products + collections page | custom lead `#15` |
| Journey | batches + journey media + journey page | — |
| About | about page | optional review submit (future +1) |
| Checkout (new) | — | `#21`–`#34` |
| Account (new) | — | `#35`–`#40` |
| Admin (new) | — | `#41`–`#50` |

---

## Phase recommendation

### Phase 1 — Content DB only (no cart)
See [`PHASE-1-DB.md`](./PHASE-1-DB.md).

- `GET /bootstrap` (replace JSON)
- Optional `GET /server-time`, `POST /leads`
- WhatsApp buy/custom unchanged

### Phase 2 — Guest cart
- Cart create / get / add / patch / delete

### Phase 3 — Place order + COD
- Checkout, shipping, payments (COD), stock tracking, order admin

### Phase 4 — Accounts + gateways + full CMS
- Customer auth, JazzCash/Stripe, admin CRUD

---

## Example: Phase 1 bootstrap response shape

```json
{
  "serverTime": "2026-07-30T18:00:00.000Z",
  "site": { "id": "site-orbit", "brand": "Orbit Ceramic", "activeBatchId": "batch-001" },
  "contact": { "whatsapp": "923227987366", "email": "...", "visitLines": [] },
  "hero": {},
  "heroHighlights": [],
  "batch": {},
  "batches": [],
  "journeyCards": [],
  "about": {},
  "collections": {},
  "journey": {}
}
```

`nav` and `footer` are **not** returned from the DB API — Angular keeps them from `site-content.json` (or a small static chrome file) and merges after bootstrap.

Same assemble contract as today’s `SiteContent` for catalog/about fields → `SiteContentService` swaps catalog URL for `/api/v1/bootstrap` and merges chrome.