import * as THREE from 'three';

let glowTexture = null;

function getGlowTexture() {
  if (glowTexture) return glowTexture;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

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
    opacity: 0.88,
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
    color = 0x7d3a3f,
    segmentCount = 3,
    duration = 0.95,
    spread = 5.5,
    lift = 1.15,
  } = {}) {
    const group = new THREE.Group();
    group.position.copy(position);
    scene.add(group);

    const flashMaterial = new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    flashMaterial.toneMapped = false;
    const flash = new THREE.Sprite(flashMaterial);
    flash.scale.setScalar(size * 1.5);
    group.add(flash);

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
            new THREE.PlaneGeometry(planeSize * 0.62, planeSize * 0.62),
            createShardMaterial(color)
          );
          shard.position.set(localX, localY, 0).add(faceTransform.position);
          shard.rotation.copy(faceTransform.rotation);
          group.add(shard);

          randomDirection.set(
            (Math.random() - 0.5) * 0.45,
            Math.random() * 0.28 + 0.05,
            (Math.random() - 0.5) * 0.45,
          ).normalize();

          worldDirection.copy(faceTransform.normal).multiplyScalar(0.72).add(randomDirection).normalize();

          shards.push({
            mesh: shard,
            velocity: worldDirection.clone().multiplyScalar(spread * (0.45 + Math.random() * 0.45)).add(new THREE.Vector3(0, lift * Math.random(), 0)),
            spin: new THREE.Vector3(
              (Math.random() - 0.5) * 7,
              (Math.random() - 0.5) * 7,
              (Math.random() - 0.5) * 7,
            ),
          });
        }
      }
    }

    activeEffects.push({
      group,
      flash,
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
        effect.flash.material.dispose();
        for (const shard of effect.shards) {
          shard.mesh.geometry.dispose();
          shard.mesh.material.dispose();
        }
        scene.remove(effect.group);
        activeEffects.splice(i, 1);
        continue;
      }

      const opacity = 1 - t;
      if (effect.flash) {
        const flashOpacity = 0.42 * Math.pow(1 - t, 1.4);
        const flashScale = 1 + (t * 2.6);
        effect.flash.material.opacity = flashOpacity;
        effect.flash.scale.setScalar(flashScale * 1.6);
      }

      for (const shard of effect.shards) {
        shard.mesh.position.addScaledVector(shard.velocity, deltaTime);
        shard.velocity.multiplyScalar(0.992);
        shard.velocity.y -= 9.5 * deltaTime * 0.08;
        shard.mesh.rotation.x += shard.spin.x * deltaTime;
        shard.mesh.rotation.y += shard.spin.y * deltaTime;
        shard.mesh.rotation.z += shard.spin.z * deltaTime;
        shard.mesh.material.opacity = opacity;
        const scale = 1 - (t * 0.18);
        shard.mesh.scale.setScalar(scale);
      }
    }
  }

  return {
    spawn,
    update,
  };
}
