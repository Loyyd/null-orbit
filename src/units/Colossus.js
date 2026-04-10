import * as THREE from 'three';
import { EnemyUnit } from './EnemyUnit';
import { getModelPath } from '../paths';

export class Colossus extends EnemyUnit {
  constructor(scene, spawnPosition) {
    super(scene, spawnPosition, {
      displayName: 'Colossus',
      type: 'colossus',
      maxHealth: 400,
      speed: 0.008,
      aggroRange: 60,
      shootInterval: 5200,
      damagePerShot: 18,
      projectileColor: 0xff5555,
      size: 5.2,
      bodyColor: 0xa23535,
      healthBarColor: 0xff5555,
      modelPath: getModelPath('models/starship.glb'),
      cannonOffsets: [
        new THREE.Vector3(-1.8, 0, 2.2),
        new THREE.Vector3(1.8, 0, 2.2),
        new THREE.Vector3(-1.2, 0, -0.2),
        new THREE.Vector3(1.2, 0, -0.2),
      ],
    });
  }

  configureForWave(waveLevel) {
    this.maxHealth = 400 + (waveLevel * 10);
    this.health = this.maxHealth;
    this.updateHealthBar();
  }
}
