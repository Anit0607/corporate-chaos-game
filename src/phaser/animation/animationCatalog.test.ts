import { describe, expect, it } from 'vitest';
import {
  CHARACTER_ANIMATION_SPECS,
  characterAnimationKey,
  characterAnimationSheetKey,
  characterAnimationSpec,
} from './animationCatalog';

describe('M5 character animation catalog', () => {
  it('defines every required presentation state once', () => {
    expect(CHARACTER_ANIMATION_SPECS.map(({ state }) => state)).toEqual(['idle', 'move', 'attack', 'dash', 'hurt']);
    expect(new Set(CHARACTER_ANIMATION_SPECS.map(({ state }) => state)).size).toBe(5);
  });

  it('keeps locomotion looping and action timing readable', () => {
    expect(characterAnimationSpec('idle')).toMatchObject({ frameCount: 4, repeat: -1 });
    expect(characterAnimationSpec('move')).toMatchObject({ frameCount: 6, frameRate: 13, repeat: -1 });
    expect(characterAnimationSpec('attack')).toMatchObject({ frameCount: 3, frameRate: 20, repeat: 0 });
    expect(characterAnimationSpec('dash')).toMatchObject({ frameCount: 3, repeat: -1 });
    expect(characterAnimationSpec('hurt')).toMatchObject({ frameCount: 2, repeat: 1 });
  });

  it('uses stable character-scoped keys for animations and packed sheets', () => {
    expect(characterAnimationKey('player-red', 'attack')).toBe('player-red-attack');
    expect(characterAnimationSheetKey('player-blue', 'move')).toBe('player-blue-move-sheet');
  });
});
