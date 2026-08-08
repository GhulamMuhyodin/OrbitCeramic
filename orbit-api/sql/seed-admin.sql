-- Local administrator seed. Run after schema-phase1.sql.
-- Username: admin
-- Password: change-me-admin-password
-- Change this password immediately for any shared or hosted environment.

INSERT INTO admin_users (id, username, password_hash, display_name, role, is_active)
VALUES (
  'admin-local',
  'admin',
  '$2y$10$XZqzuxCT2ftdBSrsR8kVTu9Z.8ZF496zWp1AUrO87mLq6okJOfAzO',
  'Orbit Administrator',
  'admin',
  1
)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  role = VALUES(role),
  is_active = VALUES(is_active);