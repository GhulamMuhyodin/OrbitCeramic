# Site content hierarchy (DB-ready)

```
site
└── batches[]                  (1 batch → many products)
    └── products[]
        ├── colors[]           (1 product → many colors, each has id)
        └── images[]           (1 product → many images, each has id)

journeyVideos[]                (FK batchId)
navLinks / contact / pageCopy  (site-level)
```

## Example

```json
{
  "id": "batch-002",
  "label": "Batch-002",
  "products": [
    {
      "id": "product-b2-orbit-cup",
      "name": "Orbit Cup",
      "colors": [
        { "id": "pc-b2-1", "name": "Ash mist", "hex": "#A8A29A", "sortOrder": 1 },
        { "id": "pc-b2-2", "name": "Raw clay", "hex": "#C4B5A0", "sortOrder": 2 }
      ],
      "images": [
        { "id": "pi-b2-1", "url": "/images/products/orbit-cup/orbit-cup-01.jpg", "sortOrder": 1 },
        { "id": "pi-b2-2", "url": "/images/products/orbit-cup/orbit-cup-02.jpg", "sortOrder": 2 },
        { "id": "pi-b2-3", "url": "/images/products/orbit-cup/orbit-cup-03.jpg", "sortOrder": 3 }
      ]
    }
  ]
}
```

## Future SQL tables

| JSON | Table | Keys |
|------|--------|------|
| `batches` | `batches` | PK `id` |
| `batches[].products` | `products` | PK `id`, FK `batch_id` |
| `products[].colors` | `product_colors` | PK `id`, FK `product_id` |
| `products[].images` | `product_images` | PK `id`, FK `product_id` |
| `journeyVideos` | `journey_videos` | PK `id`, FK `batch_id` |

`site.activeBatchId` = current shop / countdown batch.

Assembler: `assembleSiteContent()` in `src/app/data/site-content.model.ts`.
