/**
 * Screenshots for the README and the store listing.
 *
 *   node tools/shots.mjs                       # against https://flarum.test
 *   DEPOT_BASE=https://dev.example node tools/shots.mjs
 *
 * Guest view on purpose: nothing here needs a session, and nothing in this
 * file is a credential. Reduced motion is emulated so the spotlight holds
 * still and no shot catches a cross-fade halfway.
 */
import puppeteer from '../../convoro2/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.DEPOT_BASE || 'https://flarum.test';
const OUT = `${dirname(fileURLToPath(import.meta.url))}/../screenshots`;
const FILE = '/downloads/f/aurethil-resource-pack';

// Floating chrome that belongs to the theme, not to Depot.
const HIDE = `
  .Bespoke-scrollTop, .ScrollToTop, [class*="scrollTop"], [class*="BackToTop"], .CookieConsent, #cookie-consent, [class*="cookie"] { display: none !important; }
`;

const DESKTOP = { width: 1440, height: 1000, deviceScaleFactor: 2 };
const PHONE = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

const SHOTS = [
  { name: 'browse', path: '/downloads', max: 1750 },
  { name: 'category-list', path: '/downloads/c/minecraft', max: 1250, view: 'list' },
  { name: 'file', path: FILE, max: 1700 },
  { name: 'versions', path: FILE, max: 1250, tab: 'Versions' },
  { name: 'reviews', path: FILE, max: 1250, tab: 'Reviews' },
  { name: 'discussion', path: FILE, max: 1150, tab: 'Discussion' },
  { name: 'download', path: FILE, modal: 'download', max: 1000 },
  { name: 'upload-file', path: '/downloads', modal: 'upload', step: 0, max: 1000 },
  { name: 'upload-support', path: '/downloads', modal: 'upload', step: 3, max: 1000 },
  { name: 'browse-light', path: '/downloads', max: 1750, light: true },
  { name: 'file-light', path: FILE, max: 1500, light: true },
  { name: 'phone-browse', path: '/downloads', viewport: PHONE, max: 2200 },
  { name: 'phone-file', path: FILE, viewport: PHONE, max: 2200 },
];

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  acceptInsecureCerts: true,
  args: ['--hide-scrollbars', '--force-color-profile=srgb', '--ignore-certificate-errors'],
});

const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const shot of SHOTS) {
  await page.setViewport(shot.viewport || DESKTOP);
  await page.goto(BASE + shot.path, { waitUntil: 'networkidle0' });
  await page.evaluate((view) => {
    try {
      localStorage.setItem('depot.view', view);
    } catch (e) {}
  }, shot.view || 'grid');
  await page.goto(BASE + shot.path, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.DepotPage, .DepotFilePage');
  await page.addStyleTag({ content: HIDE });
  if (shot.light) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  if (shot.tab) {
    await page.evaluate((label) => [...document.querySelectorAll('.DepotTabs button')].find((b) => b.textContent.trim().startsWith(label)).click(), shot.tab);
  }

  if (shot.modal === 'download') {
    await page.evaluate(() => document.querySelector('.DepotDownloadSplit .Button--primary').click());
    await page.waitForSelector('.DepotDownloadModal');
  }

  if (shot.modal === 'upload') {
    await page.evaluate(() => document.querySelector('.IndexPage-newDiscussion').click());
    await page.waitForSelector('.DepotDrop');
    // A real file, hashed by the page itself — the checksum in the shot is genuine.
    await page.evaluate(() => {
      const f = new File([new TextEncoder().encode('Glowberry Caves 1.2 — sample payload for the screenshot')], 'glowberry-caves-1.2.zip');
      const dt = new DataTransfer();
      dt.items.add(f);
      document.querySelector('.DepotDrop').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    await page.waitForSelector('.DepotDrop-hash:not(.is-working)');
    for (let i = 0; i < shot.step; i++) {
      await page.evaluate(() => [...document.querySelectorAll('.DepotUpload-foot .Button--primary')].pop().click());
      await sleep(150);
      if (i === 0) {
        await page.evaluate(() => {
          const set = (sel, v) => {
            const el = document.querySelector(sel);
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          };
          set('#depot-tagline', 'A 600×600 survival map built around one enormous lush cave.');
        });
      }
    }
  }

  await page.evaluate(() => document.fonts.ready);
  await sleep(400);

  const height = await page.evaluate(() => {
    const modal = document.querySelector('.Modal');
    if (modal) return Math.ceil(modal.getBoundingClientRect().bottom + 40);
    return document.documentElement.scrollHeight;
  });

  await page.screenshot({
    path: `${OUT}/${shot.name}.png`,
    clip: { x: 0, y: 0, width: (shot.viewport || DESKTOP).width, height: Math.min(height, shot.max) },
    captureBeyondViewport: true,
  });
  console.log(`✓ ${shot.name}`);
}

await browser.close();
