export type CorporateEventId = 'reply-storm' | 'wellness-hour' | 'calendar-purge' | 'performance-review' | 'printer-rebellion';

export interface CorporateEventDefinition {
  id: CorporateEventId;
  title: string;
  subtitle: string;
  description: string;
  duration: number;
  accent: string;
  spawnMultiplier: number;
  moveMultiplier: number;
  attackMultiplier: number;
  damageMultiplier: number;
  energyDelta?: number;
  focusHazard?: 'email' | 'meeting' | 'kpi';
}

export const CORPORATE_EVENTS: CorporateEventDefinition[] = [
  {
    id: 'reply-storm', title: 'REPLY-ALL STORM', subtitle: 'Inbox visibility initiative',
    description: 'Emails multiply, but paperclips leave the outbox 35% faster.', duration: 14, accent: '#27d9ff',
    spawnMultiplier: 0.72, moveMultiplier: 1.04, attackMultiplier: 1.35, damageMultiplier: 1, focusHazard: 'email',
  },
  {
    id: 'wellness-hour', title: 'MANDATORY WELLNESS', subtitle: 'Participation will be monitored',
    description: 'Recover 18 energy and move faster while pretending to relax.', duration: 13, accent: '#9ce65c',
    spawnMultiplier: 1.08, moveMultiplier: 1.16, attackMultiplier: 1, damageMultiplier: 0.9, energyDelta: 18,
  },
  {
    id: 'calendar-purge', title: 'CALENDAR PURGE', subtitle: 'A rare operational miracle',
    description: 'Meetings slow down and incoming pressure briefly drops.', duration: 15, accent: '#b46cff',
    spawnMultiplier: 1.4, moveMultiplier: 1, attackMultiplier: 1, damageMultiplier: 0.88, focusHazard: 'meeting',
  },
  {
    id: 'performance-review', title: 'SURPRISE REVIEW', subtitle: 'Your self-rating was considered adorable',
    description: 'Everything moves faster, but every clear is worth more performance.', duration: 12, accent: '#ff4d8d',
    spawnMultiplier: 0.78, moveMultiplier: 1.08, attackMultiplier: 1.12, damageMultiplier: 1.15,
  },
  {
    id: 'printer-rebellion', title: 'PRINTER REBELLION', subtitle: 'Paper is now a stakeholder',
    description: 'KPI forms surge while Chaos builds more quickly.', duration: 14, accent: '#ff9f43',
    spawnMultiplier: 0.76, moveMultiplier: 1, attackMultiplier: 1.1, damageMultiplier: 1, focusHazard: 'kpi',
  },
];
