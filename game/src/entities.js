// LUMEN DRIFT — entities: player ship, bullets, enemies, pickups,
// particles and floating score text. Pure data + update; drawing lives
// in render.js.
import { COLORS, ENEMIES, PLAYER, VIEW } from './config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

export class Player {
  constructor() { this.reset(); }
  reset() {
    this.x = VIEW.W / 2; this.y = VIEW.H / 2 + 80;
    this.vx = 0; this.vy = 0;
    this.angle = -Math.PI / 2;
    this.radius = PLAYER.radius;
    this.lives = PLAYER.lives;
    this.fireTimer = 0;
    this.invuln = 0;
    this.dashTimer = 0;
    this.dashCd = 0;
    this.shield = false;
    this.spreadUntil = 0;
    this.rapidUntil = 0;
    this.bombs = 1;
    this.thrust = 0;
  }
  get spread() { return this.spreadUntil > 0; }
  get rapid() { return this.rapidUntil > 0; }
}

export class Bullet {
  constructor(x, y, vx, vy, friendly, damage = 1) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.friendly = friendly;
    this.damage = damage;
    this.radius = friendly ? PLAYER.bulletRadius : 6;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < -30 || this.x > VIEW.W + 30 || this.y < -30 || this.y > VIEW.H + 30) this.dead = true;
  }
}

let enemyId = 0;
export class Enemy {
  constructor(type, x, y, rng, wave) {
    const def = ENEMIES[type];
    this.id = ++enemyId;
    this.type = type;
    this.x = x; this.y = y;
    this.radius = def.radius;
    this.hp = def.hp + Math.floor(wave / 4);
    this.maxHp = this.hp;
    this.speed = def.speed * (1 + wave * 0.03);
    this.score = def.score;
    this.color = def.color;
    this.angle = rng() * Math.PI * 2;
    this.t = rng() * 10;
    this.shootTimer = 1 + rng() * 1.5;
    this.vx = 0; this.vy = 0;
    this.dead = false;
    this.flash = 0;
  }
  update(dt, player, bullets, rng) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    const d = Math.hypot(player.x - this.x, player.y - this.y) || 1;
    const nx = (player.x - this.x) / d, ny = (player.y - this.y) / d;
    switch (this.type) {
      case 'drifter':
        this.vx += nx * this.speed * dt * 2.2; this.vy += ny * this.speed * dt * 2.2;
        break;
      case 'spitter': {
        const want = 260;
        const dir = d > want ? 1 : -0.8;
        this.vx += nx * this.speed * dir * dt * 2; this.vy += ny * this.speed * dir * dt * 2;
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && d < 560) {
          this.shootTimer = ENEMIES.spitter.shootEvery;
          const a = angleTo(this.x, this.y, player.x, player.y);
          bullets.push(new Bullet(this.x, this.y, Math.cos(a) * 260, Math.sin(a) * 260, false));
        }
        break;
      }
      case 'splitter':
        this.vx += nx * this.speed * dt * 2; this.vy += ny * this.speed * dt * 2;
        break;
      case 'shard':
        this.vx += nx * this.speed * dt * 3; this.vy += ny * this.speed * dt * 3;
        break;
      case 'weaver': {
        const orbit = angleTo(player.x, player.y, this.x, this.y) + Math.PI / 2;
        const lunge = (Math.sin(this.t * 1.7) > 0.86) ? 2.4 : 0.9;
        this.vx += (Math.cos(orbit) * 0.7 + nx * 0.5) * this.speed * lunge * dt * 2;
        this.vy += (Math.sin(orbit) * 0.7 + ny * 0.5) * this.speed * lunge * dt * 2;
        break;
      }
      case 'boss': {
        const tx = VIEW.W / 2 + Math.sin(this.t * 0.6) * 320;
        const ty = 150 + Math.sin(this.t * 1.1) * 60;
        this.vx += ((tx - this.x) * 0.8) * dt;
        this.vy += ((ty - this.y) * 0.8) * dt;
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
          this.shootTimer = 0.55;
          const n = 9;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + this.t;
            bullets.push(new Bullet(this.x, this.y, Math.cos(a) * 190, Math.sin(a) * 190, false));
          }
        }
        break;
      }
      default: break;
    }
    const sp = Math.hypot(this.vx, this.vy);
    const max = this.type === 'boss' ? ENEMIES.boss.speed : this.speed * 1.6;
    if (sp > max) { this.vx = (this.vx / sp) * max; this.vy = (this.vy / sp) * max; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.x = clamp(this.x, 20, VIEW.W - 20);
    this.y = clamp(this.y, 20, VIEW.H - 20);
    this.angle = Math.atan2(this.vy, this.vx);
  }
}

export class Particle {
  constructor(x, y, vx, vy, life, size, color) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.size = size; this.color = color;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.98; this.vy *= 0.98;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
}

export function burst(particles, x, y, color, n, speed = 260) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + Math.random() * 0.5, 1.5 + Math.random() * 2.5, color));
  }
}

export class Pickup {
  constructor(x, y, kind) {
    this.x = x; this.y = y;
    this.kind = kind;
    this.radius = 13;
    this.t = 0;
    this.life = 14;
    this.dead = false;
    this.vx = 0; this.vy = 0;
  }
  update(dt, player) {
    this.t += dt; this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    const d = Math.hypot(player.x - this.x, player.y - this.y);
    if (d < 140) {
      const a = angleTo(this.x, this.y, player.x, player.y);
      this.vx += Math.cos(a) * 900 * dt; this.vy += Math.sin(a) * 900 * dt;
    }
    this.vx *= 0.92; this.vy *= 0.92;
    this.x += this.vx * dt; this.y += this.vy * dt;
  }
}

export class FloatText {
  constructor(x, y, text, color = COLORS.text) {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.life = 0.9; this.dead = false;
  }
  update(dt) { this.y -= 42 * dt; this.life -= dt; if (this.life <= 0) this.dead = true; }
}
