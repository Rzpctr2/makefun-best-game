// LUMEN DRIFT — configuration and tuning.
// One place for every number the game balances on, so tuning never
// means hunting through logic files.
export const VIEW = { W: 1280, H: 720 };

export const COLORS = {
  bg: '#050510',
  nebulaA: '#1b1040',
  nebulaB: '#0a2a4a',
  player: '#22d3ee',
  playerCore: '#e0faff',
  bullet: '#a5f3fc',
  enemyBullet: '#fb7185',
  drifter: '#f472b6',
  spitter: '#fb923c',
  splitter: '#4ade80',
  shard: '#86efac',
  weaver: '#c084fc',
  boss: '#f43f5e',
  pickupSpread: '#facc15',
  pickupRapid: '#38bdf8',
  pickupShield: '#34d399',
  pickupBomb: '#f97316',
  pickupLife: '#f472b6',
  text: '#e2f3ff',
  dim: '#7d8db3',
  danger: '#fb7185',
  gold: '#facc15',
};

export const PLAYER = {
  radius: 14,
  accel: 2400,
  maxSpeed: 420,
  drag: 0.88,
  fireRate: 0.14,
  bulletSpeed: 760,
  bulletRadius: 5,
  bulletDamage: 1,
  lives: 3,
  maxLives: 5,
  dashCooldown: 1.6,
  dashSpeed: 900,
  dashTime: 0.16,
  invulnTime: 2.0,
  pickupRadius: 26,
};

export const ENEMIES = {
  drifter: { hp: 2, speed: 95, radius: 18, score: 100, color: COLORS.drifter },
  spitter: { hp: 3, speed: 70, radius: 20, score: 150, color: COLORS.spitter, shootEvery: 2.1 },
  splitter: { hp: 4, speed: 80, radius: 22, score: 200, color: COLORS.splitter },
  shard: { hp: 1, speed: 210, radius: 10, score: 50, color: COLORS.shard },
  weaver: { hp: 3, speed: 130, radius: 16, score: 180, color: COLORS.weaver },
  boss: { hp: 220, speed: 55, radius: 64, score: 5000, color: COLORS.boss },
};

// Wave composition: budget of points; each enemy type costs points.
// Boss waves (every 5th) add the Warden on top.
export const WAVE = {
  baseBudget: 6,
  budgetPerWave: 3,
  cost: { drifter: 1, spitter: 2, splitter: 2, weaver: 2 },
  unlockWave: { drifter: 1, spitter: 2, splitter: 3, weaver: 4 },
  spawnGap: 0.9,
  gapMin: 0.35,
  clearBonus: 250,
  winWave: 10,
};

export const COMBO = { window: 3.0, step: 0.5, max: 8 };

export const PICKUPS = {
  dropChance: 0.14,
  lifeChance: 0.02,
  duration: 12,
  magnetRadius: 140,
};

export const STORAGE_KEY = 'lumendrift.best';

// ── BASTION orbital shield (Gibran's own mechanic, ported to vanilla JS) ──
// A glowing arc orbits the ship at SHIELD.radius and follows the aim
// (mouse). Enemy bullets crossing the ring band inside the arc are
// reflected back at the enemy: they turn friendly, fly faster and hit
// harder. Bullets crossing outside the arc pass through, so the shield
// is a directional defence — aim it at the incoming fire.
export const SHIELD = {
  radius: 64,
  band: 12,
  arcHalfDeg: 50,
  reflectMult: 1.5,
  deflectDamage: 2,
  deflectScore: 50,
  shockwaveRadius: 95,
};

// ── Card draft + synergy (adapted from Gibran's dungeon-crawler design) ──
// After every cleared wave the player drafts 1 of 3 cards. Each card has
// a suit (ORBIT / STRIKE / WARD); collecting cards of one suit builds a
// synergy — the dungeon crawler's "adjacent cards form a synergy" idea,
// transplanted from map tiles to a run-long draft.
export const SUITS = {
  ORBIT: { label: 'ORBIT', color: '#22d3ee' },
  STRIKE: { label: 'STRIKE', color: '#fb923c' },
  WARD: { label: 'WARD', color: '#4ade80' },
};

export const UPGRADES = [
  { id: 'wider', name: 'Wide Guard', desc: 'Shield arc +25°', glyph: '◐', rarity: 'common', type: 'ORBIT', stack: true },
  { id: 'hp_up', name: 'Core Armor', desc: 'Max hull +1, restore 1 hull', glyph: '♥', rarity: 'common', type: 'WARD', stack: true },
  { id: 'dual', name: 'Mirror Guard', desc: 'Second shield arc on the opposite side', glyph: '◑', rarity: 'epic', type: 'ORBIT', stack: false },
  { id: 'magnet', name: 'Vortex Pull', desc: 'Nearby bullets drift toward your shield', glyph: '◎', rarity: 'rare', type: 'ORBIT', stack: false },
  { id: 'timeslow', name: 'Time Rift', desc: 'Deflecting slows all enemy bullets', glyph: '◷', rarity: 'epic', type: 'WARD', stack: false },
  { id: 'chainblast', name: 'Chain Blast', desc: 'Kills explode, hurting nearby enemies', glyph: '✸', rarity: 'rare', type: 'STRIKE', stack: false },
  { id: 'powreflect', name: 'Power Reflect', desc: 'Deflected bullets 2× faster, +1 damage', glyph: '↯', rarity: 'rare', type: 'STRIKE', stack: false },
  { id: 'rapidfire', name: 'Counter Burst', desc: 'Deflecting fires 3 homing shots', glyph: '✦', rarity: 'rare', type: 'STRIKE', stack: false },
  { id: 'absorb', name: 'Energy Absorb', desc: 'Every 5 deflects restores 1 hull', glyph: '⬢', rarity: 'rare', type: 'ORBIT', stack: false },
  // Fallback filler when the unique pool runs dry: always draftable.
  { id: 'repair', name: 'Field Repair', desc: 'Restore 1 hull', glyph: '+', rarity: 'common', type: 'WARD', stack: true },
];

export const RARITY_COLOR = { common: '#6699bb', rare: '#3388ff', epic: '#9933ff' };

// Synergy thresholds: suit count → bonus. Level 2 at two cards of a suit,
// level 3 at three.
export const SYNERGY = {
  ORBIT: {
    2: 'Reflected bullets deal +1 damage',
    3: 'Deflecting releases a shockwave',
  },
  STRIKE: {
    2: 'Fire rate +15%',
    3: 'Bullets pierce +1 enemy',
  },
  WARD: {
    2: 'Pickups magnetize from 2× range',
    3: 'Hull regenerates +1 every 2 waves',
  },
};
