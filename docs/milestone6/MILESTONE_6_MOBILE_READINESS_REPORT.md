# Milestone 6 — Mobile Validation / Device Readiness Review Gate Report

## Executive summary

Milestone 6 has completed its implementation, desktop regression, Android-emulation, touch, layout, lifecycle and performance-readiness work against the approved M5 baseline `8627873cd155368a9b92249bf28c440720ee88f0`. M6 made mobile-specific corrections only: reliable multi-touch ownership and release, input clearing and audio suspension on backgrounding, idempotent mobile pause requests, safe-area/dynamic-viewport layout, a portrait rotation gate, compact briefing/HUD controls, and a dedicated mobile validation harness. No simulation, balance, character, perk, event, hazard, boss, score, clock or victory rule changed.

Eleven of twelve M6 acceptance criteria pass. The remaining criterion—validation on a physical Android device—is **PENDING**, not failed: this workstation has no Android Debug Bridge installation or connected Android device. The repository is therefore ready for the physical-device portion of Review Gate 6, but M6 must not be described as fully approved until that evidence is supplied and reviewed. M7 has not started.

## M6 scope

M6 was limited to validating and correcting mobile-specific behavior for:

- touch movement, diagonal input, release/cancel handling and dash;
- landscape phones, tablets and the 900 × 600 compact contract;
- safe-area, dynamic viewport, rotation and overflow behavior;
- pause/resume, focus loss, page hide and background input state;
- Web Audio user-gesture unlock, background suspension, resume and mute persistence;
- sustained runtime performance, entity bounds and lifecycle cleanup;
- both recruits, all boss phases, victory, defeat and replay;
- Android-like Chromium user agent, touch, device scale and viewport behavior;
- physical Android Chrome validation as a separately identified gate requirement.

New gameplay systems, new content, balance changes and M7 work were out of scope.

## Planned versus implemented

| Planned target | Implemented or validated result | Status |
| --- | --- | --- |
| Reliable touch controls | Pointer-ID ownership, simultaneous direction aggregation, pointer capture, cancel/leave/lost-capture cleanup | PASS |
| Mobile lifecycle safety | Input clears and audio suspends on blur, `pagehide` and hidden document; gameplay pauses idempotently | PASS |
| Mobile audio recovery | Resume button provides a user gesture to restart a suspended AudioContext; mute persists after reload | PASS (state validation) |
| Safe layout | `viewport-fit=cover`, safe-area offsets, `100dvh`, overscroll containment and non-scrollable game shell | PASS |
| Compact landscape | Short-screen HUD, boss UI, briefing, controls, toast and modals fit at 740 × 360 through 1024 × 600 | PASS |
| Portrait behavior | Full-screen landscape-required gate clears input and pauses an active run | PASS |
| Sustained performance | 3,242 sampled frames over 324.10 simulated seconds; 60.30 reported FPS; zero frames above 33 ms | PASS in desktop emulation |
| Full mobile lifecycle | Both recruits, four boss phases, safe warnings, victory, defeat, replay and cleanup | PASS in desktop emulation |
| Physical Android | Chrome behavior, audible output, real GPU/FPS, backgrounding and extended touch session | PENDING — no device/ADB target |

## Files changed

| Area | Files | Purpose |
| --- | --- | --- |
| Mobile viewport | `index.html`, `src/styles.css` | Cover safe areas, prevent shell scroll drift, fit compact landscapes and gate portrait play |
| Touch/lifecycle UI | `src/ui/GameUI.ts`, `src/game/events.ts` | Multi-pointer input, complete release handling, input reset and idempotent orientation/background pause |
| Audio lifecycle | `src/audio/Soundboard.ts` | Expose context state for validation and suspend when backgrounded |
| Scene lifecycle/metrics | `src/phaser/scenes/ShiftScene.ts`, `src/phaser/systems/PlayerController.ts` | Page-hide/visibility pause, touch-state evidence and frame metrics |
| E2E bridge | `src/main.ts` | Query-gated audio state evidence |
| Validation | `scripts/mobile-readiness.mjs`, `package.json` | Android-emulation device matrix, touch, lifecycle, soak, boss and results test |
| Evidence | `docs/milestone6/`, `docs/V2_IMPLEMENTATION_STATUS.md` | M6 results and honest gate status |

## Mobile-specific defects found and corrected

1. A compact browser could programmatically scroll the `overflow: hidden` game shell after briefing focus, shifting the HUD upward by 255 px at 740 × 360. The shell now uses `overflow: clip`, so it is not a scroll container.
2. The compact briefing content could place “ENTER THE OFFICE” outside a short landscape viewport. It now uses a one-column, internally scrollable short-screen treatment.
3. The mobile pause control could collide with the dash area due to responsive cascade order. Mobile/short-landscape placement is now final and safe-area aware.
4. The pause target was 42 × 38 px. It is now 44 × 44 px on touch/compact layouts.
5. Direction state was keyed only by direction, which was fragile under multi-pointer release/cancel ordering. Input is now keyed by pointer ID and re-derived after every event.
6. Backgrounding could leave held touch input or running audio active. Blur, page hide and document-hidden paths now clear touch state, pause the run and suspend audio.

## Device and viewport matrix

| Profile | CSS viewport | DPR | Direction pad | Dash | Pause | Overflow | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Android large | 915 × 412 | 2.625 | 140 × 92 | 68 × 68 | 44 × 44 | None | PASS |
| Android standard | 844 × 390 | 3 | 140 × 92 | 68 × 68 | 44 × 44 | None | PASS |
| Android small | 740 × 360 | 2 | 140 × 92 | 68 × 68 | 44 × 44 | None | PASS |
| Compact contract | 900 × 600 | 2 | 154 × 101 | 76 × 76 | 44 × 44 | None | PASS |
| Tablet landscape | 1024 × 600 | 2 | 154 × 101 | 76 × 76 | 44 × 44 | None | PASS |
| Portrait gate | 390 × 844 | 3 | Not interactive | Not interactive | Not interactive | None | PASS |

All profiles used a Pixel-class Android Chrome user agent with Playwright mobile mode and touch enabled. This is browser-readiness evidence, not a substitute for real hardware.

## Touch and input responsiveness

- A held right direction moved continuously and released back to a zero input vector.
- Separate pointer IDs held right plus up simultaneously and produced the expected diagonal vector `(1, -1)`.
- Dash activated from the touch control after the authoritative cooldown.
- Direction, dash and pause targets meet or exceed 44 px and do not overlap.
- Pointer up, cancel, leave and lost capture all remove the owning pointer.
- Page hide clears both touch axes, preventing stuck movement after returning to the game.
- Keyboard movement, keyboard dash and Escape pause/resume remain covered by the desktop lifecycle regression.

## Pause, focus, background and audio

- Blur, hidden-document and page-hide paths request pause only when a run is active and not already paused.
- During a page-hide check, simulation time remained stable within 0.05 seconds over a 500 ms observation.
- Touch state was `(0, 0)` after backgrounding.
- AudioContext changed from `running` to `suspended`, then returned to `running` from the explicit resume gesture.
- Mute state survived a page reload.
- Audible loudness, interruptions from calls/notifications and device speaker behavior remain part of the physical Android check.

## Long-session stability and performance

The accepted accelerated run used seed `20260816`, a 360-second shift and `balanceRate=6`. It reached the boss after 324.098 simulated seconds and collected 3,242 active-frame samples.

| Metric | Accepted result | Automated limit | Status |
| --- | ---: | ---: | --- |
| Reported FPS | 60.30 | ≥ 40 | PASS |
| Average frame time | 16.666 ms | ≤ 25 ms | PASS |
| Maximum sampled frame | 16.710 ms | Informational | PASS |
| Frames above 33.34 ms | 0 / 3,242 | ≤ 8% | PASS |
| Max hazards | 36 | ≤ 160 | PASS |
| Max projectiles | 2 | ≤ 100 | PASS |
| Max coins | 7 | ≤ 120 | PASS |
| Max transient effects | 49 | Tracked/cleaned | PASS |
| Max run timers | 3 | Tracked/cleaned | PASS |

The browser-reported heap increased by 1,309,076 bytes across the entire multi-run suite. This aggregate includes generated textures, multiple runs, screenshots and browser test instrumentation; zero active hazards, projectiles, coins, transient effects and run timers remained after result transitions. Real Android thermal throttling, GPU cost, memory pressure and a true long human session remain pending.

## Characters, boss and run lifecycle

- Cool Head completed the sustained run, deterministic clean boss lifecycle and victory/result flow.
- Firestarter completed a separate boss start, defeat and victory/result flow.
- Boss phases 1, 2, 3 and 4 were asserted.
- The measured minimum telegraphed spawn distance was 225 px against a 224 px test threshold.
- Boss entrance, attack pending/execution, defeat state and result requirement passed.
- Victory, defeat, replay and main-menu return passed.
- Result transitions cleared all hazards, projectiles, coins, effects and run timers.

## Visual evidence

The accepted run generates diagnostic captures under the ignored local path `playwright-report/mobile-readiness/`:

| Capture | Evidence |
| --- | --- |
| `android-large-gameplay.png` | Large landscape HUD and touch controls |
| `android-standard-gameplay.png` | Common Android landscape profile |
| `android-small-gameplay.png` | 740 × 360 compact HUD, 44 px controls and no shell drift |
| `compact-contract-gameplay.png` | Required 900 × 600 contract |
| `tablet-landscape-gameplay.png` | Wider 1024 × 600 behavior |
| `android-portrait-rotate-gate.png` | Full portrait orientation gate |
| `android-primary-boss-entrance.png` | Mobile boss entrance and HUD |
| `android-primary-boss-warning.png` | Phase-four warning and safe target placement |
| `android-primary-boss-defeat.png` | Director defeat payoff |
| `android-primary-victory.png` | Mobile victory result and replay controls |
| `android-primary-defeat.png` | Mobile defeat result and retry controls |

Visual review found no horizontal overflow, playfield scroll drift, control overlap or clipped result action at the tested sizes. The machine-readable evidence is `docs/milestone6/MILESTONE_6_MOBILE_VALIDATION.json`.

## Regression testing

Final accepted automated results on 2026-08-16:

| Gate | Result | Evidence |
| --- | --- | --- |
| Typecheck | PASS | `pnpm typecheck` |
| Automated tests | PASS | `pnpm test`: 6 files, 35 tests |
| Production build | PASS | `pnpm build`: 25 modules transformed |
| Desktop browser lifecycle | PASS | Menu → character → briefing → run → perk → event → boss → victory → result → replay → defeat |
| Desktop inputs | PASS | Keyboard movement, dash, automatic combat, Escape pause/resume and focus-loss pause |
| M5 animation states | PASS | Idle, move, dash, attack and hurt |
| M4 boss regression | PASS | Entrance, four phases, warning, safe placement, defeat and 5 PM hold |
| M6 mobile automation | PASS | Five landscape profiles, portrait gate, touch, lifecycle, soak, both recruits, boss and results |
| Physical Android | PENDING | No connected device or ADB runtime available |

## Known issues and evidence limits

- **Gate blocker:** physical Android Chrome/device validation is not complete. The current workstation exposes neither ADB nor a connected Android device.
- Headless browser audio checks prove Web Audio state transitions and preference persistence, not audible output quality or volume.
- Desktop Android emulation does not prove real GPU/FPS, thermal behavior, OS interruptions, navigation bars, notches or OEM WebView differences.
- The aggregate heap delta is not evidence of a leak; an isolated physical-device/DevTools memory profile is still recommended during the hardware session.
- No gameplay or boss issue was discovered in the accepted automated regression.

## M6 acceptance checklist

| # | Acceptance criterion | Result |
| ---: | --- | --- |
| 1 | M6 remains validation/mobile-fix only and preserves M3–M5 gameplay | PASS |
| 2 | Touch hold, release, simultaneous diagonal and dash work without stuck input | PASS |
| 3 | Landscape phone/tablet viewport matrix has no overflow or control overlap | PASS |
| 4 | Required 900 × 600 compact layout remains usable | PASS |
| 5 | Portrait orientation gates play, clears input and requests pause | PASS |
| 6 | Background/focus lifecycle pauses simulation and clears held input | PASS |
| 7 | Audio unlock, suspend/resume and mute persistence work | PASS (state) |
| 8 | Sustained accelerated session meets automated frame/entity limits | PASS (emulated) |
| 9 | Both characters complete their required mobile lifecycle checks | PASS (emulated) |
| 10 | Full boss lifecycle, victory, defeat and replay work | PASS (emulated) |
| 11 | Typecheck, tests, build and M3–M5 desktop browser regression pass | PASS |
| 12 | Real Android Chrome/device session validates touch, audio, FPS, background and full lifecycle | **PENDING** |

**Acceptance result: 11/12 passed; 1/12 pending physical Android evidence.**

## Physical Android completion protocol

On an Android phone connected to the same network as the development PC, open the LAN URL in current Chrome, rotate to landscape and record:

1. device model, Android version, Chrome version and viewport/screen resolution;
2. character select and briefing usability;
3. continuous four-direction movement, two-direction diagonal hold, release and dash;
4. audio on/off, background Chrome for ten seconds, return, confirm paused state, then resume;
5. at least one 10-minute normal-speed session, noting FPS/heat/input latency;
6. both characters;
7. boss entrance, all phases, warnings, defeat, 5 PM victory, defeat screen and replay;
8. screenshots or a short screen recording plus any observed issue.

## Final recommendation

The M6 implementation and automated readiness package should be committed and reviewed, but Review Gate 6 should remain **PHYSICAL DEVICE VALIDATION PENDING**. Once the physical Android protocol passes and its evidence is added to this report, M6 can be presented for final approval. Development must stop here; M7 remains locked.

**M6 REVIEW GATE — AUTOMATED READINESS PASS; PHYSICAL ANDROID PENDING. M7 NOT STARTED.**
