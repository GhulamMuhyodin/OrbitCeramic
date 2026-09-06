<?php

declare(strict_types=1);

function orbit_new_id(string $prefix = 'id'): string
{
    return $prefix . '-' . bin2hex(random_bytes(8));
}

function orbit_bool(mixed $value): bool
{
    return (bool) (int) $value;
}

function orbit_iso_datetime(?string $mysqlDatetime, string $timezone): ?string
{
    if ($mysqlDatetime === null || $mysqlDatetime === '') {
        return null;
    }

    try {
        $dt = new DateTimeImmutable($mysqlDatetime, new DateTimeZone($timezone));
        return $dt->format(DateTimeInterface::ATOM);
    } catch (Throwable) {
        return $mysqlDatetime;
    }
}

/** snake_case row → camelCase keys (one level). */
function orbit_camel_keys(array $row): array
{
    $out = [];
    foreach ($row as $key => $value) {
        $camel = preg_replace_callback(
            '/_([a-z])/',
            static fn (array $m): string => strtoupper($m[1]),
            (string) $key
        );
        $out[$camel] = $value;
    }
    return $out;
}

function orbit_json_body(): array
{
    static $cached = null;
    static $loaded = false;
    if ($loaded) {
        return is_array($cached) ? $cached : [];
    }
    $loaded = true;
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        $cached = [];
        return [];
    }
    $decoded = json_decode($raw, true);
    $cached = is_array($decoded) ? $decoded : [];
    return $cached;
}
