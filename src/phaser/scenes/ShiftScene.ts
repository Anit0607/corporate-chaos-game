import Phaser from 'phaser';
import { soundboard } from '../../audio/Soundboard';
import { analytics } from '../../game/analytics/analytics';
import { bossPhaseDefinition, type BossPhase } from '../../game/content/boss';
import { CHARACTERS } from '../../game/content/characters';
import { availableHazards, HAZARDS, type HazardId } from '../../game/content/hazards';
import { PERKS } from '../../game/content/perks';
import { gameBus, type CharacterId } from '../../game/events';
import { profileStore } from '../../game/progression/ProfileStore';
import { ShiftSimulation, type GameplayModifiers } from '../../game/simulation/ShiftSimulation';
import { EffectsManager } from '../systems/EffectsManager';
import { createOfficeArena } from '../systems/OfficeArena';
import { PlayerController } from '../systems/PlayerController';

type SceneHazardKind = HazardId | 'boss';

interface PendingBossAttack {
  phase: BossPhase;
  executeAt: number;
  toast: string;
  spawns: Array<{ kind: HazardId; x: number; y: number }>;
}

interface RunTelemetry {
  damageReceived: number;
  blockedHits: number;
  deadlineDetonations: number;
  deadlineDodges: number;
  spawnedByHazard: Record<string, number>;
  clearedByHazard: Record<string, number>;
  damageBySource: Record<string, number>;
  eventHistory: string[];
  perkChoices: string[];
  bossPhaseReached: number;
}

const emptyHazardCounts = (): Record<string, number> => Object.fromEntries([...Object.keys(HAZARDS), 'boss'].map((id) => [id, 0]));

const createRunTelemetry = (): RunTelemetry => ({
  damageReceived: 0,
  blockedHits: 0,
  deadlineDetonations: 0,
  deadlineDodges: 0,
  spawnedByHazard: emptyHazardCounts(),
  clearedByHazard: emptyHazardCounts(),
  damageBySource: emptyHazardCounts(),
  eventHistory: [],
  perkChoices: [],
  bossPhaseReached: 0,
});

export interface ShiftSceneIntegrationSnapshot {
  running: boolean;
  balanceRate: number;
  reducedMotion: boolean;
  manuallyPaused: boolean;
  perkPaused: boolean;
  character: CharacterId;
  player: {
    active: boolean;
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    texture: string;
    renderTexture: string;
    renderFrame: string;
    animation: string;
    visualState: string;
    facingX: number;
    facingY: number;
    dashing: boolean;
    dashReady: boolean;
  };
  simulation: null | {
    elapsed: number;
    duration: number;
    energy: number;
    maxEnergy: number;
    score: number;
    runCoins: number;
    hazardsCleared: number;
    finished: boolean;
    won: boolean;
    perks: Record<string, number>;
    modifiers: GameplayModifiers;
    activeEventId: string | null;
    activeEventEndsAt: number;
    bossStarted: boolean;
    bossDefeated: boolean;
    bossHealth: number;
    bossMaxHealth: number;
    bossPhase: number;
  };
  activeEntities: { hazards: number; projectiles: number; coins: number; effects: number; timers: number };
  hazardActors: Array<{ kind: string; x: number; y: number }>;
  bossPresentation: {
    introActive: boolean;
    attackPending: boolean;
    attackTargets: Array<{ x: number; y: number }>;
    defeatPlaying: boolean;
    auraActive: boolean;
    phaseName: string;
  };
  telemetry: RunTelemetry;
  sceneSubscriptions: number;
  busListeners: number;
}

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
  private lastDashTrailAt = 0;
  private bossIntroUntil = 0;
  private pendingBossAttack: PendingBossAttack | null = null;
  private bossDefeatPlaying = false;
  private bossAura: Phaser.GameObjects.Arc | null = null;
  private gameplayTime = 0;
  private balanceRate = 1;
  private runTelemetry = createRunTelemetry();
  private chaosOverlay!: Phaser.GameObjects.Rectangle;
  private officeGlow!: Phaser.GameObjects.Rectangle;
  private readonly unsubscribe: Array<() => void> = [];
  private readonly runTimers = new Set<Phaser.Time.TimerEvent>();

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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownScene, this);
  }

  update(_time: number, delta: number): void {
    if (!this.running || !this.simulation) return;

    if (Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
      this.togglePause();
      return;
    }
    if (this.manuallyPaused || this.perkPaused) return;

    const scaledDelta = delta * this.balanceRate;
    this.gameplayTime += scaledDelta;
    const time = this.gameplayTime;
    const status = this.simulation.tick(scaledDelta / 1000);
    if (status !== 'running') {
      this.finishRun();
      return;
    }

    const character = CHARACTERS[this.selectedCharacter];
    const playerState = this.playerController.update(time, this.simulation, character);
    if (playerState.dashStarted) {
      this.effects.burst(this.player.x, this.player.y, 0x27d9ff, 8);
      this.effects.shockwave(this.player.x, this.player.y, 0x27d9ff, 58, 260);
      this.effects.shake(90, 0.003);
      this.effects.afterimage(this.player, 0x27d9ff, 240);
      soundboard.play('dash');
      this.lastDashTrailAt = time;
    } else if (this.playerController.isDashing && time - this.lastDashTrailAt >= 62) {
      this.lastDashTrailAt = time;
      this.effects.afterimage(this.player, this.selectedCharacter === 'red-recruit' ? 0xf33d53 : 0x3f7dff);
    }
    this.updateHazards(time);
    this.updateProjectiles(time);
    this.updateCoins(time);

    const difficulty = this.simulation.difficulty;
    if (time - this.lastSpawnAt >= difficulty.spawnEveryMs && (!this.simulation.bossStarted || this.simulation.bossPhase >= 2)) {
      this.lastSpawnAt = time;
      this.spawnHazard();
    }

    const attackDelay = Math.max(235, 820 * this.simulation.gameplayModifiers.fireDelayMultiplier / character.stats.fireRate / this.simulation.activeAttackMultiplier);
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

  private shutdownScene(): void {
    this.running = false;
    this.manuallyPaused = false;
    this.perkPaused = false;
    this.clearRunTimers();
    this.tweens.killAll();
    this.effects.clear();
    this.clearBossPresentation();
    this.unsubscribe.splice(0).forEach((off) => off());
    this.input.keyboard?.removeKey(this.pauseKey, true);
  }

  private scheduleRunTimer(delay: number, callback: () => void): void {
    let timer!: Phaser.Time.TimerEvent;
    timer = this.time.delayedCall(delay, () => {
      this.runTimers.delete(timer);
      callback();
    });
    this.runTimers.add(timer);
  }

  private clearRunTimers(): void {
    this.runTimers.forEach((timer) => timer.remove(false));
    this.runTimers.clear();
  }

  integrationSnapshot(): ShiftSceneIntegrationSnapshot {
    const body = this.player?.body as Phaser.Physics.Arcade.Body | undefined;
    const simulation = this.simulation;
    return {
      running: this.running,
      balanceRate: this.balanceRate,
      reducedMotion: this.effects?.isReducedMotion ?? false,
      manuallyPaused: this.manuallyPaused,
      perkPaused: this.perkPaused,
      character: this.selectedCharacter,
      player: {
        active: this.player?.active ?? false,
        x: this.player?.x ?? 0,
        y: this.player?.y ?? 0,
        velocityX: body?.velocity.x ?? 0,
        velocityY: body?.velocity.y ?? 0,
        texture: this.playerController?.baseTexture ?? '',
        renderTexture: this.player?.texture?.key ?? '',
        renderFrame: String(this.player?.frame?.name ?? ''),
        animation: this.playerController?.animationKey ?? '',
        visualState: this.playerController?.visualState ?? 'idle',
        facingX: this.playerController?.facing.x ?? 1,
        facingY: this.playerController?.facing.y ?? 0,
        dashing: this.playerController?.isDashing ?? false,
        dashReady: this.playerController?.dashReady ?? false,
      },
      simulation: simulation ? {
        elapsed: simulation.elapsed,
        duration: simulation.duration,
        energy: simulation.energy,
        maxEnergy: simulation.maxEnergy,
        score: simulation.score,
        runCoins: simulation.runCoins,
        hazardsCleared: simulation.hazardsCleared,
        finished: simulation.finished,
        won: simulation.won,
        perks: Object.fromEntries(simulation.perks),
        modifiers: simulation.gameplayModifiers,
        activeEventId: simulation.activeEvent?.id ?? null,
        activeEventEndsAt: simulation.activeEventEndsAt,
        bossStarted: simulation.bossStarted,
        bossDefeated: simulation.bossDefeated,
        bossHealth: simulation.bossHealth,
        bossMaxHealth: simulation.bossMaxHealth,
        bossPhase: simulation.bossPhase,
      } : null,
      activeEntities: {
        hazards: this.hazards?.countActive(true) ?? 0,
        projectiles: this.projectiles?.countActive(true) ?? 0,
        coins: this.coins?.countActive(true) ?? 0,
        effects: this.effects?.activeCount ?? 0,
        timers: this.runTimers.size,
      },
      hazardActors: (this.hazards?.getChildren() ?? [])
        .map((child) => child as Phaser.Physics.Arcade.Sprite)
        .filter((hazard) => hazard.active)
        .map((hazard) => ({ kind: String(hazard.getData('kind')), x: hazard.x, y: hazard.y })),
      bossPresentation: {
        introActive: this.bossIntroUntil > this.gameplayTime,
        attackPending: this.pendingBossAttack !== null,
        attackTargets: this.pendingBossAttack?.spawns.map(({ x, y }) => ({ x, y })) ?? [],
        defeatPlaying: this.bossDefeatPlaying,
        auraActive: this.bossAura?.active ?? false,
        phaseName: bossPhaseDefinition(simulation?.bossPhase || 1).name,
      },
      telemetry: {
        ...this.runTelemetry,
        spawnedByHazard: { ...this.runTelemetry.spawnedByHazard },
        clearedByHazard: { ...this.runTelemetry.clearedByHazard },
        damageBySource: { ...this.runTelemetry.damageBySource },
        eventHistory: [...this.runTelemetry.eventHistory],
        perkChoices: [...this.runTelemetry.perkChoices],
      },
      sceneSubscriptions: this.unsubscribe.length,
      busListeners: gameBus.listenerCount(),
    };
  }

  integrationDamageBoss(amount: number): void {
    if (!this.simulation?.bossStarted || this.simulation.bossDefeated) return;
    this.damageBoss(Math.max(0, amount), this.findBoss(), true);
  }

  integrationDefeatPlayer(): void {
    if (this.simulation) this.simulation.energy = 0;
  }

  integrationRestorePlayer(): void {
    if (!this.simulation) return;
    this.simulation.energy = this.simulation.maxEnergy;
    this.emitHud();
  }

  integrationPrepareBoss(perks: string[]): void {
    if (!this.simulation || this.simulation.bossStarted) return;
    perks.filter((id) => PERKS[id]).forEach((id) => {
      this.simulation!.applyPerk(id);
      this.runTelemetry.perkChoices.push(id);
    });
    this.simulation.energy = this.simulation.maxEnergy;
    this.simulation.elapsed = this.simulation.bossStartAt;
    this.emitHud();
  }

  integrationPrimeBossAttack(): void {
    if (!this.simulation?.bossStarted || this.simulation.bossDefeated) return;
    this.projectiles.clear(true, true);
    this.pendingBossAttack = null;
    this.lastBossPatternAt = this.gameplayTime - 10_000;
  }

  integrationClockOut(): void {
    if (this.simulation) this.simulation.elapsed = this.simulation.duration;
  }

  integrationSpawnContactHazard(): void {
    if (!this.running || !this.simulation || !this.player.active) return;
    this.spawnHazard('email', { x: this.player.x, y: this.player.y });
    const contacts = this.hazards.getChildren()
      .map((child) => child as Phaser.Physics.Arcade.Sprite)
      .filter((hazard) => hazard.active && hazard.getData('kind') === 'email' && Phaser.Math.Distance.Between(hazard.x, hazard.y, this.player.x, this.player.y) < 2);
    const contact = contacts[contacts.length - 1];
    if (contact) this.hitPlayer(contact);
  }

  private emitHud(): void {
    if (this.simulation) gameBus.emit('game:hud', this.simulation.toHud(this.walletCoins, this.playerController.dashReady));
  }

  private createEnvironment(): void {
    const arena = createOfficeArena(this);
    this.obstacles = arena.obstacles;
    this.officeGlow = arena.officeGlow;
    this.chaosOverlay = arena.chaosOverlay;
  }

  private startRun(): void {
    const query = new URLSearchParams(window.location.search);
    const queryDuration = Number(query.get('duration'));
    const querySeed = Number(query.get('seed'));
    const queryBalanceRate = Number(query.get('balanceRate'));
    const configuredDuration = Number(import.meta.env.VITE_SHIFT_DURATION_SECONDS ?? 360);
    const duration = Number.isFinite(queryDuration) && queryDuration > 0 ? queryDuration : configuredDuration;
    const seed = Number.isFinite(querySeed) && querySeed > 0 ? querySeed : (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    this.balanceRate = import.meta.env.DEV && query.has('balance') && Number.isFinite(queryBalanceRate)
      ? Phaser.Math.Clamp(queryBalanceRate, 1, 8)
      : 1;

    this.clearRunTimers();
    this.tweens.killAll();
    this.effects.clear();
    this.clearBossPresentation();
    this.hazards.clear(true, true);
    this.projectiles.clear(true, true);
    this.coins.clear(true, true);
    this.simulation = new ShiftSimulation({ durationSeconds: duration, character: this.selectedCharacter, seed });
    this.runTelemetry = createRunTelemetry();
    this.running = true;
    this.manuallyPaused = false;
    this.perkPaused = false;
    this.gameplayTime = 0;
    this.lastSpawnAt = this.gameplayTime;
    this.lastShotAt = this.gameplayTime - 1000;
    this.lastHudAt = 0;
    this.lastBossPatternAt = 0;
    this.lastDashTrailAt = 0;
    this.bossIntroUntil = 0;
    this.pendingBossAttack = null;
    this.bossDefeatPlaying = false;
    const character = CHARACTERS[this.selectedCharacter];
    this.playerController.reset(this.gameplayTime, character.texture);
    this.time.timeScale = this.balanceRate;
    this.tweens.timeScale = this.balanceRate;
    this.physics.world.timeScale = 1 / this.balanceRate;

    this.player.setPosition(640, 565).setVelocity(0).setAlpha(1).clearTint();
    this.player.setActive(true).setVisible(true);
    this.player.body!.enable = true;
    this.physics.resume();
    this.cameras.main.resetFX();
    this.cameras.main.fadeIn(420, 7, 19, 40);
    gameBus.emit('game:run-started', undefined);
    this.emitHud();
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
    this.clearRunTimers();
    this.tweens.killAll();
    this.effects.clear();
    this.clearBossPresentation();
    this.physics.pause();
    this.hazards.clear(true, true);
    this.projectiles.clear(true, true);
    this.coins.clear(true, true);
    this.player.setVisible(false).setActive(false);
    this.player.body!.enable = false;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.physics.world.timeScale = 1;
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
      spawnedAt: this.gameplayTime,
      fuseAt: definition.behavior === 'timed' ? this.gameplayTime + 6500 : 0,
      nextPulseAt: this.gameplayTime + simulation.random.integer(1600, 3200),
    });
    this.runTelemetry.spawnedByHazard[kind] += 1;
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(Math.min(sprite.width, sprite.height) * 0.33);
    this.effects.telegraph(x, y, definition.color, definition.behavior === 'area' ? 58 : 42, 520);
    this.effects.hazardSpawn(x, y, definition.color);
    soundboard.play('hazardSpawn');
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
        const phase = Math.max(1, this.simulation!.bossPhase) as BossPhase;
        const presentation = bossPhaseDefinition(phase);
        if (hazard.getData('intro')) {
          const startAt = this.bossIntroUntil - 1400;
          const progress = Phaser.Math.Clamp((time - startAt) / 1400, 0, 1);
          const eased = Phaser.Math.Easing.Cubic.Out(progress);
          hazard.setPosition(640, Phaser.Math.Linear(-90, 150, eased));
          hazard.setAlpha(0.18 + progress * 0.82).setScale(0.72 + progress * 0.22);
          if (progress >= 1) {
            hazard.setData('intro', false);
            hazard.body!.enable = true;
            this.lastBossPatternAt = time;
            this.applyBossPhasePresentation(phase, hazard, false);
          }
          this.updateBossAura(hazard, presentation, time);
          return;
        }
        const bossSpeed = [0, 52, 68, 88, 112][this.simulation!.bossPhase];
        this.physics.velocityFromRotation(angle + Math.sin(time * 0.0018) * 0.12, bossSpeed, hazard.body!.velocity);
        hazard.setRotation(Math.sin(time * 0.002) * 0.03);
        const changedAt = (hazard.getData('phaseChangedAt') as number) || 0;
        const transition = Phaser.Math.Clamp(1 - (time - changedAt) / 620, 0, 1);
        hazard.setScale(presentation.scale + Math.sin(time * 0.028) * transition * 0.1);
        this.updateBossAura(hazard, presentation, time);
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
        this.effects.shockwave(hazard.x, hazard.y, definition.color, 58, 320);
        soundboard.play('warning');
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
      damage: 1 + CHARACTERS[this.selectedCharacter].stats.projectileDamage + this.simulation!.gameplayModifiers.projectileDamageBonus + (this.simulation!.chaosSeconds > 0 ? 1 : 0),
      pierce: this.simulation!.gameplayModifiers.projectilePierce,
      expires: this.gameplayTime + 1500,
      nextTrailAt: this.gameplayTime,
    });
    this.physics.velocityFromRotation(angle, 650, projectile.body!.velocity);
    this.playerController.playAttack(this.gameplayTime);
    this.effects.muzzleFlash(this.player.x, this.player.y, angle, this.selectedCharacter === 'red-recruit' ? 0xff6f87 : 0x5ce1e6);
    soundboard.play('fire');
  }

  private updateProjectiles(time: number): void {
    this.projectiles.getChildren().forEach((child) => {
      const projectile = child as Phaser.Physics.Arcade.Sprite;
      if (projectile.active && !this.effects.isReducedMotion && time >= ((projectile.getData('nextTrailAt') as number) || 0)) {
        projectile.setData('nextTrailAt', time + 70);
        this.effects.projectileTrail(projectile.x, projectile.y, projectile.rotation);
      }
      if (projectile.active && (time > projectile.getData('expires') || projectile.x < 40 || projectile.x > 1240 || projectile.y < 80 || projectile.y > 670)) {
        projectile.disableBody(true, true);
      }
    });
  }

  private hitHazard(projectile: Phaser.Physics.Arcade.Sprite, hazard: Phaser.Physics.Arcade.Sprite): void {
    if (!projectile.active || !hazard.active) return;
    const damage = projectile.getData('damage') as number;
    const kind = hazard.getData('kind') as SceneHazardKind;
    const impactAngle = projectile.rotation;
    this.effects.impact(projectile.x, projectile.y, kind === 'boss' ? bossPhaseDefinition(this.simulation?.bossPhase || 1).color : HAZARDS[kind].color, impactAngle, kind === 'boss');
    soundboard.play('hazardHit');
    hazard.setTint(0xffffff);
    this.scheduleRunTimer(45, () => {
      if (!hazard.active) return;
      if (kind === 'boss') hazard.setTint(bossPhaseDefinition(this.simulation?.bossPhase || 1).color);
      else hazard.clearTint();
    });

    const pierce = (projectile.getData('pierce') as number) - 1;
    projectile.setData('pierce', pierce);
    if (pierce < 0) projectile.disableBody(true, true);

    if (kind === 'boss') {
      this.effects.floatingText(hazard.x, hazard.y - 48, `-${damage}`, '#ff9bbf');
      this.damageBoss(damage, hazard, false);
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
    this.runTelemetry.clearedByHazard[kind] += 1;
    if (kind === 'boss') {
      this.playBossDefeatSequence(hazard, x, y);
      return;
    }

    hazard.disableBody(true, true);

    this.effects.burst(x, y, HAZARDS[kind].color, kind === 'manager' ? 16 : 8);
    this.effects.shockwave(x, y, HAZARDS[kind].color, kind === 'manager' ? 76 : 54, 340);
    this.spawnCoin(x, y, coinValue);
    const chaosTriggered = this.simulation!.recordHazardCleared(score, 0);
    if (chaosTriggered) this.activateChaosMode();
    analytics.capture('hazard_defeated', { hazard: kind, shift_second: Math.round(this.simulation!.elapsed) });

    if (kind === 'email' && this.simulation!.random.next() < 0.18 && !this.simulation!.bossStarted) {
      this.scheduleRunTimer(120, () => {
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
    coin.setDepth(14).setScale(0.82).setAlpha(1).setData({ value, expires: this.gameplayTime + 9000, phase: Math.random() * 6 });
    coin.setVelocity(Phaser.Math.Between(-55, 55), Phaser.Math.Between(-55, 55));
    coin.setDrag(180, 180);
  }

  private updateCoins(time: number): void {
    this.coins.getChildren().forEach((child) => {
      const coin = child as Phaser.Physics.Arcade.Sprite;
      if (!coin.active) return;
      coin.setRotation(time * 0.004 + (coin.getData('phase') as number));
      const distance = Phaser.Math.Distance.Between(coin.x, coin.y, this.player.x, this.player.y);
      if (distance < (120 + this.simulation!.gameplayModifiers.pickupRadiusBonus) * CHARACTERS[this.selectedCharacter].stats.pickupRadius) {
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
    this.effects.burst(this.player.x, this.player.y - 8, 0xffbd45, 3);
    soundboard.play('coin');
  }

  private hitPlayer(hazard: Phaser.Physics.Arcade.Sprite): void {
    const now = this.gameplayTime;
    if (!hazard.active) return;
    const kind = hazard.getData('kind') as SceneHazardKind;
    if (this.playerController.isDashing && kind === 'boss') {
      this.damageBoss(3, hazard, false);
      this.effects.burst(this.player.x, this.player.y, 0x27d9ff, 7);
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
      this.runTelemetry.blockedHits += 1;
      soundboard.play('shield');
      this.effects.telegraph(this.player.x, this.player.y, 0x5ce1e6, 58, 560);
      this.effects.shockwave(this.player.x, this.player.y, 0x5ce1e6, 74, 360);
      gameBus.emit('game:toast', 'PROFESSIONAL BOUNDARY · REQUEST DECLINED');
      return;
    }
    this.runTelemetry.damageReceived += damage;
    this.runTelemetry.damageBySource[kind] += damage;
    soundboard.play('hit');
    this.effects.shake(180, 0.009);
    this.effects.screenFlash(0xf33d53, 0.13, 150);
    this.effects.impact(this.player.x, this.player.y, 0xff6f87, Phaser.Math.Angle.Between(hazard.x, hazard.y, this.player.x, this.player.y), true);
    this.playerController.playHurt(now);
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
    const ids = this.simulation!.choosePerkIds(3);
    gameBus.emit('game:perk-offer', ids);
    analytics.capture('upgrade_offered', { shift_second: Math.round(this.simulation!.elapsed) });
  }

  private applyPerk(id: string): void {
    if (!this.simulation || !PERKS[id]) return;
    this.simulation.applyPerk(id);
    this.runTelemetry.perkChoices.push(id);
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
    this.effects.screenFlash(0xff3aa7, 0.12, 260);
    this.effects.shockwave(this.player.x, this.player.y, 0xff3aa7, 120, 520);
    this.tweens.add({ targets: this.chaosOverlay, alpha: { from: 0.28, to: 0 }, duration: 760, ease: 'Quad.Out' });
    this.tweens.add({ targets: this.officeGlow, alpha: { from: 0.22, to: 0 }, duration: 1400, ease: 'Sine.Out' });
    gameBus.emit('game:toast', 'CHAOS MODE · DOUBLE PERFORMANCE · ZERO ACCOUNTABILITY');
    analytics.capture('chaos_activated', { shift_second: Math.round(this.simulation!.elapsed) });
  }

  private triggerCorporateEvent(): void {
    const event = this.simulation!.triggerCorporateEvent();
    this.runTelemetry.eventHistory.push(event.id);
    gameBus.emit('game:corporate-event', event);
    soundboard.play('event');
    this.effects.telegraph(this.player.x, this.player.y, Phaser.Display.Color.HexStringToColor(event.accent).color, 84, 760);
    this.effects.screenFlash(Phaser.Display.Color.HexStringToColor(event.accent).color, 0.08, 220);
    analytics.capture('corporate_event_started', { event: event.id, shift_second: Math.round(this.simulation!.elapsed) });
  }

  private startBossEncounter(): void {
    const simulation = this.simulation!;
    simulation.startBoss();
    this.hazards.getChildren().forEach((child) => {
      const hazard = child as Phaser.Physics.Arcade.Sprite;
      if (hazard.active && hazard.getData('kind') !== 'boss') hazard.disableBody(true, true);
    });
    const boss = this.hazards.get(640, -90, 'hazard-director') as Phaser.Physics.Arcade.Sprite | null;
    if (!boss) return;
    boss.enableBody(true, 640, -90, true, true);
    boss.setDepth(18).setScale(0.72).setAlpha(0.18).setTint(bossPhaseDefinition(1).color);
    boss.setData({ kind: 'boss', damage: 28, score: 0, coins: 0, speed: 60, phase: 1, intro: true, phaseChangedAt: this.gameplayTime, nextPulseAt: this.gameplayTime + 2600 });
    this.runTelemetry.spawnedByHazard.boss += 1;
    this.runTelemetry.bossPhaseReached = 1;
    (boss.body as Phaser.Physics.Arcade.Body).setCircle(45, 11, 10);
    boss.body!.enable = false;
    this.bossIntroUntil = this.gameplayTime + 1400;
    this.pendingBossAttack = null;
    this.bossDefeatPlaying = false;
    this.bossAura?.destroy();
    this.bossAura = this.add.circle(640, -90, 66, bossPhaseDefinition(1).color, 0.08)
      .setStrokeStyle(4, bossPhaseDefinition(1).color, 0.7)
      .setDepth(17);
    this.lastBossPatternAt = this.bossIntroUntil;
    soundboard.play('boss');
    this.effects.telegraph(640, 150, 0xff4d8d, 122, 1100);
    this.effects.shockwave(640, 150, 0xff4d8d, 150, 760);
    this.effects.screenFlash(0xff4d8d, 0.11, 260);
    this.effects.shake(420, 0.012);
    gameBus.emit('game:boss-presentation', {
      kind: 'entrance', phase: 1, kicker: '4:12 PM // FINAL ESCALATION', title: 'THE REGIONAL DIRECTOR',
      detail: 'Scope has entered the building. Survive the review and hold until 5:00 PM.', accent: bossPhaseDefinition(1).accent, duration: 1500,
    });
    this.emitHud();
    analytics.capture('boss_started', { seed: simulation.seed, shift_second: Math.round(simulation.elapsed) });
  }

  private updateBossPattern(time: number, boss: Phaser.Physics.Arcade.Sprite): void {
    if (boss.getData('intro') || this.bossDefeatPlaying) return;
    const phase = this.simulation!.bossPhase as BossPhase;
    if (this.pendingBossAttack) {
      if (this.pendingBossAttack.phase !== phase) {
        this.pendingBossAttack = null;
        return;
      }
      if (time < this.pendingBossAttack.executeAt) return;
      const attack = this.pendingBossAttack;
      this.pendingBossAttack = null;
      attack.spawns.forEach(({ kind, x, y }) => this.spawnHazard(kind, { x, y }));
      gameBus.emit('game:toast', attack.toast);
      return;
    }

    const interval = [0, 4400, 3900, 3200, 2500][phase];
    if (time - this.lastBossPatternAt < interval) return;
    this.lastBossPatternAt = time;
    const presentation = bossPhaseDefinition(phase);
    const offset = this.simulation!.random.integer(-70, 70);
    let toast = '';
    let spawns: PendingBossAttack['spawns'] = [];
    if (phase === 1) {
      spawns = [
        { kind: 'email', ...this.safeBossSpawn(boss.x - 64, boss.y + 58, 210) },
        { kind: 'email', ...this.safeBossSpawn(boss.x + 64, boss.y + 58, 210) },
      ];
      toast = 'QUICK SYNC · ACTION ITEMS SUMMONED';
    } else if (phase === 2) {
      spawns = [{ kind: 'meeting', ...this.safeBossSpawn(this.player.x + offset, this.player.y - offset, 240) }];
      toast = 'URGENT MEETING · ESCAPE ROUTE BLOCKED';
    } else if (phase === 3) {
      spawns = [
        { kind: 'client', ...this.safeBossSpawn(boss.x - 84, boss.y + 70, 220) },
        { kind: 'client', ...this.safeBossSpawn(boss.x + 84, boss.y + 70, 220) },
      ];
      toast = 'CAN WE HAVE A QUICK CALL? · APPARENTLY TWO';
    } else {
      spawns = [
        { kind: 'deadline', ...this.safeBossSpawn(this.player.x + offset, this.player.y - offset, 250) },
        { kind: 'review', ...this.safeBossSpawn(boss.x, boss.y + 82, 225) },
      ];
      toast = 'PERFORMANCE IMPROVEMENT PLAN · FINAL BURST';
    }

    spawns.forEach(({ x, y }) => {
      this.effects.telegraph(x, y, presentation.color, phase === 4 ? 82 : 64, 720);
      this.effects.shockwave(x, y, presentation.color, phase === 4 ? 88 : 70, 640);
    });
    this.pendingBossAttack = { phase, executeAt: time + 720, toast, spawns };
    soundboard.play('bossAttack');
    soundboard.play('warning');
    gameBus.emit('game:boss-presentation', {
      kind: 'attack', phase, kicker: `PHASE ${phase}`, title: presentation.warning,
      detail: presentation.directive, accent: presentation.accent, duration: 720,
    });
  }

  private safeBossSpawn(preferredX: number, preferredY: number, minimumDistance: number): { x: number; y: number } {
    let x = Phaser.Math.Clamp(preferredX, 105, 1175);
    let y = Phaser.Math.Clamp(preferredY, 205, 615);
    let dx = x - this.player.x;
    let dy = y - this.player.y;
    let distance = Math.hypot(dx, dy);
    if (distance >= minimumDistance) return { x, y };

    if (distance < 1) {
      const angle = this.simulation!.random.next() * Math.PI * 2;
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      distance = 1;
    }
    x = Phaser.Math.Clamp(this.player.x + (dx / distance) * minimumDistance, 105, 1175);
    y = Phaser.Math.Clamp(this.player.y + (dy / distance) * minimumDistance, 205, 615);
    if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) >= minimumDistance - 1) return { x, y };

    return [
      { x: 105, y: 205 }, { x: 1175, y: 205 }, { x: 105, y: 615 }, { x: 1175, y: 615 },
      { x: 640, y: 205 }, { x: 640, y: 615 },
    ].sort((a, b) => Phaser.Math.Distance.Squared(this.player.x, this.player.y, b.x, b.y) - Phaser.Math.Distance.Squared(this.player.x, this.player.y, a.x, a.y))[0];
  }

  private findBoss(): Phaser.Physics.Arcade.Sprite | undefined {
    return this.hazards.getChildren().find((child) => {
      const hazard = child as Phaser.Physics.Arcade.Sprite;
      return hazard.visible && hazard.getData('kind') === 'boss';
    }) as Phaser.Physics.Arcade.Sprite | undefined;
  }

  private damageBoss(amount: number, boss: Phaser.Physics.Arcade.Sprite | undefined, emitImmediately: boolean): void {
    if (!this.simulation?.bossStarted || this.simulation.bossDefeated) return;
    const result = this.simulation.damageBoss(Math.max(0, amount));
    this.runTelemetry.bossPhaseReached = Math.max(this.runTelemetry.bossPhaseReached, result.phase);
    if (result.phaseChanged && !result.defeated) this.applyBossPhasePresentation(result.phase as BossPhase, boss, true);
    if (result.defeated && boss) this.clearHazard(boss);
    if (emitImmediately) this.emitHud();
  }

  private applyBossPhasePresentation(phase: BossPhase, boss: Phaser.Physics.Arcade.Sprite | undefined, announce: boolean): void {
    const presentation = bossPhaseDefinition(phase);
    this.pendingBossAttack = null;
    this.lastBossPatternAt = this.gameplayTime;
    if (boss) {
      boss.setData('phase', phase).setData('phaseChangedAt', this.gameplayTime).setTint(presentation.color);
      boss.setScale(presentation.scale);
    }
    if (this.bossAura) {
      this.bossAura.setFillStyle(presentation.color, 0.08).setStrokeStyle(4, presentation.color, 0.72);
    }
    if (!announce) return;
    soundboard.play('bossPhase');
    this.effects.burst(boss?.x ?? 640, boss?.y ?? 150, presentation.color, 24);
    this.effects.telegraph(boss?.x ?? 640, boss?.y ?? 150, presentation.color, 104, 760);
    this.effects.shockwave(boss?.x ?? 640, boss?.y ?? 150, presentation.color, 145, 620);
    this.effects.screenFlash(presentation.color, 0.1, 220);
    this.effects.shake(300, 0.009);
    gameBus.emit('game:boss-presentation', {
      kind: 'phase', phase, kicker: `PHASE ${phase} // SCOPE CHANGE`, title: presentation.name,
      detail: `Incoming directive: ${presentation.directive}.`, accent: presentation.accent, duration: 1250,
    });
    analytics.capture('boss_phase_changed', { phase, seed: this.simulation?.seed ?? 0 });
    this.emitHud();
  }

  private updateBossAura(boss: Phaser.Physics.Arcade.Sprite, presentation: ReturnType<typeof bossPhaseDefinition>, time: number): void {
    if (!this.bossAura?.active) return;
    const pulse = 1 + Math.sin(time * 0.006 + presentation.phase) * 0.08;
    this.bossAura.setPosition(boss.x, boss.y + 4).setScale(pulse).setAlpha(0.62 + Math.sin(time * 0.004) * 0.16);
  }

  private playBossDefeatSequence(boss: Phaser.Physics.Arcade.Sprite, x: number, y: number): void {
    this.pendingBossAttack = null;
    this.bossIntroUntil = 0;
    this.bossDefeatPlaying = true;
    boss.body!.enable = false;
    boss.setVelocity(0).setActive(false).setVisible(true).setTint(0xffffff);
    this.effects.burst(x, y, 0x5ce1e6, 56);
    this.effects.telegraph(x, y, 0x9ce65c, 150, 920);
    this.effects.shockwave(x, y, 0x5ce1e6, 160, 620);
    this.effects.screenFlash(0x9ce65c, 0.18, 420);
    this.effects.shake(650, 0.016);
    soundboard.play('bossDefeat');
    gameBus.emit('game:boss-presentation', {
      kind: 'defeat', phase: 4, kicker: 'FINAL REVIEW COMPLETE', title: 'DIRECTOR OFFLINE',
      detail: 'Hold the floor until 5:00 PM. Do not answer follow-up emails.', accent: '#9ce65c', duration: 1600,
    });
    this.tweens.add({
      targets: boss,
      y: y - 55,
      rotation: boss.rotation + 0.16,
      scale: 1.42,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.In',
      onComplete: () => boss.setVisible(false),
    });
    if (this.bossAura) {
      this.tweens.add({ targets: this.bossAura, scale: 2.2, alpha: 0, duration: 850, ease: 'Quad.Out' });
    }
    this.scheduleRunTimer(160, () => {
      if (!this.running) return;
      this.effects.shockwave(x, y, 0x9ce65c, 210, 720);
      this.effects.burst(x, y, 0xfff4dc, 22);
    });
    this.scheduleRunTimer(360, () => {
      if (!this.running) return;
      this.effects.shockwave(x, y, 0xffbd45, 245, 760);
    });
    this.scheduleRunTimer(950, () => {
      this.bossDefeatPlaying = false;
      this.bossAura?.destroy();
      this.bossAura = null;
    });
    analytics.capture('boss_defeated', { shift_second: Math.round(this.simulation!.elapsed), seed: this.simulation!.seed });
    this.emitHud();
  }

  private clearBossPresentation(): void {
    this.pendingBossAttack = null;
    this.bossIntroUntil = 0;
    this.bossDefeatPlaying = false;
    this.bossAura?.destroy();
    this.bossAura = null;
  }

  private explodeDeadline(hazard: Phaser.Physics.Arcade.Sprite): void {
    if (!hazard.active) return;
    const distance = Phaser.Math.Distance.Between(hazard.x, hazard.y, this.player.x, this.player.y);
    const damage = hazard.getData('damage') as number;
    const x = hazard.x;
    const y = hazard.y;
    const blastRadius = 240;
    hazard.disableBody(true, true);
    this.runTelemetry.deadlineDetonations += 1;
    this.effects.burst(x, y, HAZARDS.deadline.color, 22);
    this.effects.telegraph(x, y, HAZARDS.deadline.color, 170, 460);
    this.effects.shake(230, 0.009);
    if (distance < blastRadius && !this.playerController.isInvulnerable) {
      this.playerController.grantInvulnerability(850);
      const applied = this.simulation!.takeDamage(damage);
      if (applied === 0) this.runTelemetry.blockedHits += 1;
      else {
        this.runTelemetry.damageReceived += applied;
        this.runTelemetry.damageBySource.deadline += applied;
        this.playerController.playHurt(this.gameplayTime);
        this.effects.screenFlash(HAZARDS.deadline.color, 0.15, 180);
        this.effects.impact(this.player.x, this.player.y, HAZARDS.deadline.color, 0, true);
        soundboard.play('hit');
      }
      gameBus.emit('game:toast', applied === 0 ? 'BOUNDARY HELD · DEADLINE DECLINED' : `DEADLINE MISSED · -${applied} ENERGY`);
    } else {
      this.runTelemetry.deadlineDodges += 1;
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
    this.clearRunTimers();
    this.physics.pause();
    this.walletCoins += this.simulation.runCoins;
    localStorage.setItem(WALLET_KEY, String(this.walletCoins));
    const result = this.simulation.result(this.walletCoins);
    const progression = profileStore.recordRun(result);
    result.highScore = progression.profile.highScore;
    result.newAchievements = progression.unlocked;
    this.tweens.killAll();
    this.effects.clear();
    this.clearBossPresentation();
    this.hazards.clear(true, true);
    this.projectiles.clear(true, true);
    this.coins.clear(true, true);
    this.player.setVisible(false).setActive(false).setVelocity(0);
    this.player.body!.enable = false;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.physics.world.timeScale = 1;
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
