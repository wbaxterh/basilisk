#!/usr/bin/env node
/**
 * Take screenshots of all app routes using Playwright.
 * Used by the CI screenshot workflow to generate PR preview images.
 *
 * Usage: node scripts/screenshot-routes.mjs [base-url] [output-dir]
 */

import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { resolve } from "path";

const BASE_URL = process.argv[2] || "http://localhost:3000";
const OUTPUT_DIR = resolve(process.argv[3] || "screenshots");

const ROUTES = [
  { path: "/", name: "dashboard" },
  { path: "/portfolio", name: "portfolio" },
  { path: "/tokens", name: "tokens" },
  { path: "/screener", name: "screener" },
  { path: "/wallets", name: "wallets" },
  { path: "/alerts", name: "alerts" },
];

const VIEWPORT = { width: 1280, height: 720 };

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: "dark",
  });
  const page = await context.newPage();

  console.log(`Taking screenshots from ${BASE_URL} → ${OUTPUT_DIR}/`);

  for (const route of ROUTES) {
    const url = `${BASE_URL}${route.path}`;
    console.log(`  → ${route.name} (${url})`);

    await page.goto(url, { waitUntil: "networkidle" });
    await page.screenshot({
      path: `${OUTPUT_DIR}/${route.name}.png`,
      fullPage: false,
      type: "png",
    });
  }

  await browser.close();
  console.log(`Done. ${ROUTES.length} screenshots saved.`);
}

main().catch((err) => {
  console.error("Screenshot failed:", err);
  process.exit(1);
});
