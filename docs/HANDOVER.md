# Production Handover Guide

This repository is the complete source handover for **Mohamed Adel — Portfolio**. It includes the React frontend, Express/tRPC backend, Drizzle schema and migrations, CMS dashboard, tests, configuration, bilingual copy, RTL rules, and the build toolchain. It intentionally excludes only generated dependencies, build output, real credentials, user-session records, and platform-specific secret configuration.

## Application architecture

| Layer | Location | Responsibility |
| --- | --- | --- |
| Public web UI | `client/src/pages/` | Home, Work, category detail, About/CV, Contact, and 404 routes. |
| Shared UI | `client/src/components/` | Header, Liquid Glass primitives, dashboard layout, rich-text editor and safe HTML renderer. |
| Localization | `client/src/contexts/LanguageContext.tsx`, `client/src/lib/localization.ts` | Persists language, sets `lang`/`dir`, supplies AR/EN interface copy. |
| Backend API | `server/routers.ts` | Typed tRPC contracts under `/api/trpc`. |
| Authorization | `server/_core/trpc.ts`, `server/_core/sdk.ts` | Public, authenticated, and `adminProcedure` contracts. |
| Database | `drizzle/schema.ts`, `drizzle/*.sql` | MySQL/TiDB tables and additive migrations. |
| CMS | `client/src/pages/AdminDashboard.tsx` | Admin content, projects, rich text, uploads, and contact links. |
| Assets | `assets/public/` in the handover package | Exported texture, portrait, star, project media, and Arabic font files. |

## API contract

The frontend calls the Express server exclusively through tRPC. Public procedures are `cms.publicContent`, `cms.publicProjects`, and `cms.publicContactLinks`. Administrative procedures read and update content, projects, contact links, and project images. Admin procedures require `ctx.user.role === "admin"`; the server validates uploaded image type and size, sanitizes rich text server-side, and restricts contact channels to phone `tel:` URLs or HTTP(S) URLs.

## Authentication and authorization

The production integration uses OAuth session cookies. Configure the OAuth endpoint, app identifier, owner OpenID, and a high-entropy `JWT_SECRET`. The owner is promoted to the `admin` role automatically when their OpenID matches `OWNER_OPEN_ID`; all CMS operations use the admin-only tRPC middleware.

For local development only, `LOCAL_AUTH_BYPASS=true` creates an in-memory local administrator and exposes the dashboard without OAuth. It is intentionally disabled whenever `NODE_ENV=production`, and must never be used in a public deployment.

## Asset and storage modes

The original hosted project uses Forge/S3 storage. The handover adds a portable local mode: set `STORAGE_DRIVER=local` and `LOCAL_STORAGE_DIR=assets/public`. Existing and newly uploaded CMS media are served at the same `/manus-storage/*` URLs, so no design or content references need to change. For cloud production, leave `STORAGE_DRIVER` unset and configure the Forge/S3-compatible variables, or replace `server/storage.ts` with your preferred provider.

## Database and CMS data

Run the migrations in `drizzle/` before importing `database/seed-current-content.sql`. The optional seed export contains portfolio content, projects, and contact links, but deliberately excludes `users` and all OAuth/session data. Recreate users through your configured identity provider after deployment.

## Translation and directionality

`LanguageProvider` persists the current language and assigns true `lang="ar" dir="rtl"` or `lang="en" dir="ltr"` to the document. `shared/portfolioContent.ts` stores AR/EN CMS keys, while `client/src/lib/localization.ts` contains interface labels. Arabic typography loads the exported Thmanyah Serif files through `@font-face`; English keeps the editorial display and sans-serif pairing. RTL-specific responsive composition lives in `client/src/index.css`.

## Delivery integrity

The handover package contains source code, hidden non-secret settings, the lockfile, migrations, all current public assets and fonts, an `.env.example` containing variable names only, and a sanitized project-config example. Install dependencies from the included lockfile and run the verification commands in the root README before deployment.
