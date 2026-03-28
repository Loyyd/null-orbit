const INF_DISTANCE = 0x7fffffff;

function isDiagonalMoveBlocked(occupancyMap, x, y, offsetX, offsetY) {
  if (offsetX === 0 || offsetY === 0) {
    return false;
  }

  return (
    occupancyMap[y][x + offsetX] !== 0 ||
    occupancyMap[y + offsetY][x] !== 0
  );
}

export function generateDijkstraMap(target, occupancyMap, outDistances = null, outQueue = null) {
  const height = occupancyMap.length;
  const width = occupancyMap[0]?.length || 0;
  const size = width * height;
  const distances = outDistances ?? new Int32Array(size);
  const queue = outQueue ?? new Int32Array(size);

  distances.fill(INF_DISTANCE);

  if (width === 0 || height === 0) {
    return distances;
  }

  const targetX = target.x | 0;
  const targetY = target.y | 0;

  if (
    targetX < 0 ||
    targetX >= width ||
    targetY < 0 ||
    targetY >= height ||
    occupancyMap[targetY][targetX] !== 0
  ) {
    return distances;
  }

  let head = 0;
  let tail = 0;
  const targetIndex = targetY * width + targetX;
  distances[targetIndex] = 0;
  queue[tail++] = targetIndex;

  while (head < tail) {
    const index = queue[head++];
    const nextDistance = distances[index] + 1;
    const x = index % width;
    const y = (index / width) | 0;

    if (x > 0) {
      const leftIndex = index - 1;
      if (occupancyMap[y][x - 1] === 0 && nextDistance < distances[leftIndex]) {
        distances[leftIndex] = nextDistance;
        queue[tail++] = leftIndex;
      }
    }

    if (x + 1 < width) {
      const rightIndex = index + 1;
      if (occupancyMap[y][x + 1] === 0 && nextDistance < distances[rightIndex]) {
        distances[rightIndex] = nextDistance;
        queue[tail++] = rightIndex;
      }
    }

    if (y > 0) {
      const upIndex = index - width;
      if (occupancyMap[y - 1][x] === 0 && nextDistance < distances[upIndex]) {
        distances[upIndex] = nextDistance;
        queue[tail++] = upIndex;
      }
    }

    if (y + 1 < height) {
      const downIndex = index + width;
      if (occupancyMap[y + 1][x] === 0 && nextDistance < distances[downIndex]) {
        distances[downIndex] = nextDistance;
        queue[tail++] = downIndex;
      }
    }
  }

  return distances;
}

export function generateVectorField(distanceField, occupancyMap, outVectors = null) {
  const height = occupancyMap.length;
  const width = occupancyMap[0]?.length || 0;
  const size = width * height;
  const vectors = outVectors ?? new Float32Array(size * 2);

  vectors.fill(0);

  for (let y = 0; y < height; y++) {
    const row = occupancyMap[y];

    for (let x = 0; x < width; x++) {
      if (row[x] !== 0) continue;

      const index = y * width + x;
      const currentDistance = distanceField[index];

      if (currentDistance === 0 || currentDistance === INF_DISTANCE) continue;

      let bestDistance = currentDistance;
      let bestX = 0;
      let bestY = 0;

      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        const neighborY = y + offsetY;
        if (neighborY < 0 || neighborY >= height) continue;

        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          if (offsetX === 0 && offsetY === 0) continue;

          const neighborX = x + offsetX;
          if (neighborX < 0 || neighborX >= width) continue;
          if (occupancyMap[neighborY][neighborX] !== 0) continue;
          if (isDiagonalMoveBlocked(occupancyMap, x, y, offsetX, offsetY)) continue;

          const neighborDistance = distanceField[neighborY * width + neighborX];
          if (neighborDistance >= bestDistance) continue;

          bestDistance = neighborDistance;
          bestX = offsetX;
          bestY = offsetY;
        }
      }

      if (bestDistance === currentDistance) continue;

      const length = Math.hypot(bestX, bestY);
      const vectorIndex = index * 2;
      vectors[vectorIndex] = bestX / length;
      vectors[vectorIndex + 1] = bestY / length;
    }
  }

  return vectors;
}

export class FlowField {
  constructor(occupancyMap) {
    this.occupancyMap = occupancyMap;
    this.height = occupancyMap.length;
    this.width = occupancyMap[0]?.length || 0;
    this.size = this.width * this.height;
    this.distances = new Int32Array(this.size);
    this.vectors = new Float32Array(this.size * 2);
    this.queue = new Int32Array(this.size);
    this.targetX = -1;
    this.targetY = -1;
  }

  rebuild(target) {
    const targetX = target.x | 0;
    const targetY = target.y | 0;

    if (targetX === this.targetX && targetY === this.targetY) {
      return this;
    }

    this.targetX = targetX;
    this.targetY = targetY;
    generateDijkstraMap(target, this.occupancyMap, this.distances, this.queue);
    generateVectorField(this.distances, this.occupancyMap, this.vectors);
    return this;
  }

  getVector(cellX, cellY) {
    if (cellX < 0 || cellX >= this.width || cellY < 0 || cellY >= this.height) {
      return [0, 0];
    }

    const index = (cellY * this.width + cellX) * 2;
    return [this.vectors[index], this.vectors[index + 1]];
  }
}
