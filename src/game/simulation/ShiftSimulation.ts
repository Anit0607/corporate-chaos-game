import { characterById, type CharacterId } from '../content/characters';
import { CORPORATE_EVENTS, type CorporateEventDefinition, type CorporateEventId } from '../content/corporateEvents';
import { choosePerks } from '../content/perks';
import type { HudSnapshot, RunResult } from '../events';
import { SeededRandom } from '../random';

export interface DifficultySnapshot {
  spawnEveryMs: number;
  hazardSpeed: number;
  hazardHealth: number;
  waveLabel: string;
}

export interface ShiftSimulationOptions {
  durationSeconds?: number;
  character?: CharacterId;
  seed?: number;
}

export interface BossDamageResult {
  defeated: boolean;
  phaseChanged: boolean;
  phase: number;
}

export interface GameplayModifiers {
  moveSpeedMultiplier: number;
  fireDelayMultiplier: number;
  projectileDamageBonus: number;
  damageTakenMultiplier: number;
  dashDurationBonusMs: number;
  dashCooldownMultiplier: number;
  projectilePierce: number;
  pickupRadiusBonus: number;
  scoreMultiplier: number;
}

export class ShiftSimulation {
  readonly duration: number;
  readonly character: CharacterId;
  readonly seed: number;
  readonly bossLeadSeconds: number;
  readonly bossStartAt: number;
  readonly bossMaxHealth: number;
  readonly perks = new Map<string, number>();
  readonly random: SeededRandom;

  elapsed = 0;
  energy: number;
  maxEnergy: number;
  score = 0;
  runCoins = 0;
  chaos = 0;
  chaosSeconds = 0;
  hazardsCleared = 0;
  finished = false;
  won = false;
  upgradeIndex = 0;
  eventIndex = 0;
  activeEvent: CorporateEventDefinition | null = null;
  activeEventEndsAt = 0;
  bossStarted = false;
  bossDefeated = false;
  bossHealth: number;
  bossPhase = 0;
  boundaryCharges = 1;
  boundaryRechargeAt = 0;

  private lastEventId = '';

  constructor(options: number | ShiftSimulationOptions = {}) {
    const normalized = typeof options === 'number' ? { durationSeconds: options } : options;
    this.duration = Math.max(30, normalized.durationSeconds ?? 360);
    this.character = normalized.character ?? 'red-recruit';
    this.seed = normalized.seed ?? Date.now() >>> 0;
    this.random = new SeededRandom(this.seed);
    const character = characterById(this.character);
    this.maxEnergy = character.stats.maxEnergy;
    this.energy = this.maxEnergy;
    this.bossLeadSeconds = Math.min(36, Math.max(12, this.duration * 0.18));
    this.bossStartAt = Math.max(this.duration * 0.5, this.duration - this.bossLeadSeconds);
    this.bossMaxHealth = Math.max(14, Math.round(this.bossLeadSeconds * 1.12));
    this.bossHealth = this.bossMaxHealth;
  }

  tick(deltaSeconds: number): 'running' | 'victory' | 'defeat' {
    if (this.finished) return this.won ? 'victory' : 'defeat';

    const delta = Math.min(Math.max(deltaSeconds, 0), 0.1);
    if (this.elapsed < this.duration) this.elapsed = Math.min(this.elapsed + delta, this.duration);
    this.chaosSeconds = Math.max(0, this.chaosSeconds - delta);

    if (this.activeEvent && this.elapsed >= this.activeEventEndsAt) this.activeEvent = null;
    if (this.character === 'blue-recruit' && this.boundaryCharges === 0 && this.elapsed >= this.boundaryRechargeAt) {
      this.boundaryCharges = 1;
    }

    if (this.energy <= 0) {
      this.finished = true;
      this.won = false;
      return 'defeat';
    }

    if (this.elapsed >= this.duration && this.bossDefeated) {
      this.finished = true;
      this.won = true;
      this.score += Math.round(2200 + this.energy * 14);
      this.runCoins += 18;
      return 'victory';
    }

    return 'running';
  }

  recordHazardCleared(baseScore: number, coins: number): boolean {
    this.hazardsCleared += 1;
    const reviewBonus = this.activeEvent?.id === 'performance-review' ? 1.35 : 1;
    this.score += Math.round(baseScore * this.scoreMultiplier * reviewBonus);
    this.runCoins += coins;
    this.gainChaos(8 + Math.min(5, coins));
    return this.tryActivateChaos();
  }

  recordDashClear(): boolean {
    if (this.character !== 'red-recruit') return false;
    this.gainChaos(7);
    this.score += Math.round(45 * this.scoreMultiplier);
    return this.tryActivateChaos();
  }

  takeDamage(amount: number): number {
    const character = characterById(this.character);
    if (character.ability.id === 'boundary' && this.boundaryCharges > 0) {
      this.boundaryCharges = 0;
      this.boundaryRechargeAt = this.elapsed + 32;
      return 0;
    }

    const eventMultiplier = this.activeEvent?.damageMultiplier ?? 1;
    const applied = Math.max(1, Math.round(amount * character.stats.incomingDamage * eventMultiplier * this.gameplayModifiers.damageTakenMultiplier));
    this.energy = Math.max(0, this.energy - applied);
    return applied;
  }

  restoreEnergy(amount: number): void {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
  }

  collectCoin(value: number): void {
    this.runCoins += value;
    this.score += Math.round(value * 9 * this.scoreMultiplier);
  }

  applyPerk(id: string): void {
    this.perks.set(id, this.perkLevel(id) + 1);
    if (id === 'snack') {
      this.maxEnergy += 8;
      this.restoreEnergy(24);
    }
  }

  perkLevel(id: string): number {
    return this.perks.get(id) ?? 0;
  }

  get scoreMultiplier(): number {
    return (this.chaosSeconds > 0 ? 2 : 1) * this.gameplayModifiers.scoreMultiplier;
  }

  get gameplayModifiers(): GameplayModifiers {
    const replyLevel = this.perkLevel('reply');
    const shieldLevel = this.perkLevel('shield');
    const escapeLevel = this.perkLevel('escape');
    const printerLevel = this.perkLevel('printer');
    return {
      moveSpeedMultiplier: 1 + this.perkLevel('coffee') * 0.14,
      fireDelayMultiplier: Math.max(0.25, 1 - replyLevel * 0.18),
      projectileDamageBonus: replyLevel,
      damageTakenMultiplier: Math.max(0.35, 1 - shieldLevel * 0.18),
      dashDurationBonusMs: escapeLevel * 35,
      dashCooldownMultiplier: Math.max(0.2, 1 - escapeLevel * 0.22),
      projectilePierce: printerLevel,
      pickupRadiusBonus: printerLevel * 25,
      scoreMultiplier: 1 + printerLevel * 0.2,
    };
  }

  get activeAttackMultiplier(): number {
    return this.activeEvent?.attackMultiplier ?? 1;
  }

  choosePerkIds(count = 3): string[] {
    return choosePerks(count, () => this.random.next()).map((perk) => perk.id);
  }

  get shouldOfferUpgrade(): boolean {
    const interval = Math.min(45, Math.max(20, this.duration / 5));
    const expected = Math.floor(this.elapsed / interval);
    return expected > this.upgradeIndex && this.elapsed < this.bossStartAt - 7;
  }

  markUpgradeOffered(): void {
    const interval = Math.min(45, Math.max(20, this.duration / 5));
    this.upgradeIndex = Math.floor(this.elapsed / interval);
  }

  get shouldTriggerCorporateEvent(): boolean {
    const interval = Math.min(72, Math.max(30, this.duration / 4.8));
    const expected = Math.floor(this.elapsed / interval);
    return expected > this.eventIndex && this.elapsed < this.bossStartAt - 8 && !this.activeEvent;
  }

  triggerCorporateEvent(forcedId?: CorporateEventId): CorporateEventDefinition {
    const interval = Math.min(72, Math.max(30, this.duration / 4.8));
    this.eventIndex = Math.floor(this.elapsed / interval);
    const pool = CORPORATE_EVENTS.filter((event) => event.id !== this.lastEventId);
    const event = forcedId ? CORPORATE_EVENTS.find((candidate) => candidate.id === forcedId)! : this.random.pick(pool);
    this.lastEventId = event.id;
    this.activeEvent = event;
    this.activeEventEndsAt = this.elapsed + event.duration;
    if (event.energyDelta) this.restoreEnergy(event.energyDelta);
    return event;
  }

  get shouldStartBoss(): boolean {
    return !this.bossStarted && this.elapsed >= this.bossStartAt;
  }

  startBoss(): void {
    this.bossStarted = true;
    this.bossPhase = 1;
  }

  damageBoss(amount: number): BossDamageResult {
    if (!this.bossStarted || this.bossDefeated) return { defeated: this.bossDefeated, phaseChanged: false, phase: this.bossPhase };
    const previousPhase = this.bossPhase;
    this.bossHealth = Math.max(0, this.bossHealth - amount);
    const ratio = this.bossHealth / this.bossMaxHealth;
    this.bossPhase = ratio > 0.75 ? 1 : ratio > 0.5 ? 2 : ratio > 0.25 ? 3 : 4;
    if (this.bossHealth <= 0) {
      this.bossDefeated = true;
      this.score += Math.round(2800 * this.scoreMultiplier);
      this.runCoins += 12;
    }
    return { defeated: this.bossDefeated, phaseChanged: previousPhase !== this.bossPhase, phase: this.bossPhase };
  }

  get difficulty(): DifficultySnapshot {
    const ratio = Math.min(1, this.elapsed / this.duration);
    const segment = Math.floor(ratio * 4);
    const labels = ['Inbox Overflow', 'Meeting Season', 'KPI Emergency', 'Executive Escalation'];
    const eventSpawn = this.activeEvent?.spawnMultiplier ?? 1;
    return {
      spawnEveryMs: Math.max(340, (1120 - ratio * 700) * eventSpawn),
      hazardSpeed: (72 + ratio * 82) * (this.activeEvent?.moveMultiplier ?? 1),
      hazardHealth: 1 + Math.floor(ratio * 3),
      waveLabel: this.bossStarted && !this.bossDefeated ? `Final Review · Phase ${this.bossPhase}` : labels[Math.min(segment, labels.length - 1)],
    };
  }

  clockLabel(): string {
    return this.clockLabelAt(this.elapsed);
  }

  bossStartClockLabel(): string {
    return this.clockLabelAt(this.bossStartAt);
  }

  private clockLabelAt(elapsed: number): string {
    const workMinutes = Math.min(480, Math.floor((elapsed / this.duration) * 480));
    const totalMinutes = 9 * 60 + workMinutes;
    let hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    hour %= 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute.toString().padStart(2, '0')} ${suffix}`;
  }

  toHud(walletCoins: number, dashReady: boolean): HudSnapshot {
    const character = characterById(this.character);
    return {
      character: this.character, perks: [...this.perks.keys()],
      clock: this.clockLabel(), elapsed: this.elapsed, duration: this.duration,
      energy: this.energy, maxEnergy: this.maxEnergy, score: this.score,
      runCoins: this.runCoins, walletCoins, chaos: this.chaos,
      chaosActive: this.chaosSeconds > 0, chaosSeconds: this.chaosSeconds,
      dashReady, multiplier: this.scoreMultiplier, waveLabel: this.difficulty.waveLabel,
      abilityName: character.ability.name,
      abilityReady: character.ability.id === 'momentum' ? dashReady : this.boundaryCharges > 0,
      activeEvent: this.activeEvent?.title ?? null,
      bossActive: this.bossStarted && !this.bossDefeated,
      bossHealth: this.bossHealth,
      bossMaxHealth: this.bossMaxHealth,
      bossPhase: this.bossPhase,
      seed: this.seed,
    };
  }

  result(walletCoins: number): RunResult {
    const rankScale = this.duration / 360;
    const executiveScore = Math.round(400_000 * rankScale);
    const legendScore = Math.round(320_000 * rankScale);
    const promisingScore = Math.round(240_000 * rankScale);
    const rank = this.score >= executiveScore ? 'CHAOS EXECUTIVE' : this.score >= legendScore ? 'OFFICE LEGEND' : this.score >= promisingScore ? 'PROMISING RECRUIT' : 'MEETING SURVIVOR';
    return {
      won: this.won, score: this.score, runCoins: this.runCoins, walletCoins,
      survivedSeconds: this.elapsed, rank, hazardsCleared: this.hazardsCleared,
      perksChosen: [...this.perks.keys()], character: this.character,
      bossDefeated: this.bossDefeated, seed: this.seed, highScore: 0, newAchievements: [],
    };
  }

  private gainChaos(amount: number): void {
    const eventBonus = this.activeEvent?.id === 'printer-rebellion' ? 1.5 : 1;
    this.chaos = Math.min(100, this.chaos + amount * eventBonus);
  }

  private tryActivateChaos(): boolean {
    if (this.chaos < 100 || this.chaosSeconds > 0) return false;
    this.chaos = 0;
    this.chaosSeconds = 10;
    return true;
  }
}
