<?php

declare(strict_types=1);

/**
 * V002__CreateLeads
 *
 * WhatsApp lead capture table for buy/custom intent logging.
 */

return [
    'type' => 'schema',
    'description' => 'Create leads table for WhatsApp buy/custom intent logging',
    'irreversible' => false,
    'up' => <<<'SQL'
CREATE TABLE IF NOT EXISTS leads (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id        VARCHAR(64)     NOT NULL,
  type           ENUM('buy','custom','contact') NOT NULL,
  status         VARCHAR(32)     NOT NULL DEFAULT 'new',
  batch_id       VARCHAR(64)     NULL,
  product_id     VARCHAR(64)     NULL,
  customer_name  VARCHAR(255)    NULL,
  phone          VARCHAR(64)     NULL,
  email          VARCHAR(255)    NULL,
  message        TEXT            NULL,
  meta_json      JSON            NULL,
  source_path    VARCHAR(512)    NULL,
  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_leads_site_created (site_id, created_at),
  KEY idx_leads_status (site_id, status),
  CONSTRAINT fk_leads_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL,
    'down' => <<<'SQL'
DROP TABLE IF EXISTS leads;
SQL,
];
