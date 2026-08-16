import Phaser from 'phaser';
import { gameBus } from '../../game/events';
import {
  CHARACTER_ANIMATION_SPECS,
  characterAnimationKey,
  characterAnimationSheetKey,
  type CharacterAnimationState,
} from '../animation/animationCatalog';

const PLAYER_FRAME_WIDTH = 58;
const PLAYER_FRAME_HEIGHT = 68;

interface PlayerPose {
  bob: number;
  stride: number;
  armSwing: number;
  lean: number;
  reach: number;
  squash: number;
  hurt: boolean;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.createPlayerAnimationSet('player-red', 0xf33d53);
    this.createPlayerAnimationSet('player-blue', 0x3f7dff);
    this.createEmailTexture();
    this.createMeetingTexture();
    this.createKpiTexture();
    this.createManagerTexture();
    this.createHrTexture();
    this.createClientTexture();
    this.createDeadlineTexture();
    this.createReviewTexture();
    this.createDirectorTexture();
    this.createProjectileTexture();
    this.createCoinTexture();
    this.createOfficeTextures();
    gameBus.emit('game:ready', undefined);
    this.scene.start('ShiftScene');
  }

  private graphics(): Phaser.GameObjects.Graphics {
    return this.make.graphics({ x: 0, y: 0 });
  }

  private createPlayerAnimationSet(key: string, suitColor: number): void {
    const g = this.graphics();
    this.drawPlayerFrame(g, 0, suitColor, this.playerPose('idle', 0, 4));
    g.generateTexture(key, PLAYER_FRAME_WIDTH, PLAYER_FRAME_HEIGHT);
    g.destroy();

    CHARACTER_ANIMATION_SPECS.forEach((spec) => {
      const sheetKey = characterAnimationSheetKey(key, spec.state);
      const sheet = this.graphics();
      for (let index = 0; index < spec.frameCount; index += 1) {
        this.drawPlayerFrame(sheet, index * PLAYER_FRAME_WIDTH, suitColor, this.playerPose(spec.state, index, spec.frameCount));
      }
      sheet.generateTexture(sheetKey, PLAYER_FRAME_WIDTH * spec.frameCount, PLAYER_FRAME_HEIGHT);
      sheet.destroy();
      const texture = this.textures.get(sheetKey);
      for (let index = 0; index < spec.frameCount; index += 1) {
        texture.add(String(index), 0, index * PLAYER_FRAME_WIDTH, 0, PLAYER_FRAME_WIDTH, PLAYER_FRAME_HEIGHT);
      }
      const animationKey = characterAnimationKey(key, spec.state);
      if (!this.anims.exists(animationKey)) {
        this.anims.create({
          key: animationKey,
          frames: Array.from({ length: spec.frameCount }, (_, index) => ({ key: sheetKey, frame: String(index) })),
          frameRate: spec.frameRate,
          repeat: spec.repeat,
        });
      }
    });
  }

  private playerPose(state: CharacterAnimationState, index: number, frameCount: number): PlayerPose {
    const phase = (index / frameCount) * Math.PI * 2;
    if (state === 'idle') {
      return { bob: index === 1 ? -1 : 0, stride: 0, armSwing: 0, lean: 0, reach: 0, squash: index === 1 ? 0.025 : 0, hurt: false };
    }
    if (state === 'move') {
      return {
        bob: Math.cos(phase * 2) > 0.2 ? -2 : 0,
        stride: Math.round(Math.sin(phase) * 4),
        armSwing: Math.round(Math.sin(phase) * 3),
        lean: 1,
        reach: 0,
        squash: Math.cos(phase * 2) * 0.025,
        hurt: false,
      };
    }
    if (state === 'attack') {
      const reach = [0, 4, 2][index] ?? 0;
      return { bob: index === 1 ? 1 : 0, stride: index === 1 ? -2 : 0, armSwing: 0, lean: index === 1 ? 2 : 0, reach, squash: index === 1 ? -0.05 : 0, hurt: false };
    }
    if (state === 'dash') {
      return { bob: index === 1 ? -1 : 0, stride: index === 1 ? 5 : 3, armSwing: -4, lean: 4, reach: 2, squash: -0.08, hurt: false };
    }
    return { bob: index === 0 ? 1 : -1, stride: -2, armSwing: 2, lean: index === 0 ? -4 : 3, reach: 0, squash: 0.09, hurt: true };
  }

  private drawPlayerFrame(g: Phaser.GameObjects.Graphics, offsetX: number, suitColor: number, pose: PlayerPose): void {
    const x = (value: number): number => offsetX + value + pose.lean;
    const bodyTop = 25 + pose.bob;
    const bodyHeight = 31 * (1 - pose.squash);
    g.fillStyle(0x020916, 0.3).fillEllipse(offsetX + 28, 62, 40 + Math.abs(pose.stride), 10);
    g.fillStyle(0x10162a)
      .fillRoundedRect(x(17 + pose.stride), 44 + pose.bob, 10, 20 - pose.bob, 4)
      .fillRoundedRect(x(31 - pose.stride), 44 + pose.bob, 10, 20 - pose.bob, 4);
    g.lineStyle(4, 0x061126)
      .fillStyle(suitColor)
      .fillRoundedRect(x(7 - pose.armSwing), bodyTop + 5, 10, 24, 5)
      .strokeRoundedRect(x(7 - pose.armSwing), bodyTop + 5, 10, 24, 5)
      .fillRoundedRect(x(41 + pose.armSwing), bodyTop + 5, 10 + pose.reach, 24, 5)
      .strokeRoundedRect(x(41 + pose.armSwing), bodyTop + 5, 10 + pose.reach, 24, 5)
      .fillRoundedRect(x(11), bodyTop, 36, bodyHeight, 8)
      .strokeRoundedRect(x(11), bodyTop, 36, bodyHeight, 8);
    if (pose.reach > 0) g.fillStyle(0xf0b486).fillCircle(x(49 + pose.reach), bodyTop + 17, 4);
    g.fillStyle(0xfff4dc).fillTriangle(x(18), bodyTop + 3, x(40), bodyTop + 3, x(29), bodyTop + 18);
    g.fillStyle(0x061126).fillTriangle(x(26), bodyTop + 6, x(32), bodyTop + 6, x(29), bodyTop + 20);
    g.lineStyle(4, 0x061126).fillStyle(0xf0b486).fillCircle(x(29), 17 + pose.bob, 15).strokeCircle(x(29), 17 + pose.bob, 15);
    g.fillStyle(0x151728)
      .fillEllipse(x(28), 8 + pose.bob, 30, 15)
      .fillTriangle(x(12), 10 + pose.bob, x(20), 1 + pose.bob, x(23), 13 + pose.bob)
      .fillTriangle(x(33), 7 + pose.bob, x(44), 2 + pose.bob, x(39), 16 + pose.bob);
    if (pose.hurt) {
      g.lineStyle(2, 0x061126)
        .lineBetween(x(21), 17 + pose.bob, x(26), 20 + pose.bob)
        .lineBetween(x(32), 20 + pose.bob, x(37), 17 + pose.bob);
    } else {
      g.fillStyle(0xffffff).fillCircle(x(24), 18 + pose.bob, 3).fillCircle(x(34), 18 + pose.bob, 3);
      g.fillStyle(0x061126).fillCircle(x(24), 18 + pose.bob, 1.5).fillCircle(x(34), 18 + pose.bob, 1.5);
    }
    g.fillStyle(0x061126).fillRoundedRect(x(24), 23 + pose.bob, 10, 2, 1);
  }

  private createEmailTexture(): void {
    const g = this.graphics();
    g.fillStyle(0x061126, 0.28).fillEllipse(25, 30, 40, 8);
    g.lineStyle(4, 0x061126).fillStyle(0xfff4dc).fillRoundedRect(3, 4, 44, 26, 5).strokeRoundedRect(3, 4, 44, 26, 5);
    g.lineStyle(3, 0xf33d53).beginPath().moveTo(6, 7).lineTo(25, 20).lineTo(44, 7).strokePath();
    g.fillStyle(0xf33d53).fillCircle(43, 5, 6);
    g.generateTexture('hazard-email', 52, 38);
    g.destroy();
  }

  private createMeetingTexture(): void {
    const g = this.graphics();
    g.fillStyle(0x061126, 0.25).fillEllipse(28, 53, 44, 8);
    g.lineStyle(4, 0x061126).fillStyle(0xb46cff).fillRoundedRect(4, 6, 48, 44, 8).strokeRoundedRect(4, 6, 48, 44, 8);
    g.fillStyle(0xfff4dc).fillRoundedRect(10, 17, 36, 25, 4);
    g.fillStyle(0x061126).fillCircle(20, 28, 5).fillCircle(36, 28, 5).fillRoundedRect(17, 34, 22, 4, 2);
    g.fillStyle(0xff9f43).fillRect(12, 3, 7, 12).fillRect(37, 3, 7, 12);
    g.generateTexture('hazard-meeting', 58, 58);
    g.destroy();
  }

  private createKpiTexture(): void {
    const g = this.graphics();
    g.fillStyle(0x061126, 0.25).fillEllipse(25, 54, 38, 7);
    g.lineStyle(4, 0x061126).fillStyle(0xffffff).fillRoundedRect(4, 3, 42, 49, 5).strokeRoundedRect(4, 3, 42, 49, 5);
    g.fillStyle(0xf33d53).fillRect(11, 12, 27, 5).fillRect(11, 33, 7, 10);
    g.fillStyle(0xff9f43).fillRect(21, 27, 7, 16);
    g.fillStyle(0x27d9ff).fillRect(31, 21, 7, 22);
    g.generateTexture('hazard-kpi', 52, 60);
    g.destroy();
  }

  private createManagerTexture(): void {
    const g = this.graphics();
    g.fillStyle(0x061126, 0.28).fillEllipse(32, 76, 48, 9);
    g.lineStyle(5, 0x061126).fillStyle(0x172b4d).fillRoundedRect(8, 31, 48, 41, 9).strokeRoundedRect(8, 31, 48, 41, 9);
    g.fillStyle(0xfff4dc).fillTriangle(17, 34, 48, 34, 32, 53);
    g.fillStyle(0xf33d53).fillTriangle(28, 38, 36, 38, 32, 59);
    g.lineStyle(5, 0x061126).fillStyle(0xd9966a).fillCircle(32, 18, 18).strokeCircle(32, 18, 18);
    g.fillStyle(0x10162a).fillRect(14, 6, 36, 13).fillTriangle(14, 18, 18, 3, 25, 18);
    g.lineStyle(3, 0x061126).beginPath().moveTo(20, 17).lineTo(27, 15).moveTo(37, 15).lineTo(44, 17).strokePath();
    g.fillStyle(0x061126).fillCircle(24, 21, 2).fillCircle(40, 21, 2).fillRoundedRect(26, 27, 13, 3, 1);
    g.generateTexture('hazard-manager', 66, 82);
    g.destroy();
  }

  private createHrTexture(): void {
    const g = this.graphics();
    g.fillStyle(0x061126, 0.25).fillEllipse(28, 61, 42, 8);
    g.lineStyle(4, 0x061126).fillStyle(0x9ce65c).fillRoundedRect(7, 21, 42, 38, 8).strokeRoundedRect(7, 21, 42, 38, 8);
    g.fillStyle(0xfff4dc).fillCircle(28, 15, 13);
    g.fillStyle(0x172b4d).fillEllipse(28, 8, 26, 12);
    g.fillStyle(0xffffff).fillRoundedRect(16, 29, 25, 22, 3);
    g.fillStyle(0xf33d53).fillRect(21, 34, 15, 3).fillRect(21, 40, 12, 3);
    g.generateTexture('hazard-hr', 56, 66);
    g.destroy();
  }

  private createClientTexture(): void {
    const g = this.graphics();
    g.fillStyle(0x061126, 0.24).fillEllipse(29, 57, 42, 8);
    g.lineStyle(5, 0x061126).fillStyle(0xff9f43).fillRoundedRect(8, 5, 42, 50, 10).strokeRoundedRect(8, 5, 42, 50, 10);
    g.fillStyle(0x172b4d).fillRoundedRect(14, 12, 30, 31, 5);
    g.fillStyle(0x9ce65c).fillCircle(29, 49, 4);
    g.lineStyle(4, 0xfff4dc).beginPath().moveTo(20, 20).lineTo(24, 17).lineTo(36, 30).lineTo(33, 34).strokePath();
    g.generateTexture('hazard-client', 58, 64);
    g.destroy();
  }

  private createDeadlineTexture(): void {
    const g = this.graphics();
    g.fillStyle(0x061126, 0.25).fillEllipse(30, 61, 45, 8);
    g.lineStyle(5, 0x061126).fillStyle(0xff4d8d).fillCircle(30, 31, 25).strokeCircle(30, 31, 25);
    g.fillStyle(0xfff4dc).fillCircle(30, 31, 17);
    g.lineStyle(4, 0x061126).beginPath().moveTo(30, 31).lineTo(30, 19).moveTo(30, 31).lineTo(41, 36).strokePath();
    g.fillStyle(0x061126).fillRoundedRect(23, 1, 14, 7, 3);
    g.generateTexture('hazard-deadline', 62, 66);
    g.destroy();
  }

  private createReviewTexture(): void {
    const g = this.graphics();
    g.fillStyle(0x061126, 0.25).fillEllipse(28, 61, 42, 8);
    g.lineStyle(4, 0x061126).fillStyle(0xffffff).fillRoundedRect(6, 3, 44, 56, 6).strokeRoundedRect(6, 3, 44, 56, 6);
    g.fillStyle(0x5ce1e6).fillRect(13, 11, 30, 7);
    g.fillStyle(0xffbd45).fillTriangle(28, 23, 32, 32, 42, 33).fillTriangle(42, 33, 34, 39, 36, 50).fillTriangle(36, 50, 28, 44, 20, 50).fillTriangle(20, 50, 22, 39, 14, 33).fillTriangle(14, 33, 24, 32, 28, 23);
    g.generateTexture('hazard-review', 56, 66);
    g.destroy();
  }

  private createDirectorTexture(): void {
    const g = this.graphics();
    g.fillStyle(0x061126, 0.35).fillEllipse(55, 105, 88, 15);
    g.lineStyle(7, 0x061126).fillStyle(0x151d36).fillRoundedRect(12, 42, 86, 60, 14).strokeRoundedRect(12, 42, 86, 60, 14);
    g.fillStyle(0xfff4dc).fillTriangle(28, 46, 82, 46, 55, 75);
    g.fillStyle(0xf33d53).fillTriangle(47, 51, 63, 51, 55, 87);
    g.lineStyle(7, 0x061126).fillStyle(0xc9825e).fillCircle(55, 27, 28).strokeCircle(55, 27, 28);
    g.fillStyle(0x10162a).fillRect(27, 5, 56, 18).fillTriangle(28, 20, 34, 1, 47, 22);
    g.fillStyle(0xffffff).fillRoundedRect(28, 23, 22, 11, 4).fillRoundedRect(60, 23, 22, 11, 4);
    g.lineStyle(4, 0x061126).strokeRoundedRect(28, 23, 22, 11, 4).strokeRoundedRect(60, 23, 22, 11, 4).lineBetween(50, 28, 60, 28);
    g.fillStyle(0x061126).fillRoundedRect(43, 37, 24, 4, 2);
    g.generateTexture('hazard-director', 112, 114);
    g.destroy();
  }

  private createProjectileTexture(): void {
    const g = this.graphics();
    g.lineStyle(4, 0x27d9ff).strokeRoundedRect(2, 2, 17, 8, 4);
    g.lineStyle(2, 0xffffff).strokeRoundedRect(6, 4, 10, 4, 2);
    g.generateTexture('paperclip', 22, 13);
    g.destroy();
  }

  private createCoinTexture(): void {
    const g = this.graphics();
    g.lineStyle(3, 0x9c5b1a).fillStyle(0xffbd45).fillCircle(12, 12, 10).strokeCircle(12, 12, 10);
    g.lineStyle(2, 0xfff4b8).strokeCircle(12, 12, 6);
    g.fillStyle(0x9c5b1a).fillRect(10, 7, 4, 10);
    g.generateTexture('chaos-coin', 24, 24);
    g.destroy();
  }

  private createOfficeTextures(): void {
    const g = this.graphics();
    g.lineStyle(4, 0x061126).fillStyle(0x274b70).fillRoundedRect(2, 2, 156, 58, 8).strokeRoundedRect(2, 2, 156, 58, 8);
    g.fillStyle(0xc79b70).fillRoundedRect(8, 8, 144, 42, 5);
    g.fillStyle(0x0c274d).fillRect(22, 13, 44, 26).fillRect(91, 13, 44, 26);
    g.fillStyle(0x27d9ff, 0.35).fillRect(26, 17, 36, 18).fillRect(95, 17, 36, 18);
    g.generateTexture('desk', 160, 62);
    g.clear();
    g.lineStyle(4, 0x061126).fillStyle(0x183e61).fillRoundedRect(2, 2, 116, 48, 12).strokeRoundedRect(2, 2, 116, 48, 12);
    g.fillStyle(0x3f7dff, 0.35).fillRoundedRect(10, 9, 100, 28, 8);
    g.generateTexture('sofa', 120, 52);
    g.clear();
    g.fillStyle(0x061126, 0.25).fillEllipse(25, 48, 42, 8);
    g.fillStyle(0xb66b49).fillRoundedRect(12, 30, 26, 18, 5);
    g.fillStyle(0x3aa96d).fillEllipse(13, 22, 16, 30).fillEllipse(26, 16, 17, 35).fillEllipse(39, 23, 16, 30);
    g.generateTexture('plant', 50, 52);
    g.clear();
    g.lineStyle(4, 0x061126).fillStyle(0xe4e8ef).fillRoundedRect(2, 8, 58, 45, 7).strokeRoundedRect(2, 8, 58, 45, 7);
    g.fillStyle(0x172b4d).fillRoundedRect(10, 15, 42, 16, 3);
    g.fillStyle(0xffffff).fillRect(14, 1, 34, 20);
    g.generateTexture('printer', 64, 56);
    g.destroy();
  }
}
