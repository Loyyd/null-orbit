export const MAP_CONFIG_KEY = 'meshy2_map_data';

export const DEFAULT_MAP = {
  "playerStart": {
    "x": -28,
    "z": 110
  },
  "basePosition": {
    "x": 34,
    "z": 110
  },
  "enemyBasePosition": {
    "x": -2,
    "z": -84
  },
  "obstacles": [
    {
      "x": -10,
      "z": 96,
      "w": 4,
      "h": 4
    },
    {
      "x": 4,
      "z": 86,
      "w": 4,
      "h": 4
    }
  ],
  "bombs": [
    {
      "x": -12,
      "z": -22
    },
    {
      "x": 0,
      "z": -42
    },
    {
      "x": 14,
      "z": -56
    },
    {
      "x": 20,
      "z": -70
    }
  ]
};

export function saveMap(data) {
  localStorage.setItem(MAP_CONFIG_KEY, JSON.stringify(data));
}

export function loadMap() {
  const saved = localStorage.getItem(MAP_CONFIG_KEY);
  return saved ? JSON.parse(saved) : DEFAULT_MAP;
}
