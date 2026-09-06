<?php

declare(strict_types=1);

/**
 * V004__AddPageAboutImageAlt
 *
 * Aligns legacy page_about rows with the Phase 1 schema (image_alt column).
 * Safe to run on databases that already have the column (duplicate column ignored).
 */

return [
    'type' => 'schema',
    'description' => 'Add page_about.image_alt for legacy databases',
    'irreversible' => false,
    'up' => <<<'SQL'
ALTER TABLE page_about
  ADD COLUMN image_alt VARCHAR(512) NOT NULL DEFAULT '' AFTER image_media_id;
SQL,
    'down' => <<<'SQL'
ALTER TABLE page_about DROP COLUMN image_alt;
SQL,
];
