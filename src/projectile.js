import * as THREE from 'three';

export class Projectile {
  constructor(scene, spawnPosition, direction, color = 0xff0000, isEnemy = false, damage = 1, maxTravelDistance = 400) {
    this.scene = scene;
    this.isEnemy = isEnemy;
    this.damage = damage;
    this.maxTravelDistance = maxTravelDistance;
    this.distanceTraveled = 0;
    
    this.geometry = new THREE.CapsuleGeometry(0.1, 0.8, 4, 8);
    this.material = new THREE.MeshBasicMaterial({ color: color });
    
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.copy(spawnPosition);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    
    this.direction = direction.clone().normalize();
    this.speed = isEnemy ? 0.0875 : 0.3; 
    this.isRemoved = false;

    scene.add(this.mesh);
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
    } else if (targets && this.mesh.position.distanceTo(targets.position) < 1.5) {
      onHit(this.damage);
      this.remove();
    }

    if (this.distanceTraveled >= this.maxTravelDistance) this.remove();
  }

  remove() {
    this.isRemoved = true;
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
