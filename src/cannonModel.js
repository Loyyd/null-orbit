import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();
let cannonTemplatePromise = null;

function setObjectShadows(root, castShadow = true, receiveShadow = true) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = castShadow;
    child.receiveShadow = receiveShadow;
  });
}

function fitCannonModel(model, options = {}) {
  const {
    targetWidth = 0.45,
    targetHeight = 0.45,
    targetLength = 1.5,
    rotationY = Math.PI / 2,
    offsetY = 0,
    offsetZ = 0,
  } = options;

  model.rotation.y = rotationY;

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (size.lengthSq() === 0) {
    return;
  }

  const scale = Math.min(
    targetWidth / Math.max(size.x, 0.001),
    targetHeight / Math.max(size.y, 0.001),
    targetLength / Math.max(size.z, 0.001)
  );

  model.scale.setScalar(scale);

  const scaledBounds = new THREE.Box3().setFromObject(model);
  const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());
  const scaledSize = scaledBounds.getSize(new THREE.Vector3());
  model.position.sub(scaledCenter);
  model.position.y += scaledSize.y * 0.5 + offsetY;
  model.position.z += offsetZ;
}

function loadCannonTemplate() {
  if (!cannonTemplatePromise) {
    cannonTemplatePromise = new Promise((resolve, reject) => {
      gltfLoader.load(
        '/models/cannon.glb',
        (gltf) => resolve(gltf.scene),
        undefined,
        reject
      );
    });
  }

  return cannonTemplatePromise;
}

export function attachCannonModel(parent, options = {}) {
  loadCannonTemplate()
    .then((template) => {
      const model = template.clone(true);
      fitCannonModel(model, options);
      setObjectShadows(model, true, true);
      parent.add(model);
      options.onLoad?.(model);
      if (options.fallbackMesh) {
        options.fallbackMesh.visible = false;
      }
    })
    .catch((error) => {
      console.error('Failed to load cannon model:', error);
    });
}
