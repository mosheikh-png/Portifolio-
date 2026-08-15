# Mohamed Adel Portfolio

Production-ready bilingual portfolio and private CMS for a graphic designer. The application uses **React 19**, **Vite**, **Express 4**, **tRPC 11**, **Drizzle ORM**, and **MySQL/TiDB**. The public site is available in Arabic with true RTL and English with LTR; the private dashboard manages site copy, rich text, projects, project images, and additional contact links.

## Included handover scope

| Area | Included |
| --- | --- |
| Frontend and design system | React pages, Liquid Glass styles, page transitions, responsive rules, components, and public routes. |
| Backend and API | Express entry point, tRPC router, validation, storage helpers, auth/session code, and tests. |
| Database | Drizzle schema, all migrations, and an optional export of current public CMS data. |
| CMS | Admin dashboard for general content, bilingual rich text, projects, images, and contact channels. |
| Assets | Portrait, texture, star, project images, and Thmanyah Serif Arabic font files in `assets/public/` of the handover archive. |
| Configuration | Hidden non-secret config files, lockfile, TypeScript/Vite/Drizzle/Vitest configuration, `ENV.example` (rename it to `.env` locally), and deployment guidance. |

## Quick start outside Manus

### Requirements

Install **Node.js 22+**, **pnpm 10+**, and a MySQL 8+ compatible database. Create a local `.env` by copying the included `ENV.example`; it contains variable names only. For a simple local CMS session and local media files, set `STORAGE_DRIVER=local`, `LOCAL_STORAGE_DIR=assets/public`, and `LOCAL_AUTH_BYPASS=true` while keeping `NODE_ENV=development`.

```bash
pnpm install --frozen-lockfile
cp ENV.example .env
pnpm drizzle-kit migrate
pnpm run export:seed database/seed-current-content.sql
mysql -u YOUR_USER -p YOUR_DATABASE < database/seed-current-content.sql
pnpm dev
```

Open `http://localhost:3000`. In local bypass mode, `/admin`, `/admin/projects`, and `/admin/contact` are available without OAuth. This bypass is development-only and is never active under `NODE_ENV=production`.

## Commands

```bash
pnpm dev                 # Start Express + Vite in development
pnpm check               # TypeScript validation
pnpm test                # Vitest suite
pnpm build               # Production client and server build
pnpm start               # Serve the production build
pnpm drizzle-kit migrate # Apply existing migrations
pnpm run export:seed     # Export current public CMS data from DATABASE_URL
```

## Production deployment

1. Provision a MySQL/TiDB database and set `DATABASE_URL`.
2. Apply all migrations with `pnpm drizzle-kit migrate`; optionally import `database/seed-current-content.sql`.
3. Configure a real OAuth provider using `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID`, and a secure `JWT_SECRET`. Do **not** set `LOCAL_AUTH_BYPASS` in production.
4. Either configure Forge/S3-compatible storage variables or adopt another provider in `server/storage.ts`. If using local filesystem storage, set `STORAGE_DRIVER=local`, give `LOCAL_STORAGE_DIR` a persistent writable path, and mount it as persistent storage in your hosting environment.
5. Run `pnpm build`, then launch with `NODE_ENV=production pnpm start`. The server honors the host-provided `PORT` variable.

> The repository ships with all source and non-secret configuration. Never commit `.env`, database credentials, OAuth client secrets, session secrets, or the original Manus `.project-config.json` because it contains deployment credentials.

## Architecture and CMS

See [`docs/HANDOVER.md`](docs/HANDOVER.md) for the complete architecture, API, storage, authentication/authorization, translation/RTL, database, and handover notes. The most important runtime locations are:

| Location | Purpose |
| --- | --- |
| `client/src/pages/` | Public pages and `AdminDashboard.tsx`. |
| `client/src/contexts/LanguageContext.tsx` | AR/EN selection, `lang`, and RTL/LTR direction. |
| `client/src/index.css` | Responsive desktop/mobile and Arabic RTL composition. |
| `server/routers.ts` | Public and admin tRPC procedures. |
| `server/db.ts` | Drizzle database access. |
| `drizzle/schema.ts` and `drizzle/*.sql` | Schema and migration history. |
| `shared/portfolioContent.ts` | Bilingual editable-content model. |
| `assets/public/` | Handover-only local asset mirror, served as `/manus-storage/*` when local storage mode is enabled. |
