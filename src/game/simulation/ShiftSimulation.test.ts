import { describe, expect, it } from 'vitest';
import { ShiftSimulation } from './ShiftSimulation';

describe('ShiftSimulation', () => {
  it('maps a completed shift from 9 AM to 5 PM', () => {
    const simulation = new ShiftSimulation(60);
    simulation.startBoss();
    simulation.damageBoss(simulation.bossMaxHealth);
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
    expect(simulation.energy).toBe(74);
    expect(simulation.maxEnergy).toBe(100);
  });

  it('gives the Cool Head a rechargeable damage boundary', () => {
    const simulation = new ShiftSimulation({ durationSeconds: 90, character: 'blue-recruit' });
    expect(simulation.takeDamage(40)).toBe(0);
    expect(simulation.energy).toBe(118);
    expect(simulation.takeDamage(40)).toBe(34);
    for (let i = 0; i < 321; i += 1) simulation.tick(0.1);
    expect(simulation.boundaryCharges).toBe(1);
  });

  it('runs deterministic corporate events from the supplied seed', () => {
    const first = new ShiftSimulation({ durationSeconds: 180, seed: 12345 });
    const second = new ShiftSimulation({ durationSeconds: 180, seed: 12345 });
    for (let i = 0; i < 380; i += 1) {
      first.tick(0.1);
      second.tick(0.1);
    }
    expect(first.shouldTriggerCorporateEvent).toBe(true);
    expect(first.triggerCorporateEvent().id).toBe(second.triggerCorporateEvent().id);
  });

  it('requires the final boss to be defeated before victory', () => {
    const simulation = new ShiftSimulation(30);
    for (let i = 0; i < 300; i += 1) simulation.tick(0.1);
    expect(simulation.finished).toBe(false);
    expect(simulation.shouldStartBoss).toBe(true);
    simulation.startBoss();
    const firstHit = simulation.damageBoss(Math.ceil(simulation.bossMaxHealth * 0.55));
    expect(firstHit.phase).toBe(3);
    expect(firstHit.phaseChanged).toBe(true);
    simulation.damageBoss(simulation.bossMaxHealth);
    expect(simulation.tick(0.016)).toBe('victory');
  });
});
