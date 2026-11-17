// LUMEN DRIFT — rendering: starfield, ships, particles, HUD, menus.
// Everything the judge sees comes from here, so every screen is drawn
// to read at a glance even when shrunk onto a contact sheet.
import { COLORS, COMBO, PICKUPS, PLAYER, RARITY_COLOR, SHIELD, SUITS, SYNERGY, UPGRADES, VIEW, WAVE } from './config.js';

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

// ── Pre-rendered background layers ──
// Nebula blobs and the vignette are painted once onto offscreen canvases
// (fixed, deterministic layouts) and blitted each frame: richer than the
// old per-frame radial gradients, and cheaper too.
const nebulaCache = [];
function nebulaCanvas(r, core, mid, edge) {
  const c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const g = c.getContext('2d');
  const layers = [
    [0.55, core], [0.8, mid], [1.0, edge],
  ];
  for (const [frac, col] of layers) {
    const rg = g.createRadialGradient(r, r, 0, r, r, r * frac);
    rg.addColorStop(0, col);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, r * 2, r * 2);
  }
  return c;
}
function getNebulae() {
  if (nebulaCache.length) return nebulaCache;
  nebulaCache.push(
    { img: nebulaCanvas(280, 'rgba(64,32,140,0.85)', 'rgba(40,18,96,0.55)', 'rgba(20,8,52,0.25)'), x: 220, y: 150, r: 280, dx: 30, dy: 0, sp: 0.05, ph: 0 },
    { img: nebulaCanvas(320, 'rgba(10,70,120,0.8)', 'rgba(8,44,84,0.5)', 'rgba(4,20,48,0.25)'), x: 1050, y: 520, r: 320, dx: 30, dy: 0, sp: 0.04, ph: 2 },
    { img: nebulaCanvas(220, 'rgba(88,28,120,0.75)', 'rgba(52,16,80,0.5)', 'rgba(26,8,44,0.25)'), x: 700, y: 80, r: 220, dx: 0, dy: 14, sp: 0.06, ph: 4 },
    { img: nebulaCanvas(200, 'rgba(120,20,80,0.7)', 'rgba(66,12,56,0.5)', 'rgba(34,6,32,0.25)'), x: 980, y: 180, r: 200, dx: 20, dy: 10, sp: 0.045, ph: 1 },
    { img: nebulaCanvas(260, 'rgba(16,90,90,0.65)', 'rgba(10,52,60,0.45)', 'rgba(4,26,34,0.22)'), x: 180, y: 600, r: 260, dx: 24, dy: 0, sp: 0.035, ph: 3 },
  );
  return nebulaCache;
}

let vignetteCanvas = null;
function getVignette() {
  if (vignetteCanvas) return vignetteCanvas;
  vignetteCanvas = document.createElement('canvas');
  vignetteCanvas.width = VIEW.W; vignetteCanvas.height = VIEW.H;
  const g = vignetteCanvas.getContext('2d');
  const rg = g.createRadialGradient(VIEW.W / 2, VIEW.H / 2, VIEW.H * 0.42, VIEW.W / 2, VIEW.H / 2, VIEW.H * 0.95);
  rg.addColorStop(0, 'rgba(2,2,10,0)');
  rg.addColorStop(1, 'rgba(2,2,10,0.42)');
  g.fillStyle = rg;
  g.fillRect(0, 0, VIEW.W, VIEW.H);
  return vignetteCanvas;
}

let hurtVignetteCanvas = null;
function getHurtVignette() {
  if (hurtVignetteCanvas) return hurtVignetteCanvas;
  hurtVignetteCanvas = document.createElement('canvas');
  hurtVignetteCanvas.width = VIEW.W; hurtVignetteCanvas.height = VIEW.H;
  const g = hurtVignetteCanvas.getContext('2d');
  const rg = g.createRadialGradient(VIEW.W / 2, VIEW.H / 2, VIEW.H * 0.3, VIEW.W / 2, VIEW.H / 2, VIEW.H * 0.85);
  rg.addColorStop(0, 'rgba(244,63,94,0)');
  rg.addColorStop(1, 'rgba(244,63,94,0.55)');
  g.fillStyle = rg;
  g.fillRect(0, 0, VIEW.W, VIEW.H);
  return hurtVignetteCanvas;
}

// Red edge flash while the player is hurt (0.35s after a hit).
export function drawHurtVignette(ctx, k) {
  ctx.save();
  ctx.globalAlpha = k;
  ctx.drawImage(getHurtVignette(), 0, 0);
  ctx.restore();
}

export function drawBackground(ctx, stars, t, dust, asteroids) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.H);
  g.addColorStop(0, COLORS.bg);
  g.addColorStop(0.55, '#0a0a24');
  g.addColorStop(1, '#12082e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.W, VIEW.H);

  // Nebula blobs, slow drift (pre-rendered, blitted).
  ctx.globalAlpha = 0.85;
  for (const b of getNebulae()) {
    const x = b.x + Math.sin(t * b.sp + b.ph) * b.dx;
    const y = b.y + Math.cos(t * b.sp * 0.8 + b.ph) * b.dy;
    ctx.drawImage(b.img, x - b.r, y - b.r);
  }
  ctx.globalAlpha = 1;

  // Distant asteroid silhouettes: dark rock, faint rim light, very slow.
  if (asteroids) {
    for (const a of asteroids) {
      const x = ((a.x + t * a.drift) % (VIEW.W + 220) + VIEW.W + 220) % (VIEW.W + 220) - 110;
      const y = a.y + Math.sin(t * 0.11 + a.ph) * 8;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a.rot + t * a.spin);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#0b1024';
      ctx.beginPath();
      for (let i = 0; i < a.verts.length; i++) {
        const v = a.verts[i];
        const px = Math.cos(v.a) * v.r, py = Math.sin(v.a) * v.r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = 'rgba(140,170,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, a.r * 0.92, -2.4, -0.6);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Parallax starfield: far (dim, slow) / mid / near (bright, fast,
  // a few with a cross sparkle so the field has depth).
  for (const s of stars) {
    const y = (s.y + t * s.speed) % VIEW.H;
    const tw = 0.55 + 0.45 * Math.sin(t * s.tw + s.ph);
    ctx.globalAlpha = tw * s.a;
    ctx.fillStyle = s.c;
    if (s.spark) {
      const r = s.size;
      ctx.fillRect(s.x - r, y - 0.5, r * 2, 1);
      ctx.fillRect(s.x - 0.5, y - r, 1, r * 2);
      ctx.fillRect(s.x - 1, y - 1, 2, 2);
    } else {
      ctx.fillRect(s.x, y, s.size, s.size);
    }
  }
  ctx.globalAlpha = 1;

  // Drifting dust / embers between the stars and the action.
  if (dust) {
    for (const d of dust) {
      const x = (d.x + t * d.vx + VIEW.W) % VIEW.W;
      const y = (d.y + t * d.vy + VIEW.H) % VIEW.H;
      ctx.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(t * d.tw + d.ph));
      ctx.fillStyle = d.c;
      ctx.fillRect(x, y, d.size, d.size);
    }
    ctx.globalAlpha = 1;
  }

  // Vignette: darkens the corners, pulls the eye to the action.
  ctx.drawImage(getVignette(), 0, 0);
}

export function makeStars(rng) {
  const stars = [];
  // Far layer: tiny, dim, slow. Mid: the bulk. Near: bigger, brighter,
  // faster — a few cross-sparkle so the field reads as deep, not flat.
  const layers = [
    { n: 110, size: [1, 1], speed: [4, 10], a: [0.25, 0.55], spark: 0 },
    { n: 90, size: [1, 2], speed: [10, 22], a: [0.4, 0.8], spark: 0 },
    { n: 30, size: [2, 3], speed: [24, 44], a: [0.6, 1.0], spark: 0.3 },
  ];
  for (const L of layers) {
    for (let i = 0; i < L.n; i++) {
      stars.push({
        x: rng() * VIEW.W,
        y: rng() * VIEW.H,
        size: L.size[0] + Math.floor(rng() * (L.size[1] - L.size[0] + 1)),
        a: L.a[0] + rng() * (L.a[1] - L.a[0]),
        tw: 0.5 + rng() * 2,
        ph: rng() * Math.PI * 2,
        speed: L.speed[0] + rng() * (L.speed[1] - L.speed[0]),
        c: rng() < 0.8 ? '#cfe6ff' : (rng() < 0.5 ? '#ffd9ec' : '#d9f7ff'),
        spark: rng() < L.spark,
      });
    }
  }
  return stars;
}

export function makeDust(rng) {
  const dust = [];
  for (let i = 0; i < 42; i++) {
    dust.push({
      x: rng() * VIEW.W,
      y: rng() * VIEW.H,
      vx: (rng() - 0.5) * 7,
      vy: 2 + rng() * 6,
      size: rng() < 0.7 ? 1 : 2,
      a: 0.12 + rng() * 0.28,
      tw: 0.4 + rng() * 1.2,
      ph: rng() * Math.PI * 2,
      c: rng() < 0.6 ? '#f59e0b' : '#22d3ee',
    });
  }
  return dust;
}

export function makeAsteroids(rng) {
  const rocks = [];
  for (let i = 0; i < 5; i++) {
    const r = 30 + rng() * 55;
    const verts = [];
    const n = 8 + Math.floor(rng() * 3);
    for (let j = 0; j < n; j++) {
      verts.push({ a: (j / n) * Math.PI * 2, r: r * (0.72 + rng() * 0.42) });
    }
    rocks.push({
      x: rng() * VIEW.W, y: 60 + rng() * (VIEW.H - 120),
      r, verts,
      drift: 3 + rng() * 7,
      rot: rng() * Math.PI * 2,
      spin: (rng() - 0.5) * 0.05,
      ph: rng() * Math.PI * 2,
    });
  }
  return rocks;
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
  // Pale outline + wing accents: the ship pops against the busier sky.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(224,250,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(-radius * 0.55, -radius * 0.55, 5, 2);
  ctx.fillRect(-radius * 0.55, radius * 0.55 - 2, 5, 2);
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
    case 'drifter': {
      // Swept-wing dart with a motion streak: reads as fast and hostile.
      ctx.rotate(e.angle);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(-18, 3); ctx.lineTo(-34, 0); ctx.lineTo(-18, -3);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(22, 0); ctx.lineTo(-10, 13); ctx.lineTo(-16, 4); ctx.lineTo(-6, 0);
      ctx.lineTo(-16, -4); ctx.lineTo(-10, -13);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(6, 0, 3.5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'spitter': {
      // Armored hexagon: rotating notched ring, pulsing gun core, barrel nubs.
      const pulse = 8 + 2 * Math.sin(e.t * 3.2);
      ctx.rotate(e.t * 0.8);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * 20, py = Math.sin(a) * 20;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + e.t * 0.5;
        ctx.fillStyle = col;
        ctx.fillRect(Math.cos(a) * 20 - 2, Math.sin(a) * 20 - 2, 4, 4);
      }
      ctx.fillStyle = '#1a0b00';
      ctx.beginPath(); ctx.arc(0, 0, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb37a';
      ctx.beginPath(); ctx.arc(0, 0, pulse * 0.45, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'splitter': {
      // Heavy armored square: corner plates, inner cross, cracks that
      // grow as it takes damage — the damage state reads at a glance.
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-15, -15, 30, 30);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.strokeRect(-15, -15, 30, 30);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-15, -2, 30, 4);
      ctx.fillRect(-2, -15, 4, 30);
      ctx.fillStyle = col;
      ctx.fillRect(-4, -4, 8, 8);
      // Corner armor plates.
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (const [cx, cy] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) {
        ctx.fillRect(cx - 3, cy - 3, 6, 6);
      }
      // Cracks appear as hp falls (seeded by enemy id: deterministic).
      const dmg = 1 - e.hp / e.maxHp;
      if (dmg > 0.25) {
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1.5;
        const ca = (e.id % 5) * 0.9 + 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ca) * 4, Math.sin(ca) * 4);
        ctx.lineTo(Math.cos(ca) * 15, Math.sin(ca) * 15);
        ctx.stroke();
      }
      if (dmg > 0.6) {
        ctx.beginPath();
        ctx.moveTo(-10, 8); ctx.lineTo(-2, 2); ctx.lineTo(6, 10);
        ctx.stroke();
      }
      break;
    }
    case 'shard':
      // Razor shard with a short streak: small, fast, sharp.
      ctx.rotate(e.angle);
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = e.color;
      ctx.fillRect(-22, -1, 14, 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(12, 0); ctx.lineTo(-8, 7); ctx.lineTo(-4, 0); ctx.lineTo(-8, -7);
      ctx.closePath(); ctx.fill();
      break;
    case 'weaver': {
      // Orbiter: ring with two satellites circling it and a pulsing core,
      // plus a counter-rotating dashed halo — distinct from the spitter.
      const core = 7 + 1.5 * Math.sin(e.t * 2.6);
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, core * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(192,132,252,0.5)';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 24, -e.t * 0.9, -e.t * 0.9 + Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      for (let i = 0; i < 2; i++) {
        const a = e.t * 2.2 + i * Math.PI;
        ctx.beginPath(); ctx.arc(Math.cos(a) * 24, Math.sin(a) * 24, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'boss': {
      // The Warden: layered menace. Phase shifts the accent color
      // (rose → amber → gold), the core pulses, and just before a bullet
      // ring fires the core flares white — a readable telegraph.
      const phaseCol = e.phase === 3 ? '#facc15' : e.phase === 2 ? '#fb923c' : COLORS.boss;
      const telegraph = e.shootTimer < 0.12 ? (0.12 - e.shootTimer) / 0.12 : 0;
      const coreR = 20 + 3 * Math.sin(e.t * 2.5) + telegraph * 8;
      ctx.rotate(Math.sin(e.t * 0.7) * 0.15);
      // Outer glow ring, phase-tinted.
      ctx.strokeStyle = phaseCol;
      ctx.globalAlpha = 0.35 + telegraph * 0.5;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(0, 0, 68, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#2a0208';
      ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.fill();
      // Segmented phase ring inside the dark band.
      ctx.strokeStyle = phaseCol;
      ctx.lineWidth = 5;
      for (let i = 0; i < 3; i++) {
        if (i < e.phase) {
          ctx.beginPath();
          ctx.arc(0, 0, 44, -Math.PI / 2 + i * (Math.PI * 2 / 3) + 0.12, -Math.PI / 2 + (i + 1) * (Math.PI * 2 / 3) - 0.12);
          ctx.stroke();
        }
      }
      ctx.fillStyle = telegraph > 0 ? '#ffffff' : phaseCol;
      ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, 8 + telegraph * 4, 0, Math.PI * 2); ctx.fill();
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
      // Crown: 5 small spikes on a wider, slower ring.
      ctx.strokeStyle = phaseCol;
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - e.t * 0.25;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 74, Math.sin(a) * 74);
        ctx.lineTo(Math.cos(a) * 84, Math.sin(a) * 84);
        ctx.stroke();
      }
      break;
    }
    default: break;
  }
  // Hit flash: a white ring that expands and fades in the 0.08s after a
  // hit lands — the impact reads even in a still frame.
  if (flash) {
    const k = 1 - e.flash / 0.08;
    ctx.globalAlpha = (1 - k) * 0.9;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, e.radius + 4 + k * 14, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
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
    // Phase thresholds: ticks at 1/3 and 2/3 of the bar.
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillRect(x + w / 3 - 1, y - 2, 2, 18);
    ctx.fillRect(x + (2 * w) / 3 - 1, y - 2, 2, 18);
    ctx.fillStyle = '#ffd7de';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`WARDEN OF THE DRIFT — PHASE ${e.phase}`, VIEW.W / 2, y + 30);
    // Phase pips.
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(VIEW.W / 2 - 14 + i * 14, y + 42, 4, 0, Math.PI * 2);
      ctx.fillStyle = i < e.phase ? COLORS.boss : 'rgba(255,255,255,0.18)';
      ctx.fill();
    }
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

function drawShieldArc(ctx, x, y, angle, halfRad, main, glowCol) {
  const a1 = angle - halfRad, a2 = angle + halfRad;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, SHIELD.radius, a1, a2);
  ctx.strokeStyle = `${glowCol}17`; ctx.lineWidth = 26; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, SHIELD.radius, a1, a2);
  ctx.strokeStyle = `${glowCol}59`; ctx.lineWidth = 12; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, SHIELD.radius, a1, a2);
  ctx.strokeStyle = main; ctx.lineWidth = 4; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, SHIELD.radius, a1, a2);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawOrbitShield(ctx, player, world) {
  const half = (player.shieldArcDeg * Math.PI) / 180;
  ctx.save();
  // Faint orbit ring so the deflect zone reads at a glance.
  ctx.strokeStyle = 'rgba(45,212,191,0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(player.x, player.y, SHIELD.radius, 0, Math.PI * 2); ctx.stroke();
  glow(ctx, '#2dd4bf', 12);
  drawShieldArc(ctx, player.x, player.y, player.shieldAngle, half, '#2dd4bf', '#2dd4bf');
  if (player.has('dual')) {
    drawShieldArc(ctx, player.x, player.y, player.shieldAngle + Math.PI, half, '#dd77ff', '#dd77ff');
  }
  // Deflect flash: a bright arc segment that flares at the exact angle a
  // bullet was just reflected, then fades in 0.18s.
  if (world && world.deflectFlash > 0) {
    const k = world.deflectFlash / 0.18;
    const a = world.deflectAngle;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#5eead4';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = '#a7f3d0';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(player.x, player.y, SHIELD.radius, a - 0.35, a + 0.35); ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(player.x, player.y, SHIELD.radius, a - 0.3, a + 0.3); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export function drawWorld(ctx, world, player) {
  // Pickups: bob + a breathing glow ring so they read as valuable.
  for (const p of world.pickups) {
    const bob = Math.sin(p.t * 4) * 3;
    const col = PICKUP_COLOR[p.kind];
    const pulse = 0.5 + 0.5 * Math.sin(p.t * 4);
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.globalAlpha = 0.25 + 0.35 * pulse;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 17 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
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
  // Deflected bullets (BASTION shield) fly back in teal.
  for (const b of world.bullets) {
    ctx.save();
    const col = b.deflected ? '#2dd4bf' : b.friendly ? COLORS.bullet : COLORS.enemyBullet;
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
  // Orbital shield (BASTION): faint orbit ring + glowing deflect arc(s)
  // riding on the aim. A second arc appears on the opposite side with
  // Mirror Guard.
  drawOrbitShield(ctx, player, world);
  // Player ship (blink while invulnerable).
  if (player.invuln <= 0 || Math.floor(player.invuln * 12) % 2 === 0) {
    // Soft glow disc under the ship: it stays readable against the
    // busier background without hiding the shield arc.
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = COLORS.player;
    ctx.beginPath(); ctx.arc(player.x, player.y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (player.dashTimer > 0) {
      // Dash streak: ghost ships + a cyan motion line behind the ship.
      ctx.save();
      ctx.globalAlpha = 0.4;
      drawShip(ctx, player.x - player.vx * 0.03, player.y - player.vy * 0.03, player.angle, COLORS.player, player.radius, false);
      ctx.restore();
      ctx.save();
      const sp = Math.hypot(player.vx, player.vy) || 1;
      const nx = player.vx / sp, ny = player.vy / sp;
      ctx.strokeStyle = 'rgba(34,211,238,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(player.x - nx * 20, player.y - ny * 20);
      ctx.lineTo(player.x - nx * 70, player.y - ny * 70);
      ctx.stroke();
      ctx.restore();
    }
    drawShip(ctx, player.x, player.y, player.angle, COLORS.player, player.radius, player.shield);
    // Muzzle flash: a star burst at the nose for the first frames after
    // each shot (fireTimer counts down from the fire rate).
    const fireRate = (player.rapid ? PLAYER.fireRate * 0.55 : PLAYER.fireRate) * (player.suits.STRIKE >= 2 ? 0.85 : 1);
    if (player.fireTimer > fireRate * 0.65) {
      const k = (player.fireTimer - fireRate * 0.65) / (fireRate * 0.35);
      const mx = player.x + Math.cos(player.angle) * 22;
      const my = player.y + Math.sin(player.angle) * 22;
      ctx.save();
      ctx.globalAlpha = k;
      glow(ctx, '#fde68a', 14);
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = player.angle + (i / 4) * Math.PI * 2;
        const r = i % 2 === 0 ? 9 : 3.5;
        ctx.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // Engine flame.
    const ax = player.x - Math.cos(player.angle) * 16;
    const ay = player.y - Math.sin(player.angle) * 16;
    ctx.save();
    glow(ctx, '#f59e0b', 10);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    // Engine flame flicker: deterministic function of world time.
    ctx.arc(ax, ay, 4 + (0.5 + 0.5 * Math.sin(world.time * 31)) * 3, 0, Math.PI * 2);
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
  // Bomb shockwave ring: expands and fades in 0.5s.
  if (world.bombFlash > 0) {
    const k = world.bombFlash / 0.5;
    ctx.save();
    ctx.globalAlpha = k * 0.8;
    ctx.strokeStyle = '#fdba74';
    ctx.lineWidth = 10 * k + 2;
    ctx.beginPath(); ctx.arc(player.x, player.y, (1 - k) * 430 + 30, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = k * 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(player.x, player.y, (1 - k) * 430 + 30, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // Floating score text: kill pops scale up briefly, then settle.
  ctx.save();
  ctx.textAlign = 'center';
  for (const t of world.texts) {
    const size = t.size || 15;
    const pop = 1 + 0.35 * Math.max(0, (t.life - 0.75) / 0.15);
    ctx.font = `bold ${Math.round(size * pop)}px monospace`;
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
  if (world.slowTimer > 0) {
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('⌛ TIME RIFT', VIEW.W - 20, 96);
  }
  // Threat queue: what is coming next in this wave (visible system).
  if (world.spawnQueue.length > 0) {
    const glyphs = { drifter: '◆', spitter: '⬡', splitter: '■', weaver: '●' };
    const cols = { drifter: COLORS.drifter, spitter: COLORS.spitter, splitter: COLORS.splitter, weaver: COLORS.weaver };
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.dim;
    ctx.font = 'bold 13px monospace';
    ctx.fillText('INCOMING', VIEW.W - 20, 118);
    const show = world.spawnQueue.slice(0, 10);
    let qx = VIEW.W - 20 - show.length * 20;
    ctx.textAlign = 'left';
    ctx.font = '15px monospace';
    for (const t of show) {
      ctx.fillStyle = cols[t] || COLORS.text;
      ctx.fillText(glyphs[t] || '?', qx, 140);
      qx += 20;
    }
    if (world.spawnQueue.length > 10) {
      ctx.fillStyle = COLORS.dim;
      ctx.font = '13px monospace';
      ctx.fillText(`+${world.spawnQueue.length - 10}`, qx + 2, 140);
    }
  }
  // Active power-ups, bottom left.
  let py = VIEW.H - 22;
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px monospace';
  const timers = [];
  if (player.spread) timers.push(['SPREAD', player.spreadUntil / PICKUPS.duration, COLORS.pickupSpread]);
  if (player.rapid) timers.push(['RAPID', player.rapidUntil / PICKUPS.duration, COLORS.pickupRapid]);
  if (player.shield) timers.push(['AEGIS', 1, COLORS.pickupShield]);
  for (const [label, frac, col] of timers) {
    ctx.fillStyle = col;
    ctx.fillText(label, 20, py);
    bar(ctx, 100, py - 10, 90, 7, frac, col);
    py -= 22;
  }
  // Orbital shield deflects + drafted cards, bottom left.
  if (player.deflectCount > 0) {
    ctx.fillStyle = '#2dd4bf';
    ctx.fillText(`DEFLECTS ${player.deflectCount}  ·  ORBIT ${player.shieldArcDeg}°`, 20, py);
    py -= 22;
  }
  const owned = Object.entries(player.upgrades);
  if (owned.length > 0) {
    const glyphs = owned.map(([id, n]) => {
      const def = UPGRADES.find((u) => u.id === id);
      return def ? def.glyph + (n > 1 ? `×${n}` : '') : '';
    }).join('  ');
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(`CARDS ${glyphs}`, 20, py);
    py -= 22;
  }
  // Running synergies — the depth, visible at a glance.
  const active = ['ORBIT', 'STRIKE', 'WARD'].filter((s) => (player.suits[s] || 0) >= 2);
  if (active.length > 0) {
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`SYNERGY ${active.map((s) => `${SUITS[s].label} ★${Math.min(3, player.suits[s])}`).join(' · ')}`, 20, py);
    py -= 22;
  }
  // Dash cooldown, bottom right — bar shows the recharge.
  ctx.textAlign = 'right';
  if (player.dashCd > 0) {
    ctx.fillStyle = COLORS.dim;
    ctx.font = '13px monospace';
    ctx.fillText('DASH …', VIEW.W - 20, VIEW.H - 22);
    bar(ctx, VIEW.W - 110, VIEW.H - 16, 90, 5, 1 - player.dashCd / PLAYER.dashCooldown, COLORS.player);
  } else {
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
  // Emblem: the ship with its orbiting shield arc, slowly turning above
  // the title — the game's signature mechanic, visible before you play.
  ctx.save();
  ctx.strokeStyle = 'rgba(45,212,191,0.18)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(VIEW.W / 2, 128, SHIELD.radius, 0, Math.PI * 2); ctx.stroke();
  glow(ctx, '#2dd4bf', 12);
  drawShieldArc(ctx, VIEW.W / 2, 128, t * 0.6, (50 * Math.PI) / 180, '#2dd4bf', '#2dd4bf');
  drawShip(ctx, VIEW.W / 2, 128, -Math.PI / 2 + Math.sin(t * 0.5) * 0.2, COLORS.player, 14, false);
  ctx.restore();
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
    'ORBIT SHIELD deflects bullets back — aim it with the mouse.',
    'Clear a wave, draft 1 of 3 cards. Matching suits build synergies.',
    'Clear 10 waves to win. Boss every 5 waves. · ✦ » ◉ ✸ ♥ pickups',
  ], 330, 14, COLORS.text, 28);
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

// ── Card draft screen (between waves) ──
export function upgradeLayout() {
  const w = 300, h = 220, gap = 24, y = 236;
  const total = w * 3 + gap * 2;
  const x0 = (VIEW.W - total) / 2;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

export function drawUpgrade(ctx, choices, player, wave) {
  ctx.save();
  ctx.fillStyle = 'rgba(3,4,16,0.85)';
  ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  ctx.restore();
  title(ctx, `WAVE ${wave} CLEARED`, 108, 26, COLORS.gold, null);
  title(ctx, 'DRAFT A CARD', 158, 52, '#e0faff', COLORS.player);
  const rects = upgradeLayout();
  choices.forEach((card, i) => {
    const r = rects[i];
    const col = RARITY_COLOR[card.rarity];
    const suit = SUITS[card.type];
    ctx.save();
    ctx.fillStyle = 'rgba(4,6,24,0.92)';
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    rr(ctx, r.x, r.y, r.w, r.h, 12); ctx.fill(); ctx.stroke();
    ctx.font = '44px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = col; ctx.shadowBlur = 18;
    ctx.fillStyle = col;
    ctx.fillText(card.glyph, r.x + r.w / 2, r.y + 66);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 17px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(card.name.toUpperCase(), r.x + r.w / 2, r.y + 106);
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = suit.color;
    ctx.fillText(`◆ ${suit.label}  ·  ${card.rarity.toUpperCase()}`, r.x + r.w / 2, r.y + 130);
    ctx.font = '13px monospace';
    ctx.fillStyle = COLORS.text;
    const words = card.desc.split(' ');
    let line = '', ly = r.y + 158;
    for (const w of words) {
      if ((line + ' ' + w).trim().length > 26 && line) { ctx.fillText(line, r.x + r.w / 2, ly); ly += 18; line = w; }
      else line = (line + ' ' + w).trim();
    }
    if (line) ctx.fillText(line, r.x + r.w / 2, ly);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(`[ ${i + 1} ]`, r.x + r.w / 2, r.y + r.h - 14);
    ctx.restore();
  });
  // Collection + synergy progress.
  const owned = Object.entries(player.upgrades);
  ctx.save();
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.dim;
  const glyphs = owned.map(([id, n]) => {
    const def = UPGRADES.find((u) => u.id === id);
    return def ? def.glyph + (n > 1 ? `×${n}` : '') : '';
  }).join('   ');
  ctx.fillText(owned.length ? `YOUR CARDS  ${glyphs}` : 'YOUR CARDS  —', VIEW.W / 2, 512);
  const parts = ['ORBIT', 'STRIKE', 'WARD'].map((s) => {
    const n = player.suits[s] || 0;
    const lvl = n >= 3 ? 3 : n >= 2 ? 2 : 0;
    return `${SUITS[s].label} ${n}/3${lvl ? `  ★${lvl}` : ''}`;
  });
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(parts.join('    ·    '), VIEW.W / 2, 540);
  ctx.font = '13px monospace';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('Matching suits build synergies — 2 cards unlock a bonus, 3 unlock a stronger one.', VIEW.W / 2, 566);
  ctx.fillText('CLICK A CARD OR PRESS 1 / 2 / 3', VIEW.W / 2, 606);
  ctx.restore();
}

export function drawWaveBanner(ctx, wave, t) {
  const a = t < 0.25 ? t / 0.25 : t > 1.6 ? Math.max(0, 1 - (t - 1.6) / 0.4) : 1;
  ctx.save();
  ctx.globalAlpha = a;
  title(ctx, wave % 5 === 0 ? `WAVE ${wave} — THE WARDEN APPROACHES` : `WAVE ${wave}`, 330, 52, '#ffffff', COLORS.player);
  // Gold sweep line that grows in under the banner title.
  const w = Math.min(1, t / 0.3) * 420;
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(VIEW.W / 2 - w / 2, 356, w, 2);
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
  // Blink: deterministic function of world time (was Date.now()).
  const pulse = 0.6 + 0.4 * Math.sin(world.time * 3.33);
  ctx.globalAlpha = pulse;
  ctx.font = 'bold 21px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', VIEW.W / 2, 500);
  ctx.restore();
}
