import * as THREE from 'three';
import shieldButtonIcon from './assets/buttons/button_shield.png';
import yamatoButtonIcon from './assets/buttons/button_yamato.png';

export function createPlayerAbilities({
  scene,
  renderer,
  ui,
  playerState,
  shieldMesh,
  gameOptions,
  getAbilityTargets,
}) {
  const purchasedModules = [];
  const yamatoEffects = [];

  function updateModuleBarVisibility() {
    ui.moduleBar.style.display = purchasedModules.length > 0 && !playerState.isDead ? 'flex' : 'none';
  }

  function getPurchasedModule(id) {
    return purchasedModules.find((module) => module.id === id) || null;
  }

  function getModuleCooldownRemaining(module, now = performance.now()) {
    return Math.max(0, module.cooldownMs - (now - module.lastUsedAt));
  }

  function refreshButtons() {
    const now = performance.now();

    purchasedModules.forEach((module, index) => {
      const cooldownRemaining = getModuleCooldownRemaining(module, now);
      const coolingDown = cooldownRemaining > 0;
      const cooldownProgress = module.cooldownMs > 0
        ? 1 - (cooldownRemaining / module.cooldownMs)
        : 1;
      module.slot.textContent = `${index + 1}`;
      module.button.style.setProperty('--cooldown-progress', `${THREE.MathUtils.clamp(cooldownProgress, 0, 1)}`);
      module.button.classList.toggle(
        'active',
        module.id === 'shield' ? playerState.abilities.shieldActive : playerState.abilities.selectedModuleId === module.id
      );
      module.button.classList.toggle('targeting', playerState.abilities.selectedModuleId === module.id);
      module.button.classList.toggle('cooldown', coolingDown);
      module.button.disabled = coolingDown;
      module.button.title = coolingDown
        ? `${Math.ceil(cooldownRemaining / 1000)}s cooldown`
        : module.label;
    });
  }

  function clearSelection() {
    playerState.abilities.selectedModuleId = null;
    renderer.domElement.style.cursor = '';
    refreshButtons();
  }

  function activateShieldModule() {
    if (!playerState.abilities.shieldOwned || playerState.abilities.shieldActive || playerState.isDead) return;
    const shieldModule = getPurchasedModule('shield');
    if (!shieldModule || getModuleCooldownRemaining(shieldModule) > 0) return;

    shieldModule.lastUsedAt = performance.now();
    playerState.abilities.shieldActive = true;
    playerState.abilities.shieldDuration = gameOptions.modules.shieldDuration;
    shieldMesh.visible = true;
    refreshButtons();
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
    });
  }

  function fireYamatoStrike(position) {
    if (!playerState.abilities.yamatoOwned || playerState.isDead) return;
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

    clearSelection();
  }

  function activateYamatoModule() {
    if (!playerState.abilities.yamatoOwned || playerState.isDead) return;
    const yamatoModule = getPurchasedModule('yamato');
    if (!yamatoModule || getModuleCooldownRemaining(yamatoModule) > 0) return;

    playerState.abilities.selectedModuleId = playerState.abilities.selectedModuleId === 'yamato' ? null : 'yamato';
    renderer.domElement.style.cursor = playerState.abilities.selectedModuleId === 'yamato' ? 'crosshair' : '';
    refreshButtons();
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
      <span class="module-cooldown-ring" aria-hidden="true"></span>
      <span class="module-icon"><img src="${icon}" alt="${label}"></span>
      <span class="module-label">${label}</span>
    `;

    const slot = button.querySelector('.module-slot');
    button.addEventListener('click', activate);
    ui.moduleBar.appendChild(button);
    purchasedModules.push({ id, button, slot, label, activate, cooldownMs, lastUsedAt: -Infinity });
    updateModuleBarVisibility();
    refreshButtons();
  }

  function buyShieldModule() {
    if (playerState.abilities.shieldOwned) return;
    playerState.abilities.shieldOwned = true;
    addPurchasedModule('shield', shieldButtonIcon, 'Shield', activateShieldModule, gameOptions.modules.shieldCooldownMs);
    ui.hideShieldUpgrade();
  }

  function buyYamatoModule() {
    if (playerState.abilities.yamatoOwned) return;
    playerState.abilities.yamatoOwned = true;
    addPurchasedModule('yamato', yamatoButtonIcon, 'Yamato', activateYamatoModule, gameOptions.modules.yamatoCooldownMs);
    ui.hideYamatoUpgrade();
  }

  function handleHotkey(index) {
    const module = purchasedModules[index];
    if (module) {
      module.activate();
    }
  }

  function isTargetingModule(id) {
    return playerState.abilities.selectedModuleId === id;
  }

  function updateShieldEffect(deltaTime, time) {
    if (!playerState.abilities.shieldActive) return;

    playerState.abilities.shieldDuration -= deltaTime;
    shieldMesh.material.opacity = 0.3 + Math.sin(time * 0.01) * 0.1;
    shieldMesh.rotation.y += 0.01;

    if (playerState.abilities.shieldDuration <= 0) {
      playerState.abilities.shieldActive = false;
      shieldMesh.visible = false;
      refreshButtons();
    }
  }

  function updateYamatoEffects(deltaTime) {
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
  }

  function onDeath() {
    playerState.abilities.shieldActive = false;
    shieldMesh.visible = false;
    clearSelection();
    updateModuleBarVisibility();
  }

  function onRespawn() {
    updateModuleBarVisibility();
    refreshButtons();
  }

  return {
    buyShieldModule,
    buyYamatoModule,
    fireYamatoStrike,
    handleHotkey,
    isTargetingModule,
    onDeath,
    onRespawn,
    refreshButtons,
    updateShieldEffect,
    updateYamatoEffects,
  };
}
