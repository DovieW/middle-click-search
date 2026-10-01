import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AI_PROMPT, normalizeSettings, validateAiPrompt } from '../../lib/settings.js';
import { buildAiPrompt, resolveTarget, MAX_AI_LINK_LENGTH } from '../../lib/routing.js';

test('AI defaults preserve existing search behavior and include the URL when selected', () => {
  const settings = normalizeSettings({ searchEngine: 'https://example.com/?q=%s' });
  assert.equal(settings.destination, 'search');
  assert.equal(settings.aiIncludeUrl, true);
  assert.equal(settings.aiPrompt, "Explain and let's discuss this.\n\nContext:\n{text}\nFrom Page: {url}");
  assert.equal(resolveTarget('example.com', settings).kind, 'website');
});
test('ChatGPT always receives context, including URL-shaped selections', () => {
  const result = resolveTarget('https://example.com/selected', { destination: 'chatgpt' }, 'https://source.test/article?q=1#part');
  const url = new URL(result.url);
  assert.equal(url.origin, 'https://chatgpt.com');
  assert.equal(result.kind, 'ai');
  assert.equal(url.searchParams.get('q'), "Explain and let's discuss this.\n\nContext:\nhttps://example.com/selected\nFrom Page: https://source.test/article?q=1#part");
});
test('custom prompts and URL opt-out compose without leftover separators', () => {
  assert.equal(buildAiPrompt('café & cats? #yes', { aiPrompt: 'Summarize this.', aiIncludeUrl: false }, 'https://secret.test/path'),
    'Summarize this.\n\nContext:\ncafé & cats? #yes');
  const url = new URL(resolveTarget('café & cats? #yes', { destination: 'chatgpt', aiIncludeUrl: false }).url);
  assert.equal(url.searchParams.size, 1);
  assert.match(url.searchParams.get('q'), /café & cats\? #yes$/);
});
test('context omits unsupported URLs and removes embedded URL credentials', () => {
  for (const source of ['', 'about:blank', 'file:///tmp/private', 'javascript:alert(1)', 'not a URL']) {
    assert.equal(buildAiPrompt('text', {}, source), "Explain and let's discuss this.\n\nContext:\ntext");
  }
  assert.equal(buildAiPrompt('text', {}, 'https://user:pass@source.test/path'), "Explain and let's discuss this.\n\nContext:\ntext\nFrom Page: https://source.test/path");
});
test('invalid or over-quota saved AI options fall back safely', () => {
  const result = normalizeSettings({ destination: 'invalid', aiPrompt: 'é'.repeat(2500), aiIncludeUrl: 'false' });
  assert.equal(result.destination, 'search'); assert.equal(result.aiPrompt, DEFAULT_AI_PROMPT); assert.equal(result.aiIncludeUrl, true);
  for (const prompt of [undefined, '', '  ', 'é'.repeat(2500)]) assert.notEqual(validateAiPrompt(prompt), '');
  assert.equal(validateAiPrompt('Compare these ideas: {text}'), '');
});
test('Unicode expansion and long page URLs fail rather than truncate the AI context', () => {
  assert.throws(() => resolveTarget('💡'.repeat(9000), { destination: 'chatgpt' }), /too long/);
  assert.throws(() => resolveTarget('text', { destination: 'chatgpt' }, `https://source.test/?q=${'x'.repeat(MAX_AI_LINK_LENGTH)}`), /too long/);
  const result = resolveTarget('text', { destination: 'chatgpt', aiIncludeUrl: false }, `https://source.test/?q=${'x'.repeat(MAX_AI_LINK_LENGTH)}`);
  assert.match(result.url, /^https:\/\/chatgpt.com\//);
});
test('malformed UTF-16 in a saved prompt cannot break URL encoding', () => {
  const url = new URL(resolveTarget('text', { destination: 'chatgpt', aiPrompt: '\ud800 explain' }).url);
  assert.match(url.searchParams.get('q'), /^� explain/);
});

test('templates place and repeat selection and URL independently', () => {
  assert.equal(buildAiPrompt('café', { aiPrompt: 'Source: {url}\nDiscuss {text}. Again: {text}' }, 'https://source.test/article'),
    'Source: https://source.test/article\nDiscuss café. Again: café');
  assert.equal(buildAiPrompt('text', { aiPrompt: '{url}\n{text}\nDiscuss.', aiIncludeUrl: false }, 'https://source.test/'), 'text\nDiscuss.');
  assert.equal(buildAiPrompt('text', { aiPrompt: 'Discuss {text}.' }, 'https://source.test/'), 'Discuss text.');
});
test('context containing placeholders and replacement markers remains literal', () => {
  assert.equal(buildAiPrompt('literal {url} {text} $&', { aiPrompt: '{text}\n{url}' }, 'https://source.test/'),
    'literal {url} {text} $&\nhttps://source.test/');
});
test('new templates require text, while saved instruction-only preferences migrate', () => {
  assert.match(validateAiPrompt('Discuss this.'), /\{text\}/);
  assert.match(validateAiPrompt('Source: {url}'), /\{text\}/);
  assert.equal(normalizeSettings({ aiPrompt: 'Discuss this.' }).aiPrompt, 'Discuss this.\n\nContext:\n{text}\nFrom Page: {url}');
  assert.equal(normalizeSettings({ aiPrompt: 'Discuss {text}' }).aiPrompt, 'Discuss {text}');
});

test('auto-send is opt-in and does not rely on unsupported URL parameters', () => {
  assert.equal(normalizeSettings().aiAutoSend, false);
  assert.equal(normalizeSettings({ aiAutoSend: 'true' }).aiAutoSend, false);
  const draft = new URL(resolveTarget('hello', { destination: 'chatgpt' }).url);
  assert.equal(draft.searchParams.has('submit'), false);
  const auto = new URL(resolveTarget('hello', { destination: 'chatgpt', aiAutoSend: true }).url);
  assert.equal(auto.searchParams.has('submit'), false);
  assert.equal(auto.searchParams.get('q'), draft.searchParams.get('q'));
  assert.equal(resolveTarget('hello', { aiAutoSend: true }).url, resolveTarget('hello', {}).url);
});

test('previous default upgrades to the labeled page line and URL opt-out removes it', () => {
  const settings = normalizeSettings({ aiPrompt: "Explain and let's discuss this.\n\nContext:\n{text}\n{url}" });
  assert.equal(settings.aiPrompt, DEFAULT_AI_PROMPT);
  assert.equal(buildAiPrompt('text', { ...settings, aiIncludeUrl: false }, 'https://source.test/'), "Explain and let's discuss this.\n\nContext:\ntext");
  assert.equal(normalizeSettings({ aiPrompt: 'Source: {url}\n{text}' }).aiPrompt, 'Source: {url}\n{text}');
});

for (const [destination, origin, pathname] of [
  ['gemini', 'https://gemini.google.com', '/app'],
  ['claude', 'https://claude.ai', '/new'],
  ['perplexity', 'https://www.perplexity.ai', '/search'],
]) test(`${destination} receives the full encoded AI template and URL opt-out`, () => {
  const settings = { destination, aiPrompt: 'Source: {url}\nExplain {text}' };
  assert.equal(normalizeSettings(settings).destination, destination);
  const target = resolveTarget('café & literal {url} <script>', settings, 'https://source.test/?q=1#part');
  const url = new URL(target.url);
  assert.equal(url.origin, origin); assert.equal(url.pathname, pathname);
  assert.equal(target.provider, destination); assert.equal(target.kind, 'ai');
  assert.equal(url.searchParams.get('q'), 'Source: https://source.test/?q=1#part\nExplain café & literal {url} <script>');
  assert.equal(new URL(resolveTarget('hello', { destination, aiIncludeUrl: false }, 'https://source.test/').url).searchParams.get('q'), "Explain and let's discuss this.\n\nContext:\nhello");
  assert.throws(() => resolveTarget('💡'.repeat(9000), { destination }), /too long/);
});

test('Custom AI expands the entire prompt into every URL placeholder', () => {
  const values = { destination: 'custom-ai', customAiUrl: 'https://ai.test/chat?prompt=%s#copy=%s', aiPrompt: 'Source: {url}\nDiscuss {text}' };
  const target = resolveTarget('café & literal %s {url}', values, 'https://source.test/page');
  const url = new URL(target.url);
  assert.equal(url.origin, 'https://ai.test');
  assert.equal(url.searchParams.get('prompt'), 'Source: https://source.test/page\nDiscuss café & literal %s {url}');
  assert.equal(decodeURIComponent(url.hash.slice(6)), url.searchParams.get('prompt'));
  assert.equal(target.provider, 'custom-ai');
});
test('invalid Custom AI URLs fail before any provider receives context', () => {
  for (const customAiUrl of ['', 'javascript:%s', 'ftp://ai.test/?q=%s', 'https://%s.ai.test/', 'https://user:pass@ai.test/?q=%s', 'https://ai.test/', 'https://ai.test/?q=%s\\bad']) {
    assert.throws(() => resolveTarget('private selection', { destination: 'custom-ai', customAiUrl }), /valid Custom AI URL/);
  }
  assert.throws(() => resolveTarget('💡'.repeat(9000), { destination: 'custom-ai', customAiUrl: 'https://ai.test/?q=%s' }), /too long/);
});
