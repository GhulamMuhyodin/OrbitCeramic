-- Orbit Ceramic — full schema
-- Content CMS (products/batches/about/reviews) + future checkout
-- Header nav + footer stay in site-content.json (NOT in DB)
-- Target: MySQL 8 / MariaDB 10.5+ (Hostinger)
-- Charset: utf8mb4

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ###########################################################################
-- A) CONTENT CMS  (batch catalog + about/reviews; nav/footer are static JSON)
-- ###########################################################################

CREATE TABLE IF NOT EXISTS sites (
  id              VARCHAR(64)  NOT NULL,
  brand           VARCHAR(255) NOT NULL,
  active_batch_id VARCHAR(64)  NULL COMMENT 'Current countdown/shop batch',
  currency_code   CHAR(3)      NOT NULL DEFAULT 'PKR',
  currency_symbol VARCHAR(16)  NOT NULL DEFAULT 'Rs',
  timezone        VARCHAR(64)  NOT NULL DEFAULT 'Asia/Karachi',
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contacts (
  id               VARCHAR(64)  NOT NULL,
  site_id          VARCHAR(64)  NOT NULL,
  whatsapp         VARCHAR(32)  NOT NULL COMMENT 'Digits only for wa.me',
  email            VARCHAR(255) NOT NULL,
  instagram        VARCHAR(512) NOT NULL,
  instagram_handle VARCHAR(128) NOT NULL,
  website          VARCHAR(512) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_contacts_site (site_id),
  CONSTRAINT fk_contacts_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_visit_lines (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  contact_id VARCHAR(64)     NOT NULL,
  line_text  VARCHAR(255)    NOT NULL,
  sort_order INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_visit_lines_contact (contact_id, sort_order),
  CONSTRAINT fk_visit_lines_contact FOREIGN KEY (contact_id) REFERENCES contacts (id)
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
  KEY idx_media_site (site_id, kind, created_at),
  CONSTRAINT fk_media_site FOREIGN KEY (site_id) REFERENCES sites (id)
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
  KEY idx_batches_site (site_id, sort_order),
  KEY idx_batches_launch (launch_at),
  CONSTRAINT fk_batches_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE sites
  ADD CONSTRAINT fk_sites_active_batch
    FOREIGN KEY (active_batch_id) REFERENCES batches (id)
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS products (
  id          VARCHAR(64)     NOT NULL,
  batch_id    VARCHAR(64)     NOT NULL,
  sku         VARCHAR(64)     NULL COMMENT 'For checkout / inventory',
  name        VARCHAR(255)    NOT NULL,
  price       DECIMAL(12, 2)  NOT NULL,
  description TEXT            NOT NULL,
  summary     TEXT            NOT NULL,
  dimensions  VARCHAR(128)    NOT NULL,
  alt         VARCHAR(512)    NOT NULL,
  sold_out    TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Manual override flag',
  stock_qty   INT             NOT NULL DEFAULT 0 COMMENT '0 = use sold_out only until checkout',
  track_stock TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '1 when checkout inventory is enabled',
  sort_order  INT             NOT NULL DEFAULT 0,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku),
  KEY idx_products_batch (batch_id, sort_order),
  CONSTRAINT fk_products_batch FOREIGN KEY (batch_id) REFERENCES batches (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Use AUTO_INCREMENT PK: JSON currently reuses color/image ids across rows
CREATE TABLE IF NOT EXISTS product_colors (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id VARCHAR(64)     NOT NULL,
  code       VARCHAR(64)     NULL COMMENT 'Stable code for orders e.g. ash-mist',
  name       VARCHAR(128)    NOT NULL,
  hex        CHAR(7)         NOT NULL,
  sort_order INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_color_code (product_id, code),
  KEY idx_colors_product (product_id, sort_order),
  CONSTRAINT fk_colors_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_images (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id VARCHAR(64)     NOT NULL,
  media_id   VARCHAR(64)     NOT NULL,
  url        VARCHAR(1024)   NOT NULL COMMENT 'Denormalized media.public_url for bootstrap',
  sort_order INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_images_product (product_id, sort_order),
  KEY idx_images_media (media_id),
  CONSTRAINT fk_images_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_images_media FOREIGN KEY (media_id) REFERENCES media (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exactly one journey video per batch
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
  UNIQUE KEY uq_journey_video_batch (batch_id),
  KEY idx_journey_videos_poster (poster_media_id),
  KEY idx_journey_videos_video (video_media_id),
  CONSTRAINT fk_journey_videos_batch FOREIGN KEY (batch_id) REFERENCES batches (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_journey_videos_poster FOREIGN KEY (poster_media_id) REFERENCES media (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_journey_videos_video FOREIGN KEY (video_media_id) REFERENCES media (id)
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
  KEY idx_journey_images_batch (batch_id, sort_order),
  KEY idx_journey_images_media (media_id),
  CONSTRAINT fk_journey_images_batch FOREIGN KEY (batch_id) REFERENCES batches (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_journey_images_media FOREIGN KEY (media_id) REFERENCES media (id)
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
  KEY idx_hero_highlights_batch (batch_id, sort_order),
  KEY idx_hero_highlights_media (media_id),
  CONSTRAINT fk_hero_highlights_batch FOREIGN KEY (batch_id) REFERENCES batches (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_hero_highlights_media FOREIGN KEY (media_id) REFERENCES media (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS page_hero (
  site_id         VARCHAR(64)   NOT NULL,
  image           VARCHAR(1024) NOT NULL,
  image_media_id  VARCHAR(64)   NULL,
  brand           VARCHAR(255)  NOT NULL,
  brand_primary   VARCHAR(128)  NOT NULL,
  brand_secondary VARCHAR(128)  NOT NULL,
  title           VARCHAR(512)  NOT NULL,
  lede            TEXT          NOT NULL,
  cta_label       VARCHAR(128)  NOT NULL,
  cta_href        VARCHAR(512)  NOT NULL,
  PRIMARY KEY (site_id),
  KEY idx_page_hero_media (image_media_id),
  CONSTRAINT fk_page_hero_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_page_hero_media FOREIGN KEY (image_media_id) REFERENCES media (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS page_about (
  site_id         VARCHAR(64)   NOT NULL,
  eyebrow         VARCHAR(128)  NOT NULL,
  heading         VARCHAR(255)  NOT NULL,
  image           VARCHAR(1024) NOT NULL,
  image_media_id  VARCHAR(64)   NULL,
  image_alt       VARCHAR(512)  NOT NULL,
  reviews_eyebrow VARCHAR(128)  NOT NULL,
  reviews_heading VARCHAR(255)  NOT NULL,
  PRIMARY KEY (site_id),
  KEY idx_page_about_media (image_media_id),
  CONSTRAINT fk_page_about_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_page_about_media FOREIGN KEY (image_media_id) REFERENCES media (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS about_paragraphs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id    VARCHAR(64)     NOT NULL,
  body       TEXT            NOT NULL,
  sort_order INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_about_paragraphs_site (site_id, sort_order),
  CONSTRAINT fk_about_paragraphs_site FOREIGN KEY (site_id) REFERENCES page_about (site_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS about_reviews (
  id             VARCHAR(64)        NOT NULL,
  site_id        VARCHAR(64)        NOT NULL,
  quote          TEXT               NOT NULL,
  name           VARCHAR(128)       NOT NULL,
  detail         VARCHAR(255)       NOT NULL,
  rating         TINYINT UNSIGNED   NOT NULL,
  image          VARCHAR(1024)      NULL,
  image_media_id VARCHAR(64)        NULL,
  image_alt      VARCHAR(512)       NULL,
  gender         ENUM('woman','man') NOT NULL,
  is_published   TINYINT(1)         NOT NULL DEFAULT 1,
  sort_order     INT                NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_about_reviews_site (site_id, sort_order),
  KEY idx_about_reviews_media (image_media_id),
  CONSTRAINT fk_about_reviews_site FOREIGN KEY (site_id) REFERENCES page_about (site_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_about_reviews_media FOREIGN KEY (image_media_id) REFERENCES media (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_about_reviews_rating CHECK (rating BETWEEN 1 AND 5)
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
  CONSTRAINT fk_page_collections_site FOREIGN KEY (site_id) REFERENCES sites (id)
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
  CONSTRAINT fk_page_journey_site FOREIGN KEY (site_id) REFERENCES sites (id)
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
  CONSTRAINT fk_page_batch_shop_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Footer + header nav: NOT in DB — keep in site-content.json / Angular static chrome

-- ###########################################################################
-- B) LEADS  (bridge: today WhatsApp, later feed into checkout)
-- ###########################################################################

CREATE TABLE IF NOT EXISTS leads (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id      VARCHAR(64)     NOT NULL,
  type         ENUM('buy','custom','contact') NOT NULL,
  status       ENUM('new','contacted','converted','closed') NOT NULL DEFAULT 'new',
  batch_id     VARCHAR(64)     NULL,
  product_id   VARCHAR(64)     NULL,
  customer_name VARCHAR(255)   NULL,
  phone        VARCHAR(32)     NULL,
  email        VARCHAR(255)    NULL,
  message      TEXT            NULL,
  meta_json    JSON            NULL COMMENT 'colors, dimensions, price snapshot',
  source_path  VARCHAR(255)    NULL COMMENT 'e.g. /batch, /collections',
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_leads_site_status (site_id, status, created_at),
  CONSTRAINT fk_leads_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_leads_batch FOREIGN KEY (batch_id) REFERENCES batches (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_leads_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ###########################################################################
-- C) CHECKOUT / COMMERCE  (future — tables ready, app can keep WhatsApp until enabled)
-- ###########################################################################

CREATE TABLE IF NOT EXISTS customers (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id       VARCHAR(64)     NOT NULL,
  email         VARCHAR(255)    NOT NULL,
  phone         VARCHAR(32)     NULL,
  full_name     VARCHAR(255)    NOT NULL,
  password_hash VARCHAR(255)    NULL COMMENT 'NULL = guest-only checkout',
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_site_email (site_id, email),
  KEY idx_customers_phone (site_id, phone),
  CONSTRAINT fk_customers_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_addresses (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id  BIGINT UNSIGNED NOT NULL,
  label        VARCHAR(64)     NULL COMMENT 'Home / Work',
  line1        VARCHAR(255)    NOT NULL,
  line2        VARCHAR(255)    NULL,
  city         VARCHAR(128)    NOT NULL,
  state        VARCHAR(128)    NULL,
  postal_code  VARCHAR(32)     NULL,
  country      CHAR(2)         NOT NULL DEFAULT 'PK',
  is_default   TINYINT(1)      NOT NULL DEFAULT 0,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_addresses_customer (customer_id),
  CONSTRAINT fk_addresses_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS carts (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id      VARCHAR(64)     NOT NULL,
  customer_id  BIGINT UNSIGNED NULL,
  session_key  VARCHAR(64)     NULL COMMENT 'Guest cart cookie/token',
  currency     CHAR(3)         NOT NULL DEFAULT 'PKR',
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_carts_session (site_id, session_key),
  KEY idx_carts_customer (customer_id),
  CONSTRAINT fk_carts_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_carts_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cart_items (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cart_id          BIGINT UNSIGNED NOT NULL,
  product_id       VARCHAR(64)     NOT NULL,
  product_color_id BIGINT UNSIGNED NULL,
  quantity         INT             NOT NULL DEFAULT 1,
  unit_price       DECIMAL(12, 2)  NOT NULL COMMENT 'Snapshot at add-to-cart',
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_line (cart_id, product_id, product_color_id),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_color FOREIGN KEY (product_color_id) REFERENCES product_colors (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_cart_qty CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shipping_methods (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id       VARCHAR(64)     NOT NULL,
  code          VARCHAR(64)     NOT NULL,
  label         VARCHAR(128)    NOT NULL,
  fee           DECIMAL(12, 2)  NOT NULL DEFAULT 0,
  is_active     TINYINT(1)      NOT NULL DEFAULT 1,
  sort_order    INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_shipping_code (site_id, code),
  CONSTRAINT fk_shipping_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id            VARCHAR(64)     NOT NULL,
  order_number       VARCHAR(32)     NOT NULL,
  customer_id        BIGINT UNSIGNED NULL,
  status             ENUM(
                       'pending_payment',
                       'paid',
                       'processing',
                       'shipped',
                       'delivered',
                       'cancelled',
                       'refunded'
                     ) NOT NULL DEFAULT 'pending_payment',
  currency           CHAR(3)         NOT NULL DEFAULT 'PKR',
  subtotal           DECIMAL(12, 2)  NOT NULL,
  shipping_fee       DECIMAL(12, 2)  NOT NULL DEFAULT 0,
  discount_total     DECIMAL(12, 2)  NOT NULL DEFAULT 0,
  grand_total        DECIMAL(12, 2)  NOT NULL,
  shipping_method_id BIGINT UNSIGNED NULL,
  shipping_name      VARCHAR(255)    NOT NULL,
  shipping_phone     VARCHAR(32)     NOT NULL,
  shipping_line1     VARCHAR(255)    NOT NULL,
  shipping_line2     VARCHAR(255)    NULL,
  shipping_city      VARCHAR(128)    NOT NULL,
  shipping_state     VARCHAR(128)    NULL,
  shipping_postal    VARCHAR(32)     NULL,
  shipping_country   CHAR(2)         NOT NULL DEFAULT 'PK',
  customer_note      TEXT            NULL,
  placed_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_number (site_id, order_number),
  KEY idx_orders_customer (customer_id, placed_at),
  KEY idx_orders_status (site_id, status),
  CONSTRAINT fk_orders_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_orders_shipping_method FOREIGN KEY (shipping_method_id) REFERENCES shipping_methods (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id           BIGINT UNSIGNED NOT NULL,
  product_id         VARCHAR(64)     NULL,
  batch_id           VARCHAR(64)     NULL,
  product_name       VARCHAR(255)    NOT NULL COMMENT 'Snapshot',
  batch_label        VARCHAR(128)    NULL,
  color_name         VARCHAR(128)    NULL,
  color_hex          CHAR(7)         NULL,
  sku                VARCHAR(64)     NULL,
  quantity           INT             NOT NULL,
  unit_price         DECIMAL(12, 2)  NOT NULL,
  line_total         DECIMAL(12, 2)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_order_items_batch FOREIGN KEY (batch_id) REFERENCES batches (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_order_qty CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id         BIGINT UNSIGNED NOT NULL,
  provider         VARCHAR(64)     NOT NULL COMMENT 'cod, jazzcash, stripe, ...',
  provider_ref     VARCHAR(255)    NULL,
  status           ENUM('pending','authorized','captured','failed','refunded') NOT NULL DEFAULT 'pending',
  amount           DECIMAL(12, 2)  NOT NULL,
  currency         CHAR(3)         NOT NULL DEFAULT 'PKR',
  paid_at          TIMESTAMP       NULL,
  raw_payload_json JSON            NULL,
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id   VARCHAR(64)     NOT NULL,
  delta        INT             NOT NULL COMMENT 'Negative = sold/reserved',
  reason       ENUM('adjust','order_reserve','order_commit','order_release','restock') NOT NULL,
  order_id     BIGINT UNSIGNED NULL,
  note         VARCHAR(255)    NULL,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inv_product (product_id, created_at),
  CONSTRAINT fk_inv_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_inv_order FOREIGN KEY (order_id) REFERENCES orders (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id       VARCHAR(64)     NOT NULL,
  email         VARCHAR(255)    NOT NULL,
  full_name     VARCHAR(255)    NOT NULL,
  password_hash VARCHAR(255)    NOT NULL,
  role          ENUM('owner','editor','fulfillment') NOT NULL DEFAULT 'editor',
  is_active     TINYINT(1)      NOT NULL DEFAULT 1,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_email (site_id, email),
  CONSTRAINT fk_admin_site FOREIGN KEY (site_id) REFERENCES sites (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
