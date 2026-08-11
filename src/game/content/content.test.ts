import { describe, expect, it } from 'vitest';
import { CHARACTERS } from './characters';
import { CORPORATE_EVENTS } from './corporateEvents';
import { availableHazards, HAZARDS } from './hazards';
import { choosePerks } from './perks';
import { SeededRandom } from '../random';

describe('V2 data-driven content', () => {
  it('gives each recruit a distinct balanced playstyle and ability', () => {
    const red = CHARACTERS['red-recruit'];
    const blue = CHARACTERS['blue-recruit'];
    expect(red.ability.id).not.toBe(blue.ability.id);
    expect(red.stats.moveSpeed).toBeGreaterThan(blue.stats.moveSpeed);
    expect(blue.stats.maxEnergy).toBeGreaterThan(red.stats.maxEnergy);
    expect(blue.stats.incomingDamage).toBeLessThan(red.stats.incomingDamage);
    expect(red.stats.fireRate).toBeGreaterThan(blue.stats.fireRate);
    expect(red.stats.dashCooldown).toBeLessThan(blue.stats.dashCooldown);
    expect(blue.stats.pickupRadius).toBeGreaterThan(red.stats.pickupRadius);
  });

  it('defines eight unique hazards with exact inclusive unlock thresholds', () => {
    const hazards = Object.values(HAZARDS);
    expect(hazards).toHaveLength(8);
    expect(new Set(hazards.map((hazard) => hazard.id)).size).toBe(8);
    expect(new Set(hazards.map((hazard) => hazard.behavior)).size).toBe(8);

    hazards.forEach((hazard) => {
      expect(availableHazards(hazard.unlockAt).map((candidate) => candidate.id)).toContain(hazard.id);
      if (hazard.unlockAt > 0) {
        expect(availableHazards(hazard.unlockAt - 0.0001).map((candidate) => candidate.id)).not.toContain(hazard.id);
      }
      expect(hazard.health).toBeGreaterThan(0);
      expect(hazard.damage).toBeGreaterThan(0);
      expect(hazard.telegraph.length).toBeGreaterThan(0);
    });
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

  it('keeps seeded perk drafts unique and reproducible', () => {
    const first = new SeededRandom(8842);
    const second = new SeededRandom(8842);
    const firstDraft = choosePerks(3, () => first.next()).map((perk) => perk.id);
    const secondDraft = choosePerks(3, () => second.next()).map((perk) => perk.id);
    expect(firstDraft).toEqual(secondDraft);
    expect(new Set(firstDraft).size).toBe(3);
  });
});
