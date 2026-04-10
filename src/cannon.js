import * as THREE from 'three';
import { Projectile } from './projectile';
import { attachCannonModel } from './cannonModel';

const AIM_DOT_THRESHOLD = 0.9995;

export class Cannon {
  constructor(scene, parent, offset, config = {}) {
    this.scene = scene;
    this.parent = parent; 
    this.offset = offset;

    // Keep a transform-only anchor so the cannon still has a firing position.
    this.mesh = new THREE.Object3D();
    this.mesh.position.copy(offset);
    this.parent.add(this.mesh);

    attachCannonModel(this.mesh, {
      targetWidth: 0.42,
      targetHeight: 0.42,
      targetLength: 1.15,
      rotationY: -Math.PI / 2,
      offsetY: 0.02,
      offsetZ: -0.05,
    });

    // Stats
    this.range = config.range ?? 35;
    const fireRateMin = config.fireRateMin ?? 1600;
    const fireRateMax = config.fireRateMax ?? 2400;
    this.damage = config.damage ?? 2;
    this.fireRate = fireRateMin + (Math.random() * Math.max(0, fireRateMax - fireRateMin));
    this.lastShotTime = 0;
    this.worldPosition = new THREE.Vector3();
    this.shotDirection = new THREE.Vector3();
    this.aimDirection = new THREE.Vector3();
    this.hasAimDirection = false;
  }

  update(currentTime, targets, projectiles) {
    this.mesh.getWorldPosition(this.worldPosition);

    const nearestEnemy = Array.isArray(targets)
      ? this.findNearestFromArray(targets)
      : targets?.findNearest?.(this.worldPosition, this.range) ?? null;

    if (!nearestEnemy) {
      if (this.hasAimDirection) {
        this.mesh.rotation.set(0, 0, 0);
        this.hasAimDirection = false;
      }
      return;
    }

    this.updateAim(nearestEnemy.mesh.position);

    if (currentTime - this.lastShotTime < this.fireRate) return;

    const dir = this.shotDirection
      .subVectors(nearestEnemy.mesh.position, this.worldPosition)
      .normalize();

    // Scatter effect (approx 90% precision)
    const scatter = 0.18;
    dir.x += (Math.random() - 0.5) * scatter;
    dir.z += (Math.random() - 0.5) * scatter;
    dir.normalize();

    projectiles.push(Projectile.spawn(this.scene, this.worldPosition, dir, 0x00ffff, false, this.damage, this.range * 2));
    this.lastShotTime = currentTime;
  }

  findNearestFromArray(targets) {
    let nearestEnemy = null;
    let minDist = this.range;

    for (const enemy of targets) {
      if (enemy.isDead) continue;

      const dist = this.worldPosition.distanceTo(enemy.mesh.position);
      if (dist < minDist) {
        minDist = dist;
        nearestEnemy = enemy;
      }
    }

    return nearestEnemy;
  }

  remove() {
    this.parent.remove(this.mesh);
  }

  updateAim(targetPosition) {
    this.shotDirection.subVectors(targetPosition, this.worldPosition).normalize();

    if (
      this.hasAimDirection &&
      this.aimDirection.dot(this.shotDirection) >= AIM_DOT_THRESHOLD
    ) {
      return;
    }

    this.mesh.lookAt(targetPosition);
    this.aimDirection.copy(this.shotDirection);
    this.hasAimDirection = true;
  }
}
