<?php

declare(strict_types=1);

namespace OrbitApi;

use PDO;
use PDOException;
use RuntimeException;

final class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(array $config): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $db = $config['db'];
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $db['host'],
            (int) $db['port'],
            $db['name'],
            $db['charset'] ?? 'utf8mb4'
        );

        try {
            self::$pdo = new PDO($dsn, $db['user'], $db['pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
            ]);
        } catch (PDOException $e) {
            // Unknown database → create empty DB then reconnect (local / fresh installs)
            if (self::isUnknownDatabase($e)) {
                self::createDatabase($config);
                self::$pdo = new PDO($dsn, $db['user'], $db['pass'], [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                    PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
                ]);
            } else {
                throw new RuntimeException('Database connection failed: ' . $e->getMessage(), 0, $e);
            }
        }

        return self::$pdo;
    }

    /** Reset cached connection (CLI / tests). */
    public static function reset(): void
    {
        self::$pdo = null;
    }

    private static function isUnknownDatabase(PDOException $e): bool
    {
        $msg = $e->getMessage();
        return str_contains($msg, 'Unknown database')
            || (string) $e->getCode() === '1049'
            || str_contains($msg, '1049');
    }

    private static function createDatabase(array $config): void
    {
        $db = $config['db'];
        $dsn = sprintf(
            'mysql:host=%s;port=%d;charset=%s',
            $db['host'],
            (int) $db['port'],
            $db['charset'] ?? 'utf8mb4'
        );
        $pdo = new PDO($dsn, $db['user'], $db['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        $name = str_replace('`', '``', (string) $db['name']);
        $pdo->exec(
            "CREATE DATABASE IF NOT EXISTS `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        );
    }
}
