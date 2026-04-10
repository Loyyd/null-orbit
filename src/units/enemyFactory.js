import { Spark } from './Spark';
import { Pulsar } from './Pulsar';
import { Colossus } from './Colossus';

export function createEnemyUnit(scene, spawnPosition, type = 'spark') {
  if (type === 'colossus') {
    return new Colossus(scene, spawnPosition);
  }
  if (type === 'pulsar') {
    return new Pulsar(scene, spawnPosition);
  }

  return new Spark(scene, spawnPosition);
}
