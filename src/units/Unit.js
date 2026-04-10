import * as THREE from 'three';
import { Projectile } from '../projectile';
import {
  createBypassWaypoint,
  findBlockingObstacle,
  getNavigableDirection,
  moveWithObstacleCollisions,
  resolveObstacleCollisions,
} from '../obstacleNavigation';

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry?.dispose?.());
    return;
  }
  material?.dispose?.();
}

export class Unit {
  constructor(scene, spawnPosition, config) {
    this.scene = scene;
    this.displayName = config.displayName;
    this.type = config.type;
    this.maxHealth = config.maxHealth;
    this.health = this.maxHealth;
    this.speed = config.speed;
    this.aggroRange = config.aggroRange;
    this.shootInterval = config.shootInterval;
    this.damagePerShot = config.damagePerShot;
    this.projectileColor = config.projectileColor;
    this.projectileIsEnemy = config.projectileIsEnemy;
    this.hitRadius = config.hitRadius || 1.5;
    this.baseEmissiveIntensity = config.baseEmissiveIntensity || 0.3;
    this.boundsLimit = config.boundsLimit || 1000;

    this.mesh = new THREE.Group();
    this.mesh.position.copy(spawnPosition);
    this.isDead = false;
    this.lastShotTime = 0;
    this.navigationWaypoint = null;
    this.healthBarGroup = null;
    this.hpFg = null;
    this.healthBarWidth = 0;

    this.scene.add(this.mesh);
  }

  initializeHealthBar(width, height, color, offsetY) {
    this.healthBarWidth = width;
    this.healthBarGroup = new THREE.Group();

    const bgGeo = new THREE.PlaneGeometry(width, height);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    this.hpBg = new THREE.Mesh(bgGeo, bgMat);

    const fgGeo = new THREE.PlaneGeometry(width, height);
    const fgMat = new THREE.MeshBasicMaterial({ color });
    this.hpFg = new THREE.Mesh(fgGeo, fgMat);
    this.hpFg.position.z = 0.01;

    this.healthBarGroup.add(this.hpBg);
    this.healthBarGroup.add(this.hpFg);
    this.healthBarGroup.position.y = offsetY;
    this.healthBarGroup.visible = false;
    this.mesh.add(this.healthBarGroup);

    this.updateHealthBar();
  }

  updateHealthBar() {
    if (!this.hpFg) return;

    const healthPercent = Math.max(0, this.health / this.maxHealth);
    this.hpFg.scale.x = healthPercent;
    this.hpFg.position.x = -(1 - healthPercent) * (this.healthBarWidth / 2);
  }

  updateHealthBarFacing(camera) {
    if (this.healthBarGroup?.visible && camera) {
      this.healthBarGroup.quaternion.copy(camera.quaternion);
    }
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.healthBarGroup) {
      this.healthBarGroup.visible = true;
    }
    this.updateHealthBar();

    if (this.health <= 0) {
      this.die();
      return;
    }

    this.flashOnHit();
  }

  flashOnHit() {
    this.mesh.traverse((child) => {
      if (child.material?.emissiveIntensity !== undefined) {
        child.material.emissiveIntensity = 1;
      }
    });

    setTimeout(() => {
      if (this.isDead) return;
      this.mesh.traverse((child) => {
        if (child.material?.emissiveIntensity !== undefined) {
          child.material.emissiveIntensity = this.baseEmissiveIntensity;
        }
      });
    }, 50);
  }

  fireProjectile(projectiles, worldPos, direction) {
    projectiles.push(
      Projectile.spawn(
        this.scene,
        worldPos,
        direction,
        this.projectileColor,
        this.projectileIsEnemy,
        this.damagePerShot,
        this.aggroRange * 2
      )
    );
  }

  moveWithObstacles(direction, deltaTime, obstacles, targetPosition = null) {
    resolveObstacleCollisions(this.mesh.position, this.hitRadius, obstacles);

    const travelDistance = this.speed * deltaTime * 60;
    let desiredDirection = direction.clone().normalize();

    if (this.navigationWaypoint) {
      const toWaypoint = new THREE.Vector3().subVectors(this.navigationWaypoint, this.mesh.position);
      if (toWaypoint.lengthSq() < 2.25) {
        this.navigationWaypoint = null;
      } else {
        desiredDirection = toWaypoint.normalize();
      }
    }

    if (!this.navigationWaypoint) {
      const blockingObstacle = findBlockingObstacle(
        this.mesh.position,
        desiredDirection,
        obstacles,
        this.hitRadius,
        Math.max(8, travelDistance * 6)
      );

      if (blockingObstacle) {
        this.navigationWaypoint = createBypassWaypoint(
          this.mesh.position,
          targetPosition,
          blockingObstacle,
          this.hitRadius
        );
        desiredDirection = new THREE.Vector3()
          .subVectors(this.navigationWaypoint, this.mesh.position)
          .normalize();
      }
    }

    const navigableDirection = getNavigableDirection(
      this.mesh.position,
      desiredDirection,
      obstacles,
      this.hitRadius,
      Math.max(2, travelDistance * 3)
    );
    const delta = navigableDirection.multiplyScalar(travelDistance);
    const nextPosition = moveWithObstacleCollisions(this.mesh.position, delta, this.hitRadius, obstacles);
    this.mesh.position.copy(nextPosition);
    return delta;
  }

  die() {
    this.isDead = true;
    this.scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      child.geometry?.dispose?.();
      disposeMaterial(child.material);
    });
  }
}
