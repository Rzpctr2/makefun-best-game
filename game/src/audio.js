// LUMEN DRIFT — synthesized sound.
// Every sound is built with the Web Audio API: oscillators and filtered
// noise, no audio files, no network. Audio starts only after the first
// user gesture, as browsers require.
import { mulberry32 } from './entities.js';

// The explosion-noise buffer is generated from a fixed seed so the sound
// (like everything else in the game) is deterministic per run.
const noiseRng = mulberry32(99);

let ctx = null;
let muted = false;
let musicTimer = null;
let musicStep = 0;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function initAudio() {
  ac();
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}

function tone(freq, dur, type = 'square', vol = 0.12, slideTo = null, delay = 0) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, vol = 0.2, freq = 1200, delay = 0) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (noiseRng() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t0);
}

export const sfx = {
  shoot() { tone(880, 0.07, 'square', 0.05, 440); },
  enemyShoot() { tone(320, 0.09, 'sawtooth', 0.04, 180); },
  explode(size = 1) {
    noise(0.25 * size, 0.22, 900);
    tone(160, 0.22, 'sawtooth', 0.1, 40);
  },
  bigExplode() {
    noise(0.6, 0.3, 700);
    tone(120, 0.5, 'sawtooth', 0.14, 30);
    tone(60, 0.6, 'sine', 0.18, 24);
  },
  hit() {
    tone(220, 0.25, 'sawtooth', 0.16, 55);
    noise(0.2, 0.18, 600);
  },
  pickup() { tone(660, 0.08, 'sine', 0.1); tone(990, 0.1, 'sine', 0.1, null, 0.07); },
  powerup() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1, 'triangle', 0.09, null, i * 0.06)); },
  wave() { tone(392, 0.12, 'triangle', 0.1); tone(587, 0.16, 'triangle', 0.1, null, 0.1); },
  boss() { tone(98, 0.4, 'sawtooth', 0.14, 65); tone(147, 0.4, 'sawtooth', 0.1, 98, 0.15); },
  click() { tone(1200, 0.04, 'sine', 0.07); },
  dash() { noise(0.12, 0.1, 2400); },
  deflect() { tone(1568, 0.09, 'sine', 0.1, 2093); tone(2093, 0.07, 'sine', 0.06, null, 0.04); },
  upgrade() { [392, 523, 659].forEach((f, i) => tone(f, 0.12, 'triangle', 0.09, null, i * 0.07)); },
  synergy() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.14, 'triangle', 0.09, null, i * 0.06)); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.16, 'triangle', 0.1, null, i * 0.09)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, null, i * 0.14)); },
};

// A quiet pulsing bass line under the action. Cheap, moody, optional.
const BASS = [55, 0, 55, 65.4, 55, 0, 49, 58.3];
export function startMusic() {
  if (musicTimer) return;
  musicStep = 0;
  musicTimer = setInterval(() => {
    if (muted) return;
    const f = BASS[musicStep % BASS.length];
    musicStep++;
    if (f) tone(f, 0.42, 'triangle', 0.05);
  }, 300);
}

export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
