import { describe, expect, it } from 'vitest';
import { CORPORATE_EVENTS } from '../content/corporateEvents';
import { ShiftSimulation } from './ShiftSimulation';

describe('ShiftSimulation Milestone 1 contracts', () => {
  it('starts the standard Final Escalation before 5 PM and ends the shift at 5 PM', () => {
    const simulation = new ShiftSimulation(360);
    expect(simulation.bossLeadSeconds).toBe(36);
    expect(simulation.bossStartAt).toBe(324);
    expect(simulation.bossStartClockLabel()).toBe('4:12 PM');
    simulation.elapsed = simulation.bossStartAt - 0.01;
    expect(simulation.shouldStartBoss).toBe(false);
    simulation.elapsed = simulation.bossStartAt;
    expect(simulation.shouldStartBoss).toBe(true);
    simulation.elapsed = simulation.duration;
    expect(simulation.clockLabel()).toBe('5:00 PM');
  });

  it('uses the simulation RNG for reproducible sequential perk drafts', () => {
    const first = new ShiftSimulation({ durationSeconds: 180, seed: 77123 });
    const second = new ShiftSimulation({ durationSeconds: 180, seed: 77123 });
    const firstDrafts = [first.choosePerkIds(), first.choosePerkIds()];
    const secondDrafts = [second.choosePerkIds(), second.choosePerkIds()];
    expect(firstDrafts).toEqual(secondDrafts);
    firstDrafts.forEach((draft) => expect(new Set(draft).size).toBe(3));
  });

  it.each(CORPORATE_EVENTS)('applies and expires every $id modifier', (eventDefinition) => {
    const simulation = new ShiftSimulation({ durationSeconds: 180, character: 'red-recruit', seed: 42 });
    simulation.elapsed = 30;
    simulation.energy = 50;
    const ratio = simulation.elapsed / simulation.duration;
    const baseSpawnEveryMs = Math.max(340, 1120 - ratio * 700);
    const baseHazardSpeed = 72 + ratio * 82;

    const event = simulation.triggerCorporateEvent(eventDefinition.id);
    expect(event).toBe(eventDefinition);
    expect(simulation.activeAttackMultiplier).toBe(eventDefinition.attackMultiplier);
    expect(simulation.difficulty.spawnEveryMs).toBeCloseTo(baseSpawnEveryMs * eventDefinition.spawnMultiplier);
    expect(simulation.difficulty.hazardSpeed).toBeCloseTo(baseHazardSpeed * eventDefinition.moveMultiplier);
    expect(simulation.energy).toBe(Math.min(simulation.maxEnergy, 50 + (eventDefinition.energyDelta ?? 0)));
    expect(simulation.takeDamage(10)).toBe(Math.max(1, Math.round(10 * 1.06 * eventDefinition.damageMultiplier)));

    for (let tick = 0; tick <= eventDefinition.duration * 10; tick += 1) simulation.tick(0.1);
    expect(simulation.activeEvent).toBeNull();
    expect(simulation.activeAttackMultiplier).toBe(1);
  });

  it('applies the event-specific score and Chaos modifiers', () => {
    const review = new ShiftSimulation({ durationSeconds: 180, seed: 1 });
    review.elapsed = 30;
    review.triggerCorporateEvent('performance-review');
    review.recordHazardCleared(100, 0);
    expect(review.score).toBe(135);

    const printer = new ShiftSimulation({ durationSeconds: 180, seed: 1 });
    printer.elapsed = 30;
    printer.triggerCorporateEvent('printer-rebellion');
    printer.recordHazardCleared(100, 1);
    expect(printer.chaos).toBe(13.5);
  });

  it('moves through all four boss phases at the documented health thresholds', () => {
    const simulation = new ShiftSimulation(360);
    expect(simulation.bossMaxHealth).toBe(40);
    simulation.startBoss();

    expect(simulation.damageBoss(9)).toMatchObject({ phase: 1, phaseChanged: false, defeated: false });
    expect(simulation.damageBoss(1)).toMatchObject({ phase: 2, phaseChanged: true, defeated: false });
    expect(simulation.damageBoss(10)).toMatchObject({ phase: 3, phaseChanged: true, defeated: false });
    expect(simulation.damageBoss(10)).toMatchObject({ phase: 4, phaseChanged: true, defeated: false });
    expect(simulation.damageBoss(10)).toMatchObject({ phase: 4, phaseChanged: false, defeated: true });
  });

  it('requires both boss defeat and 5 PM for victory, while zero energy causes defeat', () => {
    const earlyBossDefeat = new ShiftSimulation(30);
    earlyBossDefeat.startBoss();
    earlyBossDefeat.damageBoss(earlyBossDefeat.bossMaxHealth);
    expect(earlyBossDefeat.tick(0.1)).toBe('running');
    earlyBossDefeat.elapsed = earlyBossDefeat.duration;
    expect(earlyBossDefeat.tick(0.1)).toBe('victory');

    const bossStillActive = new ShiftSimulation(30);
    bossStillActive.elapsed = bossStillActive.duration;
    expect(bossStillActive.tick(0.1)).toBe('running');

    const depleted = new ShiftSimulation(30);
    depleted.energy = 0;
    expect(depleted.tick(0.1)).toBe('defeat');
  });

  it('preserves distinct character abilities in authoritative simulation rules', () => {
    const firestarter = new ShiftSimulation({ durationSeconds: 90, character: 'red-recruit' });
    const coolHead = new ShiftSimulation({ durationSeconds: 90, character: 'blue-recruit' });
    expect(firestarter.maxEnergy).toBe(92);
    expect(coolHead.maxEnergy).toBe(118);
    expect(firestarter.takeDamage(10)).toBe(11);
    expect(coolHead.takeDamage(10)).toBe(0);
    expect(coolHead.takeDamage(10)).toBe(8);
    expect(firestarter.recordDashClear()).toBe(false);
    expect(firestarter.score).toBe(45);
    expect(firestarter.chaos).toBe(7);
    expect(coolHead.recordDashClear()).toBe(false);
    expect(coolHead.score).toBe(0);
  });
});
