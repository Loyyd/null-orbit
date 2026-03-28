import * as THREE from 'three';
import { Unit } from './Unit';
export class EnemyUnit extends Unit {
  constructor(scene, spawnPosition, config) {
    super(scene, spawnPosition, {
      ...config,
      projectileIsEnemy: true,
      boundsLimit: 150,
      hitRadius: config.hitRadius || (config.size || 1.2) * 0.9,
      baseEmissiveIntensity: 0.2,
    });

    this.size = config.size;
    this.idleSpeedMultiplier = config.idleSpeedMultiplier || 0.5;
    this.idleDriftAmplitude = config.idleDriftAmplitude || 0.01;
    this.cannonOffsets = config.cannonOffsets;
    this.defaultLookRotationY = Math.PI;

    this.bodyGeometry = new THREE.BoxGeometry(this.size, this.size * 0.5, this.size * 1.5);
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: config.bodyColor,
      emissive: config.bodyColor,
      emissiveIntensity: this.baseEmissiveIntensity,
    });

    this.bodyMesh = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
    this.mesh.add(this.bodyMesh);

    this.cannons = [];
    this.cannonOffsets.forEach((offset) => {
      const cannonGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8);
      const cannonMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const cannon = new THREE.Mesh(cannonGeo, cannonMat);
      cannon.rotation.x = Math.PI / 2;
      cannon.position.copy(offset);
      this.bodyMesh.add(cannon);
      this.cannons.push(cannon);
    });

    this.initializeHealthBar(this.size, 0.15, config.healthBarColor, this.size);
  }

  configureForWave() {}

  update(playerTarget, projectiles, camera, probes = [], baseTargets = [], deltaTime = 1 / 60, obstacles = []) {
    if (this.isDead) return;

    this.updateHealthBarFacing(camera);

    let target = null;
    let minDist = Infinity;

    if (!playerTarget.isDead) {
      minDist = this.mesh.position.distanceTo(playerTarget.mesh.position);
      target = playerTarget.mesh;
    }

    for (const probe of probes) {
      if (probe.isDead) continue;
      const dist = this.mesh.position.distanceTo(probe.mesh.position);
      if (dist < minDist) {
        minDist = dist;
        target = probe.mesh;
      }
    }

    for (const base of baseTargets) {
      if (base.isDead) continue;
      const dist = this.mesh.position.distanceTo(base.mesh.position);
      if (dist < minDist) {
        minDist = dist;
        target = base.mesh;
      }
    }

    if (target && minDist < this.aggroRange) {
      const targetPos = target.position;
      const desiredDir = new THREE.Vector3().subVectors(targetPos, this.mesh.position).normalize();
      const moveDelta = this.moveWithObstacles(desiredDir, deltaTime, obstacles, targetPos);
      if (moveDelta.lengthSq() > 0.000001) {
        this.mesh.lookAt(this.mesh.position.clone().add(moveDelta));
      } else {
        this.mesh.lookAt(targetPos);
      }

      const currentTime = performance.now();
      if (currentTime - this.lastShotTime > this.shootInterval) {
        this.cannons.forEach((cannon) => {
          const worldPos = new THREE.Vector3();
          cannon.getWorldPosition(worldPos);
          const shotDir = new THREE.Vector3().subVectors(targetPos, worldPos).normalize();
          this.fireProjectile(projectiles, worldPos, shotDir);
        });
        this.lastShotTime = currentTime;
      }
    } else {
      const idleDir = new THREE.Vector3(
        Math.sin(Date.now() * 0.001) * this.idleDriftAmplitude * 20,
        0,
        this.idleSpeedMultiplier
      ).normalize();
      const moveDelta = this.moveWithObstacles(idleDir, deltaTime, obstacles);
      if (moveDelta.lengthSq() > 0.000001) {
        this.mesh.lookAt(this.mesh.position.clone().add(moveDelta));
      } else {
        this.mesh.rotation.y = this.defaultLookRotationY;
      }
    }

    if (Math.abs(this.mesh.position.z - (playerTarget.mesh ? playerTarget.mesh.position.z : 0)) > this.boundsLimit) {
      this.die();
    }
  }
}
