import * as THREE from 'three';
import { Projectile } from './projectile';

export class Cannon {
  constructor(scene, parent, offset) {
    this.scene = scene;
    this.parent = parent; 
    this.offset = offset;
    
    // Visuals
    const cannonGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    this.mesh = new THREE.Mesh(cannonGeo, cannonMat);
    this.mesh.position.copy(offset);
    this.parent.add(this.mesh);

    // Stats
    this.range = 35;
    this.fireRate = 1600 + Math.random() * 800; 
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

      projectiles.push(new Projectile(this.scene, worldPos, dir, 0x00ffff, false, 2, this.range * 2));
      this.lastShotTime = currentTime;
    }
  }

  remove() {
    this.parent.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
