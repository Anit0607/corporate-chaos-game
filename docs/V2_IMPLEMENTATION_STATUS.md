# Corporate Chaos V2 implementation status

This file maps the repository to `Corporate_Chaos_V2_Development_Blueprint.docx`. The `v0.1.0-baseline` Git tag preserves the verified Phase 1 state before V2 changes.

## Implemented versus requested

| Blueprint area | V2 implementation | Status |
| --- | --- | --- |
| Safe architecture refactor | Data moved into character, hazard and corporate-event registries. Player control, office arena and effects have focused Phaser adapters. Simulation remains Phaser-independent. | Implemented |
| Character identity | Firestarter is fast/aggressive with better firing, dash and Chaos momentum. Cool Head has more energy, lower damage, larger collection range and a rechargeable full-damage boundary. UI explains both builds. | Implemented |
| Living corporate world | Labeled open plan, break room, HR safe space and executive lift; expanded original procedural character/hazard visuals and environmental storytelling. | Implemented foundation |
| Hazard depth | Email chains, expanding meetings, zigzag KPI forms, accelerating managers, orbiting HR, persistent client calls, timed deadlines and freezing performance reviews. | Implemented |
| Corporate events | Five seeded run events with visible banners and temporary rule modifiers. | Implemented |
| Boss/final climax | Regional Director enters during the pre-5-PM Final Escalation with four named phases: summons, area denial, tracking calls and a final PIP burst. Victory requires boss defeat and reaching 5 PM. | Implemented |
| Game feel | Spawn telegraphs, boss phase feedback, damage flashes, particles, restrained shake, floating boss damage, dedicated event/boss/shield audio and reduced-motion support. | Implemented |
| Replayability | Seeded variation, character builds, perks, persistent high score, run/win history and five achievement badges. | Implemented foundation |
| Mobile | Landscape touch direction pad, touch dash, responsive/safe-area HUD and automatic targeting retained. | Implemented; physical-device tuning remains |
| Analytics | Privacy-conscious local-first events for run, character, perk, event, Chaos, hazard, boss, completion/failure and replay. | Implemented |
| Testing | Twenty-eight deterministic simulation, content and profile-store tests plus a Chrome/Edge lifecycle run covering both recruits, keyboard movement, dash, combat, Escape/focus-loss pause, perks, pause-aware event timing, all boss phases, victory, replay, defeat, cleanup, console errors and 900x600 touch layout. | Implemented locally; managed browser CI remains |

## Architecture after refactor

```text
src/
├── game/
│   ├── analytics/
│   ├── content/
│   │   ├── characters.ts
│   │   ├── corporateEvents.ts
│   │   ├── hazards.ts
│   │   └── perks.ts
│   ├── progression/ProfileStore.ts
│   ├── random.ts
│   └── simulation/ShiftSimulation.ts
├── phaser/
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   └── ShiftScene.ts
│   └── systems/
│       ├── EffectsManager.ts
│       ├── OfficeArena.ts
│       └── PlayerController.ts
└── ui/GameUI.ts
```

`ShiftSimulation` owns authoritative energy, score, Chaos, perk modifiers, event timing, character defense, boss health/phases and victory. Phaser systems translate that state into input, sprites and effects. DOM UI consumes typed snapshots and emits intent through the event bus. A query-gated E2E bridge exposes read-focused scene snapshots and deterministic completion controls only to the browser verification suite.

## Balance observations

- Firestarter trades 26 maximum energy and slightly higher incoming damage for faster movement, firing and dash cadence.
- Cool Head is deliberately safer for first-time players; its boundary recharge is visible in the HUD.
- Boss health scales with the available boss window so short QA runs remain completable.
- Event and hazard selection use a supplied seed, making reported balance problems reproducible.
- Final numbers still need player telemetry and repeated physical-device sessions before a public 1.0 balance lock.

## Remaining gaps and prioritized next sprint

1. Replace/extend procedural actors with normalized multi-frame authored sprite animation while preserving collision anchors.
2. Run structured balance sessions across at least 30 complete shifts and tune boss health, hazard weights and perk pick rates.
3. Test landscape touch controls on low/mid-range Android hardware and tune button size, safe areas and particle budgets.
4. Provision a managed Chromium executable in CI and run the existing `test:browser` smoke suite on pull requests.
5. Connect the Vercel GitHub app so pushes automatically create preview and production deployments.
6. Consider optional challenge modifiers and cosmetic unlock selection after core retention data is available.

## Verification commands

```bash
pnpm typecheck
pnpm test
pnpm build
# With the Vite dev server running on port 4173:
pnpm test:browser
```
