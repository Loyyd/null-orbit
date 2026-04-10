import * as THREE from 'three';

const LASER_SPEED_MULTIPLIER = 1.22;
const PROJECTILE_POOL = [];
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export class Projectile {
  constructor() {
    this.scene = null;
    this.isEnemy = false;
    this.damage = 1;
    this.maxTravelDistance = 400;
    this.distanceTraveled = 0;
    this.isRemoved = true;

    this.geometry = new THREE.CapsuleGeometry(0.1, 0.8, 4, 8);
    this.material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.material.toneMapped = false;

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.glowGeometry = new THREE.CapsuleGeometry(0.22, 1.2, 4, 8);
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.glowMaterial.toneMapped = false;
    this.glowMesh = new THREE.Mesh(this.glowGeometry, this.glowMaterial);
    this.glowMesh.renderOrder = 2;
    this.mesh.add(this.glowMesh);
    this.direction = new THREE.Vector3();
    this.normalizedDirection = new THREE.Vector3();
  }

  static spawn(scene, spawnPosition, direction, color = 0xff0000, isEnemy = false, damage = 1, maxTravelDistance = 400) {
    const projectile = PROJECTILE_POOL.pop() || new Projectile();
    projectile.reset(scene, spawnPosition, direction, color, isEnemy, damage, maxTravelDistance);
    return projectile;
  }

  reset(scene, spawnPosition, direction, color = 0xff0000, isEnemy = false, damage = 1, maxTravelDistance = 400) {
    this.scene = scene;
    this.isEnemy = isEnemy;
    this.damage = damage;
    this.maxTravelDistance = maxTravelDistance;
    this.distanceTraveled = 0;
    this.isRemoved = false;

    this.material.color.set(color);
    this.glowMaterial.color.set(color);
    this.glowMaterial.opacity = isEnemy ? 0.32 : 0.4;
    this.mesh.position.copy(spawnPosition);
    this.mesh.visible = true;
    this.normalizedDirection.copy(direction).normalize();
    this.mesh.quaternion.setFromUnitVectors(WORLD_UP, this.normalizedDirection);

    this.direction.copy(this.normalizedDirection);
    this.speed = (isEnemy ? 0.0875 : 0.3) * LASER_SPEED_MULTIPLIER;
    scene.add(this.mesh);
    return this;
  }

  update(targets, onHit, deltaTime = 1/60) {
    if (this.isRemoved) return;
    const stepDistance = this.speed * deltaTime * 60;
    this.mesh.position.addScaledVector(this.direction, stepDistance);
    this.distanceTraveled += stepDistance;

    if (Array.isArray(targets)) {
      for (const target of targets) {
        const hitRadius = target.hitRadius || 1.5;
        if (!target.isDead && this.mesh.position.distanceTo(target.mesh.position) < hitRadius) {
          target.takeDamage(this.damage);
          this.remove();
          break;
        }
      }
    } else if (targets?.intersects) {
      targets.intersects(this.mesh.position, 2.5, (target) => {
        const hitRadius = target.hitRadius || 1.5;
        if (this.mesh.position.distanceTo(target.mesh.position) >= hitRadius) {
          return false;
        }
        target.takeDamage(this.damage);
        this.remove();
        return true;
      });
    } else if (targets && this.mesh.position.distanceTo(targets.position) < 1.5) {
      onHit(this.damage);
      this.remove();
    }

    if (this.distanceTraveled >= this.maxTravelDistance) this.remove();
  }

  remove() {
    if (this.isRemoved) return;
    this.isRemoved = true;
    this.scene.remove(this.mesh);
    this.mesh.visible = false;
    PROJECTILE_POOL.push(this);
  }
}
