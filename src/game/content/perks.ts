export interface PerkDefinition {
  id: string;
  name: string;
  kicker: string;
  description: string;
  accent: string;
}

export const PERKS: Record<string, PerkDefinition> = {
  coffee: {
    id: 'coffee',
    name: 'Coffee Rush',
    kicker: 'Move faster',
    description: '+14% movement speed. Caffeine is a valid workflow.',
    accent: '#ff9f43',
  },
  reply: {
    id: 'reply',
    name: 'Reply-All Blast',
    kicker: 'Send faster',
    description: '+18% firing rate and stronger paperclip projectiles.',
    accent: '#27d9ff',
  },
  shield: {
    id: 'shield',
    name: 'KPI Shield',
    kicker: 'Take less damage',
    description: '-18% incoming damage. The spreadsheet absorbs the blame.',
    accent: '#3f7dff',
  },
  escape: {
    id: 'escape',
    name: 'Meeting Escape',
    kicker: 'Dash sooner',
    description: '-22% dash cooldown and a longer invulnerable dash window.',
    accent: '#b46cff',
  },
  printer: {
    id: 'printer',
    name: 'Printer Rage',
    kicker: 'Clear more chaos',
    description: '+1 projectile penetration and +20% score from hazards.',
    accent: '#ff4d8d',
  },
  snack: {
    id: 'snack',
    name: 'Emergency Snack',
    kicker: 'Recover energy',
    description: 'Restore 24 energy immediately and raise maximum energy by 8.',
    accent: '#9ce65c',
  },
};

export function choosePerks(count = 3, random = Math.random): PerkDefinition[] {
  const pool = Object.values(PERKS);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
