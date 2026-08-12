import type { CharacterId } from '../content/characters';
import type { RunResult } from '../events';

export const PROFILE_SCHEMA_VERSION = 1;
export const PROFILE_KEY = 'corporate-chaos-profile-v2';

export interface PlayerProfile {
  version: number;
  runs: number;
  wins: number;
  highScore: number;
  totalCoins: number;
  bossWins: number;
  characterWins: Record<CharacterId, number>;
  achievements: string[];
}

export interface ProfileStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const ACHIEVEMENTS: Record<string, { name: string; description: string }> = {
  clocked_in: { name: 'CLOCKED IN', description: 'Complete your first run.' },
  regional_disruption: { name: 'REGIONAL DISRUPTION', description: 'Defeat the Regional Director.' },
  chaos_consultant: { name: 'CHAOS CONSULTANT', description: 'Clear at least 35 hazards in one shift.' },
  office_legend: { name: 'OFFICE LEGEND', description: 'Earn an Office Legend rank or better.' },
  dual_department: { name: 'DUAL DEPARTMENT', description: 'Win with both recruits.' },
};

const createEmptyProfile = (): PlayerProfile => ({
  version: PROFILE_SCHEMA_VERSION,
  runs: 0,
  wins: 0,
  highScore: 0,
  totalCoins: 0,
  bossWins: 0,
  characterWins: { 'red-recruit': 0, 'blue-recruit': 0 },
  achievements: [],
});

const safeCount = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
);

const defaultStorage = (): ProfileStorage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

interface ProfileReadResult {
  profile: PlayerProfile;
  writable: boolean;
}

export class ProfileStore {
  constructor(private readonly storage: ProfileStorage | null = defaultStorage()) {}

  load(): PlayerProfile {
    return this.read().profile;
  }

  recordRun(result: RunResult): { profile: PlayerProfile; unlocked: string[] } {
    const { profile, writable } = this.read();
    profile.runs += 1;
    profile.wins += Number(result.won);
    profile.highScore = Math.max(profile.highScore, safeCount(result.score));
    profile.totalCoins += safeCount(result.runCoins);
    if (result.bossDefeated) profile.bossWins += 1;
    if (result.won) profile.characterWins[result.character] += 1;

    const candidates = [
      'clocked_in',
      ...(result.bossDefeated ? ['regional_disruption'] : []),
      ...(result.hazardsCleared >= 35 ? ['chaos_consultant'] : []),
      ...(['OFFICE LEGEND', 'CHAOS EXECUTIVE'].includes(result.rank) ? ['office_legend'] : []),
      ...(profile.characterWins['red-recruit'] > 0 && profile.characterWins['blue-recruit'] > 0 ? ['dual_department'] : []),
    ];
    const unlocked = candidates.filter((id) => !profile.achievements.includes(id));
    profile.achievements.push(...unlocked);
    if (writable) this.save(profile);
    return { profile, unlocked };
  }

  private read(): ProfileReadResult {
    if (!this.storage) return { profile: createEmptyProfile(), writable: false };
    try {
      const raw = this.storage.getItem(PROFILE_KEY);
      if (!raw) return { profile: createEmptyProfile(), writable: true };
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { profile: createEmptyProfile(), writable: true };
      }
      const stored = parsed as Record<string, unknown>;
      const storedVersion = safeCount(stored.version);
      if (storedVersion > PROFILE_SCHEMA_VERSION) {
        // Never overwrite a profile written by a newer game build.
        return { profile: createEmptyProfile(), writable: false };
      }

      const wins = stored.characterWins && typeof stored.characterWins === 'object' && !Array.isArray(stored.characterWins)
        ? stored.characterWins as Record<string, unknown>
        : {};
      const achievements = Array.isArray(stored.achievements)
        ? [...new Set(stored.achievements.filter((id): id is string => typeof id === 'string' && id in ACHIEVEMENTS))]
        : [];

      return {
        writable: true,
        profile: {
          version: PROFILE_SCHEMA_VERSION,
          runs: safeCount(stored.runs),
          wins: safeCount(stored.wins),
          highScore: safeCount(stored.highScore),
          totalCoins: safeCount(stored.totalCoins),
          bossWins: safeCount(stored.bossWins),
          characterWins: {
            'red-recruit': safeCount(wins['red-recruit']),
            'blue-recruit': safeCount(wins['blue-recruit']),
          },
          achievements,
        },
      };
    } catch {
      return { profile: createEmptyProfile(), writable: true };
    }
  }

  private save(profile: PlayerProfile): void {
    try {
      this.storage?.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // Progression is a convenience layer; blocked storage must not stop gameplay.
    }
  }
}

export const profileStore = new ProfileStore();
