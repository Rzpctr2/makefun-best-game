// LUMEN DRIFT — the world: waves, spawning, collisions, score.
// Owns the lists of enemies, bullets, particles and pickups, and turns
// kills into points, combos and drops.
import { COMBO, ENEMIES, PICKUPS, PLAYER, VIEW, WAVE } from './config.js';
import { Bullet, Enemy, FloatText, Pickup, burst, clamp, dist2, mulberry32 } from './entities.js';
import { sfx } from './audio.js';

const TYPES = ['drifter', 'spitter', 'splitter', 'weaver'];

export class World {
  constructor(rng) {
    this.rng = rng || Math.random;
    this.reset();
  }

  reset() {
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

  addScore(base, x, y) {
    const pts = Math.round(base * this.combo);
    this.score += pts;
    this.texts.push(new FloatText(x, y, `+${pts}`, '#facc15'));
  }

  registerKill(enemy, player) {
    this.kills++;
    this.combo = Math.min(COMBO.max, this.combo + COMBO.step);
    this.comboTimer = COMBO.window;
    this.addScore(enemy.score, enemy.x, enemy.y);
    burst(this.particles, enemy.x, enemy.y, enemy.color, enemy.type === 'boss' ? 60 : 18, enemy.type === 'boss' ? 420 : 260);
    if (enemy.type === 'boss') {
      sfx.bigExplode();
      this.shake = 14;
      this.boss = null;
      this.dropPickup(enemy.x, enemy.y, 'life');
    } else {
      sfx.explode(1);
      this.shake = Math.max(this.shake, 3);
    }
    if (enemy.type === 'splitter') {
      for (let i = 0; i < 2; i++) {
        const shard = new Enemy('shard', enemy.x + (i ? 14 : -14), enemy.y, this.rng, this.wave);
        this.enemies.push(shard);
      }
    }
    if (this.rng() < PICKUPS.dropChance) this.dropPickup(enemy.x, enemy.y);
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

    if (this.waveActive && this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnOne(player);
        this.spawnTimer = Math.max(WAVE.gapMin, WAVE.spawnGap - this.wave * 0.04);
      }
    }

    for (const e of this.enemies) e.update(dt, player, this.bullets, this.rng);
    for (const b of this.bullets) b.update(dt);
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
    // Player bullets vs enemies.
    for (const b of this.bullets) {
      if (!b.friendly || b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (b.radius + e.radius) ** 2) {
          b.dead = true;
          e.hp -= b.damage;
          e.flash = 0.08;
          burst(this.particles, b.x, b.y, '#a5f3fc', 3, 120);
          if (e.hp <= 0) { e.dead = true; this.registerKill(e, player); }
          break;
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
    burst(this.particles, player.x, player.y, '#f97316', 50, 520);
    this.shake = 16;
    sfx.bigExplode();
    return true;
  }

  fireBullet(player, spread) {
    const base = Math.atan2(player.aimY - player.y, player.aimX - player.x);
    const angles = spread ? [-0.16, 0, 0.16] : [0];
    for (const off of angles) {
      const a = base + off;
      this.bullets.push(new Bullet(
        player.x + Math.cos(a) * 20,
        player.y + Math.sin(a) * 20,
        Math.cos(a) * PLAYER.bulletSpeed,
        Math.sin(a) * PLAYER.bulletSpeed,
        true,
      ));
    }
  }
}

export function seededWorld(seed) {
  return new World(mulberry32(seed));
}
