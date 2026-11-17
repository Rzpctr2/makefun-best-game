// LUMEN DRIFT — the world: waves, spawning, collisions, score.
// Owns the lists of enemies, bullets, particles and pickups, and turns
// kills into points, combos and drops.
import { COMBO, ENEMIES, PICKUPS, PLAYER, SHIELD, SUITS, SYNERGY, UPGRADES, VIEW, WAVE } from './config.js';
import { Bullet, Enemy, FloatText, Pickup, burst, clamp, dist2, mulberry32 } from './entities.js';
import { sfx } from './audio.js';

const TYPES = ['drifter', 'spitter', 'splitter', 'weaver'];

export class World {
  constructor(rng, seed = null) {
    if (!rng) throw new Error('World needs a seeded rng');
    this.rng = rng;
    // When a seed is given, every reset() re-seeds: restarting the run
    // replays the exact same waves, drops and drafts (deterministic).
    this.seed = seed;
    this.reset();
  }

  reset() {
    if (this.seed != null) this.rng = mulberry32(this.seed);
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.pickups = [];
    this.texts = [];
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveActive = false;
    this.boss = null;
    this.shake = 0;
    this.time = 0;
    this.slowTimer = 0;
    this.regenCounter = 0;
    // Cosmetic flash timers (render only, decayed in update): deflect
    // arc flare, red hurt vignette, bomb shockwave ring.
    this.deflectFlash = 0;
    this.deflectAngle = 0;
    this.hurtFlash = 0;
    this.bombFlash = 0;
  }

  startWave(n) {
    this.wave = n;
    this.spawnQueue = [];
    const budget = WAVE.baseBudget + WAVE.budgetPerWave * n;
    let left = budget;
    const avail = TYPES.filter((t) => n >= WAVE.unlockWave[t]);
    while (left > 0) {
      const t = avail[Math.floor(this.rng() * avail.length)];
      const cost = WAVE.cost[t];
      if (cost > left && left < 2) { this.spawnQueue.push('drifter'); left -= 1; continue; }
      if (cost > left) continue;
      this.spawnQueue.push(t);
      left -= cost;
    }
    // Shuffle so the wave never arrives in one predictable clump.
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }
    this.spawnTimer = 0.6;
    this.waveActive = true;
    if (n % 5 === 0) this.spawnBoss();
    sfx.wave();
  }

  spawnBoss() {
    const boss = new Enemy('boss', VIEW.W / 2, -80, this.rng, this.wave);
    boss.y = 120;
    this.boss = boss;
    this.enemies.push(boss);
    sfx.boss();
  }

  spawnOne(player) {
    const type = this.spawnQueue.shift();
    if (!type) return;
    const edge = Math.floor(this.rng() * 4);
    let x, y;
    if (edge === 0) { x = 40 + this.rng() * (VIEW.W - 80); y = 40; }
    else if (edge === 1) { x = 40 + this.rng() * (VIEW.W - 80); y = VIEW.H - 40; }
    else if (edge === 2) { x = 40; y = 40 + this.rng() * (VIEW.H - 80); }
    else { x = VIEW.W - 40; y = 40 + this.rng() * (VIEW.H - 80); }
    // Never spawn on top of the player.
    if (dist2(x, y, player.x, player.y) < 200 * 200) { x = VIEW.W - x; y = VIEW.H - y; }
    this.enemies.push(new Enemy(type, x, y, this.rng, this.wave));
  }

  addScore(base, x, y, size = 15) {
    const pts = Math.round(base * this.combo);
    this.score += pts;
    this.texts.push(new FloatText(x, y, `+${pts}`, '#facc15', size));
  }

  registerKill(enemy, player, viaChain = false) {
    this.kills++;
    this.combo = Math.min(COMBO.max, this.combo + COMBO.step);
    this.comboTimer = COMBO.window;
    this.addScore(enemy.score, enemy.x, enemy.y, 20);
    burst(this.particles, enemy.x, enemy.y, enemy.color, enemy.type === 'boss' ? 60 : 18, enemy.type === 'boss' ? 420 : 260, this.rng);
    // Kill sparkle: white core sparks + gold embers on top of the burst.
    burst(this.particles, enemy.x, enemy.y, '#ffffff', enemy.type === 'boss' ? 12 : 6, 200, this.rng);
    burst(this.particles, enemy.x, enemy.y, '#facc15', enemy.type === 'boss' ? 10 : 5, 180, this.rng);
    if (enemy.type === 'boss') {
      sfx.bigExplode();
      this.shake = 14;
      this.boss = null;
      this.dropPickup(enemy.x, enemy.y, 'life');
    } else {
      sfx.explode(1);
      this.shake = Math.max(this.shake, 3);
    }
    // Chain Blast (STRIKE upgrade): a kill detonates, hurting neighbours.
    // Kills caused by a chain do not chain again (depth 1, no recursion).
    if (player.has('chainblast') && !viaChain) {
      burst(this.particles, enemy.x, enemy.y, '#f97316', 22, 320, this.rng);
      for (const other of this.enemies) {
        if (other.dead || other === enemy) continue;
        if (dist2(other.x, other.y, enemy.x, enemy.y) < 78 * 78) {
          this.damageEnemy(other, 2, player, true);
        }
      }
    }
    if (enemy.type === 'splitter') {
      for (let i = 0; i < 2; i++) {
        const shard = new Enemy('shard', enemy.x + (i ? 14 : -14), enemy.y, this.rng, this.wave);
        this.enemies.push(shard);
      }
    }
    if (this.rng() < PICKUPS.dropChance) this.dropPickup(enemy.x, enemy.y);
  }

  // Damage one enemy by any means (bullet, chain, shockwave). Centralises
  // the kill path so every damage source scores the same way.
  damageEnemy(enemy, amount, player, viaChain = false) {
    if (enemy.dead) return;
    enemy.hp -= amount;
    enemy.flash = 0.08;
    if (enemy.hp <= 0) { enemy.dead = true; this.registerKill(enemy, player, viaChain); }
  }

  // BASTION deflect: reflect an enemy bullet off the orbital shield.
  deflectBullet(b, player) {
    const d = Math.hypot(b.x - player.x, b.y - player.y) || 1;
    const nx = (b.x - player.x) / d, ny = (b.y - player.y) / d;
    const dot = b.vx * nx + b.vy * ny;
    const mult = player.has('powreflect') ? 2.2 : SHIELD.reflectMult;
    b.vx = (b.vx - 2 * dot * nx) * mult;
    b.vy = (b.vy - 2 * dot * ny) * mult;
    b.friendly = true;
    b.deflected = true;
    b.damage = SHIELD.deflectDamage + (player.has('powreflect') ? 1 : 0) + (player.suits.ORBIT >= 2 ? 1 : 0);
    b.radius = 6;
    player.deflectCount++;
    // Deflect flash: the shield arc flares at the reflection angle.
    this.deflectFlash = 0.18;
    this.deflectAngle = Math.atan2(b.y - player.y, b.x - player.x);
    this.combo = Math.min(COMBO.max, this.combo + COMBO.step);
    this.comboTimer = COMBO.window;
    this.addScore(SHIELD.deflectScore, b.x, b.y);
    burst(this.particles, b.x, b.y, '#2dd4bf', 10, 240, this.rng);
    sfx.deflect();
    // Energy Absorb: every 5th deflect restores 1 hull.
    if (player.has('absorb') && player.deflectCount % 5 === 0 && player.lives < player.maxLives) {
      player.lives++;
      burst(this.particles, player.x, player.y, '#34d399', 12, 200, this.rng);
      this.texts.push(new FloatText(player.x, player.y - 30, '+1 HULL', '#34d399'));
    }
    // Time Rift: deflecting briefly slows all enemy bullets.
    if (player.has('timeslow')) this.slowTimer = 1.2;
    // Counter Burst: deflecting fires 3 homing shots.
    if (player.has('rapidfire')) {
      const targets = this.enemies.filter((e) => !e.dead).slice(0, 3);
      const base = Math.atan2(-ny, -nx);
      for (let i = 0; i < 3; i++) {
        const a = base + (i - 1) * 0.4;
        const hb = new Bullet(b.x, b.y, Math.cos(a) * 520, Math.sin(a) * 520, true, 1);
        hb.homing = true;
        hb.target = targets[i] || targets[0] || null;
        hb.life = 1.4;
        hb.radius = 4;
        this.bullets.push(hb);
      }
    }
    // ORBIT synergy ×3: deflecting releases a shockwave.
    if (player.suits.ORBIT >= 3) {
      burst(this.particles, player.x, player.y, '#2dd4bf', 18, 380, this.rng);
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (dist2(e.x, e.y, player.x, player.y) < SHIELD.shockwaveRadius ** 2) {
          this.damageEnemy(e, 1, player);
        }
      }
    }
  }

  dropPickup(x, y, forceKind) {
    let kind = forceKind;
    if (!kind) {
      const r = this.rng();
      if (r < PICKUPS.lifeChance) kind = 'life';
      else if (r < 0.3) kind = 'spread';
      else if (r < 0.55) kind = 'rapid';
      else if (r < 0.8) kind = 'shield';
      else kind = 'bomb';
    }
    this.pickups.push(new Pickup(clamp(x, 30, VIEW.W - 30), clamp(y, 30, VIEW.H - 30), kind));
  }

  update(dt, player, game) {
    this.time += dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    if (this.slowTimer > 0) this.slowTimer -= dt;
    if (this.deflectFlash > 0) this.deflectFlash = Math.max(0, this.deflectFlash - dt);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.bombFlash > 0) this.bombFlash = Math.max(0, this.bombFlash - dt);

    if (this.waveActive && this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnOne(player);
        this.spawnTimer = Math.max(WAVE.gapMin, WAVE.spawnGap - this.wave * 0.04);
      }
    }

    // Time Rift: enemy bullets and enemies move at 0.35× while active.
    const edt = this.slowTimer > 0 ? dt * 0.35 : dt;
    // Vortex Pull: enemy bullets near the ring drift toward the shield arc.
    if (player.has('magnet')) {
      const sx = player.x + Math.cos(player.shieldAngle) * SHIELD.radius;
      const sy = player.y + Math.sin(player.shieldAngle) * SHIELD.radius;
      for (const b of this.bullets) {
        if (b.friendly || b.dead) continue;
        const d = Math.hypot(b.x - player.x, b.y - player.y);
        if (d < 150) {
          const a = Math.atan2(sy - b.y, sx - b.x);
          b.vx += Math.cos(a) * 260 * dt;
          b.vy += Math.sin(a) * 260 * dt;
        }
      }
    }
    for (const e of this.enemies) e.update(edt, player, this.bullets, this.rng);
    for (const b of this.bullets) b.update(edt);
    // Boss phase change: announce it loudly — a visible system.
    if (this.boss && this.boss.phase !== this.boss.lastPhase) {
      this.boss.lastPhase = this.boss.phase;
      const label = this.boss.phase === 2
        ? 'THE WARDEN RAGES — PHASE II'
        : 'THE WARDEN IS ENRAGED — PHASE III';
      this.texts.push(new FloatText(VIEW.W / 2, 330, label, '#f43f5e'));
      burst(this.particles, this.boss.x, this.boss.y, '#f43f5e', 30, 420, this.rng);
      this.shake = Math.max(this.shake, 8);
      sfx.boss();
    }
    for (const p of this.particles) p.update(dt);
    for (const p of this.pickups) p.update(dt, player);
    for (const t of this.texts) t.update(dt);

    this.collide(player, game);

    this.enemies = this.enemies.filter((e) => !e.dead);
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    this.pickups = this.pickups.filter((p) => !p.dead);
    this.texts = this.texts.filter((t) => !t.dead);

    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveActive = false;
      game.onWaveCleared(this.wave);
    }
  }

  collide(player, game) {
    // Orbital shield deflect FIRST: an enemy bullet crossing the ring
    // band inside the shield arc is reflected instead of reaching the ship.
    const arcHalf = (player.shieldArcDeg * Math.PI) / 180;
    const arcs = [player.shieldAngle];
    if (player.has('dual')) arcs.push(player.shieldAngle + Math.PI);
    for (const b of this.bullets) {
      if (b.friendly || b.dead) continue;
      const d = Math.hypot(b.x - player.x, b.y - player.y);
      if (Math.abs(d - SHIELD.radius) > SHIELD.band) continue;
      const ba = Math.atan2(b.y - player.y, b.x - player.x);
      for (const sa of arcs) {
        let diff = ba - sa;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < arcHalf) { this.deflectBullet(b, player); break; }
      }
    }
    // Player bullets vs enemies.
    for (const b of this.bullets) {
      if (!b.friendly || b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (b.radius + e.radius) ** 2) {
          const wasDeflected = b.deflected;
          burst(this.particles, b.x, b.y, b.deflected ? '#2dd4bf' : '#a5f3fc', 3, 120, this.rng);
          if (b.pierce > 0) b.pierce--;
          else b.dead = true;
          this.damageEnemy(e, b.damage, player);
          // A deflected bullet that lands the kill pays a bonus.
          if (wasDeflected && e.dead) {
            this.addScore(150, e.x, e.y);
            this.texts.push(new FloatText(e.x, e.y - 22, 'DEFLECT KILL!', '#2dd4bf', 22));
          }
          if (b.dead) break;
        }
      }
    }
    // Enemy bullets vs player.
    if (player.invuln <= 0 && player.dashTimer <= 0) {
      for (const b of this.bullets) {
        if (b.friendly || b.dead) continue;
        if (dist2(b.x, b.y, player.x, player.y) < (b.radius + player.radius - 4) ** 2) {
          b.dead = true;
          game.onPlayerHit();
          break;
        }
      }
    }
    // Enemies touching the player.
    if (player.invuln <= 0 && player.dashTimer <= 0) {
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (dist2(e.x, e.y, player.x, player.y) < (e.radius + player.radius - 4) ** 2) {
          if (e.type !== 'boss') { e.hp -= 2; if (e.hp <= 0) { e.dead = true; this.registerKill(e, player); } }
          game.onPlayerHit();
          break;
        }
      }
    }
    // Pickups.
    for (const p of this.pickups) {
      if (p.dead) continue;
      if (dist2(p.x, p.y, player.x, player.y) < (p.radius + PLAYER.pickupRadius) ** 2) {
        p.dead = true;
        game.onPickup(p.kind);
      }
    }
  }

  bomb(player) {
    if (player.bombs <= 0) return false;
    player.bombs--;
    for (const e of this.enemies) {
      if (e.type === 'boss') { e.hp -= 40; e.flash = 0.15; continue; }
      e.dead = true;
      this.registerKill(e, player);
    }
    for (const b of this.bullets) if (!b.friendly) b.dead = true;
    burst(this.particles, player.x, player.y, '#f97316', 50, 520, this.rng);
    this.shake = 16;
    this.bombFlash = 0.5;
    sfx.bigExplode();
    return true;
  }

  fireBullet(player, spread) {
    const base = Math.atan2(player.aimY - player.y, player.aimX - player.x);
    const angles = spread ? [-0.16, 0, 0.16] : [0];
    for (const off of angles) {
      const a = base + off;
      const b = new Bullet(
        player.x + Math.cos(a) * 20,
        player.y + Math.sin(a) * 20,
        Math.cos(a) * PLAYER.bulletSpeed,
        Math.sin(a) * PLAYER.bulletSpeed,
        true,
      );
      // STRIKE synergy ×3: bullets pierce +1 enemy.
      if (player.suits.STRIKE >= 3) b.pierce = 1;
      this.bullets.push(b);
    }
  }
}

export function seededWorld(seed) {
  return new World(mulberry32(seed), seed);
}

// ── Card draft (dungeon-crawler synergy, transplanted to a wave draft) ──
// Offer 3 cards: every upgrade the player does not own yet (non-stackable
// ones are removed once taken), plus the stackable ones. Padded with Field
// Repair when the unique pool runs dry. `rng` is required and must be the
// world's seeded rng, so the draft order is deterministic per run.
export function pick3(player, rng) {
  const pool = UPGRADES.filter((u) => u.stack || !player.has(u.id));
  const shuffled = [...pool].sort(() => rng() - 0.5);
  const picks = shuffled.slice(0, 3);
  while (picks.length < 3) {
    picks.push(UPGRADES.find((u) => u.id === 'repair'));
  }
  return picks;
}

// Apply a drafted card. Returns { synergy: 'ORBIT'|'STRIKE'|'WARD'|null,
// level } when the pick completes a synergy threshold (2 or 3 of a suit).
export function applyUpgrade(player, card) {
  player.upgrades[card.id] = (player.upgrades[card.id] || 0) + 1;
  player.suits[card.type] = (player.suits[card.type] || 0) + 1;
  let synergy = null;
  const level = player.suits[card.type];
  if (level === 2 || level === 3) synergy = card.type;
  switch (card.id) {
    case 'wider': player.shieldArcDeg = Math.min(85, player.shieldArcDeg + 25); break;
    case 'hp_up': {
      player.maxLives += 1;
      player.lives = Math.min(player.maxLives, player.lives + 1);
      break;
    }
    case 'repair': player.lives = Math.min(player.maxLives, player.lives + 1); break;
    default: break; // dual/magnet/timeslow/chainblast/powreflect/rapidfire/absorb are flags read live.
  }
  return { synergy, level };
}

// WARD synergy ×2: pickups magnetize from 2× range. Recomputed each frame.
export function magnetRadiusFor(player) {
  return player.suits.WARD >= 2 ? 280 : 140;
}
