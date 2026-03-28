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
    this.maxHealth = 10;
    this.health = this.maxHealth;
    this.speed = 0.015;
    this.isDead = false;
    this.aggroRange = 40;
    this.lastShotTime = 0;
    this.shootInterval = 6000;

    // Mini Health Bar UI
    this.healthBarGroup = new THREE.Group();
    const size = 1.2;
    const bgGeo = new THREE.PlaneGeometry(size, 0.15);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    this.hpBg = new THREE.Mesh(bgGeo, bgMat);
    
    const fgGeo = new THREE.PlaneGeometry(size, 0.15);
    const fgMat = new THREE.MeshBasicMaterial({ color: 0x0088ff });
    this.hpFg = new THREE.Mesh(fgGeo, fgMat);
    this.hpFg.position.z = 0.01;
    
    this.healthBarGroup.add(this.hpBg);
    this.healthBarGroup.add(this.hpFg);
    this.healthBarGroup.position.y = 1.2;
    this.healthBarGroup.visible = false;
    this.mesh.add(this.healthBarGroup);

    scene.add(this.mesh);
  }

  takeDamage(amount) {
    this.health -= amount;
    this.healthBarGroup.visible = true;
    
    const healthPercent = Math.max(0, this.health / this.maxHealth);
    this.hpFg.scale.x = healthPercent;
    this.hpFg.position.x = -(1 - healthPercent) * (1.2 / 2); // Corrected for bar width (size = 1.2)

    if (this.health <= 0) {
      this.die();
    } else {
      this.material.emissiveIntensity = 1;
      setTimeout(() => { if (!this.isDead) this.material.emissiveIntensity = 0.3; }, 50);
    }
  }

  die() {
    this.isDead = true;
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }

  update(targets, allProjectiles, camera) {
    if (this.isDead) return;

    if (this.healthBarGroup.visible && camera) {
      this.healthBarGroup.quaternion.copy(camera.quaternion);
    }

    let nearestEnemy = null;
    let minDist = this.aggroRange;

    for (const enemy of targets) {
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
