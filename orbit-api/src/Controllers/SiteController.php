<?php

declare(strict_types=1);

namespace OrbitApi\Controllers;

use OrbitApi\Repositories\ContentRepository;
use OrbitApi\Response;

final class SiteController
{
    public function __construct(
        private ContentRepository $repo,
        private array $config
    ) {
    }

    public function show(): void
    {
        $siteId = (string) ($_GET['siteId'] ?? $this->config['default_site_id']);
        $site = $this->repo->getSite($siteId);
        if (!$site) {
            Response::error('Site not found', 404);
            return;
        }
        Response::json($site);
    }
}
