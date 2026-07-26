# Orbit Ceramic — image sizes

Export **JPEG** (quality ~80–85) or **WebP**. Keep the subject centered; UI crops with `object-fit: cover`.

## Required sizes

| Use | Path | Aspect | Export size (px) | Notes |
|-----|------|--------|------------------|--------|
| **Hero** | `hero/hero-01.jpg` | **3:2** landscape | **1920 × 1280** (min 1800 × 1200) | Full-screen cover. Keep focus in center; edges may crop on tall phones. |
| **About** | `about/about-01.jpg` | **4:5** portrait | **1200 × 1500** | Maker / studio portrait. |
| **Product** (batch + collections) | `products/{slug}/{slug}-01.jpg` … `-03.jpg` | **4:5** portrait | **1200 × 1500** (min 800 × 1000) | Main shop + archive. Need **3 angles** per piece. |
| **Journey card** | same as poster below, or dedicated | **16:10** | **1600 × 1000** | Batch card on Journey page (uses first video poster today). |
| **Journey / video poster** | `video/{name}-01.jpg` | **16:9** | **1920 × 1080** (min 1600 × 900) | Click-to-play poster before YouTube iframe. |
| **Logo / favicon** | `logo.jpg` | **1:1** | **512 × 512** (min 256 × 256) | Square crop. |

## Product naming

```
/images/products/orbit-cup/orbit-cup-01.jpg
/images/products/orbit-cup/orbit-cup-02.jpg
/images/products/orbit-cup/orbit-cup-03.jpg
```

Use zero-padded numbers: `01`, `02`, `03`.

Then register URLs in `site-content.json` → `productImages` table (`productId` + `url` + `sortOrder`).

## What you have now vs ideal

| File | Current | Ideal |
|------|---------|--------|
| `hero/hero-01.jpg` | 1800×1200 (3:2) | OK |
| `about/about-01.jpg` | 1200×800 (3:2) | Prefer **1200×1500 (4:5)** |
| `products/*` | 800×533 (3:2) | Prefer **1200×1500 (4:5)** — currently cropped in UI |
| `video/video-01.jpg` | 1600×1067 (~3:2) | Prefer **1920×1080 (16:9)** |
| `logo.jpg` | 726×742 | Prefer **512×512** square |

## File size targets

| Type | Aim for |
|------|---------|
| Hero | under ~300 KB |
| Product (each) | under ~150–200 KB |
| Video poster | under ~200 KB |
| About | under ~200 KB |
| Logo | under ~50 KB |

## Quick shoot tips

- **Products:** portrait frame, soft side light, plain background; leave margin so crop doesn’t cut the rim.
- **Hero:** wide scene, subject not too close to edges.
- **Journey poster:** landscape frame that still reads as a small card.
