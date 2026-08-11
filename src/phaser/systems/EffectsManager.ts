import Phaser from 'phaser';

export class EffectsManager {
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly transient = new Set<Phaser.GameObjects.GameObject>();

  constructor(private readonly scene: Phaser.Scene) {}

  get activeCount(): number {
    return this.transient.size;
  }

  clear(): void {
    this.transient.forEach((object) => object.destroy());
    this.transient.clear();
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.transient.add(object);
    return object;
  }

  private release(object: Phaser.GameObjects.GameObject): void {
    this.transient.delete(object);
    object.destroy();
  }

  burst(x: number, y: number, color: number, count: number): void {
    const particleCount = this.reducedMotion ? Math.min(5, count) : count;
    for (let index = 0; index < particleCount; index += 1) {
      const particle = this.track(this.scene.add.rectangle(x, y, Phaser.Math.Between(5, 11), Phaser.Math.Between(3, 7), color, 0.95)
        .setDepth(30)
        .setRotation(Math.random() * Math.PI));
      const angle = (Math.PI * 2 * index) / particleCount + Math.random() * 0.4;
      const distance = Phaser.Math.Between(38, this.reducedMotion ? 58 : 96);
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        rotation: particle.rotation + Phaser.Math.FloatBetween(-2, 2),
        alpha: 0,
        scale: 0.25,
        duration: this.reducedMotion ? 180 : Phaser.Math.Between(280, 520),
        ease: 'Quad.Out',
        onComplete: () => this.release(particle),
      });
    }
  }

  telegraph(x: number, y: number, color: number, radius = 44, duration = 620): void {
    const ring = this.track(this.scene.add.circle(x, y, radius, color, 0.08)
      .setStrokeStyle(3, color, 0.78)
      .setDepth(10)
      .setScale(0.45));
    this.scene.tweens.add({
      targets: ring,
      scale: 1.18,
      alpha: 0,
      duration: this.reducedMotion ? Math.min(240, duration) : duration,
      ease: 'Quad.Out',
      onComplete: () => this.release(ring),
    });
  }

  floatingText(x: number, y: number, label: string, color = '#ffffff'): void {
    const text = this.track(this.scene.add.text(x, y, label, {
      color,
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      stroke: '#061126',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(45));
    this.scene.tweens.add({
      targets: text,
      y: y - 30,
      alpha: 0,
      duration: this.reducedMotion ? 360 : 700,
      ease: 'Quad.Out',
      onComplete: () => this.release(text),
    });
  }

  shake(duration: number, intensity: number): void {
    if (!this.reducedMotion) this.scene.cameras.main.shake(duration, intensity);
  }
}
