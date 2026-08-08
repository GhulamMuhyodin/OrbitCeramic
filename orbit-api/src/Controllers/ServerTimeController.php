<?php

declare(strict_types=1);

namespace OrbitApi\Controllers;

use OrbitApi\Response;

final class ServerTimeController
{
    public function __construct(private array $config)
    {
    }

    public function handle(): void
    {
        $tz = new \DateTimeZone($this->config['timezone'] ?? 'Asia/Karachi');
        $now = new \DateTimeImmutable('now', $tz);
        Response::json([
            'serverTime' => $now->format(\DateTimeInterface::ATOM),
            'timezone' => $tz->getName(),
            'unix' => $now->getTimestamp(),
        ]);
    }
}
