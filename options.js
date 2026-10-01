import { DEFAULT_SETTINGS, normalizeSettings, SEARCH_ENGINES, validateSearchEngine } from './lib/settings.js';

const form = document.querySelector('#settings');
const controls = document.querySelector('#controls');
const engine = document.querySelector('#searchEngine');
const preset = document.querySelector('#enginePreset');
const status = document.querySelector('#status');
const checkboxes = Object.keys(DEFAULT_SETTINGS).filter(key => key !== 'searchEngine');
for (const { name, template } of SEARCH_ENGINES) {
  const option = document.createElement('option');
  option.textContent = name;
  option.value = template;
  preset.insertBefore(option, preset.lastElementChild);
}

function setStatus(message, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
}
function updatePreview() {
  const value = engine.value.trim();
  const error = validateSearchEngine(value);
  engine.setCustomValidity(error);
  engine.setAttribute('aria-invalid', String(Boolean(error)));
  document.querySelector('#url-error').textContent = error;
  document.querySelector('#preview').textContent = error ? 'Enter a valid search URL to see a preview.' :
    value.replaceAll('%s', encodeURIComponent('curious cats'));
  preset.value = SEARCH_ENGINES.some(item => item.template === value) ? value : 'custom';
  return !error;
}
function render(settings) {
  engine.value = settings.searchEngine;
  for (const key of checkboxes) document.getElementById(key).checked = settings[key];
  updatePreview();
}
async function save(settings) {
  controls.disabled = true;
  try {
    await chrome.storage.sync.set(settings);
    setStatus('Preferences saved.');
  } catch (error) {
    setStatus(`Could not save: ${error.message}`, true);
  } finally {
    controls.disabled = false;
  }
}

preset.addEventListener('change', () => {
  if (preset.value !== 'custom') {
    engine.value = preset.value;
    updatePreview();
  } else {
    engine.focus();
    engine.select();
  }
  setStatus('Unsaved changes.');
});
form.addEventListener('input', event => {
  if (event.target === engine) updatePreview();
  setStatus('Unsaved changes.');
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!updatePreview()) { engine.reportValidity(); return; }
  const settings = { searchEngine: engine.value.trim() };
  for (const key of checkboxes) settings[key] = document.getElementById(key).checked;
  await save(settings);
});
document.querySelector('#reset').addEventListener('click', async () => {
  await save({ ...DEFAULT_SETTINGS });
  if (status.dataset.error !== 'true') render(DEFAULT_SETTINGS);
});

async function load() {
  try {
    const stored = await chrome.storage.sync.get(null);
    // Older versions kept this one preference in options-page localStorage.
    if (stored.disableDomainCheck === undefined) {
      const legacy = localStorage.getItem('disableDomainCheck');
      if (legacy !== null) {
        stored.disableDomainCheck = legacy === 'true';
        await chrome.storage.sync.set({ disableDomainCheck: stored.disableDomainCheck });
        localStorage.removeItem('disableDomainCheck');
      }
    }
    render(normalizeSettings(stored));
    controls.disabled = false;
  } catch (error) {
    setStatus(`Could not load preferences: ${error.message}. Reload to retry.`, true);
  }
}
load();
