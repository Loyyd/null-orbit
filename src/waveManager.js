import * as THREE from 'three';
import { Enemy } from './enemy';

export class WaveManager {
  constructor(scene) {
    this.scene = scene;
    this.spawnTimer = 0;
    this.waveLevel = 1;
  }

  update(playerPos, enemies, deltaTime) {
    const distancePush = Math.abs(playerPos.z - 20);
    this.waveLevel = 1 + Math.floor(distancePush / 80);

    this.spawnTimer += deltaTime;
    // Threshold in seconds: 8s to 16s
    const spawnThreshold = Math.max(8, 16 - (this.waveLevel * 0.75)); 

    if (this.spawnTimer > spawnThreshold) {
      this.spawnSquad(playerPos, enemies);
      this.spawnTimer = 0;
    }
  }

  spawnSquad(playerPos, enemies) {
    const squadSize = Math.min(6, 2 + Math.floor(this.waveLevel / 2));
    const squadCenter = new THREE.Vector3(
      (Math.random() - 0.5) * 80,
      0,
      playerPos.z - 80
    );

    // AI decides whether to include a Tank in this squad
    const spawnTank = Math.random() < (0.1 + (this.waveLevel * 0.05));

    for (let i = 0; i < squadSize; i++) {
      const isTank = spawnTank && i === 0; // Only one tank per squad if triggered
      
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        0,
        (Math.random() - 0.5) * 15
      );
      
      const type = isTank ? 'tank' : 'scout';
      const enemy = new Enemy(this.scene, squadCenter.clone().add(offset), type);
      
      // Fine-tune zone-based scaling
      if (!isTank) {
        enemy.speed = 0.04 + (this.waveLevel * 0.0025);
        enemy.health = 3 + Math.floor(this.waveLevel / 3);
      } else {
        enemy.health = 15 + (this.waveLevel * 2);
      }

      enemies.push(enemy);
    }
  }
}

