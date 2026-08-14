import type { CharacterId } from './content/characters';
import type { CorporateEventDefinition } from './content/corporateEvents';
import type { PlayerProfile } from './progression/ProfileStore';

export type { CharacterId } from './content/characters';

export interface HudSnapshot {
  character: CharacterId;
  perks: string[];
  clock: string;
  elapsed: number;
  duration: number;
  energy: number;
  maxEnergy: number;
  score: number;
  runCoins: number;
  walletCoins: number;
  chaos: number;
  chaosActive: boolean;
  chaosSeconds: number;
  dashReady: boolean;
  multiplier: number;
  waveLabel: string;
  abilityName: string;
  abilityReady: boolean;
  activeEvent: string | null;
  bossActive: boolean;
  bossHealth: number;
  bossMaxHealth: number;
  bossPhase: number;
  bossPhaseName: string;
  bossDirective: string;
  bossAccent: string;
  seed: number;
}

export interface BossPresentation {
  kind: 'entrance' | 'phase' | 'attack' | 'defeat';
  phase: number;
  kicker: string;
  title: string;
  detail: string;
  accent: string;
  duration: number;
}

export interface RunResult {
  won: boolean;
  score: number;
  runCoins: number;
  walletCoins: number;
  survivedSeconds: number;
  rank: string;
  hazardsCleared: number;
  perksChosen: string[];
  character: CharacterId;
  bossDefeated: boolean;
  seed: number;
  highScore: number;
  newAchievements: string[];
}

export type GameEventMap = {
  'ui:start': undefined;
  'ui:character': CharacterId;
  'ui:briefing-complete': undefined;
  'ui:pause-toggle': undefined;
  'ui:resume': undefined;
  'ui:restart': undefined;
  'ui:menu': undefined;
  'ui:perk-selected': string;
  'ui:mute': boolean;
  'ui:move': { x: number; y: number };
  'ui:dash': undefined;
  'game:character-select': undefined;
  'game:briefing': CharacterId;
  'game:hud': HudSnapshot;
  'game:perk-offer': string[];
  'game:corporate-event': CorporateEventDefinition;
  'game:boss-presentation': BossPresentation;
  'game:profile': PlayerProfile;
  'game:pause': boolean;
  'game:result': RunResult;
  'game:toast': string;
  'game:ready': undefined;
  'game:menu': undefined;
  'game:run-started': undefined;
};

class TypedGameBus {
  private readonly target = new EventTarget();
  private readonly listenerCounts = new Map<keyof GameEventMap, number>();

  emit<K extends keyof GameEventMap>(type: K, detail: GameEventMap[K]): void {
    this.target.dispatchEvent(new CustomEvent(type, { detail }));
  }

  on<K extends keyof GameEventMap>(
    type: K,
    listener: (detail: GameEventMap[K]) => void,
  ): () => void {
    const wrapped = (event: Event) => listener((event as CustomEvent<GameEventMap[K]>).detail);
    this.target.addEventListener(type, wrapped);
    this.listenerCounts.set(type, (this.listenerCounts.get(type) ?? 0) + 1);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.target.removeEventListener(type, wrapped);
      this.listenerCounts.set(type, Math.max(0, (this.listenerCounts.get(type) ?? 1) - 1));
    };
  }

  listenerCount(type?: keyof GameEventMap): number {
    if (type) return this.listenerCounts.get(type) ?? 0;
    return [...this.listenerCounts.values()].reduce((total, count) => total + count, 0);
  }
}

export const gameBus = new TypedGameBus();
