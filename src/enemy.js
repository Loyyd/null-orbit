import * as THREE from 'three';

export class Enemy {
  constructor(scene, spawnPosition) {
    this.scene = scene;
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.copy(spawnPosition);
    this.health = 3;
    this.speed = 0.05;
    this.isDead = false;

    scene.add(this.mesh);
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.die();
    } else {
      // Simple flash effect on hit
      this.material.emissive.setHex(0xffffff);
      setTimeout(() => {
        if (!this.isDead) this.material.emissive.setHex(0x000000);
      }, 50);
    }
  }

  die() {
    this.isDead = true;
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }

  update() {
    if (this.isDead) return;
    // Enemies move "top to bottom" (assuming top is -Z)
    this.mesh.position.z += this.speed;
    
    // Auto-remove if they go too far (e.g., past the floor)
    if (this.mesh.position.z > 50) {
      this.die();
    }
  }
}
