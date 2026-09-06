<?php

declare(strict_types=1);

namespace OrbitApi\Migration;

use PDO;

final class MigrationHistory
{
    public const TABLE = 'database_migrations';

    public function __construct(
        private PDO $pdo,
        private SqlExecutor $sql,
    ) {
    }

    public function ensureTable(): void
    {
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS `' . self::TABLE . '` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `version` VARCHAR(32) NOT NULL,
                `name` VARCHAR(255) NOT NULL,
                `type` ENUM(\'schema\',\'seed\',\'data\') NOT NULL DEFAULT \'schema\',
                `checksum` CHAR(64) NOT NULL,
                `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `execution_time_ms` INT UNSIGNED NOT NULL DEFAULT 0,
                `success` TINYINT(1) NOT NULL DEFAULT 1,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uq_database_migrations_version` (`version`),
                KEY `idx_database_migrations_applied` (`applied_at`)
             ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    public function isEmpty(): bool
    {
        $count = (int) $this->pdo->query(
            'SELECT COUNT(*) FROM `' . self::TABLE . '` WHERE success = 1'
        )->fetchColumn();
        return $count === 0;
    }

    /**
     * @return array<string, array{
     *   version:string,name:string,type:string,checksum:string,
     *   applied_at:string,execution_time_ms:int,success:int
     * }>
     */
    public function appliedSuccessful(): array
    {
        $stmt = $this->pdo->query(
            'SELECT version, name, type, checksum, applied_at, execution_time_ms, success
             FROM `' . self::TABLE . '`
             WHERE success = 1
             ORDER BY version ASC'
        );
        $rows = [];
        foreach ($stmt->fetchAll() as $row) {
            $rows[(string) $row['version']] = [
                'version' => (string) $row['version'],
                'name' => (string) $row['name'],
                'type' => (string) $row['type'],
                'checksum' => (string) $row['checksum'],
                'applied_at' => (string) $row['applied_at'],
                'execution_time_ms' => (int) $row['execution_time_ms'],
                'success' => (int) $row['success'],
            ];
        }
        return $rows;
    }

    public function recordSuccess(
        string $version,
        string $name,
        string $type,
        string $checksum,
        int $executionTimeMs,
    ): void {
        $stmt = $this->pdo->prepare(
            'INSERT INTO `' . self::TABLE . '`
             (version, name, type, checksum, execution_time_ms, success)
             VALUES (:version, :name, :type, :checksum, :ms, 1)
             ON DUPLICATE KEY UPDATE
               name = VALUES(name),
               type = VALUES(type),
               checksum = VALUES(checksum),
               applied_at = CURRENT_TIMESTAMP,
               execution_time_ms = VALUES(execution_time_ms),
               success = 1'
        );
        $stmt->execute([
            ':version' => $version,
            ':name' => $name,
            ':type' => $type,
            ':checksum' => $checksum,
            ':ms' => $executionTimeMs,
        ]);
    }

    public function remove(string $version): void
    {
        $stmt = $this->pdo->prepare(
            'DELETE FROM `' . self::TABLE . '` WHERE version = ?'
        );
        $stmt->execute([$version]);
    }

    public function currentVersion(): ?string
    {
        $applied = $this->appliedSuccessful();
        if ($applied === []) {
            return null;
        }
        return array_key_last($applied);
    }
}
