import * as THREE from 'three';
import { Projectile } from './projectile';
import { FriendlyUnit } from './friendlyUnit';

export class BaseStation {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position;
    this.fireRange = 40;
    this.interactionRange = 18;
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

    // Visual Radii
    const createRadiusCircle = (radius, color, opacity) => {
      const segments = 128;
      const geometry = new THREE.RingGeometry(radius - 0.2, radius + 0.2, segments);
      const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = -0.4; // Just above the grid
      return mesh;
    };

    // Range Circle (Shooting)
    this.fireRangeMesh = createRadiusCircle(this.fireRange, 0x00ffff, 0.1);
    scene.add(this.fireRangeMesh);
    this.fireRangeMesh.position.copy(position);
    this.fireRangeMesh.position.y = -0.4;

    // Interaction Circle (Base Menu/Healing)
    this.interactionRangeMesh = createRadiusCircle(this.interactionRange, 0x00ff55, 0.15);
    scene.add(this.interactionRangeMesh);
    this.interactionRangeMesh.position.copy(position);
    this.interactionRangeMesh.position.y = -0.35;

    // Decorative tower
    const towerGeo = new THREE.CylinderGeometry(2, 2, 8, 16);
    const tower = new THREE.Mesh(towerGeo, this.material);
    tower.position.y = 4;
    this.mesh.add(tower);

    // Defensive cannons
    this.cannons = [];
    this.cannonGeo = new THREE.BoxGeometry(0.4, 0.4, 1.5);
    this.cannonMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
    
    // Start with 2 cannons
    for (let i = 0; i < 2; i++) {
      this.addCannonMesh(i, 2);
    }

    // Healing Beam Visual
    const beamGeo = new THREE.CylinderGeometry(0.2, 0.2, 1, 8);
    const beamMat = new THREE.MeshStandardMaterial({ 
      color: 0x00ff88, 
      emissive: 0x00ff88, 
      emissiveIntensity: 1,
      transparent: true,
      opacity: 0.6
    });
    this.healingBeam = new THREE.Mesh(beamGeo, beamMat);
    this.healingBeam.visible = false;
    this.scene.add(this.healingBeam);
  }

  addCannonMesh(index, total) {
    const angle = (index / total) * Math.PI * 2;
    const radius = 6;
    
    const pivot = new THREE.Group();
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    pivot.position.set(x, 0, z);
    
    const cannon = new THREE.Mesh(this.cannonGeo, this.cannonMat);
    cannon.position.set(0, 0, 0.7); 
    pivot.add(cannon);
    
    // Make cannon look outwards initially
    pivot.lookAt(new THREE.Vector3(x * 2, 0, z * 2).add(this.position));
    
    this.mesh.add(pivot);
    this.cannons.push(pivot);
  }

  addCannon() {
    // Add 1 more cannon
    const currentCount = this.cannons.length;
    this.cannons.forEach(c => this.mesh.remove(c));
    this.cannons = [];
    const newTotal = currentCount + 1;
    for (let i = 0; i < newTotal; i++) {
      this.addCannonMesh(i, newTotal);
    }
  }

  upgradeSpawnRate() {
    this.spawnInterval = Math.max(4000, this.spawnInterval - 1000);
  }

  update(playerPos, enemies, projectiles, currentTime, friendlyUnits, playerHealth, maxPlayerHealth) {
    this.mesh.rotation.y += 0.001;
    const distToPlayer = this.mesh.position.distanceTo(playerPos);
    const inHealingRange = distToPlayer < this.interactionRange;
    const isHealing = inHealingRange && playerHealth < maxPlayerHealth;

    // Pulsate interaction ring
    if (inHealingRange) {
      this.interactionRangeMesh.material.opacity = 0.3 + Math.sin(currentTime * 0.005) * 0.2;
    } else {
      this.interactionRangeMesh.material.opacity = 0.15;
    }

    // Healing Beam Update
    if (isHealing) {
      this.healingBeam.visible = true;
      const startPos = this.position.clone();
      startPos.y += 6; // Start from tower top
      const endPos = playerPos.clone();

      const beamVec = new THREE.Vector3().subVectors(endPos, startPos);
      const beamLen = beamVec.length();

      // Update beam mesh
      this.healingBeam.scale.y = beamLen;
      const center = startPos.clone().add(beamVec.clone().multiplyScalar(0.5));
      this.healingBeam.position.copy(center);
      this.healingBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamVec.clone().normalize());

      // Pulsing effect - less emissive
      this.healingBeam.material.emissiveIntensity = 0.2 + Math.sin(currentTime * 0.005) * 0.1;
      this.healingBeam.material.opacity = 0.2 + Math.sin(currentTime * 0.005) * 0.05;
    } else {
      this.healingBeam.visible = false;
    }
    
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
      // Spawn 2 units at a time
      friendlyUnits.push(new FriendlyUnit(this.scene, this.position.clone().add(new THREE.Vector3(-2, 0, -8))));
      friendlyUnits.push(new FriendlyUnit(this.scene, this.position.clone().add(new THREE.Vector3(2, 0, -8))));
      this.lastSpawnTime = currentTime;
    }

    return inHealingRange; 
  }
}
