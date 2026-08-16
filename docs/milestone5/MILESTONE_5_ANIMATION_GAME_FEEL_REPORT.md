# Milestone 5 — Animation / Game Feel

## Outcome

Milestone 5 is complete against the approved M4 baseline `83afb97df4b70a0e3c52e1319881f07bb47b45f8`. Both recruits now have state-driven procedural animation, movement and automatic combat read immediately, impacts and hazards communicate their state more clearly, and the Regional Director presentation has a stronger audiovisual payoff. Development is stopped at Review Gate 5; Milestone 6 has not started.

The gameplay source of truth remains `ShiftSimulation`. No simulation, character-stat, hazard-definition, perk, event, boss-health, boss-phase, safe-spawn, clock, victory, or balance rule was changed for M5.

## Frozen scope and acceptance criteria

M5 was limited to character animation, visual movement response, attack/combat feedback, player-hit and shield feedback, hazard feedback, boss feedback, transitions, synthesized audio, accessibility-aware effects, and focused verification. It explicitly excluded new gameplay systems and unrelated content.

Acceptance required:

1. Both recruits use stable, bottom-aligned idle, move, attack, dash, and hurt animation states.
2. Animation reacts to authoritative state and does not drive collision or simulation outcomes.
3. Movement begins immediately at the existing speed, diagonals remain normalized, and dash timing/cooldown remain unchanged.
4. Automatic attacks show launch, trail, recoil/pose, and impact feedback without changing damage or fire timing.
5. Player damage, Professional Boundary blocks, hazard spawn/boost/hit/destruction, corporate events, and Chaos mode have distinct readable feedback.
6. Boss entrance, phase transitions, warnings, hits, and defeat feel stronger while preserving the M4 encounter contract.
7. Effects remain brief, reduced-motion aware, and clear at 1280 × 720 and 900 × 600.
8. Pause, focus loss, victory, defeat, replay, scene cleanup, both characters, and different perk builds remain functional.

## Implemented work

### Character animation and movement response

- Added packed runtime-generated animation sheets for each recruit: 4 idle frames, 6 movement frames, 3 attack frames, 3 dash frames, and 2 hurt frames.
- Preserved one shared 58 × 68 frame size and bottom contact line across every state.
- Added a presentation-only animation catalog with stable character-scoped keys, frame rates, repeat behavior, and pure contract tests.
- `PlayerController` now derives animation from movement, dash, automatic attack, hurt, and frozen state. Existing velocity, speed, normalization, collision body, dash duration, invulnerability, and cooldown calculations are unchanged.
- Dash afterimages, squash/lean, and a launch shockwave make the existing immediate movement response easier to read.

### Combat, hit, and hazard feedback

- Automatic attacks now add a short directional launch flash, packed attack pose, restrained projectile trail, and impact shards.
- Hazard hits flash at the impact point; destruction adds a color-coded shockwave while retaining the existing burst and coin behavior.
- Player damage adds the hurt state, directional impact, restrained screen tint, existing invulnerability flash, and existing camera shake.
- Professional Boundary blocks add a dedicated cyan shockwave; deadline damage now uses the same hurt presentation path.
- Hazard spawns gain a short identity marker and ring; accelerating managers add a warning beat. No spawn timing or hazard behavior changed.
- Corporate events and Chaos mode gain short palette flashes and radial emphasis without adding persistent overlays.

### Boss, transitions, and audio

- Entrance and phase changes add short screen-color emphasis and layered shockwaves.
- The existing 720 ms boss warning now has a visible two-beat title pulse, target shockwaves, and a synthesized warning pair.
- Boss defeat adds staged cyan/lime/gold shockwaves, a brighter transition flash, extra debris, and a three-layer synthesized fall/rise payoff while retaining the existing threat-disable and 900 ms actor fade.
- UI screen changes and boss announcements gain brief settle/scan animations; `prefers-reduced-motion` collapses these and reduces Phaser effect density/duration.
- The procedural soundboard now layers restrained tones for dash, spawn, impact, warning, upgrades, shield, boss phases, defeat, victory, and other existing cues. No external or licensed audio was introduced.

## M4 watch-item validation

| Watch item | M5 finding | Result |
| --- | --- | --- |
| Boss entrance duration | The 1.4-second actor entrance remains long enough to establish identity without delaying control; timing is unchanged. The new shockwave and audio layer make the beat read sooner. | PASS |
| Announcement scale | The existing width and type scale remain legible at 1280 × 720 and 900 × 600. The card is intentionally dominant but temporary, and its scan does not add persistent obstruction. | PASS |
| Warning rhythm | The authoritative 720 ms warning is unchanged. A two-beat visual/audio cue improves anticipation while target rings keep the safe zones readable. | PASS |
| Defeat payoff | Staged rings, debris, palette flash, and layered synthesis create a clearer climax. Threat disable, 900 ms actor fade, and the 5 PM hold contract remain unchanged. | PASS |

## Verification evidence

| Requirement | Evidence |
| --- | --- |
| Packed character animation | Catalog contracts verify all five states and frame counts; browser sampling proves the movement sheet advances frames in-engine. |
| State transitions | Browser assertions verify idle, move, dash, attack, and hurt states and stable keys for both recruits. |
| Movement/combat response | Keyboard displacement, normalized controller path, dash state, automatic projectile, attack state, and real damage-path hurt state pass in Chromium. |
| Hazard/hit clarity | Screenshots `04-keyboard-combat.png` and `04b-player-hit-feedback.png` show launch/trail and damage feedback without HUD obstruction. |
| M4 boss preservation | All four phases, entrance/aura, 720 ms warning, authoritative health HUD, defeat state, both builds, and 5 PM victory pass. The accepted safe-spawn minimum was 374.2 px against the 224 px browser threshold. |
| Lifecycle and cleanup | Menu, character, briefing, run, perk, event, boss, victory, result, replay, defeat, Escape pause, focus-loss pause, and zero-entity cleanup pass. |
| Layout/accessibility | Compact 900 × 600 and emulated reduced-motion passes are captured in `13-compact-gameplay.png` and `14-reduced-motion-gameplay.png`. |

Final gates on 2026-08-16:

- `pnpm typecheck` — PASS.
- `pnpm test` — PASS, 6 files and 35 tests.
- `pnpm build` — PASS, 25 modules transformed and production assets generated.
- `pnpm test:browser` — PASS, complete Chromium lifecycle plus M5 animation/game-feel assertions.
- Visual review — PASS for combat, real hit feedback, boss entrance, phase-four warning, boss defeat, result/replay, compact layout, and reduced-motion presentation.

The accepted machine-readable result is in `MILESTONE_5_BROWSER_VALIDATION.json`. Browser screenshots are generated in `playwright-report/lifecycle-smoke/` and remain diagnostic build output rather than committed source assets.

## Files changed

- `src/phaser/animation/animationCatalog.ts` and `.test.ts`
- `src/phaser/scenes/BootScene.ts`
- `src/phaser/scenes/ShiftScene.ts`
- `src/phaser/systems/PlayerController.ts`
- `src/phaser/systems/EffectsManager.ts`
- `src/audio/Soundboard.ts`
- `src/styles.css`
- `src/main.ts`
- `scripts/browser-smoke.mjs`
- M5 evidence and implementation-status documents

## Remaining human review

No blocking M5 issue remains. Physical-speaker loudness, long-session effect fatigue, and lower-end mobile GPU performance are appropriate later device-test considerations; they do not invalidate this desktop browser gate.

## Review Gate 5 conclusion

**M5 READY FOR CHATGPT REVIEW — DEVELOPMENT STOPPED.**
