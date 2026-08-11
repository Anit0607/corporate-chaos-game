import Phaser from 'phaser';
import { analytics } from './game/analytics/analytics';
import { BootScene } from './phaser/scenes/BootScene';
import { ShiftScene } from './phaser/scenes/ShiftScene';
import { GameUI } from './ui/GameUI';
import './styles.css';

declare global {
  interface Window {
    __CORPORATE_CHAOS_E2E__?: {
      snapshot: () => ReturnType<ShiftScene['integrationSnapshot']>;
      damageBoss: (amount: number) => void;
      defeatPlayer: () => void;
      restorePlayer: () => void;
      clockOut: () => void;
    };
  }
}

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Application root not found');

new GameUI(root);
void analytics.init().then(() => analytics.capture('landing_view'));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-canvas',
  width: 1280,
  height: 720,
  backgroundColor: '#09162b',
  pixelArt: false,
  antialias: true,
  roundPixels: false,
  render: {
    powerPreference: 'high-performance',
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: new URLSearchParams(window.location.search).has('debug'),
    },
  },
  scene: [BootScene, ShiftScene],
});

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('e2e')) {
  const shiftScene = () => game.scene.getScene('ShiftScene') as ShiftScene;
  window.__CORPORATE_CHAOS_E2E__ = Object.freeze({
    snapshot: () => shiftScene().integrationSnapshot(),
    damageBoss: (amount: number) => shiftScene().integrationDamageBoss(amount),
    defeatPlayer: () => shiftScene().integrationDefeatPlayer(),
    restorePlayer: () => shiftScene().integrationRestorePlayer(),
    clockOut: () => shiftScene().integrationClockOut(),
  });
}
