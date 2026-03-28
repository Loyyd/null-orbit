export function createGridAdapter({ width, height, cellSize, minX, minZ }) {
  return {
    width,
    height,
    cellSize,
    minX,
    minZ,
    maxX: minX + (width * cellSize),
    maxZ: minZ + (height * cellSize),
    toCellX(worldX) {
      return Math.floor((worldX - minX) / cellSize);
    },
    toCellY(worldZ) {
      return Math.floor((worldZ - minZ) / cellSize);
    },
    toWorldX(cellX) {
      return minX + ((cellX + 0.5) * cellSize);
    },
    toWorldZ(cellY) {
      return minZ + ((cellY + 0.5) * cellSize);
    },
    clampCellX(cellX) {
      return Math.max(0, Math.min(width - 1, cellX));
    },
    clampCellY(cellY) {
      return Math.max(0, Math.min(height - 1, cellY));
    },
  };
}

export function buildOccupancyMap(obstacles, grid, paddingCells = 0) {
  const occupancyMap = Array.from({ length: grid.height }, () => new Uint8Array(grid.width));

  for (const obstacle of obstacles) {
    const halfW = obstacle.w * 0.5;
    const halfH = obstacle.h * 0.5;
    const minCellX = grid.clampCellX(Math.floor((obstacle.x - halfW - grid.minX) / grid.cellSize) - paddingCells);
    const maxCellX = grid.clampCellX(Math.ceil((obstacle.x + halfW - grid.minX) / grid.cellSize) - 1 + paddingCells);
    const minCellY = grid.clampCellY(Math.floor((obstacle.z - halfH - grid.minZ) / grid.cellSize) - paddingCells);
    const maxCellY = grid.clampCellY(Math.ceil((obstacle.z + halfH - grid.minZ) / grid.cellSize) - 1 + paddingCells);

    for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
      const row = occupancyMap[cellY];
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        row[cellX] = 1;
      }
    }
  }

  return occupancyMap;
}
