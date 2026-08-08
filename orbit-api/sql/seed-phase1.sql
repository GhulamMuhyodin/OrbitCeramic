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

INSERT INTO media (id, site_id, disk_path, public_url, mime, bytes, original_name, kind) VALUES
  ('media-pod-01', 'site-orbit', 'seed/orbit-pod-b1-01.jpeg', '/images/products/orbit-b1-i1-pod/orbit-pod-b1-01.jpeg', 'image/jpeg', 0, 'orbit-pod-b1-01.jpeg', 'image'),
  ('media-pod-02', 'site-orbit', 'seed/orbit-pod-b1-02.jpeg', '/images/products/orbit-b1-i1-pod/orbit-pod-b1-02.jpeg', 'image/jpeg', 0, 'orbit-pod-b1-02.jpeg', 'image'),
  ('media-pod-03', 'site-orbit', 'seed/orbit-pod-b1-03.jpeg', '/images/products/orbit-b1-i1-pod/orbit-pod-b1-03.jpeg', 'image/jpeg', 0, 'orbit-pod-b1-03.jpeg', 'image'),
  ('media-pod-04', 'site-orbit', 'seed/orbit-pod-b1-04.jpeg', '/images/products/orbit-b1-i1-pod/orbit-pod-b1-04.jpeg', 'image/jpeg', 0, 'orbit-pod-b1-04.jpeg', 'image'),
  ('media-hero-01', 'site-orbit', 'seed/hero-01.jpg', '/images/hero/hero-01.jpg', 'image/jpeg', 0, 'hero-01.jpg', 'image'),
  ('media-about-01', 'site-orbit', 'seed/about-01.jpg', '/images/about/about-01.jpg', 'image/jpeg', 0, 'about-01.jpg', 'image');

INSERT INTO contacts (id, site_id, whatsapp, email, instagram, instagram_handle, website) VALUES
  ('contact-main', 'site-orbit', '923227987366', 'theorbitceramic@gmail.com',
   'https://instagram.com/orbitceramic', '@orbitceramic', NULL);

INSERT INTO contact_visit_lines (contact_id, line_text, sort_order) VALUES
  ('contact-main', 'Anarkali', 1),
  ('contact-main', 'Lahore', 2);

INSERT INTO batches (
  id, site_id, label, launch_at, launch_display, sold_out, sort_order, hero_window_days,
  countdown_eyebrow, countdown_heading, countdown_lede,
  celebration_heading, celebration_lede
) VALUES (
  'batch-001', 'site-orbit', 'Batch-001',
  '2026-07-30 22:05:00.000', 'July 30, 2026 · 10:00 PM PKT',
  0, 1, 10,
  'Next drop',
  'Batch-001 opens the kiln doors',
  'A limited firing of cups, bowls, plates, and vessels. The countdown ends at launch — then photos, details, and WhatsApp orders go live.',
  'Batch-001 is live',
  'The drop is open. Explore each piece — summary, dimensions, and the colors fired into the clay.'
);

UPDATE sites SET active_batch_id = 'batch-001' WHERE id = 'site-orbit';

INSERT INTO products (
  id, batch_id, name, price, description, summary, dimensions, alt, sold_out, sort_order
) VALUES (
  'product-orbit-shoes', 'batch-001', 'Orbit Shoes', 8000.00,
  'Everyday setup for a shoes with soft glaze and a comfortable hand feel.',
  'A round shoes with a quiet lip and soft belly — made for morning coffee and slow sips.',
  'H 06 cm × W 06 cm',
  'Handmade ceramic shoes with soft glaze',
  0, 1
);

INSERT INTO product_colors (product_id, name, hex, sort_order) VALUES
  ('product-orbit-shoes', 'Ash mist', '#D3AD19', 1),
  ('product-orbit-shoes', 'Raw clay', '#C7C1AD', 2),
  ('product-orbit-shoes', 'Clay', '#24201F', 3),
  ('product-orbit-shoes', 'Raw clay', '#3C3D37', 4),
  ('product-orbit-shoes', 'Clay', '#202C14', 5);

INSERT INTO product_images (product_id, media_id, url, sort_order) VALUES
  ('product-orbit-shoes', 'media-pod-01', '/images/products/orbit-b1-i1-pod/orbit-pod-b1-01.jpeg', 1),
  ('product-orbit-shoes', 'media-pod-02', '/images/products/orbit-b1-i1-pod/orbit-pod-b1-02.jpeg', 2),
  ('product-orbit-shoes', 'media-pod-03', '/images/products/orbit-b1-i1-pod/orbit-pod-b1-03.jpeg', 3),
  ('product-orbit-shoes', 'media-pod-04', '/images/products/orbit-b1-i1-pod/orbit-pod-b1-04.jpeg', 4);

INSERT INTO journey_videos (
  id, batch_id, title, lede, poster_media_id, video_media_id, poster_image, video_url
) VALUES (
  'jv-1', 'batch-001',
  'Batch-001 shoes journey',
  'From wheel to fire — the making of Batch-001.',
  'media-pod-03', NULL,
  '/images/products/orbit-b1-pod/orbit-pod-b1-03.jpeg',
  'https://www.youtube.com/embed/ScMzIvxBSi4?autoplay=1&rel=0'
);

INSERT INTO journey_images (id, batch_id, media_id, url, alt, sort_order) VALUES
  ('ji-b1-1', 'batch-001', 'media-pod-02',
   '/images/products/orbit-b1-i1-pod/orbit-pod-b1-02.jpeg',
   'Batch-001 — clay on the wheel', 1);

INSERT INTO hero_highlight_images (id, batch_id, media_id, url, alt, sort_order) VALUES
  ('hh-b1-1', 'batch-001', 'media-pod-01', '/images/products/orbit-b1-i1-pod/orbit-pod-b1-01.jpeg', 'Batch-001 — Orbit Shoes', 1),
  ('hh-b1-2', 'batch-001', 'media-pod-02', '/images/products/orbit-b1-i1-pod/orbit-pod-b1-02.jpeg', 'Batch-001 detail', 2),
  ('hh-b1-3', 'batch-001', 'media-pod-03', '/images/products/orbit-b1-i1-pod/orbit-pod-b1-03.jpeg', 'Batch-001 glaze surface', 3),
  ('hh-b1-4', 'batch-001', 'media-pod-04', '/images/products/orbit-b1-i1-pod/orbit-pod-b1-04.jpeg', 'Batch-001 form study', 4);

INSERT INTO page_hero (
  site_id, image, image_media_id, brand, brand_primary, brand_secondary,
  title, lede, cta_label, cta_href
) VALUES (
  'site-orbit', '/images/hero/hero-01.jpg', 'media-hero-01',
  'Orbit Ceramic', 'Orbit', 'Ceramic',
  'Handmade forms for everyday ritual',
  'Stone-fired vessels shaped slowly — cups, bowls, and tableware with a loft-born quiet.',
  'See Batch-002', '/batch'
);

INSERT INTO page_about (
  site_id, eyebrow, heading, image, image_media_id, image_alt, reviews_eyebrow, reviews_heading
) VALUES (
  'site-orbit', 'The maker', 'Mr. Ghulam Jilani',
  '/images/about/about-01.jpg', 'media-about-01',
  'Handmade ceramic vessels arranged in a loft studio',
  'Client voices', 'What collectors say'
);

INSERT INTO about_paragraphs (site_id, body, sort_order) VALUES
  ('site-orbit', 'I am a ceramic artist and clay craftsman with a deep passion for transforming raw clay into timeless works of art. My work is inspired by traditional pottery, antique forms, natural textures, and the quiet beauty found in handmade objects. Every piece I create is shaped by hand, allowing each bowl, vase, platter, mug, and decorative sculpture to carry its own unique character and story.', 1),
  ('site-orbit', 'I specialize in handcrafted ceramic bowls, antique-inspired pottery, decorative clay art, custom ceramic pieces, and artisan home décor. My goal is to create heirloom-quality ceramics that celebrate the beauty of imperfection, the richness of traditional craftsmanship, and the lasting connection between the artist, the material, and the people who use my work.', 2);

INSERT INTO about_reviews (
  id, site_id, quote, name, detail, rating, image, image_media_id, image_alt, gender, is_published, sort_order
) VALUES
  ('review-1', 'site-orbit',
   'The cup feels quiet in the hand — soft glaze, honest weight. It has become my morning ritual piece.',
   'Ayesha R.', 'Lahore · Batch-001', 5, NULL, NULL, NULL, 'woman', 1, 1),
  ('review-2', 'site-orbit',
   'We ordered a custom glaze on the same form. The studio listened carefully and the piece arrived exactly as imagined.',
   'Hassan M.', 'Islamabad · Made to order', 5, NULL, NULL, NULL, 'man', 1, 2),
  ('review-3', 'site-orbit',
   'You can see the maker in every edge. Not factory polish — real clay character. Worth the wait for the drop.',
   'Sara K.', 'Karachi · Batch-001', 4, NULL, NULL, NULL, 'woman', 1, 3),
  ('review-4', 'site-orbit',
   'Gifted a bowl to my sister. She wrote back the same day. Orbit makes objects people keep, not shelf décor.',
   'Bilal A.', 'Lahore · Gift order', 5, NULL, NULL, NULL, 'man', 1, 4);

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
