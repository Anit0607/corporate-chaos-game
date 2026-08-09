import { describe, expect, it } from 'vitest';
import { CHARACTERS } from './characters';
import { CORPORATE_EVENTS } from './corporateEvents';
import { availableHazards } from './hazards';
import { SeededRandom } from '../random';

describe('V2 data-driven content', () => {
  it('gives each recruit a distinct balanced playstyle and ability', () => {
    const red = CHARACTERS['red-recruit'];
    const blue = CHARACTERS['blue-recruit'];
    expect(red.ability.id).not.toBe(blue.ability.id);
    expect(red.stats.moveSpeed).toBeGreaterThan(blue.stats.moveSpeed);
    expect(blue.stats.maxEnergy).toBeGreaterThan(red.stats.maxEnergy);
    expect(blue.stats.incomingDamage).toBeLessThan(red.stats.incomingDamage);
  });

  it('unlocks a wider hazard roster as the shift escalates', () => {
    expect(availableHazards(0).map((hazard) => hazard.id)).toEqual(['email']);
    expect(availableHazards(0.5).length).toBeGreaterThanOrEqual(6);
    expect(availableHazards(1).length).toBe(8);
  });

  it('keeps seeded choices reproducible', () => {
    const first = new SeededRandom('daily-brief');
    const second = new SeededRandom('daily-brief');
    expect(Array.from({ length: 8 }, () => first.next())).toEqual(Array.from({ length: 8 }, () => second.next()));
  });

  it('defines corporate events with unique IDs and positive durations', () => {
    expect(new Set(CORPORATE_EVENTS.map((event) => event.id)).size).toBe(CORPORATE_EVENTS.length);
    expect(CORPORATE_EVENTS.every((event) => event.duration > 0)).toBe(true);
  });
});
