import * as THREE from 'three';
import { Projectile } from '../projectile';

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
      new Projectile(
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

  die() {
    this.isDead = true;
    this.scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      child.geometry?.dispose?.();
      disposeMaterial(child.material);
    });
  }
}
