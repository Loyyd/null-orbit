import './style.css';
import * as THREE from 'three';
import { Enemy } from './enemy';
import { Projectile } from './projectile';

// --- Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// --- Objects ---
const playerGeometry = new THREE.BoxGeometry(1, 0.5, 2);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
scene.add(player);

// Cannons
const cannonGeometry = new THREE.SphereGeometry(0.2, 16, 16);
const cannonMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });

const leftCannon = new THREE.Mesh(cannonGeometry, cannonMaterial);
leftCannon.position.set(-0.6, 0, -0.5); 
player.add(leftCannon);

const rightCannon = new THREE.Mesh(cannonGeometry, cannonMaterial);
rightCannon.position.set(0.6, 0, -0.5);
player.add(rightCannon);

const cannons = [leftCannon, rightCannon];

// Floor placeholder
const floorGeometry = new THREE.PlaneGeometry(100, 100);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.5;
scene.add(floor);

// Grid helper
const gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x222222);
gridHelper.position.y = -0.49;
scene.add(gridHelper);

// --- Game Logic ---
const enemies = [];
const projectiles = [];
const shootingRange = 20;
const shootingInterval = 400; 
let lastShotTime = 0;
let spawnTimer = 0;

function spawnEnemy() {
  const spawnX = (Math.random() - 0.5) * 60;
  const spawnZ = player.position.z - 50; 
  enemies.push(new Enemy(scene, new THREE.Vector3(spawnX, 0, spawnZ)));
}

function autoShoot(currentTime) {
  if (currentTime - lastShotTime < shootingInterval) return;

  let nearestEnemy = null;
  let minDistance = shootingRange;

  for (const enemy of enemies) {
    if (enemy.isDead) continue;
    const distance = player.position.distanceTo(enemy.mesh.position);
    if (distance < minDistance) {
      minDistance = distance;
      nearestEnemy = enemy;
    }
  }

  if (nearestEnemy) {
    cannons.forEach((cannon) => {
      const worldPosition = new THREE.Vector3();
      cannon.getWorldPosition(worldPosition);
      
      const direction = new THREE.Vector3();
      direction.subVectors(nearestEnemy.mesh.position, worldPosition).normalize();
      
      projectiles.push(new Projectile(scene, worldPosition, direction));
    });
    lastShotTime = currentTime;
  }
}

// --- Camera Position ---
camera.position.set(0, 15, 10);
camera.lookAt(0, 0, 0);

// --- Input Handling ---
const keys = {
  w: false,
  a: false,
  s: false,
  d: false
};

window.addEventListener('keydown', (e) => {
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (e) => {
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
});

// --- Window Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Physics Constants ---
const acceleration = 0.0005;
const rotationSpeed = 0.01;
const drag = 0.98; 
let velocity = new THREE.Vector3();

// --- Game Loop ---
function animate(time) {
  requestAnimationFrame(animate);

  // Rotation
  if (keys.a) player.rotation.y += rotationSpeed;
  if (keys.d) player.rotation.y -= rotationSpeed;

  // Thrust
  const direction = new THREE.Vector3(0, 0, -1);
  direction.applyQuaternion(player.quaternion);

  if (keys.w) velocity.addScaledVector(direction, acceleration);
  if (keys.s) velocity.addScaledVector(direction, -acceleration);

  player.position.add(velocity);
  velocity.multiplyScalar(drag);

  // Spawning
  spawnTimer += 1;
  if (spawnTimer > 60) {
    spawnEnemy();
    spawnTimer = 0;
  }

  // Auto shooting
  autoShoot(time);

  // Updates
  for (let i = enemies.length - 1; i >= 0; i--) {
    enemies[i].update();
    if (enemies[i].isDead) enemies.splice(i, 1);
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    projectiles[i].update(enemies);
    if (projectiles[i].isRemoved) projectiles.splice(i, 1);
  }

  // Camera
  camera.position.x = player.position.x;
  camera.position.z = player.position.z + 10;
  camera.position.y = 15;
  camera.lookAt(player.position);

  renderer.render(scene, camera);
}

animate(0);
