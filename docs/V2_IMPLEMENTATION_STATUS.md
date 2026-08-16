# Corporate Chaos V2 implementation status

This file maps the repository to `Corporate_Chaos_V2_Development_Blueprint.docx`. The `v0.1.0-baseline` Git tag preserves the verified Phase 1 state before V2 changes. The complete Milestone 3 decision package is consolidated in `docs/M3_BALANCE_REPORT.md`.

## Current review checkpoint

The Milestone 3 evidence package and Milestone 4 Regional Director Boss Polish gate were approved for progression. M4 is formally closed at `83afb97df4b70a0e3c52e1319881f07bb47b45f8`. Milestone 5 Animation / Game Feel was approved and is formally closed at `8627873cd155368a9b92249bf28c440720ee88f0`.

Milestone 6 Mobile Validation / Device Readiness has completed its mobile-specific implementation and automated evidence package in `docs/milestone6/MILESTONE_6_MOBILE_READINESS_REPORT.md`. Touch, compact layouts, safe areas, orientation, background pause/input clearing, audio lifecycle state, both characters, the full boss lifecycle, victory/defeat/replay, desktop regression and an accelerated soak pass in Android-emulated Chromium. Physical Android Chrome/device evidence is still pending because no device or ADB runtime was available. The project is stopped at Review Gate 6 with 11/12 criteria passed and M7 locked.

## Implemented versus requested

| Blueprint area | V2 implementation | Status |
| --- | --- | --- |
| Safe architecture refactor | Data moved into character, hazard and corporate-event registries. Player control, office arena and effects have focused Phaser adapters. Simulation remains Phaser-independent. | Implemented |
| Character identity | Firestarter is fast/aggressive with better firing, dash and Chaos momentum. Cool Head has more energy, lower damage, larger collection range and a rechargeable full-damage boundary. UI explains both builds. | Implemented |
| Living corporate world | Labeled open plan, break room, HR safe space and executive lift; expanded original procedural character/hazard visuals and environmental storytelling. | Implemented foundation |
| Hazard depth | Email chains, expanding meetings, zigzag KPI forms, accelerating managers, orbiting HR, persistent client calls, timed deadlines and freezing performance reviews. | Implemented |
| Corporate events | Five seeded run events with visible banners and temporary rule modifiers. | Implemented |
| Boss/final climax | Regional Director enters through a dedicated sequence and identity aura, then moves through four color-coded named phases with pre-attack warnings, safe spawn resolution, phase cues, a dedicated HUD and a defeat sequence. Victory still requires boss defeat and reaching 5 PM. | Milestone 4 complete |
| Game feel | Packed idle/move/attack/dash/hurt animation for both recruits; launch trails, impact shards, hit/hazard/boss shockwaves, transition scans, layered synthesized cues, restrained shake and reduced-motion support. | Milestone 5 complete |
| Replayability | Seeded variation, character builds, perks, persistent high score, run/win history and five achievement badges. | Implemented foundation |
| Mobile | Pointer-owned multi-touch movement, touch dash, safe-area/dynamic-viewport compact HUD, portrait rotation gate, background input clearing and audio suspension/resume. Five landscape sizes plus 390 × 844 portrait pass Android-emulated Chromium validation. | M6 automated readiness complete; physical Android pending |
| Analytics | Privacy-conscious local-first events for run, character, perk, event, Chaos, hazard, boss, completion/failure and replay. | Implemented |
| Testing | Thirty-five deterministic tests across 6 files, full desktop Chromium lifecycle regression, and a dedicated Android-emulation harness covering five landscape viewports, portrait gating, multi-touch, lifecycle/audio state, 324.10 simulated seconds, both recruits and the boss/results lifecycle. | M6 automated PASS; physical Android pending |

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
- Structured M3 evidence shows both characters, all hazards, all perks, all events and all boss phases viable across 42 accepted sessions. See `docs/M3_BALANCE_REPORT.md`; human telemetry and physical-device sessions are still required before a public 1.0 balance lock.

## Remaining gaps and prioritized next sprint

Development is stopped at Review Gate 6. None of the following work is authorized until the physical Android evidence is reviewed and ChatGPT explicitly approves progression:

1. Any Milestone 7 feature, content or deployment work.
2. Physical validation on current Android Chrome, including touch, audible output, OS backgrounding, real FPS/thermal behavior, both recruits and the complete boss/results lifecycle.
3. Managed Chromium provisioning for browser smoke tests in CI.
4. Vercel GitHub integration for preview and production deployments.
5. Optional challenge modifiers or cosmetic unlock selection after retention data is available.

## Verification commands

```bash
pnpm typecheck
pnpm test
pnpm build
# With the Vite dev server running on port 4173:
pnpm test:browser
pnpm test:mobile
```
