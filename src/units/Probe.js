import * as THREE from 'three';
import { Unit } from './Unit';
import { attachSharedShipModel } from '../sharedShipModel';

export class Probe extends Unit {
  constructor(scene, spawnPosition, configOverrides = {}) {
    super(scene, spawnPosition, {
      displayName: 'Probe',
      type: 'probe',
      maxHealth: configOverrides.maxHealth ?? 30,
      speed: configOverrides.speed ?? 0.015,
      aggroRange: configOverrides.aggroRange ?? 40,
      shootInterval: configOverrides.shootInterval ?? 6000,
      damagePerShot: configOverrides.damagePerShot ?? 1.5,
      projectileColor: 0x0088ff,
      projectileIsEnemy: false,
      hitRadius: 1.2,
      baseEmissiveIntensity: 0.3,
    });

    this.bodyMesh = new THREE.Group();
    this.mesh.add(this.bodyMesh);

    this.fallbackBodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.4, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x0088ff,
        emissive: 0x0088ff,
        emissiveIntensity: this.baseEmissiveIntensity,
      })
    );
    this.bodyMesh.add(this.fallbackBodyMesh);

    attachSharedShipModel(this.bodyMesh, {
      targetWidth: 0.8,
      targetHeight: 0.4,
      targetLength: 1.2,
      rotationY: Math.PI / 2,
    }).then((model) => {
      if (model) {
        this.fallbackBodyMesh.visible = false;
      }
    });

    this.cannonMesh = new THREE.Object3D();
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
        const shotDir = dir.clone();
        const scatter = 0.14;
        shotDir.x += (Math.random() - 0.5) * scatter;
        shotDir.z += (Math.random() - 0.5) * scatter;
        shotDir.normalize();
        this.fireProjectile(projectiles, worldPos, shotDir);
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
