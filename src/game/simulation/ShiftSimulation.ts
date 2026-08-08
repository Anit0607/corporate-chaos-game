import type { HudSnapshot, RunResult } from '../events';

export interface DifficultySnapshot {
  spawnEveryMs: number;
  hazardSpeed: number;
  hazardHealth: number;
  waveLabel: string;
}

export class ShiftSimulation {
  readonly duration: number;
  elapsed = 0;
  energy = 100;
  maxEnergy = 100;
  score = 0;
  runCoins = 0;
  chaos = 0;
  chaosSeconds = 0;
  hazardsCleared = 0;
  finished = false;
  won = false;
  upgradeIndex = 0;
  readonly perks = new Map<string, number>();

  constructor(durationSeconds = 360) {
    this.duration = Math.max(30, durationSeconds);
  }

  tick(deltaSeconds: number): 'running' | 'victory' | 'defeat' {
    if (this.finished) return this.won ? 'victory' : 'defeat';

    const delta = Math.min(Math.max(deltaSeconds, 0), 0.1);
    this.elapsed = Math.min(this.elapsed + delta, this.duration);
    this.chaosSeconds = Math.max(0, this.chaosSeconds - delta);

    if (this.energy <= 0) {
      this.finished = true;
      this.won = false;
      return 'defeat';
    }

    if (this.elapsed >= this.duration) {
      this.finished = true;
      this.won = true;
      this.score += Math.round(1800 + this.energy * 12);
      this.runCoins += 15;
      return 'victory';
    }

    return 'running';
  }

  recordHazardCleared(baseScore: number, coins: number): boolean {
    this.hazardsCleared += 1;
    this.score += Math.round(baseScore * this.scoreMultiplier);
    this.runCoins += coins;
    this.chaos = Math.min(100, this.chaos + 8 + Math.min(5, coins));

    if (this.chaos >= 100 && this.chaosSeconds <= 0) {
      this.chaos = 0;
      this.chaosSeconds = 10;
      return true;
    }

    return false;
  }

  takeDamage(amount: number): number {
    const reduction = Math.min(0.65, this.perkLevel('shield') * 0.18);
    const applied = Math.max(1, Math.round(amount * (1 - reduction)));
    this.energy = Math.max(0, this.energy - applied);
    return applied;
  }

  collectCoin(value: number): void {
    this.runCoins += value;
    this.score += Math.round(value * 9 * this.scoreMultiplier);
  }

  applyPerk(id: string): void {
    this.perks.set(id, this.perkLevel(id) + 1);
    if (id === 'snack') {
      this.maxEnergy += 8;
      this.energy = Math.min(this.maxEnergy, this.energy + 24);
    }
  }

  perkLevel(id: string): number {
    return this.perks.get(id) ?? 0;
  }

  get scoreMultiplier(): number {
    return (this.chaosSeconds > 0 ? 2 : 1) * (1 + this.perkLevel('printer') * 0.2);
  }

  get shouldOfferUpgrade(): boolean {
    const expected = Math.floor(this.elapsed / 45);
    return expected > this.upgradeIndex && this.elapsed < this.duration - 10;
  }

  markUpgradeOffered(): void {
    this.upgradeIndex = Math.floor(this.elapsed / 45);
  }

  get difficulty(): DifficultySnapshot {
    const ratio = this.elapsed / this.duration;
    const segment = Math.floor(ratio * 4);
    const labels = ['Inbox Overflow', 'Meeting Season', 'KPI Emergency', 'Executive Escalation'];
    return {
      spawnEveryMs: Math.max(330, 1120 - ratio * 720),
      hazardSpeed: 72 + ratio * 88,
      hazardHealth: 1 + Math.floor(ratio * 3),
      waveLabel: labels[Math.min(segment, labels.length - 1)],
    };
  }

  clockLabel(): string {
    const workMinutes = Math.min(480, Math.floor((this.elapsed / this.duration) * 480));
    const totalMinutes = 9 * 60 + workMinutes;
    let hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    hour %= 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute.toString().padStart(2, '0')} ${suffix}`;
  }

  toHud(walletCoins: number, dashReady: boolean): HudSnapshot {
    return {
      clock: this.clockLabel(),
      elapsed: this.elapsed,
      duration: this.duration,
      energy: this.energy,
      score: this.score,
      runCoins: this.runCoins,
      walletCoins,
      chaos: this.chaos,
      chaosActive: this.chaosSeconds > 0,
      chaosSeconds: this.chaosSeconds,
      dashReady,
      multiplier: this.scoreMultiplier,
      waveLabel: this.difficulty.waveLabel,
    };
  }

  result(walletCoins: number): RunResult {
    const rank = this.score >= 18000 ? 'CHAOS EXECUTIVE' : this.score >= 11000 ? 'OFFICE LEGEND' : this.score >= 6000 ? 'PROMISING RECRUIT' : 'MEETING SURVIVOR';
    return {
      won: this.won,
      score: this.score,
      runCoins: this.runCoins,
      walletCoins,
      survivedSeconds: this.elapsed,
      rank,
      hazardsCleared: this.hazardsCleared,
      perksChosen: [...this.perks.keys()],
    };
  }
}
