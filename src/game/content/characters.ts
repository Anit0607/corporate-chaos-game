export type CharacterId = 'red-recruit' | 'blue-recruit';

export interface CharacterDefinition {
  id: CharacterId;
  texture: string;
  employeeNumber: string;
  name: string;
  role: string;
  personality: string;
  description: string;
  accent: string;
  stats: {
    maxEnergy: number;
    moveSpeed: number;
    fireRate: number;
    projectileDamage: number;
    dashCooldown: number;
    incomingDamage: number;
    pickupRadius: number;
  };
  ability: {
    id: 'momentum' | 'boundary';
    name: string;
    description: string;
  };
  quips: string[];
}

export const CHARACTERS: Record<CharacterId, CharacterDefinition> = {
  'red-recruit': {
    id: 'red-recruit',
    texture: 'player-red',
    employeeNumber: 'EMPLOYEE 001',
    name: 'THE FIRESTARTER',
    role: 'Fast / aggressive',
    personality: 'Reckless optimism',
    description: 'Turns panic into forward momentum. Faster attacks and dramatically shorter dashes reward risky movement.',
    accent: '#f33d53',
    stats: {
      maxEnergy: 92,
      moveSpeed: 1.09,
      fireRate: 1.12,
      projectileDamage: 1,
      dashCooldown: 0.76,
      incomingDamage: 1.06,
      pickupRadius: 1,
    },
    ability: {
      id: 'momentum',
      name: 'Deadline Momentum',
      description: 'Dashing through a threat adds extra Chaos and extends the dash slightly.',
    },
    quips: [
      'If it is urgent, it can chase me.',
      'I have converted anxiety into velocity.',
      'Reply-all was a strategic decision.',
    ],
  },
  'blue-recruit': {
    id: 'blue-recruit',
    texture: 'player-blue',
    employeeNumber: 'EMPLOYEE 002',
    name: 'THE COOL HEAD',
    role: 'Tactical / defensive',
    personality: 'Strategic sarcasm',
    description: 'Survives through boundaries, energy control and wider pickup reach. Less explosive, much harder to overwhelm.',
    accent: '#3f7dff',
    stats: {
      maxEnergy: 118,
      moveSpeed: 0.96,
      fireRate: 0.96,
      projectileDamage: 0,
      dashCooldown: 1,
      incomingDamage: 0.84,
      pickupRadius: 1.28,
    },
    ability: {
      id: 'boundary',
      name: 'Professional Boundary',
      description: 'Completely blocks one incoming hit, recharging every 32 seconds.',
    },
    quips: [
      'That sounds like a next-quarter problem.',
      'I have reviewed the request and chosen peace.',
      'Per my last dodge, no.',
    ],
  },
};

export function characterById(id: CharacterId): CharacterDefinition {
  return CHARACTERS[id];
}
