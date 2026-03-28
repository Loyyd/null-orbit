import {
  DEFAULT_GAME_OPTIONS,
  GAME_OPTION_SECTIONS,
  cloneGameOptions,
  getOptionValue,
  loadGameOptions,
  resetGameOptions,
  saveGameOptions,
  setOptionValue,
} from './gameOptions';

const sectionsEl = document.getElementById('sections');
const statusEl = document.getElementById('status');
const jsonPreviewEl = document.getElementById('json-preview');
const saveBtn = document.getElementById('save-btn');
const resetBtn = document.getElementById('reset-btn');
const copyBtn = document.getElementById('copy-btn');
const openGameBtn = document.getElementById('open-game-btn');
const openMapBtn = document.getElementById('open-map-btn');

let options = loadGameOptions();

function setStatus(message) {
  statusEl.textContent = message;
}

function updatePreview() {
  jsonPreviewEl.textContent = JSON.stringify(options, null, 2);
}

function renderSections() {
  sectionsEl.innerHTML = '';

  GAME_OPTION_SECTIONS.forEach((section) => {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'section';
    sectionEl.innerHTML = `<h2>${section.title}</h2><div class="field-grid"></div>`;
    const grid = sectionEl.querySelector('.field-grid');

    section.fields.forEach((field) => {
      const value = getOptionValue(options, field.path);
      const fieldEl = document.createElement('div');
      fieldEl.className = 'field';
      fieldEl.innerHTML = `
        <label for="${field.path}">${field.label}</label>
        <input id="${field.path}" type="number" step="${field.step}" min="${field.min}" max="${field.max}" value="${value}" />
        <div class="hint">${field.path}</div>
      `;

      const input = fieldEl.querySelector('input');
      input.addEventListener('input', () => {
        const nextValue = Number(input.value);
        if (Number.isNaN(nextValue)) return;
        setOptionValue(options, field.path, nextValue);
        updatePreview();
        setStatus(`Edited ${field.label}.`);
      });

      grid.appendChild(fieldEl);
    });

    sectionsEl.appendChild(sectionEl);
  });
}

saveBtn.addEventListener('click', () => {
  saveGameOptions(options);
  setStatus('Options saved. Refresh the game to apply them.');
});

resetBtn.addEventListener('click', () => {
  options = cloneGameOptions(DEFAULT_GAME_OPTIONS);
  resetGameOptions();
  renderSections();
  updatePreview();
  setStatus('Defaults restored.');
});

copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(JSON.stringify(options, null, 2));
  setStatus('Copied options JSON.');
});

openGameBtn.addEventListener('click', () => {
  window.location.href = '/';
});

openMapBtn.addEventListener('click', () => {
  window.location.href = '/editor.html';
});

renderSections();
updatePreview();
