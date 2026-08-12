import { describe, expect, it } from 'vitest';
import type { RunResult } from '../events';
import { PROFILE_KEY, PROFILE_SCHEMA_VERSION, ProfileStore, type ProfileStorage } from './ProfileStore';

class MemoryStorage implements ProfileStorage {
  readonly values = new Map<string, string>();
  writes = 0;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes += 1;
    this.values.set(key, value);
  }
}

const runResult = (overrides: Partial<RunResult> = {}): RunResult => ({
  won: false,
  score: 0,
  runCoins: 0,
  walletCoins: 0,
  survivedSeconds: 30,
  rank: 'MEETING SURVIVOR',
  hazardsCleared: 0,
  perksChosen: [],
  character: 'red-recruit',
  bossDefeated: false,
  seed: 1,
  highScore: 0,
  newAchievements: [],
  ...overrides,
});

describe('ProfileStore', () => {
  it('recovers safely from malformed and invalid profile fields', () => {
    const storage = new MemoryStorage();
    storage.values.set(PROFILE_KEY, '{not-json');
    expect(new ProfileStore(storage).load()).toMatchObject({ version: PROFILE_SCHEMA_VERSION, runs: 0, achievements: [] });

    storage.values.set(PROFILE_KEY, JSON.stringify({
      runs: -4,
      wins: 'many',
      highScore: 1200.8,
      totalCoins: null,
      characterWins: { 'red-recruit': 2.9, 'blue-recruit': -1 },
      achievements: ['clocked_in', 'clocked_in', 'unknown_badge', 42],
    }));
    const migrated = new ProfileStore(storage).load();
    expect(migrated).toEqual({
      version: PROFILE_SCHEMA_VERSION,
      runs: 0,
      wins: 0,
      highScore: 1200,
      totalCoins: 0,
      bossWins: 0,
      characterWins: { 'red-recruit': 2, 'blue-recruit': 0 },
      achievements: ['clocked_in'],
    });
  });

  it('does not overwrite data written by a future schema version', () => {
    const storage = new MemoryStorage();
    const futureProfile = JSON.stringify({ version: PROFILE_SCHEMA_VERSION + 10, runs: 88, futureField: true });
    storage.values.set(PROFILE_KEY, futureProfile);
    const result = new ProfileStore(storage).recordRun(runResult());
    expect(result.profile.runs).toBe(1);
    expect(storage.values.get(PROFILE_KEY)).toBe(futureProfile);
    expect(storage.writes).toBe(0);
  });

  it('unlocks achievements once and prevents duplicates across runs', () => {
    const storage = new MemoryStorage();
    const store = new ProfileStore(storage);
    const first = store.recordRun(runResult({
      won: true,
      bossDefeated: true,
      hazardsCleared: 35,
      score: 12000,
      rank: 'OFFICE LEGEND',
      runCoins: 18,
      character: 'red-recruit',
    }));
    expect(first.unlocked).toEqual(['clocked_in', 'regional_disruption', 'chaos_consultant', 'office_legend']);

    const duplicate = store.recordRun(runResult({
      won: true,
      bossDefeated: true,
      hazardsCleared: 35,
      score: 12000,
      rank: 'OFFICE LEGEND',
      character: 'red-recruit',
    }));
    expect(duplicate.unlocked).toEqual([]);
    expect(new Set(duplicate.profile.achievements).size).toBe(duplicate.profile.achievements.length);

    const secondCharacter = store.recordRun(runResult({ won: true, character: 'blue-recruit' }));
    expect(secondCharacter.unlocked).toEqual(['dual_department']);
    expect(secondCharacter.profile.characterWins).toEqual({ 'red-recruit': 2, 'blue-recruit': 1 });
  });

  it('continues gameplay when storage is unavailable', () => {
    const store = new ProfileStore(null);
    const result = store.recordRun(runResult({ score: 900, runCoins: 4 }));
    expect(result.profile).toMatchObject({ version: PROFILE_SCHEMA_VERSION, runs: 1, highScore: 900, totalCoins: 4 });
    expect(result.unlocked).toEqual(['clocked_in']);
  });

  it('unlocks Office Legend from the authoritative rank instead of a stale score threshold', () => {
    const store = new ProfileStore(new MemoryStorage());
    expect(store.recordRun(runResult({ score: 400_000, rank: 'PROMISING RECRUIT' })).unlocked).toEqual(['clocked_in']);
    expect(store.recordRun(runResult({ score: 320_000, rank: 'OFFICE LEGEND' })).unlocked).toEqual(['office_legend']);
  });
});
