<?php

declare(strict_types=1);

/**
 * V006__CreatePayments
 *
 * EXAMPLE future schema migration — safe to apply or delete before production use.
 * Demonstrates: php bin/database migration:create CreatePayments
 */

return [
    'type' => 'schema',
    'description' => 'Example: create payments lookup table',
    'irreversible' => false,
    'up' => <<<'SQL'
CREATE TABLE IF NOT EXISTS payment_types (
  id          VARCHAR(64)  NOT NULL,
  code        VARCHAR(64)  NOT NULL,
  label       VARCHAR(128) NOT NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_types_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL,
    'down' => <<<'SQL'
DROP TABLE IF EXISTS payment_types;
SQL,
];
