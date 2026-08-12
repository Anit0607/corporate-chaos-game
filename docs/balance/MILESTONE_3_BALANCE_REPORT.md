# Milestone 3 Balance Report

## Outcome

Milestone 3 meets its balance exit criteria in structured automated playtesting:

- both characters are viable and retain different score/collection/safety profiles;
- all eight hazards create combat, movement, targeting, or area-denial pressure;
- all six perks are selected and support winning builds, with no required perk;
- all five events remain survivable and avoid forced penalties;
- all four boss phases are beatable by both characters and all tested strategies.

The accepted evidence contains 42 complete six-minute sessions: 30 baseline and 12 post-tune. There were 42 natural victories, zero forced timeouts, and 42 boss defeats. This competent deterministic controller establishes viability and rule coverage; it is not a substitute for human fun/difficulty feedback.

## Method

`scripts/balance-sessions.mjs` drives the actual local Phaser game through Chromium. Each session uses a unique seed, alternates characters, rotates aggressive/balanced/defensive movement and perk priorities, and records survival, damage, score, coins, clears, perks, events, hazard-specific results, boss phase and outcome.

The developer-only acceleration path scales Phaser timers, tweens, Arcade Physics, and simulation time together. It is limited to local development with `?balance=1`; production gameplay always runs at 1x. A 60-second calibration compared 1x and 8x using the same rules. The accepted 8x controller reproduced the real-time clear count closely (91 versus 90), reached the same boss phase/outcome, and took more damage, making it conservative for viability testing.

An initial 30-session pilot used an insufficient wall-clock cap: 29 runs stopped around simulated minute 3. Those files are explicitly named `diagnostic-incomplete` and were excluded from gameplay decisions. The runner was then made resumable and checkpointed before collecting the accepted baseline with zero timeouts.

## Accepted evidence

| Cohort | Sessions | Characters | Strategies | Natural completions | Boss phase 4 / defeated |
| --- | ---: | --- | --- | ---: | ---: |
| Baseline | 30 | 15 Firestarter / 15 Cool Head | 10 each aggressive, balanced, defensive | 30 | 30 / 30 |
| Post-tune | 12 | 6 Firestarter / 6 Cool Head | 4 each aggressive, balanced, defensive | 12 | 12 / 12 |

Baseline character gaps were small: Firestarter scored 4.3% more and cleared 0.7% more; Cool Head collected 28.8% more coins. Average damage differed by only 4.34 points. Strategy cohorts all won and had similar clears (724.3 to 727.5), so no movement strategy dominated outcomes.

The new standard-shift rank thresholds split the baseline into 12 Promising Recruit, 12 Office Legend, and 6 Chaos Executive results. Previously every ordinary complete run exceeded the 18,000-point top threshold by a very large margin, making rank meaningless.

## Conservative tuning applied

1. Impossible Deadline fuse: 7.2s to 6.5s; blast radius: 220 to 240 pixels. Added detonation/dodge telemetry. Post-tune sessions recorded 118 detonation decisions and 118 successful dodges, confirming meaningful avoidable area pressure.
2. Performance Review speed multiplier: 0.72 to 0.80; selection weight: 3 to 4. It recorded contact/freeze damage post-tune while retaining a 97.1% clear rate.
3. Standard six-minute rank thresholds: Promising Recruit 240,000; Office Legend 320,000; Chaos Executive 400,000, scaled for configured short test shifts. The Office Legend achievement now follows the authoritative earned rank.

No character, global spawn, base damage, perk, event, or boss-health values were changed. This prevents over-tuning around an automated controller and preserves accessibility for the upcoming human test phase.

## Known limitations

- Automated routing is stronger and more consistent than a new human player; 100% bot wins do not predict human win rate.
- Event comparison is observational because events are seeded, not isolated A/B trials.
- Deadline relevance is expressed through movement decisions rather than guaranteed damage, which is intentional.
- Human sessions are still required to evaluate perceived fairness, comprehension, fun, and whether the six-minute shift retains players.

Raw JSON/CSV evidence and machine summaries are stored beside this report. The detailed component assessment is in `MILESTONE_3_BALANCE_MATRIX.md`.

