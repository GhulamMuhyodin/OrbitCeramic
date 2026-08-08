<?php

declare(strict_types=1);

namespace OrbitApi\Controllers;

use OrbitApi\Repositories\ContentRepository;
use OrbitApi\Response;

final class BatchController
{
    public function __construct(
        private ContentRepository $repo,
        private array $config
    ) {
    }

    public function index(): void
    {
        $siteId = $this->siteId();
        if (!$this->repo->siteExists($siteId)) {
            Response::error('Site not found', 404);
            return;
        }
        Response::json(['items' => $this->repo->listBatches($siteId, true)]);
    }

    public function active(): void
    {
        $siteId = $this->siteId();
        $batch = $this->repo->getActiveBatch($siteId);
        if (!$batch) {
            Response::error('No active batch', 404);
            return;
        }
        Response::json($batch);
    }

    public function show(array $params): void
    {
        $siteId = $this->siteId();
        $batch = $this->repo->getBatch($siteId, (string) $params['id'], true);
        if (!$batch) {
            Response::error('Batch not found', 404);
            return;
        }
        Response::json($batch);
    }

    public function journey(array $params): void
    {
        $siteId = $this->siteId();
        $batchId = (string) $params['id'];
        if (!$this->repo->getBatch($siteId, $batchId, false)) {
            Response::error('Batch not found', 404);
            return;
        }
        Response::json($this->repo->getJourneyForBatch($batchId));
    }

    public function heroHighlights(array $params): void
    {
        $siteId = $this->siteId();
        $batchId = (string) $params['id'];
        if (!$this->repo->getBatch($siteId, $batchId, false)) {
            Response::error('Batch not found', 404);
            return;
        }
        Response::json(['items' => $this->repo->listHeroHighlights($batchId)]);
    }

    private function siteId(): string
    {
        return (string) ($_GET['siteId'] ?? $this->config['default_site_id']);
    }
}
