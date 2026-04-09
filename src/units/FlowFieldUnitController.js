import * as THREE from 'three';
import { Projectile } from '../projectile';
import { createSharedModelInstancedRenderer } from '../sharedShipModel';

const UNIT_TYPES = {
  spark: {
    scale: 1.2,
    baseColor: 0xff3355,
    speed: 0.04,
    maxHealth: 15,
    aggroRange: 35,
    shootInterval: 8000,
    damagePerShot: 15,
    projectileColor: 0xaa00ff,
    hitRadius: 1.1,
  },
  colossus: {
    scale: 2.5,
    baseColor: 0xaa55ff,
    speed: 0.022,
    maxHealth: 50,
    aggroRange: 45,
    shootInterval: 4800,
    damagePerShot: 25,
    projectileColor: 0xaa00ff,
    hitRadius: 2.2,
  },
};

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function createTargetProxy(controller, index, type) {
  const proxy = {
    controller,
    index,
    type,
    mesh: {
      position: new THREE.Vector3(),
    },
    hitRadius: 1.5,
    isDead: false,
    takeDamage(amount) {
      proxy.controller.takeDamage(proxy.index, amount);
    },
  };

  return proxy;
}

export class FlowFieldUnitController {
  constructor(scene, occupancyMap, grid, options = {}) {
    this.scene = scene;
    this.grid = grid;
    this.occupancyMap = occupancyMap;
    this.enemyConfig = options.enemyConfig || {};
    this.unitTypes = {
      spark: {
        ...UNIT_TYPES.spark,
        speed: this.enemyConfig.sparkSpeedBase ?? UNIT_TYPES.spark.speed,
        aggroRange: this.enemyConfig.sparkAggroRange ?? UNIT_TYPES.spark.aggroRange,
        shootInterval: this.enemyConfig.sparkShootInterval ?? UNIT_TYPES.spark.shootInterval,
        damagePerShot: this.enemyConfig.sparkDamage ?? UNIT_TYPES.spark.damagePerShot,
      },
      colossus: {
        ...UNIT_TYPES.colossus,
        speed: this.enemyConfig.colossusSpeed ?? this.enemyConfig.pulsarSpeed ?? UNIT_TYPES.colossus.speed,
        aggroRange: this.enemyConfig.colossusAggroRange ?? this.enemyConfig.pulsarAggroRange ?? UNIT_TYPES.colossus.aggroRange,
        shootInterval: this.enemyConfig.colossusShootInterval ?? this.enemyConfig.pulsarShootInterval ?? UNIT_TYPES.colossus.shootInterval,
        damagePerShot: this.enemyConfig.colossusDamage ?? this.enemyConfig.pulsarDamage ?? UNIT_TYPES.colossus.damagePerShot,
      },
    };
    this.maxUnits = options.maxUnits || 1024;
    this.count = 0;
    this.targets = [];
    this.targetCellX = -1;
    this.targetCellY = -1;
    this.separationRadius = options.separationRadius || grid.cellSize * 0.85;
    this.separationStrength = options.separationStrength || 0.12;
    this.obstacleAvoidanceStrength = options.obstacleAvoidanceStrength || 0.35;
    this.acceleration = options.acceleration || 0.35;
    this.boundsLimit = options.boundsLimit || 180;
    this.onEnemyDestroyed = options.onEnemyDestroyed || null;

    this.posX = new Float32Array(this.maxUnits);
    this.posZ = new Float32Array(this.maxUnits);
    this.velX = new Float32Array(this.maxUnits);
    this.velZ = new Float32Array(this.maxUnits);
    this.yaw = new Float32Array(this.maxUnits);
    this.speed = new Float32Array(this.maxUnits);
    this.health = new Float32Array(this.maxUnits);
    this.maxHealth = new Float32Array(this.maxUnits);
    this.hitRadius = new Float32Array(this.maxUnits);
    this.aggroRange = new Float32Array(this.maxUnits);
    this.shootInterval = new Float32Array(this.maxUnits);
    this.lastShotTime = new Float64Array(this.maxUnits);
    this.damagePerShot = new Float32Array(this.maxUnits);
    this.scale = new Float32Array(this.maxUnits);
    this.typeId = new Uint8Array(this.maxUnits);
    this.next = new Int32Array(this.maxUnits);
    this.cellHeads = new Int32Array(grid.width * grid.height);
    this.cellHeads.fill(-1);

    this.geometry = new THREE.BoxGeometry(1, 0.45, 1.4);
    this.material = new THREE.MeshStandardMaterial({
      color: 0xff4455,
      emissive: 0x441111,
      emissiveIntensity: 0.35,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.maxUnits);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.modelRenderers = {
      spark: null,
      colossus: null,
    };
    this.loadedModelRendererCount = 0;

    createSharedModelInstancedRenderer(scene, this.maxUnits, {
      targetWidth: 1,
      targetHeight: 0.45,
      targetLength: 1.4,
      rotationY: -Math.PI / 2,
    }, '/models/player_ship.glb').then((renderer) => {
      this.modelRenderers.spark = renderer;
      this.onModelRendererReady();
    }).catch((error) => {
      console.error('Failed to create spark instanced renderer:', error);
    });

    createSharedModelInstancedRenderer(scene, this.maxUnits, {
      targetWidth: 1.8,
      targetHeight: 1.4,
      targetLength: 2.8,
      rotationY: -Math.PI / 2,
    }, '/models/colossus.glb').then((renderer) => {
      this.modelRenderers.colossus = renderer;
      this.onModelRendererReady();
    }).catch((error) => {
      console.error('Failed to create colossus instanced renderer:', error);
    });

    this.dummy = new THREE.Object3D();
    this.spawnPosition = new THREE.Vector3();
    this.projectilePosition = new THREE.Vector3();
  }

  get length() {
    return this.count;
  }

  spawn(spawnPosition, type = 'spark', waveLevel = 1) {
    if (this.count >= this.maxUnits) {
      return null;
    }

    const normalizedType = type === 'pulsar' ? 'colossus' : type;
    const config = this.unitTypes[normalizedType] || this.unitTypes.spark;
    const index = this.count++;
    this.posX[index] = spawnPosition.x;
    this.posZ[index] = spawnPosition.z;
    this.velX[index] = 0;
    this.velZ[index] = 0;
    this.yaw[index] = Math.PI;
    const sparkSpeedPerWave = this.enemyConfig.sparkSpeedPerWave ?? 0.0025;
    const sparkHealthBase = this.enemyConfig.sparkHealthBase ?? 3;
    const sparkHealthWaveDivisor = this.enemyConfig.sparkHealthWaveDivisor ?? 3;
    const pulsarHealthBase = this.enemyConfig.pulsarHealthBase ?? 15;
    const pulsarHealthPerWave = this.enemyConfig.pulsarHealthPerWave ?? 2;

    this.speed[index] = config.speed + (type === 'spark' ? waveLevel * sparkSpeedPerWave : 0);
    this.maxHealth[index] = normalizedType === 'spark'
      ? sparkHealthBase + Math.floor(waveLevel / sparkHealthWaveDivisor)
      : pulsarHealthBase + (waveLevel * pulsarHealthPerWave);
    this.health[index] = this.maxHealth[index];
    this.hitRadius[index] = config.hitRadius;
    this.aggroRange[index] = config.aggroRange;
    this.shootInterval[index] = config.shootInterval;
    this.lastShotTime[index] = 0;
    this.damagePerShot[index] = config.damagePerShot;
    this.scale[index] = config.scale;
    this.typeId[index] = normalizedType === 'colossus' ? 1 : 0;

    const proxy = createTargetProxy(this, index, normalizedType);
    proxy.hitRadius = this.hitRadius[index];
    proxy.mesh.position.set(this.posX[index], 0, this.posZ[index]);
    this.targets.push(proxy);
    this.syncInstanceAt(index);
    if (this.hasModelRenderers()) {
      this.updateRendererCounts();
    } else {
      this.mesh.count = this.count;
    }
    return proxy;
  }

  takeDamage(index, amount) {
    if (index < 0 || index >= this.count) return;

    this.health[index] -= amount;
    if (this.health[index] <= 0) {
      this.removeAt(index, 'destroyed');
    }
  }

  removeAt(index, reason = 'despawned') {
    const removedTypeId = this.typeId[index];
    const lastIndex = this.count - 1;
    const removedProxy = this.targets[index];
    if (removedProxy) {
      removedProxy.isDead = true;
      removedProxy.index = -1;
    }

    if (index !== lastIndex) {
      this.posX[index] = this.posX[lastIndex];
      this.posZ[index] = this.posZ[lastIndex];
      this.velX[index] = this.velX[lastIndex];
      this.velZ[index] = this.velZ[lastIndex];
      this.yaw[index] = this.yaw[lastIndex];
      this.speed[index] = this.speed[lastIndex];
      this.health[index] = this.health[lastIndex];
      this.maxHealth[index] = this.maxHealth[lastIndex];
      this.hitRadius[index] = this.hitRadius[lastIndex];
      this.aggroRange[index] = this.aggroRange[lastIndex];
      this.shootInterval[index] = this.shootInterval[lastIndex];
      this.lastShotTime[index] = this.lastShotTime[lastIndex];
      this.damagePerShot[index] = this.damagePerShot[lastIndex];
      this.scale[index] = this.scale[lastIndex];
      this.typeId[index] = this.typeId[lastIndex];

      const movedProxy = this.targets[lastIndex];
      this.targets[index] = movedProxy;
      movedProxy.index = index;
      movedProxy.hitRadius = this.hitRadius[index];
      movedProxy.mesh.position.set(this.posX[index], 0, this.posZ[index]);
      this.syncInstanceAt(index);
    }

    this.targets.pop();
    this.count--;
    if (reason === 'destroyed') {
      this.onEnemyDestroyed?.({
        type: removedTypeId === 1 ? 'colossus' : 'spark',
      });
    }
    if (this.hasModelRenderers()) {
      this.hideAllModelRenderersAt(this.count);
      this.updateRendererCounts();
      this.flushModelRenderers();
    } else if (this.count >= 0) {
      this.mesh.count = this.count;
      this.dummy.position.set(0, -9999, 0);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(this.count, this.dummy.matrix);
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  update(deltaTime, navigationTarget, combatTargets, projectiles) {
    this.rebuildSpatialHash();

    const timeScale = deltaTime * 60;
    const steeringLerp = Math.min(1, this.acceleration * timeScale);
    const currentTime = performance.now();

    for (let index = this.count - 1; index >= 0; index--) {
      const unitX = this.posX[index];
      const unitZ = this.posZ[index];

      if (
        !isFiniteNumber(unitX) ||
        !isFiniteNumber(unitZ) ||
        !isFiniteNumber(this.velX[index]) ||
        !isFiniteNumber(this.velZ[index])
      ) {
        this.removeAt(index, 'invalid');
        continue;
      }

      if (Math.abs(unitZ - navigationTarget.z) > this.boundsLimit) {
        this.removeAt(index, 'out_of_bounds');
        continue;
      }

      const cellX = this.grid.clampCellX(this.grid.toCellX(unitX));
      const cellY = this.grid.clampCellY(this.grid.toCellY(unitZ));
      const nearestTarget = this.findNearestTarget(index, combatTargets);

      let desiredX = navigationTarget.x - unitX;
      let desiredZ = navigationTarget.z - unitZ;

      if (nearestTarget) {
        desiredX = nearestTarget.mesh.position.x - unitX;
        desiredZ = nearestTarget.mesh.position.z - unitZ;
      }

      const baseLength = Math.hypot(desiredX, desiredZ) || 1;
      desiredX /= baseLength;
      desiredZ /= baseLength;

      const separation = this.computeSeparation(index, cellX, cellY);
      desiredX += separation.x;
      desiredZ += separation.z;

      const desiredLength = Math.hypot(desiredX, desiredZ) || 1;
      desiredX /= desiredLength;
      desiredZ /= desiredLength;

      if (!isFiniteNumber(desiredX) || !isFiniteNumber(desiredZ)) {
        desiredX = 0;
        desiredZ = 1;
      }

      const speed = this.speed[index];
      this.velX[index] += ((desiredX * speed) - this.velX[index]) * steeringLerp;
      this.velZ[index] += ((desiredZ * speed) - this.velZ[index]) * steeringLerp;

      this.posX[index] += this.velX[index] * timeScale;
      this.posZ[index] += this.velZ[index] * timeScale;

      const movedX = this.velX[index];
      const movedZ = this.velZ[index];
      if ((movedX * movedX) + (movedZ * movedZ) > 0.0001) {
        this.yaw[index] = Math.atan2(movedX, movedZ);
      }

      const proxy = this.targets[index];
      if (!proxy?.mesh?.position) {
        this.removeAt(index, 'invalid');
        continue;
      }
      proxy.mesh.position.set(this.posX[index], 0, this.posZ[index]);
      this.syncInstanceAt(index);

      if (
        nearestTarget &&
        currentTime - this.lastShotTime[index] >= this.shootInterval[index]
      ) {
        this.projectilePosition.set(this.posX[index], 0, this.posZ[index]);
        this.spawnPosition.copy(nearestTarget.mesh.position).sub(this.projectilePosition).normalize();
        projectiles.push(
          new Projectile(
            this.scene,
            this.projectilePosition,
            this.spawnPosition,
            this.unitTypes[this.typeId[index] === 1 ? 'colossus' : 'spark'].projectileColor,
            true,
            this.damagePerShot[index],
            this.aggroRange[index] * 2
          )
        );
        this.lastShotTime[index] = currentTime;
      }
    }

    if (this.hasModelRenderers()) {
      this.flushModelRenderers();
    } else {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) {
        this.mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  dispose() {
    if (this.modelRenderers.spark) {
      this.modelRenderers.spark.dispose();
    }
    if (this.modelRenderers.colossus) {
      this.modelRenderers.colossus.dispose();
    }
    if (this.hasModelRenderers()) {
      return;
    }

    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }

  rebuildSpatialHash() {
    this.cellHeads.fill(-1);

    for (let index = 0; index < this.count; index++) {
      const cellX = this.grid.clampCellX(this.grid.toCellX(this.posX[index]));
      const cellY = this.grid.clampCellY(this.grid.toCellY(this.posZ[index]));
      const cellIndex = (cellY * this.grid.width) + cellX;
      this.next[index] = this.cellHeads[cellIndex];
      this.cellHeads[cellIndex] = index;
    }
  }

  computeSeparation(index, cellX, cellY) {
    let forceX = 0;
    let forceY = 0;
    const radiusSq = this.separationRadius * this.separationRadius;
    const px = this.posX[index];
    const pz = this.posZ[index];

    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      const neighborY = cellY + offsetY;
      if (neighborY < 0 || neighborY >= this.grid.height) continue;

      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        const neighborX = cellX + offsetX;
        if (neighborX < 0 || neighborX >= this.grid.width) continue;

        let neighborIndex = this.cellHeads[(neighborY * this.grid.width) + neighborX];
        while (neighborIndex !== -1) {
          if (neighborIndex !== index) {
            const dx = px - this.posX[neighborIndex];
            const dz = pz - this.posZ[neighborIndex];
            const distanceSq = (dx * dx) + (dz * dz);

            if (distanceSq > 0.0001 && distanceSq < radiusSq) {
              const distance = Math.sqrt(distanceSq);
              const weight = (this.separationRadius - distance) / this.separationRadius;
              forceX += (dx / distance) * weight;
              forceY += (dz / distance) * weight;
            }
          }

          neighborIndex = this.next[neighborIndex];
        }
      }
    }

    return {
      x: forceX * this.separationStrength,
      y: forceY * this.separationStrength,
    };
  }

  findNearestTarget(index, combatTargets) {
    const range = this.aggroRange[index];
    const rangeSq = range * range;
    const unitX = this.posX[index];
    const unitZ = this.posZ[index];
    let nearestTarget = null;
    let nearestDistanceSq = rangeSq;

    for (const target of combatTargets) {
      if (!target || target.isDead) continue;

      const dx = target.mesh.position.x - unitX;
      const dz = target.mesh.position.z - unitZ;
      const distanceSq = (dx * dx) + (dz * dz);
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearestTarget = target;
      }
    }

    return nearestTarget;
  }

  syncInstanceAt(index) {
    if (this.hasModelRenderers()) {
      const rendererKey = this.typeId[index] === 1 ? 'colossus' : 'spark';
      const otherRendererKey = rendererKey === 'spark' ? 'colossus' : 'spark';
      this.modelRenderers[rendererKey]?.setInstanceTransform(
        index,
        this.posX[index],
        this.posZ[index],
        this.yaw[index],
        this.scale[index]
      );
      this.modelRenderers[otherRendererKey]?.hideInstance(index);
      return;
    }

    this.dummy.position.set(this.posX[index], 0, this.posZ[index]);
    this.dummy.rotation.set(0, this.yaw[index], 0);
    this.dummy.scale.set(this.scale[index], this.scale[index], this.scale[index]);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
  }

  hasModelRenderers() {
    return Boolean(this.modelRenderers.spark && this.modelRenderers.colossus);
  }

  onModelRendererReady() {
    this.loadedModelRendererCount += 1;
    if (!this.hasModelRenderers()) return;

    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.mesh = null;

    for (let index = 0; index < this.count; index++) {
      this.syncInstanceAt(index);
    }
    this.updateRendererCounts();
    this.flushModelRenderers();
  }

  updateRendererCounts() {
    this.modelRenderers.spark?.setCount(this.count);
    this.modelRenderers.colossus?.setCount(this.count);
  }

  flushModelRenderers() {
    this.modelRenderers.spark?.flush();
    this.modelRenderers.colossus?.flush();
  }

  hideAllModelRenderersAt(index) {
    this.modelRenderers.spark?.hideInstance(index);
    this.modelRenderers.colossus?.hideInstance(index);
  }
}
