import { Spark } from './Spark';
import { Colossus } from './Colossus';

export function createEnemyUnit(scene, spawnPosition, type = 'spark') {
  if (type === 'colossus' || type === 'pulsar') {
    return new Colossus(scene, spawnPosition);
  }

  return new Spark(scene, spawnPosition);
}
