export type BossPhase = 1 | 2 | 3 | 4;

export interface BossPhaseDefinition {
  phase: BossPhase;
  name: string;
  directive: string;
  warning: string;
  accent: string;
  color: number;
  scale: number;
}

export const BOSS_PHASES: Record<BossPhase, BossPhaseDefinition> = {
  1: { phase: 1, name: 'DELEGATION', directive: 'ACTION ITEMS', warning: 'INBOX CASCADE', accent: '#ff4d8d', color: 0xff4d8d, scale: 0.94 },
  2: { phase: 2, name: 'CALENDAR CONTROL', directive: 'MEETING LOCK', warning: 'CALENDAR BLOCK', accent: '#b46cff', color: 0xb46cff, scale: 0.98 },
  3: { phase: 3, name: 'CLIENT ESCALATION', directive: 'TRACKING CALLS', warning: 'CLIENT PILE-ON', accent: '#ff9f43', color: 0xff9f43, scale: 1.02 },
  4: { phase: 4, name: 'PERFORMANCE PLAN', directive: 'FINAL PIP', warning: 'PIP DROP ZONE', accent: '#5ce1e6', color: 0x5ce1e6, scale: 1.08 },
};

export const bossPhaseDefinition = (phase: number): BossPhaseDefinition => (
  BOSS_PHASES[Math.min(4, Math.max(1, phase)) as BossPhase]
);
