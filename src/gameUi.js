import plasmaCellIcon from './assets/plasma_cell.png';
import cannonButtonIcon from './assets/buttons/button_cannon.png';
import shieldButtonIcon from './assets/buttons/button_shield.png';
import speedButtonIcon from './assets/buttons/button_speed.png';
import tierButtonIcon from './assets/buttons/button_tier.png';
import yamatoButtonIcon from './assets/buttons/button_yamato.png';

export function createGameUi({
  onResume,
  onRestart,
  onBloomInput,
  onAmbientInput,
  onDebugSkipWave,
  onDebugSpawnColossus,
  onUpgradeCannons,
  onUpgradeSpeed,
  onUpgradeTier2,
  onBuyShield,
  onBuyYamato,
  onBaseUpgradeCannons,
  onBaseUpgradeSpawn,
}) {
  const upgradeButtonConfigs = {
    'up-cannons': {
      title: 'Rapid Fire',
      description: 'Makes the ship cannon pair shoot faster.',
      cost: 10,
      icon: cannonButtonIcon,
    },
    'up-speed': {
      title: 'Thruster Boost',
      description: 'Improves acceleration and turning speed.',
      cost: 10,
      icon: speedButtonIcon,
    },
    'up-tier2': {
      title: 'Evolution: Tier 2',
      description: 'Evolves the ship into its stronger second form.',
      cost: 10,
      icon: tierButtonIcon,
    },
    'base-up-cannons': {
      title: 'Base Cannons',
      description: 'Adds one more cannon to the active friendly base.',
      cost: 10,
      icon: cannonButtonIcon,
    },
    'base-up-spawn': {
      title: 'Spawn Rate',
      description: 'Makes the active friendly base deploy probes faster.',
      cost: 10,
      icon: speedButtonIcon,
    },
    'base-up-shield': {
      title: 'Shield Module',
      description: 'Unlocks the shield ability for your ship.',
      cost: 10,
      icon: shieldButtonIcon,
    },
    'base-up-yamato': {
      title: 'Yamato Cannon',
      description: 'Unlocks the Yamato strike ability.',
      cost: 10,
      icon: yamatoButtonIcon,
    },
  };

  function createUpgradeButton(id) {
    const config = upgradeButtonConfigs[id];
    const wrapper = document.createElement('div');
    wrapper.className = 'upgrade-control';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'upgrade-icon-btn';
    button.dataset.upgradeId = id;
    button.dataset.title = config.title;
    button.dataset.description = config.description;
    button.dataset.cost = `${config.cost}`;
    button.setAttribute('aria-label', config.title);
    button.innerHTML = `<img src="${config.icon}" alt="${config.title}">`;

    const progress = document.createElement('div');
    progress.className = 'upgrade-progress';
    progress.dataset.upgradeId = id;

    wrapper.appendChild(button);
    wrapper.appendChild(progress);
    return { wrapper, button, progress };
  }

  const healthContainer = document.createElement('div');
  healthContainer.id = 'health-container';
  const healthBar = document.createElement('div');
  healthBar.id = 'health-bar';
  healthContainer.appendChild(healthBar);
  document.body.appendChild(healthContainer);

  const currencyBar = document.createElement('div');
  currencyBar.id = 'currency-bar';
  currencyBar.innerHTML = `
    <img id="currency-icon" alt="Plasma cell" src="${plasmaCellIcon}">
    <div id="currency-copy">
      <div id="currency-label">Plasma Cells</div>
      <div id="currency-value">0</div>
    </div>
  `;
  document.body.appendChild(currencyBar);

  const upgradeMenu = document.createElement('div');
  upgradeMenu.id = 'upgrade-menu';
  upgradeMenu.innerHTML = `
    <h2>Ship Menu</h2>
    <div id="stats">Dist: 0m</div>
    <div id="upgrade-buttons" class="upgrade-button-grid">
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
    <div id="base-upgrade-buttons" class="upgrade-button-grid">
    </div>
    <h2>Module Upgrades</h2>
    <div id="module-upgrade-buttons" class="upgrade-button-grid">
    </div>
  `;
  document.body.appendChild(baseUpgradeMenu);

  const moduleBar = document.createElement('div');
  moduleBar.id = 'module-bar';
  moduleBar.style.display = 'none';
  document.body.appendChild(moduleBar);

  const respawnUI = document.createElement('div');
  respawnUI.id = 'respawn-ui';
  respawnUI.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    color: #ff0055; font-size: 2rem; text-transform: uppercase; letter-spacing: 5px;
    display: none; text-align: center; font-weight: bold;
    text-shadow: 0 0 20px #ff0055;
  `;
  document.body.appendChild(respawnUI);

  const escMenu = document.createElement('div');
  escMenu.id = 'esc-menu';
  escMenu.innerHTML = `
    <h1>Paused</h1>
    <div id="main-menu-content">
      <button id="resume-btn" class="menu-btn">Resume</button>
      <button id="restart-btn" class="menu-btn">Restart</button>
      <button id="options-btn" class="menu-btn">Options</button>
    </div>
    <div id="options-menu">
      <h2>Basic Options</h2>
      <div class="option-row">
        <span>Bloom Intensity</span>
        <input type="range" id="bloom-range" min="0" max="3" step="0.1" value="1.5">
      </div>
      <div class="option-row">
        <span>Ambient Light</span>
        <input type="range" id="ambient-range" min="0" max="1" step="0.05" value="0.2">
      </div>
      <button id="back-btn" class="menu-btn">Back</button>
    </div>
  `;
  document.body.appendChild(escMenu);

  const debugInfo = document.createElement('div');
  debugInfo.id = 'debug-info';
  debugInfo.innerHTML = `
    <div id="debug-header">
      <div id="debug-title">DEBUG MODE</div>
      <div id="debug-actions">
        <button type="button" id="debug-spawn-colossus-btn" aria-label="Spawn a colossus">C</button>
        <button type="button" id="debug-skip-wave-btn" aria-label="Skip to next wave">+</button>
      </div>
    </div>
    <div id="debug-body"></div>
  `;
  document.body.appendChild(debugInfo);

  const debugQuicklinks = document.createElement('div');
  debugQuicklinks.id = 'debug-quicklinks';
  debugQuicklinks.innerHTML = `
    <button type="button" class="debug-link-btn" id="debug-editor-link">Open Editor</button>
    <button type="button" class="debug-link-btn" id="debug-options-link">Open Options</button>
  `;
  document.body.appendChild(debugQuicklinks);

  const damageOverlay = document.createElement('div');
  damageOverlay.id = 'damage-overlay';
  document.body.appendChild(damageOverlay);

  const upgradeTooltip = document.createElement('div');
  upgradeTooltip.id = 'upgrade-tooltip';
  upgradeTooltip.innerHTML = `
    <div id="upgrade-tooltip-title"></div>
    <div id="upgrade-tooltip-description"></div>
    <div id="upgrade-tooltip-cost">
      <img id="upgrade-tooltip-cost-icon" alt="Plasma cell" src="${plasmaCellIcon}">
      <span id="upgrade-tooltip-cost-value"></span>
    </div>
  `;
  document.body.appendChild(upgradeTooltip);

  const shipUpgradeButtons = ['up-cannons', 'up-speed', 'up-tier2'].map(createUpgradeButton);
  const baseUpgradeButtons = ['base-up-cannons', 'base-up-spawn'].map(createUpgradeButton);
  const moduleUpgradeButtons = ['base-up-shield', 'base-up-yamato'].map(createUpgradeButton);
  shipUpgradeButtons.forEach(({ wrapper }) => upgradeMenu.querySelector('#upgrade-buttons').appendChild(wrapper));
  baseUpgradeButtons.forEach(({ wrapper }) => baseUpgradeMenu.querySelector('#base-upgrade-buttons').appendChild(wrapper));
  moduleUpgradeButtons.forEach(({ wrapper }) => baseUpgradeMenu.querySelector('#module-upgrade-buttons').appendChild(wrapper));

  const upgradeButtonsById = Object.fromEntries(
    [...shipUpgradeButtons, ...baseUpgradeButtons, ...moduleUpgradeButtons].map(({ button, progress }) => [
      button.dataset.upgradeId,
      { button, progress },
    ])
  );

  const elements = {
    upgradeMenu,
    baseUpgradeMenu,
    stats: upgradeMenu.querySelector('#stats'),
    upgradeButtons: upgradeMenu.querySelector('#upgrade-buttons'),
    compassContainer: upgradeMenu.querySelector('#compass-container'),
    baseArrow: upgradeMenu.querySelector('#base-arrow'),
    mainMenuContent: escMenu.querySelector('#main-menu-content'),
    optionsMenu: escMenu.querySelector('#options-menu'),
    debugEditorLink: debugQuicklinks.querySelector('#debug-editor-link'),
    debugOptionsLink: debugQuicklinks.querySelector('#debug-options-link'),
    currencyValue: currencyBar.querySelector('#currency-value'),
    tooltipTitle: upgradeTooltip.querySelector('#upgrade-tooltip-title'),
    tooltipDescription: upgradeTooltip.querySelector('#upgrade-tooltip-description'),
    tooltipCostValue: upgradeTooltip.querySelector('#upgrade-tooltip-cost-value'),
    debugSpawnColossusButton: debugInfo.querySelector('#debug-spawn-colossus-btn'),
    debugSkipWaveButton: debugInfo.querySelector('#debug-skip-wave-btn'),
    debugBody: debugInfo.querySelector('#debug-body'),
  };

  function positionTooltip(target) {
    const anchor = target.closest('#base-upgrade-menu') || target.closest('#upgrade-menu') || target;
    const rect = anchor.getBoundingClientRect();
    upgradeTooltip.style.left = `${rect.left + (rect.width / 2)}px`;
    upgradeTooltip.style.top = `${rect.top - 14}px`;
  }

  function showUpgradeTooltip(target) {
    elements.tooltipTitle.innerText = target.dataset.title;
    elements.tooltipDescription.innerText = target.dataset.description;
    elements.tooltipCostValue.innerText = `${target.dataset.cost}`;
    positionTooltip(target);
    upgradeTooltip.classList.add('visible');
  }

  function hideUpgradeTooltip() {
    upgradeTooltip.classList.remove('visible');
  }

  Object.values(upgradeButtonsById).forEach(({ button }) => {
    button.addEventListener('mouseenter', () => showUpgradeTooltip(button));
    button.addEventListener('mouseleave', hideUpgradeTooltip);
    button.addEventListener('focus', () => showUpgradeTooltip(button));
    button.addEventListener('blur', hideUpgradeTooltip);
  });

  function showPauseMainMenu() {
    elements.optionsMenu.style.display = 'none';
    elements.mainMenuContent.style.display = 'flex';
  }

  escMenu.querySelector('#resume-btn').onclick = onResume;
  escMenu.querySelector('#restart-btn').onclick = onRestart;
  escMenu.querySelector('#options-btn').onclick = () => {
    elements.mainMenuContent.style.display = 'none';
    elements.optionsMenu.style.display = 'flex';
  };
  escMenu.querySelector('#back-btn').onclick = showPauseMainMenu;
  escMenu.querySelector('#bloom-range').oninput = (event) => onBloomInput(parseFloat(event.target.value));
  escMenu.querySelector('#ambient-range').oninput = (event) => onAmbientInput(parseFloat(event.target.value));

  upgradeButtonsById['up-cannons'].button.onclick = onUpgradeCannons;
  upgradeButtonsById['up-speed'].button.onclick = onUpgradeSpeed;
  upgradeButtonsById['up-tier2'].button.onclick = onUpgradeTier2;
  upgradeButtonsById['base-up-shield'].button.onclick = onBuyShield;
  upgradeButtonsById['base-up-yamato'].button.onclick = onBuyYamato;
  upgradeButtonsById['base-up-cannons'].button.onclick = onBaseUpgradeCannons;
  upgradeButtonsById['base-up-spawn'].button.onclick = onBaseUpgradeSpawn;
  elements.debugEditorLink.onclick = () => window.open('/editor.html', '_blank', 'noopener,noreferrer');
  elements.debugOptionsLink.onclick = () => window.open('/options.html', '_blank', 'noopener,noreferrer');
  elements.debugSpawnColossusButton.onclick = onDebugSpawnColossus;
  elements.debugSkipWaveButton.onclick = onDebugSkipWave;

  return {
    moduleBar,
    setPaused(isPaused) {
      escMenu.style.display = isPaused ? 'flex' : 'none';
      if (!isPaused) {
        showPauseMainMenu();
      }
    },
    setHealthPercent(percent) {
      healthBar.style.width = `${percent}%`;
    },
    setCurrency(amount) {
      elements.currencyValue.innerText = `${amount}`;
    },
    setUpgradeButtonDisabled(id, disabled) {
      upgradeButtonsById[id].button.disabled = disabled;
      upgradeButtonsById[id].button.classList.toggle('disabled-upgrade', disabled);
    },
    setUpgradeButtonHidden(id, hidden) {
      upgradeButtonsById[id].button.closest('.upgrade-control').style.display = hidden ? 'none' : '';
    },
    setUpgradeButtonMeta(id, { title, description, cost }) {
      const button = upgradeButtonsById[id].button;
      if (title !== undefined) {
        button.dataset.title = title;
        button.setAttribute('aria-label', title);
      }
      if (description !== undefined) {
        button.dataset.description = description;
      }
      if (cost !== undefined) {
        button.dataset.cost = `${cost}`;
      }
    },
    setUpgradeProgress(id, { current, total, unlocked = total }) {
      const progress = upgradeButtonsById[id].progress;
      progress.replaceChildren();
      progress.style.display = total > 0 ? 'flex' : 'none';

      for (let index = 0; index < total; index++) {
        const segment = document.createElement('span');
        segment.className = 'upgrade-progress-segment';
        if (index < unlocked) {
          segment.classList.add(index < current ? 'filled' : 'available');
        } else {
          segment.classList.add('locked');
        }
        progress.appendChild(segment);
      }
    },
    setStatsText(text) {
      elements.stats.innerText = text;
    },
    setUpgradeMenusVisible(visible) {
      elements.upgradeButtons.style.display = visible ? 'block' : 'none';
      baseUpgradeMenu.style.display = visible ? 'flex' : 'none';
      elements.compassContainer.style.display = visible ? 'none' : 'flex';
    },
    setCompassAngle(angleRadians) {
      elements.baseArrow.style.transform = `rotate(${angleRadians}rad)`;
    },
    setRespawnVisible(visible) {
      respawnUI.style.display = visible ? 'block' : 'none';
    },
    setRespawnText(text) {
      respawnUI.innerText = text;
    },
    setDebugVisible(visible) {
      debugInfo.style.display = visible ? 'block' : 'none';
      debugQuicklinks.style.display = visible ? 'flex' : 'none';
    },
    setDebugText(text) {
      elements.debugBody.innerText = text;
    },
    flashDamage() {
      damageOverlay.classList.remove('active');
      // Force restart of the fade animation for rapid consecutive hits.
      void damageOverlay.offsetWidth;
      damageOverlay.classList.add('active');
    },
    setTier2ButtonLabel(text) {
      upgradeButtonsById['up-tier2'].button.dataset.title = text;
      upgradeButtonsById['up-tier2'].button.setAttribute('aria-label', text);
    },
    hideShieldUpgrade() {
      this.setUpgradeButtonHidden('base-up-shield', true);
    },
    hideYamatoUpgrade() {
      this.setUpgradeButtonHidden('base-up-yamato', true);
    },
  };
}
