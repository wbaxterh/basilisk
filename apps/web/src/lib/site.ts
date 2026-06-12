/**
 * Canonical Basilisk URLs — single source of truth for the whole web app.
 *
 * `APP_URL` is the public origin where the landing page is served.
 * Override at deploy time with `NEXT_PUBLIC_SITE_URL`. When the production
 * domain is purchased, change the default here OR set the env var and
 * nothing else needs to change.
 *
 * Path-based examples (instead of subdomains) so it all works on a free
 * Vercel deploy without an `api.*` subdomain:
 *   API:        `${APP_URL}/api/v1/...`
 *   Whitepaper: `${APP_URL}/whitepaper`
 *   Dashboard:  `${APP_URL}/dashboard`
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://basilisk-seven.vercel.app";

/** Hostname without scheme, e.g. for breadcrumb-style display. */
export const APP_HOST = APP_URL.replace(/^https?:\/\//, "");

// Docs URL filled in after the apps/docs Vercel deploy assigns an alias.
export const DOCS_URL =
  process.env.NEXT_PUBLIC_DOCS_URL || "https://basilisk-docs.vercel.app";

export const GITHUB_URL =
  process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/wbaxterh/basilisk";

/** Common subpaths derived from APP_URL — keep in one place so links stay coherent. */
export const APP_DASHBOARD_URL = `${APP_URL}/dashboard`;
export const APP_WHITEPAPER_URL = `${APP_URL}/whitepaper`;
export const API_BASE_URL = `${APP_URL}/api/v1`;
