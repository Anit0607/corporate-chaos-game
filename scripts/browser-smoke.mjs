import { existsSync, writeSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseUrl = process.env.GAME_URL ?? 'http://127.0.0.1:4173';
const outputDir = path.resolve('playwright-report', 'v2-smoke');
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const executablePath = chromeCandidates.find(existsSync);

if (!executablePath) {
  throw new Error('Chrome or Edge was not found. Set CHROME_PATH to a Chromium executable.');
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const browserErrors = [];

const attachDiagnostics = (page) => {
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`page: ${error.message}`));
};

const capture = (page, name) => page.screenshot({ path: path.join(outputDir, `${name}.png`) });

const enterShift = async (page, duration, character, seed) => {
  await page.goto(`${baseUrl}/?duration=${duration}&seed=${seed}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'CORPORATE CHAOS' }).waitFor();
  await page.getByRole('button', { name: 'CLOCK IN' }).click();
  await page.getByRole('heading', { name: 'Choose your recruit' }).waitFor();
  await page.locator(`[data-character="${character}"]`).click();
  await page.getByRole('button', { name: 'ENTER THE OFFICE' }).click();
  await page.locator('#hud.is-visible').waitFor();
};

const drivePlayer = async (page, maximumMs, checks) => {
  const directions = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  let heldDirection;
  const started = Date.now();
  while (Date.now() - started < maximumMs) {
    const elapsed = Date.now() - started;
    const direction = directions[Math.floor(elapsed / 1800) % directions.length];
    if (direction !== heldDirection) {
      if (heldDirection) await page.keyboard.up(heldDirection);
      await page.keyboard.down(direction);
      heldDirection = direction;
    }
    await page.keyboard.press('Space');
    const perk = page.locator('#perk-modal.is-visible [data-perk]').first();
    if (await perk.isVisible()) await perk.click();
    if (await checks()) break;
    await page.waitForTimeout(260);
  }
  if (heldDirection) await page.keyboard.up(heldDirection);
};

let exitCode = 0;
let summary = '';
try {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  attachDiagnostics(desktop);
  await desktop.goto(`${baseUrl}/?duration=60&seed=20260810`, { waitUntil: 'domcontentloaded' });
  await desktop.getByRole('heading', { name: 'CORPORATE CHAOS' }).waitFor();
  await capture(desktop, '01-desktop-menu');

  await desktop.getByRole('button', { name: 'CLOCK IN' }).click();
  await desktop.getByRole('heading', { name: 'Choose your recruit' }).waitFor();
  await capture(desktop, '02-desktop-characters');
  await desktop.locator('[data-character="blue-recruit"]').click();
  await desktop.getByRole('heading', { name: 'Welcome to Chaos Corp.' }).waitFor();
  await capture(desktop, '03-desktop-briefing');
  await desktop.getByRole('button', { name: 'ENTER THE OFFICE' }).click();
  await desktop.locator('#hud.is-visible').waitFor();
  await desktop.waitForTimeout(1000);
  await capture(desktop, '04-desktop-gameplay');

  let eventCaptured = false;
  await drivePlayer(desktop, 37_000, async () => {
    if (await desktop.locator('#event-banner.is-visible').isVisible()) {
      await capture(desktop, '05-desktop-event');
      eventCaptured = true;
      return true;
    }
    if (await desktop.locator('#result-screen.is-visible').isVisible()) throw new Error('Player was defeated before the corporate event.');
    return false;
  });

  await enterShift(desktop, 30, 'blue-recruit', 20260811);
  let bossCaptured = false;
  await drivePlayer(desktop, 25_000, async () => {
    if (await desktop.locator('#boss-hud.is-visible').isVisible()) {
      await capture(desktop, '06-desktop-boss');
      bossCaptured = true;
      return true;
    }
    if (await desktop.locator('#result-screen.is-visible').isVisible()) throw new Error('Player was defeated before the Regional Director appeared.');
    return false;
  });

  const compact = desktop;
  await compact.setViewportSize({ width: 900, height: 600 });
  await compact.goto(`${baseUrl}/?duration=30&seed=20260810`, { waitUntil: 'domcontentloaded' });
  await compact.getByRole('button', { name: 'CLOCK IN' }).click();
  await compact.getByRole('heading', { name: 'Choose your recruit' }).waitFor();
  await capture(compact, '07-compact-characters');
  const panelBox = await compact.locator('.character-panel').boundingBox();
  if (!panelBox || panelBox.y < 0 || panelBox.y + panelBox.height > 601) {
    throw new Error(`Compact character panel is clipped: ${JSON.stringify(panelBox)}`);
  }
  await compact.locator('[data-character="blue-recruit"]').click();
  await compact.getByRole('button', { name: 'ENTER THE OFFICE' }).click();
  await compact.locator('#touch-controls').waitFor({ state: 'visible' });
  await capture(compact, '08-compact-gameplay');

  if (!eventCaptured) throw new Error('Corporate event banner did not appear during the seeded run.');
  if (!bossCaptured) throw new Error('Regional Director boss HUD did not appear during the seeded run.');
  if (browserErrors.length) throw new Error(browserErrors.join('\n'));

  summary = JSON.stringify({ ok: true, eventCaptured, bossCaptured, screenshots: outputDir }, null, 2);
} catch (error) {
  exitCode = 1;
  summary = error instanceof Error ? (error.stack ?? error.message) : String(error);
} finally {
  await Promise.race([
    browser.close(),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  writeSync(exitCode === 0 ? 1 : 2, `${summary}\n`);
  process.exit(exitCode);
}
