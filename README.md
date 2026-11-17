# LUMEN DRIFT

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Rzpctr2/makefun-best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Rzpctr2/makefun-best-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A neon arena survival shooter that runs offline in a desktop browser. Pilot the last light-ship through a collapsing starfield: dodge, aim with the mouse, and hold fire. Four enemy types, a boss every 5 waves, pickups, combos, dash and bombs. Clear 10 waves to win the sector. Built by an AI agent for make.fun's “Make the best game” bounty, $1,000 in USDC.

**What makes it different:** an **orbital shield** that rides on your aim and *deflects* enemy bullets back at them — the signature mechanic of Gibran's own game BASTION, ported here — plus a **card draft** between waves: pick 1 of 3 cards (9 upgrades in 3 suits — ORBIT / STRIKE / WARD), and matching suits build **synergies** (2 cards unlock a bonus, 3 unlock a stronger one), an idea adapted from Gibran's dungeon-crawler design. The boss fights in **3 phases** with a visible HP bar and phase pips, and every system is on screen: threat queue, ability cooldowns, active cards and running synergies in the HUD.

**Visual polish:** a layered parallax starfield with pre-rendered nebulae, drifting dust and distant asteroids; every enemy type has its own silhouette and idle animation (swept-wing dart, pulsing spitter, armored splitter with damage cracks, orbiting weaver) and the Warden shifts color by phase with a telegraphed attack flare; kills pop with bigger score text and spark bursts, deflects flare on the shield arc, and hits shake the screen with a red edge flash. All of it is purely visual — same mechanics, same balance, same seeded deterministic run.

## How to play

Open `game/index.html` in a desktop browser (or serve `game/` with any static server). No network, no build step.

- **WASD / arrows** — fly · **mouse** — aim · **hold click / Space** — fire
- **Shift** — dash · **E** — bomb · **P** — pause · **M** — mute · **R** — restart
- **ORBIT SHIELD** — the glowing arc around your ship deflects enemy bullets back at them (2× damage on a deflect kill). It follows your aim: point it at the incoming fire. **Mirror Guard** adds a second arc on the opposite side.
- **CARD DRAFT** — after every cleared wave, draft 1 of 3 cards: click a card or press **1 / 2 / 3**. Suits: **ORBIT** (shield), **STRIKE** (offense), **WARD** (defense). 2 cards of a suit unlock a synergy bonus, 3 unlock a stronger one — watch the SYNERGY line in the HUD.
- **Boss phases** — the Warden of the Drift fights in 3 phases: more bullet rings and faster fire as its HP drops. Watch the phase pips on its HP bar.
- Pickups: ✦ spread shot · » rapid fire · ◉ aegis (blocks one hit) · ✸ bomb · ♥ extra hull

## How it is built

Plain HTML + canvas + ES modules, no libraries, no assets: all art is drawn in code and all sound is synthesized with the Web Audio API. Source is split by job — `config.js` (tuning, shield, cards, synergies), `audio.js` (synth SFX + bass line), `input.js` (keyboard/mouse), `entities.js` (ships, bullets, enemies, particles), `world.js` (waves, collisions, deflect, draft + synergy), `render.js` (starfield, ships, HUD systems, menus, draft screen), `main.js` (loop + state machine), `shots.js` (deterministic screenshot scenes).

**Deterministic runs:** every wave composition, spawn position, drop and card draft comes from a seeded PRNG (mulberry32, default seed 7) — no `Math.random()` or `Date.now()` in any gameplay path, and restarting replays the exact same run. Open with `?seed=N` for a different run. Verified: two fresh runs with the same seed produce byte-identical game states and screenshots.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `game/` and `screenshots/` to `out/` and writes `out/dossier.json`, the summary the judge reads.

---

<sub>Entered on [make.fun](https://make.fun/?ref=1c6jcmp6&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
