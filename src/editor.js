import { saveMap, loadMap } from './mapData';

const grid = document.getElementById('grid');
const tools = document.querySelectorAll('.tool');
let currentTool = 'player';
const cells = [];
const gridSize = 40;

// Load initial map
const map = loadMap();

// Create grid
for (let z = 0; z < gridSize; z++) {
  for (let x = 0; x < gridSize; x++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.x = x - gridSize/2;
    cell.dataset.z = z - gridSize/2;
    
    // Initial painting from loaded map
    if (map.playerStart.x === parseInt(cell.dataset.x) && map.playerStart.z === parseInt(cell.dataset.z)) {
      cell.classList.add('player');
    }
    if (map.basePosition.x === parseInt(cell.dataset.x) && map.basePosition.z === parseInt(cell.dataset.z)) {
      cell.classList.add('base');
    }
    if (map.obstacles.some(o => o.x === parseInt(cell.dataset.x) && o.z === parseInt(cell.dataset.z))) {
      cell.classList.add('obstacle');
    }

    cell.onclick = () => paint(cell);
    grid.appendChild(cell);
    cells.push(cell);
  }
}

// Tool selection
tools.forEach(t => {
  t.onclick = () => {
    tools.forEach(bt => bt.classList.remove('active'));
    t.classList.add('active');
    currentTool = t.dataset.type;
  };
});

function paint(cell) {
  if (currentTool === 'player') {
    cells.forEach(c => c.classList.remove('player'));
    cell.classList.add('player');
  } else if (currentTool === 'base') {
    cells.forEach(c => c.classList.remove('base'));
    cell.classList.add('base');
  } else if (currentTool === 'obstacle') {
    cell.className = 'cell obstacle';
  } else if (currentTool === 'empty') {
    cell.className = 'cell';
  }
}

document.getElementById('save-btn').onclick = () => {
  const newMap = {
    playerStart: { x: 0, z: 0 },
    basePosition: { x: 0, z: 0 },
    obstacles: []
  };

  cells.forEach(c => {
    const x = parseInt(c.dataset.x) * 2; // Scale factor for the game
    const z = parseInt(c.dataset.z) * 2;
    
    if (c.classList.contains('player')) newMap.playerStart = { x, z };
    if (c.classList.contains('base')) newMap.basePosition = { x, z };
    if (c.classList.contains('obstacle')) newMap.obstacles.push({ x, z });
  });

  saveMap(newMap);
  alert('Map saved! Refresh the game tab.');
};
