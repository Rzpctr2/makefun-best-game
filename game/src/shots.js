// LUMEN DRIFT — deterministic screenshot scenes.
// ?shot=start|play|boss|end&seed=N puts the game into a fixed, readable
// state so the screenshots show the whole loop: title, play with HUD,
// boss fight, and the game-over screen with restart.
import { VIEW } from './config.js';
import { Bullet, Enemy, FloatText, Pickup, burst, mulberry32 } from './entities.js';
import { STATES } from './main.js';
import { pick3 } from './world.js';

function placeEnemies(game, specs, rng) {
  for (const [type, x, y] of specs) {
    game.world.enemies.push(new Enemy(type, x, y, rng, game.world.wave));
  }
}

function fireSpread(game, n) {
  const p = game.player;
  for (let i = 0; i < n; i++) {
    const a = p.angle + (i - (n - 1) / 2) * 0.14;
    game.world.bullets.push(new Bullet(
      p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 24,
      Math.cos(a) * 760, Math.sin(a) * 760, true,
    ));
  }
}

function scatterBullets(game, cx, cy, n, speed, friendly) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.35;
    game.world.bullets.push(new Bullet(cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, friendly));
  }
}

export function buildShotScene(game, shot, seed) {
  const rng = mulberry32(seed * 31 + 7);
  const p = game.player;
  const w = game.world;

  if (shot === 'start') {
    game.state = STATES.TITLE;
    game.best = 48200;
    return;
  }

  if (shot === 'play') {
    game.state = STATES.PLAYING;
    game.best = 48200;
    w.wave = 3;
    w.score = 12450;
    w.kills = 87;
    w.combo = 4.5;
    w.comboTimer = 2.4;
    w.waveActive = true;
    w.spawnQueue = ['drifter', 'spitter', 'splitter', 'weaver', 'drifter', 'spitter', 'drifter', 'weaver', 'splitter', 'drifter'];
    p.x = 380; p.y = 430;
    p.aimX = 760; p.aimY = 300;
    p.angle = Math.atan2(300 - 430, 760 - 380);
    p.shieldAngle = p.angle;
    p.lives = 3;
    p.spreadUntil = 6;
    p.bombs = 2;
    p.deflectCount = 7;
    placeEnemies(game, [
      ['drifter', 760, 300], ['drifter', 900, 220], ['spitter', 980, 420],
      ['splitter', 700, 180], ['weaver', 1060, 300], ['drifter', 820, 520],
      ['shard', 640, 380], ['splitter', 1120, 520],
      ['drifter', 700, 340], ['drifter', 840, 380], ['weaver', 940, 260],
      ['shard', 560, 330],
    ], rng);
    fireSpread(game, 3);
    // Mid-flight bullets already down-range, so the cover shows a live
    // firefight instead of an empty lane (fresh muzzle shots leave the
    // screen before the screenshot is taken).
    const aim = Math.atan2(300 - 430, 760 - 380);
    for (const d of [140, 260, 380, 500]) {
      for (const off of [-0.16, 0, 0.16]) {
        const a = aim + off;
        game.world.bullets.push(new Bullet(
          380 + Math.cos(a) * d, 430 + Math.sin(a) * d,
          Math.cos(a) * 760, Math.sin(a) * 760, true,
        ));
      }
    }
    scatterBullets(game, 980, 420, 3, 240, false);
    // BASTION shield in action: teal deflected bullets flying back.
    const defAim = Math.atan2(300 - 430, 760 - 380);
    for (const d of [180, 300]) {
      const db = new Bullet(
        380 + Math.cos(defAim) * d, 430 + Math.sin(defAim) * d,
        Math.cos(defAim) * 600, Math.sin(defAim) * 600, true, 2,
      );
      db.deflected = true;
      game.world.bullets.push(db);
    }
    p.upgrades = { wider: 1, powreflect: 1 };
    p.suits = { ORBIT: 1, STRIKE: 1, WARD: 0 };
    burst(w.particles, 760, 300, '#f472b6', 14, 260, rng);
    burst(w.particles, 520, 480, '#22d3ee', 10, 200, rng);
    burst(w.particles, 700, 320, '#fb923c', 26, 380, rng);
    burst(w.particles, 860, 240, '#4ade80', 16, 300, rng);
    w.pickups.push(new Pickup(560, 250, 'spread'));
    w.pickups.push(new Pickup(1020, 470, 'shield'));
    w.texts.push(new FloatText(760, 270, '+450', '#facc15'));
    w.texts.push(new FloatText(700, 300, '+300', '#facc15'));
    return;
  }

  if (shot === 'boss') {
    game.state = STATES.PLAYING;
    game.best = 48200;
    w.wave = 5;
    w.score = 31200;
    w.kills = 163;
    w.combo = 6.0;
    w.comboTimer = 2.8;
    w.waveActive = true;
    w.spawnQueue = ['drifter', 'weaver', 'drifter'];
    p.x = 640; p.y = 560;
    p.aimX = 640; p.aimY = 150;
    p.angle = -Math.PI / 2;
    p.shieldAngle = -Math.PI / 2;
    p.lives = 3;
    p.shield = true;
    p.rapidUntil = 8;
    p.bombs = 1;
    p.deflectCount = 23;
    p.upgrades = { wider: 1, dual: 1, powreflect: 1 };
    p.suits = { ORBIT: 2, STRIKE: 1, WARD: 0 };
    const boss = new Enemy('boss', 640, 150, rng, 5);
    boss.hp = 132; boss.maxHp = 220;
    // 132/220 = 60% HP is phase 2: set it explicitly (the frozen scene
    // never runs an update, so the constructor's phase 1 would be wrong).
    boss.phase = 2; boss.lastPhase = 2;
    w.boss = boss;
    w.enemies.push(boss);
    placeEnemies(game, [['drifter', 300, 260], ['weaver', 980, 280]], rng);
    fireSpread(game, 3);
    // Deflected bullets racing back up at the Warden.
    const db1 = new Bullet(640, 420, 0, -600, true, 2); db1.deflected = true; w.bullets.push(db1);
    const db2 = new Bullet(600, 470, -90, -580, true, 2); db2.deflected = true; w.bullets.push(db2);
    const db3 = new Bullet(690, 450, 60, -590, true, 2); db3.deflected = true; w.bullets.push(db3);
    scatterBullets(game, 640, 150, 11, 190, false);
    burst(w.particles, 640, 220, '#f43f5e', 20, 300, rng);
    w.texts.push(new FloatText(640, 260, '+1,200', '#facc15'));
    return;
  }

  if (shot === 'upgrade') {
    game.state = STATES.UPGRADE;
    game.best = 48200;
    w.wave = 4;
    w.score = 24800;
    w.kills = 141;
    w.combo = 5.0;
    w.comboTimer = 2.0;
    w.waveActive = false;
    p.x = 640; p.y = 560;
    p.lives = 3;
    p.upgrades = { wider: 1, hp_up: 1 };
    p.suits = { ORBIT: 1, STRIKE: 0, WARD: 1 };
    game.upgradeChoices = pick3(p, rng);
    return;
  }

  if (shot === 'end') {
    game.state = STATES.OVER;
    game.isWin = false;
    game.overTimer = 1.2;
    game.best = 48200;
    w.wave = 9;
    w.score = 48200;
    w.kills = 214;
    w.waveActive = false;
    p.x = 640; p.y = 360;
    p.lives = 0;
    return;
  }

  // Unknown ?shot: fall back to the title screen.
  game.state = STATES.TITLE;
}
