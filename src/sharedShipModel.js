import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getAssetPath } from './paths';

const loader = new GLTFLoader();
const modelTemplatePromises = new Map();
const PLAYER_SHIP_MODEL = getAssetPath('models/player_ship.glb');
const COLOSSUS_MODEL = getAssetPath('models/colossus.glb');
const STARSHIP_MODEL = getAssetPath('models/starship.glb');

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry?.dispose?.());
    return;
  }
  material?.dispose?.();
}

function shouldReduceUnitRoughness(modelPath) {
  return modelPath === PLAYER_SHIP_MODEL
    || modelPath === COLOSSUS_MODEL
    || modelPath === STARSHIP_MODEL;
}

function tuneUnitModelMaterials(root, modelPath) {
  if (!shouldReduceUnitRoughness(modelPath)) return;

  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material || !('roughness' in material)) return;
      material.roughness = Math.max(0, (material.roughness ?? 1) * 3.0);
    });
  });
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

export function loadSharedModelTemplate(modelPath = PLAYER_SHIP_MODEL) {
  if (!modelTemplatePromises.has(modelPath)) {
    modelTemplatePromises.set(
      modelPath,
      loader.loadAsync(modelPath).then((gltf) => gltf.scene)
    );
  }
  return modelTemplatePromises.get(modelPath);
}

export async function cloneSharedModel(options, modelPath = PLAYER_SHIP_MODEL) {
  const template = await loadSharedModelTemplate(modelPath);
  const model = template.clone(true);
  tuneUnitModelMaterials(model, modelPath);
  fitModelToBounds(model, options);
  return model;
}

export async function attachSharedModel(parent, options, modelPath = PLAYER_SHIP_MODEL, onError = null) {
  try {
    const model = await cloneSharedModel(options, modelPath);
    parent.add(model);
    return model;
  } catch (error) {
    console.error(`Failed to load model ${modelPath}:`, error);
    onError?.(error);
    return null;
  }
}

export async function createSharedModelInstancedRenderer(scene, maxCount, fitOptions, modelPath = PLAYER_SHIP_MODEL) {
  const template = await cloneSharedModel(fitOptions, modelPath);
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
    // These instance transforms move constantly and can span a wide area,
    // so relying on default instanced-mesh frustum bounds causes models to
    // pop out or stay invisible even while their gameplay continues.
    instancedMesh.frustumCulled = false;
    instancedMesh.count = 0;
    scene.add(instancedMesh);

    parts.push({
      mesh: instancedMesh,
      relativeMatrix: child.matrixWorld.clone(),
    });
  });

  return new SharedShipInstancedRenderer(scene, parts);
}

export function loadSharedShipTemplate() {
  return loadSharedModelTemplate(PLAYER_SHIP_MODEL);
}

export async function cloneSharedShipModel(options) {
  return cloneSharedModel(options, PLAYER_SHIP_MODEL);
}

export async function attachSharedShipModel(parent, options, onError = null) {
  return attachSharedModel(parent, options, PLAYER_SHIP_MODEL, onError);
}

export async function createSharedShipInstancedRenderer(scene, maxCount, fitOptions) {
  return createSharedModelInstancedRenderer(scene, maxCount, fitOptions, PLAYER_SHIP_MODEL);
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

  setInstanceColor(index, color) {
    this.parts.forEach((part) => {
      part.mesh.setColorAt(index, color);
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
      if (part.mesh.instanceColor) {
        part.mesh.instanceColor.needsUpdate = true;
      }
      part.mesh.computeBoundingSphere();
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
