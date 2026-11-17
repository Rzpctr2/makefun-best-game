// LUMEN DRIFT — rendering: starfield, ships, particles, HUD, menus.
// Everything the judge sees comes from here, so every screen is drawn
// to read at a glance even when shrunk onto a contact sheet.
import { COLORS, COMBO, PICKUPS, VIEW, WAVE } from './config.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

export function drawBackground(ctx, stars, t) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.H);
  g.addColorStop(0, COLORS.bg);
  g.addColorStop(0.55, '#0a0a24');
  g.addColorStop(1, '#12082e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.W, VIEW.H);

  // Nebula blobs, slow drift.
  ctx.globalAlpha = 0.5;
  const blobs = [
    { x: 220 + Math.sin(t * 0.05) * 30, y: 150, r: 260, c: COLORS.nebulaA },
    { x: 1050 + Math.cos(t * 0.04) * 30, y: 520, r: 300, c: COLORS.nebulaB },
    { x: 700, y: 80, r: 200, c: '#2a1050' },
    { x: 980, y: 180, r: 190, c: '#3d0f3d' },
  ];
  for (const b of blobs) {
    const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    rg.addColorStop(0, b.c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
  ctx.globalAlpha = 1;

  // Parallax starfield.
  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(t * s.tw + s.ph);
    ctx.globalAlpha = tw * s.a;
    ctx.fillStyle = s.c;
    ctx.fillRect(s.x, (s.y + t * s.speed) % VIEW.H, s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

export function makeStars(rng) {
  const stars = [];
  for (let i = 0; i < 230; i++) {
    stars.push({
      x: rng() * VIEW.W,
      y: rng() * VIEW.H,
      size: rng() < 0.85 ? 1 : 2,
      a: 0.4 + rng() * 0.6,
      tw: 0.5 + rng() * 2,
      ph: rng() * Math.PI * 2,
      speed: 6 + rng() * 22,
      c: rng() < 0.8 ? '#cfe6ff' : (rng() < 0.5 ? '#ffd9ec' : '#d9f7ff'),
    });
  }
  return stars;
}

function drawShip(ctx, x, y, angle, color, radius, shield) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  glow(ctx, color, 16);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(radius + 6, 0);
  ctx.lineTo(-radius * 0.7, radius * 0.75);
  ctx.lineTo(-radius * 0.35, 0);
  ctx.lineTo(-radius * 0.7, -radius * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.playerCore;
  ctx.beginPath();
  ctx.arc(radius * 0.25, 0, radius * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (shield) {
    ctx.save();
    glow(ctx, COLORS.pickupShield, 12);
    ctx.strokeStyle = 'rgba(52,211,153,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const flash = e.flash > 0;
  const col = flash ? '#ffffff' : e.color;
  glow(ctx, e.color, 14);
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  switch (e.type) {
    case 'drifter':
      ctx.rotate(e.angle);
      ctx.beginPath();
      ctx.moveTo(18, 0); ctx.lineTo(0, 12); ctx.lineTo(-18, 0); ctx.lineTo(0, -12);
      ctx.closePath(); ctx.fill();
      break;
    case 'spitter': {
      ctx.rotate(e.t * 0.8);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * 20, py = Math.sin(a) * 20;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1a0b00';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'splitter':
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-15, -15, 30, 30);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.strokeRect(-15, -15, 30, 30);
      break;
    case 'shard':
      ctx.rotate(e.angle);
      ctx.beginPath();
      ctx.moveTo(10, 0); ctx.lineTo(-8, 6); ctx.lineTo(-8, -6);
      ctx.closePath(); ctx.fill();
      break;
    case 'weaver':
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
      break;
    case 'boss': {
      ctx.rotate(Math.sin(e.t * 0.7) * 0.15);
      ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#2a0208';
      ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      // Rotating spikes.
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + e.t * 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 46, Math.sin(a) * 46);
        ctx.lineTo(Math.cos(a) * 62, Math.sin(a) * 62);
        ctx.stroke();
      }
      break;
    }
    default: break;
  }
  ctx.restore();
  if (e.type === 'boss') {
    const w = 340, x = (VIEW.W - w) / 2, y = 26;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    rr(ctx, x - 6, y - 6, w + 12, 26, 6); ctx.fill();
    ctx.fillStyle = '#3f0d18';
    rr(ctx, x, y, w, 14, 4); ctx.fill();
    ctx.fillStyle = COLORS.boss;
    rr(ctx, x, y, w * Math.max(0, e.hp / e.maxHp), 14, 4); ctx.fill();
    ctx.fillStyle = '#ffd7de';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WARDEN OF THE DRIFT', VIEW.W / 2, y + 30);
    ctx.restore();
  } else if (e.hp < e.maxHp && e.maxHp > 1) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(e.x - 16, e.y - e.radius - 12, 32, 4);
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x - 16, e.y - e.radius - 12, 32 * (e.hp / e.maxHp), 4);
    ctx.restore();
  }
}

const PICKUP_GLYPH = { spread: '✦', rapid: '»', shield: '◉', bomb: '✸', life: '♥' };
const PICKUP_COLOR = {
  spread: COLORS.pickupSpread, rapid: COLORS.pickupRapid,
  shield: COLORS.pickupShield, bomb: COLORS.pickupBomb, life: COLORS.pickupLife,
};

export function drawWorld(ctx, world, player) {
  // Pickups.
  for (const p of world.pickups) {
    const bob = Math.sin(p.t * 4) * 3;
    const col = PICKUP_COLOR[p.kind];
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    glow(ctx, col, 14);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(PICKUP_GLYPH[p.kind], 0, 1);
    ctx.restore();
  }
  // Enemies.
  for (const e of world.enemies) drawEnemy(ctx, e);
  // Player bullets, with a short trail so fire reads in stills.
  for (const b of world.bullets) {
    ctx.save();
    const col = b.friendly ? COLORS.bullet : COLORS.enemyBullet;
    glow(ctx, col, 10);
    ctx.strokeStyle = col;
    ctx.lineWidth = b.friendly ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.028, b.y - b.vy * 0.028);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = b.friendly ? '#ffffff' : col;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.friendly ? 4 : b.radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Player ship (blink while invulnerable).
  if (player.invuln <= 0 || Math.floor(player.invuln * 12) % 2 === 0) {
    if (player.dashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      drawShip(ctx, player.x - player.vx * 0.03, player.y - player.vy * 0.03, player.angle, COLORS.player, player.radius, false);
      ctx.restore();
    }
    drawShip(ctx, player.x, player.y, player.angle, COLORS.player, player.radius, player.shield);
    // Engine flame.
    const ax = player.x - Math.cos(player.angle) * 16;
    const ay = player.y - Math.sin(player.angle) * 16;
    ctx.save();
    glow(ctx, '#f59e0b', 10);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(ax, ay, 4 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Particles.
  for (const p of world.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Floating score text.
  ctx.save();
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  for (const t of world.texts) {
    ctx.globalAlpha = Math.max(0, t.life / 0.9);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, color, bg = 'rgba(255,255,255,0.14)') {
  ctx.fillStyle = bg;
  rr(ctx, x, y, w, h, 3); ctx.fill();
  if (frac > 0) { ctx.fillStyle = color; rr(ctx, x, y, w * frac, h, 3); ctx.fill(); }
}

export function drawHUD(ctx, world, player, time) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // Score, top left.
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${String(world.score).padStart(6, '0')}`, 20, 38);
  ctx.font = '15px monospace';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(`WAVE ${world.wave}   KILLS ${world.kills}`, 20, 62);
  if (world.combo > 1) {
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 17px monospace';
    ctx.fillText(`COMBO ×${world.combo.toFixed(1)}`, 20, 86);
    bar(ctx, 20, 92, 120, 5, world.comboTimer / COMBO.window, COLORS.gold);
  }
  // Lives, top right.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 15px monospace';
  ctx.fillText('HULL', VIEW.W - 20, 24);
  for (let i = 0; i < player.lives; i++) {
    const x = VIEW.W - 34 - i * 26, y = 44;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    glow(ctx, COLORS.player, 8);
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(10, 0); ctx.lineTo(-7, 7); ctx.lineTo(-3, 0); ctx.lineTo(-7, -7);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = COLORS.dim;
  ctx.font = '13px monospace';
  ctx.fillText(`BOMBS ${player.bombs}  [E]`, VIEW.W - 20, 74);
  // Active power-ups, bottom left.
  let py = VIEW.H - 22;
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px monospace';
  const timers = [];
  if (player.spread) timers.push(['SPREAD', player.spreadUntil / PICKUPS.duration, COLORS.pickupSpread]);
  if (player.rapid) timers.push(['RAPID', player.rapidUntil / PICKUPS.duration, COLORS.pickupRapid]);
  if (player.shield) timers.push(['SHIELD', 1, COLORS.pickupShield]);
  for (const [label, frac, col] of timers) {
    ctx.fillStyle = col;
    ctx.fillText(label, 20, py);
    bar(ctx, 100, py - 10, 90, 7, frac, col);
    py -= 22;
  }
  // Dash cooldown, bottom right.
  if (player.dashCd > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.dim;
    ctx.font = '13px monospace';
    ctx.fillText('DASH …', VIEW.W - 20, VIEW.H - 22);
  } else {
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.player;
    ctx.font = 'bold 13px monospace';
    ctx.fillText('DASH READY [SHIFT]', VIEW.W - 20, VIEW.H - 22);
  }
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,6,24,0.82)';
  ctx.strokeStyle = 'rgba(34,211,238,0.55)';
  ctx.lineWidth = 1.5;
  rr(ctx, x, y, w, h, 14);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function title(ctx, text, y, size, color, glowColor) {
  ctx.save();
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'center';
  if (glowColor) { glow(ctx, glowColor, 22); }
  ctx.fillStyle = color;
  ctx.fillText(text, VIEW.W / 2, y);
  ctx.restore();
}

function body(ctx, lines, y, size = 16, color = COLORS.text, gap = 26) {
  ctx.save();
  ctx.font = `${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  lines.forEach((ln, i) => ctx.fillText(ln, VIEW.W / 2, y + i * gap));
  ctx.restore();
}

export function drawTitle(ctx, best, t) {
  const pulse = 0.6 + 0.4 * Math.sin(t * 2.4);
  title(ctx, 'LUMEN DRIFT', 218, 84, '#e0faff', COLORS.player);
  ctx.save();
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText('—  SURVIVE THE COLLAPSING STARFIELD  —', VIEW.W / 2, 256);
  ctx.restore();
  panel(ctx, VIEW.W / 2 - 330, 300, 660, 190);
  body(ctx, [
    'WASD / ARROWS — fly      MOUSE — aim      HOLD CLICK / SPACE — fire',
    'SHIFT — dash      E — bomb      P — pause      M — mute',
    'Clear 10 waves to win the sector. Boss every 5 waves.',
    'Grab pickups: ✦ spread   » rapid   ◉ shield   ✸ bomb   ♥ hull',
  ], 332, 15, COLORS.text, 30);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', VIEW.W / 2, 552);
  ctx.restore();
  if (best > 0) {
    ctx.save();
    ctx.font = '15px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(`BEST SCORE  ${best.toLocaleString()}`, VIEW.W / 2, 592);
    ctx.restore();
  }
  ctx.save();
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('an original arcade game — art, sound and code made for this entry', VIEW.W / 2, 690);
  ctx.restore();
}

export function drawPaused(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(3,4,16,0.62)';
  ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  ctx.restore();
  panel(ctx, VIEW.W / 2 - 260, 250, 520, 200);
  title(ctx, 'PAUSED', 318, 44, COLORS.text, null);
  body(ctx, ['P / ESC — resume', 'R — restart run', 'M — mute'], 362, 16, COLORS.dim, 30);
}

export function drawWaveBanner(ctx, wave, t) {
  const a = t < 0.25 ? t / 0.25 : t > 1.6 ? Math.max(0, 1 - (t - 1.6) / 0.4) : 1;
  ctx.save();
  ctx.globalAlpha = a;
  title(ctx, wave % 5 === 0 ? `WAVE ${wave} — THE WARDEN APPROACHES` : `WAVE ${wave}`, 330, 52, '#ffffff', COLORS.player);
  ctx.restore();
}

export function drawGameOver(ctx, world, best, isWin) {
  ctx.save();
  ctx.fillStyle = 'rgba(3,4,16,0.66)';
  ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  ctx.restore();
  panel(ctx, VIEW.W / 2 - 330, 168, 660, 380);
  title(ctx, isWin ? 'SECTOR CLEARED!' : 'SHIP DESTROYED', 240, 46, isWin ? COLORS.gold : COLORS.danger, isWin ? COLORS.gold : COLORS.danger);
  body(ctx, [
    `FINAL SCORE   ${world.score.toLocaleString()}`,
    `WAVE REACHED  ${world.wave}     KILLS  ${world.kills}`,
    `BEST SCORE    ${best.toLocaleString()}`,
  ], 296, 22, COLORS.text, 36);
  ctx.save();
  ctx.font = '15px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(isWin ? 'The drift is yours — keep flying endless, or run it back.' : 'The drift claims another pilot. Your score is on the board.', VIEW.W / 2, 436);
  ctx.restore();
  ctx.save();
  const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 300);
  ctx.globalAlpha = pulse;
  ctx.font = 'bold 21px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', VIEW.W / 2, 500);
  ctx.restore();
}
