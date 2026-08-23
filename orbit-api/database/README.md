# Database migrations

Versioned schema + seed migrations for Orbit Ceramic (MySQL).

**This folder is the single source of truth** for database structure and seed data.

```text
orbit-api/database/
├── migrations/     ← V001__, V002__, … (apply with php bin/database migrate)
├── README.md
└── DEPLOY.md       ← GitHub Actions secrets + Hostinger deploy
```

Every database change must be a new migration file. Never edit an applied migration.

---

## Commands

From `orbit-api/`:

```bat
php bin\database status
php bin\database migrate
php bin\database migration:create CreatePayments
php bin\database migration:create SeedPaymentTypes --type=seed
php bin\database rollback-last
php bin\database rollback-to V003
php bin\database baseline
```

Windows helper:

```bat
database.bat migrate
```

---

## Fresh database

1. Copy `config/config.example.php` → `config/config.php`
2. Run:

```bat
php bin\database migrate
```

The runner creates the database if missing, then applies all migrations in order.

---

## Creating a new migration

```bat
php bin\database migration:create AddPaymentStatus
```

**Never edit an applied migration.** Add the next `V0xx__...` file instead.

Seeders must be idempotent (`INSERT ... ON DUPLICATE KEY UPDATE` or existence checks).

---

## History table

```text
database_migrations
  version | name | type | checksum | applied_at | execution_time_ms | success
```

Only successful migrations are recorded. Failed migrations stay pending and are retried on the next `migrate`.

Checksum mismatches on applied files abort with an error — create a new migration instead of editing the old one.

Concurrency: MySQL `GET_LOCK('orbit_ceramic_migrations')`.

---

## Rollback

```bat
php bin\database rollback-last
php bin\database rollback-to V003
php bin\database rollback-last --force
```

`--force` is required for migrations marked `irreversible` (e.g. V001 drops all tables).

---

## Deployment (GitHub Actions)

```text
Build → Write config from secrets → Migrate → FTP API → FTP Angular
```

See **[`DEPLOY.md`](DEPLOY.md)** for required GitHub Environment secrets (`production` / `uat`).
