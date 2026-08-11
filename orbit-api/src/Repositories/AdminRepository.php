<?php

declare(strict_types=1);

namespace OrbitApi\Repositories;

use PDO;
use RuntimeException;
use Throwable;

/**
 * Admin write/upsert operations for Phase 1 CMS tables.
 */
final class AdminRepository
{
    public function __construct(
        private PDO $pdo,
        private ContentRepository $content,
        private string $timezone
    ) {
    }

    public function upsertSite(array $body, string $defaultSiteId): array
    {
        $id = (string) ($body['id'] ?? $defaultSiteId);
        $brand = trim((string) ($body['brand'] ?? ''));
        if ($brand === '') {
            throw new RuntimeException('brand is required', 422);
        }

        $active = $body['activeBatchId'] ?? null;
        $active = ($active === null || $active === '') ? null : (string) $active;

        $image = trim((string) ($body['image'] ?? ''));
        $imageMediaId = $this->nullMedia($body['imageMediaId'] ?? null);

        $exists = $this->content->siteExists($id);
        if ($exists) {
            $stmt = $this->pdo->prepare(
                'UPDATE sites SET brand = :brand, active_batch_id = :active, image = :image, image_media_id = :mid WHERE id = :id'
            );
            $stmt->execute([
                ':brand' => $brand,
                ':active' => $active,
                ':image' => $image,
                ':mid' => $imageMediaId,
                ':id' => $id,
            ]);
        } else {
            $stmt = $this->pdo->prepare(
                'INSERT INTO sites (id, brand, active_batch_id, image, image_media_id) VALUES (:id, :brand, :active, :image, :mid)'
            );
            $stmt->execute([
                ':id' => $id,
                ':brand' => $brand,
                ':active' => $active,
                ':image' => $image,
                ':mid' => $imageMediaId,
            ]);
        }

        $site = $this->content->getSite($id);
        if (!$site) {
            throw new RuntimeException('Failed to save site', 500);
        }
        return $site;
    }

    public function setActiveBatch(string $siteId, ?string $batchId): array
    {
        if (!$this->content->siteExists($siteId)) {
            throw new RuntimeException('Site not found', 404);
        }
        if ($batchId !== null && $batchId !== '') {
            if (!$this->content->getBatch($siteId, $batchId, false)) {
                throw new RuntimeException('Batch not found', 404);
            }
        } else {
            $batchId = null;
        }

        $stmt = $this->pdo->prepare('UPDATE sites SET active_batch_id = :b WHERE id = :id');
        $stmt->execute([':b' => $batchId, ':id' => $siteId]);
        return $this->content->getSite($siteId) ?? [];
    }

    public function upsertContact(string $siteId, array $body): array
    {
        if (!$this->content->siteExists($siteId)) {
            throw new RuntimeException('Site not found', 404);
        }

        $id = (string) ($body['id'] ?? 'contact-main');
        $whatsapp = preg_replace('/\D+/', '', (string) ($body['whatsapp'] ?? '')) ?? '';
        $email = trim((string) ($body['email'] ?? ''));
        $instagram = trim((string) ($body['instagram'] ?? ''));
        $handle = trim((string) ($body['instagramHandle'] ?? ''));
        $line = trim((string) ($body['lineText'] ?? ''));

        if ($whatsapp === '' || $email === '') {
            throw new RuntimeException('whatsapp and email are required', 422);
        }

        $existing = $this->pdo->prepare('SELECT id FROM contacts WHERE site_id = ? LIMIT 1');
        $existing->execute([$siteId]);
        $rowId = $existing->fetchColumn();

        if ($rowId) {
            $id = (string) $rowId;
            $stmt = $this->pdo->prepare(
                'UPDATE contacts SET whatsapp=:w, email=:e, instagram=:i, instagram_handle=:h, line_text=:l
                 WHERE id=:id'
            );
            $stmt->execute([
                ':w' => $whatsapp, ':e' => $email, ':i' => $instagram,
                ':h' => $handle, ':id' => $id, ':l'=> $line
            ]);
        } else {
            $stmt = $this->pdo->prepare(
                'INSERT INTO contacts (id, site_id, whatsapp, email, instagram, instagram_handle, line_text)
                 VALUES (:id, :site, :w, :e, :i, :h, :l)'
            );
            $stmt->execute([
                ':id' => $id, ':site' => $siteId, ':w' => $whatsapp, ':e' => $email,
                ':i' => $instagram, ':h' => $handle, ':l' => $line,
            ]);
        }

        $contact = $this->content->getContact($siteId);
        if (!$contact) {
            throw new RuntimeException('Failed to save contact', 500);
        }
        return $contact;
    }

    public function createBatch(string $siteId, array $body): array
    {
        if (!$this->content->siteExists($siteId)) {
            throw new RuntimeException('Site not found', 404);
        }

        $id = trim((string) ($body['id'] ?? ''));
        if ($id === '') {
            $id = orbit_new_id('batch');
        }
        if ($this->content->getBatch($siteId, $id, false)) {
            throw new RuntimeException('Batch id already exists', 409);
        }

        $this->insertBatchRow($siteId, $id, $body);
        $batch = $this->content->getBatch($siteId, $id, true);
        if (!$batch) {
            throw new RuntimeException('Failed to create batch', 500);
        }
        return $batch;
    }

    public function updateBatch(string $siteId, string $batchId, array $body): array
    {
        if (!$this->content->getBatch($siteId, $batchId, false)) {
            throw new RuntimeException('Batch not found', 404);
        }

        $fields = [];
        $params = [':id' => $batchId, ':site' => $siteId];

        $map = [
            'label' => 'label',
            'launchDisplay' => 'launch_display',
            'soldOut' => 'sold_out',
            'sortOrder' => 'sort_order',
            'heroWindowDays' => 'hero_window_days',
            'countdownEyebrow' => 'countdown_eyebrow',
            'countdownHeading' => 'countdown_heading',
            'countdownLede' => 'countdown_lede',
            'celebrationHeading' => 'celebration_heading',
            'celebrationLede' => 'celebration_lede',
        ];

        foreach ($map as $camel => $col) {
            if (!array_key_exists($camel, $body)) {
                continue;
            }
            $fields[] = "$col = :$col";
            $val = $body[$camel];
            if ($col === 'sold_out') {
                $params[":$col"] = $val ? 1 : 0;
            } elseif (in_array($col, ['sort_order', 'hero_window_days'], true)) {
                $params[":$col"] = (int) $val;
            } else {
                $params[":$col"] = (string) $val;
            }
        }

        if (array_key_exists('launchAt', $body)) {
            $fields[] = 'launch_at = :launch_at';
            $params[':launch_at'] = $this->toMysqlDatetime((string) $body['launchAt']);
        }

        if ($fields === []) {
            throw new RuntimeException('No fields to update', 422);
        }

        $sql = 'UPDATE batches SET ' . implode(', ', $fields) . ' WHERE id = :id AND site_id = :site';
        $this->pdo->prepare($sql)->execute($params);

        return $this->content->getBatch($siteId, $batchId, true) ?? [];
    }

    public function saveBatchTransaction(string $siteId, string $batchId, array $body): array
    {
        $this->pdo->beginTransaction();
        try {
            $result = $this->saveBatchTransactionInternal($siteId, $batchId, $body);
            $this->pdo->commit();
            return $result;
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function saveBatchTransactionMultipart(string $siteId, string $batchId, array $body, array $uploadedMedia): array
    {
        if (!$this->content->siteExists($siteId)) {
            throw new RuntimeException('Site not found', 404);
        }

        $this->pdo->beginTransaction();
        try {
            $mediaMap = [];
            foreach ($uploadedMedia as $field => $fileData) {
                if (!is_array($fileData)) {
                    continue;
                }
                $mediaMap[$field] = $this->content->insertMedia([
                    'id' => $fileData['id'],
                    'site_id' => $siteId,
                    'disk_path' => $fileData['diskPath'],
                    'public_url' => $fileData['publicUrl'],
                    'mime' => $fileData['mime'],
                    'bytes' => $fileData['bytes'],
                    'original_name' => $fileData['originalName'],
                    'kind' => $fileData['kind'],
                ]);
            }

            $body = $this->resolveMultipartPayload($body, $mediaMap);
            $result = $this->saveBatchTransactionInternal($siteId, $batchId, $body);
            $this->pdo->commit();
            return $result;
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    private function saveBatchTransactionInternal(string $siteId, string $batchId, array $body): array
    {
        if (!$this->content->siteExists($siteId)) {
            throw new RuntimeException('Site not found', 404);
        }

        $batchData = $body['batch'] ?? [];
        $batchData['id'] = $batchId;

        $products = is_array($body['products'] ?? null) ? $body['products'] : [];
        $journey = $body['journey'] ?? null;
        $highlights = is_array($body['highlights'] ?? null) ? $body['highlights'] : [];

        if ($this->content->getBatch($siteId, $batchId, false)) {
            $this->updateBatch($siteId, $batchId, $batchData);
        } else {
            $this->createBatch($siteId, $batchData);
        }

        foreach ($products as $product) {
            if (!is_array($product)) {
                continue;
            }
            $product['batchId'] = $batchId;
            $productId = trim((string) ($product['id'] ?? ''));
            if ($productId === '') {
                throw new RuntimeException('Product id is required', 422);
            }

            if ($this->content->getProduct($productId)) {
                $this->updateProduct($siteId, $productId, $product);
            } else {
                $this->createProduct($siteId, $product);
            }
        }

        if (is_array($journey)) {
            $this->putJourney($siteId, $batchId, $journey);
        }

        if ($highlights !== []) {
            $this->putHeroHighlights($siteId, $batchId, ['items' => $highlights]);
        }

        return $this->content->getBatch($siteId, $batchId, true) ?? [];
    }

    private function resolveMultipartPayload(array $body, array $mediaMap): array
    {
        if (isset($body['products']) && is_array($body['products'])) {
            foreach ($body['products'] as &$product) {
                if (!is_array($product) || !isset($product['images']) || !is_array($product['images'])) {
                    continue;
                }
                foreach ($product['images'] as &$image) {
                    if (!is_array($image)) {
                        continue;
                    }
                    $image = $this->resolveFileReference($image, $mediaMap);
                }
                unset($image);
            }
            unset($product);
        }

        if (isset($body['journey']) && is_array($body['journey'])) {
            if (isset($body['journey']['video']) && is_array($body['journey']['video'])) {
                $body['journey']['video'] = $this->resolveUploadReference(
                    $body['journey']['video'],
                    $mediaMap,
                    'posterFileKey',
                    'posterMediaId',
                    'posterImage',
                );
                $body['journey']['video'] = $this->resolveUploadReference(
                    $body['journey']['video'],
                    $mediaMap,
                    'videoFileKey',
                    'videoMediaId',
                    'videoUrl',
                );
            }
            if (isset($body['journey']['images']) && is_array($body['journey']['images'])) {
                foreach ($body['journey']['images'] as &$image) {
                    if (!is_array($image)) {
                        continue;
                    }
                    $image = $this->resolveFileReference($image, $mediaMap);
                }
                unset($image);
            }
        }

        if (isset($body['highlights']) && is_array($body['highlights'])) {
            foreach ($body['highlights'] as &$highlight) {
                if (!is_array($highlight)) {
                    continue;
                }
                $highlight = $this->resolveFileReference($highlight, $mediaMap);
            }
            unset($highlight);
        }

        return $body;
    }

    private function resolveFileReference(array $item, array $mediaMap): array
    {
        if (!empty($item['fileKey']) && is_string($item['fileKey'])) {
            $key = $item['fileKey'];
            if (!isset($mediaMap[$key]) || !is_array($mediaMap[$key])) {
                throw new RuntimeException('Missing uploaded file for ' . $key, 422);
            }
            $item['mediaId'] = $mediaMap[$key]['id'];
            $item['url'] = $mediaMap[$key]['publicUrl'];
            unset($item['fileKey']);
        }
        return $item;
    }

    private function resolveUploadReference(array $item, array $mediaMap, string $fileKeyField, string $mediaIdField, string $urlField): array
    {
        if (!empty($item[$fileKeyField]) && is_string($item[$fileKeyField])) {
            $key = $item[$fileKeyField];
            if (!isset($mediaMap[$key]) || !is_array($mediaMap[$key])) {
                throw new RuntimeException('Missing uploaded file for ' . $key, 422);
            }
            $item[$mediaIdField] = $mediaMap[$key]['id'];
            $item[$urlField] = $mediaMap[$key]['publicUrl'];
            unset($item[$fileKeyField]);
        }
        return $item;
    }

    public function deleteBatch(string $siteId, string $batchId): void
    {
        if (!$this->content->getBatch($siteId, $batchId, false)) {
            throw new RuntimeException('Batch not found', 404);
        }
        $this->pdo->prepare('UPDATE sites SET active_batch_id = NULL WHERE active_batch_id = ? AND id = ?')
            ->execute([$batchId, $siteId]);
        $this->pdo->prepare('DELETE FROM batches WHERE id = ? AND site_id = ?')->execute([$batchId, $siteId]);
    }

    public function createProduct(string $siteId, array $body): array
    {
        $batchId = (string) ($body['batchId'] ?? '');
        if ($batchId === '' || !$this->content->getBatch($siteId, $batchId, false)) {
            throw new RuntimeException('Valid batchId is required', 422);
        }

        $id = trim((string) ($body['id'] ?? ''));
        if ($id === '') {
            $id = orbit_new_id('product');
        }

        $check = $this->pdo->prepare('SELECT id FROM products WHERE id = ?');
        $check->execute([$id]);
        if ($check->fetchColumn()) {
            throw new RuntimeException('Product id already exists', 409);
        }

        $this->insertProductRow($batchId, $id, $body);
        $this->replaceProductColors($id, $body['colors'] ?? []);
        $this->replaceProductImages($id, $body['images'] ?? []);

        $product = $this->content->getProduct($id);
        if (!$product) {
            throw new RuntimeException('Failed to create product', 500);
        }
        return $product;
    }

    public function updateProduct(string $siteId, string $productId, array $body): array
    {
        $product = $this->content->getProduct($productId);
        if (!$product) {
            throw new RuntimeException('Product not found', 404);
        }

        $batchId = (string) ($product['batchId'] ?? '');
        if (!$this->content->getBatch($siteId, $batchId, false)) {
            throw new RuntimeException('Product not in this site', 404);
        }

        if (isset($body['batchId']) && (string) $body['batchId'] !== $batchId) {
            $newBatch = (string) $body['batchId'];
            if (!$this->content->getBatch($siteId, $newBatch, false)) {
                throw new RuntimeException('Target batch not found', 422);
            }
            $batchId = $newBatch;
        }

        $stmt = $this->pdo->prepare(
            'UPDATE products SET
                batch_id = :batch_id,
                name = :name,
                price = :price,
                description = :description,
                summary = :summary,
                dimensions = :dimensions,
                alt = :alt,
                sold_out = :sold_out,
                sort_order = :sort_order
             WHERE id = :id'
        );
        $stmt->execute([
            ':batch_id' => $batchId,
            ':name' => (string) ($body['name'] ?? $product['name']),
            ':price' => (float) ($body['price'] ?? $product['price']),
            ':description' => (string) ($body['description'] ?? $product['description']),
            ':summary' => (string) ($body['summary'] ?? $product['summary']),
            ':dimensions' => (string) ($body['dimensions'] ?? $product['dimensions']),
            ':alt' => (string) ($body['alt'] ?? $product['alt']),
            ':sold_out' => array_key_exists('soldOut', $body)
                ? ($body['soldOut'] ? 1 : 0)
                : ($product['soldOut'] ? 1 : 0),
            ':sort_order' => (int) ($body['sortOrder'] ?? $product['sortOrder']),
            ':id' => $productId,
        ]);

        if (array_key_exists('colors', $body)) {
            $this->replaceProductColors($productId, $body['colors'] ?? []);
        }
        if (array_key_exists('images', $body)) {
            $this->replaceProductImages($productId, $body['images'] ?? []);
        }

        return $this->content->getProduct($productId) ?? [];
    }

    public function deleteProduct(string $siteId, string $productId): void
    {
        $product = $this->content->getProduct($productId);
        if (!$product) {
            throw new RuntimeException('Product not found', 404);
        }
        $batchId = (string) ($product['batchId'] ?? '');
        if (!$this->content->getBatch($siteId, $batchId, false)) {
            throw new RuntimeException('Product not in this site', 404);
        }
        $this->pdo->prepare('DELETE FROM products WHERE id = ?')->execute([$productId]);
    }

    /** Replace journey video + stills for a batch. */
    public function putJourney(string $siteId, string $batchId, array $body): array
    {
        if (!$this->content->getBatch($siteId, $batchId, false)) {
            throw new RuntimeException('Batch not found', 404);
        }

        $video = $body['video'] ?? null;
        if (is_array($video)) {
            $vidId = (string) ($video['id'] ?? orbit_new_id('jv'));
            $title = (string) ($video['title'] ?? '');
            $lede = (string) ($video['lede'] ?? '');
            $poster = (string) ($video['posterImage'] ?? '');
            $videoUrl = (string) ($video['videoUrl'] ?? '');
            $posterMedia = isset($video['posterMediaId']) ? (string) $video['posterMediaId'] : null;
            $videoMedia = isset($video['videoMediaId']) ? (string) $video['videoMediaId'] : null;
            if ($posterMedia === '') {
                $posterMedia = null;
            }
            if ($videoMedia === '') {
                $videoMedia = null;
            }

            $existing = $this->pdo->prepare('SELECT id FROM journey_videos WHERE batch_id = ?');
            $existing->execute([$batchId]);
            $exId = $existing->fetchColumn();

            if ($exId) {
                $this->pdo->prepare(
                    'UPDATE journey_videos SET title=:t, lede=:l, poster_media_id=:pm, video_media_id=:vm,
                     poster_image=:pi, video_url=:vu WHERE batch_id=:b'
                )->execute([
                    ':t' => $title, ':l' => $lede, ':pm' => $posterMedia, ':vm' => $videoMedia,
                    ':pi' => $poster, ':vu' => $videoUrl, ':b' => $batchId,
                ]);
            } else {
                $this->pdo->prepare(
                    'INSERT INTO journey_videos
                     (id, batch_id, title, lede, poster_media_id, video_media_id, poster_image, video_url)
                     VALUES (:id,:b,:t,:l,:pm,:vm,:pi,:vu)'
                )->execute([
                    ':id' => $vidId, ':b' => $batchId, ':t' => $title, ':l' => $lede,
                    ':pm' => $posterMedia, ':vm' => $videoMedia, ':pi' => $poster, ':vu' => $videoUrl,
                ]);
            }
        }

        if (array_key_exists('images', $body) && is_array($body['images'])) {
            $this->pdo->prepare('DELETE FROM journey_images WHERE batch_id = ?')->execute([$batchId]);
            $ins = $this->pdo->prepare(
                'INSERT INTO journey_images (id, batch_id, media_id, url, alt, sort_order)
                 VALUES (?,?,?,?,?,?)'
            );
            $order = 0;
            foreach ($body['images'] as $img) {
                if (!is_array($img)) {
                    continue;
                }
                $mediaId = (string) ($img['mediaId'] ?? '');
                $url = (string) ($img['url'] ?? '');
                if ($mediaId === '' || $url === '') {
                    throw new RuntimeException('journey images require mediaId and url', 422);
                }
                $order++;
                $ins->execute([
                    (string) ($img['id'] ?? orbit_new_id('ji')),
                    $batchId,
                    $mediaId,
                    $url,
                    (string) ($img['alt'] ?? ''),
                    (int) ($img['sortOrder'] ?? $order),
                ]);
            }
        }

        return $this->content->getJourneyForBatch($batchId);
    }

    public function putHeroHighlights(string $siteId, string $batchId, array $body): array
    {
        if (!$this->content->getBatch($siteId, $batchId, false)) {
            throw new RuntimeException('Batch not found', 404);
        }

        $items = $body['items'] ?? $body;
        if (!is_array($items)) {
            throw new RuntimeException('items array required', 422);
        }

        $this->pdo->prepare('DELETE FROM hero_highlight_images WHERE batch_id = ?')->execute([$batchId]);
        $ins = $this->pdo->prepare(
            'INSERT INTO hero_highlight_images (id, batch_id, media_id, url, alt, sort_order)
             VALUES (?,?,?,?,?,?)'
        );
        $order = 0;
        foreach ($items as $img) {
            if (!is_array($img)) {
                continue;
            }
            $mediaId = (string) ($img['mediaId'] ?? '');
            $url = (string) ($img['url'] ?? '');
            if ($mediaId === '' || $url === '') {
                throw new RuntimeException('highlight images require mediaId and url', 422);
            }
            $order++;
            $ins->execute([
                (string) ($img['id'] ?? orbit_new_id('hh')),
                $batchId,
                $mediaId,
                $url,
                (string) ($img['alt'] ?? ''),
                (int) ($img['sortOrder'] ?? $order),
            ]);
        }

        return ['items' => $this->content->listHeroHighlights($batchId)];
    }


    public function putPageAbout(string $siteId, array $body): array
    {
        $this->assertSite($siteId);
        $this->pdo->prepare(
            'INSERT INTO page_about
             (site_id, eyebrow, heading, image, image_media_id, image_alt)
             VALUES (:site,:eyebrow,:heading,:image,:mid,:alt)
             ON DUPLICATE KEY UPDATE
               eyebrow=VALUES(eyebrow), heading=VALUES(heading), image=VALUES(image),
               image_media_id=VALUES(image_media_id), image_alt=VALUES(image_alt)'
        )->execute([
            ':site' => $siteId,
            ':eyebrow' => (string) ($body['eyebrow'] ?? ''),
            ':heading' => (string) ($body['heading'] ?? ''),
            ':image' => (string) ($body['image'] ?? ''),
            ':mid' => $this->nullMedia($body['imageMediaId'] ?? null),
            ':alt' => (string) ($body['imageAlt'] ?? ''),
        ]);

        $this->pdo->prepare(
            'INSERT INTO page_reviews
             (site_id, eyebrow, heading)
             VALUES (:site,:re,:rh)
             ON DUPLICATE KEY UPDATE
               eyebrow=VALUES(eyebrow), heading=VALUES(heading)'
        )->execute([
            ':site' => $siteId,
            ':re' => (string) ($body['reviewsEyebrow'] ?? ''),
            ':rh' => (string) ($body['reviewsHeading'] ?? ''),
        ]);

        if (array_key_exists('paragraphs', $body) && is_array($body['paragraphs'])) {
            $this->pdo->prepare('DELETE FROM about_paragraphs WHERE site_id = ?')->execute([$siteId]);
            $ins = $this->pdo->prepare(
                'INSERT INTO about_paragraphs (site_id, body, sort_order) VALUES (?,?,?)'
            );
            $order = 0;
            foreach ($body['paragraphs'] as $p) {
                $text = trim((string) $p);
                if ($text === '') {
                    continue;
                }
                $order++;
                $ins->execute([$siteId, $text, $order]);
            }
        }

        return $this->content->getPageAbout($siteId) ?? [];
    }

    public function putPageCollections(string $siteId, array $body): array
    {
        $this->assertSite($siteId);
        $this->pdo->prepare(
            'INSERT INTO page_collections
             (site_id, eyebrow, heading, lede, out_of_stock_label, custom_note, custom_cta_label,
              view_by_batch_label, view_all_label, empty_title, empty_lede, empty_cta_label)
             VALUES (:site,:eyebrow,:heading,:lede,:oos,:note,:cta,:vbb,:vall,:et,:el,:ec)
             ON DUPLICATE KEY UPDATE
               eyebrow=VALUES(eyebrow), heading=VALUES(heading), lede=VALUES(lede),
               out_of_stock_label=VALUES(out_of_stock_label), custom_note=VALUES(custom_note),
               custom_cta_label=VALUES(custom_cta_label), view_by_batch_label=VALUES(view_by_batch_label),
               view_all_label=VALUES(view_all_label), empty_title=VALUES(empty_title),
               empty_lede=VALUES(empty_lede), empty_cta_label=VALUES(empty_cta_label)'
        )->execute([
            ':site' => $siteId,
            ':eyebrow' => (string) ($body['eyebrow'] ?? ''),
            ':heading' => (string) ($body['heading'] ?? ''),
            ':lede' => (string) ($body['lede'] ?? ''),
            ':oos' => (string) ($body['outOfStockLabel'] ?? ''),
            ':note' => (string) ($body['customNote'] ?? ''),
            ':cta' => (string) ($body['customCtaLabel'] ?? ''),
            ':vbb' => (string) ($body['viewByBatchLabel'] ?? ''),
            ':vall' => (string) ($body['viewAllLabel'] ?? ''),
            ':et' => (string) ($body['emptyTitle'] ?? ''),
            ':el' => (string) ($body['emptyLede'] ?? ''),
            ':ec' => (string) ($body['emptyCtaLabel'] ?? ''),
        ]);
        return $this->content->getPageCollections($siteId) ?? [];
    }

    public function putPageJourney(string $siteId, array $body): array
    {
        $this->assertSite($siteId);
        $this->pdo->prepare(
            'INSERT INTO page_journey
             (site_id, eyebrow, heading, lede, open_label, back_label, empty_title, empty_lede, empty_cta_label)
             VALUES (:site,:eyebrow,:heading,:lede,:open,:back,:et,:el,:ec)
             ON DUPLICATE KEY UPDATE
               eyebrow=VALUES(eyebrow), heading=VALUES(heading), lede=VALUES(lede),
               open_label=VALUES(open_label), back_label=VALUES(back_label),
               empty_title=VALUES(empty_title), empty_lede=VALUES(empty_lede),
               empty_cta_label=VALUES(empty_cta_label)'
        )->execute([
            ':site' => $siteId,
            ':eyebrow' => (string) ($body['eyebrow'] ?? ''),
            ':heading' => (string) ($body['heading'] ?? ''),
            ':lede' => (string) ($body['lede'] ?? ''),
            ':open' => (string) ($body['openLabel'] ?? ''),
            ':back' => (string) ($body['backLabel'] ?? ''),
            ':et' => (string) ($body['emptyTitle'] ?? ''),
            ':el' => (string) ($body['emptyLede'] ?? ''),
            ':ec' => (string) ($body['emptyCtaLabel'] ?? ''),
        ]);
        return $this->content->getPageJourney($siteId) ?? [];
    }

    public function putPageBatchShop(string $siteId, array $body): array
    {
        $this->assertSite($siteId);
        $this->pdo->prepare(
            'INSERT INTO page_batch_shop
             (site_id, eyebrow, heading, lede, buy_label, currency, currency_symbol)
             VALUES (:site,:eyebrow,:heading,:lede,:buy,:cur,:sym)
             ON DUPLICATE KEY UPDATE
               eyebrow=VALUES(eyebrow), heading=VALUES(heading), lede=VALUES(lede),
               buy_label=VALUES(buy_label), currency=VALUES(currency),
               currency_symbol=VALUES(currency_symbol)'
        )->execute([
            ':site' => $siteId,
            ':eyebrow' => (string) ($body['eyebrow'] ?? ''),
            ':heading' => (string) ($body['heading'] ?? ''),
            ':lede' => (string) ($body['lede'] ?? ''),
            ':buy' => (string) ($body['buyLabel'] ?? ''),
            ':cur' => (string) ($body['currency'] ?? 'PKR'),
            ':sym' => (string) ($body['currencySymbol'] ?? 'Rs'),
        ]);
        return $this->content->getPageBatchShop($siteId) ?? [];
    }

    /** @return list<array<string,mixed>> */
    public function listReviews(string $siteId, bool $publishedOnly = false): array
    {
        $sql = 'SELECT * FROM about_reviews WHERE site_id = ?';
        if ($publishedOnly) {
            $sql .= ' AND is_published = 1';
        }
        $sql .= ' ORDER BY sort_order ASC, id ASC';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$siteId]);
        $out = [];
        foreach ($stmt->fetchAll() as $rev) {
            $out[] = $this->mapReview($rev);
        }
        return $out;
    }

    public function createReview(string $siteId, array $body): array
    {
        $this->ensureAboutRow($siteId);
        $id = trim((string) ($body['id'] ?? ''));
        if ($id === '') {
            $id = orbit_new_id('review');
        }
        $rating = (int) ($body['rating'] ?? 0);
        if ($rating < 1 || $rating > 5) {
            throw new RuntimeException('rating must be 1–5', 422);
        }
        $gender = (string) ($body['gender'] ?? 'woman');
        if (!in_array($gender, ['woman', 'man'], true)) {
            throw new RuntimeException('gender must be woman or man', 422);
        }

        $this->pdo->prepare(
            'INSERT INTO about_reviews
             (id, site_id, quote, name, detail, rating, image, image_media_id, image_alt, gender, is_published, sort_order)
             VALUES (:id,:site,:quote,:name,:detail,:rating,:image,:mid,:alt,:gender,:pub,:sort)'
        )->execute([
            ':id' => $id,
            ':site' => $siteId,
            ':quote' => (string) ($body['quote'] ?? ''),
            ':name' => (string) ($body['name'] ?? ''),
            ':detail' => (string) ($body['detail'] ?? ''),
            ':rating' => $rating,
            ':image' => $this->emptyToNull($body['image'] ?? null),
            ':mid' => $this->nullMedia($body['imageMediaId'] ?? null),
            ':alt' => $this->emptyToNull($body['imageAlt'] ?? null),
            ':gender' => $gender,
            ':pub' => array_key_exists('isPublished', $body) ? ($body['isPublished'] ? 1 : 0) : 1,
            ':sort' => (int) ($body['sortOrder'] ?? 0),
        ]);

        return $this->getReview($siteId, $id);
    }

    public function updateReview(string $siteId, string $reviewId, array $body): array
    {
        $current = $this->getReview($siteId, $reviewId);
        $rating = (int) ($body['rating'] ?? $current['rating']);
        if ($rating < 1 || $rating > 5) {
            throw new RuntimeException('rating must be 1–5', 422);
        }
        $gender = (string) ($body['gender'] ?? $current['gender']);
        if (!in_array($gender, ['woman', 'man'], true)) {
            throw new RuntimeException('gender must be woman or man', 422);
        }

        $this->pdo->prepare(
            'UPDATE about_reviews SET
                quote=:quote, name=:name, detail=:detail, rating=:rating,
                image=:image, image_media_id=:mid, image_alt=:alt,
                gender=:gender, is_published=:pub, sort_order=:sort
             WHERE id=:id AND site_id=:site'
        )->execute([
            ':quote' => (string) ($body['quote'] ?? $current['quote']),
            ':name' => (string) ($body['name'] ?? $current['name']),
            ':detail' => (string) ($body['detail'] ?? $current['detail']),
            ':rating' => $rating,
            ':image' => $this->emptyToNull($body['image'] ?? ($current['image'] ?? null)),
            ':mid' => $this->nullMedia($body['imageMediaId'] ?? ($current['imageMediaId'] ?? null)),
            ':alt' => $this->emptyToNull($body['imageAlt'] ?? ($current['imageAlt'] ?? null)),
            ':gender' => $gender,
            ':pub' => array_key_exists('isPublished', $body)
                ? ($body['isPublished'] ? 1 : 0)
                : (int) ($current['isPublished'] ?? 1),
            ':sort' => (int) ($body['sortOrder'] ?? $current['sortOrder'] ?? 0),
            ':id' => $reviewId,
            ':site' => $siteId,
        ]);

        return $this->getReview($siteId, $reviewId);
    }

    public function deleteReview(string $siteId, string $reviewId): void
    {
        $this->getReview($siteId, $reviewId);
        $this->pdo->prepare('DELETE FROM about_reviews WHERE id = ? AND site_id = ?')
            ->execute([$reviewId, $siteId]);
    }

    /** @return list<array<string,mixed>> */
    public function listLeads(string $siteId, ?string $status = null): array
    {
        $sql = 'SELECT * FROM leads WHERE site_id = ?';
        $params = [$siteId];
        if ($status !== null && $status !== '') {
            $sql .= ' AND status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY created_at DESC LIMIT 200';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $out[] = [
                'id' => (int) $row['id'],
                'siteId' => $row['site_id'],
                'type' => $row['type'],
                'status' => $row['status'],
                'batchId' => $row['batch_id'],
                'productId' => $row['product_id'],
                'customerName' => $row['customer_name'],
                'phone' => $row['phone'],
                'email' => $row['email'],
                'message' => $row['message'],
                'sourcePath' => $row['source_path'],
                'createdAt' => orbit_iso_datetime($row['created_at'], $this->timezone),
            ];
        }
        return $out;
    }

    public function mediaExists(string $mediaId): bool
    {
        $stmt = $this->pdo->prepare('SELECT 1 FROM media WHERE id = ? LIMIT 1');
        $stmt->execute([$mediaId]);
        return (bool) $stmt->fetchColumn();
    }

    private function getReview(string $siteId, string $reviewId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM about_reviews WHERE id = ? AND site_id = ? LIMIT 1');
        $stmt->execute([$reviewId, $siteId]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Review not found', 404);
        }
        return $this->mapReview($row);
    }

    private function mapReview(array $rev): array
    {
        $item = [
            'id' => $rev['id'],
            'quote' => $rev['quote'],
            'name' => $rev['name'],
            'detail' => $rev['detail'],
            'rating' => (int) $rev['rating'],
            'gender' => $rev['gender'],
            'isPublished' => orbit_bool($rev['is_published']),
            'sortOrder' => (int) $rev['sort_order'],
        ];
        if ($rev['image']) {
            $item['image'] = $rev['image'];
        }
        if ($rev['image_alt']) {
            $item['imageAlt'] = $rev['image_alt'];
        }
        if ($rev['image_media_id']) {
            $item['imageMediaId'] = $rev['image_media_id'];
        }
        return $item;
    }

    private function insertBatchRow(string $siteId, string $id, array $body): void
    {
        $label = trim((string) ($body['label'] ?? ''));
        $launchAt = (string) ($body['launchAt'] ?? '');
        if ($label === '' || $launchAt === '') {
            throw new RuntimeException('label and launchAt are required', 422);
        }

        $this->pdo->prepare(
            'INSERT INTO batches (
                id, site_id, label, launch_at, launch_display, sold_out, sort_order, hero_window_days,
                countdown_eyebrow, countdown_heading, countdown_lede,
                celebration_heading, celebration_lede
             ) VALUES (
                :id,:site,:label,:launch_at,:launch_display,:sold_out,:sort_order,:hero_window_days,
                :countdown_eyebrow,:countdown_heading,:countdown_lede,
                :celebration_heading,:celebration_lede
             )'
        )->execute([
            ':id' => $id,
            ':site' => $siteId,
            ':label' => $label,
            ':launch_at' => $this->toMysqlDatetime($launchAt),
            ':launch_display' => (string) ($body['launchDisplay'] ?? $label),
            ':sold_out' => !empty($body['soldOut']) ? 1 : 0,
            ':sort_order' => (int) ($body['sortOrder'] ?? 0),
            ':hero_window_days' => (int) ($body['heroWindowDays'] ?? 10),
            ':countdown_eyebrow' => (string) ($body['countdownEyebrow'] ?? ''),
            ':countdown_heading' => (string) ($body['countdownHeading'] ?? ''),
            ':countdown_lede' => (string) ($body['countdownLede'] ?? ''),
            ':celebration_heading' => (string) ($body['celebrationHeading'] ?? ''),
            ':celebration_lede' => (string) ($body['celebrationLede'] ?? ''),
        ]);
    }

    private function insertProductRow(string $batchId, string $id, array $body): void
    {
        $name = trim((string) ($body['name'] ?? ''));
        if ($name === '') {
            throw new RuntimeException('name is required', 422);
        }
        if (!isset($body['price'])) {
            throw new RuntimeException('price is required', 422);
        }

        $this->pdo->prepare(
            'INSERT INTO products
             (id, batch_id, name, price, description, summary, dimensions, alt, sold_out, sort_order)
             VALUES (?,?,?,?,?,?,?,?,?,?)'
        )->execute([
            $id,
            $batchId,
            $name,
            (float) $body['price'],
            (string) ($body['description'] ?? ''),
            (string) ($body['summary'] ?? ''),
            (string) ($body['dimensions'] ?? ''),
            (string) ($body['alt'] ?? ''),
            !empty($body['soldOut']) ? 1 : 0,
            (int) ($body['sortOrder'] ?? 0),
        ]);
    }

    private function replaceProductColors(string $productId, mixed $colors): void
    {
        $this->pdo->prepare('DELETE FROM product_colors WHERE product_id = ?')->execute([$productId]);
        if (!is_array($colors)) {
            return;
        }
        $ins = $this->pdo->prepare(
            'INSERT INTO product_colors (product_id, name, hex, sort_order) VALUES (?,?,?,?)'
        );
        $order = 0;
        foreach ($colors as $c) {
            if (!is_array($c)) {
                continue;
            }
            $order++;
            $ins->execute([
                $productId,
                (string) ($c['name'] ?? ''),
                (string) ($c['hex'] ?? '#000000'),
                (int) ($c['sortOrder'] ?? $order),
            ]);
        }
    }

    private function replaceProductImages(string $productId, mixed $images): void
    {
        $this->pdo->prepare('DELETE FROM product_images WHERE product_id = ?')->execute([$productId]);
        if (!is_array($images)) {
            return;
        }
        $ins = $this->pdo->prepare(
            'INSERT INTO product_images (product_id, media_id, url, sort_order) VALUES (?,?,?,?)'
        );
        $order = 0;
        foreach ($images as $img) {
            if (!is_array($img)) {
                continue;
            }
            $mediaId = (string) ($img['mediaId'] ?? '');
            $url = (string) ($img['url'] ?? '');
            if ($mediaId === '' || $url === '') {
                throw new RuntimeException('Each product image needs mediaId and url (upload via POST /admin/media first)', 422);
            }
            if (!$this->mediaExists($mediaId)) {
                throw new RuntimeException("Unknown mediaId: $mediaId", 422);
            }
            $order++;
            $ins->execute([
                $productId,
                $mediaId,
                $url,
                (int) ($img['sortOrder'] ?? $order),
            ]);
        }
    }

    private function ensureAboutRow(string $siteId): void
    {
        $this->assertSite($siteId);
        $stmt = $this->pdo->prepare('SELECT site_id FROM page_about WHERE site_id = ?');
        $stmt->execute([$siteId]);
        if ($stmt->fetchColumn()) {
            return;
        }
        $this->pdo->prepare(
            'INSERT INTO page_about
             (site_id, eyebrow, heading, image, image_alt)
             VALUES (?,?,?,?,?)'
        )->execute([$siteId, 'About', 'About', '', '']);
        $this->pdo->prepare(
            'INSERT INTO page_reviews
             (site_id, eyebrow, heading)
             VALUES (?,?,?)'
        )->execute([$siteId, 'Reviews', 'Reviews']);
    }

    private function assertSite(string $siteId): void
    {
        if (!$this->content->siteExists($siteId)) {
            throw new RuntimeException('Site not found', 404);
        }
    }

    private function toMysqlDatetime(string $iso): string
    {
        try {
            $dt = new \DateTimeImmutable($iso);
            return $dt->setTimezone(new \DateTimeZone($this->timezone))->format('Y-m-d H:i:s.v');
        } catch (\Throwable) {
            throw new RuntimeException('Invalid launchAt datetime', 422);
        }
    }

    private function nullMedia(mixed $id): ?string
    {
        if ($id === null || $id === '') {
            return null;
        }
        return (string) $id;
    }

    private function emptyToNull(mixed $v): ?string
    {
        if ($v === null) {
            return null;
        }
        $s = trim((string) $v);
        return $s === '' ? null : $s;
    }
}
