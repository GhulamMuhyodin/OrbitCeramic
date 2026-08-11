<?php

declare(strict_types=1);

/**
 * Orbit Ceramic — Phase 1 API front controller
 * Document root should point here (public/).
 */

header('X-Content-Type-Options: nosniff');

$configPath = dirname(__DIR__) . '/config/config.php';
if (!is_file($configPath)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Missing config/config.php — copy from config.example.php']);
    exit;
}

/** @var array $config */
$config = require $configPath;

require_once dirname(__DIR__) . '/src/helpers.php';
require_once dirname(__DIR__) . '/src/Database.php';
require_once dirname(__DIR__) . '/src/Response.php';
require_once dirname(__DIR__) . '/src/Router.php';
require_once dirname(__DIR__) . '/src/AdminAuth.php';
require_once dirname(__DIR__) . '/src/Repositories/ContentRepository.php';
require_once dirname(__DIR__) . '/src/Repositories/AdminRepository.php';
require_once dirname(__DIR__) . '/src/Controllers/BootstrapController.php';
require_once dirname(__DIR__) . '/src/Controllers/ServerTimeController.php';
require_once dirname(__DIR__) . '/src/Controllers/MediaController.php';
require_once dirname(__DIR__) . '/src/Controllers/LeadsController.php';
require_once dirname(__DIR__) . '/src/Controllers/SiteController.php';
require_once dirname(__DIR__) . '/src/Controllers/ContactController.php';
require_once dirname(__DIR__) . '/src/Controllers/PageController.php';
require_once dirname(__DIR__) . '/src/Controllers/BatchController.php';
require_once dirname(__DIR__) . '/src/Controllers/ProductController.php';
require_once dirname(__DIR__) . '/src/Controllers/AdminController.php';

use OrbitApi\Database;
use OrbitApi\Response;
use OrbitApi\Router;
use OrbitApi\Repositories\ContentRepository;
use OrbitApi\Repositories\AdminRepository;
use OrbitApi\Controllers\BootstrapController;
use OrbitApi\Controllers\ServerTimeController;
use OrbitApi\Controllers\MediaController;
use OrbitApi\Controllers\LeadsController;
use OrbitApi\Controllers\SiteController;
use OrbitApi\Controllers\ContactController;
use OrbitApi\Controllers\PageController;
use OrbitApi\Controllers\BatchController;
use OrbitApi\Controllers\ProductController;
use OrbitApi\Controllers\AdminController;

orbit_apply_cors($config);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
// Strip directory prefix when not using vhost docroot (e.g. /orbit-api/public/...)
$scriptName = dirname($_SERVER['SCRIPT_NAME'] ?? '');
if ($scriptName !== '/' && $scriptName !== '\\' && str_starts_with($path, $scriptName)) {
    $path = substr($path, strlen($scriptName)) ?: '/';
}
$path = '/' . trim($path, '/');
if ($path !== '/') {
    $path = rtrim($path, '/');
}

// Health does not require MySQL
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && ($path === '/api/v1/health' || $path === '/health')) {
    $dbOk = false;
    $dbError = null;
    try {
        Database::pdo($config)->query('SELECT 1');
        $dbOk = true;
    } catch (Throwable $e) {
        $dbError = $e->getMessage();
    }
    Response::json([
        'ok' => true,
        'phase' => 1,
        'db' => $dbOk,
        'dbError' => $dbError,
    ], $dbOk ? 200 : 503);
    exit;
}

try {
    $pdo = Database::pdo($config);
} catch (Throwable $e) {
    Response::error($e->getMessage(), 500);
    exit;
}

$repo = new ContentRepository($pdo, (string) $config['timezone']);
$adminRepo = new AdminRepository($pdo, $repo, (string) $config['timezone']);
$adminAuth = new \OrbitApi\AdminAuth($pdo, $config);
$router = new Router();

$bootstrap = new BootstrapController($repo, $config);
$serverTime = new ServerTimeController($config);
$media = new MediaController($repo, $config);
$leads = new LeadsController($repo, $config);
$site = new SiteController($repo, $config);
$contact = new ContactController($repo, $config);
$page = new PageController($repo, $config);
$batch = new BatchController($repo, $config);
$product = new ProductController($repo, $config);
$admin = new AdminController($adminRepo, $repo, $media, $config, $adminAuth);

// Phase 1 core (public)
$router->add('GET', '/api/v1/bootstrap', static fn () => $bootstrap->handle());
$router->add('GET', '/api/v1/server-time', static fn () => $serverTime->handle());
$router->add('POST', '/api/v1/media', static function () use ($adminAuth, $media) {
    if (!$adminAuth->require()) {
        return;
    }
    $media->upload();
});
$router->add('POST', '/api/v1/leads', static fn () => $leads->create());

// Public content (granular)
$router->add('GET', '/api/v1/site', static fn () => $site->show());
$router->add('GET', '/api/v1/contact', static fn () => $contact->show());
$router->add('GET', '/api/v1/page/hero', static fn () => $page->hero());
$router->add('GET', '/api/v1/page/about', static fn () => $page->about());
$router->add('GET', '/api/v1/page/collections', static fn () => $page->collections());
$router->add('GET', '/api/v1/page/journey', static fn () => $page->journey());
$router->add('GET', '/api/v1/page/batch-shop', static fn () => $page->batchShop());

$router->add('GET', '/api/v1/batches', static fn () => $batch->index());
$router->add('GET', '/api/v1/batches/active', static fn () => $batch->active());
$router->add('GET', '/api/v1/batches/:id', static fn (array $p) => $batch->show($p));
$router->add('GET', '/api/v1/batches/:id/journey', static fn (array $p) => $batch->journey($p));
$router->add('GET', '/api/v1/batches/:id/hero-highlights', static fn (array $p) => $batch->heroHighlights($p));

$router->add('GET', '/api/v1/products', static fn () => $product->index());
$router->add('GET', '/api/v1/products/:id', static fn (array $p) => $product->show($p));

$router->add('GET', '/api/v1/health', static function () {
    Response::json(['ok' => true, 'phase' => 1]);
});

// -------------------------------------------------------------------------
// Admin CMS (X-Api-Key / Bearer) — insert & manage content from admin UI
// -------------------------------------------------------------------------
$router->add('POST', '/api/v1/admin/auth/login', static fn () => $admin->login());
$router->add('GET', '/api/v1/admin/auth/me', static fn () => $admin->me());
$router->add('POST', '/api/v1/admin/auth/logout', static fn () => $admin->logout());
$router->add('POST', '/api/v1/admin/auth/password', static fn () => $admin->changePassword());

$router->add('GET', '/api/v1/admin/site', static fn () => $admin->getSite());
$router->add('PUT', '/api/v1/admin/site', static fn () => $admin->putSite());
$router->add('PUT', '/api/v1/admin/sites/active-batch', static fn () => $admin->putActiveBatch());

$router->add('GET', '/api/v1/admin/contact', static fn () => $admin->getContact());
$router->add('PUT', '/api/v1/admin/contact', static fn () => $admin->putContact());

$router->add('GET', '/api/v1/admin/batches', static fn () => $admin->listBatches());
$router->add('POST', '/api/v1/admin/batches', static fn () => $admin->createBatch());
$router->add('GET', '/api/v1/admin/batches/:id', static fn (array $p) => $admin->getBatch($p));
$router->add('PUT', '/api/v1/admin/batches/:id', static fn (array $p) => $admin->updateBatch($p));
$router->add('PUT', '/api/v1/admin/batches/:id/transaction', static fn (array $p) => $admin->saveBatchTransaction($p));
$router->add('DELETE', '/api/v1/admin/batches/:id', static fn (array $p) => $admin->deleteBatch($p));
$router->add('PUT', '/api/v1/admin/batches/:id/journey', static fn (array $p) => $admin->putJourney($p));
$router->add('PUT', '/api/v1/admin/batches/:id/hero-highlights', static fn (array $p) => $admin->putHighlights($p));

$router->add('GET', '/api/v1/admin/products', static fn () => $admin->listProducts());
$router->add('POST', '/api/v1/admin/products', static fn () => $admin->createProduct());
$router->add('GET', '/api/v1/admin/products/:id', static fn (array $p) => $admin->getProduct($p));
$router->add('PUT', '/api/v1/admin/products/:id', static fn (array $p) => $admin->updateProduct($p));
$router->add('DELETE', '/api/v1/admin/products/:id', static fn (array $p) => $admin->deleteProduct($p));

$router->add('GET', '/api/v1/admin/page/:section', static fn (array $p) => $admin->getPage($p));
$router->add('PUT', '/api/v1/admin/page/:section', static fn (array $p) => $admin->putPage($p));

$router->add('GET', '/api/v1/admin/reviews', static fn () => $admin->listReviews());
$router->add('POST', '/api/v1/admin/reviews', static fn () => $admin->createReview());
$router->add('PUT', '/api/v1/admin/reviews/:id', static fn (array $p) => $admin->updateReview($p));
$router->add('DELETE', '/api/v1/admin/reviews/:id', static fn (array $p) => $admin->deleteReview($p));

$router->add('GET', '/api/v1/admin/leads', static fn () => $admin->listLeads());
$router->add('POST', '/api/v1/admin/media', static fn () => $admin->uploadMedia());

$router->dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', $path);

function orbit_apply_cors(array $config): void
{
    $origins = $config['cors_origins'] ?? [];
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if (in_array('*', $origins, true)) {
        header('Access-Control-Allow-Origin: *');
    } elseif ($origin !== '' && in_array($origin, $origins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Api-Key, Authorization');
    header('Access-Control-Max-Age: 86400');
}
