type EventProperties = Record<string, string | number | boolean | null>;

interface QueuedEvent {
  name: string;
  properties: EventProperties;
  timestamp: string;
}

const STORAGE_KEY = 'corporate-chaos-analytics-v1';

class AnalyticsClient {
  private initialized = false;
  private posthog: typeof import('posthog-js').default | null = null;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const key = import.meta.env.VITE_POSTHOG_KEY?.trim();
    if (!key) return;

    const module = await import('posthog-js');
    this.posthog = module.default;
    this.posthog.init(key, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'never',
      persistence: 'localStorage',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      respect_dnt: true,
    });
  }

  capture(name: string, properties: EventProperties = {}): void {
    const event: QueuedEvent = {
      name,
      properties,
      timestamp: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as QueuedEvent[];
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing.slice(-199), event]));
    } catch {
      // Local storage may be blocked. Gameplay must never depend on analytics.
    }

    this.posthog?.capture(name, properties);
  }
}

export const analytics = new AnalyticsClient();
