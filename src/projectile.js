import * as THREE from 'three';

export class Projectile {
  constructor(scene, spawnPosition, direction, color = 0xff0000, isEnemy = false, damage = 1) {
    this.scene = scene;
    this.isEnemy = isEnemy;
    this.damage = damage;
    
    this.geometry = new THREE.CapsuleGeometry(0.1, 0.8, 4, 8);
    this.material = new THREE.MeshBasicMaterial({ color: color });
    
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.copy(spawnPosition);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    
    this.direction = direction.clone().normalize();
    this.speed = isEnemy ? 0.175 : 0.6; 
    this.isRemoved = false;

    scene.add(this.mesh);
  }

  update(targets, onHit) {
    if (this.isRemoved) return;
    this.mesh.position.addScaledVector(this.direction, this.speed);

    if (Array.isArray(targets)) {
      for (const target of targets) {
        if (!target.isDead && this.mesh.position.distanceTo(target.mesh.position) < 1.5) {
          target.takeDamage(this.damage);
          this.remove();
          break;
        }
      }
    } else if (targets && this.mesh.position.distanceTo(targets.position) < 1.5) {
      onHit(this.damage);
      this.remove();
    }

    if (this.mesh.position.length() > 400) this.remove();
  }

  remove() {
    this.isRemoved = true;
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
