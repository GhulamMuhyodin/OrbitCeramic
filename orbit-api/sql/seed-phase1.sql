-- Orbit Ceramic — Phase 1 seed (from site-content.json)
-- Run AFTER schema-phase1.sql
-- mysql -u root orbit_ceramic < seed-phase1.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM leads;
DELETE FROM about_reviews;
DELETE FROM about_paragraphs;
DELETE FROM page_batch_shop;
DELETE FROM page_journey;
DELETE FROM page_collections;
DELETE FROM page_about;
DELETE FROM page_hero;
DELETE FROM hero_highlight_images;
DELETE FROM journey_images;
DELETE FROM journey_videos;
DELETE FROM product_images;
DELETE FROM product_colors;
DELETE FROM products;
UPDATE sites SET active_batch_id = NULL;
DELETE FROM batches;
DELETE FROM contact_visit_lines;
DELETE FROM contacts;
DELETE FROM media;
DELETE FROM sites;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Site (active batch set after batches exist)
-- ---------------------------------------------------------------------------

INSERT INTO sites (id, brand, active_batch_id) VALUES
  ('site-orbit', 'Orbit Ceramic', NULL);

INSERT INTO contacts (id, site_id, whatsapp, email, instagram, instagram_handle, website) VALUES
  ('contact-main', 'site-orbit', '923227987366', 'theorbitceramic@gmail.com',
   'https://instagram.com/orbitceramic', '@orbitceramic', NULL);

INSERT INTO contact_visit_lines (contact_id, line_text, sort_order) VALUES
  ('contact-main', 'Anarkali', 1),
  ('contact-main', 'Lahore', 2);



INSERT INTO page_about (
  site_id, eyebrow, heading, image, image_media_id, image_alt
) VALUES (
  'site-orbit', 'The maker', 'Mr. Ghulam Jilani',
  '/images/about/about-01.jpg', 'media-about-01',
  'Handmade ceramic vessels arranged in a loft studio'
);

INSERT INTO page_reviews (
  site_id, eyebrow, heading
) VALUES (
  'site-orbit', 'Client voices', 'What collectors say'
);

INSERT INTO about_paragraphs (site_id, body, sort_order) VALUES
  ('site-orbit', 'I am a ceramic artist and clay craftsman with a deep passion for transforming raw clay into timeless works of art. My work is inspired by traditional pottery, antique forms, natural textures, and the quiet beauty found in handmade objects. Every piece I create is shaped by hand, allowing each bowl, vase, platter, mug, and decorative sculpture to carry its own unique character and story.', 1),
  ('site-orbit', 'I specialize in handcrafted ceramic bowls, antique-inspired pottery, decorative clay art, custom ceramic pieces, and artisan home décor. My goal is to create heirloom-quality ceramics that celebrate the beauty of imperfection, the richness of traditional craftsmanship, and the lasting connection between the artist, the material, and the people who use my work.', 2);


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
);

INSERT INTO page_journey (
  site_id, eyebrow, heading, lede, open_label, back_label, empty_title, empty_lede, empty_cta_label
) VALUES (
  'site-orbit', 'Journey', 'Fire, clay, and each batch’s story',
  'Open a batch card to watch that firing’s journey — from the wheel to the kiln door.',
  'Watch journey', 'All batches',
  'Journey unlocks with the drop',
  'Batch journey videos appear here once that firing goes live. Until then, follow the countdown on Batch.',
  'See batch countdown'
);

INSERT INTO page_batch_shop (
  site_id, eyebrow, heading, lede, buy_label, currency, currency_symbol
) VALUES (
  'site-orbit', 'Batch shop', 'Pieces from this firing',
  'Each photo carries the story of the form — what it is, how large it sits in the hand, and which colors shaped the surface.',
  'Buy on WhatsApp', 'PKR', 'Rs'
);
