import * as THREE from 'three';
import { EnemyUnit } from './EnemyUnit';

export class Spark extends EnemyUnit {
  constructor(scene, spawnPosition) {
    super(scene, spawnPosition, {
      displayName: 'Spark',
      type: 'spark',
      maxHealth: 15,
      speed: 0.02,
      aggroRange: 35,
      shootInterval: 8000,
      damagePerShot: 15,
      projectileColor: 0xaa00ff,
      size: 1.2,
      bodyColor: 0xff0000,
      healthBarColor: 0xff0055,
      cannonOffsets: [new THREE.Vector3(0, 0, -1)],
    });
  }

  configureForWave(waveLevel) {
    this.speed = 0.04 + (waveLevel * 0.0025);
    this.maxHealth = 3 + Math.floor(waveLevel / 3);
    this.health = this.maxHealth;
    this.updateHealthBar();
  }
}
