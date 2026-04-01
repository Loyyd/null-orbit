import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
let shipTemplatePromise = null;

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry?.dispose?.());
    return;
  }
  material?.dispose?.();
}

export function fitModelToBounds(model, {
  targetWidth,
  targetHeight,
  targetLength,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
  offsetY = 0,
}) {
  model.rotation.set(rotationX, rotationY, rotationZ);

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (size.lengthSq() === 0) return;

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
}

export function loadSharedShipTemplate() {
  if (!shipTemplatePromise) {
    shipTemplatePromise = loader.loadAsync('/models/player_ship.glb').then((gltf) => gltf.scene);
  }
  return shipTemplatePromise;
}

export async function cloneSharedShipModel(options) {
  const template = await loadSharedShipTemplate();
  const model = template.clone(true);
  fitModelToBounds(model, options);
  return model;
}

export async function attachSharedShipModel(parent, options, onError = null) {
  try {
    const model = await cloneSharedShipModel(options);
    parent.add(model);
    return model;
  } catch (error) {
    console.error('Failed to load shared ship model:', error);
    onError?.(error);
    return null;
  }
}

export async function createSharedShipInstancedRenderer(scene, maxCount, fitOptions) {
  const template = await cloneSharedShipModel(fitOptions);
  template.updateMatrixWorld(true);

  const parts = [];
  template.traverse((child) => {
    if (!child.isMesh) return;

    const geometry = child.geometry.clone();
    const material = Array.isArray(child.material)
      ? child.material.map((entry) => entry.clone())
      : child.material.clone();
    const instancedMesh = new THREE.InstancedMesh(geometry, material, maxCount);
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instancedMesh.castShadow = false;
    instancedMesh.receiveShadow = false;
    instancedMesh.count = 0;
    scene.add(instancedMesh);

    parts.push({
      mesh: instancedMesh,
      relativeMatrix: child.matrixWorld.clone(),
    });
  });

  return new SharedShipInstancedRenderer(scene, parts);
}

class SharedShipInstancedRenderer {
  constructor(scene, parts) {
    this.scene = scene;
    this.parts = parts;
    this.rootPosition = new THREE.Vector3();
    this.rootQuaternion = new THREE.Quaternion();
    this.rootScale = new THREE.Vector3();
    this.rootMatrix = new THREE.Matrix4();
    this.finalMatrix = new THREE.Matrix4();
    this.hiddenMatrix = new THREE.Matrix4().makeTranslation(0, -9999, 0);
  }

  setCount(count) {
    this.parts.forEach((part) => {
      part.mesh.count = count;
      part.mesh.instanceMatrix.needsUpdate = true;
    });
  }

  setInstanceTransform(index, x, z, yaw, scale) {
    this.rootPosition.set(x, 0, z);
    this.rootQuaternion.setFromEuler(new THREE.Euler(0, yaw, 0));
    this.rootScale.set(scale, scale, scale);
    this.rootMatrix.compose(this.rootPosition, this.rootQuaternion, this.rootScale);

    this.parts.forEach((part) => {
      this.finalMatrix.multiplyMatrices(this.rootMatrix, part.relativeMatrix);
      part.mesh.setMatrixAt(index, this.finalMatrix);
    });
  }

  hideInstance(index) {
    this.parts.forEach((part) => {
      part.mesh.setMatrixAt(index, this.hiddenMatrix);
    });
  }

  flush() {
    this.parts.forEach((part) => {
      part.mesh.instanceMatrix.needsUpdate = true;
    });
  }

  dispose() {
    this.parts.forEach((part) => {
      this.scene.remove(part.mesh);
      part.mesh.geometry.dispose();
      disposeMaterial(part.mesh.material);
    });
  }
}
