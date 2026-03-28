export const GAME_OPTIONS_KEY = 'meshy2_game_options';

export const DEFAULT_GAME_OPTIONS = {
  player: {
    acceleration: 0.0005,
    rotationSpeed: 0.015,
    maxHealth: 100,
    cannonRange: 35,
    cannonFireRateMin: 1600,
    cannonFireRateMax: 2400,
    cannonDamage: 2,
  },
  wave: {
    zoneDistance: 80,
    spawnThresholdMin: 8,
    spawnThresholdBase: 16,
    spawnThresholdDropPerWave: 0.75,
    squadSizeBase: 2,
    squadSizeMax: 6,
    squadSizeGrowthDivisor: 2,
    spawnDistanceBehindPlayer: 80,
    squadWidth: 80,
    squadSpread: 15,
    pulsarChanceBase: 0.1,
    pulsarChancePerWave: 0.05,
  },
  enemy: {
    maxUnits: 768,
    boundsLimit: 180,
    separationRadius: 1.4,
    separationStrength: 0.2,
    obstacleAvoidanceStrength: 0.28,
    sparkSpeedBase: 0.04,
    sparkSpeedPerWave: 0.0025,
    sparkHealthBase: 3,
    sparkHealthWaveDivisor: 3,
    sparkAggroRange: 35,
    sparkShootInterval: 8000,
    sparkDamage: 15,
    pulsarSpeed: 0.022,
    pulsarHealthBase: 15,
    pulsarHealthPerWave: 2,
    pulsarAggroRange: 45,
    pulsarShootInterval: 4800,
    pulsarDamage: 25,
  },
  base: {
    fireRange: 40,
    interactionRange: 18,
    fireRate: 1200,
    spawnInterval: 20000,
    maxHealth: 80,
    healingRate: 3,
  },
  probe: {
    maxHealth: 30,
    speed: 0.015,
    aggroRange: 40,
    shootInterval: 6000,
    damagePerShot: 1.5,
  },
  modules: {
    shieldDuration: 6,
    shieldCooldownMs: 30000,
    yamatoCooldownMs: 10000,
    yamatoRadius: 8,
    yamatoDamage: 45,
  },
  flowField: {
    occupancyPadding: 1,
  },
};

export const GAME_OPTION_SECTIONS = [
  {
    title: 'Player',
    fields: [
      { path: 'player.acceleration', label: 'Acceleration', min: 0.0001, max: 0.01, step: 0.0001 },
      { path: 'player.rotationSpeed', label: 'Rotation Speed', min: 0.001, max: 0.1, step: 0.001 },
      { path: 'player.maxHealth', label: 'Max Health', min: 10, max: 500, step: 1 },
      { path: 'player.cannonRange', label: 'Cannon Range', min: 5, max: 100, step: 1 },
      { path: 'player.cannonFireRateMin', label: 'Cannon Fire Rate Min', min: 100, max: 5000, step: 50 },
      { path: 'player.cannonFireRateMax', label: 'Cannon Fire Rate Max', min: 100, max: 6000, step: 50 },
      { path: 'player.cannonDamage', label: 'Cannon Damage', min: 1, max: 50, step: 0.5 },
    ],
  },
  {
    title: 'Wave Spawning',
    fields: [
      { path: 'wave.zoneDistance', label: 'Zone Distance', min: 10, max: 300, step: 5 },
      { path: 'wave.spawnThresholdMin', label: 'Spawn Cooldown Min', min: 0.5, max: 60, step: 0.5 },
      { path: 'wave.spawnThresholdBase', label: 'Spawn Cooldown Base', min: 1, max: 60, step: 0.5 },
      { path: 'wave.spawnThresholdDropPerWave', label: 'Cooldown Drop / Wave', min: 0, max: 5, step: 0.05 },
      { path: 'wave.squadSizeBase', label: 'Squad Size Base', min: 1, max: 20, step: 1 },
      { path: 'wave.squadSizeMax', label: 'Squad Size Max', min: 1, max: 50, step: 1 },
      { path: 'wave.squadSizeGrowthDivisor', label: 'Squad Growth Divisor', min: 1, max: 10, step: 1 },
      { path: 'wave.spawnDistanceBehindPlayer', label: 'Spawn Distance Behind Player', min: 5, max: 250, step: 5 },
      { path: 'wave.squadWidth', label: 'Spawn Width', min: 5, max: 200, step: 5 },
      { path: 'wave.squadSpread', label: 'Squad Spread', min: 0, max: 100, step: 1 },
      { path: 'wave.pulsarChanceBase', label: 'Pulsar Chance Base', min: 0, max: 1, step: 0.01 },
      { path: 'wave.pulsarChancePerWave', label: 'Pulsar Chance / Wave', min: 0, max: 0.5, step: 0.01 },
    ],
  },
  {
    title: 'Enemy Units',
    fields: [
      { path: 'enemy.maxUnits', label: 'Max Units', min: 10, max: 5000, step: 1 },
      { path: 'enemy.boundsLimit', label: 'Bounds Limit', min: 10, max: 500, step: 5 },
      { path: 'enemy.separationRadius', label: 'Separation Radius', min: 0, max: 10, step: 0.1 },
      { path: 'enemy.separationStrength', label: 'Separation Strength', min: 0, max: 2, step: 0.01 },
      { path: 'enemy.obstacleAvoidanceStrength', label: 'Obstacle Avoid Strength', min: 0, max: 2, step: 0.01 },
      { path: 'enemy.sparkSpeedBase', label: 'Spark Speed Base', min: 0.001, max: 0.2, step: 0.001 },
      { path: 'enemy.sparkSpeedPerWave', label: 'Spark Speed / Wave', min: 0, max: 0.05, step: 0.0005 },
      { path: 'enemy.sparkHealthBase', label: 'Spark Health Base', min: 1, max: 200, step: 1 },
      { path: 'enemy.sparkHealthWaveDivisor', label: 'Spark Health Wave Divisor', min: 1, max: 20, step: 1 },
      { path: 'enemy.sparkAggroRange', label: 'Spark Aggro Range', min: 1, max: 100, step: 1 },
      { path: 'enemy.sparkShootInterval', label: 'Spark Shoot Interval', min: 100, max: 10000, step: 50 },
      { path: 'enemy.sparkDamage', label: 'Spark Damage', min: 1, max: 100, step: 1 },
      { path: 'enemy.pulsarSpeed', label: 'Pulsar Speed', min: 0.001, max: 0.2, step: 0.001 },
      { path: 'enemy.pulsarHealthBase', label: 'Pulsar Health Base', min: 1, max: 500, step: 1 },
      { path: 'enemy.pulsarHealthPerWave', label: 'Pulsar Health / Wave', min: 0, max: 20, step: 1 },
      { path: 'enemy.pulsarAggroRange', label: 'Pulsar Aggro Range', min: 1, max: 100, step: 1 },
      { path: 'enemy.pulsarShootInterval', label: 'Pulsar Shoot Interval', min: 100, max: 10000, step: 50 },
      { path: 'enemy.pulsarDamage', label: 'Pulsar Damage', min: 1, max: 250, step: 1 },
    ],
  },
  {
    title: 'Base And Probes',
    fields: [
      { path: 'base.fireRange', label: 'Base Fire Range', min: 1, max: 100, step: 1 },
      { path: 'base.interactionRange', label: 'Base Interaction Range', min: 1, max: 100, step: 1 },
      { path: 'base.fireRate', label: 'Base Fire Rate', min: 100, max: 10000, step: 50 },
      { path: 'base.spawnInterval', label: 'Probe Spawn Interval', min: 100, max: 60000, step: 100 },
      { path: 'base.maxHealth', label: 'Base Max Health', min: 1, max: 500, step: 1 },
      { path: 'base.healingRate', label: 'Healing Per Second', min: 0, max: 50, step: 0.5 },
      { path: 'probe.maxHealth', label: 'Probe Max Health', min: 1, max: 200, step: 1 },
      { path: 'probe.speed', label: 'Probe Speed', min: 0.001, max: 0.2, step: 0.001 },
      { path: 'probe.aggroRange', label: 'Probe Aggro Range', min: 1, max: 100, step: 1 },
      { path: 'probe.shootInterval', label: 'Probe Shoot Interval', min: 100, max: 10000, step: 50 },
      { path: 'probe.damagePerShot', label: 'Probe Damage', min: 0.5, max: 50, step: 0.5 },
    ],
  },
  {
    title: 'Modules And Flow Field',
    fields: [
      { path: 'modules.shieldDuration', label: 'Shield Duration', min: 0.5, max: 60, step: 0.5 },
      { path: 'modules.shieldCooldownMs', label: 'Shield Cooldown (ms)', min: 0, max: 120000, step: 100 },
      { path: 'modules.yamatoCooldownMs', label: 'Yamato Cooldown (ms)', min: 0, max: 120000, step: 100 },
      { path: 'modules.yamatoRadius', label: 'Yamato Radius', min: 1, max: 50, step: 0.5 },
      { path: 'modules.yamatoDamage', label: 'Yamato Damage', min: 1, max: 500, step: 1 },
      { path: 'flowField.occupancyPadding', label: 'Occupancy Padding Cells', min: 0, max: 5, step: 1 },
    ],
  },
];

function deepMerge(base, override) {
  const output = Array.isArray(base) ? [...base] : { ...base };

  for (const key of Object.keys(override || {})) {
    const baseValue = base?.[key];
    const overrideValue = override[key];

    if (
      baseValue &&
      overrideValue &&
      typeof baseValue === 'object' &&
      typeof overrideValue === 'object' &&
      !Array.isArray(baseValue) &&
      !Array.isArray(overrideValue)
    ) {
      output[key] = deepMerge(baseValue, overrideValue);
    } else {
      output[key] = overrideValue;
    }
  }

  return output;
}

export function cloneGameOptions(options = DEFAULT_GAME_OPTIONS) {
  return JSON.parse(JSON.stringify(options));
}

export function loadGameOptions() {
  const saved = localStorage.getItem(GAME_OPTIONS_KEY);
  if (!saved) {
    return cloneGameOptions(DEFAULT_GAME_OPTIONS);
  }

  try {
    return deepMerge(DEFAULT_GAME_OPTIONS, JSON.parse(saved));
  } catch {
    return cloneGameOptions(DEFAULT_GAME_OPTIONS);
  }
}

export function saveGameOptions(options) {
  localStorage.setItem(GAME_OPTIONS_KEY, JSON.stringify(options));
}

export function resetGameOptions() {
  localStorage.removeItem(GAME_OPTIONS_KEY);
  return cloneGameOptions(DEFAULT_GAME_OPTIONS);
}

export function getOptionValue(options, path) {
  return path.split('.').reduce((value, part) => value?.[part], options);
}

export function setOptionValue(options, path, nextValue) {
  const parts = path.split('.');
  let current = options;

  for (let index = 0; index < parts.length - 1; index++) {
    current = current[parts[index]];
  }

  current[parts[parts.length - 1]] = nextValue;
}
