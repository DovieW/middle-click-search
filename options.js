import { AI_PROVIDERS, aiProvider } from './lib/ai-providers.js';
import { parseSiteRules } from './lib/sites.js';
import { DEFAULT_SETTINGS, normalizeSettings, SEARCH_ENGINES, validateSearchEngine, validateAiPrompt, validateCustomAiUrl } from './lib/settings.js';

const form = document.querySelector('#settings');
const controls = document.querySelector('#controls');
const engine = document.querySelector('#searchEngine');
const preset = document.querySelector('#enginePreset');
const customAiUrl = document.querySelector('#customAiUrl');
const aiPrompt = document.querySelector('#aiPrompt');
let destination = 'search';
const status = document.querySelector('#status');
const checkboxes = Object.keys(DEFAULT_SETTINGS).filter(key => typeof DEFAULT_SETTINGS[key] === 'boolean');
let siteOverrides = {};
let dirty = false;
let baseline;
let saving = false;
const saveButton = document.querySelector('#save');
const actions = document.querySelector('#settings .actions');
const rules = document.querySelector('#siteRules');
const mode = document.querySelector('#siteMode');
for (const { name, id } of AI_PROVIDERS) preset.insertBefore(new Option(name, id), preset.lastElementChild);
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
function draftSettings() {
  let siteRules;
  try { siteRules = parseSiteRules(rules.value); } catch { siteRules = rules.value; }
  const draft = { destination, customAiUrl: destination !== 'custom-ai' && validateCustomAiUrl(customAiUrl.value.trim()) ? baseline?.customAiUrl : customAiUrl.value.trim(), aiPrompt: aiPrompt.value.trim(), searchEngine: Boolean(aiProvider(destination)) && validateSearchEngine(engine.value.trim()) ? baseline?.searchEngine : engine.value.trim(), linkFocus: document.querySelector('#linkFocus').value,
    siteMode: mode.value, siteRules, siteOverrides };
  for (const key of checkboxes) draft[key] = document.getElementById(key).checked;
  return draft;
}
function comparable(value) {
  if (Array.isArray(value)) return JSON.stringify([...value].sort());
  if (value && typeof value === 'object') return JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify(value);
}
function updateDirty(announce = true) {
  const draft = draftSettings();
  dirty = Boolean(baseline) && Object.entries(draft).some(([key, value]) => comparable(value) !== comparable(baseline[key]));
  saveButton.disabled = !dirty || saving;
  saveButton.textContent = saving ? 'Saving…' : dirty ? 'Save changes' : 'Save';
  actions.dataset.dirty = String(dirty);
  if (announce) setStatus(dirty ? 'Unsaved changes.' : '');
}
function updatePreview() {
  const value = engine.value.trim();
  const error = validateSearchEngine(value);
  engine.required = !aiProvider(destination);
  engine.setCustomValidity(Boolean(aiProvider(destination)) ? '' : error);
  engine.setAttribute('aria-invalid', String(Boolean(error)));
  document.querySelector('#url-error').textContent = error;
  document.querySelector('#preview').textContent = error ? 'Enter a valid search URL to see a preview.' :
    value.replaceAll('%s', encodeURIComponent('curious cats'));
  preset.value = aiProvider(destination) ? destination : SEARCH_ENGINES.some(item => item.template === value) ? value : 'custom';
  document.querySelector('#customEngine').hidden = preset.value !== 'custom';
  document.querySelector('#aiOptions').hidden = !aiProvider(destination);
  document.querySelector('#domainOption').hidden = Boolean(aiProvider(destination));
  const provider = aiProvider(destination);
  document.querySelector('#autoSendOption').hidden = provider?.send !== 'experimental';
  document.querySelector('#aiProviderHint').textContent = provider?.hint || '';
  document.querySelector('#customAi').hidden = destination !== 'custom-ai';
  validateCustomAi();
  validateAiTemplate();
  return Boolean(aiProvider(destination)) || !error;
}
function validateCustomAi() {
  const error = validateCustomAiUrl(customAiUrl.value.trim());
  customAiUrl.required = destination === 'custom-ai';
  customAiUrl.setCustomValidity(destination === 'custom-ai' ? error : '');
  customAiUrl.setAttribute('aria-invalid', String(Boolean(error)));
  document.querySelector('#custom-ai-error').textContent = error;
  return !error;
}
function validateAiTemplate() {
  const error = validateAiPrompt(aiPrompt.value);
  aiPrompt.setCustomValidity(Boolean(aiProvider(destination)) ? error : '');
  aiPrompt.setAttribute('aria-invalid', String(Boolean(error)));
  document.querySelector('#ai-error').textContent = error;
  return !error;
}
function render(settings) {
  baseline = settings;
  destination = settings.destination;
  aiPrompt.value = settings.aiPrompt;
  customAiUrl.value = settings.customAiUrl;
  engine.value = settings.searchEngine;
  document.querySelector('#linkFocus').value = settings.linkFocus;
  mode.value = settings.siteMode;
  rules.value = settings.siteRules.join('\n');
  siteOverrides = { ...settings.siteOverrides };
  renderExceptions();
  validateRules();
  for (const key of checkboxes) document.getElementById(key).checked = settings[key];
  updatePreview();
  updateDirty(false);
}
async function save(settings, reset = false) {
  if (saving) return;
  saving = true;
  controls.disabled = true;
  updateDirty(false);
  setStatus('Saving…');
  try {
    // Write edited fields only, preserving quick controls changed in another window.
    const patch = reset ? settings : Object.fromEntries(Object.entries(settings).filter(([key, value]) =>
      JSON.stringify(value) !== JSON.stringify(baseline[key])));
    if (!reset && patch.siteOverrides) {
      const latest = normalizeSettings(await chrome.storage.sync.get(null)).siteOverrides;
      const merged = { ...latest };
      for (const host of new Set([...Object.keys(baseline.siteOverrides), ...Object.keys(siteOverrides)])) {
        if (baseline.siteOverrides[host] === siteOverrides[host]) continue;
        if (Object.hasOwn(siteOverrides, host)) merged[host] = siteOverrides[host];
        else delete merged[host];
      }
      if (Object.keys(merged).length > 100 || new TextEncoder().encode(JSON.stringify(merged)).length > 7000) {
        throw new Error('Site exceptions are full. Reload and remove an exception first.');
      }
      patch.siteOverrides = merged;
    }
    // A failed follow-up read must not turn a committed write into a save failure.
    const current = normalizeSettings(await chrome.storage.sync.get(null));
    await chrome.storage.sync.set(patch);
    render(normalizeSettings({ ...current, ...patch }));
    dirty = false;
    setStatus('Preferences saved.');
  } catch (error) {
    setStatus(`Could not save: ${error.message}`, true);
  } finally {
    saving = false;
    controls.disabled = false;
    updateDirty(false);
  }
}

preset.addEventListener('change', () => {
  destination = aiProvider(preset.value) ? preset.value : 'search';
  if (aiProvider(preset.value)) {
    updatePreview();
  } else if (preset.value !== 'custom') {
    engine.value = preset.value;
    updatePreview();
  } else {
    document.querySelector('#aiOptions').hidden = true;
    document.querySelector('#domainOption').hidden = false;
    aiPrompt.setCustomValidity('');
    validateCustomAi();
    engine.required = true;
    engine.setCustomValidity(validateSearchEngine(engine.value.trim()));
    document.querySelector('#customEngine').hidden = false;
    engine.focus();
    engine.select();
  }
  updateDirty();
});
form.addEventListener('input', event => {
  if (event.target === engine) updatePreview();
  if (event.target === customAiUrl) validateCustomAi();
  if (event.target === aiPrompt || event.target.id === 'aiIncludeUrl') validateAiTemplate();
  if (event.target === rules || event.target === mode) validateRules();
  updateDirty();
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!dirty || saving) return;
  if (!updatePreview()) { engine.reportValidity(); return; }
  if (destination === 'custom-ai' && !validateCustomAi()) { customAiUrl.reportValidity(); return; }
  if (Boolean(aiProvider(destination)) && !validateAiTemplate()) { aiPrompt.reportValidity(); return; }
  if (!validateRules()) { rules.reportValidity(); return; }
  const settings = draftSettings();
  await save(settings);
});
document.querySelector('#reset').addEventListener('click', async () => {
  await save({ ...DEFAULT_SETTINGS }, true);
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

function validateRules() {
  document.querySelector('#rules-label').textContent = mode.value === 'allow' ? 'Allowed sites' : 'Blocked sites';
  let error = '';
  try { parseSiteRules(rules.value); } catch (failure) { error = failure.message; }
  rules.setCustomValidity(error);
  rules.setAttribute('aria-invalid', String(Boolean(error)));
  document.querySelector('#rules-error').textContent = error;
  return !error;
}
function renderExceptions() {
  const container = document.querySelector('#exceptions');
  container.replaceChildren();
  const entries = Object.entries(siteOverrides);
  document.querySelector('#exception-count').textContent = `(${entries.length})`;
  document.querySelector('#siteExceptions').hidden = !entries.length;
  for (const [host, enabled] of entries) {
    const row = document.createElement('div'); row.className = 'exception';
    const label = document.createElement('span'); label.textContent = `${host} — ${enabled ? 'Enabled' : 'Disabled'}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary';
    remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove exception for ${host}`);
    remove.addEventListener('click', () => { delete siteOverrides[host]; renderExceptions(); updateDirty(); });
    row.append(label, remove); container.append(row);
  }
  if (!entries.length) container.textContent = 'No site exceptions.';
  document.querySelector('#clearExceptions').disabled = !entries.length;
}
document.querySelector('#clearExceptions').addEventListener('click', () => {
  siteOverrides = {}; renderExceptions(); updateDirty();
});
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });

chrome.storage.onChanged.addListener(async (_changes, area) => {
  if (area !== 'sync' || !baseline || dirty || saving) return;
  try {
    const latest = normalizeSettings(await chrome.storage.sync.get(null));
    if (!dirty && !saving) { render(latest); setStatus(''); }
  } catch { /* Keep the last known preferences and allow the user to retry. */ }
});
