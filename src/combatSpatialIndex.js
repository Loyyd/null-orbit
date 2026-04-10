export class CombatSpatialIndex {
  constructor(cellSize = 12) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  rebuild(targets) {
    this.cells.clear();

    for (const target of targets) {
      if (!target || target.isDead || !target.mesh?.position) continue;

      const cellKey = this.getCellKey(
        this.toCellCoord(target.mesh.position.x),
        this.toCellCoord(target.mesh.position.z)
      );
      let cell = this.cells.get(cellKey);
      if (!cell) {
        cell = [];
        this.cells.set(cellKey, cell);
      }
      cell.push(target);
    }
  }

  findNearest(position, maxRange, predicate = null) {
    const minCellX = this.toCellCoord(position.x - maxRange);
    const maxCellX = this.toCellCoord(position.x + maxRange);
    const minCellZ = this.toCellCoord(position.z - maxRange);
    const maxCellZ = this.toCellCoord(position.z + maxRange);
    const maxRangeSq = maxRange * maxRange;

    let nearestTarget = null;
    let nearestDistanceSq = maxRangeSq;

    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        const cell = this.cells.get(this.getCellKey(cellX, cellZ));
        if (!cell) continue;

        for (const target of cell) {
          if (target.isDead) continue;
          if (predicate && !predicate(target)) continue;

          const dx = target.mesh.position.x - position.x;
          const dz = target.mesh.position.z - position.z;
          const distanceSq = (dx * dx) + (dz * dz);
          if (distanceSq < nearestDistanceSq) {
            nearestDistanceSq = distanceSq;
            nearestTarget = target;
          }
        }
      }
    }

    return nearestTarget;
  }

  intersects(position, radius, callback) {
    const minCellX = this.toCellCoord(position.x - radius);
    const maxCellX = this.toCellCoord(position.x + radius);
    const minCellZ = this.toCellCoord(position.z - radius);
    const maxCellZ = this.toCellCoord(position.z + radius);

    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        const cell = this.cells.get(this.getCellKey(cellX, cellZ));
        if (!cell) continue;

        for (const target of cell) {
          if (target.isDead) continue;
          if (callback(target)) {
            return target;
          }
        }
      }
    }

    return null;
  }

  toCellCoord(value) {
    return Math.floor(value / this.cellSize);
  }

  getCellKey(cellX, cellZ) {
    return `${cellX},${cellZ}`;
  }
}
