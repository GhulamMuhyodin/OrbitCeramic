<?php

declare(strict_types=1);

namespace OrbitApi\Controllers;

use OrbitApi\Repositories\ContentRepository;
use OrbitApi\Response;

final class LeadsController
{
    public function __construct(
        private ContentRepository $repo,
        private array $config
    ) {
    }

    public function create(): void
    {
        $body = orbit_json_body();
        $siteId = (string) ($body['siteId'] ?? $this->config['default_site_id']);
        $type = (string) ($body['type'] ?? '');

        if (!in_array($type, ['buy', 'custom', 'contact'], true)) {
            Response::error('type must be buy, custom, or contact', 422);
            return;
        }

        if (!$this->repo->siteExists($siteId)) {
            Response::error('Site not found', 404);
            return;
        }

        $meta = $body['meta'] ?? null;
        $metaJson = null;
        if (is_array($meta)) {
            $metaJson = json_encode($meta, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }

        try {
            $id = $this->repo->insertLead([
                'site_id' => $siteId,
                'type' => $type,
                'batch_id' => isset($body['batchId']) ? (string) $body['batchId'] : null,
                'product_id' => isset($body['productId']) ? (string) $body['productId'] : null,
                'customer_name' => isset($body['customerName']) ? (string) $body['customerName'] : null,
                'phone' => isset($body['phone']) ? (string) $body['phone'] : null,
                'email' => isset($body['email']) ? (string) $body['email'] : null,
                'message' => isset($body['message']) ? (string) $body['message'] : null,
                'meta_json' => $metaJson,
                'source_path' => isset($body['sourcePath']) ? (string) $body['sourcePath'] : null,
            ]);
            Response::json(['id' => $id, 'status' => 'new'], 201);
        } catch (\Throwable $e) {
            Response::error('Could not create lead: ' . $e->getMessage(), 500);
        }
    }
}
