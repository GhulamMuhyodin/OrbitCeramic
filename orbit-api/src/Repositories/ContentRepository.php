<?php

declare(strict_types=1);

namespace OrbitApi\Repositories;

use PDO;

final class ContentRepository
{
    public function __construct(
        private PDO $pdo,
        private string $timezone
    ) {
    }

    public function siteExists(string $siteId): bool
    {
        $stmt = $this->pdo->prepare('SELECT 1 FROM sites WHERE id = ? LIMIT 1');
        $stmt->execute([$siteId]);
        return (bool) $stmt->fetchColumn();
    }

    public function getSite(string $siteId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT id, brand, active_batch_id FROM sites WHERE id = ? LIMIT 1');
        $stmt->execute([$siteId]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }

        return [
            'id' => $row['id'],
            'brand' => $row['brand'],
            'activeBatchId' => $row['active_batch_id'],
        ];
    }

    public function getContact(string $siteId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, site_id, whatsapp, email, instagram, instagram_handle, website
             FROM contacts WHERE site_id = ? LIMIT 1'
        );
        $stmt->execute([$siteId]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }

        $linesStmt = $this->pdo->prepare(
            'SELECT line_text FROM contact_visit_lines WHERE contact_id = ? ORDER BY sort_order ASC, id ASC'
        );
        $linesStmt->execute([$row['id']]);
        $visitLines = array_map(
            static fn (array $r): string => $r['line_text'],
            $linesStmt->fetchAll()
        );

        $out = [
            'id' => $row['id'],
            'siteId' => $row['site_id'],
            'whatsapp' => $row['whatsapp'],
            'email' => $row['email'],
            'instagram' => $row['instagram'],
            'instagramHandle' => $row['instagram_handle'],
            'visitLines' => $visitLines,
        ];
        if ($row['website'] !== null && $row['website'] !== '') {
            $out['website'] = $row['website'];
        }
        return $out;
    }

    public function getPageHero(string $siteId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM page_hero WHERE site_id = ? LIMIT 1');
        $stmt->execute([$siteId]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }

        return [
            'image' => $row['image'],
            'brand' => $row['brand'],
            'brandPrimary' => $row['brand_primary'],
            'brandSecondary' => $row['brand_secondary'],
            'title' => $row['title'],
            'lede' => $row['lede'],
            'ctaLabel' => $row['cta_label'],
            'ctaHref' => $row['cta_href'],
        ];
    }

    public function getPageAbout(string $siteId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM page_about WHERE site_id = ? LIMIT 1');
        $stmt->execute([$siteId]);
        $row = $stmt->fetch();
        $hasAbout = (bool) $row;
        if (!$hasAbout) {
            $row = [
                'eyebrow' => '',
                'heading' => '',
                'image' => '',
                'image_alt' => '',
                'reviews_eyebrow' => '',
                'reviews_heading' => '',
                'image_media_id' => null,
            ];
        }

        $pStmt = $this->pdo->prepare(
            'SELECT body FROM about_paragraphs WHERE site_id = ? ORDER BY sort_order ASC, id ASC'
        );
        $pStmt->execute([$siteId]);
        $paragraphs = array_map(static fn (array $r): string => $r['body'], $pStmt->fetchAll());

        $rStmt = $this->pdo->prepare(
            'SELECT id, quote, name, detail, rating, image, image_alt, gender
             FROM about_reviews
             WHERE site_id = ? AND is_published = 1
             ORDER BY sort_order ASC, id ASC'
        );
        $rStmt->execute([$siteId]);
        $reviews = [];
        foreach ($rStmt->fetchAll() as $rev) {
            $item = [
                'id' => $rev['id'],
                'quote' => $rev['quote'],
                'name' => $rev['name'],
                'detail' => $rev['detail'],
                'rating' => (int) $rev['rating'],
                'gender' => $rev['gender'],
            ];
            if ($rev['image'] !== null && $rev['image'] !== '') {
                $item['image'] = $rev['image'];
            }
            if ($rev['image_alt'] !== null && $rev['image_alt'] !== '') {
                $item['imageAlt'] = $rev['image_alt'];
            }
            $reviews[] = $item;
        }

        if (!$hasAbout && count($paragraphs) === 0 && count($reviews) === 0) {
            return null;
        }

        $output = [
            'eyebrow' => $row['eyebrow'],
            'heading' => $row['heading'],
            'paragraphs' => $paragraphs,
            'image' => $row['image'],
            'imageAlt' => $row['image_alt'],
            'reviewsEyebrow' => $row['reviews_eyebrow'],
            'reviewsHeading' => $row['reviews_heading'],
            'reviews' => $reviews,
        ];
        if ($row['image_media_id']) {
            $output['imageMediaId'] = $row['image_media_id'];
        }
        return $output;
    }

    public function getPageCollections(string $siteId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM page_collections WHERE site_id = ? LIMIT 1');
        $stmt->execute([$siteId]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }

        return [
            'eyebrow' => $row['eyebrow'],
            'heading' => $row['heading'],
            'lede' => $row['lede'],
            'outOfStockLabel' => $row['out_of_stock_label'],
            'customNote' => $row['custom_note'],
            'customCtaLabel' => $row['custom_cta_label'],
            'viewByBatchLabel' => $row['view_by_batch_label'],
            'viewAllLabel' => $row['view_all_label'],
            'emptyTitle' => $row['empty_title'],
            'emptyLede' => $row['empty_lede'],
            'emptyCtaLabel' => $row['empty_cta_label'],
        ];
    }

    public function getPageJourney(string $siteId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM page_journey WHERE site_id = ? LIMIT 1');
        $stmt->execute([$siteId]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }

        return [
            'eyebrow' => $row['eyebrow'],
            'heading' => $row['heading'],
            'lede' => $row['lede'],
            'openLabel' => $row['open_label'],
            'backLabel' => $row['back_label'],
            'emptyTitle' => $row['empty_title'],
            'emptyLede' => $row['empty_lede'],
            'emptyCtaLabel' => $row['empty_cta_label'],
        ];
    }

    public function getPageBatchShop(string $siteId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM page_batch_shop WHERE site_id = ? LIMIT 1');
        $stmt->execute([$siteId]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }

        return [
            'eyebrow' => $row['eyebrow'],
            'heading' => $row['heading'],
            'lede' => $row['lede'],
            'buyLabel' => $row['buy_label'],
            'currency' => $row['currency'],
            'currencySymbol' => $row['currency_symbol'],
        ];
    }

    /** @return list<array<string,mixed>> */
    public function listBatches(string $siteId, bool $withProducts = true): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM batches WHERE site_id = ? ORDER BY sort_order ASC, launch_at ASC'
        );
        $stmt->execute([$siteId]);
        $rows = $stmt->fetchAll();

        $batches = [];
        foreach ($rows as $row) {
            $batch = $this->mapBatchRow($row);
            if ($withProducts) {
                $batch['products'] = $this->listProductsForBatch($row['id']);
            }
            $batches[] = $batch;
        }
        return $batches;
    }

    public function getBatch(string $siteId, string $batchId, bool $withProducts = true): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM batches WHERE site_id = ? AND id = ? LIMIT 1'
        );
        $stmt->execute([$siteId, $batchId]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }

        $batch = $this->mapBatchRow($row);
        if ($withProducts) {
            $batch['products'] = $this->listProductsForBatch($batchId);
        }
        return $batch;
    }

    public function getActiveBatch(string $siteId): ?array
    {
        $site = $this->getSite($siteId);
        if (!$site || empty($site['activeBatchId'])) {
            return null;
        }
        return $this->getBatch($siteId, $site['activeBatchId'], true);
    }

    /** @return list<array<string,mixed>> */
    public function listProductsForBatch(string $batchId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM products WHERE batch_id = ? ORDER BY sort_order ASC, id ASC'
        );
        $stmt->execute([$batchId]);
        $products = [];
        foreach ($stmt->fetchAll() as $row) {
            $products[] = $this->mapProductRow($row);
        }
        return $products;
    }

    public function getProduct(string $productId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM products WHERE id = ? LIMIT 1');
        $stmt->execute([$productId]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }
        $product = $this->mapProductRow($row);
        $product['batchId'] = $row['batch_id'];
        return $product;
    }

    /** @return list<array<string,mixed>> */
    public function listProducts(
        string $siteId,
        ?string $batchId = null,
        ?bool $availableOnly = null,
        int $page = 1,
        int $limit = 50
    ): array {
        $page = max(1, $page);
        $limit = max(1, min(100, $limit));
        $offset = ($page - 1) * $limit;

        $sql = 'SELECT p.* FROM products p
                INNER JOIN batches b ON b.id = p.batch_id
                WHERE b.site_id = ?';
        $params = [$siteId];

        if ($batchId !== null && $batchId !== '') {
            $sql .= ' AND p.batch_id = ?';
            $params[] = $batchId;
        }
        if ($availableOnly === true) {
            $sql .= ' AND p.sold_out = 0 AND b.sold_out = 0';
        }

        $sql .= ' ORDER BY b.sort_order ASC, p.sort_order ASC, p.id ASC LIMIT ' . (int) $limit . ' OFFSET ' . (int) $offset;

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $product = $this->mapProductRow($row);
            $product['batchId'] = $row['batch_id'];
            $out[] = $product;
        }
        return $out;
    }

    public function getJourneyForBatch(string $batchId): array
    {
        return [
            'video' => $this->getJourneyVideo($batchId),
            'images' => $this->listJourneyImages($batchId),
        ];
    }

    public function getJourneyVideo(string $batchId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM journey_videos WHERE batch_id = ? LIMIT 1');
        $stmt->execute([$batchId]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }

        $out = [
            'id' => $row['id'],
            'batchId' => $row['batch_id'],
            'title' => $row['title'],
            'lede' => $row['lede'],
            'posterImage' => $row['poster_image'],
            'videoUrl' => $row['video_url'],
        ];
        if ($row['poster_media_id']) {
            $out['posterMediaId'] = $row['poster_media_id'];
        }
        if ($row['video_media_id']) {
            $out['videoMediaId'] = $row['video_media_id'];
        }
        return $out;
    }

    /** @return list<array<string,mixed>> */
    public function listJourneyImages(string $batchId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM journey_images WHERE batch_id = ? ORDER BY sort_order ASC, id ASC'
        );
        $stmt->execute([$batchId]);
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $item = [
                'id' => $row['id'],
                'batchId' => $row['batch_id'],
                'url' => $row['url'],
                'alt' => $row['alt'],
                'sortOrder' => (int) $row['sort_order'],
            ];
            if ($row['media_id']) {
                $item['mediaId'] = $row['media_id'];
            }
            $out[] = $item;
        }
        return $out;
    }

    /** @return list<array<string,mixed>> */
    public function listHeroHighlights(string $batchId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM hero_highlight_images WHERE batch_id = ? ORDER BY sort_order ASC, id ASC'
        );
        $stmt->execute([$batchId]);
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $item = [
                'id' => $row['id'],
                'batchId' => $row['batch_id'],
                'url' => $row['url'],
                'alt' => $row['alt'],
                'sortOrder' => (int) $row['sort_order'],
            ];
            if ($row['media_id']) {
                $item['mediaId'] = $row['media_id'];
            }
            $out[] = $item;
        }
        return $out;
    }

    /** @return list<array<string,mixed>> */
    public function listAllJourneyVideos(string $siteId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT jv.* FROM journey_videos jv
             INNER JOIN batches b ON b.id = jv.batch_id
             WHERE b.site_id = ?
             ORDER BY b.sort_order ASC'
        );
        $stmt->execute([$siteId]);
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $item = $this->getJourneyVideo($row['batch_id']);
            if ($item) {
                $out[] = $item;
            }
        }
        return $out;
    }

    /** @return list<array<string,mixed>> */
    public function listAllJourneyImages(string $siteId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT ji.* FROM journey_images ji
             INNER JOIN batches b ON b.id = ji.batch_id
             WHERE b.site_id = ?
             ORDER BY b.sort_order ASC, ji.sort_order ASC'
        );
        $stmt->execute([$siteId]);
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $item = [
                'id' => $row['id'],
                'batchId' => $row['batch_id'],
                'url' => $row['url'],
                'alt' => $row['alt'],
                'sortOrder' => (int) $row['sort_order'],
            ];
            if ($row['media_id']) {
                $item['mediaId'] = $row['media_id'];
            }
            $out[] = $item;
        }
        return $out;
    }

    /** @return list<array<string,mixed>> */
    public function listAllHeroHighlights(string $siteId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT h.* FROM hero_highlight_images h
             INNER JOIN batches b ON b.id = h.batch_id
             WHERE b.site_id = ?
             ORDER BY b.sort_order ASC, h.sort_order ASC'
        );
        $stmt->execute([$siteId]);
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $item = [
                'id' => $row['id'],
                'batchId' => $row['batch_id'],
                'url' => $row['url'],
                'alt' => $row['alt'],
                'sortOrder' => (int) $row['sort_order'],
            ];
            if ($row['media_id']) {
                $item['mediaId'] = $row['media_id'];
            }
            $out[] = $item;
        }
        return $out;
    }

    /**
     * SiteContentDb-shaped payload without navLinks / footer.
     *
     * @return array<string,mixed>
     */
    public function buildBootstrap(string $siteId): array
    {
        $site = $this->getSite($siteId);
        if (!$site) {
            throw new \RuntimeException('Site not found', 404);
        }

        $contact = $this->getContact($siteId);
        $hero = $this->getPageHero($siteId);
        $about = $this->getPageAbout($siteId);
        $collections = $this->getPageCollections($siteId);
        $journey = $this->getPageJourney($siteId);
        $batchShop = $this->getPageBatchShop($siteId);

        $pageCopy = [];
        if ($hero) {
            $pageCopy['hero'] = $hero;
        }
        if ($about) {
            $pageCopy['about'] = $about;
        }
        if ($collections) {
            $pageCopy['collections'] = $collections;
        }
        if ($journey) {
            $pageCopy['journey'] = $journey;
        }
        if ($batchShop) {
            $pageCopy['batchShop'] = $batchShop;
        }

        $tz = new \DateTimeZone($this->timezone);
        $now = new \DateTimeImmutable('now', $tz);

        return [
            'version' => 1,
            'serverTime' => $now->format(\DateTimeInterface::ATOM),
            'site' => $site,
            'contact' => $contact,
            'batches' => $this->listBatches($siteId, true),
            'journeyVideos' => $this->listAllJourneyVideos($siteId),
            'journeyImages' => $this->listAllJourneyImages($siteId),
            'heroHighlightImages' => $this->listAllHeroHighlights($siteId),
            'pageCopy' => $pageCopy,
        ];
    }

    public function insertMedia(array $row): array
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO media (id, site_id, disk_path, public_url, mime, bytes, original_name, kind)
             VALUES (:id, :site_id, :disk_path, :public_url, :mime, :bytes, :original_name, :kind)'
        );
        $stmt->execute([
            ':id' => $row['id'],
            ':site_id' => $row['site_id'],
            ':disk_path' => $row['disk_path'],
            ':public_url' => $row['public_url'],
            ':mime' => $row['mime'],
            ':bytes' => $row['bytes'],
            ':original_name' => $row['original_name'],
            ':kind' => $row['kind'],
        ]);

        return [
            'id' => $row['id'],
            'siteId' => $row['site_id'],
            'publicUrl' => $row['public_url'],
            'mime' => $row['mime'],
            'bytes' => (int) $row['bytes'],
            'originalName' => $row['original_name'],
            'kind' => $row['kind'],
        ];
    }

    public function insertLead(array $row): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO leads
             (site_id, type, batch_id, product_id, customer_name, phone, email, message, meta_json, source_path)
             VALUES
             (:site_id, :type, :batch_id, :product_id, :customer_name, :phone, :email, :message, :meta_json, :source_path)'
        );
        $stmt->execute([
            ':site_id' => $row['site_id'],
            ':type' => $row['type'],
            ':batch_id' => $row['batch_id'],
            ':product_id' => $row['product_id'],
            ':customer_name' => $row['customer_name'],
            ':phone' => $row['phone'],
            ':email' => $row['email'],
            ':message' => $row['message'],
            ':meta_json' => $row['meta_json'],
            ':source_path' => $row['source_path'],
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    private function mapBatchRow(array $row): array
    {
        return [
            'id' => $row['id'],
            'label' => $row['label'],
            'launchAt' => orbit_iso_datetime($row['launch_at'], $this->timezone),
            'launchDisplay' => $row['launch_display'],
            'soldOut' => orbit_bool($row['sold_out']),
            'sortOrder' => (int) $row['sort_order'],
            'heroWindowDays' => (int) $row['hero_window_days'],
            'countdownEyebrow' => $row['countdown_eyebrow'],
            'countdownHeading' => $row['countdown_heading'],
            'countdownLede' => $row['countdown_lede'],
            'celebrationHeading' => $row['celebration_heading'],
            'celebrationLede' => $row['celebration_lede'],
            'products' => [],
        ];
    }

    private function mapProductRow(array $row): array
    {
        $productId = $row['id'];

        $cStmt = $this->pdo->prepare(
            'SELECT id, name, hex, sort_order FROM product_colors
             WHERE product_id = ? ORDER BY sort_order ASC, id ASC'
        );
        $cStmt->execute([$productId]);
        $colors = [];
        foreach ($cStmt->fetchAll() as $c) {
            $colors[] = [
                'id' => (string) $c['id'],
                'name' => $c['name'],
                'hex' => $c['hex'],
                'sortOrder' => (int) $c['sort_order'],
            ];
        }

        $iStmt = $this->pdo->prepare(
            'SELECT id, media_id, url, sort_order FROM product_images
             WHERE product_id = ? ORDER BY sort_order ASC, id ASC'
        );
        $iStmt->execute([$productId]);
        $images = [];
        foreach ($iStmt->fetchAll() as $img) {
            $images[] = [
                'id' => (string) $img['id'],
                'url' => $img['url'],
                'sortOrder' => (int) $img['sort_order'],
                'mediaId' => $img['media_id'],
            ];
        }

        return [
            'id' => $productId,
            'name' => $row['name'],
            'price' => (float) $row['price'],
            'description' => $row['description'],
            'summary' => $row['summary'],
            'dimensions' => $row['dimensions'],
            'alt' => $row['alt'],
            'sortOrder' => (int) $row['sort_order'],
            'soldOut' => orbit_bool($row['sold_out']),
            'colors' => $colors,
            'images' => $images,
        ];
    }
}
