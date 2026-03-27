export const MAP_CONFIG_KEY = 'meshy2_map_data';

export const DEFAULT_MAP = {
  playerStart: { x: 0, z: 0 },
  basePosition: { x: -20, z: 20 },
  obstacles: [] // Array of {x, z}
};

export function saveMap(data) {
  localStorage.setItem(MAP_CONFIG_KEY, JSON.stringify(data));
}

export function loadMap() {
  const saved = localStorage.getItem(MAP_CONFIG_KEY);
  return saved ? JSON.parse(saved) : DEFAULT_MAP;
}
