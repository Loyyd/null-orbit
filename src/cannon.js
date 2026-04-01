import * as THREE from 'three';
import { Projectile } from './projectile';

export class Cannon {
  constructor(scene, parent, offset, config = {}) {
    this.scene = scene;
    this.parent = parent; 
    this.offset = offset;

    // Keep a transform-only anchor so the cannon still has a firing position.
    this.mesh = new THREE.Object3D();
    this.mesh.position.copy(offset);
    this.parent.add(this.mesh);

    // Stats
    this.range = config.range ?? 35;
    const fireRateMin = config.fireRateMin ?? 1600;
    const fireRateMax = config.fireRateMax ?? 2400;
    this.damage = config.damage ?? 2;
    this.fireRate = fireRateMin + (Math.random() * Math.max(0, fireRateMax - fireRateMin));
    this.lastShotTime = 0;
  }

  update(currentTime, targets, projectiles) {
    if (currentTime - this.lastShotTime < this.fireRate) return;

    const worldPos = new THREE.Vector3();
    this.mesh.getWorldPosition(worldPos);

    let nearestEnemy = null;
    let minDist = this.range;

    for (const enemy of targets) {
      if (enemy.isDead) continue;
      
      const dist = worldPos.distanceTo(enemy.mesh.position);
      if (dist < minDist) {
        minDist = dist;
        nearestEnemy = enemy;
      }
    }

    if (nearestEnemy) {
      const dir = new THREE.Vector3().subVectors(nearestEnemy.mesh.position, worldPos).normalize();
      
      // Scatter effect (approx 90% precision)
      const scatter = 0.12;
      dir.x += (Math.random() - 0.5) * scatter;
      dir.z += (Math.random() - 0.5) * scatter;
      dir.normalize();

      projectiles.push(new Projectile(this.scene, worldPos, dir, 0x00ffff, false, this.damage, this.range * 2));
      this.lastShotTime = currentTime;
    }
  }

  remove() {
    this.parent.remove(this.mesh);
  }
}
