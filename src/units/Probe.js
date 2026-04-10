import * as THREE from 'three';
import { Unit } from './Unit';
import { attachSharedShipModel } from '../sharedShipModel';

const AIM_DOT_THRESHOLD = 0.9995;

export class Probe extends Unit {
  constructor(scene, spawnPosition, configOverrides = {}) {
    super(scene, spawnPosition, {
      displayName: 'Probe',
      type: 'probe',
      maxHealth: configOverrides.maxHealth ?? 30,
      speed: configOverrides.speed ?? 0.015,
      aggroRange: configOverrides.aggroRange ?? 40,
      shootInterval: configOverrides.shootInterval ?? 6000,
      damagePerShot: configOverrides.damagePerShot ?? 1.5,
      projectileColor: 0x0088ff,
      projectileIsEnemy: false,
      hitRadius: 1.2,
      baseEmissiveIntensity: 0.3,
    });

    this.bodyMesh = new THREE.Group();
    this.mesh.add(this.bodyMesh);

    this.fallbackBodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.4, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x0088ff,
        emissive: 0x0088ff,
        emissiveIntensity: this.baseEmissiveIntensity,
      })
    );
    this.bodyMesh.add(this.fallbackBodyMesh);

    attachSharedShipModel(this.bodyMesh, {
      targetWidth: 0.8,
      targetHeight: 0.4,
      targetLength: 1.2,
      rotationY: Math.PI / 2,
    }).then((model) => {
      if (model) {
        this.fallbackBodyMesh.visible = false;
      }
    });

    this.cannonMesh = new THREE.Object3D();
    this.cannonMesh.position.z = -0.6;
    this.bodyMesh.add(this.cannonMesh);
    this.targetDirection = new THREE.Vector3();
    this.moveDirection = new THREE.Vector3(0, 0, -1);
    this.worldPosition = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.shotDirection = new THREE.Vector3();
    this.aimDirection = new THREE.Vector3(0, 0, 1);
    this.hasAimDirection = false;

    this.initializeHealthBar(1.2, 0.15, 0x0088ff, 1.2);
  }

  update(targets, projectiles, camera, deltaTime = 1 / 60, obstacles = []) {
    if (this.isDead) return;

    this.updateHealthBarFacing(camera);

    let nearestTarget = null;
    let minDist = this.aggroRange;

    if (Array.isArray(targets)) {
      for (const target of targets) {
        if (target.isDead) continue;
        const dist = this.mesh.position.distanceTo(target.mesh.position);
        if (dist < minDist) {
          minDist = dist;
          nearestTarget = target;
        }
      }
    } else if (targets?.findNearest) {
      nearestTarget = targets.findNearest(this.mesh.position, this.aggroRange);
      if (nearestTarget) {
        minDist = this.mesh.position.distanceTo(nearestTarget.mesh.position);
      }
    }

    if (nearestTarget) {
      const dir = this.targetDirection
        .subVectors(nearestTarget.mesh.position, this.mesh.position)
        .normalize();
      if (minDist > 10) {
        const moveDelta = this.moveWithObstacles(dir, deltaTime, obstacles, nearestTarget.mesh.position);
        if (moveDelta.lengthSq() > 0.000001) {
          this.updateAimFromDirection(moveDelta);
        } else {
          this.updateAimTowardPosition(nearestTarget.mesh.position);
        }
      } else {
        this.updateAimTowardPosition(nearestTarget.mesh.position);
      }

      const currentTime = performance.now();
      if (currentTime - this.lastShotTime > this.shootInterval) {
        this.cannonMesh.getWorldPosition(this.worldPosition);
        const shotDir = this.shotDirection.copy(dir);
        const scatter = 0.14;
        shotDir.x += (Math.random() - 0.5) * scatter;
        shotDir.z += (Math.random() - 0.5) * scatter;
        shotDir.normalize();
        this.fireProjectile(projectiles, this.worldPosition, shotDir);
        this.lastShotTime = currentTime;
      }
    } else {
      const moveDelta = this.moveWithObstacles(this.moveDirection, deltaTime, obstacles);
      if (moveDelta.lengthSq() > 0.000001) {
        this.updateAimFromDirection(moveDelta);
      } else {
        if (this.hasAimDirection) {
          this.mesh.rotation.y = 0;
          this.hasAimDirection = false;
        }
      }
    }

    if (Math.abs(this.mesh.position.z) > this.boundsLimit) {
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
