// LUMEN DRIFT — game loop and state machine.
// States: title → playing → (waveclear banner) → playing … → gameover
// (or victory at wave 10) → title. Pause overlays playing.
import { COLORS, PLAYER, STORAGE_KEY, VIEW, WAVE } from './config.js';
import { Player, mulberry32 } from './entities.js';
import { World, seededWorld } from './world.js';
import { bindInput, isDown, mouse, wasPressed, endFrame, axis } from './input.js';
import { drawBackground, drawGameOver, drawHUD, drawPaused, drawTitle, drawWaveBanner, drawWorld, makeStars } from './render.js';
import { initAudio, sfx, startMusic, stopMusic, toggleMute } from './audio.js';
import { buildShotScene } from './shots.js';

export const STATES = { TITLE: 'title', PLAYING: 'playing', PAUSED: 'paused', OVER: 'over' };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rng = Math.random;
    this.stars = makeStars(this.rng);
    this.player = new Player();
    this.world = new World(this.rng);
    this.state = STATES.TITLE;
    this.time = 0;
    this.bannerTimer = 0;
    this.bannerWave = 0;
    this.isWin = false;
    this.best = 0;
    try { this.best = Number(localStorage.getItem(STORAGE_KEY)) || 0; } catch (_) { /* storage unavailable */ }
    this.overTimer = 0;
    bindInput(canvas);
    // Debug/testing hook for headless playtests (read-only state + start).
    window.__LUMEN = {
      state: () => this.state,
      score: () => this.world.score,
      wave: () => this.world.wave,
      lives: () => this.player.lives,
      enemies: () => this.world.enemies.length,
      start: () => this.startRun(),
    };
  }

  startRun() {
    initAudio();
    startMusic();
    this.player.reset();
    this.world.reset();
    this.state = STATES.PLAYING;
    this.bannerWave = 1;
    this.bannerTimer = 2.0;
    this.world.startWave(1);
    sfx.click();
  }

  onWaveCleared(wave) {
    const bonus = WAVE.clearBonus * wave;
    this.world.score += bonus;
    this.world.texts.push({ x: VIEW.W / 2, y: 200, text: `WAVE BONUS +${bonus}`, color: '#facc15', life: 1.2, dead: false, update(dt) { this.y -= 30 * dt; this.life -= dt; if (this.life <= 0) this.dead = true; } });
    if (wave >= WAVE.winWave) { this.endRun(true); return; }
    this.bannerWave = wave + 1;
    this.bannerTimer = 2.0;
    this.world.startWave(wave + 1);
  }

  onPlayerHit() {
    if (this.player.shield) {
      this.player.shield = false;
      this.player.invuln = 1.2;
      this.world.shake = 8;
      sfx.hit();
      return;
    }
    this.player.lives -= 1;
    this.player.invuln = PLAYER.invulnTime;
    this.world.combo = 1;
    this.world.comboTimer = 0;
    this.world.shake = 10;
    sfx.hit();
    if (this.player.lives <= 0) this.endRun(false);
  }

  onPickup(kind) {
    const p = this.player;
    if (kind === 'spread') { p.spreadUntil = 12; sfx.powerup(); }
    else if (kind === 'rapid') { p.rapidUntil = 12; sfx.powerup(); }
    else if (kind === 'shield') { p.shield = true; sfx.powerup(); }
    else if (kind === 'bomb') { p.bombs = Math.min(3, p.bombs + 1); sfx.powerup(); }
    else if (kind === 'life') { p.lives = Math.min(PLAYER.maxLives, p.lives + 1); sfx.powerup(); }
    else sfx.pickup();
  }

  endRun(win) {
    this.isWin = win;
    this.state = STATES.OVER;
    this.overTimer = 0;
    stopMusic();
    if (win) sfx.win(); else sfx.lose();
    if (this.world.score > this.best) {
      this.best = this.world.score;
      try { localStorage.setItem(STORAGE_KEY, String(this.best)); } catch (_) { /* ignore */ }
    }
  }

  update(dt) {
    this.time += dt;
    if (this.state === STATES.TITLE) {
      if (wasPressed('enter') || wasPressed('space') || wasPressed('mouse')) this.startRun();
      return;
    }
    if (this.state === STATES.OVER) {
      this.overTimer += dt;
      if (this.overTimer > 0.6 && (wasPressed('r') || wasPressed('enter') || wasPressed('space') || wasPressed('mouse'))) this.startRun();
      return;
    }
    if (this.state === STATES.PAUSED) {
      if (wasPressed('p') || wasPressed('escape')) { this.state = STATES.PLAYING; sfx.click(); }
      if (wasPressed('r')) this.startRun();
      return;
    }
    // PLAYING
    if (wasPressed('p') || wasPressed('escape')) { this.state = STATES.PAUSED; sfx.click(); return; }
    if (wasPressed('m')) toggleMute();
    if (wasPressed('e')) this.world.bomb(this.player);
    if (wasPressed('r')) { this.startRun(); return; }

    const p = this.player;
    if (this.bannerTimer > 0) this.bannerTimer -= dt;

    // Movement.
    const ax = axis();
    p.vx += ax.x * PLAYER.accel * dt;
    p.vy += ax.y * PLAYER.accel * dt;
    p.vx *= Math.pow(PLAYER.drag, dt * 60);
    p.vy *= Math.pow(PLAYER.drag, dt * 60);
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > PLAYER.maxSpeed) { p.vx = (p.vx / sp) * PLAYER.maxSpeed; p.vy = (p.vy / sp) * PLAYER.maxSpeed; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.x = Math.max(20, Math.min(VIEW.W - 20, p.x));
    p.y = Math.max(20, Math.min(VIEW.H - 20, p.y));
    p.aimX = mouse.x; p.aimY = mouse.y;
    p.angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);
    p.thrust = Math.hypot(ax.x, ax.y) > 0 ? 1 : 0;

    // Dash.
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.dashTimer > 0) p.dashTimer -= dt;
    if (wasPressed('shift') && p.dashCd <= 0 && sp > 40) {
      p.dashTimer = PLAYER.dashTime;
      p.dashCd = PLAYER.dashCooldown;
      p.vx = (p.vx / sp) * PLAYER.dashSpeed;
      p.vy = (p.vy / sp) * PLAYER.dashSpeed;
      sfx.dash();
    }
    if (p.invuln > 0) p.invuln -= dt;
    if (p.spreadUntil > 0) p.spreadUntil -= dt;
    if (p.rapidUntil > 0) p.rapidUntil -= dt;

    // Firing.
    p.fireTimer -= dt;
    const firing = mouse.down || isDown('space');
    if (firing && p.fireTimer <= 0) {
      p.fireTimer = p.rapid ? PLAYER.fireRate * 0.55 : PLAYER.fireRate;
      this.world.fireBullet(p, p.spread);
      sfx.shoot();
    }

    this.world.update(dt, p, this);
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, VIEW.W, VIEW.H);
    const sx = this.world.shake > 0 ? (Math.random() - 0.5) * this.world.shake : 0;
    const sy = this.world.shake > 0 ? (Math.random() - 0.5) * this.world.shake : 0;
    ctx.translate(sx, sy);
    drawBackground(ctx, this.stars, this.time);
    if (this.state === STATES.TITLE) {
      drawTitle(ctx, this.best, this.time);
    } else {
      drawWorld(ctx, this.world, this.player);
      drawHUD(ctx, this.world, this.player, this.time);
      if (this.bannerTimer > 0) drawWaveBanner(ctx, this.bannerWave, 2.0 - this.bannerTimer);
      if (this.state === STATES.PAUSED) drawPaused(ctx);
      if (this.state === STATES.OVER) drawGameOver(ctx, this.world, this.best, this.isWin);
    }
    ctx.restore();
  }
}

function fitCanvas(canvas) {
  const scale = Math.min(window.innerWidth / VIEW.W, window.innerHeight / VIEW.H);
  canvas.style.width = `${Math.floor(VIEW.W * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.H * scale)}px`;
}

export function boot() {
  const canvas = document.getElementById('game');
  canvas.width = VIEW.W;
  canvas.height = VIEW.H;
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed') || 7);
  const game = new Game(canvas);
  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));

  const shot = params.get('shot');
  if (shot) {
    // Deterministic screenshot scenes (see shots.js).
    game.rng = mulberry32(seed);
    game.stars = makeStars(game.rng);
    game.world = seededWorld(seed);
    game.world.rng = game.rng;
    buildShotScene(game, shot, seed);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    game.update(dt);
    game.draw();
    endFrame();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return game;
}
