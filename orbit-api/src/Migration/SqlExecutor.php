<?php

declare(strict_types=1);

namespace OrbitApi\Migration;

use PDO;

/**
 * Executes multi-statement SQL scripts against MySQL via PDO.
 */
final class SqlExecutor
{
    public function __construct(private PDO $pdo)
    {
    }

    public function execute(string $sql): void
    {
        $sql = trim($sql);
        if ($sql === '' || $sql === '--') {
            return;
        }

        foreach ($this->splitStatements($sql) as $statement) {
            $statement = trim($statement);
            if ($statement === '' || $this->isCommentOnly($statement)) {
                continue;
            }
            try {
                $this->pdo->exec($statement);
            } catch (\PDOException $e) {
                if ($this->isIgnorableSchemaError($e)) {
                    continue;
                }
                throw $e;
            }
        }
    }

    private function isIgnorableSchemaError(\PDOException $e): bool
    {
        $code = (int) ($e->errorInfo[1] ?? 0);
        // 1060 duplicate column, 1061 duplicate key name, 1091 can't drop, 1826 duplicate FK
        return in_array($code, [1060, 1061, 1091, 1826], true);
    }

    /**
     * Split SQL on semicolons while respecting quotes and simple comments.
     *
     * @return list<string>
     */
    public function splitStatements(string $sql): array
    {
        $statements = [];
        $buffer = '';
        $len = strlen($sql);
        $inSingle = false;
        $inDouble = false;
        $inBacktick = false;

        for ($i = 0; $i < $len; $i++) {
            $ch = $sql[$i];
            $next = $i + 1 < $len ? $sql[$i + 1] : '';

            // Line comment
            if (!$inSingle && !$inDouble && !$inBacktick && $ch === '-' && $next === '-') {
                while ($i < $len && $sql[$i] !== "\n") {
                    $buffer .= $sql[$i];
                    $i++;
                }
                if ($i < $len) {
                    $buffer .= "\n";
                }
                continue;
            }

            // Block comment
            if (!$inSingle && !$inDouble && !$inBacktick && $ch === '/' && $next === '*') {
                $buffer .= $ch . $next;
                $i += 2;
                while ($i < $len - 1 && !($sql[$i] === '*' && $sql[$i + 1] === '/')) {
                    $buffer .= $sql[$i];
                    $i++;
                }
                if ($i < $len - 1) {
                    $buffer .= '*/';
                    $i++;
                }
                continue;
            }

            if ($ch === "'" && !$inDouble && !$inBacktick) {
                if ($inSingle && $next === "'") {
                    $buffer .= "''";
                    $i++;
                    continue;
                }
                $inSingle = !$inSingle;
                $buffer .= $ch;
                continue;
            }

            if ($ch === '"' && !$inSingle && !$inBacktick) {
                $inDouble = !$inDouble;
                $buffer .= $ch;
                continue;
            }

            if ($ch === '`' && !$inSingle && !$inDouble) {
                $inBacktick = !$inBacktick;
                $buffer .= $ch;
                continue;
            }

            if ($ch === ';' && !$inSingle && !$inDouble && !$inBacktick) {
                $statements[] = $buffer;
                $buffer = '';
                continue;
            }

            $buffer .= $ch;
        }

        if (trim($buffer) !== '') {
            $statements[] = $buffer;
        }

        return $statements;
    }

    private function isCommentOnly(string $statement): bool
    {
        $stripped = preg_replace('/\/\*.*?\*\//s', '', $statement) ?? $statement;
        $lines = preg_split('/\R/', $stripped) ?: [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '--')) {
                continue;
            }
            return false;
        }
        return true;
    }

    public function tableExists(string $table): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT 1 FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1'
        );
        $stmt->execute([$table]);
        return (bool) $stmt->fetchColumn();
    }
}
