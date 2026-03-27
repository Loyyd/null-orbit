import * as THREE from 'three';

export class Projectile {
  constructor(scene, spawnPosition, direction) {
    this.scene = scene;
    this.geometry = new THREE.SphereGeometry(0.15, 8, 8);
    this.material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.copy(spawnPosition);
    this.direction = direction.clone().normalize();
    this.speed = 0.5;
    this.isRemoved = false;
    this.damage = 1;

    scene.add(this.mesh);
  }

  update(enemies) {
    if (this.isRemoved) return;
    this.mesh.position.addScaledVector(this.direction, this.speed);

    // Basic collision detection
    for (const enemy of enemies) {
      if (!enemy.isDead && this.mesh.position.distanceTo(enemy.mesh.position) < 1) {
        enemy.takeDamage(this.damage);
        this.remove();
        break;
      }
    }

    // Auto-remove if it travels too far
    if (this.mesh.position.length() > 100) {
      this.remove();
    }
  }

  remove() {
    this.isRemoved = true;
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
