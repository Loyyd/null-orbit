import * as THREE from 'three';

function getExpandedBounds(obstacle, radius) {
  return {
    minX: obstacle.x - (obstacle.w / 2) - radius,
    maxX: obstacle.x + (obstacle.w / 2) + radius,
    minZ: obstacle.z - (obstacle.h / 2) - radius,
    maxZ: obstacle.z + (obstacle.h / 2) + radius,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distanceToObstacle(position, obstacle, radius = 0) {
  const dx = Math.max(Math.abs(position.x - obstacle.x) - obstacle.w / 2 - radius, 0);
  const dz = Math.max(Math.abs(position.z - obstacle.z) - obstacle.h / 2 - radius, 0);
  return Math.hypot(dx, dz);
}

function getClosestPointOnObstacle(position, obstacle) {
  return new THREE.Vector3(
    clamp(position.x, obstacle.x - obstacle.w / 2, obstacle.x + obstacle.w / 2),
    0,
    clamp(position.z, obstacle.z - obstacle.h / 2, obstacle.z + obstacle.h / 2)
  );
}

function getPenetration(position, obstacle, radius) {
  const bounds = getExpandedBounds(obstacle, radius);
  if (
    position.x < bounds.minX ||
    position.x > bounds.maxX ||
    position.z < bounds.minZ ||
    position.z > bounds.maxZ
  ) {
    return null;
  }

  const pushLeft = bounds.maxX - position.x;
  const pushRight = position.x - bounds.minX;
  const pushUp = bounds.maxZ - position.z;
  const pushDown = position.z - bounds.minZ;
  const minPush = Math.min(pushLeft, pushRight, pushUp, pushDown);

  if (minPush === pushLeft) return new THREE.Vector3(-pushLeft, 0, 0);
  if (minPush === pushRight) return new THREE.Vector3(pushRight, 0, 0);
  if (minPush === pushUp) return new THREE.Vector3(0, 0, -pushUp);
  return new THREE.Vector3(0, 0, pushDown);
}

export function resolveObstacleCollisions(position, radius, obstacles) {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;

    for (const obstacle of obstacles) {
      const push = getPenetration(position, obstacle, radius);
      if (!push) continue;
      position.add(push);
      moved = true;
    }

    if (!moved) break;
  }

  return position;
}

export function getCollisionNormal(position, radius, obstacles) {
  for (const obstacle of obstacles) {
    const closestPoint = getClosestPointOnObstacle(position, obstacle);
    const offset = new THREE.Vector3().subVectors(position, closestPoint);
    const distanceSq = offset.lengthSq();

    if (distanceSq >= radius * radius) continue;

    if (distanceSq > 0.000001) {
      return offset.normalize();
    }

    const dx = position.x - obstacle.x;
    const dz = position.z - obstacle.z;
    if (Math.abs(dx) > Math.abs(dz)) {
      return new THREE.Vector3(Math.sign(dx || 1), 0, 0);
    }
    return new THREE.Vector3(0, 0, Math.sign(dz || 1));
  }

  return null;
}

export function moveWithObstacleCollisions(currentPosition, delta, radius, obstacles) {
  const nextPosition = currentPosition.clone();

  nextPosition.x += delta.x;
  resolveObstacleCollisions(nextPosition, radius, obstacles);

  nextPosition.z += delta.z;
  resolveObstacleCollisions(nextPosition, radius, obstacles);

  return nextPosition;
}

function isPositionBlocked(position, radius, obstacles) {
  return getCollisionNormal(position, radius, obstacles) !== null;
}

function rotateY(vector, angle) {
  return vector.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
}

function getDirectionScore(candidateDirection, desiredDirection, position, radius, obstacles, travelDistance) {
  let alignmentScore = candidateDirection.dot(desiredDirection) * 100;
  const sampleSteps = 3;

  for (let i = 1; i <= sampleSteps; i++) {
    const samplePos = position.clone().add(
      candidateDirection.clone().multiplyScalar((travelDistance * i) / sampleSteps)
    );

    if (isPositionBlocked(samplePos, radius, obstacles)) {
      alignmentScore -= 1000 - (i * 100);
      break;
    }
  }

  return alignmentScore;
}

export function getNavigableDirection(position, desiredDirection, obstacles, radius, travelDistance) {
  if (desiredDirection.lengthSq() < 0.000001) {
    return desiredDirection.clone();
  }

  const normalizedDesired = desiredDirection.clone().normalize();
  const candidateAngles = [
    0,
    Math.PI / 8,
    -Math.PI / 8,
    Math.PI / 4,
    -Math.PI / 4,
    Math.PI / 2,
    -Math.PI / 2,
    (3 * Math.PI) / 4,
    (-3 * Math.PI) / 4,
    Math.PI,
  ];

  let bestDirection = normalizedDesired;
  let bestScore = -Infinity;

  for (const angle of candidateAngles) {
    const candidateDirection = rotateY(normalizedDesired, angle).normalize();
    const score = getDirectionScore(
      candidateDirection,
      normalizedDesired,
      position,
      radius,
      obstacles,
      travelDistance
    );

    if (score > bestScore) {
      bestScore = score;
      bestDirection = candidateDirection;
    }
  }

  return bestDirection;
}

export function findBlockingObstacle(position, direction, obstacles, radius, lookAhead = 12) {
  const normalizedDirection = direction.clone().normalize();
  const sampleSteps = 6;

  for (let i = 1; i <= sampleSteps; i++) {
    const samplePos = position.clone().add(
      normalizedDirection.clone().multiplyScalar((lookAhead * i) / sampleSteps)
    );

    let nearestObstacle = null;
    let nearestDistance = Infinity;

    for (const obstacle of obstacles) {
      if (!isPositionBlocked(samplePos, radius, [obstacle])) continue;
      const distance = distanceToObstacle(position, obstacle, radius);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestObstacle = obstacle;
      }
    }

    if (nearestObstacle) {
      return nearestObstacle;
    }
  }

  return null;
}

export function createBypassWaypoint(position, targetPosition, obstacle, radius) {
  const margin = radius + 2.5;
  const corners = [
    new THREE.Vector3(obstacle.x - obstacle.w / 2 - margin, 0, obstacle.z - obstacle.h / 2 - margin),
    new THREE.Vector3(obstacle.x + obstacle.w / 2 + margin, 0, obstacle.z - obstacle.h / 2 - margin),
    new THREE.Vector3(obstacle.x - obstacle.w / 2 - margin, 0, obstacle.z + obstacle.h / 2 + margin),
    new THREE.Vector3(obstacle.x + obstacle.w / 2 + margin, 0, obstacle.z + obstacle.h / 2 + margin),
  ];

  let bestCorner = corners[0];
  let bestScore = Infinity;

  for (const corner of corners) {
    const score =
      corner.distanceTo(position) +
      (targetPosition ? corner.distanceTo(targetPosition) : 0);

    if (score < bestScore) {
      bestScore = score;
      bestCorner = corner;
    }
  }

  return bestCorner;
}

export function movePlayerWithObstaclePhysics(currentPosition, velocity, radius, obstacles, options = {}) {
  const bounceDamping = options.bounceDamping ?? 0.35;
  const wallFriction = options.wallFriction ?? 0.82;
  const pushbackDistance = options.pushbackDistance ?? 0.18;
  const stepCount = options.stepCount ?? 4;

  const nextPosition = currentPosition.clone();
  const nextVelocity = velocity.clone();
  const stepVelocity = velocity.clone().multiplyScalar(1 / stepCount);
  let collided = false;

  for (let step = 0; step < stepCount; step++) {
    if (stepVelocity.lengthSq() < 0.0000001) break;

    const attemptPosition = nextPosition.clone().add(stepVelocity);
    const collisionNormal = getCollisionNormal(attemptPosition, radius, obstacles);

    if (!collisionNormal) {
      nextPosition.copy(attemptPosition);
      continue;
    }

    collided = true;

    const inwardSpeed = nextVelocity.dot(collisionNormal);
    if (inwardSpeed < 0) {
      nextVelocity.addScaledVector(collisionNormal, -inwardSpeed * (1 + bounceDamping));
    }

    const normalComponent = collisionNormal.clone().multiplyScalar(nextVelocity.dot(collisionNormal));
    nextVelocity.sub(normalComponent);
    nextVelocity.multiplyScalar(wallFriction);

    nextPosition.addScaledVector(collisionNormal, pushbackDistance);
    resolveObstacleCollisions(nextPosition, radius, obstacles);

    stepVelocity.copy(nextVelocity).multiplyScalar(1 / stepCount);
  }

  return { position: nextPosition, velocity: nextVelocity, collided };
}

export function getObstacleSteeredDirection(position, desiredDirection, obstacles, radius, lookAhead = 10) {
  const navigableDirection = getNavigableDirection(position, desiredDirection, obstacles, radius, lookAhead);
  const steering = navigableDirection.clone();
  const ahead = position.clone().add(navigableDirection.clone().multiplyScalar(lookAhead));

  for (const obstacle of obstacles) {
    const bounds = getExpandedBounds(obstacle, radius + 1.5);
    const nearestX = clamp(ahead.x, bounds.minX, bounds.maxX);
    const nearestZ = clamp(ahead.z, bounds.minZ, bounds.maxZ);
    const away = new THREE.Vector3(ahead.x - nearestX, 0, ahead.z - nearestZ);
    const distSq = away.lengthSq();

    if (distSq > (lookAhead * lookAhead)) continue;

    if (distSq < 0.0001) {
      const toCenter = new THREE.Vector3(position.x - obstacle.x, 0, position.z - obstacle.z);
      away.copy(toCenter.lengthSq() > 0.0001 ? toCenter.normalize() : new THREE.Vector3(1, 0, 0));
    } else {
      away.normalize();
    }

    const weight = 1.6 - Math.min(1.4, Math.sqrt(distSq) / Math.max(1, lookAhead));
    steering.addScaledVector(away, weight);
  }

  if (steering.lengthSq() < 0.0001) {
    return navigableDirection.clone();
  }

  return steering.normalize();
}
