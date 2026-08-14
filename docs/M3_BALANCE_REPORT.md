# Milestone 3 Balance Report

## Review Gate 3 decision package

Milestone 3 satisfies its structured balance exit criteria. The accepted evidence contains 42 complete six-minute sessions: 30 baseline sessions and 12 post-tune sessions. All 42 runs ended in victory, all 42 reached boss phase 4, all 42 defeated the Regional Director, and none timed out.

This evidence establishes deterministic viability and rule coverage for both characters, all three controller strategies, all eight hazards, all six perks, all five corporate events, and all four boss phases. It does not establish a human win-rate or prove retention, perceived fairness, comprehension, or fun. Those questions remain for player testing.

## Evidence integrity and commit verification

The complete M3 implementation and evidence were committed in `b732531` (`Complete Milestone 3 balance validation`) and tagged `milestone-3-balance-20260812`. That commit contains the runner, accepted raw sessions, summaries, the component matrix, tuning changes, focused tests, and browser-smoke extensions.

Accepted evidence:

- `docs/balance/milestone-3-baseline-sessions.json` and `.csv`: 30 complete baseline sessions.
- `docs/balance/milestone-3-baseline-summary.json`: machine-generated baseline aggregate.
- `docs/balance/milestone-3-post-tune-sessions.json` and `.csv`: 12 complete post-tune sessions.
- `docs/balance/milestone-3-post-tune-summary.json`: machine-generated post-tune aggregate.
- `docs/balance/MILESTONE_3_BALANCE_MATRIX.md`: character, hazard, perk, event, and boss assessment.
- `scripts/balance-sessions.mjs`: reproducible Chromium session runner.

The files prefixed `milestone-3-diagnostic-incomplete` contain an earlier 30-run pilot with an insufficient wall-clock cap. Twenty-nine sessions stopped near simulated minute 3, so that pilot is retained for audit transparency but excluded from all balance conclusions and tuning decisions.

## Method

The structured runner drives the real Phaser scene in Chromium. It alternates Firestarter and Cool Head, rotates aggressive, balanced, and defensive routing/perk priorities, uses natural automatic combat and perk offers, and records survival, damage, energy, score, coins, hazard spawns/clears/damage, perks, events, boss progress, and outcome.

The accepted cohorts used a developer-only 8x acceleration path that scales simulation time, Phaser timers, tweens, and Arcade Physics together. A same-rules 60-second calibration produced 91 clears at 1x and 90 at 8x, reached the same boss phase/outcome, and caused more damage at 8x. The accelerated path is available only in local development with `?balance=1`; normal and production play remain at 1x.

## Seeds and session design

Baseline seeds (30):

`310001`, `317920`, `325839`, `333758`, `341677`, `349596`, `357515`, `365434`, `373353`, `381272`, `389191`, `397110`, `405029`, `412948`, `420867`, `428786`, `436705`, `444624`, `452543`, `460462`, `468381`, `476300`, `484219`, `492138`, `500057`, `507976`, `515895`, `523814`, `531733`, `539652`.

Post-tune seeds (12, matched to the first 12 baseline seeds):

`310001`, `317920`, `325839`, `333758`, `341677`, `349596`, `357515`, `365434`, `373353`, `381272`, `389191`, `397110`.

| Cohort | Sessions | Character split | Strategy split | Victories | Boss defeats | Timeouts |
| --- | ---: | --- | --- | ---: | ---: | ---: |
| Baseline | 30 | 15 Firestarter / 15 Cool Head | 10 aggressive / 10 balanced / 10 defensive | 30 | 30 | 0 |
| Post-tune | 12 | 6 Firestarter / 6 Cool Head | 4 aggressive / 4 balanced / 4 defensive | 12 | 12 | 0 |
| Accepted total | 42 | 21 Firestarter / 21 Cool Head | 14 per strategy | 42 | 42 | 0 |

## Character results

| Character | Baseline results | Post-tune results | Observation |
| --- | --- | --- | --- |
| Firestarter | 15/15 wins; 20.73 average damage; 362,174 average score; 721 average coins; 728 average clears | 6/6 wins; 15.00 damage; 396,265 score; 777 coins; 748 clears | The offensive identity retained the higher score and clear ceiling without becoming required. |
| Cool Head | 15/15 wins; 25.07 average damage; 347,181 average score; 928 average coins; 723 average clears | 6/6 wins; 24.83 damage; 359,248 score; 979 coins; 725 clears | The larger collection range and rechargeable boundary retained a distinct coin/safety-oriented profile. |

In the full baseline, Firestarter scored 4.3% more and cleared 0.7% more, while Cool Head collected 28.8% more coins. Every aggressive, balanced, and defensive strategy won with both characters; no character or routing strategy was required for completion.

## Hazard observations

| Hazard | Baseline spawned / cleared | Post-tune spawned / cleared | Post-tune damage | Finding |
| --- | ---: | ---: | ---: | --- |
| Urgent Email | 12,401 / 12,277 (99.0%) | 4,831 / 4,795 (99.3%) | 138 | Frequent baseline pressure and the largest post-tune damage source. |
| Meeting Invite | 3,789 / 3,699 (97.6%) | 1,579 / 1,528 (96.8%) | 33 | Readable area pressure remained avoidable. |
| KPI Form | 3,084 / 3,009 (97.6%) | 1,292 / 1,273 (98.5%) | 38 | Zigzag movement continued to create relevant contact pressure. |
| Micromanager | 852 / 803 (94.2%) | 377 / 354 (93.9%) | 0 | Durability and acceleration consumed target priority without forcing damage. |
| HR Intervention | 1,069 / 789 (73.8%) | 435 / 313 (72.0%) | 10 | Lowest conventional clear rate; orbit/freeze behavior supplied persistent pressure. |
| Client Call | 901 / 880 (97.7%) | 408 / 400 (98.0%) | 7 | Persistent pursuit stayed relevant without dominating the run. |
| Impossible Deadline | 417 / 66 (15.8%) | 166 / 39 (23.5%) | 0 | The post-tune cohort recorded 118 detonations and 118 successful active dodges: meaningful area denial without unavoidable damage. |
| Performance Review | 257 / 240 (93.4%) | 137 / 133 (97.1%) | 13 | After its conservative speed/weight adjustment, it produced measurable contact/freeze damage while remaining clearable. |

## Corporate-event observations

| Event | Baseline appearances / wins | Post-tune appearances / wins | Post-tune average damage | Finding |
| --- | ---: | ---: | ---: | --- |
| Reply Storm | 20 / 20 | 8 / 8 | 17.13 | The attack modifier remained survivable. |
| Wellness Hour | 16 / 16 | 8 / 8 | 21.13 | Recovery pressure did not create a guaranteed result. |
| Calendar Purge | 22 / 22 | 7 / 7 | 19.43 | Movement/timing changes remained viable. |
| Performance Review | 20 / 20 | 8 / 8 | 21.13 | The event remained winnable alongside the tuned hazard. |
| Printer Rebellion | 20 / 20 | 8 / 8 | 18.13 | Projectile pressure did not require a particular build. |

Every event appeared in both accepted cohorts, and every run containing each event won. These are seeded observational comparisons, not isolated event A/B tests.

## Perk observations

| Perk | Baseline selected / offered | Baseline pick rate | Post-tune selected / offered | Post-tune pick rate | Finding |
| --- | ---: | ---: | ---: | ---: | --- |
| Coffee Rush | 36 / 102 | 35.3% | 19 / 53 | 35.8% | Stable mobility choice. |
| Reply-All Blast | 39 / 101 | 38.6% | 15 / 42 | 35.7% | Stable attack choice. |
| KPI Shield | 38 / 112 | 33.9% | 14 / 34 | 41.2% | Strong but non-required defense choice. |
| Meeting Escape | 28 / 93 | 30.1% | 5 / 43 | 11.6% | Lower in the smaller rotated post-tune sample, but selected in winning builds in both cohorts. |
| Printer Rage | 28 / 110 | 25.5% | 11 / 31 | 35.5% | Viable pierce/score choice. |
| Emergency Snack | 41 / 112 | 36.6% | 20 / 49 | 40.8% | Viable recovery choice. |

All six perks were selected during the 30-session baseline, varied perk sets won with both characters and every strategy, and no perk was required to defeat the boss.

## Boss observations

Both characters reached phase 4 and defeated the Regional Director in every accepted session: 42/42 phase-4 reaches and 42/42 boss defeats. Aggressive, balanced, and defensive controllers all succeeded with varied perk sets. M3 did not change boss health, boss damage, phase thresholds, phase intervals, or the rule that victory requires both boss defeat and reaching 5:00 PM.

## Tuning changes

1. Impossible Deadline fuse reduced from 7.2 seconds to 6.5 seconds, and blast radius increased from 220 to 240 pixels. Detonation/dodge telemetry was added so area-denial pressure could be measured.
2. Performance Review speed multiplier increased from 0.72 to 0.80, and selection weight increased from 3 to 4, making the late-run threat more relevant without materially reducing its clearability.
3. Standard six-minute rank thresholds changed from the obsolete 6,000 / 11,000 / 18,000 scale to 240,000 / 320,000 / 400,000, proportional to configured shift duration. The Office Legend achievement now follows the authoritative earned rank.
4. The balance runner gained resumable checkpoints, structured telemetry, deterministic seeds, and synchronized local-only acceleration after the incomplete pilot exposed the original wall-clock limitation.

No character stats, global spawn curve, base hazard damage, perk values, event values, boss health, or boss damage were tuned. This intentionally avoids optimizing the game around a highly consistent automated controller.

## Before/after findings

The fairest directional comparison uses the same 12 seeds before and after tuning. Natural routes, event draws, and perk choices can still diverge during play, so the table is evidence of continued viability rather than a claim that the tuning directly caused every aggregate movement.

| Matched 12-seed measure | Before tuning | After tuning | Finding |
| --- | ---: | ---: | --- |
| Victories / boss defeats | 12 / 12 | 12 / 12 | Viability was preserved. |
| Average damage | 22.92 | 19.92 | No new unavoidable damage spike appeared. |
| Average final energy | 103.50 | 109.42 | Completion margin remained healthy. |
| Average score | 342,916 | 377,756 | Score remained within the new meaningful rank bands. |
| Average coins | 818.50 | 877.75 | Reward collection remained healthy. |
| Average hazards cleared | 721.33 | 736.25 | Added deadline/review relevance did not suppress combat throughput. |
| Deadline clear rate | 15.8% full baseline | 23.5% post-tune | Deadlines remained primarily movement decisions; all 118 post-tune detonations were actively dodged. |
| Performance Review clear rate / damage | 93.4% / 0 | 97.1% / 13 | The threat registered damage after tuning without becoming a blocker. |

The revised rank thresholds split the 30-run baseline into 12 Promising Recruit, 12 Office Legend, and 6 Chaos Executive outcomes. Under the earlier thresholds, ordinary completed runs exceeded the top rank by a very large margin, so the rank system provided no differentiation.

## Review Gate 3 conclusion

M3 balance work and evidence are complete, reproducible, and committed. The automated evidence supports proceeding to human review, but the following remain explicit Review Gate 3 questions:

- Do new players understand hazard telegraphs and perk tradeoffs?
- Does a six-minute shift feel tense and replayable rather than exhausting?
- Is the bot-demonstrated completion margin appropriate for real players?
- Do physical-device controls and performance preserve the same fairness?

## Gate verification

Re-run on 2026-08-14 against the repository checkpoint:

- `pnpm typecheck`: passed.
- `pnpm test`: 5 files and 32 tests passed.
- `pnpm build`: passed; the production bundle was generated successfully.
- `pnpm test:browser`: passed the complete menu-to-result lifecycle, both characters, movement, dash, automatic combat, pause/focus recovery, perks, events, all boss phases, victory, replay, defeat, cleanup, and the 900x600 compact layout without browser console errors.
- Screenshot review: representative menu, gameplay, perk, boss, result, and compact-layout captures showed no blocking visual regression or playfield-obscuring persistent UI.

No subsequent milestone work is authorized by this report. Continue only after Review Gate 3 approval.
