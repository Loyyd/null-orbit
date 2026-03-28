export const MAP_CONFIG_KEY = 'meshy2_map_data';

export const DEFAULT_MAP = {
  "playerStart": {
    "x": -2,
    "z": -3
  },
  "basePosition": {
    "x": -37,
    "z": 37
  },
  "enemyBasePosition": {
    "x": 34,
    "z": -132
  },
  "obstacles": [
    { "x": -10, "z": -39, "w": 2, "h": 2 },
    { "x": -8, "z": -39, "w": 2, "h": 2 },
    { "x": -6, "z": -39, "w": 2, "h": 2 },
    { "x": -4, "z": -39, "w": 2, "h": 2 },
    { "x": -2, "z": -39, "w": 2, "h": 2 },
    { "x": 0, "z": -39, "w": 2, "h": 2 },
    { "x": 2, "z": -39, "w": 2, "h": 2 },
    { "x": 4, "z": -39, "w": 2, "h": 2 },
    { "x": 6, "z": -39, "w": 2, "h": 2 },
    { "x": 8, "z": -39, "w": 2, "h": 2 },
    { "x": 10, "z": -39, "w": 2, "h": 2 },
    { "x": 12, "z": -36, "w": 2, "h": 2 },
    { "x": 16, "z": -36, "w": 2, "h": 2 },
    { "x": 20, "z": -36, "w": 2, "h": 2 },
    { "x": 24, "z": -36, "w": 2, "h": 2 },
    { "x": 39, "z": -38, "w": 2, "h": 2 },
    { "x": 28, "z": -16, "w": 2, "h": 2 },
    { "x": 32, "z": -16, "w": 2, "h": 2 },
    { "x": 36, "z": -16, "w": 2, "h": 2 },
    { "x": 28, "z": -12, "w": 2, "h": 2 },
    { "x": 28, "z": -8, "w": 2, "h": 2 },
    { "x": 28, "z": -4, "w": 2, "h": 2 },
    { "x": 28, "z": 0, "w": 2, "h": 2 },
    { "x": -19, "z": -9, "w": 10, "h": 2 },
    { "x": -31, "z": -37, "w": 10, "h": 2 },
    { "x": -28, "z": -5, "w": 2, "h": 10 },
    { "x": 38, "z": 38, "w": 4, "h": 4 }
  ],
  "bombs": []
};

export function saveMap(data) {
  localStorage.setItem(MAP_CONFIG_KEY, JSON.stringify(data));
}

export function loadMap() {
  const saved = localStorage.getItem(MAP_CONFIG_KEY);
  const parsed = saved ? JSON.parse(saved) : DEFAULT_MAP;
  return {
    ...DEFAULT_MAP,
    ...parsed,
    enemyBasePosition: parsed?.enemyBasePosition || DEFAULT_MAP.enemyBasePosition,
  };
}
