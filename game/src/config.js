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
