<?php

declare(strict_types=1);

/**
 * V001__InitialSchema
 *
 * Phase 1 content CMS schema (initial database).
 * Never edit after apply — create a new migration instead.
 */

return [
    'type' => 'schema',
    'description' => 'Initial Phase 1 schema (sites, batches, products, media, pages, admin auth)',
    'irreversible' => true,
    'up' => <<<'SQL'
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS sites (
  id              VARCHAR(64)  NOT NULL,
  brand           VARCHAR(255) NOT NULL,
  active_batch_id VARCHAR(64)  NULL COMMENT 'Current countdown / shop batch',
  image           VARCHAR(1024) NOT NULL,
  image_media_id  VARCHAR(64)   NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
  id            VARCHAR(64)  NOT NULL,
  username      VARCHAR(128) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(255) NOT NULL,
  role          VARCHAR(32)  NOT NULL DEFAULT 'admin',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id            VARCHAR(64)  NOT NULL,
  user_id       VARCHAR(64)  NOT NULL,
  token_hash    CHAR(64)     NOT NULL,
  expires_at    DATETIME     NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  TIMESTAMP    NULL DEFAULT NULL,
  ip_address    VARCHAR(64)  NULL,
  user_agent    VARCHAR(512) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_sessions_token (token_hash),
  KEY idx_admin_sessions_user (user_id),
  KEY idx_admin_sessions_expiry (expires_at),
  CONSTRAINT fk_admin_sessions_user FOREIGN KEY (user_id) REFERENCES admin_users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contacts (
  id               VARCHAR(64)  NOT NULL,
  site_id          VARCHAR(64)  NOT NULL,
  whatsapp         VARCHAR(32)  NOT NULL COMMENT 'Digits only for wa.me',
  email            VARCHAR(255) NOT NULL,
  instagram        VARCHAR(512) NOT NULL,
  instagram_handle VARCHAR(128) NOT NULL,
  line_text VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_contacts_site (site_id),
  CONSTRAINT fk_p1_contacts_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media (
  id            VARCHAR(64)     NOT NULL,
  site_id       VARCHAR(64)     NOT NULL,
  disk_path     VARCHAR(1024)   NOT NULL COMMENT 'Server path under uploads/',
  public_url    VARCHAR(1024)   NOT NULL COMMENT 'URL served to the site / CDN',
  mime          VARCHAR(128)    NOT NULL,
  bytes         BIGINT UNSIGNED NOT NULL DEFAULT 0,
  original_name VARCHAR(255)    NOT NULL,
  kind          ENUM('image','video','other') NOT NULL DEFAULT 'image',
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_p1_media_site (site_id, kind, created_at),
  CONSTRAINT fk_p1_media_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS batches (
  id                  VARCHAR(64)  NOT NULL,
  site_id             VARCHAR(64)  NOT NULL,
  label               VARCHAR(128) NOT NULL,
  launch_at           DATETIME(3)  NOT NULL COMMENT 'Required launch datetime',
  launch_display      VARCHAR(255) NOT NULL,
  sold_out            TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order          INT          NOT NULL DEFAULT 0,
  hero_window_days    INT          NOT NULL DEFAULT 10,
  countdown_eyebrow   VARCHAR(255) NOT NULL,
  countdown_heading   VARCHAR(512) NOT NULL,
  countdown_lede      TEXT         NOT NULL,
  celebration_heading VARCHAR(512) NOT NULL,
  celebration_lede    TEXT         NOT NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_p1_batches_site (site_id, sort_order),
  KEY idx_p1_batches_launch (launch_at),
  CONSTRAINT fk_p1_batches_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id          VARCHAR(64)    NOT NULL,
  batch_id    VARCHAR(64)    NOT NULL,
  name        VARCHAR(255)   NOT NULL,
  price       DECIMAL(12, 2) NOT NULL,
  description TEXT           NOT NULL,
  summary     TEXT           NOT NULL,
  dimensions  VARCHAR(128)   NOT NULL,
  alt         VARCHAR(512)   NOT NULL,
  sold_out    TINYINT(1)     NOT NULL DEFAULT 0,
  sort_order  INT            NOT NULL DEFAULT 0,
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_p1_products_batch (batch_id, sort_order),
  CONSTRAINT fk_p1_products_batch FOREIGN KEY (batch_id) REFERENCES batches (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_colors (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id VARCHAR(64)     NOT NULL,
  name       VARCHAR(128)    NOT NULL,
  hex        CHAR(7)         NOT NULL,
  sort_order INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_p1_colors_product (product_id, sort_order),
  CONSTRAINT fk_p1_colors_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_images (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id VARCHAR(64)     NOT NULL,
  media_id   VARCHAR(64)     NOT NULL,
  url        VARCHAR(1024)   NOT NULL COMMENT 'Denormalized media.public_url for bootstrap',
  sort_order INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_p1_images_product (product_id, sort_order),
  KEY idx_p1_images_media (media_id),
  CONSTRAINT fk_p1_images_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_p1_images_media FOREIGN KEY (media_id) REFERENCES media (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS journey_videos (
  id              VARCHAR(64)   NOT NULL,
  batch_id        VARCHAR(64)   NOT NULL,
  title           VARCHAR(255)  NOT NULL,
  lede            TEXT          NOT NULL,
  poster_media_id VARCHAR(64)   NULL,
  video_media_id  VARCHAR(64)   NULL,
  poster_image    VARCHAR(1024) NOT NULL COMMENT 'Denormalized poster public_url',
  video_url       VARCHAR(1024) NOT NULL COMMENT 'Denormalized video public_url',
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_p1_journey_video_batch (batch_id),
  KEY idx_p1_journey_videos_poster (poster_media_id),
  KEY idx_p1_journey_videos_video (video_media_id),
  CONSTRAINT fk_p1_journey_videos_batch FOREIGN KEY (batch_id) REFERENCES batches (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_p1_journey_videos_poster FOREIGN KEY (poster_media_id) REFERENCES media (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_p1_journey_videos_video FOREIGN KEY (video_media_id) REFERENCES media (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS journey_images (
  id         VARCHAR(64)   NOT NULL,
  batch_id   VARCHAR(64)   NOT NULL,
  media_id   VARCHAR(64)   NOT NULL,
  url        VARCHAR(1024) NOT NULL COMMENT 'Denormalized media.public_url',
  alt        VARCHAR(512)  NOT NULL,
  sort_order INT           NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_p1_journey_images (batch_id, sort_order),
  KEY idx_p1_journey_images_media (media_id),
  CONSTRAINT fk_p1_journey_images_batch FOREIGN KEY (batch_id) REFERENCES batches (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_p1_journey_images_media FOREIGN KEY (media_id) REFERENCES media (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hero_highlight_images (
  id         VARCHAR(64)   NOT NULL,
  batch_id   VARCHAR(64)   NOT NULL,
  media_id   VARCHAR(64)   NOT NULL,
  url        VARCHAR(1024) NOT NULL COMMENT 'Denormalized media.public_url',
  alt        VARCHAR(512)  NOT NULL,
  sort_order INT           NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_p1_hero_highlights (batch_id, sort_order),
  KEY idx_p1_hero_highlights_media (media_id),
  CONSTRAINT fk_p1_hero_highlights_batch FOREIGN KEY (batch_id) REFERENCES batches (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_p1_hero_highlights_media FOREIGN KEY (media_id) REFERENCES media (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS page_about (
  site_id         VARCHAR(64)   NOT NULL,
  eyebrow         VARCHAR(128)  NOT NULL,
  heading         VARCHAR(255)  NOT NULL,
  image           VARCHAR(1024) NOT NULL,
  image_media_id  VARCHAR(64)   NULL,
  image_alt       VARCHAR(512)  NOT NULL,
  body            TEXT          NOT NULL,
  show_on_website TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (site_id),
  KEY idx_p1_page_about_media (image_media_id),
  CONSTRAINT fk_p1_page_about_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_p1_page_about_media FOREIGN KEY (image_media_id) REFERENCES media (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS page_reviews (
  site_id         VARCHAR(64)   NOT NULL,
  eyebrow         VARCHAR(128)  NOT NULL,
  heading         VARCHAR(255)  NOT NULL,
  PRIMARY KEY (site_id),
  CONSTRAINT fk_p1_page_reviews_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id             VARCHAR(64)         NOT NULL,
  site_id        VARCHAR(64)         NOT NULL,
  quote          TEXT                NOT NULL,
  name           VARCHAR(128)        NOT NULL,
  detail         VARCHAR(255)        NOT NULL,
  rating         TINYINT UNSIGNED    NOT NULL,
  image          VARCHAR(1024)       NULL,
  image_media_id VARCHAR(64)         NULL,
  is_published   TINYINT(1)          NOT NULL DEFAULT 1,
  sort_order     INT                 NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_p1_reviews (site_id, sort_order),
  KEY idx_p1_reviews_media (image_media_id),
  CONSTRAINT fk_p1_reviews_site FOREIGN KEY (site_id) REFERENCES page_about (site_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_p1_reviews_media FOREIGN KEY (image_media_id) REFERENCES media (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_p1_reviews_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS page_collections (
  site_id             VARCHAR(64)  NOT NULL,
  eyebrow             VARCHAR(128) NOT NULL,
  heading             VARCHAR(255) NOT NULL,
  lede                TEXT         NOT NULL,
  out_of_stock_label  VARCHAR(128) NOT NULL,
  custom_note         TEXT         NOT NULL,
  custom_cta_label    VARCHAR(128) NOT NULL,
  view_by_batch_label VARCHAR(128) NOT NULL,
  view_all_label      VARCHAR(128) NOT NULL,
  empty_title         VARCHAR(255) NOT NULL,
  empty_lede          TEXT         NOT NULL,
  empty_cta_label     VARCHAR(128) NOT NULL,
  PRIMARY KEY (site_id),
  CONSTRAINT fk_p1_page_collections_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS page_journey (
  site_id         VARCHAR(64)  NOT NULL,
  eyebrow         VARCHAR(128) NOT NULL,
  heading         VARCHAR(255) NOT NULL,
  lede            TEXT         NOT NULL,
  open_label      VARCHAR(128) NOT NULL,
  back_label      VARCHAR(128) NOT NULL,
  empty_title     VARCHAR(255) NOT NULL,
  empty_lede      TEXT         NOT NULL,
  empty_cta_label VARCHAR(128) NOT NULL,
  PRIMARY KEY (site_id),
  CONSTRAINT fk_p1_page_journey_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS page_batch_shop (
  site_id         VARCHAR(64)  NOT NULL,
  eyebrow         VARCHAR(128) NOT NULL,
  heading         VARCHAR(255) NOT NULL,
  lede            TEXT         NOT NULL,
  buy_label       VARCHAR(128) NOT NULL,
  currency        VARCHAR(16)  NOT NULL,
  currency_symbol VARCHAR(16)  NOT NULL,
  PRIMARY KEY (site_id),
  CONSTRAINT fk_p1_page_batch_shop_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
SQL,
    'down' => <<<'SQL'
-- IRREVERSIBLE: drops all Phase 1 content tables. Requires --force.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS page_batch_shop;
DROP TABLE IF EXISTS page_journey;
DROP TABLE IF EXISTS page_collections;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS page_reviews;
DROP TABLE IF EXISTS page_about;
DROP TABLE IF EXISTS hero_highlight_images;
DROP TABLE IF EXISTS journey_images;
DROP TABLE IF EXISTS journey_videos;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS product_colors;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS batches;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS admin_sessions;
DROP TABLE IF EXISTS admin_users;
DROP TABLE IF EXISTS sites;
SET FOREIGN_KEY_CHECKS = 1;
SQL,
];
