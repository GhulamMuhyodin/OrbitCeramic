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

    public function saveBatchTransaction(array $params): void
    {
        $this->run(function () use ($params) {
            $siteId = $this->siteId();
            $batchId = (string) $params['id'];

            if ($this->isMultipartRequest()) {
                $payload = $this->parseMultipartPayload();
                $uploadedFiles = $this->moveUploadedFiles();
                try {
                    Response::json(
                        $this->admin->saveBatchTransactionMultipart($siteId, $batchId, $payload, $uploadedFiles),
                    );
                } catch (\Throwable $e) {
                    foreach ($uploadedFiles as $upload) {
                        if (!empty($upload['diskPath']) && file_exists($upload['diskPath'])) {
                            @unlink($upload['diskPath']);
                        }
                    }
                    throw $e;
                }
                return;
            }

            Response::json(
                $this->admin->saveBatchTransaction($siteId, $batchId, orbit_json_body()),
            );
        });
    }

    private function isMultipartRequest(): bool
    {
        return isset($_SERVER['CONTENT_TYPE']) && str_contains((string) $_SERVER['CONTENT_TYPE'], 'multipart/form-data');
    }

    private function parseMultipartPayload(): array
    {
        if (!isset($_POST['payload']) || !is_string($_POST['payload'])) {
            throw new RuntimeException('Missing payload JSON for multipart batch save', 422);
        }

        $payload = json_decode($_POST['payload'], true);
        if (!is_array($payload)) {
            throw new RuntimeException('Invalid multipart payload JSON', 422);
        }

        return $payload;
    }

    private function moveUploadedFiles(): array
    {
        if (!is_array($_FILES)) {
            return [];
        }

        $uploads = [];
        foreach ($_FILES as $field => $file) {
            if (!is_array($file)) {
                continue;
            }
            if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                throw new RuntimeException('Upload failed for field ' . $field . ' (error code ' . (int) ($file['error'] ?? 0) . ')', 400);
            }

            $max = (int) ($this->config['max_upload_bytes'] ?? 20971520);
            $size = (int) ($file['size'] ?? 0);
            if ($size <= 0 || $size > $max) {
                throw new RuntimeException('File too large or empty for field: ' . $field, 413);
            }

            $tmp = (string) ($file['tmp_name'] ?? '');
            if ($tmp === '' || !is_uploaded_file($tmp)) {
                throw new RuntimeException('Invalid uploaded file for field: ' . $field, 422);
            }

            $original = (string) ($file['name'] ?? 'upload.bin');
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->file($tmp) ?: 'application/octet-stream';

            $kind = 'other';
            if (str_starts_with($mime, 'image/')) {
                $kind = 'image';
            } elseif (str_starts_with($mime, 'video/')) {
                $kind = 'video';
            }

            $allowed = [
                'image/jpeg', 'image/png', 'image/webp', 'image/gif',
                'video/mp4', 'video/webm', 'video/quicktime',
            ];
            if (!in_array($mime, $allowed, true)) {
                throw new RuntimeException('Unsupported mime type: ' . $mime, 415);
            }

            $ext = pathinfo($original, PATHINFO_EXTENSION);
            $ext = $ext !== '' ? preg_replace('/[^a-zA-Z0-9]/', '', $ext) : ($kind === 'image' ? 'jpg' : 'bin');
            $id = orbit_new_id('media');
            $relativeName = $id . '.' . strtolower((string) $ext);

            $uploadsDir = $this->config['uploads_dir'];
            if (!is_dir($uploadsDir) && !mkdir($uploadsDir, 0755, true) && !is_dir($uploadsDir)) {
                throw new RuntimeException('Uploads directory not writable', 500);
            }

            $diskPath = rtrim($uploadsDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $relativeName;
            if (!move_uploaded_file($tmp, $diskPath)) {
                throw new RuntimeException('Could not store uploaded file for field: ' . $field, 500);
            }

            $publicUrl = rtrim((string) $this->config['public_base_url'], '/')
                . rtrim((string) $this->config['uploads_url_path'], '/')
                . '/' . $relativeName;

            $uploads[$field] = [
                'id' => $id,
                'siteId' => (string) ($_POST['siteId'] ?? $this->config['default_site_id']),
                'diskPath' => $diskPath,
                'publicUrl' => $publicUrl,
                'mime' => $mime,
                'bytes' => $size,
                'originalName' => $original,
                'kind' => $kind,
            ];
        }

        return $uploads;
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
