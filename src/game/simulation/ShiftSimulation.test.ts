import { describe, expect, it } from 'vitest';
import { ShiftSimulation } from './ShiftSimulation';

describe('ShiftSimulation', () => {
  it('maps a completed shift from 9 AM to 5 PM', () => {
    const simulation = new ShiftSimulation(60);
    expect(simulation.clockLabel()).toBe('9:00 AM');
    for (let i = 0; i < 600; i += 1) simulation.tick(0.1);
    expect(simulation.clockLabel()).toBe('5:00 PM');
    expect(simulation.finished).toBe(true);
    expect(simulation.won).toBe(true);
  });

  it('activates chaos mode after enough hazards are cleared', () => {
    const simulation = new ShiftSimulation(60);
    let activated = false;
    for (let i = 0; i < 13; i += 1) activated ||= simulation.recordHazardCleared(100, 1);
    expect(activated).toBe(true);
    expect(simulation.chaosSeconds).toBe(10);
    expect(simulation.scoreMultiplier).toBeGreaterThanOrEqual(2);
  });

  it('applies defensive perks and can end in defeat', () => {
    const simulation = new ShiftSimulation(60);
    simulation.applyPerk('shield');
    expect(simulation.takeDamage(20)).toBeLessThan(20);
    simulation.takeDamage(200);
    expect(simulation.tick(0.016)).toBe('defeat');
  });

  it('offers a mid-shift upgrade and applies restorative perks', () => {
    const simulation = new ShiftSimulation(90);
    for (let i = 0; i < 451; i += 1) simulation.tick(0.1);

    expect(simulation.shouldOfferUpgrade).toBe(true);
    simulation.markUpgradeOffered();
    simulation.takeDamage(40);
    simulation.applyPerk('snack');

    expect(simulation.shouldOfferUpgrade).toBe(false);
    expect(simulation.perkLevel('snack')).toBe(1);
    expect(simulation.energy).toBe(84);
    expect(simulation.maxEnergy).toBe(108);
  });
});
