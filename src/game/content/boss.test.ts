import { describe, expect, it } from 'vitest';
import { BOSS_PHASES, bossPhaseDefinition } from './boss';
import { ShiftSimulation } from '../simulation/ShiftSimulation';

describe('Regional Director presentation contracts', () => {
  it('defines four visually and verbally distinct phase identities', () => {
    const phases = Object.values(BOSS_PHASES);
    expect(phases.map((phase) => phase.phase)).toEqual([1, 2, 3, 4]);
    expect(new Set(phases.map((phase) => phase.name)).size).toBe(4);
    expect(new Set(phases.map((phase) => phase.directive)).size).toBe(4);
    expect(new Set(phases.map((phase) => phase.accent)).size).toBe(4);
    phases.forEach((phase) => {
      expect(phase.warning.length).toBeGreaterThan(5);
      expect(phase.scale).toBeGreaterThan(0.8);
    });
  });

  it('publishes the authoritative phase identity through the HUD snapshot', () => {
    const simulation = new ShiftSimulation(360);
    simulation.startBoss();
    simulation.damageBoss(11);
    const phase = bossPhaseDefinition(simulation.bossPhase);
    const hud = simulation.toHud(0, true);
    expect(hud.bossPhase).toBe(2);
    expect(hud.bossPhaseName).toBe(phase.name);
    expect(hud.bossDirective).toBe(phase.directive);
    expect(hud.bossAccent).toBe(phase.accent);
  });
});
