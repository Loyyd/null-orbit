import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Projectile } from './projectile';
import { BaseStation } from './base';
import { WaveManager } from './waveManager';
import { Cannon } from './cannon';
import { loadMap } from './mapData';
import { createSpace } from './environment';

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

// --- UI Setup ---
const healthContainer = document.createElement('div');
healthContainer.id = 'health-container';
const healthBar = document.createElement('div');
healthBar.id = 'health-bar';
healthContainer.appendChild(healthBar);
document.body.appendChild(healthContainer);

const upgradeMenu = document.createElement('div');
upgradeMenu.id = 'upgrade-menu';
upgradeMenu.innerHTML = `
  <h2>Ship Menu</h2>
  <div id="stats">Dist: 0m</div>
  <div id="upgrade-buttons">
    <button id="up-cannons" class="upgrade-btn">Add Cannons (+2)</button>
    <button id="up-speed" class="upgrade-btn">Upgrade Speed</button>
    <button id="up-tier2" class="upgrade-btn">Evolution: Tier 2</button>
  </div>
  <div id="compass-container" style="display: none;">
    <div id="base-arrow"></div>
    <div id="compass-label">BASE SIGNAL</div>
  </div>
`;
document.body.appendChild(upgradeMenu);

const baseUpgradeMenu = document.createElement('div');
baseUpgradeMenu.id = 'base-upgrade-menu';
baseUpgradeMenu.innerHTML = `
  <h2>Base Upgrades</h2>
  <div id="base-upgrade-buttons">
    <button id="base-up-cannons" class="upgrade-btn">Add Base Cannons (+1)</button>
    <button id="base-up-spawn" class="upgrade-btn">Upgrade Spawn Rate</button>
    <button id="base-up-shield" class="upgrade-btn">Buy Shield Module 🛡️</button>
  </div>
`;
document.body.appendChild(baseUpgradeMenu);

const shieldBtn = document.createElement('button');
shieldBtn.id = 'shield-btn';
shieldBtn.innerHTML = '🛡️';
shieldBtn.style.display = 'none';
document.body.appendChild(shieldBtn);

const upBtns = document.getElementById('upgrade-buttons');
const compCont = document.getElementById('compass-container');
const baseArrow = document.getElementById('base-arrow');

const respawnUI = document.createElement('div');
respawnUI.id = 'respawn-ui';
respawnUI.style.cssText = `
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  color: #ff0055; font-size: 2rem; text-transform: uppercase; letter-spacing: 5px;
  display: none; text-align: center; font-weight: bold;
  text-shadow: 0 0 20px #ff0055;
`;
document.body.appendChild(respawnUI);

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

// --- Game State ---
const clock = new THREE.Clock();
let acceleration = 0.0008;
let rotationSpeed = 0.01;
let currentTier = 1;
let playerHealth = 100;
const maxPlayerHealth = 100;
let isDead = false;
let respawnTimer = 0;
let hasShieldModule = false;
let shieldActive = false;
let shieldDuration = 0;

// --- Objects ---
const playerGeometry = new THREE.BoxGeometry(1, 0.5, 2);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.5 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(mapData.playerStart.x, 0, mapData.playerStart.z);
scene.add(player);

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

const cannons = [];
function addCannons(count) {
  const pairs = Math.max(1, Math.floor(count / 2));
  for (let i = 0; i < pairs; i++) {
    const row = Math.floor(cannons.length / 2);
    const zPos = -0.5 + (row * 0.4);
    cannons.push(new Cannon(scene, player, new THREE.Vector3(-0.6, 0, zPos)));
    cannons.push(new Cannon(scene, player, new THREE.Vector3(0.6, 0, zPos)));
  }
}
addCannons(2);

const basePosition = new THREE.Vector3(mapData.basePosition.x, 0, mapData.basePosition.z);
const base = new BaseStation(scene, basePosition);
const waveManager = new WaveManager(scene);

// --- Obstacles ---
const obsMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.9, roughness: 0.1 }); // More asteroid-like
mapData.obstacles.forEach(o => {
  const w = o.w || 2;
  const h = o.h || 2;
  const obsGeo = new THREE.BoxGeometry(w, 2, h);
  const obstacle = new THREE.Mesh(obsGeo, obsMat);
  obstacle.position.set(o.x, 0, o.z);
  scene.add(obstacle);
});

// --- Tactical Grid (Holographic) ---
const gridHelper = new THREE.GridHelper(2000, 200, 0x00ffff, 0x004444);
gridHelper.position.y = -0.5;
gridHelper.material.transparent = true;
gridHelper.material.opacity = 0.2;
scene.add(gridHelper);

// --- Upgrade Listeners ---
document.getElementById('up-cannons').onclick = () => addCannons(2);
document.getElementById('up-speed').onclick = () => { acceleration += 0.0025; rotationSpeed += 0.0025; };
document.getElementById('up-tier2').onclick = () => {
  if (currentTier < 2) {
    currentTier = 2;
    player.scale.set(1.5, 1.5, 1.5);
    player.material.color.setHex(0x00ffff);
    player.material.emissive.setHex(0x00ffff);
    document.getElementById('up-tier2').innerText = "Evolution: Maxed";
  }
};

document.getElementById('base-up-cannons').onclick = () => base.addCannon();
document.getElementById('base-up-spawn').onclick = () => base.upgradeSpawnRate();
document.getElementById('base-up-shield').onclick = () => {
  hasShieldModule = true;
  shieldBtn.style.display = 'flex';
  document.getElementById('base-up-shield').style.display = 'none'; // Only buy once
};

shieldBtn.onclick = () => {
  if (hasShieldModule && !shieldActive && !isDead) {
    shieldActive = true;
    shieldDuration = 6; // 6 seconds
    shieldMesh.visible = true;
    shieldBtn.classList.add('active');
  }
};

// --- Loop Variables ---
const enemies = [];
const projectiles = [];
const friendlyUnits = [];
let velocity = new THREE.Vector3();
const keys = { w: false, a: false, s: false, d: false };
const targetCameraPos = new THREE.Vector3();

// --- Event Listeners ---
window.addEventListener('keydown', (e) => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
});

function onPlayerHit(damage) {
  if (isDead || shieldActive) return;
  playerHealth -= damage;
  player.material.emissiveIntensity = 2;
  setTimeout(() => { player.material.emissiveIntensity = 0.5; }, 100);
  if (playerHealth <= 0) triggerDeath();
}

function triggerDeath() {
  isDead = true;
  playerHealth = 0;
  player.visible = false;
  shieldActive = false;
  shieldMesh.visible = false;
  shieldBtn.classList.remove('active');
  respawnTimer = 10;
  respawnUI.style.display = 'block';
  velocity.set(0, 0, 0);
}

function respawn() {
  isDead = false;
  playerHealth = maxPlayerHealth;
  player.visible = true;
  player.position.copy(basePosition);
  respawnUI.style.display = 'none';
}

function animate(time) {
  requestAnimationFrame(animate);
  
  if (!isDead) {
    if (keys.a) player.rotation.y += rotationSpeed;
    if (keys.d) player.rotation.y -= rotationSpeed;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    if (keys.w) velocity.addScaledVector(dir, acceleration);
    if (keys.s) velocity.addScaledVector(dir, -acceleration);
    player.position.add(velocity);
    velocity.multiplyScalar(0.991); // Adjust this value for drag (lower = stops faster, closer to 1 = slides more)

    // Shield logic
    if (shieldActive) {
      shieldDuration -= 1/60;
      shieldMesh.material.opacity = 0.3 + Math.sin(time * 0.01) * 0.1;
      shieldMesh.rotation.y += 0.01;
      if (shieldDuration <= 0) {
        shieldActive = false;
        shieldMesh.visible = false;
        shieldBtn.classList.remove('active');
      }
    }
  } else {
    respawnTimer -= 1/60;
    respawnUI.innerText = `RESPAWNING IN ${Math.ceil(respawnTimer)}`;
    if (respawnTimer <= 0) respawn();
  }

  waveManager.update(player.position, enemies);
  if (!isDead) cannons.forEach(cannon => cannon.update(time, enemies, projectiles));

  const isNearBase = base.update(player.position, enemies, projectiles, time, friendlyUnits, playerHealth, maxPlayerHealth);
  
  if (isNearBase && !isDead) {
    upBtns.style.display = 'block';
    baseUpgradeMenu.style.display = 'flex';
    compCont.style.display = 'none';
    playerHealth = Math.min(maxPlayerHealth, playerHealth + 0.05); 
  } else {
    upBtns.style.display = 'none';
    baseUpgradeMenu.style.display = 'none';
    compCont.style.display = 'flex';
    const screenAngle = Math.atan2(basePosition.x - player.position.x, player.position.z - basePosition.z);
    baseArrow.style.transform = `rotate(${screenAngle}rad)`;
  }

  const playerTarget = {
    get isDead() { return isDead; },
    get mesh() { return player; },
    takeDamage: (amt) => onPlayerHit(amt)
  };

  for (let i = friendlyUnits.length - 1; i >= 0; i--) {
    friendlyUnits[i].update(enemies, projectiles, camera);
    if (friendlyUnits[i].isDead) friendlyUnits.splice(i, 1);
  }

  const healthPercent = (playerHealth / maxPlayerHealth) * 100;
  healthBar.style.width = `${healthPercent}%`;
  const distPushed = Math.max(0, Math.floor(Math.abs(player.position.z - mapData.basePosition.z)));
  document.getElementById('stats').innerText = `Dist: ${distPushed}m | Zone: ${waveManager.waveLevel}`;

  for (let i = enemies.length - 1; i >= 0; i--) { 
    enemies[i].update(playerTarget, projectiles, camera, friendlyUnits); 
    if (enemies[i].isDead) enemies.splice(i, 1); 
  }

  for (let i = projectiles.length - 1; i >= 0; i--) { 
    const p = projectiles[i];
    if (p.isEnemy) {
      p.update([playerTarget, ...friendlyUnits]);
    } else {
      p.update(enemies); 
    }
    if (p.isRemoved) projectiles.splice(i, 1); 
  }

  if (!isDead) {
    targetCameraPos.set(player.position.x, 35, player.position.z + 25);
    camera.position.lerp(targetCameraPos, 0.05);
    camera.lookAt(player.position);
  }
  composer.render();
}
animate(0);
