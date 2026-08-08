<?php

declare(strict_types=1);

namespace OrbitApi\Controllers;

use OrbitApi\Repositories\ContentRepository;
use OrbitApi\Response;

final class ProductController
{
    public function __construct(
        private ContentRepository $repo,
        private array $config
    ) {
    }

    public function index(): void
    {
        $siteId = (string) ($_GET['siteId'] ?? $this->config['default_site_id']);
        if (!$this->repo->siteExists($siteId)) {
            Response::error('Site not found', 404);
            return;
        }

        $batchId = isset($_GET['batchId']) ? (string) $_GET['batchId'] : null;
        $available = null;
        if (isset($_GET['available'])) {
            $available = filter_var($_GET['available'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        }
        $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;

        Response::json([
            'items' => $this->repo->listProducts($siteId, $batchId, $available, $page, $limit),
            'page' => max(1, $page),
            'limit' => max(1, min(100, $limit)),
        ]);
    }

    public function show(array $params): void
    {
        $product = $this->repo->getProduct((string) $params['id']);
        if (!$product) {
            Response::error('Product not found', 404);
            return;
        }
        Response::json($product);
    }
}
