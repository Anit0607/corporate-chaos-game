# Corporate Chaos: Survive the Shift

A free desktop-browser workplace-comedy arcade game. Survive one absurd workday, dodge corporate hazards, choose questionable upgrades, trigger Chaos Mode, and make it to 5 PM.

## Phase 1 scope

- One polished 6-minute office survival run
- Red or blue recruit selection
- Keyboard movement and dash
- Automatic paperclip attacks
- Escalating emails, meetings, KPI forms, and micromanagers
- Six upgrade types and a recurring three-choice perk draft
- Energy, score, Chaos Mode, earned Chaos Coins, win/failure, and replay
- Anonymous provider-neutral analytics
- No login, payments, advertisements, multiplayer, or custom backend

## Controls

| Action | Input |
| --- | --- |
| Move | `WASD` or arrow keys |
| Dash | `Space` |
| Pause | `Escape` |
| Menus | Mouse or keyboard focus |

## Local development

Requirements: Node.js 22+ and pnpm 11+.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

Use `?duration=45` for a short test shift and `?debug=1` for Arcade Physics debug rendering.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Architecture

- `src/game/simulation`: deterministic game rules and scoring
- `src/game/content`: authored perk data
- `src/game/analytics`: local-first analytics adapter with optional PostHog transport
- `src/phaser/scenes`: Phaser boot, rendering, physics, input, and effects
- `src/ui`: DOM menus, HUD, overlays, results, and accessibility surfaces
- `src/audio`: lightweight original Web Audio cues

Phaser scenes are presentation adapters. Saveable state, scoring, clocks, difficulty, and progression live in the simulation layer.

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
