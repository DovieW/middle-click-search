import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
for (const dir of ['.', 'lib', 'scripts']) {
  for (const file of readdirSync(dir).filter(file => file.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', `${dir}/${file}`], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
JSON.parse(readFileSync('manifest.json', 'utf8'));
