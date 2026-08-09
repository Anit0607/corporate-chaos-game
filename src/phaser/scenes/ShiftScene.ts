import Phaser from 'phaser';
import { soundboard } from '../../audio/Soundboard';
import { analytics } from '../../game/analytics/analytics';
import { CHARACTERS } from '../../game/content/characters';
import { availableHazards, HAZARDS, type HazardId } from '../../game/content/hazards';
import { choosePerks, PERKS } from '../../game/content/perks';
import { gameBus, type CharacterId } from '../../game/events';
import { profileStore } from '../../game/progression/ProfileStore';
import { ShiftSimulation } from '../../game/simulation/ShiftSimulation';
import { EffectsManager } from '../systems/EffectsManager';
import { PlayerController } from '../systems/PlayerController';

type SceneHazardKind = HazardId | 'boss';

const WALLET_KEY = 'corporate-chaos-wallet-v1';

export class ShiftScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private hazards!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private coins!: Phaser.Physics.Arcade.Group;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private playerController!: PlayerController;
  private effects!: EffectsManager;
  private simulation: ShiftSimulation | null = null;
  private selectedCharacter: CharacterId = 'red-recruit';
  private running = false;
  private manuallyPaused = false;
  private perkPaused = false;
  private walletCoins = 0;
  private lastSpawnAt = 0;
  private lastShotAt = 0;
  private lastHudAt = 0;
  private lastBossPatternAt = 0;
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
    this.playerController = new PlayerController(this, this.player);
    this.effects = new EffectsManager(this);

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

    this.pauseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.bindBus();
    const pauseOnFocusLoss = () => {
      if (this.running && !this.manuallyPaused && !this.perkPaused) this.setManualPause(true);
    };
    window.addEventListener('blur', pauseOnFocusLoss);
    this.unsubscribe.push(() => window.removeEventListener('blur', pauseOnFocusLoss));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe.splice(0).forEach((off) => off()));
  }

  update(time: number, delta: number): void {
    if (!this.running || !this.simulation) return;

    if (Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
      this.togglePause();
      return;
    }
    if (this.manuallyPaused || this.perkPaused) return;

    const status = this.simulation.tick(delta / 1000);
    if (status !== 'running') {
      this.finishRun();
      return;
    }

    const character = CHARACTERS[this.selectedCharacter];
    const playerState = this.playerController.update(time, this.simulation, character);
    if (playerState.dashStarted) {
      this.effects.burst(this.player.x, this.player.y, 0x27d9ff, 8);
      this.effects.shake(90, 0.003);
    }
    this.updateHazards(time);
    this.updateProjectiles(time);
    this.updateCoins(time);

    const difficulty = this.simulation.difficulty;
    if (time - this.lastSpawnAt >= difficulty.spawnEveryMs && (!this.simulation.bossStarted || this.simulation.bossPhase >= 2)) {
      this.lastSpawnAt = time;
      this.spawnHazard();
    }

    const attackDelay = Math.max(235, 820 * (1 - this.simulation.perkLevel('reply') * 0.18) / character.stats.fireRate / (this.simulation.activeEvent?.attackMultiplier ?? 1));
    if (time - this.lastShotAt >= attackDelay) {
      this.lastShotAt = time;
      this.fireAtNearest();
    }

    if (this.simulation.shouldOfferUpgrade) this.offerPerks();
    if (this.simulation.shouldTriggerCorporateEvent) this.triggerCorporateEvent();
    if (this.simulation.shouldStartBoss) this.startBossEncounter();

    if (time - this.lastHudAt > 85) {
      this.lastHudAt = time;
      gameBus.emit('game:hud', this.simulation.toHud(this.walletCoins, this.playerController.dashReady));
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
      gameBus.on('ui:restart', () => {
        analytics.capture('replay_clicked', { character: this.selectedCharacter });
        this.startRun();
      }),
      gameBus.on('ui:menu', () => this.returnToMenu()),
      gameBus.on('ui:perk-selected', (id) => this.applyPerk(id)),
      gameBus.on('ui:move', ({ x, y }) => this.playerController.setTouchVector(x, y)),
      gameBus.on('ui:dash', () => this.playerController.requestDash()),
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

    this.add.text(98, 590, 'BREAK ROOM', {
      color: '#8b704f', fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', letterSpacing: 2,
    }).setDepth(-90);
    this.add.text(1035, 590, 'HR SAFE SPACE', {
      color: '#8b704f', fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', letterSpacing: 2,
    }).setDepth(-90);
    this.add.text(1005, 330, 'EXECUTIVE LIFT', {
      color: '#8b704f', fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', letterSpacing: 2,
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
    const querySeed = Number(query.get('seed'));
    const configuredDuration = Number(import.meta.env.VITE_SHIFT_DURATION_SECONDS ?? 360);
    const duration = Number.isFinite(queryDuration) && queryDuration > 0 ? queryDuration : configuredDuration;
    const seed = Number.isFinite(querySeed) && querySeed > 0 ? querySeed : (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;

    this.hazards.clear(true, true);
    this.projectiles.clear(true, true);
    this.coins.clear(true, true);
    this.simulation = new ShiftSimulation({ durationSeconds: duration, character: this.selectedCharacter, seed });
    this.running = true;
    this.manuallyPaused = false;
    this.perkPaused = false;
    this.lastSpawnAt = this.time.now;
    this.lastShotAt = this.time.now - 1000;
    this.lastHudAt = 0;
    this.lastBossPatternAt = 0;
    this.playerController.reset(this.time.now);

    const character = CHARACTERS[this.selectedCharacter];
    this.player.setTexture(character.texture);
    this.player.setPosition(640, 565).setVelocity(0).setAlpha(1).clearTint();
    this.player.setActive(true).setVisible(true);
    this.player.body!.enable = true;
    this.physics.resume();
    this.cameras.main.resetFX();
    this.cameras.main.fadeIn(420, 7, 19, 40);
    gameBus.emit('game:run-started', undefined);
    gameBus.emit('game:hud', this.simulation.toHud(this.walletCoins, false));
    gameBus.emit('game:toast', character.quips[this.simulation.random.integer(0, character.quips.length - 1)]);
    gameBus.emit('game:profile', profileStore.load());
    analytics.capture('run_started', { character: this.selectedCharacter, duration_seconds: duration, seed });
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

  private spawnHazard(kindOverride?: HazardId, forcedPosition?: { x: number; y: number }, chained = false): void {
    const simulation = this.simulation!;
    const ratio = Math.min(1, simulation.elapsed / simulation.duration);
    const kind = kindOverride ?? this.chooseHazardKind(ratio);
    const definition = HAZARDS[kind];
    const edge = simulation.random.integer(0, 3);
    const padding = 36;
    let x = forcedPosition?.x ?? simulation.random.integer(95, 1185);
    let y = forcedPosition?.y ?? simulation.random.integer(205, 615);
    if (!forcedPosition && edge === 0) y = 198 - padding;
    if (!forcedPosition && edge === 1) x = 1202 + padding;
    if (!forcedPosition && edge === 2) y = 634 + padding;
    if (!forcedPosition && edge === 3) x = 78 - padding;

    const sprite = this.hazards.get(x, y, definition.texture) as Phaser.Physics.Arcade.Sprite | null;
    if (!sprite) return;
    const difficultyHealth = Math.max(0, simulation.difficulty.hazardHealth - 1);
    sprite.enableBody(true, x, y, true, true);
    sprite.setDepth(12).setScale(definition.scale).setAlpha(1).clearTint();
    sprite.setData({
      kind,
      hp: definition.health + (kind === 'email' ? 0 : difficultyHealth),
      damage: definition.damage,
      score: chained ? Math.round(definition.score * 0.45) : definition.score,
      coins: chained ? 0 : definition.coins,
      speed: simulation.difficulty.hazardSpeed * definition.speed,
      phase: simulation.random.next() * Math.PI * 2,
      spawnedAt: this.time.now,
      fuseAt: definition.behavior === 'timed' ? this.time.now + 7200 : 0,
      nextPulseAt: this.time.now + simulation.random.integer(1600, 3200),
    });
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(Math.min(sprite.width, sprite.height) * 0.33);
    this.effects.telegraph(x, y, definition.color, definition.behavior === 'area' ? 58 : 42, 520);
  }

  private updateHazards(time: number): void {
    this.hazards.getChildren().forEach((child) => {
      const hazard = child as Phaser.Physics.Arcade.Sprite;
      if (!hazard.active) return;
      const kind = hazard.getData('kind') as SceneHazardKind;
      const angle = Phaser.Math.Angle.Between(hazard.x, hazard.y, this.player.x, this.player.y);
      const phase = hazard.getData('phase') as number;
      const speed = hazard.getData('speed') as number;
      if (kind === 'boss') {
        const bossSpeed = [0, 52, 68, 88, 112][this.simulation!.bossPhase];
        this.physics.velocityFromRotation(angle + Math.sin(time * 0.0018) * 0.12, bossSpeed, hazard.body!.velocity);
        hazard.setRotation(Math.sin(time * 0.002) * 0.03);
        this.updateBossPattern(time, hazard);
        return;
      }

      const definition = HAZARDS[kind];
      let movementAngle = angle;
      let movementSpeed = speed;
      if (definition.behavior === 'zigzag') movementAngle += Math.sin(time * 0.007 + phase) * 0.72;
      if (definition.behavior === 'homing') movementAngle += Math.sin(time * 0.004 + phase) * 0.16;
      if (definition.behavior === 'orbit') movementAngle += 0.82 + Math.sin(time * 0.003 + phase) * 0.24;
      if (definition.behavior === 'persistent') movementSpeed *= Phaser.Math.Distance.Between(hazard.x, hazard.y, this.player.x, this.player.y) > 320 ? 1.45 : 0.86;
      if (definition.behavior === 'accelerate' && time >= (hazard.getData('nextPulseAt') as number)) {
        hazard.setData('nextPulseAt', time + 3300);
        hazard.setData('boostUntil', time + 720);
        this.effects.telegraph(hazard.x, hazard.y, definition.color, 68, 420);
      }
      if (time < ((hazard.getData('boostUntil') as number) || 0)) movementSpeed *= 2.1;

      if (definition.behavior === 'timed') {
        hazard.setVelocity(0).setRotation((hazard.getData('fuseAt') as number - time) * -0.006);
        const remaining = (hazard.getData('fuseAt') as number) - time;
        hazard.setTint(remaining < 2200 && Math.floor(remaining / 180) % 2 === 0 ? 0xffffff : 0xff4d8d);
        if (remaining <= 0) this.explodeDeadline(hazard);
        return;
      }

      this.physics.velocityFromRotation(movementAngle, movementSpeed, hazard.body!.velocity);
      hazard.setRotation(kind === 'manager' || kind === 'hr' || kind === 'review' ? 0 : movementAngle + Math.PI / 2);
      if (definition.behavior === 'area') {
        hazard.setScale(definition.scale + Math.sin(time * 0.006 + phase) * 0.08);
        if (time >= (hazard.getData('nextPulseAt') as number)) {
          hazard.setData('nextPulseAt', time + 2600);
          this.effects.telegraph(hazard.x, hazard.y, definition.color, 82, 700);
        }
      }
    });
  }

  private chooseHazardKind(ratio: number): HazardId {
    const focus = this.simulation!.activeEvent?.focusHazard;
    const available = availableHazards(ratio);
    if (focus && available.some((hazard) => hazard.id === focus) && this.simulation!.random.next() < 0.48) return focus;
    const totalWeight = available.reduce((sum, hazard) => sum + hazard.weight, 0);
    let roll = this.simulation!.random.next() * totalWeight;
    for (const hazard of available) {
      roll -= hazard.weight;
      if (roll <= 0) return hazard.id;
    }
    return available[0].id;
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
      damage: 1 + CHARACTERS[this.selectedCharacter].stats.projectileDamage + Math.floor(this.simulation!.perkLevel('reply') / 2) + (this.simulation!.chaosSeconds > 0 ? 1 : 0),
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
    const damage = projectile.getData('damage') as number;
    const kind = hazard.getData('kind') as SceneHazardKind;
    hazard.setTint(0xffffff);
    this.time.delayedCall(45, () => hazard.active && hazard.clearTint());

    const pierce = (projectile.getData('pierce') as number) - 1;
    projectile.setData('pierce', pierce);
    if (pierce < 0) projectile.disableBody(true, true);

    if (kind === 'boss') {
      const result = this.simulation!.damageBoss(damage);
      this.effects.floatingText(hazard.x, hazard.y - 48, `-${damage}`, '#ff9bbf');
      if (result.phaseChanged && !result.defeated) {
        gameBus.emit('game:toast', `REGIONAL DIRECTOR · PHASE ${result.phase} · SCOPE EXPANDED`);
        this.effects.shake(280, 0.007);
      }
      if (result.defeated) this.clearHazard(hazard);
      return;
    }

    const hp = (hazard.getData('hp') as number) - damage;
    hazard.setData('hp', hp);
    if (hp <= 0) this.clearHazard(hazard);
  }

  private clearHazard(hazard: Phaser.Physics.Arcade.Sprite): void {
    const kind = hazard.getData('kind') as SceneHazardKind;
    const score = hazard.getData('score') as number;
    const coinValue = hazard.getData('coins') as number;
    const x = hazard.x;
    const y = hazard.y;
    hazard.disableBody(true, true);
    if (kind === 'boss') {
      this.effects.burst(x, y, 0xff4d8d, 42);
      this.effects.shake(520, 0.014);
      soundboard.play('boss');
      gameBus.emit('game:toast', 'REGIONAL DIRECTOR OFFLINE · PLEASE ENJOY 5 PM');
      analytics.capture('boss_defeated', { shift_second: Math.round(this.simulation!.elapsed), seed: this.simulation!.seed });
      return;
    }

    this.effects.burst(x, y, HAZARDS[kind].color, kind === 'manager' ? 16 : 8);
    this.spawnCoin(x, y, coinValue);
    const chaosTriggered = this.simulation!.recordHazardCleared(score, 0);
    if (chaosTriggered) this.activateChaosMode();
    analytics.capture('hazard_defeated', { hazard: kind, shift_second: Math.round(this.simulation!.elapsed) });

    if (kind === 'email' && this.simulation!.random.next() < 0.18 && !this.simulation!.bossStarted) {
      this.time.delayedCall(120, () => {
        if (!this.running) return;
        this.spawnHazard('email', { x: Phaser.Math.Clamp(x - 24, 90, 1190), y: Phaser.Math.Clamp(y + 18, 200, 625) }, true);
        this.spawnHazard('email', { x: Phaser.Math.Clamp(x + 24, 90, 1190), y: Phaser.Math.Clamp(y - 18, 200, 625) }, true);
      });
    }
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
      if (distance < (120 + this.simulation!.perkLevel('printer') * 25) * CHARACTERS[this.selectedCharacter].stats.pickupRadius) {
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
    const kind = hazard.getData('kind') as SceneHazardKind;
    if (this.playerController.isDashing && kind === 'boss') {
      const result = this.simulation!.damageBoss(3);
      this.effects.burst(this.player.x, this.player.y, 0x27d9ff, 7);
      if (result.defeated) this.clearHazard(hazard);
      return;
    }
    if (this.playerController.isDashing) {
      this.clearHazard(hazard);
      if (this.simulation!.recordDashClear()) this.activateChaosMode();
      return;
    }
    if (this.playerController.isInvulnerable) return;
    this.playerController.grantInvulnerability(850);
    const damage = this.simulation!.takeDamage(hazard.getData('damage') as number);
    if (damage === 0) {
      soundboard.play('shield');
      this.effects.telegraph(this.player.x, this.player.y, 0x5ce1e6, 58, 560);
      gameBus.emit('game:toast', 'PROFESSIONAL BOUNDARY · REQUEST DECLINED');
      return;
    }
    soundboard.play('hit');
    this.effects.shake(180, 0.009);
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
    if (kind === 'review') {
      this.playerController.freezeUntil(now + 1350);
      gameBus.emit('game:toast', `PERFORMANCE REVIEW · FROZEN · -${damage} ENERGY`);
    } else if (kind === 'hr') {
      this.playerController.freezeUntil(now + 650);
      gameBus.emit('game:toast', `POLICY INTERVENTION · -${damage} ENERGY`);
    } else {
      gameBus.emit('game:toast', `URGENT REQUEST · -${damage} ENERGY`);
    }
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
    this.effects.burst(this.player.x, this.player.y, Phaser.Display.Color.HexStringToColor(PERKS[id].accent).color, 14);
    gameBus.emit('game:toast', `${PERKS[id].name.toUpperCase()} · LEVEL ${this.simulation.perkLevel(id)}`);
    analytics.capture('perk_selected', { perk: id, level: this.simulation.perkLevel(id) });
  }

  private activateChaosMode(): void {
    soundboard.play('chaos');
    this.effects.shake(320, 0.008);
    this.tweens.add({ targets: this.chaosOverlay, alpha: { from: 0.28, to: 0 }, duration: 760, ease: 'Quad.Out' });
    this.tweens.add({ targets: this.officeGlow, alpha: { from: 0.22, to: 0 }, duration: 1400, ease: 'Sine.Out' });
    gameBus.emit('game:toast', 'CHAOS MODE · DOUBLE PERFORMANCE · ZERO ACCOUNTABILITY');
    analytics.capture('chaos_activated', { shift_second: Math.round(this.simulation!.elapsed) });
  }

  private triggerCorporateEvent(): void {
    const event = this.simulation!.triggerCorporateEvent();
    gameBus.emit('game:corporate-event', event);
    soundboard.play('event');
    this.effects.telegraph(this.player.x, this.player.y, Phaser.Display.Color.HexStringToColor(event.accent).color, 84, 760);
    analytics.capture('corporate_event_started', { event: event.id, shift_second: Math.round(this.simulation!.elapsed) });
  }

  private startBossEncounter(): void {
    const simulation = this.simulation!;
    simulation.startBoss();
    this.hazards.getChildren().forEach((child) => {
      const hazard = child as Phaser.Physics.Arcade.Sprite;
      if (hazard.active && hazard.getData('kind') !== 'boss' && simulation.random.next() < 0.6) hazard.disableBody(true, true);
    });
    const boss = this.hazards.get(640, 150, 'hazard-director') as Phaser.Physics.Arcade.Sprite | null;
    if (!boss) return;
    boss.enableBody(true, 640, 150, true, true);
    boss.setDepth(18).setScale(0.92).setAlpha(1).clearTint();
    boss.setData({ kind: 'boss', damage: 28, score: 0, coins: 0, speed: 60, phase: 0, nextPulseAt: this.time.now + 2600 });
    (boss.body as Phaser.Physics.Arcade.Body).setCircle(45, 11, 10);
    this.lastBossPatternAt = this.time.now;
    soundboard.play('boss');
    this.effects.telegraph(640, 150, 0xff4d8d, 122, 1100);
    this.effects.shake(420, 0.012);
    gameBus.emit('game:toast', '5 PM ESCALATION · THE REGIONAL DIRECTOR HAS JOINED');
    analytics.capture('boss_started', { seed: simulation.seed, shift_second: Math.round(simulation.elapsed) });
  }

  private updateBossPattern(time: number, boss: Phaser.Physics.Arcade.Sprite): void {
    const phase = this.simulation!.bossPhase;
    const interval = [0, 4400, 3900, 3200, 2500][phase];
    if (time - this.lastBossPatternAt < interval) return;
    this.lastBossPatternAt = time;
    this.effects.telegraph(this.player.x, this.player.y, 0xff4d8d, 92, 820);
    const offset = this.simulation!.random.integer(-70, 70);
    if (phase === 1) {
      this.spawnHazard('email', { x: boss.x - 48, y: boss.y + 42 });
      this.spawnHazard('email', { x: boss.x + 48, y: boss.y + 42 });
      gameBus.emit('game:toast', 'QUICK SYNC · ACTION ITEMS SUMMONED');
    } else if (phase === 2) {
      this.spawnHazard('meeting', { x: Phaser.Math.Clamp(this.player.x + offset, 110, 1170), y: Phaser.Math.Clamp(this.player.y + offset, 215, 610) });
      gameBus.emit('game:toast', 'URGENT MEETING · ESCAPE ROUTE BLOCKED');
    } else if (phase === 3) {
      this.spawnHazard('client', { x: boss.x - 70, y: boss.y + 55 });
      this.spawnHazard('client', { x: boss.x + 70, y: boss.y + 55 });
      gameBus.emit('game:toast', 'CAN WE HAVE A QUICK CALL? · APPARENTLY TWO');
    } else {
      this.spawnHazard('deadline', { x: Phaser.Math.Clamp(this.player.x + offset, 110, 1170), y: Phaser.Math.Clamp(this.player.y - offset, 215, 610) });
      this.spawnHazard('review', { x: boss.x, y: boss.y + 70 });
      gameBus.emit('game:toast', 'PERFORMANCE IMPROVEMENT PLAN · FINAL BURST');
    }
  }

  private explodeDeadline(hazard: Phaser.Physics.Arcade.Sprite): void {
    if (!hazard.active) return;
    const distance = Phaser.Math.Distance.Between(hazard.x, hazard.y, this.player.x, this.player.y);
    const damage = hazard.getData('damage') as number;
    const x = hazard.x;
    const y = hazard.y;
    hazard.disableBody(true, true);
    this.effects.burst(x, y, HAZARDS.deadline.color, 22);
    this.effects.telegraph(x, y, HAZARDS.deadline.color, 170, 460);
    this.effects.shake(230, 0.009);
    if (distance < 220 && !this.playerController.isInvulnerable) {
      this.playerController.grantInvulnerability(850);
      const applied = this.simulation!.takeDamage(damage);
      gameBus.emit('game:toast', applied === 0 ? 'BOUNDARY HELD · DEADLINE DECLINED' : `DEADLINE MISSED · -${applied} ENERGY`);
    } else {
      gameBus.emit('game:toast', 'DEADLINE DODGED · EXPECT A FOLLOW-UP');
    }
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
    const progression = profileStore.recordRun(result);
    result.highScore = progression.profile.highScore;
    result.newAchievements = progression.unlocked;
    soundboard.play(result.won ? 'win' : 'lose');
    this.cameras.main.fade(650, result.won ? 10 : 25, result.won ? 42 : 8, result.won ? 61 : 18);
    gameBus.emit('game:result', result);
    gameBus.emit('game:profile', progression.profile);
    analytics.capture(result.won ? 'run_completed' : 'run_failed', {
      completed: result.won,
      score: result.score,
      hazards_cleared: result.hazardsCleared,
      coins_earned: result.runCoins,
      survived_seconds: Math.round(result.survivedSeconds),
      character: result.character,
      boss_defeated: result.bossDefeated,
      seed: result.seed,
      selected_build: result.perksChosen.join(','),
    });
  }
}
