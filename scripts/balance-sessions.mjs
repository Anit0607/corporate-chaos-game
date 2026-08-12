import assert from 'node:assert/strict';
import { existsSync, writeSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseUrl = process.env.GAME_URL ?? 'http://127.0.0.1:4173';
const cohort = process.env.BALANCE_COHORT ?? 'baseline';
const sessionCount = Number(process.env.BALANCE_SESSION_COUNT ?? 30);
const concurrency = Number(process.env.BALANCE_CONCURRENCY ?? 4);
const balanceRate = Number(process.env.BALANCE_RATE ?? 6);
const durationSeconds = Number(process.env.BALANCE_DURATION_SECONDS ?? 360);
const maximumRealMs = Number(process.env.BALANCE_MAX_REAL_MS ?? 100_000);
const controlIntervalMs = Number(process.env.BALANCE_CONTROL_INTERVAL_MS ?? 40);
const outputDir = path.resolve(process.env.BALANCE_OUTPUT_DIR ?? 'docs/balance');
const screenshotDir = path.resolve('playwright-report', `milestone-3-${cohort}`);
const hazards = ['email', 'meeting', 'kpi', 'manager', 'hr', 'client', 'deadline', 'review'];
const perks = ['coffee', 'reply', 'shield', 'escape', 'printer', 'snack'];
const events = ['reply-storm', 'wellness-hour', 'calendar-purge', 'performance-review', 'printer-rebellion'];
const strategies = ['aggressive', 'balanced', 'defensive'];
const executablePath = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean).find(existsSync);

if (!executablePath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH to a Chromium executable.');
assert(Number.isInteger(sessionCount) && sessionCount > 0, 'BALANCE_SESSION_COUNT must be a positive integer.');
assert(Number.isInteger(concurrency) && concurrency > 0, 'BALANCE_CONCURRENCY must be a positive integer.');
assert(Number.isFinite(controlIntervalMs) && controlIntervalMs >= 16, 'BALANCE_CONTROL_INTERVAL_MS must be at least 16ms.');

await mkdir(outputDir, { recursive: true });
await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});

const snapshot = (page) => page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.snapshot());

const sessionConfig = (index) => ({
  index,
  id: `${cohort}-${String(index + 1).padStart(2, '0')}`,
  seed: 310_001 + index * 7_919,
  character: index % 2 === 0 ? 'red-recruit' : 'blue-recruit',
  strategy: strategies[Math.floor(index / 2) % strategies.length],
});

const rotate = (values, amount) => values.map((_, index) => values[(index + amount) % values.length]);

const perkPriority = (config) => {
  const base = config.strategy === 'aggressive'
    ? ['reply', 'printer', 'coffee', 'escape', 'shield', 'snack']
    : config.strategy === 'defensive'
      ? ['shield', 'snack', 'escape', 'coffee', 'reply', 'printer']
      : ['coffee', 'shield', 'reply', 'snack', 'printer', 'escape'];
  return rotate(base, Math.floor(config.index / 6) % base.length);
};

const updateKeys = async (page, held, desired) => {
  for (const key of held) {
    if (!desired.has(key)) {
      await page.keyboard.up(key);
      held.delete(key);
    }
  }
  for (const key of desired) {
    if (!held.has(key)) {
      await page.keyboard.down(key);
      held.add(key);
    }
  }
};

const steering = (state, strategy, tick) => {
  const player = state.player;
  const centerX = 640;
  const centerY = 430;
  let x = (centerX - player.x) * 0.002;
  let y = (centerY - player.y) * 0.002;
  const clockwise = Math.floor(tick / 35) % 2 === 0 ? 1 : -1;
  x += -(player.y - centerY) * 0.0013 * clockwise;
  y += (player.x - centerX) * 0.0013 * clockwise;
  let nearest = Number.POSITIVE_INFINITY;
  const avoidance = strategy === 'defensive' ? 2.1 : strategy === 'balanced' ? 1.35 : 0.82;
  for (const hazard of state.hazardActors) {
    const dx = player.x - hazard.x;
    const dy = player.y - hazard.y;
    const distanceSq = Math.max(900, dx * dx + dy * dy);
    const distance = Math.sqrt(distanceSq);
    nearest = Math.min(nearest, distance);
    const pressure = (hazard.kind === 'boss' ? 1.35 : 1) * avoidance * 18_000 / distanceSq;
    x += (dx / distance) * pressure;
    y += (dy / distance) * pressure;
  }
  const length = Math.hypot(x, y) || 1;
  x /= length;
  y /= length;
  const keys = new Set();
  if (x > 0.22) keys.add('ArrowRight');
  if (x < -0.22) keys.add('ArrowLeft');
  if (y > 0.22) keys.add('ArrowDown');
  if (y < -0.22) keys.add('ArrowUp');
  return { keys, nearest };
};

const runSession = async (config) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  const offers = [];
  const held = new Set();
  let tick = 0;
  let timedOut = false;
  const startedAt = Date.now();
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));

  try {
    const url = `${baseUrl}/?duration=${durationSeconds}&seed=${config.seed}&e2e=1&balance=1&balanceRate=${balanceRate}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'CLOCK IN' }).click();
    await page.locator(`[data-character="${config.character}"]`).click();
    await page.getByRole('button', { name: 'ENTER THE OFFICE' }).click();
    await page.locator('#hud.is-visible').waitFor();
    assert.equal((await snapshot(page))?.balanceRate, balanceRate);

    const priority = perkPriority(config);
    while (Date.now() - startedAt < maximumRealMs) {
      if (await page.locator('#result-screen.is-visible').isVisible()) break;
      const perkButtons = page.locator('#perk-modal.is-visible [data-perk]');
      if (await perkButtons.first().isVisible()) {
        const offered = await perkButtons.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-perk')));
        const selected = priority.find((id) => offered.includes(id)) ?? offered[0];
        offers.push({ offered, selected });
        await page.locator(`[data-perk="${selected}"]`).click();
        await page.waitForTimeout(45);
        continue;
      }

      const state = await snapshot(page);
      if (!state?.running) {
        await page.waitForTimeout(50);
        continue;
      }
      const { keys, nearest } = steering(state, config.strategy, tick);
      await updateKeys(page, held, keys);
      const dashThreshold = config.strategy === 'aggressive' ? 360 : config.strategy === 'balanced' ? 230 : 175;
      if (state.player.dashReady && nearest < dashThreshold) {
        await page.keyboard.down('Space');
        await page.waitForTimeout(18);
        await page.keyboard.up('Space');
      }
      tick += 1;
      await page.waitForTimeout(controlIntervalMs);
    }

    await updateKeys(page, held, new Set());
    if (!(await page.locator('#result-screen.is-visible').isVisible())) {
      timedOut = true;
      await page.evaluate(() => window.__CORPORATE_CHAOS_E2E__?.defeatPlayer());
      await page.locator('#result-screen.is-visible').waitFor({ timeout: 4_000 });
    }
    await page.waitForTimeout(120);
    const final = await snapshot(page);
    assert(final?.simulation?.finished, 'Session ended without a finished simulation.');
    if ([0, Math.floor(sessionCount / 2), sessionCount - 1].includes(config.index)) {
      await page.screenshot({ path: path.join(screenshotDir, `${config.id}-${final.simulation.won ? 'victory' : 'defeat'}.png`) });
    }
    if (errors.length) throw new Error(errors.join('\n'));

    return {
      ...config,
      cohort,
      acceleratedRate: balanceRate,
      realSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
      timedOut,
      outcome: final.simulation.won ? 'victory' : timedOut ? 'timeout' : 'defeat',
      survivedSeconds: Number(final.simulation.elapsed.toFixed(2)),
      damageReceived: final.telemetry.damageReceived,
      blockedHits: final.telemetry.blockedHits,
      deadlineDetonations: final.telemetry.deadlineDetonations,
      deadlineDodges: final.telemetry.deadlineDodges,
      coins: final.simulation.runCoins,
      score: final.simulation.score,
      hazardsCleared: final.simulation.hazardsCleared,
      finalEnergy: final.simulation.energy,
      perkChoices: final.telemetry.perkChoices,
      perkOffers: offers,
      events: final.telemetry.eventHistory,
      bossPhaseReached: final.telemetry.bossPhaseReached,
      bossDefeated: final.simulation.bossDefeated,
      bossHealthRemaining: Number(final.simulation.bossHealth.toFixed(2)),
      spawnedByHazard: final.telemetry.spawnedByHazard,
      clearedByHazard: final.telemetry.clearedByHazard,
      damageBySource: final.telemetry.damageBySource,
    };
  } finally {
    await context.close();
  }
};

const average = (values) => values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;
const summarize = (sessions) => {
  const characterSummary = Object.fromEntries(['red-recruit', 'blue-recruit'].map((character) => {
    const rows = sessions.filter((session) => session.character === character);
    return [character, {
      sessions: rows.length,
      victories: rows.filter((row) => row.outcome === 'victory').length,
      timeouts: rows.filter((row) => row.outcome === 'timeout').length,
      averageSurvival: average(rows.map((row) => row.survivedSeconds)),
      averageDamage: average(rows.map((row) => row.damageReceived)),
      averageScore: average(rows.map((row) => row.score)),
      averageCoins: average(rows.map((row) => row.coins)),
      averageClears: average(rows.map((row) => row.hazardsCleared)),
      bossReached: rows.filter((row) => row.bossPhaseReached > 0).length,
      bossDefeated: rows.filter((row) => row.bossDefeated).length,
    }];
  }));

  const hazardSummary = Object.fromEntries(hazards.map((hazard) => {
    const spawned = sessions.reduce((sum, row) => sum + row.spawnedByHazard[hazard], 0);
    const cleared = sessions.reduce((sum, row) => sum + row.clearedByHazard[hazard], 0);
    const damage = sessions.reduce((sum, row) => sum + row.damageBySource[hazard], 0);
    return [hazard, { spawned, cleared, clearRate: spawned ? Number((cleared / spawned).toFixed(3)) : 0, damage }];
  }));

  const perkSummary = Object.fromEntries(perks.map((perk) => {
    let offered = 0;
    let selected = 0;
    for (const row of sessions) {
      for (const offer of row.perkOffers) {
        if (offer.offered.includes(perk)) offered += 1;
        if (offer.selected === perk) selected += 1;
      }
    }
    return [perk, { offered, selected, pickWhenOffered: offered ? Number((selected / offered).toFixed(3)) : 0 }];
  }));

  const eventSummary = Object.fromEntries(events.map((event) => [event, {
    appearances: sessions.filter((row) => row.events.includes(event)).length,
    victories: sessions.filter((row) => row.events.includes(event) && row.outcome === 'victory').length,
    averageDamage: average(sessions.filter((row) => row.events.includes(event)).map((row) => row.damageReceived)),
  }]));

  return {
    cohort,
    generatedAt: new Date().toISOString(),
    sessions: sessions.length,
    durationSeconds,
    acceleratedRate: balanceRate,
    outcomes: {
      victories: sessions.filter((row) => row.outcome === 'victory').length,
      defeats: sessions.filter((row) => row.outcome === 'defeat').length,
      timeouts: sessions.filter((row) => row.outcome === 'timeout').length,
    },
    characters: characterSummary,
    hazards: hazardSummary,
    perks: perkSummary,
    events: eventSummary,
    bossPhaseDistribution: Object.fromEntries([0, 1, 2, 3, 4].map((phase) => [phase, sessions.filter((row) => row.bossPhaseReached === phase).length])),
  };
};

const csvEscape = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const toCsv = (sessions) => {
  const columns = [
    'id', 'cohort', 'seed', 'character', 'strategy', 'outcome', 'survivedSeconds', 'damageReceived', 'blockedHits',
    'deadlineDetonations', 'deadlineDodges',
    'coins', 'score', 'hazardsCleared', 'finalEnergy', 'perkChoices', 'events', 'bossPhaseReached', 'bossDefeated',
    'bossHealthRemaining', 'realSeconds', 'timedOut',
    ...hazards.flatMap((hazard) => [`spawned_${hazard}`, `cleared_${hazard}`, `damage_${hazard}`]),
  ];
  const value = (row, column) => {
    if (column === 'perkChoices') return row.perkChoices.join('|');
    if (column === 'events') return row.events.join('|');
    for (const hazard of hazards) {
      if (column === `spawned_${hazard}`) return row.spawnedByHazard[hazard];
      if (column === `cleared_${hazard}`) return row.clearedByHazard[hazard];
      if (column === `damage_${hazard}`) return row.damageBySource[hazard];
    }
    return row[column];
  };
  return `${columns.join(',')}\n${sessions.map((row) => columns.map((column) => csvEscape(value(row, column))).join(',')).join('\n')}\n`;
};

const checkpointPath = path.join(outputDir, `milestone-3-${cohort}-checkpoint.json`);
const results = process.env.BALANCE_RESUME === '1' && existsSync(checkpointPath)
  ? JSON.parse(await readFile(checkpointPath, 'utf8'))
  : [];
const completedIndexes = new Set(results.map((result) => result.index));
const configs = Array.from({ length: sessionCount }, (_, index) => sessionConfig(index))
  .filter((config) => !completedIndexes.has(config.index));
let nextIndex = 0;
let checkpointWrites = Promise.resolve();
const checkpoint = async () => {
  const completed = [...results].sort((a, b) => a.index - b.index);
  checkpointWrites = checkpointWrites.then(() => writeFile(checkpointPath, `${JSON.stringify(completed, null, 2)}\n`));
  await checkpointWrites;
};
const workers = Array.from({ length: Math.min(concurrency, configs.length) }, async (_, workerIndex) => {
  while (true) {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= configs.length) return;
    const config = configs[index];
    const result = await runSession(config);
    results.push(result);
    await checkpoint();
    writeSync(2, `[balance ${workerIndex + 1}] ${result.id} ${result.character} ${result.strategy}: ${result.outcome} at ${Math.round(result.survivedSeconds)}s, phase ${result.bossPhaseReached}\n`);
  }
});

try {
  await Promise.all(workers);
  results.sort((a, b) => a.index - b.index);
  const summary = summarize(results);
  await writeFile(path.join(outputDir, `milestone-3-${cohort}-sessions.json`), `${JSON.stringify(results, null, 2)}\n`);
  await writeFile(path.join(outputDir, `milestone-3-${cohort}-sessions.csv`), toCsv(results));
  await writeFile(path.join(outputDir, `milestone-3-${cohort}-summary.json`), `${JSON.stringify(summary, null, 2)}\n`);
  writeSync(1, `${JSON.stringify(summary, null, 2)}\n`);
} finally {
  await browser.close();
}
