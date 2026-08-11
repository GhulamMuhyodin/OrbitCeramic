# Admin CMS (Phase 1)

Public URL: **`/admin`**

Requires **orbit-api** running (`START-API.bat`) and `ng serve` (proxies `/api` → `:8080`).

## Batches = launch CMS

Open **Batches → Add batch / Edit**. One screen owns:

1. Launch date & batch copy  
2. Products (upload images → API media)  
3. Journey (stills + one video)  
4. Hero highlight images  
5. **Save** → writes MySQL via `/api/v1/admin/*`, including `PUT /api/v1/admin/batches/:id/transaction` for atomic save flow

## Other pages

| Route | Purpose |
|-------|---------|
| `/admin/site` | Brand, active batch, WhatsApp (nav is JSON-only) |
| `/admin/batches` | Batch list |
| `/admin/batches/:id` | Full batch editor |
| `/admin/hero` | Default site hero copy |
| `/admin/journey` | Journey page labels |
| `/admin/about` | About & reviews |
| `/admin/pages` | Collections / shop (footer JSON-only) |
| `/admin/guide` | How to publish |
| `/admin/leads` | Lead list from API |

## Config

- Angular: `src/app/config/api.config.ts` (`apiKey`)  
- PHP: `orbit-api/config/config.php` (`api_key` must match)
