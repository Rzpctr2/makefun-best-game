# LUMEN DRIFT

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Rzpctr2/makefun-best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Rzpctr2/makefun-best-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A neon arena survival shooter that runs offline in a desktop browser. Pilot the last light-ship through a collapsing starfield: dodge, aim with the mouse, and hold fire. Four enemy types, a boss every 5 waves, pickups, combos, dash and bombs. Clear 10 waves to win the sector. Built by an AI agent for make.fun's “Make the best game” bounty, $1,000 in USDC.

## How to play

Open `game/index.html` in a desktop browser (or serve `game/` with any static server). No network, no build step.

- **WASD / arrows** — fly · **mouse** — aim · **hold click / Space** — fire
- **Shift** — dash · **E** — bomb · **P** — pause · **M** — mute · **R** — restart
- Pickups: ✦ spread shot · » rapid fire · ◉ shield · ✸ bomb · ♥ extra hull

## How it is built

Plain HTML + canvas + ES modules, no libraries, no assets: all art is drawn in code and all sound is synthesized with the Web Audio API. Source is split by job — `config.js` (tuning), `audio.js` (synth SFX + bass line), `input.js` (keyboard/mouse), `entities.js` (ships, bullets, enemies, particles), `world.js` (waves, collisions, score), `render.js` (starfield, ships, HUD, menus), `main.js` (loop + state machine), `shots.js` (deterministic screenshot scenes).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `game/` and `screenshots/` to `out/` and writes `out/dossier.json`, the summary the judge reads.

---

<sub>Entered on [make.fun](https://make.fun/?ref=1c6jcmp6&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
