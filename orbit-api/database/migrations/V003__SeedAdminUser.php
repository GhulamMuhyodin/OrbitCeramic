<?php

declare(strict_types=1);

/**
 * V003__SeedAdminUser
 *
 * Local/default admin account (idempotent).
 * Username: admin
 * Password: change-me-admin-password
 * Change immediately on shared or hosted environments.
 */

return [
    'type' => 'seed',
    'description' => 'Seed default admin user (idempotent)',
    'irreversible' => false,
    'up' => <<<'SQL'
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
SQL,
    'down' => <<<'SQL'
DELETE FROM admin_sessions WHERE user_id = 'admin-local';
DELETE FROM admin_users WHERE id = 'admin-local' AND username = 'admin';
SQL,
];
