import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Projectile } from './projectile';
import { Probe } from './units/Probe';

const TEAM_CONFIG = {
  player: {
    bodyColor: 0x4444bb,
    emissive: 0x111144,
    fireRangeColor: 0x00ffff,
    interactionColor: 0x00ff55,
    healingColor: 0x00ff88,
    healthColor: 0x00ffaa,
    projectileColor: 0x00ffff,
  },
  enemy: {
    bodyColor: 0x992222,
    emissive: 0x330808,
    fireRangeColor: 0xff4444,
    interactionColor: 0xff8800,
    healingColor: 0xff5533,
    healthColor: 0xff5555,
    projectileColor: 0xff3355,
  },
};

const gltfLoader = new GLTFLoader();

function forEachObjectMaterial(root, callback) {
  root.traverse((child) => {
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (material) callback(material);
    });
  });
}

export class BaseStation {
  constructor(scene, position, owner = 'player', gameOptions = {}) {
    this.scene = scene;
    this.position = position.clone();
    this.owner = owner;
    this.baseConfig = gameOptions.base || {};
    this.probeConfig = gameOptions.probe || {};
    this.fireRange = this.baseConfig.fireRange ?? 40;
    this.interactionRange = this.baseConfig.interactionRange ?? 18;
    this.fireRate = this.baseConfig.fireRate ?? 1200;
    this.lastShotTime = 0;
    this.spawnInterval = this.baseConfig.spawnInterval ?? 20000;
    this.lastSpawnTime = 0;
    this.maxHealth = this.baseConfig.maxHealth ?? 80;
    this.health = this.maxHealth;
    this.hitRadius = 6.5;
    this.captureCooldownUntil = 0;
    this.isDead = false;
    this.baseEmissiveIntensity = 1;
    this.debugVisible = false;
    this.baseModel = null;

    this.material = new THREE.MeshStandardMaterial();
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    scene.add(this.mesh);

    this.visualRoot = new THREE.Group();
    this.mesh.add(this.visualRoot);

    this.fallbackBody = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 3, 32), this.material);
    this.mesh.add(this.fallbackBody);
    this.fallbackTower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 16), this.material);
    this.fallbackTower.position.y = 4;
    this.mesh.add(this.fallbackTower);

    this.loadBaseModel();

    const createRadiusCircle = (radius, opacity) => {
      const segments = 128;
      const geometry = new THREE.RingGeometry(radius - 0.2, radius + 0.2, segments);
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = -0.4;
      return mesh;
    };

    this.fireRangeMesh = createRadiusCircle(this.fireRange, 0.1);
    scene.add(this.fireRangeMesh);
    this.fireRangeMesh.position.copy(position);
    this.fireRangeMesh.position.y = -0.4;
    this.fireRangeMesh.visible = false;

    this.interactionRangeMesh = createRadiusCircle(this.interactionRange, 0.15);
    scene.add(this.interactionRangeMesh);
    this.interactionRangeMesh.position.copy(position);
    this.interactionRangeMesh.position.y = -0.35;
    this.interactionRangeMesh.visible = false;

    this.healthBarGroup = new THREE.Group();
    const hpBgGeo = new THREE.PlaneGeometry(8, 0.5);
    const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 });
    this.hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
    const hpFgGeo = new THREE.PlaneGeometry(8, 0.5);
    this.hpFgMat = new THREE.MeshBasicMaterial();
    this.hpFg = new THREE.Mesh(hpFgGeo, this.hpFgMat);
    this.hpFg.position.z = 0.02;
    this.healthBarGroup.add(this.hpBg);
    this.healthBarGroup.add(this.hpFg);
    this.healthBarOffset = new THREE.Vector3(0, 9.5, 0);
    this.scene.add(this.healthBarGroup);

    this.cannons = [];
    this.cannonGeo = new THREE.BoxGeometry(0.4, 0.4, 1.5);
    this.cannonMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
    for (let i = 0; i < 2; i++) {
      this.addCannonMesh(i, 2);
    }

    const beamGeo = new THREE.CylinderGeometry(0.2, 0.2, 1, 8);
    this.beamMat = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0.6,
      emissiveIntensity: 1,
    });
    this.healingBeam = new THREE.Mesh(beamGeo, this.beamMat);
    this.healingBeam.visible = false;
    this.scene.add(this.healingBeam);

    this.applyOwnerVisuals();
    this.updateHealthBar();
  }

  setDebugVisible(visible) {
    this.debugVisible = visible;
    this.fireRangeMesh.visible = visible;
    this.interactionRangeMesh.visible = visible;
  }

  applyOwnerVisuals() {
    const config = TEAM_CONFIG[this.owner];
    this.material.color.setHex(config.bodyColor);
    this.material.emissive.setHex(config.emissive);
    this.material.emissiveIntensity = this.baseEmissiveIntensity;
    if (this.baseModel) {
      forEachObjectMaterial(this.baseModel, (material) => {
        if (material.emissiveIntensity !== undefined) {
          material.emissiveIntensity = this.baseEmissiveIntensity * 0.35;
        }
      });
    }
    this.fireRangeMesh.material.color.setHex(config.fireRangeColor);
    this.interactionRangeMesh.material.color.setHex(config.interactionColor);
    this.beamMat.color.setHex(config.healingColor);
    this.beamMat.emissive.setHex(config.healingColor);
    this.hpFg.material.color.setHex(config.healthColor);
  }

  loadBaseModel() {
    gltfLoader.load(
      '/models/base.glb',
      (gltf) => {
        this.baseModel = gltf.scene;
        this.fitBaseModel(this.baseModel);
        this.visualRoot.add(this.baseModel);
        this.fallbackBody.visible = false;
        this.fallbackTower.visible = false;
        this.applyOwnerVisuals();
      },
      undefined,
      (error) => {
        console.error('Failed to load base model:', error);
      }
    );
  }

  fitBaseModel(model) {
    model.rotation.y = -Math.PI / 2;

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    if (size.lengthSq() === 0) return;

    const targetWidth = 12;
    const targetHeight = 10;
    const targetLength = 12;
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
    model.position.y -= 1.2;
  }

  updateHealthBar() {
    const healthPercent = Math.max(0, this.health / this.maxHealth);
    this.hpFg.scale.x = healthPercent;
    this.hpFg.position.x = -(1 - healthPercent) * 4;
  }

  addCannonMesh(index, total) {
    const angle = (index / total) * Math.PI * 2;
    const radius = 6;

    const pivot = new THREE.Group();
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    pivot.position.set(x, 0, z);

    const cannon = new THREE.Mesh(this.cannonGeo, this.cannonMat);
    cannon.position.set(0, 0, 0.7);
    pivot.add(cannon);

    pivot.lookAt(new THREE.Vector3(x * 2, 0, z * 2).add(this.position));
    pivot.userData.lastShotTime = 0;

    this.mesh.add(pivot);
    this.cannons.push(pivot);
  }

  addCannon() {
    const currentCount = this.cannons.length;
    this.cannons.forEach((cannon) => this.mesh.remove(cannon));
    this.cannons = [];
    const newTotal = currentCount + 1;
    for (let i = 0; i < newTotal; i++) {
      this.addCannonMesh(i, newTotal);
    }
  }

  upgradeSpawnRate() {
    this.spawnInterval = Math.max(4000, this.spawnInterval - 1000);
  }

  takeDamage(amount, currentTime = performance.now()) {
    if (currentTime < this.captureCooldownUntil) return;

    this.health -= amount;
    this.updateHealthBar();
    this.material.emissiveIntensity = 0.7;
    if (this.baseModel) {
      forEachObjectMaterial(this.baseModel, (material) => {
        if (material.emissiveIntensity !== undefined) {
          material.emissiveIntensity = 1.5;
        }
      });
    }
    setTimeout(() => {
      this.material.emissiveIntensity = this.baseEmissiveIntensity;
      if (this.baseModel) {
        this.applyOwnerVisuals();
      }
    }, 80);

    if (this.health <= 0) {
      if (this.owner === 'enemy') {
        this.convertToPlayer(currentTime);
      } else {
        this.health = this.maxHealth;
        this.updateHealthBar();
      }
    }
  }

  convertToPlayer(currentTime) {
    this.owner = 'player';
    this.health = this.maxHealth;
    this.captureCooldownUntil = currentTime + 1200;
    this.lastSpawnTime = currentTime;
    this.cannons.forEach((cannon) => {
      cannon.userData.lastShotTime = currentTime;
    });
    this.applyOwnerVisuals();
    this.updateHealthBar();
  }

  update(playerPos, enemies, projectiles, currentTime, probes, playerHealth, maxPlayerHealth, targets = [], camera = null) {
    this.mesh.rotation.y += 0.001;

    if (camera) {
      this.healthBarGroup.position.copy(this.mesh.position).add(this.healthBarOffset);
      this.healthBarGroup.quaternion.copy(camera.quaternion);
    }

    const isPlayerOwned = this.owner === 'player';
    const distToPlayer = this.mesh.position.distanceTo(playerPos);
    const inInteractionRange = isPlayerOwned && distToPlayer < this.interactionRange;
    const isHealing = inInteractionRange && playerHealth < maxPlayerHealth;

    if (inInteractionRange) {
      this.interactionRangeMesh.material.opacity = 0.3 + Math.sin(currentTime * 0.005) * 0.2;
    } else {
      this.interactionRangeMesh.material.opacity = isPlayerOwned ? 0.15 : 0.05;
    }

    if (isHealing) {
      this.healingBeam.visible = true;
      const startPos = this.position.clone();
      startPos.y += 6;
      const endPos = playerPos.clone();
      const beamVec = new THREE.Vector3().subVectors(endPos, startPos);
      const beamLen = beamVec.length();
      this.healingBeam.scale.y = beamLen;
      const center = startPos.clone().add(beamVec.clone().multiplyScalar(0.5));
      this.healingBeam.position.copy(center);
      this.healingBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamVec.clone().normalize());
      this.healingBeam.material.emissiveIntensity = 0.2 + Math.sin(currentTime * 0.005) * 0.1;
      this.healingBeam.material.opacity = 0.2 + Math.sin(currentTime * 0.005) * 0.05;
    } else {
      this.healingBeam.visible = false;
    }

    if (this.cannons.length > 0) {
      const validTargets = targets.filter((target) => !target.isDead);
      const config = TEAM_CONFIG[this.owner];

      this.cannons.forEach((cannon) => {
        if (currentTime - (cannon.userData.lastShotTime || 0) < this.fireRate) return;

        const worldPos = new THREE.Vector3();
        cannon.getWorldPosition(worldPos);
        let nearestTarget = null;
        let nearestDistance = this.fireRange;

        for (const target of validTargets) {
          const distToTarget = worldPos.distanceTo(target.mesh.position);
          if (distToTarget < nearestDistance) {
            nearestDistance = distToTarget;
            nearestTarget = target;
          }
        }

        if (!nearestTarget) return;

        const dir = new THREE.Vector3().subVectors(nearestTarget.mesh.position, worldPos).normalize();
        cannon.lookAt(nearestTarget.mesh.position);
        projectiles.push(new Projectile(this.scene, worldPos, dir, config.projectileColor, !isPlayerOwned, 2, this.fireRange * 2));
        cannon.userData.lastShotTime = currentTime;
      });
    }

    if (isPlayerOwned && currentTime - this.lastSpawnTime > this.spawnInterval) {
      probes.push(new Probe(this.scene, this.position.clone().add(new THREE.Vector3(-2, 0, -8)), this.probeConfig));
      probes.push(new Probe(this.scene, this.position.clone().add(new THREE.Vector3(2, 0, -8)), this.probeConfig));
      this.lastSpawnTime = currentTime;
    }

    return inInteractionRange;
  }
}
