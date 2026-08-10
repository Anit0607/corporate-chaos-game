# Corporate Chaos: Survive the Shift

A free workplace-comedy arcade game for desktop browsers and landscape touch devices. Survive one absurd workday, build a questionable career strategy, react to random corporate policy changes, and defeat the Regional Director before clocking out.

## V2 development build

- One replayable six-minute shift with a seeded event schedule
- Two meaningfully different recruits with unique stats and signature abilities
- Keyboard, arrow-key and landscape touch movement with dash
- Automatic paperclip attacks
- Eight escalating hazards with distinct behavior and readable telegraphs
- Five random corporate events that alter pressure, movement, damage or attacks
- Six upgrade types and a recurring three-choice perk draft
- A four-phase 5 PM boss encounter against the Regional Director
- Energy, score, Chaos Mode, earned Chaos Coins, win/failure, and replay
- Persistent high score, run/win history and achievement badges
- Anonymous provider-neutral analytics
- No login, payments, advertisements, multiplayer, or custom backend

## Controls

| Action | Input |
| --- | --- |
| Move | `WASD` or arrow keys |
| Dash | `Space` |
| Pause | `Escape` |
| Menus | Mouse or keyboard focus |

Touch devices receive an on-screen direction pad and dash control in landscape layouts.

## Local development

Requirements: Node.js 22+ and pnpm 11+.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

Use `?duration=60&seed=20260810` for a short reproducible V2 shift and `?debug=1` for Arcade Physics debug rendering.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

For the Chrome/Edge menu-to-boss smoke run, start Vite on the QA port and run the browser suite in a second terminal:

```bash
pnpm dev -- --host 127.0.0.1 --port 4173
pnpm test:browser
```

## Architecture

- `src/game/simulation`: deterministic game rules and scoring
- `src/game/content`: data-driven characters, hazards, events and perks
- `src/game/progression`: local achievement and high-score profile
- `src/game/analytics`: local-first analytics adapter with optional PostHog transport
- `src/phaser/scenes`: Phaser boot, rendering, physics, input, and effects
- `src/phaser/systems`: player control, effects and office-arena presentation adapters
- `src/ui`: DOM menus, HUD, overlays, results, and accessibility surfaces
- `src/audio`: lightweight original Web Audio cues

Phaser scenes are presentation adapters. Saveable state, scoring, clocks, seeded events, boss progression and run rules live in the simulation layer.

The pre-V2 repository is preserved by the annotated `v0.1.0-baseline` Git tag. See `docs/V2_IMPLEMENTATION_STATUS.md` for the blueprint comparison and remaining tuning work.

## Analytics

Gameplay works without an analytics account. Events are stored locally for development. To enable anonymous PostHog transport, copy `.env.example` to `.env.local` and set:

```text
VITE_POSTHOG_KEY=your_project_key
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

No names, emails, account identifiers, session recordings, or personal profiles are collected by the game integration.

## Deployment

The repository includes `vercel.json`. Import the GitHub repository into Vercel; the production build command is `pnpm build` and the output directory is `dist`.

## Original assets

All game visuals and audio are original to this project. The title artwork was generated specifically for Corporate Chaos; in-game sprites, environment art, icons, effects, and sound cues are procedurally authored in the codebase.

## License

MIT
