# Milestone 4 — Regional Director Boss Polish

## Outcome

Milestone 3 was approved for progression on 2026-08-16. The Regional Director now reads as a distinct final encounter rather than another hazard wave, and Milestone 4 is complete at Review Gate 4. Development is stopped pending ChatGPT review; Milestone 5 has not started.

The M4 implementation originally landed in `4175b30` and was audited against the M3 baseline before this gate revalidation. It preserves the Milestone 3 balance rules: boss health, damage, phase thresholds, phase intervals, character stats, hazards, perks, events and the standard 4:12 PM / 5:00 PM clock contract are unchanged.

## Frozen M4 scope and acceptance criteria

M4 is limited to the Regional Director encounter: entrance and identity, four readable phase states, attack telegraphs and fair placement, transition feedback, boss HUD, defeat presentation and the existing 5 PM completion contract. Acceptance requires the following:

1. The encounter has a recognizable entrance and dedicated identity.
2. All four phases expose distinct names, directives and visual accents.
3. Boss attacks telegraph before activation and resolve at a safe distance from the player.
4. Phase transitions clear stale attacks while keeping HUD health synchronized with authoritative simulation health.
5. Boss defeat disables the threat and communicates that the player must hold until 5 PM.
6. Both characters can complete the boss lifecycle with different perk builds.
7. The full lifecycle, cleanup and 900 × 600 compact layout remain functional.

Likely change surfaces were constrained to boss presentation metadata, the boss-facing Phaser scene/effects/UI adapters, focused boss contracts, browser lifecycle coverage and M4 evidence documents. Character animation, sprite-strip work, broad game-feel changes, global camera or audio rework, new hazards/events/perks and all other M5 systems were explicitly excluded.

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
| Clear telegraphs and safe spawns | Browser test waits for the phase-four warning, verifies two target points, and measures every target at least 224 px from the current player position. The accepted run measured a 260.9 px minimum. |
| Phase transitions | Browser test forces and verifies phases 2, 3 and 4; HUD health remains synchronized with authoritative simulation health. |
| Defeat sequence | Browser snapshot asserts the defeat presentation state and “Director Offline” announcement; screenshot `09-boss-defeat.png`. |
| 5 PM consistency | Existing deterministic clock tests remain green; browser victory still requires boss defeat plus the 5:00 PM clock-out result. |
| Both characters / different builds | Cool Head completes the full visual lifecycle with a naturally selected perk; Firestarter completes it with Reply-All Blast + Printer Rage. |

Final local gates on 2026-08-16:

- `pnpm typecheck` — PASS.
- `pnpm test` — PASS, 5 files and 32 tests.
- `pnpm build` — PASS, production bundle generated.
- `pnpm test:browser` — PASS, covering menu, character selection, briefing, run, perk, event, boss, victory, result, replay and defeat.
- Browser inputs — PASS for keyboard movement, dash, automatic combat, Escape pause/resume and focus-loss pause.
- Screenshot review — PASS for perk offer, boss entrance, phase-four telegraph, boss defeat, victory result and 900 × 600 compact layout; no blocking clipping or playfield-obscuring issue was found.

The accepted browser run used Cool Head with Snack Break and Firestarter with Reply-All Blast plus Printer Rage. It verified all four boss phases, entrance, unique phase identity, attack warning, safe-spawn placement, defeat sequence, 5 PM hold, scene cleanup and both character integrations.

The accepted machine-readable browser result is stored in `MILESTONE_4_BROWSER_VALIDATION.json`.

The browser harness was made less timing-sensitive for slower machines by allowing 60 seconds of wall-clock headroom for the first perk offer. Perk acceptance remains checked through authoritative simulation state, HUD synchronization and the perk's gameplay effect instead of a transient toast that combat messages can immediately replace. This is test-only reliability work and does not alter gameplay.

## Excluded diagnostic

The four JSON/CSV files prefixed `milestone-3-m4-boss-polish` are a transparent diagnostic from an attempted full-run controller pass. All four automated agents were defeated before the boss and therefore provide no M4 boss evidence. They were not used for acceptance or tuning; no balance changes were made from them.

## Remaining human review

Human playtesting should still judge whether the entrance duration, announcement scale, attack-warning rhythm and defeat payoff feel memorable without obscuring the playfield. Broader character animation, general game feel and layered audio remain Milestone 5 work and were intentionally not started.

## Review Gate 4 conclusion

**M4 READY FOR CHATGPT REVIEW — DEVELOPMENT STOPPED.**
