<?php

declare(strict_types=1);

/**
 * V008__ExtractPageCountdown
 *
 * Moves countdown / celebration copy out of batches into site-level page_countdown.
 * Existing batch APIs no longer own these fields.
 */

return [
    'type' => 'schema',
    'description' => 'Create page_countdown and remove countdown columns from batches',
    'irreversible' => false,
    'up' => <<<'SQL'
CREATE TABLE IF NOT EXISTS page_countdown (
  site_id              VARCHAR(64)  NOT NULL,
  countdown_eyebrow    VARCHAR(255) NOT NULL DEFAULT '',
  countdown_heading    VARCHAR(512) NOT NULL DEFAULT '',
  countdown_lede       TEXT         NOT NULL,
  celebration_heading  VARCHAR(512) NOT NULL DEFAULT '',
  celebration_lede     TEXT         NOT NULL,
  created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (site_id),
  CONSTRAINT fk_page_countdown_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO page_countdown (
  site_id, countdown_eyebrow, countdown_heading, countdown_lede,
  celebration_heading, celebration_lede
)
SELECT
  s.id,
  COALESCE(b.countdown_eyebrow, 'Next drop'),
  COALESCE(b.countdown_heading, 'New batch launching soon'),
  COALESCE(b.countdown_lede, ''),
  COALESCE(b.celebration_heading, 'This batch is live'),
  COALESCE(b.celebration_lede, '')
FROM sites s
LEFT JOIN batches b ON b.id = (
  SELECT b2.id
  FROM batches b2
  WHERE b2.site_id = s.id
  ORDER BY
    CASE WHEN s.active_batch_id IS NOT NULL AND b2.id = s.active_batch_id THEN 0 ELSE 1 END,
    b2.sort_order ASC,
    b2.id ASC
  LIMIT 1
)
WHERE NOT EXISTS (
  SELECT 1 FROM page_countdown pc WHERE pc.site_id = s.id
);

ALTER TABLE batches
  DROP COLUMN countdown_eyebrow,
  DROP COLUMN countdown_heading,
  DROP COLUMN countdown_lede,
  DROP COLUMN celebration_heading,
  DROP COLUMN celebration_lede;
SQL,
    'down' => <<<'SQL'
ALTER TABLE batches
  ADD COLUMN countdown_eyebrow   VARCHAR(255) NOT NULL DEFAULT '' AFTER hero_window_days,
  ADD COLUMN countdown_heading   VARCHAR(512) NOT NULL DEFAULT '' AFTER countdown_eyebrow,
  ADD COLUMN countdown_lede      TEXT NULL AFTER countdown_heading,
  ADD COLUMN celebration_heading VARCHAR(512) NOT NULL DEFAULT '' AFTER countdown_lede,
  ADD COLUMN celebration_lede    TEXT NULL AFTER celebration_heading;

UPDATE batches b
INNER JOIN page_countdown pc ON pc.site_id = b.site_id
SET
  b.countdown_eyebrow = pc.countdown_eyebrow,
  b.countdown_heading = pc.countdown_heading,
  b.countdown_lede = pc.countdown_lede,
  b.celebration_heading = pc.celebration_heading,
  b.celebration_lede = pc.celebration_lede;

UPDATE batches
SET
  countdown_lede = COALESCE(countdown_lede, ''),
  celebration_lede = COALESCE(celebration_lede, '');

ALTER TABLE batches
  MODIFY COLUMN countdown_lede TEXT NOT NULL,
  MODIFY COLUMN celebration_lede TEXT NOT NULL;

DROP TABLE IF EXISTS page_countdown;
SQL,
];
