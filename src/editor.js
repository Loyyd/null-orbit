import { saveMap, loadMap } from './mapData';

const gridWrapper = document.getElementById('grid-wrapper');
const deleteZone = document.getElementById('delete-zone');
const saveBtn = document.getElementById('save-btn');
const copyBtn = document.getElementById('copy-btn');

const CELL_SIZE = 10;
const GRID_WIDTH = 40;
const GRID_HEIGHT = 120;
const GAME_SCALE = 2; // Each cell is 2 units in game
const OFFSET_X = GRID_WIDTH / 2; // 20
const OFFSET_Z = GRID_HEIGHT / 2; // 60

let draggedItem = null;
let entities = [];

// Load initial map
const map = loadMap();

function toGameCoord(gridVal, size, offset) {
  return (gridVal + size / 2 - offset) * GAME_SCALE;
}
function toGridCoord(gameVal, size, offset) {
  return Math.round((gameVal / GAME_SCALE) + offset - size / 2);
}

// Initialize entities from map
if (map.playerStart) {
  createEntity('player', toGridCoord(map.playerStart.x, 2, OFFSET_X), toGridCoord(map.playerStart.z, 2, OFFSET_Z), 2, 2);
}
if (map.basePosition) {
  createEntity('base', toGridCoord(map.basePosition.x, 6, OFFSET_X), toGridCoord(map.basePosition.z, 6, OFFSET_Z), 6, 6);
}
if (map.obstacles) {
  map.obstacles.forEach(o => {
    const w = o.w || 2;
    const h = o.h || 2;
    createEntity('obstacle', toGridCoord(o.x, w, OFFSET_X), toGridCoord(o.z, h, OFFSET_Z), w, h);
  });
}

function createEntity(type, x, z, w, h) {
  const el = document.createElement('div');
  el.className = `entity`;
  el.dataset.type = type;
  el.dataset.w = w;
  el.dataset.h = h;
  el.draggable = true;
  el.innerText = type === 'player' ? 'P' : type === 'base' ? 'B' : '';
  
  updateEntityDOM(el, x, z, w, h);
  
  el.addEventListener('dragstart', (e) => {
    draggedItem = { element: el, type, w, h, isNew: false };
    setTimeout(() => el.classList.add('dragging'), 0);
  });
  
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    draggedItem = null;
  });
  
  gridWrapper.appendChild(el);
  entities.push(el);
  return el;
}

function updateEntityDOM(el, x, z, w, h) {
  // constrain to grid
  x = Math.max(0, Math.min(x, GRID_WIDTH - w));
  z = Math.max(0, Math.min(z, GRID_HEIGHT - h));
  
  el.dataset.x = x;
  el.dataset.z = z;
  
  el.style.left = `${x * CELL_SIZE}px`;
  el.style.top = `${z * CELL_SIZE}px`;
  el.style.width = `${w * CELL_SIZE}px`;
  el.style.height = `${h * CELL_SIZE}px`;
}

// Palette Drag
document.querySelectorAll('.palette-item').forEach(item => {
  item.addEventListener('dragstart', (e) => {
    draggedItem = {
      type: item.dataset.type,
      w: parseInt(item.dataset.w),
      h: parseInt(item.dataset.h),
      isNew: true
    };
  });
});

gridWrapper.addEventListener('dragover', (e) => {
  e.preventDefault(); // Allow drop
});

gridWrapper.addEventListener('drop', (e) => {
  e.preventDefault();
  if (!draggedItem) return;
  
  const rect = gridWrapper.getBoundingClientRect();
  const rawX = e.clientX - rect.left;
  const rawZ = e.clientY - rect.top;
  
  const cellX = Math.floor(rawX / CELL_SIZE);
  const cellZ = Math.floor(rawZ / CELL_SIZE);
  
  if (draggedItem.isNew) {
    if (draggedItem.type === 'player' || draggedItem.type === 'base') {
      const existing = entities.filter(el => el.dataset.type === draggedItem.type);
      existing.forEach(el => el.remove());
      entities = entities.filter(el => el.dataset.type !== draggedItem.type);
    }
    createEntity(draggedItem.type, cellX, cellZ, draggedItem.w, draggedItem.h);
  } else {
    updateEntityDOM(draggedItem.element, cellX, cellZ, draggedItem.w, draggedItem.h);
  }
});

deleteZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  deleteZone.classList.add('dragover');
});
deleteZone.addEventListener('dragleave', () => {
  deleteZone.classList.remove('dragover');
});
deleteZone.addEventListener('drop', (e) => {
  e.preventDefault();
  deleteZone.classList.remove('dragover');
  if (draggedItem && !draggedItem.isNew && draggedItem.type !== 'player' && draggedItem.type !== 'base') {
    draggedItem.element.remove();
    entities = entities.filter(el => el !== draggedItem.element);
  }
});

function getMapData() {
  const newMap = {
    playerStart: { x: 0, z: 0 },
    basePosition: { x: 0, z: 0 },
    obstacles: []
  };
  
  entities.forEach(el => {
    const type = el.dataset.type;
    const x = parseInt(el.dataset.x);
    const z = parseInt(el.dataset.z);
    const w = parseInt(el.dataset.w);
    const h = parseInt(el.dataset.h);
    
    const gameX = toGameCoord(x, w, OFFSET_X);
    const gameZ = toGameCoord(z, h, OFFSET_Z);
    
    if (type === 'player') {
      newMap.playerStart = { x: gameX, z: gameZ };
    } else if (type === 'base') {
      newMap.basePosition = { x: gameX, z: gameZ };
    } else if (type === 'obstacle') {
      newMap.obstacles.push({ x: gameX, z: gameZ, w, h });
    }
  });
  
  return newMap;
}

saveBtn.onclick = () => {
  saveMap(getMapData());
  alert('Map saved to LocalStorage! Refresh the game tab to see your new map.');
};

copyBtn.onclick = () => {
  const data = getMapData();
  const code = `export const MAP_CONFIG_KEY = 'meshy2_map_data';

export const DEFAULT_MAP = ${JSON.stringify(data, null, 2)};

export function saveMap(data) {
  localStorage.setItem(MAP_CONFIG_KEY, JSON.stringify(data));
}

export function loadMap() {
  const saved = localStorage.getItem(MAP_CONFIG_KEY);
  return saved ? JSON.parse(saved) : DEFAULT_MAP;
}
`;
  navigator.clipboard.writeText(code).then(() => {
    alert('Code copied! Paste it into src/mapData.js to make it the default for all future sessions.');
  }).catch(err => {
    alert('Failed to copy: ' + err);
  });
};