import { Spark } from './Spark';
import { Pulsar } from './Pulsar';

export function createEnemyUnit(scene, spawnPosition, type = 'spark') {
  if (type === 'pulsar') {
    return new Pulsar(scene, spawnPosition);
  }

  return new Spark(scene, spawnPosition);
}
