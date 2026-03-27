import * as THREE from 'three';
import { Projectile } from './projectile';
import { FriendlyUnit } from './friendlyUnit';

export class BaseStation {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position;
    this.fireRange = 40;
    this.fireRate = 1200;
    this.lastShotTime = 0;
    this.spawnInterval = 20000; // Spawn every 20s
    this.lastSpawnTime = 0;
    
    // Main base body
    this.geometry = new THREE.CylinderGeometry(5, 7, 3, 32);
    this.material = new THREE.MeshStandardMaterial({ color: 0x4444bb, emissive: 0x111144 });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.copy(position);
    scene.add(this.mesh);

    // Decorative tower
    const towerGeo = new THREE.CylinderGeometry(2, 2, 8, 16);
    const tower = new THREE.Mesh(towerGeo, this.material);
    tower.position.y = 4;
    this.mesh.add(tower);

    // Defensive cannons
    this.cannons = [];
    const cannonGeo = new THREE.BoxGeometry(0.4, 0.4, 1.5);
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
    
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const cannon = new THREE.Mesh(cannonGeo, cannonMat);
      const radius = 6;
      cannon.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      
      const pivot = new THREE.Group();
      pivot.position.copy(cannon.position);
      pivot.add(cannon);
      cannon.position.set(0, 0, 0.7); 
      this.mesh.add(pivot);
      this.cannons.push(pivot);
    }
  }

  update(playerPos, enemies, projectiles, currentTime, friendlyUnits) {
    const distToPlayer = this.mesh.position.distanceTo(playerPos);
    
    // Auto-fire at enemies
    if (currentTime - this.lastShotTime > this.fireRate) {
      let fired = false;
      for (const enemy of enemies) {
        if (enemy.isDead) continue;
        const distToEnemy = this.mesh.position.distanceTo(enemy.mesh.position);
        if (distToEnemy < this.fireRange) {
          const cannon = this.cannons[Math.floor(Math.random() * this.cannons.length)];
          const worldPos = new THREE.Vector3();
          cannon.getWorldPosition(worldPos);
          const dir = new THREE.Vector3().subVectors(enemy.mesh.position, worldPos).normalize();
          cannon.lookAt(enemy.mesh.position);
          projectiles.push(new Projectile(this.scene, worldPos, dir, 0x00ffff, false, 2));
          fired = true;
          break;
        }
      }
      if (fired) this.lastShotTime = currentTime;
    }

    // Spawn friendly units
    if (currentTime - this.lastSpawnTime > this.spawnInterval) {
      friendlyUnits.push(new FriendlyUnit(this.scene, this.position.clone().add(new THREE.Vector3(0, 0, -8))));
      this.lastSpawnTime = currentTime;
    }

    return distToPlayer < 18; 
  }
}
