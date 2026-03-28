import { saveMap, loadMap } from './mapData';

const gridWrapper = document.getElementById('grid-wrapper');
const deleteZone = document.getElementById('delete-zone');
const saveBtn = document.getElementById('save-btn');
const copyBtn = document.getElementById('copy-btn');
const dragToggleBtn = document.getElementById('drag-toggle');
const eraseToggleBtn = document.getElementById('erase-toggle');

const CELL_SIZE = 10;
const GRID_WIDTH = 40;
const GRID_HEIGHT = 140;
const GAME_SCALE = 2; // Each cell is 2 units in game
const OFFSET_X = GRID_WIDTH / 2; // 20
const OFFSET_Z = GRID_HEIGHT / 2; // 60

let draggedItem = null;
let entities = [];
let activeBrush = null;
let isPainting = false;
let paintedCells = new Set();
let dragEnabled = false;
let eraseEnabled = false;
let draggedEntityState = null;

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
if (map.enemyBasePosition) {
  createEntity('enemyBase', toGridCoord(map.enemyBasePosition.x, 6, OFFSET_X), toGridCoord(map.enemyBasePosition.z, 6, OFFSET_Z), 6, 6);
}
if (map.obstacles) {
  map.obstacles.forEach(o => {
    const w = o.w || 2;
    const h = o.h || 2;
    createEntity('obstacle', toGridCoord(o.x, w, OFFSET_X), toGridCoord(o.z, h, OFFSET_Z), w, h);
  });
}
if (map.bombs) {
  map.bombs.forEach(b => {
    createEntity('bomb', toGridCoord(b.x, 2, OFFSET_X), toGridCoord(b.z, 2, OFFSET_Z), 2, 2);
  });
}

function createEntity(type, x, z, w, h) {
  const el = document.createElement('div');
  el.className = `entity`;
  el.dataset.type = type;
  el.dataset.w = w;
  el.dataset.h = h;
  el.innerText =
    type === 'player' ? 'P'
    : type === 'base' ? 'B'
    : type === 'enemyBase' ? 'E'
    : type === 'bomb' ? '!'
    : '';
  
  updateEntityDOM(el, x, z, w, h);

  el.addEventListener('mousedown', (event) => {
    if (!dragEnabled || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = el.getBoundingClientRect();
    draggedEntityState = {
      element: el,
      type,
      w,
      h,
      offsetX: event.clientX - rect.left,
      offsetZ: event.clientY - rect.top,
    };
    el.classList.add('dragging');
  });
  
  gridWrapper.appendChild(el);
  entities.push(el);
  return el;
}

function getEntityAt(type, x, z, w, h) {
  return entities.find((el) =>
    el.dataset.type === type &&
    parseInt(el.dataset.x) === x &&
    parseInt(el.dataset.z) === z &&
    parseInt(el.dataset.w) === w &&
    parseInt(el.dataset.h) === h
  );
}

function placeEntity(type, x, z, w, h) {
  if (type === 'player' || type === 'base' || type === 'enemyBase') {
    const existing = entities.filter((el) => el.dataset.type === type);
    existing.forEach((el) => el.remove());
    entities = entities.filter((el) => el.dataset.type !== type);
    createEntity(type, x, z, w, h);
    return;
  }

  if (getEntityAt(type, x, z, w, h)) return;
  createEntity(type, x, z, w, h);
}

function removeEntitiesAtCell(x, z) {
  const toRemove = entities.filter((el) => {
    const entityX = parseInt(el.dataset.x);
    const entityZ = parseInt(el.dataset.z);
    const entityW = parseInt(el.dataset.w);
    const entityH = parseInt(el.dataset.h);
    return x >= entityX && x < entityX + entityW && z >= entityZ && z < entityZ + entityH;
  });

  toRemove.forEach((el) => {
    el.remove();
    entities = entities.filter((entity) => entity !== el);
  });
}

function getGridCellFromEvent(event) {
  const rect = gridWrapper.getBoundingClientRect();
  const rawX = event.clientX - rect.left;
  const rawZ = event.clientY - rect.top;

  return {
    x: Math.floor(rawX / CELL_SIZE),
    z: Math.floor(rawZ / CELL_SIZE),
  };
}

function paintAtEvent(event) {
  const { x, z } = getGridCellFromEvent(event);
  const modeKey = eraseEnabled ? 'erase' : activeBrush ? activeBrush.type : 'none';
  const brushW = activeBrush?.w || 1;
  const brushH = activeBrush?.h || 1;
  const key = `${modeKey}:${x}:${z}:${brushW}:${brushH}`;
  if (paintedCells.has(key)) return;

  paintedCells.add(key);

  if (eraseEnabled) {
    removeEntitiesAtCell(x, z);
    return;
  }

  if (!activeBrush) return;
  placeEntity(activeBrush.type, x, z, activeBrush.w, activeBrush.h);
}

function setActiveBrush(brush, paletteItem = null) {
  activeBrush = brush;
  document.querySelectorAll('.palette-item').forEach((item) => {
    item.classList.toggle('selected', item === paletteItem);
  });
}

function updateDragModeUI() {
  dragToggleBtn.classList.toggle('active', dragEnabled);
  eraseToggleBtn.classList.toggle('active', eraseEnabled);
  dragToggleBtn.title = dragEnabled ? 'Drag mode on' : 'Brush mode on';
  eraseToggleBtn.title = eraseEnabled ? 'Erase mode on' : 'Erase mode off';
  gridWrapper.classList.toggle('drag-enabled', dragEnabled);
}

function canDeleteEntity(type) {
  return type !== 'player' && type !== 'base' && type !== 'enemyBase';
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

  item.addEventListener('click', () => {
    setActiveBrush({
      type: item.dataset.type,
      w: parseInt(item.dataset.w),
      h: parseInt(item.dataset.h),
    }, item);
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
    placeEntity(draggedItem.type, cellX, cellZ, draggedItem.w, draggedItem.h);
  } else {
    updateEntityDOM(draggedItem.element, cellX, cellZ, draggedItem.w, draggedItem.h);
  }
});

gridWrapper.addEventListener('mousedown', (e) => {
  if (dragEnabled) return;
  if ((!activeBrush && !eraseEnabled) || e.button !== 0) return;
  if (e.target !== gridWrapper) return;

  isPainting = true;
  paintedCells.clear();
  paintAtEvent(e);
});

gridWrapper.addEventListener('mousemove', (e) => {
  if (!isPainting) return;
  paintAtEvent(e);
});

window.addEventListener('mousemove', (event) => {
  if (!draggedEntityState) return;

  const rect = gridWrapper.getBoundingClientRect();
  const rawX = event.clientX - rect.left - draggedEntityState.offsetX;
  const rawZ = event.clientY - rect.top - draggedEntityState.offsetZ;
  const cellX = Math.floor(rawX / CELL_SIZE);
  const cellZ = Math.floor(rawZ / CELL_SIZE);
  updateEntityDOM(draggedEntityState.element, cellX, cellZ, draggedEntityState.w, draggedEntityState.h);

  const deleteRect = deleteZone.getBoundingClientRect();
  const overDeleteZone =
    event.clientX >= deleteRect.left &&
    event.clientX <= deleteRect.right &&
    event.clientY >= deleteRect.top &&
    event.clientY <= deleteRect.bottom &&
    canDeleteEntity(draggedEntityState.type);
  deleteZone.classList.toggle('dragover', overDeleteZone);
});

window.addEventListener('mouseup', (event) => {
  isPainting = false;
  paintedCells.clear();

  if (!draggedEntityState) return;

  const deleteRect = deleteZone.getBoundingClientRect();
  const droppedInDeleteZone =
    event.clientX >= deleteRect.left &&
    event.clientX <= deleteRect.right &&
    event.clientY >= deleteRect.top &&
    event.clientY <= deleteRect.bottom &&
    canDeleteEntity(draggedEntityState.type);

  if (droppedInDeleteZone) {
    draggedEntityState.element.remove();
    entities = entities.filter((el) => el !== draggedEntityState.element);
  }

  draggedEntityState.element.classList.remove('dragging');
  draggedEntityState = null;
  deleteZone.classList.remove('dragover');
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
  if (draggedItem && !draggedItem.isNew && canDeleteEntity(draggedItem.type)) {
    draggedItem.element.remove();
    entities = entities.filter(el => el !== draggedItem.element);
  }
});

dragToggleBtn.onclick = () => {
  dragEnabled = !dragEnabled;
  if (dragEnabled) eraseEnabled = false;
  isPainting = false;
  paintedCells.clear();
  updateDragModeUI();
};

eraseToggleBtn.onclick = () => {
  eraseEnabled = !eraseEnabled;
  if (eraseEnabled) dragEnabled = false;
  isPainting = false;
  paintedCells.clear();
  updateDragModeUI();
};

updateDragModeUI();

function getMapData() {
  const newMap = {
    playerStart: { x: 0, z: 0 },
    basePosition: { x: 0, z: 0 },
    enemyBasePosition: { x: 0, z: 0 },
    obstacles: [],
    bombs: []
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
    } else if (type === 'enemyBase') {
      newMap.enemyBasePosition = { x: gameX, z: gameZ };
    } else if (type === 'obstacle') {
      newMap.obstacles.push({ x: gameX, z: gameZ, w, h });
    } else if (type === 'bomb') {
      newMap.bombs.push({ x: gameX, z: gameZ });
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
