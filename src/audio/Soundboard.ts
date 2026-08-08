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

  unlock(): void {
    if (!this.context) this.context = new AudioContext();
    void this.context.resume();
  }

  play(kind: 'coin' | 'hit' | 'fire' | 'upgrade' | 'chaos' | 'win' | 'lose'): void {
    if (this.muted) return;
    this.unlock();
    const context = this.context;
    if (!context) return;

    const recipes = {
      coin: [660, 0.08, 'sine'],
      hit: [90, 0.12, 'sawtooth'],
      fire: [310, 0.035, 'square'],
      upgrade: [520, 0.22, 'triangle'],
      chaos: [170, 0.36, 'sawtooth'],
      win: [740, 0.5, 'triangle'],
      lose: [120, 0.45, 'sine'],
    } as const;
    const [frequency, duration, type] = recipes[kind];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(45, frequency * (kind === 'win' || kind === 'upgrade' ? 1.6 : 0.72)),
      context.currentTime + duration,
    );
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(kind === 'fire' ? 0.025 : 0.075, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  }
}

export const soundboard = new Soundboard();
