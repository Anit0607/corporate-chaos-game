import Phaser from 'phaser';
import { soundboard } from '../../audio/Soundboard';
import { analytics } from '../../game/analytics/analytics';
import { choosePerks, PERKS } from '../../game/content/perks';
import { gameBus, type CharacterId } from '../../game/events';
import { ShiftSimulation } from '../../game/simulation/ShiftSimulation';

type HazardKind = 'email' | 'meeting' | 'kpi' | 'manager';

interface HazardDefinition {
  texture: string;
  health: number;
  speed: number;
  damage: number;
  score: number;
  coins: number;
  scale: number;
  color: number;
}

const HAZARDS: Record<HazardKind, HazardDefinition> = {
  email: { texture: 'hazard-email', health: 1, speed: 1.15, damage: 9, score: 120, coins: 1, scale: 0.88, color: 0xfff4dc },
  meeting: { texture: 'hazard-meeting', health: 3, speed: 0.72, damage: 16, score: 280, coins: 2, scale: 0.92, color: 0xb46cff },
  kpi: { texture: 'hazard-kpi', health: 2, speed: 1.28, damage: 13, score: 220, coins: 2, scale: 0.82, color: 0x27d9ff },
  manager: { texture: 'hazard-manager', health: 7, speed: 0.62, damage: 24, score: 680, coins: 4, scale: 0.9, color: 0xf33d53 },
};

const WALLET_KEY = 'corporate-chaos-wallet-v1';

export class ShiftScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private hazards!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private coins!: Phaser.Physics.Arcade.Group;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'dash' | 'pause', Phaser.Input.Keyboard.Key>;
  private simulation: ShiftSimulation | null = null;
  private selectedCharacter: CharacterId = 'red-recruit';
  private running = false;
  private manuallyPaused = false;
  private perkPaused = false;
  private walletCoins = 0;
  private lastSpawnAt = 0;
  private lastShotAt = 0;
  private lastHudAt = 0;
  private invulnerableUntil = 0;
  private dashUntil = 0;
  private dashReadyAt = 0;
  private facing = new Phaser.Math.Vector2(1, 0);
  private chaosOverlay!: Phaser.GameObjects.Rectangle;
  private officeGlow!: Phaser.GameObjects.Rectangle;
  private readonly unsubscribe: Array<() => void> = [];

  constructor() {
    super('ShiftScene');
  }

  create(): void {
    this.walletCoins = Number(localStorage.getItem(WALLET_KEY) ?? 0) || 0;
    this.createEnvironment();

    this.hazards = this.physics.add.group({ maxSize: 160 });
    this.projectiles = this.physics.add.group({ maxSize: 100 });
    this.coins = this.physics.add.group({ maxSize: 120 });

    this.player = this.physics.add.sprite(640, 360, 'player-red');
    this.player.setDepth(20).setCollideWorldBounds(true).setVisible(false).setActive(false);
    this.player.body!.enable = false;
    this.player.setCircle(20, 9, 17);

    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.overlap(this.projectiles, this.hazards, (projectile, hazard) => {
      this.hitHazard(projectile as Phaser.Physics.Arcade.Sprite, hazard as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.player, this.hazards, (_player, hazard) => {
      this.hitPlayer(hazard as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.player, this.coins, (_player, coin) => {
      this.collectCoin(coin as Phaser.Physics.Arcade.Sprite);
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      dash: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      pause: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    };

    this.bindBus();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe.splice(0).forEach((off) => off()));
  }

  update(time: number, delta: number): void {
    if (!this.running || !this.simulation) return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
      this.togglePause();
      return;
    }
    if (this.manuallyPaused || this.perkPaused) return;

    const status = this.simulation.tick(delta / 1000);
    if (status !== 'running') {
      this.finishRun();
      return;
    }

    this.updatePlayer(time);
    this.updateHazards(time);
    this.updateProjectiles(time);
    this.updateCoins(time);

    const difficulty = this.simulation.difficulty;
    if (time - this.lastSpawnAt >= difficulty.spawnEveryMs) {
      this.lastSpawnAt = time;
      this.spawnHazard();
    }

    const attackDelay = Math.max(260, 820 * (1 - this.simulation.perkLevel('reply') * 0.18));
    if (time - this.lastShotAt >= attackDelay) {
      this.lastShotAt = time;
      this.fireAtNearest();
    }

    if (this.simulation.shouldOfferUpgrade) this.offerPerks();

    if (time - this.lastHudAt > 85) {
      this.lastHudAt = time;
      gameBus.emit('game:hud', this.simulation.toHud(this.walletCoins, time >= this.dashReadyAt));
    }
  }

  private bindBus(): void {
    this.unsubscribe.push(
      gameBus.on('ui:start', () => {
        analytics.capture('play_click');
        gameBus.emit('game:character-select', undefined);
      }),
      gameBus.on('ui:character', (character) => {
        this.selectedCharacter = character;
        analytics.capture('character_selected', { character });
      }),
      gameBus.on('ui:briefing-complete', () => this.startRun()),
      gameBus.on('ui:pause-toggle', () => this.togglePause()),
      gameBus.on('ui:resume', () => this.setManualPause(false)),
      gameBus.on('ui:restart', () => this.startRun()),
      gameBus.on('ui:menu', () => this.returnToMenu()),
      gameBus.on('ui:perk-selected', (id) => this.applyPerk(id)),
    );
  }

  private createEnvironment(): void {
    const background = this.add.graphics().setDepth(-100);
    background.fillStyle(0x071328).fillRect(0, 0, 1280, 720);
    background.fillStyle(0x0d2b4d).fillRoundedRect(38, 76, 1204, 606, 24);
    background.fillStyle(0x15385c).fillRoundedRect(64, 102, 1152, 550, 16);
    background.fillStyle(0x173f63).fillRect(64, 102, 1152, 82);
    background.fillStyle(0xe8d8b7, 0.92).fillRoundedRect(78, 194, 1124, 440, 12);

    background.lineStyle(1, 0xb1a88f, 0.28);
    for (let x = 78; x <= 1202; x += 48) background.lineBetween(x, 194, x, 634);
    for (let y = 194; y <= 634; y += 48) background.lineBetween(78, y, 1202, y);

    background.fillStyle(0x071328, 0.85).fillRoundedRect(96, 116, 258, 48, 8);
    background.fillStyle(0x27d9ff, 0.8).fillRect(111, 130, 9, 20);
    this.add.text(133, 128, 'CHAOS CORP  ·  FLOOR 01', {
      color: '#dffaff', fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', letterSpacing: 2,
    }).setDepth(-90);
    this.add.text(1023, 128, '09:00—17:00', {
      color: '#8fa8c9', fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', letterSpacing: 2,
    }).setDepth(-90);

    this.obstacles = this.physics.add.staticGroup();
    this.addObstacle(236, 238, 'desk');
    this.addObstacle(548, 238, 'desk');
    this.addObstacle(860, 238, 'desk');
    this.addObstacle(1042, 516, 'sofa');
    this.addObstacle(238, 538, 'sofa');
    this.addObstacle(915, 380, 'printer');
    this.addDecoration(118, 205, 'plant');
    this.addDecoration(1162, 205, 'plant');
    this.addDecoration(1150, 596, 'plant');

    background.lineStyle(3, 0x27d9ff, 0.28).strokeRoundedRect(438, 302, 360, 230, 18);
    background.fillStyle(0x27d9ff, 0.04).fillRoundedRect(438, 302, 360, 230, 18);
    this.add.text(466, 325, 'OPEN PLAN · HIGH RISK', {
      color: '#446782', fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', letterSpacing: 2,
    }).setDepth(-90);

    this.officeGlow = this.add.rectangle(640, 360, 1280, 720, 0x27d9ff, 0).setDepth(90).setBlendMode(Phaser.BlendModes.ADD);
    this.chaosOverlay = this.add.rectangle(640, 360, 1280, 720, 0xff3aa7, 0).setDepth(91).setBlendMode(Phaser.BlendModes.ADD);
  }

  private addObstacle(x: number, y: number, texture: string): void {
    const sprite = this.obstacles.create(x, y, texture) as Phaser.Physics.Arcade.Sprite;
    sprite.setDepth(4).refreshBody();
  }

  private addDecoration(x: number, y: number, texture: string): void {
    this.add.image(x, y, texture).setDepth(3);
  }

  private startRun(): void {
    const query = new URLSearchParams(window.location.search);
    const queryDuration = Number(query.get('duration'));
    const configuredDuration = Number(import.meta.env.VITE_SHIFT_DURATION_SECONDS ?? 360);
    const duration = Number.isFinite(queryDuration) && queryDuration > 0 ? queryDuration : configuredDuration;

    this.hazards.clear(true, true);
    this.projectiles.clear(true, true);
    this.coins.clear(true, true);
    this.simulation = new ShiftSimulation(duration);
    this.running = true;
    this.manuallyPaused = false;
    this.perkPaused = false;
    this.lastSpawnAt = this.time.now;
    this.lastShotAt = this.time.now - 1000;
    this.lastHudAt = 0;
    this.invulnerableUntil = 0;
    this.dashUntil = 0;
    this.dashReadyAt = this.time.now + 800;
    this.facing.set(1, 0);

    this.player.setTexture(this.selectedCharacter === 'red-recruit' ? 'player-red' : 'player-blue');
    this.player.setPosition(640, 565).setVelocity(0).setAlpha(1).clearTint();
    this.player.setActive(true).setVisible(true);
    this.player.body!.enable = true;
    this.physics.resume();
    this.cameras.main.resetFX();
    this.cameras.main.fadeIn(420, 7, 19, 40);
    gameBus.emit('game:run-started', undefined);
    gameBus.emit('game:hud', this.simulation.toHud(this.walletCoins, false));
    gameBus.emit('game:toast', 'WASD TO MOVE · PAPERCLIPS FIRE AUTOMATICALLY');
    analytics.capture('game_started', { character: this.selectedCharacter, duration_seconds: duration });
  }

  private returnToMenu(): void {
    if (this.running && this.simulation) {
      analytics.capture('session_end', {
        completed: false,
        elapsed_seconds: Math.round(this.simulation.elapsed),
        score: this.simulation.score,
      });
    }
    this.running = false;
    this.manuallyPaused = false;
    this.perkPaused = false;
    this.physics.pause();
    this.hazards.clear(true, true);
    this.projectiles.clear(true, true);
    this.coins.clear(true, true);
    this.player.setVisible(false).setActive(false);
    this.player.body!.enable = false;
    gameBus.emit('game:pause', false);
    gameBus.emit('game:menu', undefined);
  }

  private updatePlayer(time: number): void {
    const simulation = this.simulation!;
    if (time < this.dashUntil) {
      this.player.setVelocity(this.facing.x * 610, this.facing.y * 610);
      this.player.setAlpha(0.72 + Math.sin(time * 0.06) * 0.18);
      return;
    }

    this.player.setAlpha(1);
    const horizontal = Number(this.keys.right.isDown || this.cursors.right.isDown) - Number(this.keys.left.isDown || this.cursors.left.isDown);
    const vertical = Number(this.keys.down.isDown || this.cursors.down.isDown) - Number(this.keys.up.isDown || this.cursors.up.isDown);
    const movement = new Phaser.Math.Vector2(horizontal, vertical);

    if (movement.lengthSq() > 0) {
      movement.normalize();
      this.facing.copy(movement);
      const speed = 235 * (1 + simulation.perkLevel('coffee') * 0.14) * (simulation.chaosSeconds > 0 ? 1.16 : 1);
      this.player.setVelocity(movement.x * speed, movement.y * speed);
      this.player.setFlipX(movement.x < -0.05);
      this.player.setRotation(Math.sin(time * 0.018) * 0.035);
      this.player.setScale(1 + Math.sin(time * 0.025) * 0.018, 1 - Math.sin(time * 0.025) * 0.018);
    } else {
      this.player.setVelocity(0).setRotation(0).setScale(1);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.dash) && time >= this.dashReadyAt) {
      const escapeLevel = simulation.perkLevel('escape');
      if (movement.lengthSq() === 0) movement.copy(this.facing);
      this.facing.copy(movement.normalize());
      this.dashUntil = time + 235 + escapeLevel * 35;
      this.invulnerableUntil = this.dashUntil + 80;
      this.dashReadyAt = time + Math.max(1450, 4200 * (1 - escapeLevel * 0.22));
      this.burst(this.player.x, this.player.y, 0x27d9ff, 8);
      this.cameras.main.shake(90, 0.003);
    }
  }

  private spawnHazard(): void {
    const simulation = this.simulation!;
    const ratio = simulation.elapsed / simulation.duration;
    const roll = Math.random();
    let kind: HazardKind = 'email';
    if (ratio > 0.58 && roll > 0.87) kind = 'manager';
    else if (ratio > 0.28 && roll > 0.68) kind = 'kpi';
    else if (ratio > 0.12 && roll > 0.48) kind = 'meeting';

    const definition = HAZARDS[kind];
    const edge = Phaser.Math.Between(0, 3);
    const padding = 36;
    let x = Phaser.Math.Between(95, 1185);
    let y = Phaser.Math.Between(205, 615);
    if (edge === 0) y = 198 - padding;
    if (edge === 1) x = 1202 + padding;
    if (edge === 2) y = 634 + padding;
    if (edge === 3) x = 78 - padding;

    const sprite = this.hazards.get(x, y, definition.texture) as Phaser.Physics.Arcade.Sprite | null;
    if (!sprite) return;
    const difficultyHealth = Math.max(0, simulation.difficulty.hazardHealth - 1);
    sprite.enableBody(true, x, y, true, true);
    sprite.setDepth(12).setScale(definition.scale).setAlpha(1).clearTint();
    sprite.setData({
      kind,
      hp: definition.health + (kind === 'email' ? 0 : difficultyHealth),
      damage: definition.damage,
      score: definition.score,
      coins: definition.coins,
      speed: simulation.difficulty.hazardSpeed * definition.speed,
      phase: Math.random() * Math.PI * 2,
    });
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(Math.min(sprite.width, sprite.height) * 0.33);
  }

  private updateHazards(time: number): void {
    this.hazards.getChildren().forEach((child) => {
      const hazard = child as Phaser.Physics.Arcade.Sprite;
      if (!hazard.active) return;
      const kind = hazard.getData('kind') as HazardKind;
      const angle = Phaser.Math.Angle.Between(hazard.x, hazard.y, this.player.x, this.player.y);
      const phase = hazard.getData('phase') as number;
      const wobble = kind === 'kpi' ? Math.sin(time * 0.007 + phase) * 0.65 : kind === 'email' ? Math.sin(time * 0.004 + phase) * 0.18 : 0;
      const speed = hazard.getData('speed') as number;
      this.physics.velocityFromRotation(angle + wobble, speed, hazard.body!.velocity);
      hazard.setRotation(kind === 'manager' ? 0 : angle + Math.PI / 2);
      if (kind === 'meeting') hazard.setScale(HAZARDS[kind].scale + Math.sin(time * 0.006 + phase) * 0.04);
    });
  }

  private fireAtNearest(): void {
    const active = this.hazards.getChildren().filter((child) => (child as Phaser.Physics.Arcade.Sprite).active) as Phaser.Physics.Arcade.Sprite[];
    if (active.length === 0) return;
    let target = active[0];
    let distance = Phaser.Math.Distance.Squared(this.player.x, this.player.y, target.x, target.y);
    active.slice(1).forEach((candidate) => {
      const next = Phaser.Math.Distance.Squared(this.player.x, this.player.y, candidate.x, candidate.y);
      if (next < distance) {
        target = candidate;
        distance = next;
      }
    });

    const projectile = this.projectiles.get(this.player.x, this.player.y, 'paperclip') as Phaser.Physics.Arcade.Sprite | null;
    if (!projectile) return;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);
    projectile.enableBody(true, this.player.x, this.player.y, true, true);
    projectile.setDepth(16).setRotation(angle).setScale(this.simulation!.chaosSeconds > 0 ? 1.35 : 1).setAlpha(1);
    projectile.setData({
      damage: 1 + Math.floor(this.simulation!.perkLevel('reply') / 2) + (this.simulation!.chaosSeconds > 0 ? 1 : 0),
      pierce: this.simulation!.perkLevel('printer'),
      expires: this.time.now + 1500,
    });
    this.physics.velocityFromRotation(angle, 650, projectile.body!.velocity);
    soundboard.play('fire');
  }

  private updateProjectiles(time: number): void {
    this.projectiles.getChildren().forEach((child) => {
      const projectile = child as Phaser.Physics.Arcade.Sprite;
      if (projectile.active && (time > projectile.getData('expires') || projectile.x < 40 || projectile.x > 1240 || projectile.y < 80 || projectile.y > 670)) {
        projectile.disableBody(true, true);
      }
    });
  }

  private hitHazard(projectile: Phaser.Physics.Arcade.Sprite, hazard: Phaser.Physics.Arcade.Sprite): void {
    if (!projectile.active || !hazard.active) return;
    const hp = (hazard.getData('hp') as number) - (projectile.getData('damage') as number);
    hazard.setData('hp', hp);
    hazard.setTint(0xffffff);
    this.time.delayedCall(45, () => hazard.active && hazard.clearTint());

    const pierce = (projectile.getData('pierce') as number) - 1;
    projectile.setData('pierce', pierce);
    if (pierce < 0) projectile.disableBody(true, true);

    if (hp <= 0) this.clearHazard(hazard);
  }

  private clearHazard(hazard: Phaser.Physics.Arcade.Sprite): void {
    const kind = hazard.getData('kind') as HazardKind;
    const score = hazard.getData('score') as number;
    const coinValue = hazard.getData('coins') as number;
    const x = hazard.x;
    const y = hazard.y;
    hazard.disableBody(true, true);
    this.burst(x, y, HAZARDS[kind].color, kind === 'manager' ? 16 : 8);
    this.spawnCoin(x, y, coinValue);
    const chaosTriggered = this.simulation!.recordHazardCleared(score, 0);
    if (chaosTriggered) this.activateChaosMode();
  }

  private spawnCoin(x: number, y: number, value: number): void {
    const coin = this.coins.get(x, y, 'chaos-coin') as Phaser.Physics.Arcade.Sprite | null;
    if (!coin) return;
    coin.enableBody(true, x, y, true, true);
    coin.setDepth(14).setScale(0.82).setAlpha(1).setData({ value, expires: this.time.now + 9000, phase: Math.random() * 6 });
    coin.setVelocity(Phaser.Math.Between(-55, 55), Phaser.Math.Between(-55, 55));
    coin.setDrag(180, 180);
  }

  private updateCoins(time: number): void {
    this.coins.getChildren().forEach((child) => {
      const coin = child as Phaser.Physics.Arcade.Sprite;
      if (!coin.active) return;
      coin.setRotation(time * 0.004 + (coin.getData('phase') as number));
      const distance = Phaser.Math.Distance.Between(coin.x, coin.y, this.player.x, this.player.y);
      if (distance < 120 + this.simulation!.perkLevel('printer') * 25) {
        const angle = Phaser.Math.Angle.Between(coin.x, coin.y, this.player.x, this.player.y);
        this.physics.velocityFromRotation(angle, 250, coin.body!.velocity);
      }
      if (time > coin.getData('expires')) coin.disableBody(true, true);
    });
  }

  private collectCoin(coin: Phaser.Physics.Arcade.Sprite): void {
    if (!coin.active) return;
    const value = coin.getData('value') as number;
    coin.disableBody(true, true);
    this.simulation!.collectCoin(value);
    soundboard.play('coin');
  }

  private hitPlayer(hazard: Phaser.Physics.Arcade.Sprite): void {
    const now = this.time.now;
    if (!hazard.active) return;
    if (now < this.dashUntil) {
      this.clearHazard(hazard);
      return;
    }
    if (now < this.invulnerableUntil) return;
    this.invulnerableUntil = now + 850;
    const damage = this.simulation!.takeDamage(hazard.getData('damage') as number);
    soundboard.play('hit');
    this.cameras.main.shake(180, 0.009);
    this.player.setTint(0xff6f87);
    this.tweens.add({
      targets: this.player,
      alpha: { from: 0.35, to: 1 },
      duration: 110,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.player.clearTint().setAlpha(1),
    });
    const push = new Phaser.Math.Vector2(hazard.x - this.player.x, hazard.y - this.player.y).normalize();
    hazard.setVelocity(push.x * 380, push.y * 380);
    gameBus.emit('game:toast', `URGENT REQUEST · -${damage} ENERGY`);
  }

  private offerPerks(): void {
    this.simulation!.markUpgradeOffered();
    this.perkPaused = true;
    this.physics.pause();
    const ids = choosePerks(3).map((perk) => perk.id);
    gameBus.emit('game:perk-offer', ids);
    analytics.capture('upgrade_offered', { shift_second: Math.round(this.simulation!.elapsed) });
  }

  private applyPerk(id: string): void {
    if (!this.simulation || !PERKS[id]) return;
    this.simulation.applyPerk(id);
    this.perkPaused = false;
    if (!this.manuallyPaused) this.physics.resume();
    soundboard.play('upgrade');
    this.burst(this.player.x, this.player.y, Phaser.Display.Color.HexStringToColor(PERKS[id].accent).color, 14);
    gameBus.emit('game:toast', `${PERKS[id].name.toUpperCase()} · LEVEL ${this.simulation.perkLevel(id)}`);
    analytics.capture('upgrade_selected', { perk: id, level: this.simulation.perkLevel(id) });
  }

  private activateChaosMode(): void {
    soundboard.play('chaos');
    this.cameras.main.shake(320, 0.008);
    this.tweens.add({ targets: this.chaosOverlay, alpha: { from: 0.28, to: 0 }, duration: 760, ease: 'Quad.Out' });
    this.tweens.add({ targets: this.officeGlow, alpha: { from: 0.22, to: 0 }, duration: 1400, ease: 'Sine.Out' });
    gameBus.emit('game:toast', 'CHAOS MODE · DOUBLE PERFORMANCE · ZERO ACCOUNTABILITY');
    analytics.capture('chaos_mode_started', { shift_second: Math.round(this.simulation!.elapsed) });
  }

  private togglePause(): void {
    if (!this.running || this.perkPaused) return;
    this.setManualPause(!this.manuallyPaused);
  }

  private setManualPause(paused: boolean): void {
    if (!this.running) return;
    this.manuallyPaused = paused;
    if (paused) this.physics.pause();
    else if (!this.perkPaused) this.physics.resume();
    gameBus.emit('game:pause', paused);
    analytics.capture(paused ? 'game_paused' : 'game_resumed', { shift_second: Math.round(this.simulation?.elapsed ?? 0) });
  }

  private finishRun(): void {
    if (!this.simulation || !this.running) return;
    this.running = false;
    this.physics.pause();
    this.walletCoins += this.simulation.runCoins;
    localStorage.setItem(WALLET_KEY, String(this.walletCoins));
    const result = this.simulation.result(this.walletCoins);
    soundboard.play(result.won ? 'win' : 'lose');
    this.cameras.main.fade(650, result.won ? 10 : 25, result.won ? 42 : 8, result.won ? 61 : 18);
    gameBus.emit('game:result', result);
    analytics.capture(result.won ? 'level_completed' : 'session_end', {
      completed: result.won,
      score: result.score,
      hazards_cleared: result.hazardsCleared,
      coins_earned: result.runCoins,
      survived_seconds: Math.round(result.survivedSeconds),
    });
  }

  private burst(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i += 1) {
      const particle = this.add.rectangle(x, y, Phaser.Math.Between(5, 11), Phaser.Math.Between(3, 7), color, 0.95).setDepth(30).setRotation(Math.random() * Math.PI);
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const distance = Phaser.Math.Between(38, 96);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        rotation: particle.rotation + Phaser.Math.FloatBetween(-2, 2),
        alpha: 0,
        scale: 0.25,
        duration: Phaser.Math.Between(280, 520),
        ease: 'Quad.Out',
        onComplete: () => particle.destroy(),
      });
    }
  }
}
