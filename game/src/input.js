// LUMEN DRIFT — keyboard and mouse input.
// Tracks held keys, edge-triggered presses, and the mouse position in
// canvas coordinates. The game reads this, never raw DOM events.
import { VIEW } from './config.js';

const keys = new Set();
const pressed = new Set();

export const mouse = { x: VIEW.W / 2, y: VIEW.H / 2 - 120, down: false };

function keyName(e) {
  const k = e.key.toLowerCase();
  if (k === ' ') return 'space';
  return k;
}

export function bindInput(canvas) {
  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

  const toCanvas = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (VIEW.W / r.width),
      y: (clientY - r.top) * (VIEW.H / r.height),
    };
  };
  canvas.addEventListener('mousemove', (e) => {
    const p = toCanvas(e.clientX, e.clientY);
    mouse.x = p.x; mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (e) => {
    const p = toCanvas(e.clientX, e.clientY);
    mouse.x = p.x; mouse.y = p.y;
    mouse.down = true;
    pressed.add('mouse');
  });
  canvas.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function isDown(...names) {
  return names.some((n) => keys.has(n));
}

export function axis() {
  let x = 0, y = 0;
  if (isDown('a', 'arrowleft')) x -= 1;
  if (isDown('d', 'arrowright')) x += 1;
  if (isDown('w', 'arrowup')) y -= 1;
  if (isDown('s', 'arrowdown')) y += 1;
  if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  return { x, y };
}

// True once for the frame the key went down; call endFrame() each tick.
export function wasPressed(name) {
  return pressed.has(name);
}

export function endFrame() {
  pressed.clear();
}
