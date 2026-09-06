<?php

declare(strict_types=1);

namespace OrbitApi\Migration;

use PDO;
use RuntimeException;
use Throwable;

/**
 * Versioned migration + seeder runner for Orbit Ceramic (MySQL).
 *
 * Features: history table, checksum validation, GET_LOCK concurrency,
 * transactions for DML when possible, UP/DOWN rollback, legacy baseline.
 */
final class MigrationRunner
{
    private const LOCK_NAME = 'orbit_ceramic_migrations';
    private const LOCK_TIMEOUT_SEC = 60;

    /** @var callable(string):void */
    private $logger;

    public function __construct(
        private PDO $pdo,
        private string $migrationsDir,
        ?callable $logger = null,
    ) {
        $this->logger = $logger ?? static function (string $message): void {
            fwrite(STDOUT, $message . PHP_EOL);
        };
    }

    public function status(): int
    {
        $sql = new SqlExecutor($this->pdo);
        $history = new MigrationHistory($this->pdo, $sql);
        $history->ensureTable();

        $discovered = $this->discover();
        $applied = $history->appliedSuccessful();
        $this->validateChecksums($discovered, $applied);

        $current = $history->currentVersion() ?? '(none)';
        $this->log('');
        $this->log('Database migration status');
        $this->log('-------------------------');
        $this->log('Current version: ' . $current);
        $this->log('');

        $pending = 0;
        foreach ($discovered as $m) {
            $version = $m['version'];
            if (isset($applied[$version])) {
                $mark = '✓ applied';
                $extra = '  ' . $applied[$version]['applied_at']
                    . '  (' . $applied[$version]['execution_time_ms'] . ' ms)'
                    . '  [' . $applied[$version]['type'] . ']';
            } else {
                $mark = '· pending';
                $extra = '  [' . $m['type'] . ']';
                $pending++;
            }
            $this->log(sprintf('  %-8s %-40s %s%s', $version, $m['name'], $mark, $extra));
        }

        $this->log('');
        if ($pending === 0) {
            $this->log('No pending migrations. Database is up to date.');
        } else {
            $this->log($pending . ' pending migration(s). Run: php bin/database migrate');
        }
        $this->log('');
        return 0;
    }

    public function migrate(): int
    {
        return $this->withLock(function () {
            $sql = new SqlExecutor($this->pdo);
            $history = new MigrationHistory($this->pdo, $sql);
            $history->ensureTable();

            $this->baselineLegacyIfNeeded($sql, $history);

            $discovered = $this->discover();
            $applied = $history->appliedSuccessful();
            $this->validateChecksums($discovered, $applied);

            $pending = array_values(array_filter(
                $discovered,
                static fn (array $m) => !isset($applied[$m['version']])
            ));

            if ($pending === []) {
                $this->log('No pending migrations. Database is up to date.');
                return 0;
            }

            $this->log('Applying ' . count($pending) . ' migration(s)...');
            foreach ($pending as $migration) {
                $this->applyUp($sql, $history, $migration);
            }

            $this->log('Done. Current version: ' . ($history->currentVersion() ?? '(none)'));
            return 0;
        });
    }

    public function rollbackLast(bool $force = false): int
    {
        return $this->rollbackTo(null, $force);
    }

    /**
     * Roll back migrations newer than $targetVersion.
     * If $targetVersion is null, roll back only the latest applied migration.
     */
    public function rollbackTo(?string $targetVersion, bool $force = false): int
    {
        return $this->withLock(function () use ($targetVersion, $force) {
            $sql = new SqlExecutor($this->pdo);
            $history = new MigrationHistory($this->pdo, $sql);
            $history->ensureTable();

            $discovered = $this->discoverByVersion();
            $applied = $history->appliedSuccessful();
            $this->validateChecksums(array_values($discovered), $applied);

            $versions = array_keys($applied);
            if ($versions === []) {
                $this->log('Nothing to roll back.');
                return 0;
            }

            if ($targetVersion === null) {
                $toRollback = [end($versions)];
            } else {
                if (!preg_match('/^V\d+$/', $targetVersion)) {
                    throw new RuntimeException('Invalid target version. Expected format like V005.');
                }
                if (!isset($applied[$targetVersion]) && $targetVersion !== 'V000') {
                    // Allow rolling back everything if targeting before first
                    $first = $versions[0];
                    if ($this->compareVersion($targetVersion, $first) >= 0 && !isset($applied[$targetVersion])) {
                        throw new RuntimeException("Target version {$targetVersion} is not applied.");
                    }
                }
                $toRollback = [];
                foreach (array_reverse($versions) as $v) {
                    if ($this->compareVersion($v, $targetVersion) > 0) {
                        $toRollback[] = $v;
                    }
                }
            }

            if ($toRollback === []) {
                $this->log('Nothing to roll back.');
                return 0;
            }

            foreach ($toRollback as $version) {
                if (!isset($discovered[$version])) {
                    throw new RuntimeException(
                        "Cannot roll back {$version}: migration file is missing from disk."
                    );
                }
                $this->applyDown($sql, $history, $discovered[$version], $force);
            }

            $this->log('Done. Current version: ' . ($history->currentVersion() ?? '(none)'));
            return 0;
        });
    }

    /**
     * Mark existing schema as applied without executing (production-safe bootstrap).
     */
    public function baseline(?string $upToVersion = null): int
    {
        return $this->withLock(function () use ($upToVersion) {
            $sql = new SqlExecutor($this->pdo);
            $history = new MigrationHistory($this->pdo, $sql);
            $history->ensureTable();

            $discovered = $this->discover();
            $applied = $history->appliedSuccessful();

            $count = 0;
            foreach ($discovered as $m) {
                if ($upToVersion !== null && $this->compareVersion($m['version'], $upToVersion) > 0) {
                    break;
                }
                if (isset($applied[$m['version']])) {
                    continue;
                }
                $history->recordSuccess(
                    $m['version'],
                    $m['name'],
                    $m['type'],
                    $m['checksum'],
                    0,
                );
                $this->log("Baselined {$m['version']}__{$m['name']} (checksum recorded, SQL not executed)");
                $count++;
            }

            if ($count === 0) {
                $this->log('Nothing to baseline.');
            } else {
                $this->log("Baselined {$count} migration(s). Current version: "
                    . ($history->currentVersion() ?? '(none)'));
            }
            return 0;
        });
    }

    public function create(string $name, string $type = 'schema'): int
    {
        $name = preg_replace('/[^A-Za-z0-9_]+/', '', str_replace([' ', '-'], '_', $name)) ?? '';
        $name = trim($name, '_');
        if ($name === '') {
            throw new RuntimeException('Migration name is required.');
        }
        $name = ucfirst($name);

        $type = strtolower($type);
        if (!in_array($type, ['schema', 'seed', 'data'], true)) {
            throw new RuntimeException('Type must be schema, seed, or data.');
        }

        $next = $this->nextVersionNumber();
        $version = sprintf('V%03d', $next);
        $filename = "{$version}__{$name}.php";
        $path = rtrim($this->migrationsDir, '/\\') . DIRECTORY_SEPARATOR . $filename;

        if (is_file($path)) {
            throw new RuntimeException("File already exists: {$filename}");
        }

        $template = <<<PHP
<?php

declare(strict_types=1);

/**
 * {$version}__{$name}
 *
 * Type: {$type}
 * Never edit this file after it has been applied in any shared environment.
 * Create a new migration instead.
 */

return [
    'type' => '{$type}',
    'description' => '{$name}',
    'irreversible' => false,
    'up' => <<<'SQL'
-- Write UP SQL here
SQL,
    'down' => <<<'SQL'
-- Write DOWN SQL here (rollback)
SQL,
];

PHP;

        if (file_put_contents($path, $template) === false) {
            throw new RuntimeException("Could not write {$path}");
        }

        $this->log("Created {$filename}");
        $this->log("Edit: database/migrations/{$filename}");
        return 0;
    }

    /**
     * @return list<array{
     *   version:string,name:string,type:string,description:string,
     *   irreversible:bool,up:string,down:string,checksum:string,path:string
     * }>
     */
    private function discover(): array
    {
        $byVersion = $this->discoverByVersion();
        ksort($byVersion, SORT_STRING);
        return array_values($byVersion);
    }

    /**
     * @return array<string, array{
     *   version:string,name:string,type:string,description:string,
     *   irreversible:bool,up:string,down:string,checksum:string,path:string
     * }>
     */
    private function discoverByVersion(): array
    {
        if (!is_dir($this->migrationsDir)) {
            throw new RuntimeException('Migrations directory not found: ' . $this->migrationsDir);
        }

        $files = glob($this->migrationsDir . DIRECTORY_SEPARATOR . 'V*__*.php') ?: [];
        $out = [];

        foreach ($files as $path) {
            $base = basename($path);
            if (!preg_match('/^(V\d+)__([A-Za-z0-9_]+)\.php$/', $base, $m)) {
                throw new RuntimeException("Invalid migration filename: {$base}");
            }
            /** @var array<string,mixed> $def */
            $def = require $path;
            if (!is_array($def) || !isset($def['up'], $def['down'])) {
                throw new RuntimeException("Migration {$base} must return ['up'=>..., 'down'=>...]");
            }

            $type = (string) ($def['type'] ?? 'schema');
            if (!in_array($type, ['schema', 'seed', 'data'], true)) {
                throw new RuntimeException("Migration {$base} has invalid type.");
            }

            $up = (string) $def['up'];
            $down = (string) $def['down'];
            $checksum = $this->checksum($type, $up, $down);

            $version = $m[1];
            if (isset($out[$version])) {
                throw new RuntimeException("Duplicate migration version: {$version}");
            }

            $out[$version] = [
                'version' => $version,
                'name' => $m[2],
                'type' => $type,
                'description' => (string) ($def['description'] ?? $m[2]),
                'irreversible' => (bool) ($def['irreversible'] ?? false),
                'up' => $up,
                'down' => $down,
                'checksum' => $checksum,
                'path' => $path,
            ];
        }

        return $out;
    }

    /**
     * @param list<array{version:string,checksum:string,name:string}> $discovered
     * @param array<string, array{checksum:string}> $applied
     */
    private function validateChecksums(array $discovered, array $applied): void
    {
        foreach ($discovered as $m) {
            $v = $m['version'];
            if (!isset($applied[$v])) {
                continue;
            }
            if (!hash_equals($applied[$v]['checksum'], $m['checksum'])) {
                throw new RuntimeException(
                    "Applied migration has been modified: {$v}__{$m['name']}\n"
                    . "Checksum mismatch.\n"
                    . "Create a new migration instead of modifying {$v}."
                );
            }
        }
    }

    /**
     * @param array{
     *   version:string,name:string,type:string,up:string,checksum:string
     * } $migration
     */
    private function applyUp(SqlExecutor $sql, MigrationHistory $history, array $migration): void
    {
        $label = "{$migration['version']}__{$migration['name']}";
        $this->log("→ UP {$label}");
        $started = hrtime(true);

        $useTx = $migration['type'] !== 'schema';
        try {
            if ($useTx) {
                $this->pdo->beginTransaction();
            }
            $sql->execute($migration['up']);
            if ($migration['version'] === 'V001') {
                $this->ensureSitesActiveBatchFk();
            }
            if ($useTx && $this->pdo->inTransaction()) {
                $this->pdo->commit();
            }
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            // Do NOT record success — migration stays pending for retry
            throw new RuntimeException(
                "Migration failed: {$label}\n" . $e->getMessage(),
                0,
                $e
            );
        }

        $ms = (int) ((hrtime(true) - $started) / 1_000_000);
        $history->recordSuccess(
            $migration['version'],
            $migration['name'],
            $migration['type'],
            $migration['checksum'],
            $ms,
        );
        $this->log("  ✓ {$label} ({$ms} ms)");
    }

    /**
     * @param array{
     *   version:string,name:string,type:string,down:string,irreversible:bool
     * } $migration
     */
    private function applyDown(
        SqlExecutor $sql,
        MigrationHistory $history,
        array $migration,
        bool $force,
    ): void {
        $label = "{$migration['version']}__{$migration['name']}";
        if ($migration['irreversible'] && !$force) {
            throw new RuntimeException(
                "Migration {$label} is marked irreversible (would destroy data).\n"
                . 'Re-run with --force only if you accept data loss.'
            );
        }

        $this->log("← DOWN {$label}");
        $useTx = $migration['type'] !== 'schema';
        try {
            if ($useTx) {
                $this->pdo->beginTransaction();
            }
            $sql->execute($migration['down']);
            if ($useTx && $this->pdo->inTransaction()) {
                $this->pdo->commit();
            }
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw new RuntimeException(
                "Rollback failed: {$label}\n" . $e->getMessage(),
                0,
                $e
            );
        }

        $history->remove($migration['version']);
        $this->log("  ✓ rolled back {$label}");
    }

    private function ensureSitesActiveBatchFk(): void
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
             WHERE CONSTRAINT_SCHEMA = DATABASE()
               AND TABLE_NAME = ?
               AND CONSTRAINT_NAME = ?
               AND CONSTRAINT_TYPE = ?'
        );
        $stmt->execute(['sites', 'fk_p1_sites_active_batch', 'FOREIGN KEY']);
        $exists = (int) $stmt->fetchColumn() > 0;
        $stmt->closeCursor();
        if ($exists) {
            return;
        }
        $this->pdo->exec(
            'ALTER TABLE sites
             ADD CONSTRAINT fk_p1_sites_active_batch
               FOREIGN KEY (active_batch_id) REFERENCES batches (id)
               ON UPDATE CASCADE ON DELETE SET NULL'
        );
    }

    private function baselineLegacyIfNeeded(SqlExecutor $sql, MigrationHistory $history): void
    {
        if (!$history->isEmpty()) {
            return;
        }
        if (!$sql->tableExists('sites')) {
            return;
        }

        $this->log('Existing database detected (no migration history).');

        $discovered = $this->discoverByVersion();
        $schemaComplete = $sql->tableExists('batches')
            && $sql->tableExists('media')
            && $sql->tableExists('page_about')
            && $sql->tableExists('page_reviews')
            && $sql->tableExists('admin_users');

        // Only baseline V001 when the full Phase 1 schema is already present.
        // Partial installs leave V001 pending so IF NOT EXISTS can create gaps.
        if ($schemaComplete && isset($discovered['V001'])) {
            $m = $discovered['V001'];
            $history->recordSuccess($m['version'], $m['name'], $m['type'], $m['checksum'], 0);
            $this->log("  ✓ baselined V001__{$m['name']} (complete schema already present)");
        } else {
            $this->log('  · schema incomplete — V001 will run with CREATE TABLE IF NOT EXISTS');
        }

        if (isset($discovered['V002']) && $sql->tableExists('leads')) {
            $m = $discovered['V002'];
            $history->recordSuccess($m['version'], $m['name'], $m['type'], $m['checksum'], 0);
            $this->log("  ✓ baselined V002__{$m['name']}");
        }

        $this->log('Continuing with remaining pending migrations...');
    }

    private function nextVersionNumber(): int
    {
        $max = 0;
        foreach (array_keys($this->discoverByVersion()) as $version) {
            $n = (int) substr($version, 1);
            if ($n > $max) {
                $max = $n;
            }
        }
        return $max + 1;
    }

    private function compareVersion(string $a, string $b): int
    {
        return ((int) substr($a, 1)) <=> ((int) substr($b, 1));
    }

    private function checksum(string $type, string $up, string $down): string
    {
        $normalized = $type . "\n"
            . str_replace(["\r\n", "\r"], "\n", trim($up)) . "\n"
            . str_replace(["\r\n", "\r"], "\n", trim($down));
        return hash('sha256', $normalized);
    }

    /**
     * @param callable():int $fn
     */
    private function withLock(callable $fn): int
    {
        $stmt = $this->pdo->prepare('SELECT GET_LOCK(?, ?)');
        $stmt->execute([self::LOCK_NAME, self::LOCK_TIMEOUT_SEC]);
        $got = (int) $stmt->fetchColumn();
        if ($got !== 1) {
            throw new RuntimeException(
                'Could not acquire migration lock. Another instance may be migrating.'
            );
        }

        try {
            return $fn();
        } finally {
            $release = $this->pdo->prepare('SELECT RELEASE_LOCK(?)');
            $release->execute([self::LOCK_NAME]);
        }
    }

    private function log(string $message): void
    {
        ($this->logger)($message);
    }
}
