import Phaser from 'phaser';

export class EffectsManager {
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly transient = new Set<Phaser.GameObjects.GameObject>();

  constructor(private readonly scene: Phaser.Scene) {}

  get activeCount(): number {
    return this.transient.size;
  }

  get isReducedMotion(): boolean {
    return this.reducedMotion;
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

  afterimage(sprite: Phaser.Physics.Arcade.Sprite, color = 0x27d9ff, duration = 190): void {
    if (this.reducedMotion) return;
    const echo = this.track(this.scene.add.image(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name)
      .setOrigin(sprite.originX, sprite.originY)
      .setDepth(sprite.depth - 1)
      .setFlipX(sprite.flipX)
      .setRotation(sprite.rotation)
      .setScale(sprite.scaleX, sprite.scaleY)
      .setTint(color)
      .setAlpha(0.34));
    this.scene.tweens.add({
      targets: echo,
      alpha: 0,
      scaleX: sprite.scaleX * 0.82,
      scaleY: sprite.scaleY * 0.82,
      duration,
      ease: 'Quad.Out',
      onComplete: () => this.release(echo),
    });
  }

  muzzleFlash(x: number, y: number, angle: number, color = 0x27d9ff): void {
    const length = this.reducedMotion ? 14 : 22;
    const flash = this.track(this.scene.add.rectangle(
      x + Math.cos(angle) * 22,
      y + Math.sin(angle) * 22,
      length,
      5,
      color,
      0.92,
    ).setDepth(31).setRotation(angle));
    this.scene.tweens.add({
      targets: flash,
      scaleX: 0.15,
      scaleY: 0.25,
      alpha: 0,
      duration: this.reducedMotion ? 55 : 90,
      ease: 'Quad.Out',
      onComplete: () => this.release(flash),
    });
  }

  projectileTrail(x: number, y: number, angle: number, color = 0x27d9ff): void {
    if (this.reducedMotion) return;
    const trail = this.track(this.scene.add.rectangle(x - Math.cos(angle) * 9, y - Math.sin(angle) * 9, 18, 2, color, 0.5)
      .setDepth(15)
      .setRotation(angle));
    this.scene.tweens.add({
      targets: trail,
      scaleX: 0.2,
      alpha: 0,
      duration: 120,
      ease: 'Quad.Out',
      onComplete: () => this.release(trail),
    });
  }

  impact(x: number, y: number, color: number, angle = 0, heavy = false): void {
    const shardCount = this.reducedMotion ? 3 : heavy ? 9 : 6;
    const core = this.track(this.scene.add.circle(x, y, heavy ? 14 : 9, 0xffffff, 0.9).setDepth(36));
    this.scene.tweens.add({
      targets: core,
      scale: heavy ? 2.1 : 1.7,
      alpha: 0,
      duration: this.reducedMotion ? 70 : 120,
      ease: 'Quad.Out',
      onComplete: () => this.release(core),
    });
    for (let index = 0; index < shardCount; index += 1) {
      const spread = angle + Math.PI + Phaser.Math.FloatBetween(-1.05, 1.05);
      const shard = this.track(this.scene.add.rectangle(x, y, heavy ? 16 : 11, 3, color, 0.92)
        .setDepth(35)
        .setRotation(spread));
      const distance = Phaser.Math.Between(20, heavy ? 62 : 42);
      this.scene.tweens.add({
        targets: shard,
        x: x + Math.cos(spread) * distance,
        y: y + Math.sin(spread) * distance,
        scaleX: 0.15,
        alpha: 0,
        duration: this.reducedMotion ? 100 : Phaser.Math.Between(150, 260),
        ease: 'Quad.Out',
        onComplete: () => this.release(shard),
      });
    }
  }

  shockwave(x: number, y: number, color: number, radius = 80, duration = 420): void {
    const ring = this.track(this.scene.add.circle(x, y, 18, color, 0.04)
      .setStrokeStyle(4, color, 0.86)
      .setDepth(29));
    this.scene.tweens.add({
      targets: ring,
      scale: radius / 18,
      alpha: 0,
      duration: this.reducedMotion ? Math.min(duration, 180) : duration,
      ease: 'Cubic.Out',
      onComplete: () => this.release(ring),
    });
  }

  screenFlash(color: number, alpha = 0.16, duration = 180): void {
    const camera = this.scene.cameras.main;
    const flash = this.track(this.scene.add.rectangle(0, 0, camera.width, camera.height, color, alpha)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(90));
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: this.reducedMotion ? Math.min(duration, 80) : duration,
      ease: 'Quad.Out',
      onComplete: () => this.release(flash),
    });
  }

  hazardSpawn(x: number, y: number, color: number): void {
    this.shockwave(x, y, color, 46, 260);
    const marker = this.track(this.scene.add.text(x, y - 34, '!', {
      color: '#ffffff',
      fontFamily: 'Impact, Arial Narrow Bold, sans-serif',
      fontSize: '18px',
      stroke: '#061126',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(33).setAlpha(0.9));
    this.scene.tweens.add({
      targets: marker,
      y: y - 47,
      alpha: 0,
      duration: this.reducedMotion ? 160 : 360,
      ease: 'Back.Out',
      onComplete: () => this.release(marker),
    });
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
