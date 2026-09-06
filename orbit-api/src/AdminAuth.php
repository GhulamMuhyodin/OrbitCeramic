<?php

declare(strict_types=1);

namespace OrbitApi;

use PDO;

final class AdminAuth
{
    public function __construct(
        private PDO $pdo,
        private array $config,
    ) {
    }

    public function login(string $username, string $password): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, username, password_hash, display_name, role
             FROM admin_users
             WHERE username = :username AND is_active = 1
             LIMIT 1'
        );
        $stmt->execute([':username' => trim($username)]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, (string) $user['password_hash'])) {
            return null;
        }

        $rawToken = bin2hex(random_bytes(32));
        $ttlHours = max(1, (int) ($this->config['admin_session_hours'] ?? 8));
        $expiresAt = (new \DateTimeImmutable('now', new \DateTimeZone((string) ($this->config['timezone'] ?? 'UTC'))))
            ->modify('+' . $ttlHours . ' hours')
            ->format('Y-m-d H:i:s');

        $insert = $this->pdo->prepare(
            'INSERT INTO admin_sessions
             (id, user_id, token_hash, expires_at, ip_address, user_agent)
             VALUES (:id, :user, :hash, :expires, :ip, :agent)'
        );
        $insert->execute([
            ':id' => 'sess-' . bin2hex(random_bytes(12)),
            ':user' => $user['id'],
            ':hash' => hash('sha256', $rawToken),
            ':expires' => $expiresAt,
            ':ip' => substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64),
            ':agent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 512),
        ]);

        return [
            'token' => $rawToken,
            'tokenType' => 'Bearer',
            'expiresAt' => $expiresAt,
            'user' => [
                'id' => $user['id'],
                'username' => $user['username'],
                'displayName' => $user['display_name'],
                'role' => $user['role'],
            ],
        ];
    }

    public function currentUser(): ?array
    {
        $token = $this->tokenFromRequest();
        if ($token === '') {
            return null;
        }

        $stmt = $this->pdo->prepare(
            'SELECT u.id, u.username, u.display_name, u.role
             FROM admin_sessions s
             INNER JOIN admin_users u ON u.id = s.user_id
             WHERE s.token_hash = :hash
               AND s.expires_at > CURRENT_TIMESTAMP
               AND u.is_active = 1
             LIMIT 1'
        );
        $stmt->execute([':hash' => hash('sha256', $token)]);
        $user = $stmt->fetch();
        if (!$user) {
            return null;
        }

        $this->pdo->prepare('UPDATE admin_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?')
            ->execute([hash('sha256', $token)]);
        return [
            'id' => $user['id'],
            'username' => $user['username'],
            'displayName' => $user['display_name'],
            'role' => $user['role'],
        ];
    }

    public function require(): bool
    {
        if ($this->currentUser()) {
            return true;
        }
        Response::error('Unauthorized — please log in', 401);
        return false;
    }

    public function logout(): void
    {
        $token = $this->tokenFromRequest();
        if ($token !== '') {
            $this->pdo->prepare('DELETE FROM admin_sessions WHERE token_hash = ?')
                ->execute([hash('sha256', $token)]);
        }
        Response::json(['loggedOut' => true]);
    }

    public function changePassword(string $currentPassword, string $newPassword): void
    {
        if (strlen($newPassword) < 8) {
            throw new \RuntimeException('New password must be at least 8 characters', 422);
        }
        if ($currentPassword === $newPassword) {
            throw new \RuntimeException('New password must be different from the current password', 422);
        }

        $token = $this->tokenFromRequest();
        $stmt = $this->pdo->prepare(
            'SELECT u.id, u.password_hash
             FROM admin_sessions s
             INNER JOIN admin_users u ON u.id = s.user_id
             WHERE s.token_hash = :hash
               AND s.expires_at > CURRENT_TIMESTAMP
               AND u.is_active = 1
             LIMIT 1'
        );
        $stmt->execute([':hash' => hash('sha256', $token)]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($currentPassword, (string) $user['password_hash'])) {
            throw new \RuntimeException('Current password is incorrect', 422);
        }

        $this->pdo->prepare('UPDATE admin_users SET password_hash = :hash WHERE id = :id')
            ->execute([
                ':hash' => password_hash($newPassword, PASSWORD_DEFAULT),
                ':id' => $user['id'],
            ]);

        $this->pdo->prepare('DELETE FROM admin_sessions WHERE user_id = :id AND token_hash <> :token')
            ->execute([
                ':id' => $user['id'],
                ':token' => hash('sha256', $token),
            ]);
    }

    /** Legacy protection for the standalone public media upload endpoint. */
    public static function requireApiKey(array $config): bool
    {
        $expected = (string) ($config['api_key'] ?? '');
        if ($expected === '') {
            return true;
        }
        $provided = (string) ($_SERVER['HTTP_X_API_KEY'] ?? '');
        if ($provided === '' && !empty($_SERVER['HTTP_AUTHORIZATION'])) {
            if (preg_match('/^Bearer\s+(.+)$/i', (string) $_SERVER['HTTP_AUTHORIZATION'], $match)) {
                $provided = trim($match[1]);
            }
        }
        if (!hash_equals($expected, $provided)) {
            Response::error('Unauthorized', 401);
            return false;
        }
        return true;
    }

    private function tokenFromRequest(): string
    {
        $auth = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
        if (preg_match('/^Bearer\s+(.+)$/i', $auth, $match)) {
            return trim($match[1]);
        }
        return '';
    }
}
