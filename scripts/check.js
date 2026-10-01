import assert from 'node:assert/strict';
import { posix } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
for (const dir of ['.', 'lib', 'scripts']) {
  for (const file of readdirSync(dir).filter(file => file.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', `${dir}/${file}`], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
// Dynamic imports in content scripts need every transitive module exposed.
const exposed = new Set(manifest.web_accessible_resources.flatMap(group => group.resources));
const visited = new Set();
function checkContentModule(file) {
  if (visited.has(file)) return;
  visited.add(file);
  assert(exposed.has(file), `Content-script module missing from web_accessible_resources: ${file}`);
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) {
    checkContentModule(posix.normalize(posix.join(posix.dirname(file), match[1])));
  }
}
for (const script of manifest.content_scripts.flatMap(group => group.js)) {
  const source = readFileSync(script, 'utf8');
  for (const match of source.matchAll(/import\(chrome\.runtime\.getURL\(['"]([^'"]+)['"]\)\)/g)) checkContentModule(match[1]);
}
