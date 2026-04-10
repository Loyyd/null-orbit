import * as THREE from 'three';
import { Projectile } from '../projectile';
import { createSharedModelInstancedRenderer } from '../sharedShipModel';
import { getModelPath } from '../paths';

const HIT_FLASH_DURATION_MS = 80;

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
  pulsar: {
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
  miniPulsar: {
    scale: 1.65,
    baseColor: 0x9f4960,
    speed: 0.026,
    maxHealth: 20,
    aggroRange: 38,
    shootInterval: 5400,
    damagePerShot: 12,
    projectileColor: 0xcc4466,
    hitRadius: 1.55,
  },
  colossus: {
    scale: 5.2,
    baseColor: 0xa23535,
    speed: 0.008,
    maxHealth: 400,
    aggroRange: 60,
    shootInterval: 5200,
    damagePerShot: 18,
    projectileColor: 0xff5555,
    hitRadius: 4.4,
    spawnInterval: 10000,
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
      pulsar: {
        ...UNIT_TYPES.pulsar,
        speed: this.enemyConfig.pulsarSpeed ?? UNIT_TYPES.pulsar.speed,
        aggroRange: this.enemyConfig.pulsarAggroRange ?? UNIT_TYPES.pulsar.aggroRange,
        shootInterval: this.enemyConfig.pulsarShootInterval ?? UNIT_TYPES.pulsar.shootInterval,
        damagePerShot: this.enemyConfig.pulsarDamage ?? UNIT_TYPES.pulsar.damagePerShot,
      },
      miniPulsar: {
        ...UNIT_TYPES.miniPulsar,
      },
      colossus: {
        ...UNIT_TYPES.colossus,
        speed: this.enemyConfig.colossusSpeed ?? this.enemyConfig.starshipSpeed ?? UNIT_TYPES.colossus.speed,
        maxHealth: this.enemyConfig.colossusHealthBase ?? this.enemyConfig.starshipHealthBase ?? UNIT_TYPES.colossus.maxHealth,
        aggroRange: this.enemyConfig.colossusAggroRange ?? this.enemyConfig.starshipAggroRange ?? UNIT_TYPES.colossus.aggroRange,
        shootInterval: this.enemyConfig.colossusShootInterval ?? this.enemyConfig.starshipShootInterval ?? UNIT_TYPES.colossus.shootInterval,
        damagePerShot: this.enemyConfig.colossusDamage ?? this.enemyConfig.starshipDamage ?? UNIT_TYPES.colossus.damagePerShot,
        spawnInterval: this.enemyConfig.colossusSpawnInterval ?? this.enemyConfig.starshipSpawnInterval ?? UNIT_TYPES.colossus.spawnInterval,
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
    this.lastSpawnTime = new Float64Array(this.maxUnits);
    this.hitFlashUntil = new Float64Array(this.maxUnits);
    this.next = new Int32Array(this.maxUnits);
    this.cellHeads = new Int32Array(grid.width * grid.height);
    this.cellHeads.fill(-1);
    this.defaultColor = new THREE.Color(0xffffff);
    this.hitFlashColor = new THREE.Color(0xff4a4a);

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
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.modelRenderers = {
      spark: null,
      pulsar: null,
      colossus: null,
    };
    this.loadedModelRendererCount = 0;

    createSharedModelInstancedRenderer(scene, this.maxUnits, {
      targetWidth: 1,
      targetHeight: 0.45,
      targetLength: 1.4,
      rotationY: Math.PI / 2,
    }, getModelPath('models/player_ship.glb')).then((renderer) => {
      this.modelRenderers.spark = renderer;
      this.onModelRendererReady();
    }).catch((error) => {
      console.error('Failed to create spark instanced renderer:', error);
    });

    createSharedModelInstancedRenderer(scene, this.maxUnits, {
      targetWidth: 1.8,
      targetHeight: 1.4,
      targetLength: 2.8,
      rotationY: Math.PI / 2,
    }, getModelPath('models/colossus.glb')).then((renderer) => {
      this.modelRenderers.pulsar = renderer;
      this.onModelRendererReady();
    }).catch((error) => {
      console.error('Failed to create pulsar instanced renderer:', error);
    });

    createSharedModelInstancedRenderer(scene, this.maxUnits, {
      targetWidth: 5.6,
      targetHeight: 2.4,
      targetLength: 7.5,
      rotationY: -Math.PI / 2,
    }, getModelPath('models/starship.glb')).then((renderer) => {
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

    const normalizedType = type;
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
    const colossusHealthBase = this.enemyConfig.colossusHealthBase ?? this.enemyConfig.starshipHealthBase ?? UNIT_TYPES.colossus.maxHealth;

    this.speed[index] = normalizedType === 'spark'
      ? config.speed + (waveLevel * sparkSpeedPerWave)
      : config.speed;
    this.maxHealth[index] = normalizedType === 'spark'
      ? sparkHealthBase + Math.floor(waveLevel / sparkHealthWaveDivisor)
      : normalizedType === 'colossus'
        ? colossusHealthBase
        : normalizedType === 'miniPulsar'
          ? config.maxHealth
          : pulsarHealthBase + (waveLevel * pulsarHealthPerWave);
    this.health[index] = this.maxHealth[index];
    this.hitRadius[index] = config.hitRadius;
    this.aggroRange[index] = config.aggroRange;
    this.shootInterval[index] = config.shootInterval;
    this.lastShotTime[index] = 0;
    this.lastSpawnTime[index] = performance.now();
    this.hitFlashUntil[index] = 0;
    this.damagePerShot[index] = config.damagePerShot;
    this.scale[index] = config.scale;
    this.typeId[index] = normalizedType === 'pulsar'
      ? 1
      : normalizedType === 'colossus'
        ? 2
        : normalizedType === 'miniPulsar'
          ? 3
          : 0;

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
    this.hitFlashUntil[index] = performance.now() + HIT_FLASH_DURATION_MS;
    this.syncInstanceAt(index, performance.now());
    if (this.health[index] <= 0) {
      this.removeAt(index, 'destroyed');
    }
  }

  removeAt(index, reason = 'despawned') {
    const removedTypeId = this.typeId[index];
    const removedPosition = new THREE.Vector3(this.posX[index], 0, this.posZ[index]);
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
      this.lastSpawnTime[index] = this.lastSpawnTime[lastIndex];
      this.hitFlashUntil[index] = this.hitFlashUntil[lastIndex];

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
        type: removedTypeId === 3
          ? 'miniPulsar'
          : removedTypeId === 2
            ? 'colossus'
            : removedTypeId === 1
              ? 'pulsar'
              : 'spark',
        position: removedPosition,
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
      const strategicTarget = this.findPriorityNavigationTarget(index, combatTargets, navigationTarget);
      const pursuitTarget = strategicTarget?.mesh?.position || navigationTarget;

      if (
        !isFiniteNumber(unitX) ||
        !isFiniteNumber(unitZ) ||
        !isFiniteNumber(this.velX[index]) ||
        !isFiniteNumber(this.velZ[index])
      ) {
        this.removeAt(index, 'invalid');
        continue;
      }

      if (Math.abs(unitZ - pursuitTarget.z) > this.boundsLimit) {
        this.removeAt(index, 'out_of_bounds');
        continue;
      }

      const cellX = this.grid.clampCellX(this.grid.toCellX(unitX));
      const cellY = this.grid.clampCellY(this.grid.toCellY(unitZ));
      const nearestTarget = this.findNearestTarget(index, combatTargets);

      let desiredX = pursuitTarget.x - unitX;
      let desiredZ = pursuitTarget.z - unitZ;

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
        this.spawnProjectilesForUnit(index, nearestTarget, projectiles);
        this.lastShotTime[index] = currentTime;
      }

      if (this.typeId[index] === 2) {
        this.maybeSpawnColossusEscort(index, currentTime);
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

  findPriorityNavigationTarget(index, combatTargets, fallbackTarget) {
    const unitX = this.posX[index];
    const unitZ = this.posZ[index];
    let bestTarget = null;
    let bestScore = Infinity;

    for (const target of combatTargets) {
      if (!target || target.isDead || !target.mesh?.position) continue;

      const dx = target.mesh.position.x - unitX;
      const dz = target.mesh.position.z - unitZ;
      const distance = Math.hypot(dx, dz);
      const priorityWeight = this.getNavigationPriorityWeight(target, fallbackTarget);
      const score = distance * priorityWeight;

      if (score < bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    }

    return bestTarget;
  }

  getNavigationPriorityWeight(target, fallbackTarget) {
    if (target.owner === 'player') {
      return 0.45;
    }

    if (target.type === 'probe') {
      return 0.8;
    }

    if (target.mesh === fallbackTarget) {
      return 1;
    }

    return 1.15;
  }

  syncInstanceAt(index, currentTime = performance.now()) {
    const displayColor = currentTime < this.hitFlashUntil[index] ? this.hitFlashColor : this.defaultColor;
    if (this.hasModelRenderers()) {
      const rendererKey = this.getRendererKeyForIndex(index);
      ['spark', 'pulsar', 'colossus'].forEach((key) => {
        if (key === rendererKey) {
          this.modelRenderers[key]?.setInstanceTransform(
            index,
            this.posX[index],
            this.posZ[index],
            this.yaw[index],
            this.scale[index]
          );
          this.modelRenderers[key]?.setInstanceColor(index, displayColor);
        } else {
          this.modelRenderers[key]?.hideInstance(index);
        }
      });
      return;
    }

    this.dummy.position.set(this.posX[index], 0, this.posZ[index]);
    this.dummy.rotation.set(0, this.yaw[index], 0);
    this.dummy.scale.set(this.scale[index], this.scale[index], this.scale[index]);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
    this.mesh.setColorAt(index, displayColor);
  }

  hasModelRenderers() {
    return Boolean(this.modelRenderers.spark && this.modelRenderers.pulsar && this.modelRenderers.colossus);
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
    this.modelRenderers.pulsar?.setCount(this.count);
    this.modelRenderers.colossus?.setCount(this.count);
  }

  flushModelRenderers() {
    this.modelRenderers.spark?.flush();
    this.modelRenderers.pulsar?.flush();
    this.modelRenderers.colossus?.flush();
  }

  hideAllModelRenderersAt(index) {
    this.modelRenderers.spark?.hideInstance(index);
    this.modelRenderers.pulsar?.hideInstance(index);
    this.modelRenderers.colossus?.hideInstance(index);
  }

  getRendererKeyForIndex(index) {
    if (this.typeId[index] === 3) {
      return 'pulsar';
    }
    return this.typeId[index] === 2 ? 'colossus' : this.typeId[index] === 1 ? 'pulsar' : 'spark';
  }

  spawnProjectilesForUnit(index, nearestTarget, projectiles) {
    const typeKey = this.getRendererKeyForIndex(index);
    const projectileColor = this.unitTypes[typeKey].projectileColor;
    const unitPosition = new THREE.Vector3(this.posX[index], 0, this.posZ[index]);

    if (typeKey === 'colossus') {
      const yaw = this.yaw[index];
      const offsets = [
        new THREE.Vector3(-1.8, 0, 2.2),
        new THREE.Vector3(1.8, 0, 2.2),
        new THREE.Vector3(-1.2, 0, -0.2),
        new THREE.Vector3(1.2, 0, -0.2),
      ];
      const rotation = new THREE.Euler(0, yaw, 0);

      offsets.forEach((offset) => {
        this.projectilePosition.copy(offset).applyEuler(rotation).add(unitPosition);
        this.spawnPosition.copy(nearestTarget.mesh.position).sub(this.projectilePosition).normalize();
        projectiles.push(
          Projectile.spawn(
            this.scene,
            this.projectilePosition,
            this.spawnPosition,
            projectileColor,
            true,
            this.damagePerShot[index],
            this.aggroRange[index] * 2
          )
        );
      });
      return;
    }

    this.projectilePosition.copy(unitPosition);
    this.spawnPosition.copy(nearestTarget.mesh.position).sub(this.projectilePosition).normalize();
    projectiles.push(
      Projectile.spawn(
        this.scene,
        this.projectilePosition,
        this.spawnPosition,
        projectileColor,
        true,
        this.damagePerShot[index],
        this.aggroRange[index] * 2
      )
    );
  }

  maybeSpawnColossusEscort(index, currentTime) {
    const spawnInterval = this.unitTypes.colossus.spawnInterval;
    if (currentTime - this.lastSpawnTime[index] < spawnInterval) {
      return;
    }

    const yaw = this.yaw[index];
    const spawnOffsets = [
      new THREE.Vector3(-3.5, 0, -4.5),
      new THREE.Vector3(0, 0, -5.5),
      new THREE.Vector3(3.5, 0, -4.5),
    ];
    const rotation = new THREE.Euler(0, yaw, 0);

    spawnOffsets.forEach((offset) => {
      const spawnPosition = offset.clone().applyEuler(rotation).add(new THREE.Vector3(this.posX[index], 0, this.posZ[index]));
      this.spawn(spawnPosition, 'miniPulsar', 1);
    });

    this.lastSpawnTime[index] = currentTime;
  }
}
