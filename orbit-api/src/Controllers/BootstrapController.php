<?php

declare(strict_types=1);

namespace OrbitApi\Controllers;

use OrbitApi\Repositories\ContentRepository;
use OrbitApi\Response;

final class BootstrapController
{
    public function __construct(
        private ContentRepository $repo,
        private array $config
    ) {
    }

    public function handle(): void
    {
        $siteId = trim((string) ($_GET['siteId'] ?? $this->config['default_site_id'] ?? 'site-orbit'));
        if ($siteId === '') {
            $siteId = 'site-orbit';
        }
        try {
            $payload = $this->repo->buildBootstrap($siteId);
            Response::json($payload);
        } catch (\RuntimeException $e) {
            $code = (int) $e->getCode();
            if ($code < 400 || $code > 599) {
                $code = 500;
            }
            Response::error($e->getMessage(), $code);
        } catch (\Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
