export type HazardId = 'email' | 'meeting' | 'kpi' | 'manager' | 'hr' | 'client' | 'deadline' | 'review';

export type HazardBehavior = 'homing' | 'area' | 'zigzag' | 'accelerate' | 'orbit' | 'persistent' | 'timed' | 'freeze';

export interface HazardDefinition {
  id: HazardId;
  name: string;
  texture: string;
  behavior: HazardBehavior;
  health: number;
  speed: number;
  damage: number;
  score: number;
  coins: number;
  scale: number;
  color: number;
  unlockAt: number;
  weight: number;
  telegraph: string;
}

export const HAZARDS: Record<HazardId, HazardDefinition> = {
  email: { id: 'email', name: 'Urgent Email', texture: 'hazard-email', behavior: 'homing', health: 1, speed: 1.18, damage: 8, score: 120, coins: 1, scale: 0.88, color: 0xfff4dc, unlockAt: 0, weight: 34, telegraph: 'INBOX SPIKE' },
  meeting: { id: 'meeting', name: 'Meeting Invite', texture: 'hazard-meeting', behavior: 'area', health: 3, speed: 0.7, damage: 15, score: 280, coins: 2, scale: 0.9, color: 0xb46cff, unlockAt: 0.1, weight: 19, telegraph: 'CALENDAR BLOCK' },
  kpi: { id: 'kpi', name: 'KPI Form', texture: 'hazard-kpi', behavior: 'zigzag', health: 2, speed: 1.3, damage: 12, score: 220, coins: 2, scale: 0.82, color: 0x27d9ff, unlockAt: 0.22, weight: 17, telegraph: 'METRIC DRIFT' },
  manager: { id: 'manager', name: 'Micromanager', texture: 'hazard-manager', behavior: 'accelerate', health: 7, speed: 0.63, damage: 22, score: 680, coins: 4, scale: 0.88, color: 0xf33d53, unlockAt: 0.48, weight: 8, telegraph: 'QUICK SYNC' },
  hr: { id: 'hr', name: 'HR Intervention', texture: 'hazard-hr', behavior: 'orbit', health: 5, speed: 0.78, damage: 14, score: 460, coins: 3, scale: 0.86, color: 0x9ce65c, unlockAt: 0.34, weight: 8, telegraph: 'POLICY UPDATE' },
  client: { id: 'client', name: 'Client Call', texture: 'hazard-client', behavior: 'persistent', health: 4, speed: 0.93, damage: 13, score: 390, coins: 3, scale: 0.88, color: 0xff9f43, unlockAt: 0.4, weight: 7, telegraph: 'INCOMING CALL' },
  deadline: { id: 'deadline', name: 'Impossible Deadline', texture: 'hazard-deadline', behavior: 'timed', health: 5, speed: 0, damage: 26, score: 540, coins: 4, scale: 0.9, color: 0xff4d8d, unlockAt: 0.55, weight: 4, telegraph: 'DEADLINE ARMED' },
  review: { id: 'review', name: 'Performance Review', texture: 'hazard-review', behavior: 'freeze', health: 6, speed: 0.72, damage: 16, score: 620, coins: 4, scale: 0.9, color: 0x5ce1e6, unlockAt: 0.66, weight: 3, telegraph: 'RATING PENDING' },
};

export function availableHazards(ratio: number): HazardDefinition[] {
  return Object.values(HAZARDS).filter((hazard) => ratio >= hazard.unlockAt);
}
