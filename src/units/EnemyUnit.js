import * as THREE from 'three';
import { Unit } from './Unit';
import { attachSharedModel } from '../sharedShipModel';
import { getAssetPath } from '../paths';

const AIM_DOT_THRESHOLD = 0.9995;

export class EnemyUnit extends Unit {
  constructor(scene, spawnPosition, config) {
    super(scene, spawnPosition, {
      ...config,
      projectileIsEnemy: true,
      boundsLimit: 150,
      hitRadius: config.hitRadius || (config.size || 1.2) * 0.9,
      baseEmissiveIntensity: 0.2,
    });

    this.size = config.size;
    this.idleSpeedMultiplier = config.idleSpeedMultiplier || 0.5;
    this.idleDriftAmplitude = config.idleDriftAmplitude || 0.01;
    this.cannonOffsets = config.cannonOffsets;
    this.defaultLookRotationY = Math.PI;
    this.targetDirection = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.worldPosition = new THREE.Vector3();
    this.shotDirection = new THREE.Vector3();
    this.idleDirection = new THREE.Vector3();
    this.aimDirection = new THREE.Vector3(0, 0, -1);
    this.hasAimDirection = false;

    this.bodyMesh = new THREE.Group();
    this.mesh.add(this.bodyMesh);

    this.fallbackBodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.size, this.size * 0.5, this.size * 1.5),
      new THREE.MeshStandardMaterial({
        color: config.bodyColor,
        emissive: config.bodyColor,
        emissiveIntensity: this.baseEmissiveIntensity,
      })
    );
    this.bodyMesh.add(this.fallbackBodyMesh);

    attachSharedModel(this.bodyMesh, {
      targetWidth: this.size,
      targetHeight: this.size * 0.5,
      targetLength: this.size * 1.5,
      rotationY: Math.PI / 2,
    }, config.modelPath || getAssetPath('models/player_ship.glb')).then((model) => {
      if (model) {
        this.fallbackBodyMesh.visible = false;
      }
    });

    this.cannons = [];
    this.cannonOffsets.forEach((offset) => {
      const cannon = new THREE.Object3D();
      cannon.position.copy(offset);
      this.bodyMesh.add(cannon);
      this.cannons.push(cannon);
    });

    this.initializeHealthBar(this.size, 0.15, config.healthBarColor, this.size);
  }

  configureForWave() {}

  update(playerTarget, projectiles, camera, probes = [], baseTargets = [], deltaTime = 1 / 60, obstacles = []) {
    if (this.isDead) return;

    this.updateHealthBarFacing(camera);

    let target = null;
    let minDist = Infinity;

    if (!playerTarget.isDead) {
      minDist = this.mesh.position.distanceTo(playerTarget.mesh.position);
      target = playerTarget.mesh;
    }

    for (const probe of probes) {
      if (probe.isDead) continue;
      const dist = this.mesh.position.distanceTo(probe.mesh.position);
      if (dist < minDist) {
        minDist = dist;
        target = probe.mesh;
      }
    }

    for (const base of baseTargets) {
      if (base.isDead) continue;
      const dist = this.mesh.position.distanceTo(base.mesh.position);
      if (dist < minDist) {
        minDist = dist;
        target = base.mesh;
      }
    }

    if (target && minDist < this.aggroRange) {
      const targetPos = target.position;
      const desiredDir = this.targetDirection.subVectors(targetPos, this.mesh.position).normalize();
      const moveDelta = this.moveWithObstacles(desiredDir, deltaTime, obstacles, targetPos);
      if (moveDelta.lengthSq() > 0.000001) {
        this.updateAimFromDirection(moveDelta);
      } else {
        this.updateAimTowardPosition(targetPos);
      }

      const currentTime = performance.now();
      if (currentTime - this.lastShotTime > this.shootInterval) {
        this.cannons.forEach((cannon) => {
          cannon.getWorldPosition(this.worldPosition);
          const shotDir = this.shotDirection.subVectors(targetPos, this.worldPosition).normalize();
          this.fireProjectile(projectiles, this.worldPosition, shotDir);
        });
        this.lastShotTime = currentTime;
      }
    } else {
      const idleDir = this.idleDirection.set(
        Math.sin(Date.now() * 0.001) * this.idleDriftAmplitude * 20,
        0,
        this.idleSpeedMultiplier
      ).normalize();
      const moveDelta = this.moveWithObstacles(idleDir, deltaTime, obstacles);
      if (moveDelta.lengthSq() > 0.000001) {
        this.updateAimFromDirection(moveDelta);
      } else {
        if (this.hasAimDirection) {
          this.mesh.rotation.y = this.defaultLookRotationY;
          this.hasAimDirection = false;
        }
      }
    }

    if (Math.abs(this.mesh.position.z - (playerTarget.mesh ? playerTarget.mesh.position.z : 0)) > this.boundsLimit) {
      this.die();
    }
  }

  updateAimTowardPosition(targetPosition) {
    this.targetDirection.subVectors(targetPosition, this.mesh.position).normalize();
    this.updateAimFromNormalizedDirection(this.targetDirection, targetPosition);
  }

  updateAimFromDirection(direction) {
    this.targetDirection.copy(direction).normalize();
    this.lookTarget.copy(this.mesh.position).add(this.targetDirection);
    this.updateAimFromNormalizedDirection(this.targetDirection, this.lookTarget);
  }

  updateAimFromNormalizedDirection(direction, lookTarget) {
    if (
      this.hasAimDirection &&
      this.aimDirection.dot(direction) >= AIM_DOT_THRESHOLD
    ) {
      return;
    }

    this.mesh.lookAt(lookTarget);
    this.aimDirection.copy(direction);
    this.hasAimDirection = true;
  }
}
