# Orbit Project Architecture

## 1. Project overview

This project is a full-stack digital storefront and admin system for Orbit Ceramic.

It is split into three main parts:

- Frontend: Angular application in `src/`
- Backend API: PHP service in `orbit-api/`
- Static content and schema files: `public/data/` and `public/images/`

The app is designed to separate:

- customer-facing storefront UI
- admin/content management workflows
- database-backed API access
- static brand/content configuration

---

## 2. High-level architecture

```text
Angular Frontend (src/app)
        |
        | HTTP requests
        v
PHP API (orbit-api/src + public)
        |
        | MySQL queries
        v
MySQL Database
        |
        | media files / uploads
        v
public/uploads/ and public/images/
```

The frontend is the customer-facing presentation layer. The PHP API exposes data for batches, products, pages, contact info, leads, and media. Static branding/chrome such as nav and footer remains in Angular-side content config, while dynamic content is served from the API and database.

---

## 3. Frontend architecture

### Main app folder

`src/app` contains the Angular application structure.

Key folders:

- `app/` – root app bootstrap and configuration
- `components/` – reusable storefront UI components
  - `hero`
  - `collections`
  - `journey`
  - `batch`
  - `site-header`
  - `site-footer`
- `pages/` – page-level screens for the public site
  - `home`
  - `about`
  - `collections`
  - `journey`
  - `studio`
  - `batch`
  - `view-all`
- `services/` – shared application services
  - `site-content.service.ts`
  - `launch-celebration.service.ts`
- `data/` – TypeScript models and shared content interfaces
- `config/` – API configuration and environment-related settings
- `directives/` – reusable Angular directives

### Admin area

The admin system is separated under `src/app/admin/`.

This section includes:

- admin routing and layout
- dashboard and management pages
- batch and product management screens
- leads and page-copy editing tools
- API connection logic for admin operations

Important files:

- `src/app/admin/admin.routes.ts`
- `src/app/admin/admin-api.service.ts`
- `src/app/admin/admin-db.service.ts`
- `src/app/admin/layout/`
- `src/app/admin/pages/`

This indicates the project includes a dedicated CMS/admin workflow, not just a public storefront.

---

## 4. Backend architecture

The PHP backend sits in `orbit-api/` and is designed as a separate API service.

### Core folders

- `orbit-api/public/` – entry points for the web server
  - `index.php`
  - `router.php`
- `orbit-api/src/Controllers/` – request handlers for API endpoints
  - `BatchController.php`
  - `ProductController.php`
  - `PageController.php`
  - `SiteController.php`
  - `ContactController.php`
  - `LeadsController.php`
  - `MediaController.php`
  - `AdminController.php`
- `orbit-api/src/Repositories/` – business/data access logic
  - `AdminRepository.php`
  - `ContentRepository.php`
- `orbit-api/src/Database.php` – database connection
- `orbit-api/src/Router.php` – route dispatching
- `orbit-api/src/Response.php` – structured API responses
- `orbit-api/src/helpers.php` – helper functions

### API purpose

The backend provides endpoints for:

- site configuration
- batch data
- products and catalog data
- page copy sections
- contact information
- lead capture
- media uploads
- admin authentication and management

The README in `orbit-api/README.md` describes a phase-based API model, with public storefront endpoints and admin-managed data routes.

---

## 5. Data and content architecture

### Database layer

The project uses a MySQL database with schema and seed files under:

- `public/data/schema.sql`
- `public/data/schema-phase1.sql`
- `orbit-api/sql/seed-phase1.sql`

This is where core data like:

- batches
- products
- site settings
- reviews
- media metadata
- contact info
- page sections
- lead records

is stored.

### Static content layer

The project also contains structured content files:

- `public/data/site-content.json` – static site chrome and content references
- `public/data/API-CATALOG.md` – API documentation
- `public/data/ADMIN.md` – admin workflow guidance
- `public/data/CONTENT-SCHEMA.md` – content schema notes

These files help define the site’s content model and support CMS-like management.

### Media assets

Files and uploaded images are stored in:

- `public/images/`
- `orbit-api/public/uploads/`

This separation indicates that static assets are versioned in the repo, while uploaded media is served from the API/public upload area.

---

## 6. Frontend-to-backend flow

A typical user flow is:

1. Angular app loads the storefront UI.
2. Frontend requests data from the PHP API.
3. PHP controller loads data from database repositories.
4. API returns JSON to Angular.
5. Angular renders the page, products, batch info, contact details, and content sections.

For admin operations:

1. Admin panel calls admin API endpoints.
2. API validates the API key or auth token.
3. Updates are written to the database or media storage.
4. Frontend reflects the updated data after refresh or re-fetch.

---

## 7. Key architectural patterns

### Separation of concerns

- UI logic stays in Angular components
- API logic stays in PHP controllers and repositories
- Data persistence stays in MySQL
- static configuration stays in JSON and schema files

### Modular structure

The app is organized by feature area rather than by file type alone.

Examples:

- `pages/` for user-facing screens
- `admin/pages/` for admin operations
- `components/` for reusable blocks
- `controllers/` and `repositories/` for backend logic

### Hybrid content model

The app mixes:

- database-driven dynamic content
- JSON-based site chrome/content config
- static media files in `public/images/`
- uploaded media in the API `uploads` directory

This is a common pattern for content-heavy storefronts.

---

## 8. Development workflow

### Frontend development

From root:

```bash
npm install
npm start
```

The Angular app runs with the CLI and serves the storefront at the default Angular dev server.

### Backend development

The PHP API is usually run separately with its local server script or PHP built-in server.

Examples from `orbit-api/README.md`:

```bash
cd orbit-api
run-local.bat
```

or

```bash
cd orbit-api/public
php -S localhost:8080 router.php
```

This means the frontend and backend are intentionally separate development services.

---

## 9. Summary

The Orbit project is a multi-layer architecture:

- Angular frontend for presentation and admin UI
- PHP backend for APIs and business logic
- MySQL database for persistent content and commerce data
- static and uploaded media assets for product and brand visuals

This structure supports a storefront plus an admin/content-management workflow, and it keeps the UI, API, and storage concerns clearly separated.
