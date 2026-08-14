import assert from 'node:assert/strict';
import { existsSync, writeSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseUrl = process.env.GAME_URL ?? 'http://127.0.0.1:4173';
const outputDir = path.resolve('playwright-report', 'lifecycle-smoke');
const executablePath = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean).find(existsSync);

if (!executablePath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH to a Chromium executable.');

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
const snapshot = (page) => page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.snapshot());

const waitUntil = async (page, check, label, timeoutMs = 12_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
};

const driveUntil = async (page, check, label, timeoutMs, maintainEnergy = false, handleIncidentalPerks = true) => {
  const directions = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  const deadline = Date.now() + timeoutMs;
  let held;
  let step = 0;
  try {
    while (Date.now() < deadline) {
      if (await check()) return;
      if (await page.locator('#result-screen.is-visible').isVisible()) {
        throw new Error(`Run ended before ${label}.`);
      }
      if (maintainEnergy) {
        const state = await snapshot(page);
        if ((state?.simulation?.energy ?? 100) < (state?.simulation?.maxEnergy ?? 100) * 0.9) {
          await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.restorePlayer());
        }
      }
      if (handleIncidentalPerks) {
        const followupPerk = page.locator('#perk-modal.is-visible [data-perk]').first();
        if (await followupPerk.isVisible()) {
          await followupPerk.click();
          await page.waitForTimeout(120);
          continue;
        }
      }
      const direction = directions[Math.floor(step / 6) % directions.length];
      if (direction !== held) {
        if (held) await page.keyboard.up(held);
        held = direction;
        await page.keyboard.down(held);
      }
      await page.keyboard.press('Space');
      step += 1;
      await page.waitForTimeout(240);
    }
  } finally {
    if (held) await page.keyboard.up(held);
  }
  const state = await snapshot(page);
  throw new Error(`Timed out driving toward ${label}. Snapshot: ${JSON.stringify({
    running: state?.running,
    manuallyPaused: state?.manuallyPaused,
    perkPaused: state?.perkPaused,
    elapsed: state?.simulation?.elapsed,
    energy: state?.simulation?.energy,
    finished: state?.simulation?.finished,
  })}`);
};

const enterShift = async (page, character) => {
  await page.getByRole('button', { name: 'CLOCK IN' }).click();
  await page.getByRole('heading', { name: 'Choose your recruit' }).waitFor();
  await page.locator(`[data-character="${character}"]`).click();
  await page.getByRole('heading', { name: 'Welcome to Chaos Corp.' }).waitFor();
  await page.getByRole('button', { name: 'ENTER THE OFFICE' }).click();
  await page.locator('#hud.is-visible').waitFor();
};

const assertPerkEffect = (id, before, after) => {
  if (id === 'coffee') assert(after.moveSpeedMultiplier > before.moveSpeedMultiplier, 'Coffee Rush did not increase movement.');
  if (id === 'reply') {
    assert(after.fireDelayMultiplier < before.fireDelayMultiplier, 'Reply-All Blast did not increase fire rate.');
    assert(after.projectileDamageBonus > before.projectileDamageBonus, 'Reply-All Blast did not increase damage.');
  }
  if (id === 'shield') assert(after.damageTakenMultiplier < before.damageTakenMultiplier, 'KPI Shield did not reduce damage.');
  if (id === 'escape') {
    assert(after.dashDurationBonusMs > before.dashDurationBonusMs, 'Meeting Escape did not extend the dash.');
    assert(after.dashCooldownMultiplier < before.dashCooldownMultiplier, 'Meeting Escape did not reduce cooldown.');
  }
  if (id === 'printer') {
    assert(after.projectilePierce > before.projectilePierce, 'Printer Rage did not add penetration.');
    assert(after.scoreMultiplier > before.scoreMultiplier, 'Printer Rage did not increase score.');
  }
};

let exitCode = 0;
let summary = '';
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  attachDiagnostics(page);
  await page.goto(`${baseUrl}/?duration=60&seed=20260812&e2e=1`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'CORPORATE CHAOS' }).waitFor();
  await waitUntil(page, async () => Boolean(await snapshot(page)), 'E2E bridge');
  await capture(page, '01-menu');

  await page.getByRole('button', { name: 'CLOCK IN' }).click();
  await page.getByRole('heading', { name: 'Choose your recruit' }).waitFor();
  await capture(page, '02-character-selection');
  await page.locator('[data-character="blue-recruit"]').click();
  await page.getByRole('heading', { name: 'Welcome to Chaos Corp.' }).waitFor();
  assert.match(await page.locator('#briefing-copy').innerText(), /blocks one incoming hit/i);
  await capture(page, '03-briefing');
  await page.getByRole('button', { name: 'ENTER THE OFFICE' }).click();
  await page.locator('#hud.is-visible').waitFor();

  const initial = await snapshot(page);
  assert(initial?.running && initial.simulation, 'Run did not start in the simulation.');
  assert.equal(initial.character, 'blue-recruit');
  assert.equal(initial.simulation.maxEnergy, 118);
  assert.equal(initial.player.texture, 'player-blue');
  assert.equal(await page.locator('#hud').getAttribute('data-character'), 'blue-recruit');
  const stableSubscriptions = initial.sceneSubscriptions;
  const stableBusListeners = initial.busListeners;

  const startX = initial.player.x;
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(650);
  const moved = await snapshot(page);
  assert((moved?.player.x ?? 0) > startX + 10, 'Keyboard movement did not move the player right.');
  await waitUntil(page, async () => Boolean((await snapshot(page))?.player.dashReady), 'dash ready');
  await page.keyboard.down('Space');
  try {
    await waitUntil(page, async () => Boolean((await snapshot(page))?.player.dashing), 'dash start', 2_000);
  } finally {
    await page.keyboard.up('Space');
  }
  await waitUntil(page, async () => /RECHARGING/.test(await page.locator('#dash-chip').innerText()), 'dash HUD feedback', 2_000);
  assert.match(await page.locator('#dash-chip').innerText(), /RECHARGING/);
  await page.keyboard.up('ArrowRight');
  await waitUntil(page, async () => (await snapshot(page))?.activeEntities.projectiles > 0, 'automatic combat projectile', 5_000);
  await capture(page, '04-keyboard-combat');

  await page.keyboard.down('Escape');
  try {
    await page.locator('#pause-modal.is-visible').waitFor();
  } finally {
    await page.keyboard.up('Escape');
  }
  const pausedAt = (await snapshot(page))?.simulation?.elapsed ?? 0;
  await page.waitForTimeout(750);
  const pausedAfter = (await snapshot(page))?.simulation?.elapsed ?? 0;
  assert(Math.abs(pausedAfter - pausedAt) < 0.05, 'Simulation advanced while paused with Escape.');
  await page.keyboard.down('Escape');
  try {
    await page.locator('#pause-modal').waitFor({ state: 'hidden' });
  } finally {
    await page.keyboard.up('Escape');
  }

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.locator('#pause-modal.is-visible').waitFor();
  assert((await snapshot(page))?.manuallyPaused, 'Focus loss did not pause the Phaser scene.');
  await page.getByRole('button', { name: 'RETURN TO WORK' }).click();
  await page.locator('#pause-modal').waitFor({ state: 'hidden' });

  await driveUntil(page, () => page.locator('#perk-modal.is-visible').isVisible(), 'perk offer', 45_000, true, false);
  const perkOptions = page.locator('#perk-modal.is-visible [data-perk]');
  assert.equal(await perkOptions.count(), 3);
  const offered = await perkOptions.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-perk')));
  const preference = ['snack', 'shield', 'coffee', 'reply', 'escape', 'printer'];
  const selectedPerk = preference.find((id) => offered.includes(id)) ?? offered[0];
  assert(selectedPerk, 'No selectable perk was offered.');
  const beforePerk = await snapshot(page);
  const selectedButton = page.locator(`[data-perk="${selectedPerk}"]`);
  const selectedName = await selectedButton.locator('strong').innerText();
  await capture(page, '05-perk-offer');
  await selectedButton.click();
  await waitUntil(page, async () => (await snapshot(page))?.simulation?.perks[selectedPerk] === 1, 'perk application');
  const afterPerk = await snapshot(page);
  await waitUntil(page, async () => (await page.locator('#hud').getAttribute('data-perks'))?.split(' ').includes(selectedPerk), 'perk HUD synchronization');
  await waitUntil(page, async () => new RegExp(selectedName, 'i').test(await page.locator('#toast').innerText()), 'perk toast synchronization');
  assert.equal(await page.locator('#hud').getAttribute('data-perks'), selectedPerk);
  assert.match(await page.locator('#toast').innerText(), new RegExp(selectedName, 'i'));
  if (selectedPerk === 'snack') assert.equal(afterPerk?.simulation?.maxEnergy, (beforePerk?.simulation?.maxEnergy ?? 0) + 8);
  else assertPerkEffect(selectedPerk, beforePerk.simulation.modifiers, afterPerk.simulation.modifiers);

  await driveUntil(page, () => page.locator('#event-banner.is-visible').isVisible(), 'corporate event', 35_000, true);
  const eventStarted = await snapshot(page);
  const eventId = eventStarted?.simulation?.activeEventId;
  assert(eventId, 'Event banner appeared without an active simulation event.');
  assert.equal(await page.locator('#event-banner').getAttribute('data-event-id'), eventId);
  const eventEndsAt = eventStarted.simulation.activeEventEndsAt;
  await capture(page, '06-corporate-event');

  await page.locator('#pause-button').click();
  await page.locator('#pause-modal.is-visible').waitFor();
  await page.waitForTimeout(800);
  assert(await page.locator('#event-banner.is-visible').isVisible(), 'Event banner expired on wall-clock time while paused.');
  assert.equal((await snapshot(page))?.simulation?.activeEventId, eventId);
  await page.getByRole('button', { name: 'RETURN TO WORK' }).click();
  await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.restorePlayer());
  await driveUntil(page, async () => (await snapshot(page))?.simulation?.activeEventId === null, 'event expiration', 30_000, true);
  await page.locator('#event-banner').waitFor({ state: 'hidden' });
  assert(((await snapshot(page))?.simulation?.elapsed ?? 0) >= eventEndsAt, 'Event presentation ended before simulation expiration.');
  await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.restorePlayer());

  await driveUntil(page, () => page.locator('#boss-hud.is-visible').isVisible(), 'boss encounter', 25_000, true);
  const entrance = await snapshot(page);
  assert(entrance?.bossPresentation.introActive, 'Boss HUD appeared after the entrance window had already ended.');
  assert(entrance?.bossPresentation.auraActive, 'Regional Director entrance did not create its identity aura.');
  assert.equal(await page.locator('#boss-hud').evaluate((element) => element.style.getPropertyValue('--boss-accent')), '#ff4d8d');
  await page.locator('#boss-announcement.is-visible').waitFor();
  assert.equal(await page.locator('#boss-announcement-title').innerText(), 'THE REGIONAL DIRECTOR');
  await capture(page, '07-boss-entrance');
  await waitUntil(page, async () => !(await snapshot(page))?.bossPresentation.introActive, 'boss entrance completion', 8_000);
  await page.locator('#pause-button').click();
  await page.locator('#pause-modal.is-visible').waitFor();
  let boss = await snapshot(page);
  assert(boss?.simulation?.bossStarted, 'Boss HUD appeared before the simulation boss started.');

  for (const target of [
    { ratio: 0.74, phase: 2, name: 'CALENDAR CONTROL', accent: '#b46cff' },
    { ratio: 0.49, phase: 3, name: 'CLIENT ESCALATION', accent: '#ff9f43' },
    { ratio: 0.24, phase: 4, name: 'PERFORMANCE PLAN', accent: '#5ce1e6' },
  ]) {
    const simulation = boss.simulation;
    const damage = simulation.bossHealth - simulation.bossMaxHealth * target.ratio;
    await page.evaluate((amount) => window.__CORPORATE_CHAOS_E2E__?.damageBoss(amount), damage);
    boss = await snapshot(page);
    assert.equal(boss?.simulation?.bossPhase, target.phase);
    assert.equal(boss?.bossPresentation.phaseName, target.name);
    assert.equal(await page.locator('#boss-phase').innerText(), `PHASE ${target.phase}`);
    assert.equal(await page.locator('#boss-phase-name').innerText(), target.name);
    assert.equal(await page.locator('#boss-hud').evaluate((element) => element.style.getPropertyValue('--boss-accent')), target.accent);
    assert.equal(Number(await page.locator('#boss-hud').getAttribute('data-phase')), target.phase);
    const fill = Number.parseFloat(await page.locator('#boss-fill').evaluate((element) => element.style.width));
    const authoritative = (boss.simulation.bossHealth / boss.simulation.bossMaxHealth) * 100;
    assert(Math.abs(fill - authoritative) < 0.2, `Boss fill ${fill} did not match simulation ${authoritative}.`);
  }
  await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.primeBossAttack());
  await page.getByRole('button', { name: 'RETURN TO WORK' }).click();
  await page.locator('#pause-modal').waitFor({ state: 'hidden' });
  await driveUntil(page, async () => Boolean((await snapshot(page))?.bossPresentation.attackPending), 'phase-four attack telegraph', 12_000, true);
  const warning = await snapshot(page);
  assert.equal(warning?.bossPresentation.attackTargets.length, 2);
  const safeTargetDistances = warning.bossPresentation.attackTargets.map((target) => Math.hypot(target.x - warning.player.x, target.y - warning.player.y));
  safeTargetDistances.forEach((distance) => {
    assert(distance >= 224, `Boss attack target spawned unfairly close to the player: ${distance.toFixed(1)}px.`);
  });
  await page.locator('#boss-warning.is-visible').waitFor();
  assert.equal(await page.locator('#boss-warning b').innerText(), 'PIP DROP ZONE');
  await capture(page, '08-boss-phase-four-telegraph');
  await driveUntil(page, async () => !(await snapshot(page))?.bossPresentation.attackPending, 'phase-four attack execution', 5_000, true);
  await page.locator('#pause-button').click();
  await page.locator('#pause-modal.is-visible').waitFor();
  await page.evaluate((amount) => window.__CORPORATE_CHAOS_E2E__?.damageBoss(amount), boss.simulation.bossHealth);
  const defeatedBoss = await snapshot(page);
  assert(defeatedBoss?.simulation?.bossDefeated, 'Boss defeat did not reach authoritative state.');
  assert(defeatedBoss?.bossPresentation.defeatPlaying, 'Boss defeat sequence did not enter its presentation state.');
  await page.locator('#boss-announcement.is-visible').waitFor();
  assert.equal(await page.locator('#boss-announcement-title').innerText(), 'DIRECTOR OFFLINE');
  await page.getByRole('button', { name: 'RETURN TO WORK' }).click();
  await page.locator('#pause-modal').waitFor({ state: 'hidden' });
  await capture(page, '09-boss-defeat');
  await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.clockOut());
  await page.locator('#result-screen.is-visible').waitFor({ timeout: 5_000 });
  await page.waitForTimeout(350);
  assert.match(await page.locator('#result-kicker').innerText(), /5:00 PM/);
  assert.equal(await page.locator('#result-boss').innerText(), 'DIRECTOR DEFEATED');
  const victoryCleanup = await snapshot(page);
  assert.equal(victoryCleanup?.running, false);
  assert.deepEqual(victoryCleanup?.activeEntities, { hazards: 0, projectiles: 0, coins: 0, effects: 0, timers: 0 });
  await capture(page, '10-victory-result');

  await page.getByRole('button', { name: 'WORK ANOTHER SHIFT' }).click();
  await page.locator('#hud.is-visible').waitFor();
  await page.waitForTimeout(350);
  const replay = await snapshot(page);
  assert(replay?.running && (replay.simulation?.elapsed ?? 99) < 1, 'Replay did not start a fresh simulation.');
  assert.deepEqual(replay.simulation?.perks, {});
  assert.equal(replay.sceneSubscriptions, stableSubscriptions);
  assert.equal(replay.busListeners, stableBusListeners);
  await capture(page, '11-replay');

  await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.defeatPlayer());
  await page.locator('#result-screen.is-visible').waitFor({ timeout: 3_000 });
  await page.waitForTimeout(350);
  assert.equal(await page.locator('#result-kicker').innerText(), 'PERFORMANCE INTERRUPTED');
  const defeatCleanup = await snapshot(page);
  assert.deepEqual(defeatCleanup?.activeEntities, { hazards: 0, projectiles: 0, coins: 0, effects: 0, timers: 0 });
  await capture(page, '12-defeat-result');

  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await enterShift(page, 'red-recruit');
  const firestarter = await snapshot(page);
  assert.equal(firestarter?.character, 'red-recruit');
  assert.equal(firestarter?.simulation?.maxEnergy, 92);
  assert.equal(firestarter?.player.texture, 'player-red');
  assert.equal(await page.locator('#hud').getAttribute('data-character'), 'red-recruit');
  await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.prepareBoss(['reply', 'printer']));
  await driveUntil(page, () => page.locator('#boss-hud.is-visible').isVisible(), 'Firestarter boss encounter', 8_000, true);
  const firestarterBoss = await snapshot(page);
  assert.equal(firestarterBoss?.simulation?.perks.reply, 1);
  assert.equal(firestarterBoss?.simulation?.perks.printer, 1);
  assert(firestarterBoss?.bossPresentation.introActive, 'Firestarter build did not receive the boss entrance sequence.');
  await page.locator('#pause-button').click();
  await page.locator('#pause-modal.is-visible').waitFor();
  const bossHealth = firestarterBoss.simulation.bossHealth;
  await page.evaluate((amount) => window.__CORPORATE_CHAOS_E2E__?.damageBoss(amount), bossHealth * 0.78);
  assert.equal((await snapshot(page))?.simulation?.bossPhase, 4);
  await page.evaluate((amount) => window.__CORPORATE_CHAOS_E2E__?.damageBoss(amount), bossHealth);
  assert((await snapshot(page))?.simulation?.bossDefeated, 'Firestarter Reply/Printer build did not complete the boss lifecycle.');
  await page.getByRole('button', { name: 'RETURN TO WORK' }).click();
  await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.clockOut());
  await page.locator('#result-screen.is-visible').waitFor({ timeout: 3_000 });
  assert.equal(await page.locator('#result-boss').innerText(), 'DIRECTOR DEFEATED');

  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto(`${baseUrl}/?duration=30&seed=20260812&e2e=1`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'CLOCK IN' }).click();
  await page.getByRole('heading', { name: 'Choose your recruit' }).waitFor();
  const panelBox = await page.locator('.character-panel').boundingBox();
  assert(panelBox && panelBox.y >= 0 && panelBox.y + panelBox.height <= 601, `Compact character panel is clipped: ${JSON.stringify(panelBox)}`);
  await page.locator('[data-character="blue-recruit"]').click();
  await page.getByRole('button', { name: 'ENTER THE OFFICE' }).click();
  await page.locator('#touch-controls').waitFor({ state: 'visible' });
  await page.waitForTimeout(350);
  await capture(page, '13-compact-gameplay');

  if (browserErrors.length) throw new Error(browserErrors.join('\n'));
  summary = JSON.stringify({
    ok: true,
    lifecycle: ['menu', 'character', 'briefing', 'run', 'perk', 'event', 'boss', 'victory', 'result', 'replay', 'defeat'],
    inputs: ['keyboard movement', 'dash', 'automatic combat', 'Escape pause/resume', 'focus-loss pause'],
    selectedPerk,
    eventId,
    bossPhasesVerified: [1, 2, 3, 4],
    bossPolishVerified: ['entrance', 'unique phase identity', 'attack warning', 'safe spawn distance', 'defeat sequence', '5 PM hold'],
    bossBuildsVerified: [
      { character: 'blue-recruit', perks: [selectedPerk] },
      { character: 'red-recruit', perks: ['reply', 'printer'] },
    ],
    minimumBossSpawnDistance: Math.min(...safeTargetDistances),
    cleanupVerified: true,
    characterIntegrationVerified: ['blue-recruit', 'red-recruit'],
    compactLayoutVerified: true,
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
