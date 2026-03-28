import * as THREE from 'three';
import { createEnemyUnit } from './units/enemyFactory';

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

    const spawnPulsar = Math.random() < (0.1 + (this.waveLevel * 0.05));

    for (let i = 0; i < squadSize; i++) {
      const isPulsar = spawnPulsar && i === 0;
      
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        0,
        (Math.random() - 0.5) * 15
      );
      
      const type = isPulsar ? 'pulsar' : 'spark';
      const enemy = createEnemyUnit(this.scene, squadCenter.clone().add(offset), type);
      enemy.configureForWave(this.waveLevel);

      enemies.push(enemy);
    }
  }
}
