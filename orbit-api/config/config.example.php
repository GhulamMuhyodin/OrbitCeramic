<?php

/**
 * Copy to config.php and fill in Hostinger / local MySQL values.
 * config.php is gitignored.
 */
return [
    'db' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'name' => 'orbit_ceramic',
        'user' => 'root',
        'pass' => '',
        'charset' => 'utf8mb4',
    ],

    /** Default site row id when ?siteId= is omitted */
    'default_site_id' => 'site-orbit',

    /** Used when formatting batch launchAt ISO strings */
    'timezone' => 'Asia/Karachi',

    /**
     * CORS origins allowed for the Angular app.
     * Use ['*'] only for local dev.
     */
    'cors_origins' => [
        'http://localhost:4200',
        'http://127.0.0.1:4200',
    ],

    /**
     * Shared secret for write endpoints (POST /media).
     * Send header: X-Api-Key: <value>
     * Leave empty to disable write protection (local only).
     */
    'api_key' => 'change-me-orbit-media-key',

    /** Database session lifetime for admin login tokens. */
    'admin_session_hours' => 8,

    /** Public base URL of this API (no trailing slash), e.g. https://api.example.com */
    'public_base_url' => 'http://localhost:8080',

    /** Disk folder for uploads (absolute or relative to project root) */
    'uploads_dir' => __DIR__ . '/../public/uploads',

    /** URL path prefix for uploaded files */
    'uploads_url_path' => '/uploads',

    'max_upload_bytes' => 20 * 1024 * 1024,
];
