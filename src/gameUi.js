export function createGameUi({
  onResume,
  onRestart,
  onBloomInput,
  onAmbientInput,
  onUpgradeCannons,
  onUpgradeSpeed,
  onUpgradeTier2,
  onBuyShield,
  onBuyYamato,
  onBaseUpgradeCannons,
  onBaseUpgradeSpawn,
}) {
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
    </div>
    <h2>Module Upgrades</h2>
    <div id="module-upgrade-buttons">
      <button id="base-up-shield" class="upgrade-btn">Buy Shield Module</button>
      <button id="base-up-yamato" class="upgrade-btn">Buy Yamato Cannon</button>
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
  document.body.appendChild(debugInfo);

  const elements = {
    stats: upgradeMenu.querySelector('#stats'),
    upgradeButtons: upgradeMenu.querySelector('#upgrade-buttons'),
    tier2Button: upgradeMenu.querySelector('#up-tier2'),
    compassContainer: upgradeMenu.querySelector('#compass-container'),
    baseArrow: upgradeMenu.querySelector('#base-arrow'),
    shieldUpgradeButton: baseUpgradeMenu.querySelector('#base-up-shield'),
    yamatoUpgradeButton: baseUpgradeMenu.querySelector('#base-up-yamato'),
    mainMenuContent: escMenu.querySelector('#main-menu-content'),
    optionsMenu: escMenu.querySelector('#options-menu'),
  };

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

  upgradeMenu.querySelector('#up-cannons').onclick = onUpgradeCannons;
  upgradeMenu.querySelector('#up-speed').onclick = onUpgradeSpeed;
  elements.tier2Button.onclick = onUpgradeTier2;
  elements.shieldUpgradeButton.onclick = onBuyShield;
  elements.yamatoUpgradeButton.onclick = onBuyYamato;
  baseUpgradeMenu.querySelector('#base-up-cannons').onclick = onBaseUpgradeCannons;
  baseUpgradeMenu.querySelector('#base-up-spawn').onclick = onBaseUpgradeSpawn;

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
    },
    setDebugText(text) {
      debugInfo.innerText = text;
    },
    setTier2ButtonLabel(text) {
      elements.tier2Button.innerText = text;
    },
    hideShieldUpgrade() {
      elements.shieldUpgradeButton.style.display = 'none';
    },
    hideYamatoUpgrade() {
      elements.yamatoUpgradeButton.style.display = 'none';
    },
  };
}
