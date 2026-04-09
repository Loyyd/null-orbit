import * as THREE from 'three';

export class WaveManager {
  constructor(scene, gameOptions = {}) {
    this.scene = scene;
    this.waveOptions = gameOptions.wave || {};
    this.spawnTimer = 0;
    this.elapsedTime = 0;
    this.waveLevel = 1;
    this.debugWaveOverride = null;
  }

  update(playerPos, enemyController, deltaTime) {
    const zoneDistance = this.waveOptions.zoneDistance ?? 80;
    const timePerWaveIncrease = this.waveOptions.timePerWaveIncrease ?? 60;
    this.elapsedTime += deltaTime;
    const distancePush = Math.abs(playerPos.z - 20);
    const distanceWave = 1 + Math.floor(distancePush / zoneDistance);
    const timeWave = 1 + Math.floor(this.elapsedTime / Math.max(timePerWaveIncrease, 1));
    const computedWave = Math.max(distanceWave, timeWave);
    this.waveLevel = Math.max(computedWave, this.debugWaveOverride ?? 1);

    this.spawnTimer += deltaTime;
    const spawnThreshold = Math.max(
      this.waveOptions.spawnThresholdMin ?? 8,
      (this.waveOptions.spawnThresholdBase ?? 16) - (this.waveLevel * (this.waveOptions.spawnThresholdDropPerWave ?? 0.75))
    );

    if (this.spawnTimer > spawnThreshold) {
      this.spawnSquad(playerPos, enemyController);
      this.spawnTimer = 0;
    }
  }

  spawnSquad(playerPos, enemyController) {
    const squadSize = Math.min(
      this.waveOptions.squadSizeMax ?? 6,
      (this.waveOptions.squadSizeBase ?? 2) + Math.floor(this.waveLevel / (this.waveOptions.squadSizeGrowthDivisor ?? 2))
    );
    const squadCenter = new THREE.Vector3(
      (Math.random() - 0.5) * (this.waveOptions.squadWidth ?? 80),
      0,
      playerPos.z - (this.waveOptions.spawnDistanceBehindPlayer ?? 80)
    );

    const spawnColossus = Math.random() < (
      (this.waveOptions.pulsarChanceBase ?? 0.1) +
      (this.waveLevel * (this.waveOptions.pulsarChancePerWave ?? 0.05))
    );
    const starshipStartWave = this.waveOptions.starshipStartWave ?? 5;
    const starshipWaveInterval = this.waveOptions.starshipWaveInterval ?? 5;
    const spawnStarship = this.waveLevel >= starshipStartWave
      && ((this.waveLevel - starshipStartWave) % starshipWaveInterval === 0);

    for (let i = 0; i < squadSize; i++) {
      const isStarship = spawnStarship && i === 0;
      const isColossus = !isStarship && spawnColossus && i === 0;
      
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * (this.waveOptions.squadSpread ?? 15),
        0,
        (Math.random() - 0.5) * (this.waveOptions.squadSpread ?? 15)
      );
      
      const type = isStarship ? 'starship' : isColossus ? 'colossus' : 'spark';
      enemyController.spawn(squadCenter.clone().add(offset), type, this.waveLevel);
    }
  }

  skipWave() {
    this.debugWaveOverride = (this.debugWaveOverride ?? this.waveLevel) + 1;
    this.waveLevel = this.debugWaveOverride;
  }
}
