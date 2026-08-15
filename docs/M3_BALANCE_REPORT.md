# Milestone 3 Balance Report

## Executive summary

**Status: COMPLETE.**

Milestone 3 satisfies every structured balance acceptance criterion in the gate-evidence specification. The accepted evidence contains 42 complete six-minute sessions: 30 baseline sessions and 12 post-tune sessions. All 42 runs ended in victory, all 42 reached boss phase 4, all 42 defeated the Regional Director, and none timed out.

This evidence establishes deterministic viability and rule coverage for both characters, all three controller strategies, all eight hazards, all six perks, all five corporate events, and all four boss phases. It does not establish a human win-rate or prove retention, perceived fairness, comprehension, or fun. Those questions remain for player testing.

## Repository under review

- Repository: `Anit0607/corporate-chaos-game`
- Branch: `main`
- M3 implementation commit: `b732531944d8a2dd9da311d2f5384ff8636ab866`
- M3 evidence tag: `milestone-3-balance-20260812`
- Audit-start commit: `a6075ce831eae4ccf9537392d9c10bb9fca2eace`
- Remote status at audit start: local `main` matched `origin/main`; the working tree was clean.

Repository history also contains later work from an earlier authorized pass. This audit neither changes nor relies on that work to close M3; M3 conclusions remain tied to the implementation and accepted datasets committed at `b732531`.

## M3 acceptance checklist

| Acceptance item | Result | Auditable evidence |
| --- | --- | --- |
| 30+ structured sessions/runs | **PASS** | 30 complete baseline plus 12 complete post-tune sessions; method and raw results are documented below and in `docs/balance/`. |
| Both characters | **PASS** | 21 Firestarter and 21 Cool Head accepted runs; both achieved 21/21 wins and boss defeats. |
| All 8 hazards | **PASS** | Spawn, clear, damage, difficulty, clarity, and failure-impact findings are recorded for every hazard. |
| All 5 corporate events | **PASS** | Every event appeared in both cohorts; frequency, win association, and damage impact are recorded. |
| All 6 perks | **PASS** | Offer counts, pick counts/rates, and effectiveness observations are recorded; every perk appeared in winning builds. |
| Regional Director, all 4 phases | **PASS** | All 42 sessions reached phase 4 and defeated the boss; phase mechanics and pressure are evaluated below. |
| Varied reproducible seeds | **PASS** | 30 deterministic baseline seeds and a matched 12-seed post-tune cohort are listed. |
| Explicit analysis | **PASS** | Raw results lead to character, hazard, event, perk, boss, and before/after conclusions. |
| Evidence-linked tuning | **PASS** | Deadline, Performance Review, rank, and runner changes include before values, evidence, change, and observed effect; justified no-change decisions are explicit. |
| Regression validation | **PASS** | Typecheck, 32 tests, production build, Chromium lifecycle smoke, and screenshot review pass. |
| GitHub evidence | **PASS** | M3 code/data were pushed in `b732531`; the consolidated report/status package is committed and pushed to `main`. |

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
| Urgent Email | 12,401 / 12,277 (99.0%) | 4,831 / 4,795 (99.3%) | 138 | Highest frequency and largest post-tune damage source; direct homing behavior and inbox telegraph remain clear. |
| Meeting Invite | 3,789 / 3,699 (97.6%) | 1,579 / 1,528 (96.8%) | 33 | Expanding area telegraph is readable; failures cost contact damage without making the zone unavoidable. |
| KPI Form | 3,084 / 3,009 (97.6%) | 1,292 / 1,273 (98.5%) | 38 | Zigzag silhouette is identifiable and creates moderate contact pressure despite the high clear rate. |
| Micromanager | 852 / 803 (94.2%) | 377 / 354 (93.9%) | 0 | Accelerating chase is legible; difficulty appears as target-priority/time pressure rather than forced damage. |
| HR Intervention | 1,069 / 789 (73.8%) | 435 / 313 (72.0%) | 10 | Lowest conventional clear rate; orbit/freeze behavior is visually distinct and failures create persistent control pressure. |
| Client Call | 901 / 880 (97.7%) | 408 / 400 (98.0%) | 7 | Persistent pursuit is easy to identify and remains relevant without dominating failure impact. |
| Impossible Deadline | 417 / 66 (15.8%) | 166 / 39 (23.5%) | 0 | Armed timer/blast communicates area denial; 118 post-tune detonations caused 118 active dodges and no unavoidable damage. |
| Performance Review | 257 / 240 (93.4%) | 137 / 133 (97.1%) | 13 | Rating/freeze telegraph is clear; tuned frequency/speed produced measurable failure impact while retaining a 97.1% clear rate. |

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

Both characters reached phase 4 and defeated the Regional Director in every accepted session: 42/42 phase-4 reaches and 42/42 boss defeats. Aggressive, balanced, and defensive controllers all succeeded with varied perk sets.

| Phase | M3 pressure model | Cadence | Evidence-based finding |
| --- | --- | ---: | --- |
| 1 | Summons paired Urgent Emails | 4.4s | Establishes add-management pressure. Every accepted run advanced beyond it. |
| 2 | Places a Meeting Invite near the player's route | 3.9s | Adds area denial and repositioning. Both characters and every strategy advanced beyond it. |
| 3 | Summons paired persistent Client Calls | 3.2s | Increases pursuit/target-priority pressure. All 42 runs advanced to phase 4. |
| 4 | Combines an Impossible Deadline with a Performance Review | 2.5s | Highest mixed movement/freeze pressure. All 42 runs defeated the boss and still completed the 5:00 PM hold. |

M3 did not change boss health, boss damage, phase thresholds, phase intervals, or the rule that victory requires both boss defeat and reaching 5:00 PM. A 100% deterministic-controller success rate supports viability, not a conclusion that human difficulty is final.

## Tuning changes

1. Impossible Deadline fuse reduced from 7.2 seconds to 6.5 seconds, and blast radius increased from 220 to 240 pixels. Detonation/dodge telemetry was added so area-denial pressure could be measured.
2. Performance Review speed multiplier increased from 0.72 to 0.80, and selection weight increased from 3 to 4, making the late-run threat more relevant without materially reducing its clearability.
3. Standard six-minute rank thresholds changed from the obsolete 6,000 / 11,000 / 18,000 scale to 240,000 / 320,000 / 400,000, proportional to configured shift duration. The Office Legend achievement now follows the authoritative earned rank.
4. The balance runner gained resumable checkpoints, structured telemetry, deterministic seeds, and synchronized local-only acceleration after the incomplete pilot exposed the original wall-clock limitation.

No character stats, global spawn curve, base hazard damage, perk values, event values, boss health, or boss damage were tuned. This intentionally avoids optimizing the game around a highly consistent automated controller.

## Tuning evidence matrix

| Area | Before | Evidence / problem | Change | After / observed effect |
| --- | --- | --- | --- | --- |
| Boss | Existing health, damage, four thresholds, and 4.4s/3.9s/3.2s/2.5s phase cadence | Both characters, all strategies, and varied winning perk sets reached phase 4 and defeated the boss in 42/42 accepted sessions. | **No boss-value change.** | Viability preserved without tuning around a highly consistent bot; human difficulty remains a gate risk. |
| Hazard: Impossible Deadline | 7.2s fuse; 220px blast radius; no detonation/dodge counters | Baseline 15.8% clear rate showed area-denial behavior, but its movement impact could not be distinguished from inactivity. | Fuse 7.2s -> 6.5s; radius 220px -> 240px; add detonation/dodge telemetry. | 118 detonations and 118 successful active dodges in 12 post-tune sessions; 0 damage, confirming meaningful but avoidable movement pressure. |
| Hazard: Performance Review | Speed 0.72; selection weight 3 | 93.4% baseline clear rate and 0 recorded damage made the late freeze threat underrepresented. | Speed 0.72 -> 0.80; weight 3 -> 4. | 137 spawned, 133 cleared (97.1%), 13 damage: measurable failure impact without becoming a blocker. |
| Perks | Existing six perk values | All six were selected; varied builds won; no perk was required. Post-tune pick rates ranged from 11.6% to 41.2%. | **No perk-value change.** | Build diversity and 42/42 boss defeats preserved; Meeting Escape's lower small-cohort rate remains a human-testing watch item. |
| Characters | Existing Firestarter and Cool Head stats | Both characters won 21/21 accepted runs. Their score/clear versus coin/safety profiles remained distinct. | **No character-stat change.** | Neither character became required or non-viable; identity tradeoffs remained intact. |
| Rank/progression | 6,000 / 11,000 / 18,000 rank thresholds; achievement used a separate 11,000 score check | Ordinary completed runs exceeded the top rank by a very large margin, making rank differentiation meaningless. | Six-minute thresholds -> 240,000 / 320,000 / 400,000, duration-scaled; achievement follows earned rank. | Baseline distribution became 12 Promising Recruit, 12 Office Legend, and 6 Chaos Executive. |
| Evidence runner | Non-resumable run with insufficient real-time cap | Initial pilot left 29/30 sessions incomplete near simulated minute 3 and therefore unusable for decisions. | Add checkpoints/resume, structured telemetry, deterministic seed plan, and synchronized local-only acceleration. | 30/30 accepted baseline and 12/12 post-tune sessions completed with zero timeouts. |

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

## Accepted session index

The machine-readable source of truth remains the JSON/CSV files in `docs/balance/`. This index includes every field required by the gate-evidence specification. “Major observation” records route strategy, total damage, final energy, and post-tune deadline behavior; no accepted session had a major failure.

| Session ID | Character | Seed | Result | Survival | Score | Coins | Boss phase | Defeated | Perks | Events | Major observation |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| baseline-01 | Firestarter | 310001 | victory | 360s | 371527 | 334 | 4 | yes | reply, reply, reply, printer, reply, reply, reply | printer-rebellion, reply-storm, printer-rebellion, performance-review | aggressive; 8 damage; 84 final energy |
| baseline-02 | Cool Head | 317920 | victory | 360s | 401393 | 968 | 4 | yes | printer, coffee, coffee, coffee, reply, printer, reply | printer-rebellion, wellness-hour, performance-review, reply-storm | aggressive; 14 damage; 111 final energy |
| baseline-03 | Firestarter | 325839 | victory | 360s | 327060 | 782 | 4 | yes | coffee, shield, coffee, shield, shield, coffee, snack | performance-review, printer-rebellion, performance-review, printer-rebellion | balanced; 24 damage; 92 final energy |
| baseline-04 | Cool Head | 333758 | victory | 360s | 272542 | 816 | 4 | yes | reply, shield, coffee, coffee, snack, shield, coffee | performance-review, calendar-purge, reply-storm, calendar-purge | balanced; 25 damage; 108 final energy |
| baseline-05 | Firestarter | 341677 | victory | 360s | 319988 | 841 | 4 | yes | shield, escape, shield, shield, snack, snack, shield | calendar-purge, printer-rebellion, reply-storm, calendar-purge | defensive; 0 damage; 108 final energy |
| baseline-06 | Cool Head | 349596 | victory | 360s | 313508 | 1008 | 4 | yes | escape, shield, coffee, snack, snack, snack, snack | wellness-hour, reply-storm, printer-rebellion, calendar-purge | defensive; 20 damage; 150 final energy |
| baseline-07 | Firestarter | 357515 | victory | 360s | 389533 | 769 | 4 | yes | coffee, coffee, escape, printer, coffee, printer, coffee | performance-review, wellness-hour, calendar-purge, performance-review | aggressive; 66 damage; 26 final energy |
| baseline-08 | Cool Head | 365434 | victory | 360s | 444980 | 973 | 4 | yes | printer, shield, shield, printer, printer, shield, printer | printer-rebellion, performance-review, calendar-purge, wellness-hour | aggressive; 26 damage; 99 final energy |
| baseline-09 | Firestarter | 373353 | victory | 360s | 324843 | 722 | 4 | yes | shield, shield, shield, reply, reply, shield, reply | performance-review, calendar-purge, performance-review, reply-storm | balanced; 0 damage; 92 final energy |
| baseline-10 | Cool Head | 381272 | victory | 360s | 329010 | 915 | 4 | yes | reply, shield, snack, shield, reply, shield, reply | calendar-purge, performance-review, calendar-purge, printer-rebellion | balanced; 16 damage; 126 final energy |
| baseline-11 | Firestarter | 389191 | victory | 360s | 309058 | 773 | 4 | yes | snack, snack, coffee, snack, coffee, snack, snack | printer-rebellion, reply-storm, performance-review, calendar-purge | defensive; 49 damage; 131 final energy |
| baseline-12 | Cool Head | 397110 | victory | 360s | 311553 | 921 | 4 | yes | escape, reply, snack, reply, escape, escape, coffee | printer-rebellion, reply-storm, calendar-purge, performance-review | defensive; 27 damage; 115 final energy |
| baseline-13 | Firestarter | 405029 | victory | 360s | 293830 | 716 | 4 | yes | coffee, coffee, escape, snack, shield, coffee, coffee | calendar-purge, wellness-hour, calendar-purge, wellness-hour | aggressive; 35 damage; 81 final energy |
| baseline-14 | Cool Head | 412948 | victory | 360s | 304869 | 996 | 4 | yes | snack, escape, coffee, coffee, coffee, coffee, coffee | calendar-purge, printer-rebellion, performance-review, reply-storm | aggressive; 55 damage; 85 final energy |
| baseline-15 | Firestarter | 420867 | victory | 360s | 398899 | 717 | 4 | yes | snack, printer, snack, snack, reply, printer, reply | calendar-purge, performance-review, calendar-purge, wellness-hour | balanced; 8 damage; 116 final energy |
| baseline-16 | Cool Head | 428786 | victory | 360s | 358347 | 965 | 4 | yes | snack, reply, snack, snack, printer, reply, snack | wellness-hour, reply-storm, performance-review, printer-rebellion | balanced; 42 damage; 138 final energy |
| baseline-17 | Firestarter | 436705 | victory | 360s | 313185 | 682 | 4 | yes | coffee, escape, escape, reply, reply, escape, coffee | performance-review, printer-rebellion, calendar-purge, reply-storm | defensive; 37 damage; 55 final energy |
| baseline-18 | Cool Head | 444624 | victory | 360s | 295209 | 877 | 4 | yes | reply, escape, escape, escape, coffee, escape, reply | reply-storm, wellness-hour, calendar-purge, performance-review | defensive; 14 damage; 118 final energy |
| baseline-19 | Firestarter | 452543 | victory | 360s | 339111 | 834 | 4 | yes | shield, escape, snack, shield, shield, shield, escape | printer-rebellion, reply-storm, printer-rebellion, reply-storm | aggressive; 19 damage; 81 final energy |
| baseline-20 | Cool Head | 460462 | victory | 360s | 320895 | 1043 | 4 | yes | escape, shield, escape, escape, reply, escape, shield | calendar-purge, printer-rebellion, wellness-hour, printer-rebellion | aggressive; 39 damage; 86 final energy |
| baseline-21 | Firestarter | 468381 | victory | 360s | 319768 | 777 | 4 | yes | snack, snack, escape, snack, snack, snack, escape | calendar-purge, performance-review, reply-storm, printer-rebellion | balanced; 42 damage; 132 final energy |
| baseline-22 | Cool Head | 476300 | victory | 360s | 276299 | 914 | 4 | yes | coffee, snack, snack, snack, snack, snack, escape | reply-storm, calendar-purge, wellness-hour, printer-rebellion | balanced; 14 damage; 158 final energy |
| baseline-23 | Firestarter | 484219 | victory | 360s | 391146 | 560 | 4 | yes | printer, coffee, reply, shield, reply, reply, coffee | performance-review, wellness-hour, reply-storm, performance-review | defensive; 0 damage; 92 final energy |
| baseline-24 | Cool Head | 492138 | victory | 360s | 322588 | 823 | 4 | yes | reply, coffee, coffee, reply, coffee, reply, shield | calendar-purge, performance-review, calendar-purge, performance-review | defensive; 27 damage; 91 final energy |
| baseline-25 | Firestarter | 500057 | victory | 360s | 357538 | 766 | 4 | yes | shield, shield, reply, snack, snack, printer, snack | wellness-hour, reply-storm, wellness-hour, printer-rebellion | aggressive; 13 damage; 116 final energy |
| baseline-26 | Cool Head | 507976 | victory | 360s | 287177 | 942 | 4 | yes | shield, snack, shield, shield, shield, snack, shield | calendar-purge, wellness-hour, calendar-purge, printer-rebellion | aggressive; 19 damage; 122 final energy |
| baseline-27 | Firestarter | 515895 | victory | 360s | 555846 | 851 | 4 | yes | printer, printer, printer, escape, escape, printer, escape | wellness-hour, performance-review, reply-storm, performance-review | balanced; 0 damage; 92 final energy |
| baseline-28 | Cool Head | 523814 | victory | 360s | 510569 | 947 | 4 | yes | printer, coffee, printer, escape, printer, printer, printer | calendar-purge, wellness-hour, performance-review, wellness-hour | balanced; 14 damage; 118 final energy |
| baseline-29 | Firestarter | 531733 | victory | 360s | 421274 | 684 | 4 | yes | printer, printer, shield, shield, reply, reply, reply | wellness-hour, reply-storm, calendar-purge, printer-rebellion | defensive; 10 damage; 82 final energy |
| baseline-30 | Cool Head | 539652 | victory | 360s | 458776 | 816 | 4 | yes | printer, reply, printer, reply, printer, reply, snack | calendar-purge, printer-rebellion, calendar-purge, reply-storm | defensive; 24 damage; 118 final energy |
| post-tune-01 | Firestarter | 310001 | victory | 360s | 398614 | 577 | 4 | yes | reply, coffee, reply, printer, reply, reply, coffee | performance-review, reply-storm, wellness-hour, printer-rebellion | aggressive; 8 damage; 92 final energy; deadlines 3/3 dodged |
| post-tune-02 | Cool Head | 317920 | victory | 360s | 463162 | 951 | 4 | yes | coffee, reply, printer, printer, reply, reply, reply | wellness-hour, reply-storm, calendar-purge, performance-review | aggressive; 14 damage; 118 final energy; deadlines 4/4 dodged |
| post-tune-03 | Firestarter | 325839 | victory | 360s | 345491 | 858 | 4 | yes | coffee, snack, shield, coffee, shield, coffee, shield | wellness-hour, printer-rebellion, wellness-hour, performance-review | balanced; 24 damage; 100 final energy; deadlines 8/8 dodged |
| post-tune-04 | Cool Head | 333758 | victory | 360s | 307094 | 961 | 4 | yes | shield, coffee, coffee, coffee, coffee, reply, shield | reply-storm, performance-review, wellness-hour, reply-storm | balanced; 46 damage; 86 final energy; deadlines 14/14 dodged |
| post-tune-05 | Firestarter | 341677 | victory | 360s | 331388 | 872 | 4 | yes | snack, shield, snack, shield, shield, escape, snack | calendar-purge, wellness-hour, printer-rebellion, calendar-purge | defensive; 28 damage; 111 final energy; deadlines 13/13 dodged |
| post-tune-06 | Cool Head | 349596 | victory | 360s | 315474 | 1012 | 4 | yes | coffee, shield, snack, shield, snack, snack, snack | wellness-hour, reply-storm, wellness-hour, printer-rebellion | defensive; 15 damage; 150 final energy; deadlines 11/11 dodged |
| post-tune-07 | Firestarter | 357515 | victory | 360s | 614477 | 877 | 4 | yes | printer, coffee, printer, printer, printer, printer, coffee | printer-rebellion, performance-review, printer-rebellion, performance-review | aggressive; 10 damage; 82 final energy; deadlines 9/9 dodged |
| post-tune-08 | Cool Head | 365434 | victory | 360s | 472687 | 1023 | 4 | yes | escape, printer, escape, printer, printer, coffee, coffee | printer-rebellion, performance-review, calendar-purge, printer-rebellion | aggressive; 40 damage; 78 final energy; deadlines 12/12 dodged |
| post-tune-09 | Firestarter | 373353 | victory | 360s | 344498 | 619 | 4 | yes | shield, reply, reply, snack, snack, reply, reply | performance-review, calendar-purge, reply-storm, printer-rebellion | balanced; 7 damage; 108 final energy; deadlines 14/14 dodged |
| post-tune-10 | Cool Head | 381272 | victory | 360s | 318258 | 1011 | 4 | yes | snack, shield, snack, shield, reply, shield, reply | wellness-hour, reply-storm, performance-review, calendar-purge | balanced; 20 damage; 114 final energy; deadlines 8/8 dodged |
| post-tune-11 | Firestarter | 389191 | victory | 360s | 343120 | 856 | 4 | yes | snack, snack, snack, coffee, escape, coffee, snack | printer-rebellion, calendar-purge, reply-storm, printer-rebellion | defensive; 13 damage; 124 final energy; deadlines 11/11 dodged |
| post-tune-12 | Cool Head | 397110 | victory | 360s | 278813 | 916 | 4 | yes | escape, snack, snack, coffee, snack, snack, coffee | wellness-hour, reply-storm, wellness-hour, calendar-purge | defensive; 14 damage; 150 final energy; deadlines 11/11 dodged |

## Review Gate 3 conclusion

M3 balance work and evidence are complete, reproducible, and committed. The automated evidence supports proceeding to human review, but the following remain explicit Review Gate 3 questions:

- Do new players understand hazard telegraphs and perk tradeoffs?
- Does a six-minute shift feel tense and replayable rather than exhausting?
- Is the bot-demonstrated completion margin appropriate for real players?
- Do physical-device controls and performance preserve the same fairness?

## Gate verification

Re-run on 2026-08-15 against the repository checkpoint:

- `pnpm typecheck`: passed.
- `pnpm test`: 5 files and 32 tests passed.
- `pnpm build`: passed; the production bundle was generated successfully.
- `pnpm test:browser`: passed the complete menu-to-result lifecycle, both characters, movement, dash, automatic combat, pause/focus recovery, perks, events, all boss phases, victory, replay, defeat, cleanup, and the 900x600 compact layout without browser console errors.
- Screenshot review: representative menu, gameplay, perk, boss, result, and compact-layout captures showed no blocking visual regression or playfield-obscuring persistent UI.

**M3 READY FOR CHATGPT REVIEW — DEVELOPMENT STOPPED.**
