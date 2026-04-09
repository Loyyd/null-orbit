import * as THREE from 'three';

function createFaceTransform(boxSize, faceIndex) {
  const transform = {
    position: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    normal: new THREE.Vector3(),
  };

  switch (faceIndex) {
    case 0:
      transform.position.y = boxSize * 0.5;
      transform.rotation.x = -Math.PI / 2;
      transform.normal.set(0, 1, 0);
      break;
    case 1:
      transform.position.y = -boxSize * 0.5;
      transform.rotation.x = Math.PI / 2;
      transform.normal.set(0, -1, 0);
      break;
    case 2:
      transform.position.z = boxSize * 0.5;
      transform.normal.set(0, 0, 1);
      break;
    case 3:
      transform.position.z = -boxSize * 0.5;
      transform.rotation.y = Math.PI;
      transform.normal.set(0, 0, -1);
      break;
    case 4:
      transform.position.x = -boxSize * 0.5;
      transform.rotation.y = -Math.PI / 2;
      transform.normal.set(-1, 0, 0);
      break;
    default:
      transform.position.x = boxSize * 0.5;
      transform.rotation.y = Math.PI / 2;
      transform.normal.set(1, 0, 0);
      break;
  }

  return transform;
}

function createShardMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export function createShatterEffectSystem(scene) {
  const activeEffects = [];
  const randomDirection = new THREE.Vector3();
  const worldDirection = new THREE.Vector3();

  function spawn(position, {
    size = 2,
    color = 0xff8855,
    segmentCount = 3,
    duration = 0.7,
    spread = 8,
    lift = 2.5,
  } = {}) {
    const group = new THREE.Group();
    group.position.copy(position);
    scene.add(group);

    const planeSize = size / segmentCount;
    const boxSize = planeSize * segmentCount;
    const shards = [];

    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
      const faceTransform = createFaceTransform(boxSize, faceIndex);

      for (let row = 0; row < segmentCount; row++) {
        for (let col = 0; col < segmentCount; col++) {
          const localX = ((col + 0.5) - (segmentCount * 0.5)) * planeSize;
          const localY = ((row + 0.5) - (segmentCount * 0.5)) * planeSize;

          const shard = new THREE.Mesh(
            new THREE.PlaneGeometry(planeSize * 0.92, planeSize * 0.92),
            createShardMaterial(color)
          );
          shard.position.set(localX, localY, 0).add(faceTransform.position);
          shard.rotation.copy(faceTransform.rotation);
          group.add(shard);

          randomDirection.set(
            (Math.random() - 0.5) * 0.7,
            Math.random() * 0.5 + 0.1,
            (Math.random() - 0.5) * 0.7,
          ).normalize();

          worldDirection.copy(faceTransform.normal).multiplyScalar(1.25).add(randomDirection).normalize();

          shards.push({
            mesh: shard,
            velocity: worldDirection.clone().multiplyScalar(spread * (0.55 + Math.random() * 0.7)).add(new THREE.Vector3(0, lift * Math.random(), 0)),
            spin: new THREE.Vector3(
              (Math.random() - 0.5) * 14,
              (Math.random() - 0.5) * 14,
              (Math.random() - 0.5) * 14,
            ),
          });
        }
      }
    }

    activeEffects.push({
      group,
      shards,
      age: 0,
      duration,
    });
  }

  function update(deltaTime) {
    for (let i = activeEffects.length - 1; i >= 0; i--) {
      const effect = activeEffects[i];
      effect.age += deltaTime;
      const t = effect.age / effect.duration;

      if (t >= 1) {
        for (const shard of effect.shards) {
          shard.mesh.geometry.dispose();
          shard.mesh.material.dispose();
        }
        scene.remove(effect.group);
        activeEffects.splice(i, 1);
        continue;
      }

      const opacity = 1 - t;

      for (const shard of effect.shards) {
        shard.mesh.position.addScaledVector(shard.velocity, deltaTime);
        shard.velocity.y -= 9.5 * deltaTime * 0.45;
        shard.mesh.rotation.x += shard.spin.x * deltaTime;
        shard.mesh.rotation.y += shard.spin.y * deltaTime;
        shard.mesh.rotation.z += shard.spin.z * deltaTime;
        shard.mesh.material.opacity = opacity;
        const scale = 1 - (t * 0.28);
        shard.mesh.scale.setScalar(scale);
      }
    }
  }

  return {
    spawn,
    update,
  };
}
