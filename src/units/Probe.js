import * as THREE from 'three';
import { Unit } from './Unit';

export class Probe extends Unit {
  constructor(scene, spawnPosition) {
    super(scene, spawnPosition, {
      displayName: 'Probe',
      type: 'probe',
      maxHealth: 30,
      speed: 0.015,
      aggroRange: 40,
      shootInterval: 6000,
      damagePerShot: 1.5,
      projectileColor: 0x0088ff,
      projectileIsEnemy: false,
      hitRadius: 1.2,
      baseEmissiveIntensity: 0.3,
    });

    this.bodyGeometry = new THREE.BoxGeometry(0.8, 0.4, 1.2);
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x0088ff,
      emissive: 0x0088ff,
      emissiveIntensity: this.baseEmissiveIntensity,
    });
    this.bodyMesh = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
    this.mesh.add(this.bodyMesh);

    const cannonGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
    this.cannonMesh = new THREE.Mesh(cannonGeo, cannonMat);
    this.cannonMesh.rotation.x = Math.PI / 2;
    this.cannonMesh.position.z = -0.6;
    this.bodyMesh.add(this.cannonMesh);

    this.initializeHealthBar(1.2, 0.15, 0x0088ff, 1.2);
  }

  update(targets, projectiles, camera, deltaTime = 1 / 60, obstacles = []) {
    if (this.isDead) return;

    this.updateHealthBarFacing(camera);

    let nearestTarget = null;
    let minDist = this.aggroRange;

    for (const target of targets) {
      if (target.isDead) continue;
      const dist = this.mesh.position.distanceTo(target.mesh.position);
      if (dist < minDist) {
        minDist = dist;
        nearestTarget = target;
      }
    }

    if (nearestTarget) {
      const dir = new THREE.Vector3().subVectors(nearestTarget.mesh.position, this.mesh.position).normalize();
      if (minDist > 10) {
        const moveDelta = this.moveWithObstacles(dir, deltaTime, obstacles, nearestTarget.mesh.position);
        if (moveDelta.lengthSq() > 0.000001) {
          this.mesh.lookAt(this.mesh.position.clone().add(moveDelta));
        } else {
          this.mesh.lookAt(nearestTarget.mesh.position);
        }
      } else {
        this.mesh.lookAt(nearestTarget.mesh.position);
      }

      const currentTime = performance.now();
      if (currentTime - this.lastShotTime > this.shootInterval) {
        const worldPos = new THREE.Vector3();
        this.cannonMesh.getWorldPosition(worldPos);
        this.fireProjectile(projectiles, worldPos, dir);
        this.lastShotTime = currentTime;
      }
    } else {
      const moveDelta = this.moveWithObstacles(new THREE.Vector3(0, 0, -1), deltaTime, obstacles);
      if (moveDelta.lengthSq() > 0.000001) {
        this.mesh.lookAt(this.mesh.position.clone().add(moveDelta));
      } else {
        this.mesh.rotation.y = 0;
      }
    }

    if (Math.abs(this.mesh.position.z) > this.boundsLimit) {
      this.die();
    }
  }
}
