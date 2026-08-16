import Phaser from 'phaser';
import type { CharacterDefinition } from '../../game/content/characters';
import type { ShiftSimulation } from '../../game/simulation/ShiftSimulation';
import { characterAnimationKey, type CharacterAnimationState } from '../animation/animationCatalog';

export interface PlayerUpdateResult {
  dashStarted: boolean;
  moving: boolean;
}

export class PlayerController {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly keys: Record<'up' | 'down' | 'left' | 'right' | 'dash', Phaser.Input.Keyboard.Key>;
  private touchX = 0;
  private touchY = 0;
  private pendingDash = false;
  private dashUntil = 0;
  private readyAt = 0;
  private invulnerableUntil = 0;
  private frozenUntil = 0;
  private frozenVisual = false;
  private currentTime = 0;
  private attackUntil = 0;
  private hurtUntil = 0;
  private characterTexture = 'player-red';
  private currentVisualState: CharacterAnimationState = 'idle';
  readonly facing = new Phaser.Math.Vector2(1, 0);

  constructor(
    private readonly scene: Phaser.Scene,
    readonly sprite: Phaser.Physics.Arcade.Sprite,
  ) {
    this.cursors = this.scene.input.keyboard!.createCursorKeys();
    this.keys = {
      up: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      dash: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };
  }

  reset(time: number, characterTexture: string): void {
    this.currentTime = time;
    this.characterTexture = characterTexture;
    this.touchX = 0;
    this.touchY = 0;
    this.pendingDash = false;
    this.dashUntil = 0;
    this.readyAt = time + 800;
    this.invulnerableUntil = 0;
    this.frozenUntil = 0;
    this.frozenVisual = false;
    this.attackUntil = 0;
    this.hurtUntil = 0;
    this.currentVisualState = 'idle';
    this.facing.set(1, 0);
    this.sprite.anims.stop();
    this.sprite.setTexture(characterTexture).setFlipX(false).setRotation(0).setScale(1).setAlpha(1).clearTint();
    this.setVisualState('idle', true);
  }

  setTouchVector(x: number, y: number): void {
    this.touchX = Phaser.Math.Clamp(x, -1, 1);
    this.touchY = Phaser.Math.Clamp(y, -1, 1);
  }

  requestDash(): void {
    this.pendingDash = true;
  }

  freezeUntil(time: number): void {
    this.frozenUntil = Math.max(this.frozenUntil, time);
  }

  get isInvulnerable(): boolean {
    return this.currentTime < this.invulnerableUntil;
  }

  get isDashing(): boolean {
    return this.currentTime < this.dashUntil;
  }

  get dashReady(): boolean {
    return this.currentTime >= this.readyAt;
  }

  grantInvulnerability(milliseconds: number): void {
    this.invulnerableUntil = Math.max(this.invulnerableUntil, this.currentTime + milliseconds);
  }

  get baseTexture(): string {
    return this.characterTexture;
  }

  get visualState(): CharacterAnimationState {
    return this.currentVisualState;
  }

  get animationKey(): string {
    return characterAnimationKey(this.characterTexture, this.currentVisualState);
  }

  get touchVector(): Readonly<{ x: number; y: number }> {
    return { x: this.touchX, y: this.touchY };
  }

  playAttack(time: number): void {
    this.attackUntil = Math.max(this.attackUntil, time + 150);
    if (!this.isDashing && time >= this.hurtUntil) this.setVisualState('attack', true);
  }

  playHurt(time: number): void {
    this.hurtUntil = Math.max(this.hurtUntil, time + 260);
    this.setVisualState('hurt', true);
  }

  private setVisualState(state: CharacterAnimationState, force = false): void {
    if (!force && this.currentVisualState === state) return;
    this.currentVisualState = state;
    this.sprite.play(characterAnimationKey(this.characterTexture, state), true);
  }

  update(time: number, simulation: ShiftSimulation, character: CharacterDefinition): PlayerUpdateResult {
    this.currentTime = time;
    if (time < this.dashUntil) {
      this.sprite.setVelocity(this.facing.x * 630, this.facing.y * 630);
      this.sprite.setAlpha(0.72 + Math.sin(time * 0.06) * 0.18);
      this.sprite.setRotation(this.facing.y * 0.08).setScale(1.1, 0.92);
      this.setVisualState('dash');
      return { dashStarted: false, moving: true };
    }

    if (time < this.frozenUntil) {
      this.sprite.setVelocity(0).setTint(0x8de9ff).setScale(0.96);
      this.setVisualState('hurt');
      this.frozenVisual = true;
      return { dashStarted: false, moving: false };
    }
    if (this.frozenVisual) {
      this.sprite.clearTint();
      this.frozenVisual = false;
    }
    this.sprite.setAlpha(1);

    const keyboardX = Number(this.keys.right.isDown || this.cursors.right.isDown) - Number(this.keys.left.isDown || this.cursors.left.isDown);
    const keyboardY = Number(this.keys.down.isDown || this.cursors.down.isDown) - Number(this.keys.up.isDown || this.cursors.up.isDown);
    const movement = new Phaser.Math.Vector2(keyboardX || this.touchX, keyboardY || this.touchY);
    const moving = movement.lengthSq() > 0;
    if (moving) {
      movement.normalize();
      this.facing.copy(movement);
      const eventSpeed = simulation.activeEvent?.moveMultiplier ?? 1;
      const speed = 235 * character.stats.moveSpeed * eventSpeed * simulation.gameplayModifiers.moveSpeedMultiplier * (simulation.chaosSeconds > 0 ? 1.16 : 1);
      this.sprite.setVelocity(movement.x * speed, movement.y * speed);
      this.sprite.setFlipX(movement.x < -0.05);
      this.sprite.setRotation(movement.x * 0.035);
      this.sprite.setScale(1 + Math.sin(time * 0.022) * 0.01, 1 - Math.sin(time * 0.022) * 0.01);
    } else {
      this.sprite.setVelocity(0).setRotation(0).setScale(1);
    }

    if (time < this.hurtUntil) this.setVisualState('hurt');
    else if (time < this.attackUntil) this.setVisualState('attack');
    else this.setVisualState(moving ? 'move' : 'idle');

    const wantsDash = Phaser.Input.Keyboard.JustDown(this.keys.dash) || this.pendingDash;
    this.pendingDash = false;
    if (!wantsDash || time < this.readyAt) return { dashStarted: false, moving };

    if (!moving) movement.copy(this.facing);
    this.facing.copy(movement.normalize());
    const momentumBonus = character.ability.id === 'momentum' ? 55 : 0;
    this.dashUntil = time + 235 + simulation.gameplayModifiers.dashDurationBonusMs + momentumBonus;
    this.invulnerableUntil = this.dashUntil + 90;
    this.readyAt = time + Math.max(1250, 4200 * character.stats.dashCooldown * simulation.gameplayModifiers.dashCooldownMultiplier);
    this.setVisualState('dash', true);
    return { dashStarted: true, moving: true };
  }
}
