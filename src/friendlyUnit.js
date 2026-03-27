import * as THREE from 'three';
import { Projectile } from './projectile';

export class FriendlyUnit {
  constructor(scene, spawnPosition) {
    this.scene = scene;
    this.geometry = new THREE.BoxGeometry(0.8, 0.4, 1.2);
    this.material = new THREE.MeshStandardMaterial({ color: 0x0088ff, emissive: 0x0088ff, emissiveIntensity: 0.3 });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.copy(spawnPosition);
    
    // One small cannon
    const cannonGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
    this.cannonMesh = new THREE.Mesh(cannonGeo, cannonMat);
    this.cannonMesh.rotation.x = Math.PI / 2;
    this.cannonMesh.position.z = -0.6;
    this.mesh.add(this.cannonMesh);

    // Stats
    this.health = 5;
    this.speed = 0.03;
    this.isDead = false;
    this.aggroRange = 40;
    this.lastShotTime = 0;
    this.shootInterval = 3000;

    scene.add(this.mesh);
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) this.die();
  }

  die() {
    this.isDead = true;
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }

  update(enemies, allProjectiles) {
    if (this.isDead) return;

    let nearestEnemy = null;
    let minDist = this.aggroRange;

    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dist = this.mesh.position.distanceTo(enemy.mesh.position);
      if (dist < minDist) {
        minDist = dist;
        nearestEnemy = enemy;
      }
    }

    if (nearestEnemy) {
      // Move towards enemy but keep some distance
      const dir = new THREE.Vector3().subVectors(nearestEnemy.mesh.position, this.mesh.position).normalize();
      if (minDist > 10) {
        this.mesh.position.addScaledVector(dir, this.speed);
      }
      this.mesh.lookAt(nearestEnemy.mesh.position);

      // Shoot at enemy
      const currentTime = performance.now();
      if (currentTime - this.lastShotTime > this.shootInterval) {
        const worldPos = new THREE.Vector3();
        this.cannonMesh.getWorldPosition(worldPos);
        allProjectiles.push(new Projectile(this.scene, worldPos, dir, 0x0088ff, false, 1.5));
        this.lastShotTime = currentTime;
      }
    } else {
      // PUSH: Move forward (-Z)
      this.mesh.position.z -= this.speed;
      this.mesh.rotation.y = 0;
    }

    // Remove if way out of bounds
    if (Math.abs(this.mesh.position.z) > 1000) this.die();
  }
}
