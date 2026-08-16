import assert from 'node:assert/strict';
import { existsSync, writeSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseUrl = process.env.GAME_URL ?? 'http://127.0.0.1:4173';
const outputDir = path.resolve('playwright-report', 'mobile-readiness');
const executablePath = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean).find(existsSync);

if (!executablePath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH to a Chromium executable.');

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP4A.250205.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0 Mobile Safari/537.36';
const profiles = [
  { id: 'android-large', width: 915, height: 412, deviceScaleFactor: 2.625 },
  { id: 'android-standard', width: 844, height: 390, deviceScaleFactor: 3 },
  { id: 'android-small', width: 740, height: 360, deviceScaleFactor: 2 },
  { id: 'compact-contract', width: 900, height: 600, deviceScaleFactor: 2 },
  { id: 'tablet-landscape', width: 1024, height: 600, deviceScaleFactor: 2 },
];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const browserErrors = [];

const attachDiagnostics = (page, profile) => {
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`${profile} console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`${profile} page: ${error.message}`));
};

const snapshot = (page) => page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.snapshot());
const audioState = (page) => page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.audioState());
const capture = (page, name) => page.screenshot({ path: path.join(outputDir, `${name}.png`) });

const waitUntil = async (page, check, label, timeoutMs = 12_000, intervalMs = 75) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await page.waitForTimeout(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}.`);
};

const enterShift = async (page, character) => {
  await page.getByRole('button', { name: 'CLOCK IN' }).tap();
  await page.getByRole('heading', { name: 'Choose your recruit' }).waitFor();
  await page.locator(`[data-character="${character}"]`).tap();
  await page.getByRole('heading', { name: 'Welcome to Chaos Corp.' }).waitFor();
  await page.getByRole('button', { name: 'ENTER THE OFFICE' }).tap();
  await page.locator('#hud.is-visible').waitFor();
  await page.locator('#touch-controls').waitFor({ state: 'visible' });
};

const dispatchTouch = async (locator, type, pointerId, primary = true) => {
  await locator.dispatchEvent(type, {
    pointerId,
    pointerType: 'touch',
    isPrimary: primary,
    buttons: type === 'pointerdown' ? 1 : 0,
    button: 0,
  });
};

const boxWithinViewport = (box, profile, label) => {
  assert(box, `${profile.id}: ${label} has no layout box.`);
  assert(box.x >= -1 && box.y >= -1, `${profile.id}: ${label} begins outside viewport: ${JSON.stringify(box)}`);
  assert(box.x + box.width <= profile.width + 1, `${profile.id}: ${label} exceeds viewport width: ${JSON.stringify(box)}`);
  assert(box.y + box.height <= profile.height + 1, `${profile.id}: ${label} exceeds viewport height: ${JSON.stringify(box)}`);
};

const boxesOverlap = (a, b) => Boolean(a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y);

const contextFor = (profile) => browser.newContext({
  viewport: { width: profile.width, height: profile.height },
  screen: { width: profile.width, height: profile.height },
  deviceScaleFactor: profile.deviceScaleFactor,
  hasTouch: true,
  isMobile: true,
  userAgent: ANDROID_UA,
  reducedMotion: 'no-preference',
});

const runLayoutProfile = async (profile) => {
  const context = await contextFor(profile);
  const page = await context.newPage();
  attachDiagnostics(page, profile.id);
  await page.goto(`${baseUrl}/?duration=30&seed=260816&e2e=1`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'CORPORATE CHAOS' }).waitFor();
  await waitUntil(page, async () => Boolean(await snapshot(page)), `${profile.id} E2E bridge`);
  assert.equal(await page.locator('#orientation-gate').isVisible(), false, `${profile.id}: landscape orientation gate should be hidden.`);
  await page.getByRole('button', { name: 'CLOCK IN' }).tap();
  await page.getByRole('heading', { name: 'Choose your recruit' }).waitFor();
  boxWithinViewport(await page.locator('.character-panel').boundingBox(), profile, 'character panel');
  await page.locator('[data-character="blue-recruit"]').tap();
  await page.getByRole('button', { name: 'ENTER THE OFFICE' }).tap();
  await page.locator('#touch-controls').waitFor({ state: 'visible' });
  await page.waitForTimeout(250);

  const touchPad = await page.locator('.touch-pad').boundingBox();
  const dash = await page.locator('#touch-dash').boundingBox();
  const pause = await page.locator('#pause-button').boundingBox();
  boxWithinViewport(touchPad, profile, 'touch pad');
  boxWithinViewport(dash, profile, 'touch dash');
  boxWithinViewport(pause, profile, 'pause button');
  assert(!boxesOverlap(dash, pause), `${profile.id}: touch dash overlaps pause button.`);
  assert((dash?.width ?? 0) >= 44 && (dash?.height ?? 0) >= 44, `${profile.id}: dash target is below 44px.`);
  assert((pause?.width ?? 0) >= 44 && (pause?.height ?? 0) >= 44, `${profile.id}: pause target is below 44px.`);
  const directionBoxes = await page.locator('.touch-pad button').evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));
  directionBoxes.forEach((box) => assert(box.width >= 44 && box.height >= 44, `${profile.id}: direction target is below 44px.`));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, `${profile.id}: horizontal overflow detected.`);
  await capture(page, `${profile.id}-gameplay`);
  const result = {
    ...profile,
    touchPad: { width: touchPad.width, height: touchPad.height },
    dashTarget: { width: dash.width, height: dash.height },
    pauseTarget: { width: pause.width, height: pause.height },
    horizontalOverflow: false,
  };
  await context.close();
  return result;
};

const trackMaximums = (maximums, state) => {
  if (!state) return;
  for (const key of ['hazards', 'projectiles', 'coins', 'effects', 'timers']) {
    maximums[key] = Math.max(maximums[key], state.activeEntities[key]);
  }
};

const driveTouchUntil = async (page, predicate, timeoutMs, maximums) => {
  const directions = ['right', 'down', 'left', 'up'];
  const deadline = Date.now() + timeoutMs;
  let step = 0;
  while (Date.now() < deadline) {
    const state = await snapshot(page);
    trackMaximums(maximums, state);
    if (predicate(state)) return;
    if (await page.locator('#result-screen.is-visible').isVisible()) throw new Error('Mobile soak ended before the requested state.');
    const perk = page.locator('#perk-modal.is-visible [data-perk]').first();
    if (await perk.isVisible()) {
      await perk.tap();
      await page.waitForTimeout(100);
      continue;
    }
    if ((state?.simulation?.energy ?? 100) < (state?.simulation?.maxEnergy ?? 100) * 0.75) {
      await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.restorePlayer());
    }
    const direction = directions[step % directions.length];
    const pointerId = 1000 + step;
    const button = page.locator(`[data-move="${direction}"]`);
    await dispatchTouch(button, 'pointerdown', pointerId);
    if (state?.player?.dashReady) await page.locator('#touch-dash').tap();
    await page.waitForTimeout(420);
    await dispatchTouch(button, 'pointerup', pointerId);
    step += 1;
  }
  throw new Error('Timed out during mobile touch soak.');
};

let exitCode = 0;
let summary = '';
try {
  const layoutMatrix = [];
  for (const profile of profiles) layoutMatrix.push(await runLayoutProfile(profile));

  const portrait = { id: 'android-portrait', width: 390, height: 844, deviceScaleFactor: 3 };
  const portraitContext = await contextFor(portrait);
  const portraitPage = await portraitContext.newPage();
  attachDiagnostics(portraitPage, portrait.id);
  await portraitPage.goto(`${baseUrl}/?duration=30&seed=260816&e2e=1`, { waitUntil: 'domcontentloaded' });
  await portraitPage.locator('#orientation-gate').waitFor({ state: 'visible' });
  assert.equal(await portraitPage.locator('#orientation-gate').getAttribute('data-active'), 'true');
  boxWithinViewport(await portraitPage.locator('#orientation-gate').boundingBox(), portrait, 'orientation gate');
  await capture(portraitPage, 'android-portrait-rotate-gate');
  await portraitContext.close();

  const primary = profiles[0];
  const primaryContext = await contextFor(primary);
  const page = await primaryContext.newPage();
  attachDiagnostics(page, 'android-primary-soak');
  await page.goto(`${baseUrl}/?duration=360&seed=20260816&balance=1&balanceRate=6&e2e=1`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'CORPORATE CHAOS' }).waitFor();
  await enterShift(page, 'blue-recruit');
  await waitUntil(page, async () => (await audioState(page))?.contextState === 'running', 'mobile audio unlock', 3_000);

  const right = page.locator('[data-move="right"]');
  const up = page.locator('[data-move="up"]');
  const start = await snapshot(page);
  await dispatchTouch(right, 'pointerdown', 21);
  await page.waitForTimeout(100);
  const moved = await snapshot(page);
  assert((moved?.player.x ?? 0) > (start?.player.x ?? 0) + 8, 'Touch hold did not move right.');
  assert.equal(moved?.player.touchX, 1);
  await dispatchTouch(right, 'pointerup', 21);
  await waitUntil(page, async () => (await snapshot(page))?.player.touchX === 0, 'touch release to zero');

  const diagonalStart = await snapshot(page);
  await dispatchTouch(right, 'pointerdown', 22);
  await dispatchTouch(up, 'pointerdown', 23, false);
  await page.waitForTimeout(100);
  const diagonal = await snapshot(page);
  const diagonalEvidence = JSON.stringify({
    start: { x: diagonalStart?.player.x, y: diagonalStart?.player.y },
    end: { x: diagonal?.player.x, y: diagonal?.player.y },
    touch: { x: diagonal?.player.touchX, y: diagonal?.player.touchY },
  });
  assert((diagonal?.player.x ?? 0) > (diagonalStart?.player.x ?? 0) + 5, `Diagonal touch did not move right: ${diagonalEvidence}`);
  assert((diagonal?.player.y ?? 0) < (diagonalStart?.player.y ?? 0) - 5, `Diagonal touch did not move up: ${diagonalEvidence}`);
  assert.equal(diagonal?.player.touchX, 1);
  assert.equal(diagonal?.player.touchY, -1);
  await dispatchTouch(right, 'pointerup', 22);
  await dispatchTouch(up, 'pointerup', 23, false);
  await waitUntil(page, async () => {
    const state = await snapshot(page);
    return state?.player.touchX === 0 && state?.player.touchY === 0;
  }, 'diagonal release to zero');

  await waitUntil(page, async () => Boolean((await snapshot(page))?.player.dashReady), 'mobile dash ready');
  await page.locator('#touch-dash').tap();
  await waitUntil(page, async () => Boolean((await snapshot(page))?.player.dashing), 'mobile touch dash', 2_000, 25);

  await page.waitForTimeout(500);
  await dispatchTouch(right, 'pointerdown', 24);
  await waitUntil(page, async () => (await snapshot(page))?.player.touchX === 1, 'held touch before pagehide');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  await page.locator('#pause-modal.is-visible').waitFor();
  const backgrounded = await snapshot(page);
  assert(backgrounded?.manuallyPaused, 'Page hide did not pause the run.');
  assert.equal(backgrounded?.player.touchX, 0, 'Page hide left horizontal touch input stuck.');
  assert.equal(backgrounded?.player.touchY, 0, 'Page hide left vertical touch input stuck.');
  await waitUntil(page, async () => (await audioState(page))?.contextState === 'suspended', 'background audio suspension', 3_000);
  const pausedAt = backgrounded?.simulation?.elapsed ?? 0;
  await page.waitForTimeout(500);
  assert(Math.abs(((await snapshot(page))?.simulation?.elapsed ?? 0) - pausedAt) < 0.05, 'Simulation advanced while background-paused.');
  await page.getByRole('button', { name: 'RETURN TO WORK' }).tap();
  await waitUntil(page, async () => (await audioState(page))?.contextState === 'running', 'audio resume after user gesture', 3_000);

  const heapBefore = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
  const maximumEntities = { hazards: 0, projectiles: 0, coins: 0, effects: 0, timers: 0 };
  await driveTouchUntil(page, (state) => Boolean(state?.simulation?.bossStarted), 75_000, maximumEntities);
  const soakState = await snapshot(page);
  assert(soakState?.bossPresentation.introActive, 'Accelerated mobile soak missed boss entrance presentation.');

  // Use a clean replay for deterministic phase thresholds after the sustained soak build.
  await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.defeatPlayer());
  await page.locator('#result-screen.is-visible').waitFor({ timeout: 3_000 });
  await page.getByRole('button', { name: 'WORK ANOTHER SHIFT' }).tap();
  await page.locator('#hud.is-visible').waitFor();
  await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.prepareBoss([]));
  await waitUntil(page, async () => Boolean((await snapshot(page))?.simulation?.bossStarted), 'clean Cool Head boss start', 5_000);
  const bossEntrance = await snapshot(page);
  assert(bossEntrance?.bossPresentation.introActive, 'Clean mobile boss run missed boss entrance presentation.');
  await capture(page, 'android-primary-boss-entrance');
  await page.locator('#pause-button').tap();
  await page.locator('#pause-modal.is-visible').waitFor();
  let boss = await snapshot(page);
  for (const target of [
    { ratio: 0.74, phase: 2 },
    { ratio: 0.49, phase: 3 },
    { ratio: 0.24, phase: 4 },
  ]) {
    const damage = boss.simulation.bossHealth - boss.simulation.bossMaxHealth * target.ratio;
    await page.evaluate((amount) => window.__CORPORATE_CHAOS_E2E__?.damageBoss(amount), damage);
    boss = await snapshot(page);
    assert.equal(boss?.simulation?.bossPhase, target.phase);
  }
  await waitUntil(page, async () => !(await page.locator('#boss-announcement').getAttribute('class'))?.includes('is-visible'), 'phase announcement cleanup', 5_000);
  await page.getByRole('button', { name: 'RETURN TO WORK' }).tap();
  await page.locator('#pause-modal').waitFor({ state: 'hidden' });
  await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.primeBossAttack());
  await waitUntil(page, async () => Boolean((await snapshot(page))?.bossPresentation.attackPending), 'mobile boss telegraph', 5_000, 20);
  const warning = await snapshot(page);
  const safeDistances = warning.bossPresentation.attackTargets.map((target) => Math.hypot(target.x - warning.player.x, target.y - warning.player.y));
  safeDistances.forEach((distance) => assert(distance >= 224, `Mobile boss target was too close: ${distance.toFixed(1)}px.`));
  await capture(page, 'android-primary-boss-warning');
  await waitUntil(page, async () => !(await snapshot(page))?.bossPresentation.attackPending, 'mobile boss attack execution', 5_000, 20);
  await page.locator('#pause-button').tap();
  await page.locator('#pause-modal.is-visible').waitFor();
  const beforeDefeat = await snapshot(page);
  await page.evaluate((amount) => window.__CORPORATE_CHAOS_E2E__?.damageBoss(amount), beforeDefeat.simulation.bossHealth);
  assert((await snapshot(page))?.simulation?.bossDefeated, 'Cool Head mobile boss lifecycle did not reach defeat.');
  await page.getByRole('button', { name: 'RETURN TO WORK' }).tap();
  await page.waitForTimeout(350);
  await capture(page, 'android-primary-boss-defeat');
  await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.clockOut());
  await page.locator('#result-screen.is-visible').waitFor({ timeout: 5_000 });
  assert.equal(await page.locator('#result-boss').innerText(), 'DIRECTOR DEFEATED');
  const victoryCleanup = await snapshot(page);
  assert.deepEqual(victoryCleanup?.activeEntities, { hazards: 0, projectiles: 0, coins: 0, effects: 0, timers: 0 });
  await page.waitForTimeout(350);
  await capture(page, 'android-primary-victory');

  await page.getByRole('button', { name: 'WORK ANOTHER SHIFT' }).tap();
  await page.locator('#hud.is-visible').waitFor();
  await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.defeatPlayer());
  await page.locator('#result-screen.is-visible').waitFor({ timeout: 3_000 });
  assert.deepEqual((await snapshot(page))?.activeEntities, { hazards: 0, projectiles: 0, coins: 0, effects: 0, timers: 0 });
  await capture(page, 'android-primary-defeat');

  await page.getByRole('button', { name: 'MAIN MENU' }).tap();
  await enterShift(page, 'red-recruit');
  await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.prepareBoss(['reply', 'printer']));
  await waitUntil(page, async () => Boolean((await snapshot(page))?.simulation?.bossStarted), 'Firestarter mobile boss start', 5_000);
  await page.locator('#pause-button').tap();
  await page.locator('#pause-modal.is-visible').waitFor();
  const redBoss = await snapshot(page);
  await page.evaluate((amount) => window.__CORPORATE_CHAOS_E2E__?.damageBoss(amount), redBoss.simulation.bossHealth);
  assert((await snapshot(page))?.simulation?.bossDefeated, 'Firestarter mobile boss lifecycle did not reach defeat.');
  await page.getByRole('button', { name: 'RETURN TO WORK' }).tap();
  await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.clockOut());
  await page.locator('#result-screen.is-visible').waitFor({ timeout: 3_000 });
  assert.equal(await page.locator('#result-boss').innerText(), 'DIRECTOR DEFEATED');

  const performanceState = soakState.performance;
  const longFrameRatio = performanceState.sampledFrames > 0 ? performanceState.framesOver33Ms / performanceState.sampledFrames : 1;
  assert(performanceState.sampledFrames >= 1_000, `Insufficient sustained frame sample: ${performanceState.sampledFrames}.`);
  assert(performanceState.averageFrameMs <= 25, `Average frame time was ${performanceState.averageFrameMs.toFixed(2)}ms.`);
  assert(performanceState.actualFps >= 40, `Reported FPS was ${performanceState.actualFps.toFixed(1)}.`);
  assert(longFrameRatio <= 0.08, `Long-frame ratio was ${(longFrameRatio * 100).toFixed(2)}%.`);
  assert(maximumEntities.hazards <= 160 && maximumEntities.projectiles <= 100 && maximumEntities.coins <= 120, 'Entity pool limit exceeded.');
  const heapAfter = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);

  await page.getByRole('button', { name: 'MAIN MENU' }).tap();
  await page.locator('#mute-button').tap();
  assert.equal(await page.locator('#mute-button').innerText(), 'SOUND OFF');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'CORPORATE CHAOS' }).waitFor();
  assert.equal(await page.locator('#mute-button').innerText(), 'SOUND OFF', 'Mute preference did not survive reload.');
  await page.locator('#mute-button').tap();
  assert.equal(await page.locator('#mute-button').innerText(), 'SOUND ON');

  await primaryContext.close();
  if (browserErrors.length) throw new Error(browserErrors.join('\n'));

  summary = JSON.stringify({
    ok: true,
    evidenceType: 'desktop Chromium Android emulation; not physical-device evidence',
    layoutMatrix,
    portraitGateVerified: true,
    touchVerified: ['continuous hold', 'release to zero', 'two-pointer diagonal', 'touch dash', '44px targets', 'pause/dash non-overlap'],
    lifecycleVerified: ['background pause', 'input clear', 'audio suspend/resume', 'victory', 'defeat', 'replay', 'cleanup'],
    charactersVerified: ['blue-recruit', 'red-recruit'],
    bossPhasesVerified: [1, 2, 3, 4],
    minimumBossSpawnDistance: Math.min(...safeDistances),
    acceleratedShift: { simulatedSeconds: soakState.simulation.elapsed, balanceRate: soakState.balanceRate },
    performance: {
      ...performanceState,
      longFrameRatio,
      maximumEntities,
      heapBefore,
      heapAfter,
      heapDelta: heapBefore !== null && heapAfter !== null ? heapAfter - heapBefore : null,
    },
    audioVerified: ['user-gesture unlock', 'background suspend', 'resume gesture', 'mute persistence'],
    physicalAndroidDeviceVerified: false,
    screenshots: outputDir,
  }, null, 2);
} catch (error) {
  exitCode = 1;
  summary = error instanceof Error ? (error.stack ?? error.message) : String(error);
} finally {
  await Promise.race([browser.close(), new Promise((resolve) => setTimeout(resolve, 3_000))]);
  writeSync(exitCode === 0 ? 1 : 2, `${summary}\n`);
  process.exit(exitCode);
}
