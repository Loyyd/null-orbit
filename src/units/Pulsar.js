import * as THREE from 'three';
import { EnemyUnit } from './EnemyUnit';

export class Pulsar extends EnemyUnit {
  constructor(scene, spawnPosition) {
    super(scene, spawnPosition, {
      displayName: 'Pulsar',
      type: 'pulsar',
      maxHealth: 50,
      speed: 0.0075,
      aggroRange: 45,
      shootInterval: 4800,
      damagePerShot: 25,
      projectileColor: 0xaa00ff,
      size: 2.5,
      bodyColor: 0xaa00ff,
      healthBarColor: 0xaa00ff,
      cannonOffsets: [
        new THREE.Vector3(-0.8, 0, -1.2),
        new THREE.Vector3(0.8, 0, -1.2),
      ],
    });
  }

  configureForWave(waveLevel) {
    this.maxHealth = 15 + (waveLevel * 2);
    this.health = this.maxHealth;
    this.updateHealthBar();
  }
}
