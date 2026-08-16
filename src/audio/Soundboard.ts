type SoundKind = 'coin' | 'hit' | 'fire' | 'dash' | 'hazardSpawn' | 'hazardHit' | 'warning' | 'upgrade' | 'chaos' | 'shield' | 'event' | 'boss' | 'bossPhase' | 'bossAttack' | 'bossDefeat' | 'win' | 'lose';

interface ToneRecipe {
  frequency: number;
  duration: number;
  type: OscillatorType;
  volume: number;
  endRatio: number;
  offset?: number;
}

const SOUND_RECIPES: Record<SoundKind, readonly ToneRecipe[]> = {
  coin: [{ frequency: 660, duration: 0.08, type: 'sine', volume: 0.06, endRatio: 1.45 }],
  hit: [
    { frequency: 90, duration: 0.12, type: 'sawtooth', volume: 0.075, endRatio: 0.55 },
    { frequency: 180, duration: 0.07, type: 'square', volume: 0.028, endRatio: 0.5 },
  ],
  fire: [{ frequency: 310, duration: 0.035, type: 'square', volume: 0.025, endRatio: 0.72 }],
  dash: [
    { frequency: 260, duration: 0.13, type: 'sawtooth', volume: 0.04, endRatio: 1.8 },
    { frequency: 620, duration: 0.09, type: 'sine', volume: 0.025, endRatio: 0.65 },
  ],
  hazardSpawn: [{ frequency: 190, duration: 0.1, type: 'triangle', volume: 0.026, endRatio: 1.25 }],
  hazardHit: [{ frequency: 150, duration: 0.055, type: 'square', volume: 0.02, endRatio: 0.62 }],
  warning: [
    { frequency: 240, duration: 0.11, type: 'square', volume: 0.035, endRatio: 0.82 },
    { frequency: 360, duration: 0.11, type: 'square', volume: 0.025, endRatio: 0.82, offset: 0.08 },
  ],
  upgrade: [
    { frequency: 520, duration: 0.22, type: 'triangle', volume: 0.07, endRatio: 1.6 },
    { frequency: 780, duration: 0.16, type: 'sine', volume: 0.035, endRatio: 1.35, offset: 0.08 },
  ],
  chaos: [
    { frequency: 170, duration: 0.36, type: 'sawtooth', volume: 0.07, endRatio: 0.72 },
    { frequency: 340, duration: 0.28, type: 'square', volume: 0.025, endRatio: 1.3 },
  ],
  shield: [
    { frequency: 880, duration: 0.24, type: 'sine', volume: 0.07, endRatio: 0.72 },
    { frequency: 1320, duration: 0.18, type: 'triangle', volume: 0.03, endRatio: 0.82 },
  ],
  event: [{ frequency: 410, duration: 0.3, type: 'triangle', volume: 0.07, endRatio: 0.72 }],
  boss: [
    { frequency: 72, duration: 0.6, type: 'sawtooth', volume: 0.075, endRatio: 0.62 },
    { frequency: 108, duration: 0.48, type: 'square', volume: 0.03, endRatio: 0.7, offset: 0.08 },
  ],
  bossPhase: [
    { frequency: 130, duration: 0.34, type: 'square', volume: 0.065, endRatio: 0.72 },
    { frequency: 260, duration: 0.24, type: 'sawtooth', volume: 0.03, endRatio: 1.25 },
  ],
  bossAttack: [{ frequency: 210, duration: 0.16, type: 'sawtooth', volume: 0.055, endRatio: 0.72 }],
  bossDefeat: [
    { frequency: 116, duration: 0.85, type: 'sawtooth', volume: 0.075, endRatio: 0.42 },
    { frequency: 232, duration: 0.55, type: 'triangle', volume: 0.045, endRatio: 1.75, offset: 0.1 },
    { frequency: 464, duration: 0.42, type: 'sine', volume: 0.035, endRatio: 1.5, offset: 0.24 },
  ],
  win: [
    { frequency: 740, duration: 0.5, type: 'triangle', volume: 0.07, endRatio: 1.6 },
    { frequency: 1110, duration: 0.38, type: 'sine', volume: 0.035, endRatio: 1.3, offset: 0.12 },
  ],
  lose: [{ frequency: 120, duration: 0.45, type: 'sine', volume: 0.07, endRatio: 0.72 }],
};

class Soundboard {
  private context: AudioContext | null = null;
  private muted = localStorage.getItem('corporate-chaos-muted') === 'true';

  setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem('corporate-chaos-muted', String(muted));
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get contextState(): AudioContextState | 'uninitialized' {
    return this.context?.state ?? 'uninitialized';
  }

  unlock(): void {
    if (!this.context) this.context = new AudioContext();
    void this.context.resume();
  }

  suspend(): void {
    if (this.context?.state === 'running') void this.context.suspend();
  }

  play(kind: SoundKind): void {
    if (this.muted) return;
    this.unlock();
    const context = this.context;
    if (!context) return;

    SOUND_RECIPES[kind].forEach((recipe) => this.playTone(context, recipe));
  }

  private playTone(context: AudioContext, recipe: ToneRecipe): void {
    const startAt = context.currentTime + (recipe.offset ?? 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = recipe.type;
    oscillator.frequency.setValueAtTime(recipe.frequency, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(45, recipe.frequency * recipe.endRatio),
      startAt + recipe.duration,
    );
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(recipe.volume, startAt + Math.min(0.012, recipe.duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + recipe.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + recipe.duration + 0.02);
  }
}

export const soundboard = new Soundboard();
