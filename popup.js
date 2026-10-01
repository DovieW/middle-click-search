import { getPageStatus } from './lib/page-status.js';
import { getTabError } from './lib/errors.js';
import { normalizeSettings, SEARCH_ENGINES } from './lib/settings.js';
import { siteEnabled, siteHost, normalizeOverrides } from './lib/sites.js';
const controls = document.querySelector('#controls');
const status = document.querySelector('#status');
const engine = document.querySelector('#enginePreset');
let settings, url, host, currentTab;
let checking = 0;
function render() {
  document.querySelector('#enabled').checked = settings.enabled;
  document.querySelector('#siteEnabled').checked = siteEnabled(url, { ...settings, enabled: true });
  document.querySelector('#siteEnabled').disabled = !host || !settings.enabled;
  document.querySelector('#useRules').hidden = !host || !Object.hasOwn(settings.siteOverrides, host);
  void checkPage();
  engine.replaceChildren();
  for (const { name, template } of SEARCH_ENGINES) {
    engine.add(new Option(name, template));
  }
  if (!SEARCH_ENGINES.some(item => item.template === settings.searchEngine)) {
    engine.add(new Option('Custom', settings.searchEngine));
  }
  engine.value = settings.searchEngine;
}
async function save(changes) {
  controls.disabled = true;
  try {
    await chrome.storage.sync.set(changes);
    settings = normalizeSettings({ ...settings, ...changes });
    status.textContent = 'Saved.'; status.dataset.error = 'false';
  } catch (error) { status.textContent = `Could not save: ${error.message}`; status.dataset.error = 'true'; }
  finally { controls.disabled = false; render(); }
}
document.querySelector('#enabled').addEventListener('change', event => save({ enabled: event.target.checked }));
document.querySelector('#siteEnabled').addEventListener('change', async event => {
  // Read the current map so this small update preserves other site exceptions.
  controls.disabled = true;
  try {
    const stored = await chrome.storage.sync.get('siteOverrides');
    const overrides = { ...normalizeOverrides(stored.siteOverrides), [host]: event.target.checked };
    if (Object.keys(overrides).length > 100 || new TextEncoder().encode(JSON.stringify(overrides)).length > 7000) {
      throw new Error('Site exceptions are full. Remove an exception in settings first.');
    }
    await save({ siteOverrides: overrides });
  } catch (error) { status.textContent = error.message; status.dataset.error = 'true'; controls.disabled = false; render(); }
});
document.querySelector('#useRules').addEventListener('click', async () => {
  controls.disabled = true;
  try {
    const stored = await chrome.storage.sync.get('siteOverrides');
    const overrides = normalizeOverrides(stored.siteOverrides); delete overrides[host];
    await save({ siteOverrides: overrides });
  } catch (error) { status.textContent = error.message; status.dataset.error = 'true'; controls.disabled = false; render(); }
});
engine.addEventListener('change', event => save({ searchEngine: event.target.value }));
document.querySelector('#options').addEventListener('click', () => chrome.runtime.openOptionsPage());
try {
  const [stored, tabs] = await Promise.all([chrome.storage.sync.get(null), chrome.tabs.query({ active: true, currentWindow: true })]);
  settings = normalizeSettings(stored); currentTab = tabs[0]; url = currentTab?.url || ''; host = siteHost(url);
  document.querySelector('#site').textContent = host || 'Current site';
  render(); controls.disabled = false;
} catch (error) { status.textContent = `Could not load: ${error.message}. Reopen to retry.`; status.dataset.error = 'true'; }

async function checkPage() {
  const check = ++checking;
  document.querySelector('#siteHint').textContent = 'Checking page…';
  document.querySelector('#refresh').hidden = true;
  const result = await getPageStatus(chrome, currentTab, settings);
  if (check !== checking) return;
  document.querySelector('#siteHint').textContent = result.text;
  document.querySelector('#siteHint').dataset.state = result.state;
  document.querySelector('#refresh').hidden = !result.refresh;
  try {
    const error = await getTabError(chrome, currentTab?.id);
    if (check !== checking) return;
    document.querySelector('#errorMessage').textContent = error;
    document.querySelector('#pageError').hidden = !error;
  } catch {}
}
document.querySelector('#refresh').addEventListener('click', async () => {
  const button = document.querySelector('#refresh'); button.disabled = true;
  try {
    await chrome.tabs.reload(currentTab.id);
    // Checking immediately would race the new document; show a brief reload state.
    document.querySelector('#siteHint').textContent = 'Refreshing…';
  } catch (error) { status.textContent = `Could not refresh: ${error.message}`; status.dataset.error = 'true'; button.disabled = false; }
});
function updateSite(nextUrl) {
  currentTab = { ...currentTab, url: nextUrl };
  url = nextUrl; host = siteHost(url);
  document.querySelector('#site').textContent = host || 'Current site';
  if (settings) render();
}
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (tabId !== currentTab?.id) return;
  if (change.status === 'loading') updateSite('');
  if (change.url || tab?.url) updateSite(change.url || tab.url);
  if (change.status === 'complete') {
    document.querySelector('#refresh').disabled = false;
    void checkPage();
  }
});
document.querySelector('#dismissError').addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: 'dismiss-error', tabId: currentTab.id });
    document.querySelector('#pageError').hidden = true;
  } catch (error) { status.textContent = error.message; status.dataset.error = 'true'; }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && settings) {
    const latest = { ...settings };
    for (const [key, change] of Object.entries(changes)) {
      if (change.newValue === undefined) delete latest[key];
      else latest[key] = change.newValue;
    }
    settings = normalizeSettings(latest); render();
  }
  if (area === 'session' && changes[`tab-error-${currentTab?.id}`]) void checkPage();
});

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request?.type === 'page-ready' && sender.id === chrome.runtime.id &&
      sender.tab?.id === currentTab?.id && sender.frameId === 0) {
    if (sender.url) updateSite(sender.url);
    else void checkPage();
  }
});
