<?php

declare(strict_types=1);

/**
 * V005__SeedDefaultSiteContent
 *
 * Idempotent starter site / contact / page-copy rows for a fresh install.
 * Does NOT wipe existing production data.
 * Does NOT seed batches/products — create those via Admin CMS.
 */

return [
    'type' => 'seed',
    'description' => 'Seed default site, contact, and page copy (idempotent)',
    'irreversible' => false,
    'up' => <<<'SQL'
INSERT INTO sites (id, brand, active_batch_id, image, image_media_id)
VALUES ('site-orbit', 'Orbit Ceramic', NULL, '', NULL)
ON DUPLICATE KEY UPDATE
  brand = VALUES(brand);

INSERT INTO contacts (id, site_id, whatsapp, email, instagram, instagram_handle, line_text)
VALUES (
  'contact-main', 'site-orbit', '923227987366', 'theorbitceramic@gmail.com',
  'https://instagram.com/orbitceramic', '@orbitceramic', 'Anarkli, Lahore'
)
ON DUPLICATE KEY UPDATE
  whatsapp = VALUES(whatsapp),
  email = VALUES(email),
  instagram = VALUES(instagram),
  instagram_handle = VALUES(instagram_handle),
  line_text = VALUES(line_text);

INSERT INTO page_about (
  site_id, eyebrow, heading, image, image_media_id, image_alt, body, show_on_website
) VALUES (
  'site-orbit', 'The maker', 'Mr. Ghulam Jilani',
  '', NULL, '',
  'I am a ceramic artist and clay craftsman with a deep passion for transforming raw clay into timeless works of art. My work is inspired by traditional pottery, antique forms, natural textures, and the quiet beauty found in handmade objects. Every piece I create is shaped by hand, allowing each bowl, vase, platter, mug, and decorative sculpture to carry its own unique character and story.\n\nI specialize in handcrafted ceramic bowls, antique-inspired pottery, decorative clay art, custom ceramic pieces, and artisan home décor. My goal is to create heirloom-quality ceramics that celebrate the beauty of imperfection, the richness of traditional craftsmanship, and the lasting connection between the artist, the material, and the people who use my work.',
  1
)
ON DUPLICATE KEY UPDATE
  eyebrow = VALUES(eyebrow),
  heading = VALUES(heading),
  body = VALUES(body),
  show_on_website = VALUES(show_on_website);

INSERT INTO page_reviews (site_id, eyebrow, heading)
VALUES ('site-orbit', 'Client voices', 'What collectors say')
ON DUPLICATE KEY UPDATE
  eyebrow = VALUES(eyebrow),
  heading = VALUES(heading);

INSERT INTO page_collections (
  site_id, eyebrow, heading, lede, out_of_stock_label, custom_note, custom_cta_label,
  view_by_batch_label, view_all_label, empty_title, empty_lede, empty_cta_label
) VALUES (
  'site-orbit', 'Collections', 'Batch forms, kept in the archive',
  'Every firing leaves a record — image, colors, and dimensions — so you can feel the piece even after the drop sells out.',
  'Out of stock',
  'Want this type of product? The design and form can stay the same — color, glaze, or surface details can change for a made-to-order piece.',
  'Request similar design', 'By batch', 'View all',
  'Collection opens with the batch',
  'Pieces appear here once the firing goes live — or stay archived after the drop sells out. Until then, follow the countdown on Batch.',
  'See batch countdown'
)
ON DUPLICATE KEY UPDATE
  eyebrow = VALUES(eyebrow),
  heading = VALUES(heading),
  lede = VALUES(lede);

INSERT INTO page_journey (
  site_id, eyebrow, heading, lede, open_label, back_label, empty_title, empty_lede, empty_cta_label
) VALUES (
  'site-orbit', 'Journey', 'Fire, clay, and each batch''s story',
  'Open a batch card to watch that firing''s journey — from the wheel to the kiln door.',
  'Watch journey', 'All batches',
  'Journey unlocks with the drop',
  'Batch journey videos appear here once that firing goes live. Until then, follow the countdown on Batch.',
  'See batch countdown'
)
ON DUPLICATE KEY UPDATE
  eyebrow = VALUES(eyebrow),
  heading = VALUES(heading),
  lede = VALUES(lede);

INSERT INTO page_batch_shop (
  site_id, eyebrow, heading, lede, buy_label, currency, currency_symbol
) VALUES (
  'site-orbit', 'Batch shop', 'Pieces from this firing',
  'Each photo carries the story of the form — what it is, how large it sits in the hand, and which colors shaped the surface.',
  'Buy on WhatsApp', 'PKR', 'Rs'
)
ON DUPLICATE KEY UPDATE
  buy_label = VALUES(buy_label),
  currency = VALUES(currency),
  currency_symbol = VALUES(currency_symbol);
SQL,
    'down' => <<<'SQL'
-- Removes only the default seed rows. Leaves any other site/content untouched.
DELETE FROM page_batch_shop WHERE site_id = 'site-orbit';
DELETE FROM page_journey WHERE site_id = 'site-orbit';
DELETE FROM page_collections WHERE site_id = 'site-orbit';
DELETE FROM page_reviews WHERE site_id = 'site-orbit';
DELETE FROM page_about WHERE site_id = 'site-orbit';
DELETE FROM contacts WHERE id = 'contact-main';
DELETE FROM sites WHERE id = 'site-orbit';
SQL,
];
