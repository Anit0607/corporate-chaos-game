export type CharacterAnimationState = 'idle' | 'move' | 'attack' | 'dash' | 'hurt';

export interface CharacterAnimationSpec {
  state: CharacterAnimationState;
  frameCount: number;
  frameRate: number;
  repeat: number;
}

export const CHARACTER_ANIMATION_SPECS: readonly CharacterAnimationSpec[] = [
  { state: 'idle', frameCount: 4, frameRate: 6, repeat: -1 },
  { state: 'move', frameCount: 6, frameRate: 13, repeat: -1 },
  { state: 'attack', frameCount: 3, frameRate: 20, repeat: 0 },
  { state: 'dash', frameCount: 3, frameRate: 18, repeat: -1 },
  { state: 'hurt', frameCount: 2, frameRate: 16, repeat: 1 },
] as const;

export const characterAnimationKey = (texture: string, state: CharacterAnimationState): string => `${texture}-${state}`;

export const characterAnimationSheetKey = (texture: string, state: CharacterAnimationState): string => `${texture}-${state}-sheet`;

export const characterAnimationSpec = (state: CharacterAnimationState): CharacterAnimationSpec => {
  const spec = CHARACTER_ANIMATION_SPECS.find((candidate) => candidate.state === state);
  if (!spec) throw new Error(`Missing character animation specification for ${state}.`);
  return spec;
};
