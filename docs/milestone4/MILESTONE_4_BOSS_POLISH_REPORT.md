# Milestone 4 — Regional Director Boss Polish

## Outcome

The Regional Director now reads as a distinct final encounter rather than another hazard wave. The work preserves the Milestone 3 balance rules: boss health, damage, phase thresholds, phase intervals, character stats, perks, events and the standard 4:12 PM / 5:00 PM clock contract are unchanged.

## Implemented presentation

1. **Entrance sequence:** the arena clears carry-over hazards, the Director descends from the Executive Lift over 1.4 seconds, a phase-colored aura identifies the actor, and a centered Final Escalation announcement explains the 5 PM hold objective.
2. **Four phase identities:** Delegation, Calendar Control, Client Escalation and Performance Plan each have a unique color, directive, warning label and boss scale.
3. **Readable attacks:** every boss pattern now shows its target location for 720 ms before spawning. The boss HUD exposes the current directive and displays an “Incoming Directive” warning.
4. **Fair placement:** boss-spawned hazards are resolved away from the player. Phase-specific minimum distances range from 210 to 250 pixels, with a farthest-safe fallback when arena clamping would violate the requested distance.
5. **Transition feedback:** phase changes cancel stale pending attacks and trigger a phase card, aura/tint/scale change, particles, camera feedback, a dedicated sound cue and analytics event.
6. **Boss HUD:** the Regional Director has a phase-colored health panel with phase number, phase name, current directive and attack warning.
7. **Defeat sequence:** the Director disables immediately as a threat, expands/fades through a 900 ms effect, emits a dedicated defeat cue and displays “Director Offline — hold until 5:00 PM.”

## Verification

| Requirement | Evidence |
| --- | --- |
| Boss entrance and identity | Browser snapshot asserts intro and aura states; screenshot `07-boss-entrance.png`. |
| Distinct phases | Unit contracts assert four unique names/directives/colors; browser assertions verify phase names and CSS accents for phases 1–4. |
| Clear telegraphs and safe spawns | Browser test waits for the phase-four warning, verifies two target points, and measures every target at least 224 px from the current player position. |
| Phase transitions | Browser test forces and verifies phases 2, 3 and 4; HUD health remains synchronized with authoritative simulation health. |
| Defeat sequence | Browser snapshot asserts the defeat presentation state and “Director Offline” announcement; screenshot `09-boss-defeat.png`. |
| 5 PM consistency | Existing deterministic clock tests remain green; browser victory still requires boss defeat plus the 5:00 PM clock-out result. |
| Both characters / different builds | Cool Head completes the full visual lifecycle with a naturally selected perk; Firestarter completes it with Reply-All Blast + Printer Rage. |

Final local gates: TypeScript typecheck, 32 deterministic tests, production build and the complete Chromium lifecycle suite.

The accepted machine-readable browser result is stored in `MILESTONE_4_BROWSER_VALIDATION.json`.

## Excluded diagnostic

The four JSON/CSV files prefixed `milestone-3-m4-boss-polish` are a transparent diagnostic from an attempted full-run controller pass. All four automated agents were defeated before the boss and therefore provide no M4 boss evidence. They were not used for acceptance or tuning; no balance changes were made from them.

## Remaining human review

Human playtesting should still judge whether the entrance duration, announcement scale, attack-warning rhythm and defeat payoff feel memorable without obscuring the playfield. Broader character animation, general game feel and layered audio remain Milestone 5 work and were intentionally not started.
