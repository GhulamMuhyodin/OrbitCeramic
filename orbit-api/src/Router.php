<?php

declare(strict_types=1);

namespace OrbitApi;

final class Router
{
    /** @var array<int, array{method:string, pattern:string, handler:callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $this->routes[] = [
            'method' => strtoupper($method),
            'pattern' => $pattern,
            'handler' => $handler,
        ];
    }

    public function dispatch(string $method, string $path): void
    {
        $method = strtoupper($method);
        $path = '/' . trim($path, '/');
        if ($path !== '/') {
            $path = rtrim($path, '/');
        }

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            $regex = preg_replace('#:([a-zA-Z_][a-zA-Z0-9_]*)#', '(?P<$1>[^/]+)', $route['pattern']);
            $regex = '#^' . $regex . '$#';

            if (!preg_match($regex, $path, $matches)) {
                continue;
            }

            $params = array_filter(
                $matches,
                static fn ($key) => !is_int($key),
                ARRAY_FILTER_USE_KEY
            );

            ($route['handler'])($params);
            return;
        }

        Response::error('Not found', 404);
    }
}
