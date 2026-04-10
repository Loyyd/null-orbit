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
import { createPlayerAbilities } from './playerAbilities';
import { createShatterEffectSystem } from './shatterEffect';
import { CombatSpatialIndex } from './combatSpatialIndex';

// --- Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000); // Extended far plane
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

// --- Environment ---
const space = createSpace(scene);

// --- Map Data ---
const mapData = loadMap();
const gameOptions = loadGameOptions();

// --- Post-Processing ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.82, 0.66, 0.68);
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xd8eaff, 1.34);
scene.add(ambientLight);
const hemisphereLight = new THREE.HemisphereLight(0xb5e6ff, 0x2f4866, 0.82);
scene.add(hemisphereLight);
const directionalLight = new THREE.DirectionalLight(0xfff1d5, 1.1);
directionalLight.position.set(52, 90, 64);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(2048, 2048);
directionalLight.shadow.camera.near = 1;
directionalLight.shadow.camera.far = 260;
directionalLight.shadow.camera.left = -110;
directionalLight.shadow.camera.right = 110;
directionalLight.shadow.camera.top = 110;
directionalLight.shadow.camera.bottom = -110;
directionalLight.shadow.bias = -0.00018;
directionalLight.shadow.normalBias = 0.03;
scene.add(directionalLight);
const rimLight = new THREE.DirectionalLight(0x8fddff, 0.52);
rimLight.position.set(-68, 42, -90);
scene.add(rimLight);
const gltfLoader = new GLTFLoader();
// --- Game State ---
const timer = new THREE.Timer();
timer.connect(document);
const SHIELD_COOLDOWN_MS = gameOptions.modules.shieldCooldownMs;
const YAMATO_COOLDOWN_MS = gameOptions.modules.yamatoCooldownMs;
const CAMERA_BASE_HEIGHT = 35;
const CAMERA_BASE_DISTANCE = 25;
const CAMERA_MIN_ZOOM = 0.2;
const CAMERA_MAX_ZOOM = 1;
const CAMERA_ZOOM_STEP = 0.08;
const CAMERA_ZOOMED_IN_HEIGHT_BONUS = 5;
const UPGRADE_COST = 10;
const RAPID_FIRE_PRE_TIER_MAX = 3;
const RAPID_FIRE_POST_TIER_MAX = 6;
const ACCELERATION_PRE_TIER_MAX = 1;
const ACCELERATION_POST_TIER_MAX = 4;
const THRUSTER_ACCELERATION_UPGRADE_STEP = 0.0005;
const THRUSTER_ROTATION_UPGRADE_STEP = 0.001;
const THRUSTER_TURNING_BONUS_UPGRADE_STEP = 0.0006;
let activeFriendlyBase = null;

const playerState = {
  acceleration: gameOptions.player.acceleration,
  rotationSpeed: gameOptions.player.rotationSpeed,
  currentTier: 1,
  rapidFireLevel: 0,
  accelerationUpgradeLevel: 0,
  health: gameOptions.player.maxHealth,
  maxHealth: gameOptions.player.maxHealth,
  isDead: false,
  respawnTimer: 0,
  velocity: new THREE.Vector3(),
  abilities: {
    shieldOwned: false,
    shieldActive: false,
    shieldDuration: 0,
    yamatoOwned: false,
    selectedModuleId: null,
  },
  plasmaCells: 1000,
};
const gameState = {
  isPaused: false,
  isDebugMode: false,
  cameraZoom: CAMERA_MAX_ZOOM,
  cameraShakeTime: 0,
  cameraShakeStrength: 0,
};
const CAMERA_SHAKE_DURATION = 1;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const FORWARD_VECTOR = new THREE.Vector3(0, 0, -1);
const debugSpawnPosition = new THREE.Vector3();
const pointerTargetPoint = new THREE.Vector3();
const playerMoveDirection = new THREE.Vector3();

function togglePause() {
  gameState.isPaused = !gameState.isPaused;
  ui.setPaused(gameState.isPaused);
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
fallbackPlayerMesh.castShadow = true;
fallbackPlayerMesh.receiveShadow = true;
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

function setObjectShadows(root, castShadow = true, receiveShadow = true) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = castShadow;
    child.receiveShadow = receiveShadow;
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
    setObjectShadows(playerModel, true, true);
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

let abilities;
function canAffordUpgrade(cost = UPGRADE_COST) {
  return playerState.plasmaCells >= cost;
}

function spendPlasma(cost = UPGRADE_COST) {
  if (!canAffordUpgrade(cost)) {
    return false;
  }
  playerState.plasmaCells -= cost;
  ui.setCurrency(playerState.plasmaCells);
  return true;
}

function getRapidFireUnlockedMax() {
  return playerState.currentTier >= 2 ? RAPID_FIRE_POST_TIER_MAX : RAPID_FIRE_PRE_TIER_MAX;
}

function getAccelerationUnlockedMax() {
  return playerState.currentTier >= 2 ? ACCELERATION_POST_TIER_MAX : ACCELERATION_PRE_TIER_MAX;
}

function canUpgradeRapidFire() {
  return playerState.rapidFireLevel < getRapidFireUnlockedMax();
}

function canUpgradeAcceleration() {
  return playerState.accelerationUpgradeLevel < getAccelerationUnlockedMax();
}

function canUpgradeBaseCannons() {
  return Boolean(activeFriendlyBase?.canUpgradeCannons());
}

function canUpgradeBaseSpawn() {
  return Boolean(activeFriendlyBase?.canUpgradeSpawnRate());
}

function syncUpgradeUi() {
  const canAfford = canAffordUpgrade();
  ui.setUpgradeButtonDisabled('up-cannons', !canAfford || !canUpgradeRapidFire());
  ui.setUpgradeButtonDisabled('up-speed', !canAfford || !canUpgradeAcceleration());
  ui.setUpgradeButtonDisabled('base-up-cannons', !canAfford || !canUpgradeBaseCannons());
  ui.setUpgradeButtonDisabled('base-up-spawn', !canAfford || !canUpgradeBaseSpawn());
  ui.setUpgradeButtonDisabled('base-up-shield', playerState.abilities.shieldOwned || !canAfford);
  ui.setUpgradeButtonDisabled('base-up-yamato', playerState.abilities.yamatoOwned || !canAfford);
  ui.setUpgradeButtonDisabled('up-tier2', playerState.currentTier >= 2 || !canAfford);

  ui.setUpgradeProgress('up-cannons', {
    current: playerState.rapidFireLevel,
    total: RAPID_FIRE_POST_TIER_MAX,
    unlocked: getRapidFireUnlockedMax(),
  });
  ui.setUpgradeProgress('up-speed', {
    current: playerState.accelerationUpgradeLevel,
    total: ACCELERATION_POST_TIER_MAX,
    unlocked: getAccelerationUnlockedMax(),
  });
  ui.setUpgradeProgress('up-tier2', {
    current: playerState.currentTier >= 2 ? 1 : 0,
    total: 1,
    unlocked: 1,
  });
  ui.setUpgradeProgress('base-up-cannons', {
    current: activeFriendlyBase?.getCannonUpgradeLevel?.() ?? 0,
    total: 5,
    unlocked: 5,
  });
  ui.setUpgradeProgress('base-up-spawn', {
    current: activeFriendlyBase?.getSpawnUpgradeLevel?.() ?? 0,
    total: 5,
    unlocked: 5,
  });
  ui.setUpgradeProgress('base-up-shield', {
    current: playerState.abilities.shieldOwned ? 1 : 0,
    total: 1,
    unlocked: 1,
  });
  ui.setUpgradeProgress('base-up-yamato', {
    current: playerState.abilities.yamatoOwned ? 1 : 0,
    total: 1,
    unlocked: 1,
  });

  ui.setUpgradeButtonMeta('up-tier2', {
    title: playerState.currentTier >= 2 ? 'Evolution: Maxed' : 'Evolution: Tier 2',
    description: playerState.currentTier >= 2
      ? 'The ship has already reached its strongest evolution.'
      : 'Evolves the ship into its stronger second form.',
    cost: UPGRADE_COST,
  });
}

const ui = createGameUi({
  onResume: togglePause,
  onRestart: () => window.location.reload(),
  onBloomInput: (value) => {
    bloomPass.strength = value;
  },
  onAmbientInput: (value) => {
    ambientLight.intensity = value;
  },
  onDebugSkipWave: () => {
    waveManager.skipWave();
  },
  onDebugSpawnColossus: () => {
    debugSpawnPosition.set(
      player.position.x + ((Math.random() - 0.5) * 24),
      0,
      player.position.z - 72
    );
    enemyController.spawn(debugSpawnPosition, 'colossus', waveManager.waveLevel);
  },
  onUpgradeCannons: () => {
    if (!canUpgradeRapidFire()) return;
    if (!spendPlasma()) return;
    playerState.rapidFireLevel += 1;
    upgradePlayerCannonFireRate();
    syncUpgradeUi();
  },
  onUpgradeSpeed: () => {
    if (!canUpgradeAcceleration()) return;
    if (!spendPlasma()) return;
    playerState.accelerationUpgradeLevel += 1;
    playerState.acceleration += THRUSTER_ACCELERATION_UPGRADE_STEP;
    playerState.rotationSpeed += THRUSTER_ROTATION_UPGRADE_STEP + THRUSTER_TURNING_BONUS_UPGRADE_STEP;
    syncUpgradeUi();
  },
  onUpgradeTier2: () => {
    if (playerState.currentTier >= 2) return;
    if (!spendPlasma()) return;
    if (playerState.currentTier < 2) {
      playerState.currentTier = 2;
      player.scale.set(1.5, 1.5, 1.5);
      setPlayerAppearance(0x00ffff, playerBaseEmissiveIntensity);
      ui.setTier2ButtonLabel('Evolution: Maxed');
    }
    syncUpgradeUi();
  },
  onBuyShield: () => {
    if (playerState.abilities.shieldOwned) return;
    if (!spendPlasma()) return;
    abilities.buyShieldModule();
    syncUpgradeUi();
  },
  onBuyYamato: () => {
    if (playerState.abilities.yamatoOwned) return;
    if (!spendPlasma()) return;
    abilities.buyYamatoModule();
    syncUpgradeUi();
  },
  onBaseUpgradeCannons: () => {
    if (!canUpgradeBaseCannons()) return;
    if (!spendPlasma()) return;
    if (!activeFriendlyBase.addCannon()) {
      playerState.plasmaCells += UPGRADE_COST;
      ui.setCurrency(playerState.plasmaCells);
      return;
    }
    syncUpgradeUi();
  },
  onBaseUpgradeSpawn: () => {
    if (!canUpgradeBaseSpawn()) return;
    if (!spendPlasma()) return;
    if (!activeFriendlyBase.upgradeSpawnRate()) {
      playerState.plasmaCells += UPGRADE_COST;
      ui.setCurrency(playerState.plasmaCells);
      return;
    }
    syncUpgradeUi();
  },
});
ui.setCurrency(playerState.plasmaCells);
syncUpgradeUi();

function getAbilityTargets() {
  return [...enemies, ...(enemyBase.owner === 'enemy' ? [enemyBase] : [])];
}

const cannons = [];
function upgradePlayerCannonFireRate() {
  for (const cannon of cannons) {
    cannon.fireRate = Math.max(250, cannon.fireRate * 0.82);
  }
}

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
const shatterEffects = createShatterEffectSystem(scene);

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
      const sizeMultiplier = 0.8 + (Math.random() * 0.85);
      const spinAxis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() * 0.35 + 0.65,
        Math.random() - 0.5
      ).normalize();
      const spinSpeed = 0.075 + Math.random() * 0.16;
      fitStaticModel(rockModel, {
        targetWidth: Math.max((o.w || 2) * 1.2, 2.4) * sizeMultiplier,
        targetHeight: 3 * sizeMultiplier,
        targetLength: Math.max((o.h || 2) * 1.2, 2.4) * sizeMultiplier,
        rotationX: (Math.random() - 0.5) * 0.35,
        rotationY: Math.random() * Math.PI * 2,
        rotationZ: (Math.random() - 0.5) * 0.35,
        offsetY: -0.2,
      });
      rockModel.traverse((child) => {
        if (!child.isMesh) return;
        child.receiveShadow = true;
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
  fallbackMesh.castShadow = false;
  fallbackMesh.receiveShadow = true;
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
  onEnemyDestroyed: ({ position, type }) => {
    if (position) {
      const isColossusClass = type === 'colossus';
      const isPulsarClass = type === 'pulsar' || type === 'miniPulsar';
      shatterEffects.spawn(position, {
        size: isColossusClass ? 5.1 : isPulsarClass ? 3.2 : 1.55,
        color: 0xffffff,
        segmentCount: isColossusClass ? 5 : isPulsarClass ? 4 : 3,
        duration: isColossusClass ? 1.45 : isPulsarClass ? 1.2 : 1,
        spread: isColossusClass ? 7.2 : isPulsarClass ? 5.8 : 4.6,
        lift: isColossusClass ? 1.1 : isPulsarClass ? 0.9 : 0.65,
      });
    }
    playerState.plasmaCells += 10;
    ui.setCurrency(playerState.plasmaCells);
    syncUpgradeUi();
  },
});

// --- Bombs ---
const bombs = [];
const bombGeo = new THREE.SphereGeometry(1, 16, 16);
const bombMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 });
let bombModelTemplate = null;

function collectBombMaterials(root) {
  const materials = [];
  root.traverse((child) => {
    if (!child.material) return;
    const entries = Array.isArray(child.material) ? child.material : [child.material];
    entries.forEach((material) => {
      if (material && !materials.includes(material)) {
        materials.push(material);
      }
    });
  });
  return materials;
}

function cloneObjectMaterials(root) {
  root.traverse((child) => {
    if (!child.material) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) => material?.clone?.() ?? material);
      return;
    }
    child.material = child.material.clone?.() ?? child.material;
  });
}

function registerBombVisuals(bomb, bombModel = null) {
  const materialStates = bomb.userData.materialStates || [];

  if (bomb.userData.fallbackMesh) {
    collectBombMaterials(bomb.userData.fallbackMesh).forEach((material) => {
      if (materialStates.some((entry) => entry.material === material)) return;
      materialStates.push({
        material,
        color: material.color?.clone?.() ?? null,
        emissive: material.emissive?.clone?.() ?? null,
        emissiveIntensity: material.emissiveIntensity,
      });
    });
  }

  if (bombModel) {
    collectBombMaterials(bombModel).forEach((material) => {
      if (materialStates.some((entry) => entry.material === material)) return;
      materialStates.push({
        material,
        color: material.color?.clone?.() ?? null,
        emissive: material.emissive?.clone?.() ?? null,
        emissiveIntensity: material.emissiveIntensity,
      });
    });
  }

  bomb.userData.materialStates = materialStates;
  if (bomb.userData.pulseIntervalMs === undefined) {
    bomb.userData.pulseIntervalMs = 2600 + (Math.random() * 1400);
  }
  if (bomb.userData.pulsePhaseMs === undefined) {
    bomb.userData.pulsePhaseMs = Math.random() * bomb.userData.pulseIntervalMs;
  }
}

gltfLoader.load(
  '/models/bomb.glb',
  (gltf) => {
    bombModelTemplate = gltf.scene;
    bombs.forEach((bomb) => {
      const bombModel = bombModelTemplate.clone(true);
      cloneObjectMaterials(bombModel);
      fitStaticModel(bombModel, {
        targetWidth: 2.5,
        targetHeight: 2.5,
        targetLength: 2.5,
        rotationY: Math.random() * Math.PI * 2,
        offsetY: -0.15,
      });
      bomb.add(bombModel);
      registerBombVisuals(bomb, bombModel);
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
    const fallbackMesh = new THREE.Mesh(bombGeo, bombMat.clone());
    bomb.add(fallbackMesh);
    bomb.userData.fallbackMesh = fallbackMesh;
    registerBombVisuals(bomb);
    scene.add(bomb);

    if (bombModelTemplate) {
      const bombModel = bombModelTemplate.clone(true);
      cloneObjectMaterials(bombModel);
      fitStaticModel(bombModel, {
        targetWidth: 2.5,
        targetHeight: 2.5,
        targetLength: 2.5,
        rotationY: Math.random() * Math.PI * 2,
        offsetY: -0.15,
      });
      bomb.add(bombModel);
      registerBombVisuals(bomb, bombModel);
      fallbackMesh.visible = false;
    }

    bombs.push(bomb);
  });
}

// --- Tactical Grid (Holographic) ---
const gridHelper = new THREE.GridHelper(2000, 200, 0x00ffff, 0x004444);
gridHelper.position.y = -0.5;
const gridMaterials = Array.isArray(gridHelper.material) ? gridHelper.material : [gridHelper.material];
gridMaterials.forEach((material) => {
  material.transparent = true;
  material.opacity = 0.12;
  material.depthWrite = false;
});
scene.add(gridHelper);

// --- Loop Variables ---
const enemies = enemyController.targets;
const projectiles = [];
const probes = [];
const keys = { w: false, a: false, s: false, d: false };
const targetCameraPos = new THREE.Vector3();
const playerTargetIndex = new CombatSpatialIndex(12);
const enemyTargetIndex = new CombatSpatialIndex(12);
activeFriendlyBase = base;
abilities = createPlayerAbilities({
  scene,
  renderer,
  ui,
  player,
  playerState,
  shieldMesh,
  gameOptions,
  getAbilityTargets,
});

// --- Event Listeners ---
window.addEventListener('keydown', (e) => { 
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; 
  if (e.key === 'Escape') togglePause();
  if (e.key >= '1' && e.key <= '9') {
    abilities.handleHotkey(Number(e.key) - 1);
  }
  if (e.key === 'F2') {
    gameState.isDebugMode = !gameState.isDebugMode;
    ui.setDebugVisible(gameState.isDebugMode);
    playerRangeMesh.visible = gameState.isDebugMode;
    base.setDebugVisible(gameState.isDebugMode);
    enemyBase.setDebugVisible(gameState.isDebugMode);
  }
});
window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
});
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!abilities.isTargetingModule('yamato') || gameState.isPaused || playerState.isDead) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);

  if (!raycaster.ray.intersectPlane(groundPlane, pointerTargetPoint)) return;
  pointerTargetPoint.y = 0;
  abilities.fireYamatoStrike(pointerTargetPoint);
});
renderer.domElement.addEventListener('wheel', (event) => {
  event.preventDefault();
  const zoomDelta = event.deltaY > 0 ? CAMERA_ZOOM_STEP : -CAMERA_ZOOM_STEP;
  gameState.cameraZoom = THREE.MathUtils.clamp(gameState.cameraZoom + zoomDelta, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
}, { passive: false });

function onPlayerHit(damage) {
  if (playerState.isDead || playerState.abilities.shieldActive) return;
  playerState.health -= damage;
  gameState.cameraShakeTime = CAMERA_SHAKE_DURATION;
  gameState.cameraShakeStrength = 0.38;
  ui.flashDamage();
  setPlayerAppearance(playerBaseColor, 2);
  setTimeout(() => { setPlayerAppearance(playerBaseColor, playerBaseEmissiveIntensity); }, 100);
  if (playerState.health <= 0) triggerDeath();
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

  shatterEffects.spawn(bomb.position, {
    size: 1.9,
    color: 0xffffff,
    segmentCount: 3,
    duration: 1.05,
    spread: 5,
    lift: 0.72,
  });

  scene.remove(bomb);
  bomb.traverse((child) => {
    child.geometry?.dispose?.();
    disposeObjectMaterials(child.material);
  });
  bombs.splice(bombIndex, 1);
}

function triggerDeath() {
  playerState.isDead = true;
  playerState.health = 0;
  player.visible = false;
  abilities.onDeath();
  playerState.respawnTimer = 10;
  ui.setRespawnVisible(true);
  playerState.velocity.set(0, 0, 0);
}

function respawn() {
  playerState.isDead = false;
  playerState.health = playerState.maxHealth;
  player.visible = true;
  player.position.copy(basePosition);
  ui.setRespawnVisible(false);
  abilities.onRespawn();
}

function updateRockSpinners(deltaTime) {
  for (let i = 0; i < rockSpinners.length; i++) {
    const spinner = rockSpinners[i];
    spinner.model.rotateOnAxis(spinner.axis, spinner.speed * deltaTime);
  }
}

function updateShatterEffects(deltaTime) {
  shatterEffects.update(deltaTime);
}

function updateBombPulse(time) {
  const pulseColor = new THREE.Color(0xff2a2a);
  const pulseEmissive = new THREE.Color(0xff0000);

  for (let index = 0; index < bombs.length; index++) {
    const bomb = bombs[index];
    const intervalMs = bomb.userData.pulseIntervalMs || 3000;
    const phaseMs = bomb.userData.pulsePhaseMs || 0;
    const pulseProgress = ((time + phaseMs) % intervalMs) / intervalMs;
    // Keep the warning flash brief: fast rise, quick fall, then a long calm period.
    const pulseStrength = pulseProgress < 0.18
      ? Math.sin((pulseProgress / 0.18) * Math.PI)
      : 0;
    const fallbackScale = 1 + (pulseStrength * 0.06);
    bomb.userData.fallbackMesh?.scale.setScalar(fallbackScale);
    const materialStates = bomb.userData.materialStates || [];
    for (let materialIndex = 0; materialIndex < materialStates.length; materialIndex++) {
      const state = materialStates[materialIndex];
      const { material } = state;

      if (state.color && material.color) {
        material.color.copy(state.color).lerp(pulseColor, pulseStrength * 0.45);
      }

      if (state.emissive && material.emissive) {
        material.emissive.copy(state.emissive).lerp(pulseEmissive, pulseStrength * 0.7);
      }

      if (material.emissiveIntensity !== undefined) {
        material.emissiveIntensity = (state.emissiveIntensity ?? 0) + (pulseStrength * 0.9);
      }
    }
  }
}

function updateDebugOverlay(deltaTime) {
  if (!gameState.isDebugMode) return;

  playerRangeMesh.position.copy(player.position);
  playerRangeMesh.position.y = -0.4;
  const fps = Math.round(1 / (deltaTime || 0.01));
  ui.setDebugText(
`[DEBUG MODE]
FPS: ${fps}
POS: X:${player.position.x.toFixed(2)} Y:${player.position.y.toFixed(2)} Z:${player.position.z.toFixed(2)}
VEL: ${playerState.velocity.length().toFixed(4)}
HP: ${playerState.health.toFixed(1)} / ${playerState.maxHealth}
ENEMIES: ${enemies.length}
PROJECTILES: ${projectiles.length}
PROBES: ${probes.length}
WAVE: ${waveManager.waveLevel}`
  );
}

function updatePlayerMovement(deltaTime) {
  if (keys.a) player.rotation.y += playerState.rotationSpeed * deltaTime * 60;
  if (keys.d) player.rotation.y -= playerState.rotationSpeed * deltaTime * 60;

  const dir = playerMoveDirection.copy(FORWARD_VECTOR).applyQuaternion(player.quaternion);
  if (keys.w) playerState.velocity.addScaledVector(dir, playerState.acceleration * deltaTime * 60);
  if (keys.s) playerState.velocity.addScaledVector(dir, -playerState.acceleration * deltaTime * 60);

  const playerMovement = movePlayerWithObstaclePhysics(player.position, playerState.velocity, 1.1, obstacleColliders, {
    bounceDamping: 0.2,
    wallFriction: 0.84,
    pushbackDistance: 0.22,
    stepCount: 5,
  });

  player.position.copy(playerMovement.position);
  playerState.velocity.copy(playerMovement.velocity);
  playerState.velocity.multiplyScalar(Math.pow(0.991, deltaTime * 60)); // Resolution-independent drag
}

function updateBombCollisions() {
  for (let i = bombs.length - 1; i >= 0; i--) {
    const bomb = bombs[i];
    const dist = player.position.distanceTo(bomb.position);
    if (dist < 1.5 && !playerState.isDead) {
      destroyBomb(i);
      triggerDeath();
      break;
    }
  }
}

function updateShieldEffect(deltaTime, time) {
  abilities.updateShieldEffect(deltaTime, time);
}

function updateRespawnTimer(deltaTime) {
  playerState.respawnTimer -= deltaTime;
  ui.setRespawnText(`RESPAWNING IN ${Math.ceil(playerState.respawnTimer)}`);
  if (playerState.respawnTimer <= 0) respawn();
}

function createPlayerTarget() {
  return {
    get isDead() { return playerState.isDead; },
    get mesh() { return player; },
    takeDamage: (amt) => onPlayerHit(amt)
  };
}

function buildCombatState(deltaTime) {
  const playerTarget = createPlayerTarget();
  waveManager.update(player.position, enemyController, deltaTime);

  const allBases = [base, enemyBase];
  const playerOwnedBases = allBases.filter((station) => station.owner === 'player');
  const enemyOwnedBases = allBases.filter((station) => station.owner === 'enemy');
  const playerTargets = [...enemies, ...enemyOwnedBases];
  const enemyTargets = [playerTarget, ...probes, ...playerOwnedBases];
  playerTargetIndex.rebuild(playerTargets);
  enemyTargetIndex.rebuild(enemyTargets);

  return {
    allBases,
    playerOwnedBases,
    playerTargets,
    enemyTargets,
    playerTargetIndex,
    enemyTargetIndex,
  };
}

function updateCannons(time, playerTargets) {
  if (playerState.isDead) return;
  cannons.forEach((cannon) => cannon.update(time, playerTargets, projectiles));
}

function updateBases(time, allBases, playerOwnedBases, playerTargets, enemyTargets) {
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
      playerState.health,
      playerState.maxHealth,
      station.owner === 'player' ? playerTargets : enemyTargets,
      camera
    );

    if (station.owner === 'player' && nearThisBase) {
      isNearBase = true;
    }
  });

  return isNearBase;
}

function updateBaseUiAndHealing(isNearBase, deltaTime) {
  const canUseUpgradeMenus = !playerState.isDead && (isNearBase || gameState.isDebugMode);

  if (canUseUpgradeMenus) {
    ui.setUpgradeMenusVisible(true);
    if (isNearBase) {
      playerState.health = Math.min(playerState.maxHealth, playerState.health + (gameOptions.base.healingRate * deltaTime));
    }
    return;
  }

  ui.setUpgradeMenusVisible(false);
  const screenAngle = Math.atan2(basePosition.x - player.position.x, player.position.z - basePosition.z);
  ui.setCompassAngle(screenAngle);
}

function updateProbes(deltaTime, probeTargets) {
  for (let i = probes.length - 1; i >= 0; i--) {
    probes[i].update(probeTargets, projectiles, camera, deltaTime, []);
    if (probes[i].isDead) probes.splice(i, 1);
  }
}

function updateHud() {
  const healthPercent = (playerState.health / playerState.maxHealth) * 100;
  ui.setHealthPercent(healthPercent);
  const distPushed = Math.max(0, Math.floor(Math.abs(player.position.z - mapData.basePosition.z)));
  ui.setStatsText(`Dist: ${distPushed}m | Zone: ${waveManager.waveLevel}`);
}

function updateEnemies(deltaTime, enemyTargets) {
  enemyController.update(
    deltaTime,
    playerState.isDead ? activeFriendlyBase.mesh.position : player.position,
    enemyTargets,
    projectiles
  );
}

function updateYamatoEffects(deltaTime) {
  abilities.updateYamatoEffects(deltaTime);
}

function updateProjectiles(deltaTime, playerTargets, enemyTargets) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.isEnemy) {
      p.update(enemyTargets, null, deltaTime);
    } else {
      p.update(playerTargets, null, deltaTime);
    }
    if (p.isRemoved) projectiles.splice(i, 1);
  }
}

function updateCamera() {
  if (playerState.isDead) return;

  const zoomInAmount = CAMERA_MAX_ZOOM - gameState.cameraZoom;
  targetCameraPos.set(
    player.position.x,
    (CAMERA_BASE_HEIGHT * gameState.cameraZoom) + (zoomInAmount * CAMERA_ZOOMED_IN_HEIGHT_BONUS / (CAMERA_MAX_ZOOM - CAMERA_MIN_ZOOM)),
    player.position.z + (CAMERA_BASE_DISTANCE * gameState.cameraZoom)
  );

  if (gameState.cameraShakeTime > 0) {
    const shakeAmount = gameState.cameraShakeStrength * (gameState.cameraShakeTime / CAMERA_SHAKE_DURATION);
    targetCameraPos.x += (Math.random() - 0.5) * shakeAmount;
    targetCameraPos.y += (Math.random() - 0.5) * shakeAmount * 0.65;
    targetCameraPos.z += (Math.random() - 0.5) * shakeAmount;
  }

  camera.position.lerp(targetCameraPos, 0.05);
  camera.lookAt(player.position);
}

function animate(timestamp) {
  requestAnimationFrame(animate);

  if (gameState.isPaused) {
    composer.render();
    return;
  }

  timer.update(timestamp);
  const deltaTime = timer.getDelta();
  const elapsedTime = timer.getElapsed();
  const time = elapsedTime * 1000;
  if (gameState.cameraShakeTime > 0) {
    gameState.cameraShakeTime = Math.max(0, gameState.cameraShakeTime - deltaTime);
  }
  abilities.refreshButtons();
  space.update?.(deltaTime, elapsedTime);
  updateRockSpinners(deltaTime);
  updateShatterEffects(deltaTime);
  updateBombPulse(time);
  updateDebugOverlay(deltaTime);

  if (!playerState.isDead) {
    updatePlayerMovement(deltaTime);
    updateBombCollisions();
    updateShieldEffect(deltaTime, time);
  } else {
    updateRespawnTimer(deltaTime);
  }

  const { allBases, playerOwnedBases, playerTargets, enemyTargets, playerTargetIndex, enemyTargetIndex } = buildCombatState(deltaTime);
  updateCannons(time, playerTargetIndex);
  const isNearBase = updateBases(time, allBases, playerOwnedBases, playerTargetIndex, enemyTargetIndex);
  updateBaseUiAndHealing(isNearBase, deltaTime);
  updateProbes(deltaTime, playerTargetIndex);
  updateHud();
  updateEnemies(deltaTime, enemyTargets);
  updateYamatoEffects(deltaTime);
  updateProjectiles(deltaTime, playerTargetIndex, enemyTargetIndex);
  updateCamera();
  composer.render();
}
animate(0);
