import type { CharacterId } from '../content/characters';
import type { RunResult } from '../events';

export interface PlayerProfile {
  runs: number;
  wins: number;
  highScore: number;
  totalCoins: number;
  bossWins: number;
  characterWins: Record<CharacterId, number>;
  achievements: string[];
}

const PROFILE_KEY = 'corporate-chaos-profile-v2';

const EMPTY_PROFILE: PlayerProfile = {
  runs: 0,
  wins: 0,
  highScore: 0,
  totalCoins: 0,
  bossWins: 0,
  characterWins: { 'red-recruit': 0, 'blue-recruit': 0 },
  achievements: [],
};

export const ACHIEVEMENTS: Record<string, { name: string; description: string }> = {
  clocked_in: { name: 'CLOCKED IN', description: 'Complete your first run.' },
  regional_disruption: { name: 'REGIONAL DISRUPTION', description: 'Defeat the Regional Director.' },
  chaos_consultant: { name: 'CHAOS CONSULTANT', description: 'Clear at least 35 hazards in one shift.' },
  office_legend: { name: 'OFFICE LEGEND', description: 'Score 11,000 or more.' },
  dual_department: { name: 'DUAL DEPARTMENT', description: 'Win with both recruits.' },
};

export class ProfileStore {
  load(): PlayerProfile {
    try {
      const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}') as Partial<PlayerProfile>;
      return {
        ...EMPTY_PROFILE,
        ...stored,
        characterWins: { ...EMPTY_PROFILE.characterWins, ...stored.characterWins },
        achievements: Array.isArray(stored.achievements) ? stored.achievements : [],
      };
    } catch {
      return structuredClone(EMPTY_PROFILE);
    }
  }

  recordRun(result: RunResult): { profile: PlayerProfile; unlocked: string[] } {
    const profile = this.load();
    profile.runs += 1;
    profile.wins += Number(result.won);
    profile.highScore = Math.max(profile.highScore, result.score);
    profile.totalCoins += result.runCoins;
    if (result.bossDefeated) profile.bossWins += 1;
    if (result.won) profile.characterWins[result.character] += 1;

    const candidates = [
      'clocked_in',
      ...(result.bossDefeated ? ['regional_disruption'] : []),
      ...(result.hazardsCleared >= 35 ? ['chaos_consultant'] : []),
      ...(result.score >= 11000 ? ['office_legend'] : []),
      ...(profile.characterWins['red-recruit'] > 0 && profile.characterWins['blue-recruit'] > 0 ? ['dual_department'] : []),
    ];
    const unlocked = candidates.filter((id) => !profile.achievements.includes(id));
    profile.achievements.push(...unlocked);
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // Progression is a convenience layer; blocked storage must not stop gameplay.
    }
    return { profile, unlocked };
  }
}

export const profileStore = new ProfileStore();
