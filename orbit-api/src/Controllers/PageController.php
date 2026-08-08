<?php

declare(strict_types=1);

namespace OrbitApi\Controllers;

use OrbitApi\Repositories\ContentRepository;
use OrbitApi\Response;

final class PageController
{
    public function __construct(
        private ContentRepository $repo,
        private array $config
    ) {
    }

    public function hero(): void
    {
        $this->respond($this->repo->getPageHero($this->siteId()), 'Hero page copy not found');
    }

    public function about(): void
    {
        $this->respond($this->repo->getPageAbout($this->siteId()), 'About page not found');
    }

    public function collections(): void
    {
        $this->respond($this->repo->getPageCollections($this->siteId()), 'Collections page not found');
    }

    public function journey(): void
    {
        $this->respond($this->repo->getPageJourney($this->siteId()), 'Journey page not found');
    }

    public function batchShop(): void
    {
        $this->respond($this->repo->getPageBatchShop($this->siteId()), 'Batch shop page not found');
    }

    private function siteId(): string
    {
        return (string) ($_GET['siteId'] ?? $this->config['default_site_id']);
    }

    private function respond(?array $data, string $missing): void
    {
        if ($data === null) {
            Response::error($missing, 404);
            return;
        }
        Response::json($data);
    }
}
