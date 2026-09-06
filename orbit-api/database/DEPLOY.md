# Deploy: API + database migrations (GitHub Actions)

The workflow [`.github/workflows/main.yml`](../../.github/workflows/main.yml) on push to `prod` / `uat`:

```text
1. Build Angular
2. Write orbit-api/config/config.php from secrets
3. php bin/database migrate   ← against Hostinger MySQL (from the runner)
4. FTP deploy orbit-api → {public_html}/php  (keeps uploads/)
5. FTP deploy Angular → {public_html}/
```

## GitHub Environments

Create two Environments in the repo settings:

| Environment | Used by branch |
|-------------|----------------|
| `production` | `prod` |
| `uat` | `uat` |

Add the secrets below on **each** environment (values can differ per env).

## Required secrets

### FTP

| Secret | Example |
|--------|---------|
| `FTP_SERVER` | `185.224.137.128` |
| `FTP_USERNAME` | Hostinger FTP user |
| `FTP_PASSWORD` | Hostinger FTP password |

### Site paths

| Secret | Example |
|--------|---------|
| `ORBIT_SITE_DOMAIN` | `https://your-site.hostingersite.com` |
| `ORBIT_FTP_REMOTE_DIR` | `domains/your-site.hostingersite.com` |

### Hostinger folder layout

```text
ORBIT_FTP_REMOTE_DIR/
└── public_html/          ← Angular (index.html, assets)
    └── php/              ← orbit-api
```

File Manager example:

```text
domains/mediumvioletred-trout-528447.hostingersite.com/public_html/php
```

Set the secret to the **domain folder only** (no `public_html`, no `php`):

```text
ORBIT_FTP_REMOTE_DIR=domains/mediumvioletred-trout-528447.hostingersite.com
```

Deploy scripts then use:

- Angular → `ORBIT_FTP_REMOTE_DIR/public_html`
- API → `ORBIT_FTP_REMOTE_DIR/public_html/php`

If your FTP user already logs into `public_html`, set:

```text
ORBIT_FTP_REMOTE_DIR=.
```

(scripts detect that `.` is already `public_html` and still upload API to `./php`).

If omitted, the workflow defaults to the Hostinger domain folder above and auto-probes `…/public_html`.

### Database (Remote MySQL must be allowed for GitHub Actions)

In hPanel → **Databases** → **Remote MySQL**: allow access (or temporarily `%` / CI IPs).

| Secret | Example |
|--------|---------|
| `ORBIT_DB_HOST` | `auth-db….hostinger.com` (or the host shown in hPanel) |
| `ORBIT_DB_PORT` | `3306` |
| `ORBIT_DB_NAME` | `u….orbit_ceramic` |
| `ORBIT_DB_USER` | MySQL user |
| `ORBIT_DB_PASS` | MySQL password |

### API config

| Secret | Example |
|--------|---------|
| `ORBIT_PUBLIC_BASE_URL` | `https://your-site…/php/public` |
| `ORBIT_CORS_ORIGINS` | `https://your-site…` (comma-separated if multiple) |
| `ORBIT_API_KEY` | Same value used by Angular / media uploads |
| `ORBIT_DEFAULT_SITE_ID` | `site-orbit` (optional) |
| `ORBIT_TIMEZONE` | `Asia/Karachi` (optional) |

## Hostinger layout after deploy

```text
public_html/
  index.html          ← Angular
  …static assets…
  php/                ← orbit-api root
    config/config.php ← written from secrets each deploy
    public/           ← API document root (/php/public/…)
    public/uploads/   ← preserved across deploys
    bin/database
    database/migrations/
```

Point a subdomain or rewrite rules at `php/public` if you use a dedicated API host.

## First-time checklist

1. Create Environments `production` and `uat` with secrets above.
2. Enable **Remote MySQL** for the CI / `%` host in hPanel.
3. Push to `uat` or `prod`.
4. Confirm Actions log: migrations status → migrate → FTP API → FTP Angular.
5. Open `{domain}/api/v1/health` **or** `{domain}/php/public/api/v1/health` depending on rewrite setup.

## Local equivalent

```bat
cd orbit-api
php bin\ci-write-config.php
php bin\database migrate
```

(Set the same `ORBIT_*` env vars in your shell.)

## Safety

- `public/uploads/` is **never** deleted by FTP mirror.
- Existing remote `config/config.php` is replaced each deploy with the secrets-generated file (source of truth = GitHub secrets).
- Migrations are idempotent; re-running deploy only applies **pending** versions.
- Do not manually import SQL dumps on production — migrations are the only path.
