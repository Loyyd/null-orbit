import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Projectile } from './projectile';
import { BaseStation } from './base';
import { WaveManager } from './waveManager';
import { Cannon } from './cannon';
import { loadGameOptions } from './gameOptions';
import { loadMap } from './mapData';
import { createSpace } from './environment';
import { movePlayerWithObstaclePhysics } from './obstacleNavigation';
import { buildOccupancyMap, createGridAdapter } from './navigation/grid';
import { FlowFieldUnitController } from './units/FlowFieldUnitController';
import { createGameUi } from './gameUi';

// --- Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000); // Extended far plane
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ReinhardToneMapping;
document.body.appendChild(renderer.domElement);

// --- Environment ---
createSpace(scene);

// --- Map Data ---
const mapData = loadMap();
const gameOptions = loadGameOptions();

// --- Post-Processing ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Stronger star-like light
directionalLight.position.set(50, 100, 70);
scene.add(directionalLight);
const gltfLoader = new GLTFLoader();
// --- Game State ---
const clock = new THREE.Clock();
let acceleration = gameOptions.player.acceleration;
let rotationSpeed = gameOptions.player.rotationSpeed;
let currentTier = 1;
let playerHealth = gameOptions.player.maxHealth;
const maxPlayerHealth = gameOptions.player.maxHealth;
let isDead = false;
let isPaused = false;
let respawnTimer = 0;
let hasShieldModule = false;
let hasYamatoModule = false;
let shieldActive = false;
let shieldDuration = 0;
let isDebugMode = false;
let selectedModuleId = null;
const purchasedModules = [];
const yamatoEffects = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const SHIELD_COOLDOWN_MS = gameOptions.modules.shieldCooldownMs;
const YAMATO_COOLDOWN_MS = gameOptions.modules.yamatoCooldownMs;
const CAMERA_BASE_HEIGHT = 35;
const CAMERA_BASE_DISTANCE = 25;
const CAMERA_MIN_ZOOM = 0.2;
const CAMERA_MAX_ZOOM = 1;
const CAMERA_ZOOM_STEP = 0.08;
const CAMERA_ZOOMED_IN_HEIGHT_BONUS = 5;
let cameraZoom = CAMERA_MAX_ZOOM;

function togglePause() {
  isPaused = !isPaused;
  ui.setPaused(isPaused);
}

// --- Objects ---
const player = new THREE.Group();
player.position.set(mapData.playerStart.x, 0, mapData.playerStart.z);
scene.add(player);

const playerVisualRoot = new THREE.Group();
player.add(playerVisualRoot);

const playerGeometry = new THREE.BoxGeometry(1, 0.5, 2);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.5 });
const fallbackPlayerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
playerVisualRoot.add(fallbackPlayerMesh);
let playerModel = null;

let playerBaseColor = 0x00ff00;
let playerBaseEmissiveIntensity = 0.5;

function forEachObjectMaterial(root, callback) {
  root.traverse((child) => {
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (material) callback(material);
    });
  });
}

function setPlayerAppearance(colorHex, emissiveIntensity = playerBaseEmissiveIntensity) {
  playerBaseColor = colorHex;
  playerBaseEmissiveIntensity = emissiveIntensity;

  forEachObjectMaterial(fallbackPlayerMesh, (material) => {
    material.color?.setHex?.(colorHex);
    material.emissive?.setHex?.(colorHex);
    if (material.emissiveIntensity !== undefined) {
      material.emissiveIntensity = emissiveIntensity;
    }
  });

  if (!playerModel) return;
  forEachObjectMaterial(playerModel, (material) => {
    if (material.emissiveIntensity !== undefined) {
      material.emissiveIntensity = emissiveIntensity;
    }
  });
}

function fitPlayerModel(model) {
  model.rotation.y = -Math.PI / 2;

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (size.lengthSq() === 0) return;

  const targetWidth = 2.1;
  const targetHeight = 1.05;
  const targetLength = 4.2;
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
  model.position.y += scaledSize.y * 0.5;
}

function fitStaticModel(model, {
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

gltfLoader.load(
  '/models/player_ship.glb',
  (gltf) => {
    fallbackPlayerMesh.visible = false;
    playerModel = gltf.scene;
    fitPlayerModel(playerModel);
    playerVisualRoot.add(playerModel);
    setPlayerAppearance(playerBaseColor, playerBaseEmissiveIntensity);
  },
  undefined,
  (error) => {
    console.error('Failed to load player ship model:', error);
  }
);

// Player Range Mesh (Debug)
const createRadiusCircle = (radius, color, opacity) => {
  const segments = 128;
  const geometry = new THREE.RingGeometry(radius - 0.2, radius + 0.2, segments);
  const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = -0.4;
  return mesh;
};
const playerRangeMesh = createRadiusCircle(25, 0x00ff00, 0.2);
playerRangeMesh.visible = false;
scene.add(playerRangeMesh);

// Shield Visual
const shieldGeo = new THREE.SphereGeometry(2, 32, 32);
const shieldMat = new THREE.MeshStandardMaterial({ 
  color: 0x00ffff, 
  transparent: true, 
  opacity: 0.3, 
  emissive: 0x00ffff, 
  emissiveIntensity: 1 
});
const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
shieldMesh.visible = false;
player.add(shieldMesh);

const ui = createGameUi({
  onResume: togglePause,
  onRestart: () => window.location.reload(),
  onBloomInput: (value) => {
    bloomPass.strength = value;
  },
  onAmbientInput: (value) => {
    ambientLight.intensity = value;
  },
  onUpgradeCannons: () => addCannons(2),
  onUpgradeSpeed: () => {
    acceleration += 0.0025;
    rotationSpeed += 0.0025;
  },
  onUpgradeTier2: () => {
    if (currentTier < 2) {
      currentTier = 2;
      player.scale.set(1.5, 1.5, 1.5);
      setPlayerAppearance(0x00ffff, playerBaseEmissiveIntensity);
      ui.setTier2ButtonLabel('Evolution: Maxed');
    }
  },
  onBuyShield: () => {
    if (hasShieldModule) return;
    hasShieldModule = true;
    addPurchasedModule('shield', 'S', 'Shield', activateShieldModule, SHIELD_COOLDOWN_MS);
    ui.hideShieldUpgrade();
  },
  onBuyYamato: () => {
    if (hasYamatoModule) return;
    hasYamatoModule = true;
    addPurchasedModule('yamato', 'Y', 'Yamato', activateYamatoModule, YAMATO_COOLDOWN_MS);
    ui.hideYamatoUpgrade();
  },
  onBaseUpgradeCannons: () => activeFriendlyBase.addCannon(),
  onBaseUpgradeSpawn: () => activeFriendlyBase.upgradeSpawnRate(),
});

function getAbilityTargets() {
  return [...enemies, ...(enemyBase.owner === 'enemy' ? [enemyBase] : [])];
}

function updateModuleBarVisibility() {
  ui.moduleBar.style.display = purchasedModules.length > 0 && !isDead ? 'flex' : 'none';
}

function getPurchasedModule(id) {
  return purchasedModules.find((module) => module.id === id) || null;
}

function getModuleCooldownRemaining(module, now = performance.now()) {
  return Math.max(0, module.cooldownMs - (now - module.lastUsedAt));
}

function refreshModuleButtons() {
  const now = performance.now();

  purchasedModules.forEach((module, index) => {
    const coolingDown = getModuleCooldownRemaining(module, now) > 0;
    module.slot.textContent = `${index + 1}`;
    module.button.classList.toggle('active', module.id === 'shield' ? shieldActive : selectedModuleId === module.id);
    module.button.classList.toggle('targeting', selectedModuleId === module.id);
    module.button.classList.toggle('cooldown', coolingDown);
    module.button.disabled = coolingDown;
    module.button.title = coolingDown
      ? `${Math.ceil(getModuleCooldownRemaining(module, now) / 1000)}s cooldown`
      : module.label;
  });
}

function clearSelectedModule() {
  selectedModuleId = null;
  renderer.domElement.style.cursor = '';
  refreshModuleButtons();
}

function activateShieldModule() {
  if (!hasShieldModule || shieldActive || isDead) return;
  const shieldModule = getPurchasedModule('shield');
  if (!shieldModule || getModuleCooldownRemaining(shieldModule) > 0) return;

  shieldModule.lastUsedAt = performance.now();
  shieldActive = true;
  shieldDuration = gameOptions.modules.shieldDuration;
  shieldMesh.visible = true;
  refreshModuleButtons();
}

function spawnYamatoEffect(position, radius) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.15, radius * 0.2, 48),
    new THREE.MeshBasicMaterial({
      color: 0x66d9ff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(position);
  ring.position.y = 0.15;
  scene.add(ring);

  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.2, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xb8f3ff,
      transparent: true,
      opacity: 0.45,
    })
  );
  flash.position.copy(position);
  flash.position.y = 0.75;
  scene.add(flash);

  yamatoEffects.push({
    ring,
    flash,
    age: 0,
    duration: 0.45,
    radius,
  });
}

function fireYamatoStrike(position) {
  if (!hasYamatoModule || isDead) return;
  const yamatoModule = getPurchasedModule('yamato');
  if (!yamatoModule || getModuleCooldownRemaining(yamatoModule) > 0) return;

  const radius = gameOptions.modules.yamatoRadius;
  const damage = gameOptions.modules.yamatoDamage;
  yamatoModule.lastUsedAt = performance.now();
  spawnYamatoEffect(position, radius);

  getAbilityTargets().forEach((target) => {
    if (target.isDead) return;
    const impactRadius = radius + (target.hitRadius || 0);
    if (target.mesh.position.distanceTo(position) <= impactRadius) {
      target.takeDamage(damage);
    }
  });

  clearSelectedModule();
}

function activateYamatoModule() {
  if (!hasYamatoModule || isDead) return;
  const yamatoModule = getPurchasedModule('yamato');
  if (!yamatoModule || getModuleCooldownRemaining(yamatoModule) > 0) return;

  selectedModuleId = selectedModuleId === 'yamato' ? null : 'yamato';
  renderer.domElement.style.cursor = selectedModuleId === 'yamato' ? 'crosshair' : '';
  refreshModuleButtons();
}

function addPurchasedModule(id, icon, label, activate, cooldownMs) {
  if (purchasedModules.some((module) => module.id === id)) {
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'module-btn';
  button.innerHTML = `
    <span class="module-slot"></span>
    <span class="module-icon">${icon}</span>
    <span class="module-label">${label}</span>
  `;

  const slot = button.querySelector('.module-slot');
  button.addEventListener('click', activate);
  ui.moduleBar.appendChild(button);
  purchasedModules.push({ id, button, slot, label, activate, cooldownMs, lastUsedAt: -Infinity });
  updateModuleBarVisibility();
  refreshModuleButtons();
}

const cannons = [];
function addCannons(count) {
  const pairs = Math.max(1, Math.floor(count / 2));
  for (let i = 0; i < pairs; i++) {
    const row = Math.floor(cannons.length / 2);
    const zPos = -0.5 + (row * 0.4);
    const cannonConfig = {
      range: gameOptions.player.cannonRange,
      fireRateMin: gameOptions.player.cannonFireRateMin,
      fireRateMax: gameOptions.player.cannonFireRateMax,
      damage: gameOptions.player.cannonDamage,
    };
    cannons.push(new Cannon(scene, player, new THREE.Vector3(-0.6, 0, zPos), cannonConfig));
    cannons.push(new Cannon(scene, player, new THREE.Vector3(0.6, 0, zPos), cannonConfig));
  }
}
addCannons(2);

const basePosition = new THREE.Vector3(mapData.basePosition.x, 0, mapData.basePosition.z);
const base = new BaseStation(scene, basePosition, 'player', gameOptions);
const enemyBasePosition = new THREE.Vector3(mapData.enemyBasePosition.x, 0, mapData.enemyBasePosition.z);
const enemyBase = new BaseStation(scene, enemyBasePosition, 'enemy', gameOptions);
base.setDebugVisible(false);
enemyBase.setDebugVisible(false);
const waveManager = new WaveManager(scene, gameOptions);
const navigationGrid = createGridAdapter({
  width: 40,
  height: 140,
  cellSize: 2,
  minX: -40,
  minZ: -140,
});

// --- Obstacles ---
const obstacleColliders = [];
const rockSpinners = [];
const obsMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.7, roughness: 0.35 });
let rocksModelTemplate = null;
gltfLoader.load(
  '/models/rocks.glb',
  (gltf) => {
    rocksModelTemplate = gltf.scene;
    mapData.obstacles.forEach((o) => {
      const visualRoot = o._visualRoot;
      if (!visualRoot) return;

      const rockModel = rocksModelTemplate.clone(true);
      const spinAxis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() * 0.35 + 0.65,
        Math.random() - 0.5
      ).normalize();
      const spinSpeed = 0.025 + Math.random() * 0.035;
      fitStaticModel(rockModel, {
        targetWidth: Math.max((o.w || 2) * 1.2, 2.4),
        targetHeight: 3,
        targetLength: Math.max((o.h || 2) * 1.2, 2.4),
        rotationX: (Math.random() - 0.5) * 0.35,
        rotationY: Math.random() * Math.PI * 2,
        rotationZ: (Math.random() - 0.5) * 0.35,
        offsetY: -0.2,
      });
      visualRoot.add(rockModel);
      rockSpinners.push({
        model: rockModel,
        axis: spinAxis,
        speed: spinSpeed,
      });
      if (o._fallbackMesh) {
        o._fallbackMesh.visible = false;
      }
    });
  },
  undefined,
  (error) => {
    console.error('Failed to load rocks model:', error);
  }
);
mapData.obstacles.forEach(o => {
  const w = o.w || 2;
  const h = o.h || 2;
  const obstacle = new THREE.Group();
  obstacle.position.set(o.x, 0, o.z);
  scene.add(obstacle);

  const visualRoot = new THREE.Group();
  obstacle.add(visualRoot);

  const obsGeo = new THREE.BoxGeometry(w, 2, h);
  const fallbackMesh = new THREE.Mesh(obsGeo, obsMat);
  obstacle.add(fallbackMesh);

  o._visualRoot = visualRoot;
  o._fallbackMesh = fallbackMesh;
  obstacleColliders.push({ x: o.x, z: o.z, w, h });
});
const occupancyMap = buildOccupancyMap(obstacleColliders, navigationGrid, gameOptions.flowField.occupancyPadding);
const enemyController = new FlowFieldUnitController(scene, occupancyMap, navigationGrid, {
  maxUnits: gameOptions.enemy.maxUnits,
  separationRadius: gameOptions.enemy.separationRadius,
  separationStrength: gameOptions.enemy.separationStrength,
  obstacleAvoidanceStrength: gameOptions.enemy.obstacleAvoidanceStrength,
  boundsLimit: gameOptions.enemy.boundsLimit,
  enemyConfig: gameOptions.enemy,
});

// --- Bombs ---
const bombs = [];
const bombGeo = new THREE.SphereGeometry(1, 16, 16);
const bombMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 });
let bombModelTemplate = null;
gltfLoader.load(
  '/models/bomb.glb',
  (gltf) => {
    bombModelTemplate = gltf.scene;
    bombs.forEach((bomb) => {
      const bombModel = bombModelTemplate.clone(true);
      fitStaticModel(bombModel, {
        targetWidth: 2.5,
        targetHeight: 2.5,
        targetLength: 2.5,
        rotationY: Math.random() * Math.PI * 2,
        offsetY: -0.15,
      });
      bomb.add(bombModel);
      if (bomb.userData.fallbackMesh) {
        bomb.userData.fallbackMesh.visible = false;
      }
    });
  },
  undefined,
  (error) => {
    console.error('Failed to load bomb model:', error);
  }
);
if (mapData.bombs) {
  mapData.bombs.forEach(b => {
    const bomb = new THREE.Group();
    bomb.position.set(b.x, 0, b.z);
    const fallbackMesh = new THREE.Mesh(bombGeo, bombMat);
    bomb.add(fallbackMesh);
    bomb.userData.fallbackMesh = fallbackMesh;
    scene.add(bomb);

    if (bombModelTemplate) {
      const bombModel = bombModelTemplate.clone(true);
      fitStaticModel(bombModel, {
        targetWidth: 2.5,
        targetHeight: 2.5,
        targetLength: 2.5,
        rotationY: Math.random() * Math.PI * 2,
        offsetY: -0.15,
      });
      bomb.add(bombModel);
      fallbackMesh.visible = false;
    }

    bombs.push(bomb);
  });
}

// --- Tactical Grid (Holographic) ---
const gridHelper = new THREE.GridHelper(2000, 200, 0x00ffff, 0x004444);
gridHelper.position.y = -0.5;
gridHelper.material.transparent = true;
gridHelper.material.opacity = 0.2;
scene.add(gridHelper);

// --- Loop Variables ---
const enemies = enemyController.targets;
const projectiles = [];
const probes = [];
let velocity = new THREE.Vector3();
const keys = { w: false, a: false, s: false, d: false };
const targetCameraPos = new THREE.Vector3();
let activeFriendlyBase = base;

// --- Event Listeners ---
window.addEventListener('keydown', (e) => { 
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; 
  if (e.key === 'Escape') togglePause();
  if (e.key >= '1' && e.key <= '9') {
    const module = purchasedModules[Number(e.key) - 1];
    if (module) {
      module.activate();
    }
  }
  if (e.key === 'F2') {
    isDebugMode = !isDebugMode;
    ui.setDebugVisible(isDebugMode);
    playerRangeMesh.visible = isDebugMode;
    base.setDebugVisible(isDebugMode);
    enemyBase.setDebugVisible(isDebugMode);
  }
});
window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
});
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (selectedModuleId !== 'yamato' || isPaused || isDead) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);

  const targetPoint = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(groundPlane, targetPoint)) return;
  targetPoint.y = 0;
  fireYamatoStrike(targetPoint);
});
renderer.domElement.addEventListener('wheel', (event) => {
  event.preventDefault();
  const zoomDelta = event.deltaY > 0 ? CAMERA_ZOOM_STEP : -CAMERA_ZOOM_STEP;
  cameraZoom = THREE.MathUtils.clamp(cameraZoom + zoomDelta, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
}, { passive: false });

function onPlayerHit(damage) {
  if (isDead || shieldActive) return;
  playerHealth -= damage;
  setPlayerAppearance(playerBaseColor, 2);
  setTimeout(() => { setPlayerAppearance(playerBaseColor, playerBaseEmissiveIntensity); }, 100);
  if (playerHealth <= 0) triggerDeath();
}

function disposeObjectMaterials(material) {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry?.dispose?.());
    return;
  }
  material?.dispose?.();
}

function destroyBomb(bombIndex) {
  const bomb = bombs[bombIndex];
  if (!bomb) return;

  scene.remove(bomb);
  bomb.traverse((child) => {
    child.geometry?.dispose?.();
    disposeObjectMaterials(child.material);
  });
  bombs.splice(bombIndex, 1);
}

function triggerDeath() {
  isDead = true;
  playerHealth = 0;
  player.visible = false;
  shieldActive = false;
  shieldMesh.visible = false;
  clearSelectedModule();
  updateModuleBarVisibility();
  respawnTimer = 10;
  ui.setRespawnVisible(true);
  velocity.set(0, 0, 0);
}

function respawn() {
  isDead = false;
  playerHealth = maxPlayerHealth;
  player.visible = true;
  player.position.copy(basePosition);
  ui.setRespawnVisible(false);
  updateModuleBarVisibility();
  refreshModuleButtons();
}

function animate() {
  requestAnimationFrame(animate);

  if (isPaused) {
    composer.render();
    return;
  }
  
  const deltaTime = clock.getDelta();
  const time = clock.elapsedTime * 1000;
  refreshModuleButtons();
  for (let i = 0; i < rockSpinners.length; i++) {
    const spinner = rockSpinners[i];
    spinner.model.rotateOnAxis(spinner.axis, spinner.speed * deltaTime);
  }

  if (isDebugMode) {
    playerRangeMesh.position.copy(player.position);
    playerRangeMesh.position.y = -0.4;
    const fps = Math.round(1 / (deltaTime || 0.01));
    ui.setDebugText(
`[DEBUG MODE]
FPS: ${fps}
POS: X:${player.position.x.toFixed(2)} Y:${player.position.y.toFixed(2)} Z:${player.position.z.toFixed(2)}
VEL: ${velocity.length().toFixed(4)}
HP: ${playerHealth.toFixed(1)} / ${maxPlayerHealth}
ENEMIES: ${enemies.length}
PROJECTILES: ${projectiles.length}
PROBES: ${probes.length}
WAVE: ${waveManager.waveLevel}`
    );
  }

  if (!isDead) {

    if (keys.a) player.rotation.y += rotationSpeed * deltaTime * 60;
    if (keys.d) player.rotation.y -= rotationSpeed * deltaTime * 60;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    if (keys.w) velocity.addScaledVector(dir, acceleration * deltaTime * 60);
    if (keys.s) velocity.addScaledVector(dir, -acceleration * deltaTime * 60);
    const playerMovement = movePlayerWithObstaclePhysics(player.position, velocity, 1.1, obstacleColliders, {
      bounceDamping: 0.2,
      wallFriction: 0.84,
      pushbackDistance: 0.22,
      stepCount: 5,
    });
    player.position.copy(playerMovement.position);
    velocity.copy(playerMovement.velocity);
    velocity.multiplyScalar(Math.pow(0.991, deltaTime * 60)); // Resolution-independent drag

    // Bomb collision
    for (let i = bombs.length - 1; i >= 0; i--) {
      const bomb = bombs[i];
      const dist = player.position.distanceTo(bomb.position);
      if (dist < 1.5 && !isDead) { // Collision radius
        destroyBomb(i);
        triggerDeath();
        break;
      }
    }

    // Shield logic
    if (shieldActive) {
      shieldDuration -= deltaTime;
      shieldMesh.material.opacity = 0.3 + Math.sin(time * 0.01) * 0.1;
      shieldMesh.rotation.y += 0.01;
      if (shieldDuration <= 0) {
        shieldActive = false;
        shieldMesh.visible = false;
        refreshModuleButtons();
      }
    }
  } else {
    respawnTimer -= deltaTime;
    ui.setRespawnText(`RESPAWNING IN ${Math.ceil(respawnTimer)}`);
    if (respawnTimer <= 0) respawn();
  }

  const playerTarget = {
    get isDead() { return isDead; },
    get mesh() { return player; },
    takeDamage: (amt) => onPlayerHit(amt)
  };

  waveManager.update(player.position, enemyController, deltaTime);
  const allBases = [base, enemyBase];
  const playerOwnedBases = allBases.filter((station) => station.owner === 'player');
  const enemyOwnedBases = allBases.filter((station) => station.owner === 'enemy');
  const playerTargets = [...enemies, ...enemyOwnedBases];
  const enemyTargets = [playerTarget, ...probes, ...playerOwnedBases];

  if (!isDead) cannons.forEach(cannon => cannon.update(time, playerTargets, projectiles));

  const nearOwnedBases = playerOwnedBases.filter(
    (station) => station.mesh.position.distanceTo(player.position) < station.interactionRange
  );
  activeFriendlyBase = nearOwnedBases[0] || playerOwnedBases[0] || base;

  let isNearBase = false;
  allBases.forEach((station) => {
    const nearThisBase = station.update(
      player.position,
      enemies,
      projectiles,
      time,
      probes,
      playerHealth,
      maxPlayerHealth,
      station.owner === 'player' ? playerTargets : enemyTargets,
      camera
    );
    if (station.owner === 'player' && nearThisBase) {
      isNearBase = true;
    }
  });
  
  const canUseUpgradeMenus = !isDead && (isNearBase || isDebugMode);

  if (canUseUpgradeMenus) {
    ui.setUpgradeMenusVisible(true);
    if (isNearBase) {
      playerHealth = Math.min(maxPlayerHealth, playerHealth + (gameOptions.base.healingRate * deltaTime));
    }
  } else {
    ui.setUpgradeMenusVisible(false);
    const screenAngle = Math.atan2(basePosition.x - player.position.x, player.position.z - basePosition.z);
    ui.setCompassAngle(screenAngle);
  }

  for (let i = probes.length - 1; i >= 0; i--) {
    probes[i].update(enemies, projectiles, camera, deltaTime, obstacleColliders);
    if (probes[i].isDead) probes.splice(i, 1);
  }

  const healthPercent = (playerHealth / maxPlayerHealth) * 100;
  ui.setHealthPercent(healthPercent);
  const distPushed = Math.max(0, Math.floor(Math.abs(player.position.z - mapData.basePosition.z)));
  ui.setStatsText(`Dist: ${distPushed}m | Zone: ${waveManager.waveLevel}`);

  enemyController.update(
    deltaTime,
    isDead ? activeFriendlyBase.mesh.position : player.position,
    enemyTargets,
    projectiles
  );

  for (let i = yamatoEffects.length - 1; i >= 0; i--) {
    const effect = yamatoEffects[i];
    effect.age += deltaTime;
    const t = effect.age / effect.duration;

    if (t >= 1) {
      scene.remove(effect.ring);
      scene.remove(effect.flash);
      effect.ring.geometry.dispose();
      effect.ring.material.dispose();
      effect.flash.geometry.dispose();
      effect.flash.material.dispose();
      yamatoEffects.splice(i, 1);
      continue;
    }

    const ringScale = 0.25 + (t * 1.6);
    effect.ring.scale.setScalar(ringScale);
    effect.ring.material.opacity = 0.85 * (1 - t);

    const flashScale = 1 + (t * 2.4);
    effect.flash.scale.setScalar(flashScale);
    effect.flash.material.opacity = 0.45 * (1 - t);
  }

  for (let i = projectiles.length - 1; i >= 0; i--) { 
    const p = projectiles[i];
    if (p.isEnemy) {
      p.update(enemyTargets, null, deltaTime);
    } else {
      p.update(playerTargets, null, deltaTime); 
    }
    if (p.isRemoved) projectiles.splice(i, 1); 
  }

  if (!isDead) {
    const zoomInAmount = CAMERA_MAX_ZOOM - cameraZoom;
    targetCameraPos.set(
      player.position.x,
      (CAMERA_BASE_HEIGHT * cameraZoom) + (zoomInAmount * CAMERA_ZOOMED_IN_HEIGHT_BONUS / (CAMERA_MAX_ZOOM - CAMERA_MIN_ZOOM)),
      player.position.z + (CAMERA_BASE_DISTANCE * cameraZoom)
    );
    camera.position.lerp(targetCameraPos, 0.05);
    camera.lookAt(player.position);
  }
  composer.render();
}
animate(0);
