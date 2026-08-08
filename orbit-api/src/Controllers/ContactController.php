<?php

declare(strict_types=1);

namespace OrbitApi\Controllers;

use OrbitApi\Repositories\ContentRepository;
use OrbitApi\Response;

final class ContactController
{
    public function __construct(
        private ContentRepository $repo,
        private array $config
    ) {
    }

    public function show(): void
    {
        $siteId = (string) ($_GET['siteId'] ?? $this->config['default_site_id']);
        $contact = $this->repo->getContact($siteId);
        if (!$contact) {
            Response::error('Contact not found', 404);
            return;
        }
        Response::json($contact);
    }
}
