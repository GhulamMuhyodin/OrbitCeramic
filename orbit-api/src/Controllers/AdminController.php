<?php

declare(strict_types=1);

namespace OrbitApi\Controllers;

use OrbitApi\AdminAuth;
use OrbitApi\Repositories\AdminRepository;
use OrbitApi\Repositories\ContentRepository;
use OrbitApi\Response;
use RuntimeException;
use Throwable;

final class AdminController
{
    public function __construct(
        private AdminRepository $admin,
        private ContentRepository $content,
        private MediaController $media,
        private array $config,
        private AdminAuth $auth
    ) {
    }

    public function login(): void
    {
        $body = orbit_json_body();
        $result = $this->auth->login(
            (string) ($body['username'] ?? ''),
            (string) ($body['password'] ?? ''),
        );
        if (!$result) {
            Response::error('Invalid username or password', 401);
            return;
        }
        Response::json($result);
    }

    public function me(): void
    {
        $user = $this->auth->currentUser();
        if (!$user) {
            Response::error('Unauthorized — please log in', 401);
            return;
        }
        Response::json(['user' => $user]);
    }

    public function logout(): void
    {
        if (!$this->gate()) {
            return;
        }
        $this->auth->logout();
    }

    public function changePassword(): void
    {
        $this->run(function () {
            $body = orbit_json_body();
            $this->auth->changePassword(
                (string) ($body['currentPassword'] ?? ''),
                (string) ($body['newPassword'] ?? ''),
            );
            Response::json(['changed' => true]);
        });
    }

    public function getSite(): void
    {
        if (!$this->gate()) {
            return;
        }
        $site = $this->content->getSite($this->siteId());
        if (!$site) {
            Response::error('Site not found', 404);
            return;
        }
        Response::json($site);
    }

    public function putSite(): void
    {
        $this->run(fn () => Response::json(
            $this->admin->upsertSite(orbit_json_body(), $this->siteId())
        ));
    }

    public function putActiveBatch(): void
    {
        $this->run(function () {
            $body = orbit_json_body();
            $batchId = $body['activeBatchId'] ?? $body['batchId'] ?? null;
            Response::json($this->admin->setActiveBatch(
                $this->siteId(),
                $batchId === null ? null : (string) $batchId
            ));
        });
    }

    public function getContact(): void
    {
        if (!$this->gate()) {
            return;
        }
        $contact = $this->content->getContact($this->siteId());
        if (!$contact) {
            Response::error('Contact not found', 404);
            return;
        }
        Response::json($contact);
    }

    public function putContact(): void
    {
        $this->run(fn () => Response::json(
            $this->admin->upsertContact($this->siteId(), orbit_json_body())
        ));
    }

    public function listBatches(): void
    {
        if (!$this->gate()) {
            return;
        }
        Response::json(['items' => $this->content->listBatches($this->siteId(), true)]);
    }

    public function getBatch(array $params): void
    {
        if (!$this->gate()) {
            return;
        }
        $batch = $this->content->getBatch($this->siteId(), (string) $params['id'], true);
        if (!$batch) {
            Response::error('Batch not found', 404);
            return;
        }
        Response::json($batch);
    }

    public function createBatch(): void
    {
        $this->run(fn () => Response::json(
            $this->admin->createBatch($this->siteId(), orbit_json_body()),
            201
        ));
    }

    public function updateBatch(array $params): void
    {
        $this->run(fn () => Response::json(
            $this->admin->updateBatch($this->siteId(), (string) $params['id'], orbit_json_body())
        ));
    }

    public function deleteBatch(array $params): void
    {
        $this->run(function () use ($params) {
            $this->admin->deleteBatch($this->siteId(), (string) $params['id']);
            Response::json(['deleted' => true, 'id' => $params['id']]);
        });
    }

    public function putJourney(array $params): void
    {
        $this->run(fn () => Response::json(
            $this->admin->putJourney($this->siteId(), (string) $params['id'], orbit_json_body())
        ));
    }

    public function putHighlights(array $params): void
    {
        $this->run(fn () => Response::json(
            $this->admin->putHeroHighlights($this->siteId(), (string) $params['id'], orbit_json_body())
        ));
    }

    public function listProducts(): void
    {
        if (!$this->gate()) {
            return;
        }
        $batchId = isset($_GET['batchId']) ? (string) $_GET['batchId'] : null;
        Response::json([
            'items' => $this->content->listProducts($this->siteId(), $batchId, null, 1, 100),
        ]);
    }

    public function getProduct(array $params): void
    {
        if (!$this->gate()) {
            return;
        }
        $product = $this->content->getProduct((string) $params['id']);
        if (!$product) {
            Response::error('Product not found', 404);
            return;
        }
        Response::json($product);
    }

    public function createProduct(): void
    {
        $this->run(fn () => Response::json(
            $this->admin->createProduct($this->siteId(), orbit_json_body()),
            201
        ));
    }

    public function updateProduct(array $params): void
    {
        $this->run(fn () => Response::json(
            $this->admin->updateProduct($this->siteId(), (string) $params['id'], orbit_json_body())
        ));
    }

    public function deleteProduct(array $params): void
    {
        $this->run(function () use ($params) {
            $this->admin->deleteProduct($this->siteId(), (string) $params['id']);
            Response::json(['deleted' => true, 'id' => $params['id']]);
        });
    }

    public function getPage(array $params): void
    {
        if (!$this->gate()) {
            return;
        }
        $section = (string) ($params['section'] ?? '');
        $siteId = $this->siteId();
        $data = match ($section) {
            'hero' => $this->content->getPageHero($siteId),
            'about' => $this->content->getPageAbout($siteId),
            'collections' => $this->content->getPageCollections($siteId),
            'journey' => $this->content->getPageJourney($siteId),
            'batch-shop' => $this->content->getPageBatchShop($siteId),
            default => null,
        };
        if ($data === null) {
            Response::error('Unknown or empty page section', 404);
            return;
        }
        Response::json($data);
    }

    public function putPage(array $params): void
    {
        $this->run(function () use ($params) {
            $section = (string) ($params['section'] ?? '');
            $siteId = $this->siteId();
            $body = orbit_json_body();
            $data = match ($section) {
                'hero' => $this->admin->putPageHero($siteId, $body),
                'about' => $this->admin->putPageAbout($siteId, $body),
                'collections' => $this->admin->putPageCollections($siteId, $body),
                'journey' => $this->admin->putPageJourney($siteId, $body),
                'batch-shop' => $this->admin->putPageBatchShop($siteId, $body),
                default => throw new RuntimeException('Unknown section', 404),
            };
            Response::json($data);
        });
    }

    public function listReviews(): void
    {
        if (!$this->gate()) {
            return;
        }
        Response::json(['items' => $this->admin->listReviews($this->siteId(), false)]);
    }

    public function createReview(): void
    {
        $this->run(fn () => Response::json(
            $this->admin->createReview($this->siteId(), orbit_json_body()),
            201
        ));
    }

    public function updateReview(array $params): void
    {
        $this->run(fn () => Response::json(
            $this->admin->updateReview($this->siteId(), (string) $params['id'], orbit_json_body())
        ));
    }

    public function deleteReview(array $params): void
    {
        $this->run(function () use ($params) {
            $this->admin->deleteReview($this->siteId(), (string) $params['id']);
            Response::json(['deleted' => true, 'id' => $params['id']]);
        });
    }

    public function listLeads(): void
    {
        if (!$this->gate()) {
            return;
        }
        $status = isset($_GET['status']) ? (string) $_GET['status'] : null;
        Response::json(['items' => $this->admin->listLeads($this->siteId(), $status)]);
    }

    public function uploadMedia(): void
    {
        if (!$this->gate()) {
            return;
        }
        $this->media->upload();
    }

    private function siteId(): string
    {
        $fromQuery = isset($_GET['siteId']) ? trim((string) $_GET['siteId']) : '';
        if ($fromQuery !== '') {
            return $fromQuery;
        }
        $body = orbit_json_body();
        if (!empty($body['siteId'])) {
            return trim((string) $body['siteId']);
        }
        return (string) ($this->config['default_site_id'] ?? 'site-orbit');
    }

    private function gate(): bool
    {
        return $this->auth->require();
    }

    private function run(callable $fn): void
    {
        if (!$this->gate()) {
            return;
        }
        try {
            $fn();
        } catch (RuntimeException $e) {
            $code = (int) $e->getCode();
            if ($code < 400 || $code > 599) {
                $code = 400;
            }
            Response::error($e->getMessage(), $code);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
