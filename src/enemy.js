import * as THREE from 'three';
import { Projectile } from './projectile';

export class Enemy {
  constructor(scene, spawnPosition, type = 'scout') {
    this.scene = scene;
    this.type = type;
    
    // Base stats
    this.maxHealth = type === 'tank' ? 15 : 3;
    this.health = this.maxHealth;
    this.speed = type === 'tank' ? 0.015 : 0.04;
    this.aggroRange = type === 'tank' ? 45 : 35;
    this.shootInterval = type === 'tank' ? 2400 : 4000;
    this.damagePerShot = type === 'tank' ? 25 : 15;

    // Visuals based on type
    const size = type === 'tank' ? 2.5 : 1.2;
    this.geometry = new THREE.BoxGeometry(size, size * 0.5, size * 1.5);
    const color = type === 'tank' ? 0xaa00ff : 0xff0000; // Purple for tanks
    this.material = new THREE.MeshStandardMaterial({ 
      color: color, 
      emissive: color, 
      emissiveIntensity: 0.2 
    });
    
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.copy(spawnPosition);
    
    // Add Cannons
    const cannonCount = type === 'tank' ? 2 : 1;
    this.cannons = [];
    for (let i = 0; i < cannonCount; i++) {
      const cannonGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8);
      const cannonMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const cannon = new THREE.Mesh(cannonGeo, cannonMat);
      cannon.rotation.x = Math.PI / 2;
      
      if (type === 'tank') {
        cannon.position.set(i === 0 ? -0.8 : 0.8, 0, -1.2);
      } else {
        cannon.position.z = -1;
      }
      
      this.mesh.add(cannon);
      this.cannons.push(cannon);
    }

    // Mini Health Bar UI
    this.healthBarGroup = new THREE.Group();
    const bgGeo = new THREE.PlaneGeometry(size, 0.15);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    this.hpBg = new THREE.Mesh(bgGeo, bgMat);
    
    const fgGeo = new THREE.PlaneGeometry(size, 0.15);
    const fgMat = new THREE.MeshBasicMaterial({ color: type === 'tank' ? 0xaa00ff : 0xff0055 });
    this.hpFg = new THREE.Mesh(fgGeo, fgMat);
    this.hpFg.position.z = 0.01;
    
    this.healthBarGroup.add(this.hpBg);
    this.healthBarGroup.add(this.hpFg);
    this.healthBarGroup.position.y = size;
    this.healthBarGroup.visible = false;
    this.mesh.add(this.healthBarGroup);

    this.isDead = false;
    this.lastShotTime = 0;
    scene.add(this.mesh);
  }

  takeDamage(amount) {
    this.health -= amount;
    this.healthBarGroup.visible = true;
    
    const healthPercent = Math.max(0, this.health / this.maxHealth);
    this.hpFg.scale.x = healthPercent;
    this.hpFg.position.x = -(1 - healthPercent) * (this.geometry.parameters.width / 2);

    if (this.health <= 0) {
      this.die();
    } else {
      this.material.emissiveIntensity = 1;
      setTimeout(() => { if (!this.isDead) this.material.emissiveIntensity = 0.2; }, 50);
    }
  }

  die() {
    this.isDead = true;
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }

  update(playerTarget, allProjectiles, camera, friendlyUnits = []) {
    if (this.isDead) return;

    if (this.healthBarGroup.visible) {
      this.healthBarGroup.quaternion.copy(camera.quaternion);
    }

    let target = null;
    let minDist = Infinity;

    if (!playerTarget.isDead) {
      minDist = this.mesh.position.distanceTo(playerTarget.mesh.position);
      target = playerTarget.mesh;
    }

    for (const unit of friendlyUnits) {
      if (unit.isDead) continue;
      const dist = this.mesh.position.distanceTo(unit.mesh.position);
      if (dist < minDist) {
        minDist = dist;
        target = unit.mesh;
      }
    }
    
    if (target && minDist < this.aggroRange) {
      const targetPos = target.position;
      const dir = new THREE.Vector3().subVectors(targetPos, this.mesh.position).normalize();
      this.mesh.position.addScaledVector(dir, this.speed);
      this.mesh.lookAt(targetPos);

      const currentTime = performance.now();
      if (currentTime - this.lastShotTime > this.shootInterval) {
        this.cannons.forEach(cannon => {
          const worldPos = new THREE.Vector3();
          cannon.getWorldPosition(worldPos);
          allProjectiles.push(new Projectile(this.scene, worldPos, dir, 0xaa00ff, true, this.damagePerShot));
        });
        this.lastShotTime = currentTime;
      }
    } else {
      this.mesh.position.z += this.speed * 0.5;
      this.mesh.position.x += Math.sin(Date.now() * 0.001) * 0.01;
      this.mesh.rotation.y = Math.PI; 
    }

    if (Math.abs(this.mesh.position.z - (playerTarget.mesh ? playerTarget.mesh.position.z : 0)) > 150) this.die();
  }
}
