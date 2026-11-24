// Renders public/og.png (1200×630) and public/apple-touch-icon.png (180×180) with headless Chromium.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto('file://' + here('./og.html'));
await page.waitForTimeout(1500);
await page.screenshot({ path: here('../public/og.png') });
const icon = readFileSync(here('../public/favicon.svg'), 'utf8');
await page.setViewportSize({ width: 180, height: 180 });
await page.setContent(`<html><body style="margin:0;background:#F3F1EA">${icon.replace('<svg ', '<svg width="180" height="180" ')}</body></html>`);
await page.screenshot({ path: here('../public/apple-touch-icon.png') });
await browser.close();
console.log('og.png + apple-touch-icon.png written');
