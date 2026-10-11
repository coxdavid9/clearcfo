import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const pluginPath = require.resolve('@next/eslint-plugin-next');
const pluginRequire = createRequire(pluginPath);
const replacement = pluginRequire('fast-glob/package.json');
assert.equal(replacement.name, '@clearcfo/next-root-glob');
assert.equal(replacement.dependencies.tinyglobby, '0.2.17');
const { getRootDirs } = pluginRequire('./utils/get-root-dirs.js');
const plugin = require('@next/eslint-plugin-next');
assert.ok(plugin.rules['no-html-link-for-pages']);
const dir = mkdtempSync(join(tmpdir(), 'clearcfo-lint-'));
const previousCwd = process.cwd();
function roots(rootDir) {
  return getRootDirs({ cwd: dir, settings: rootDir === undefined ? {} : { next: { rootDir } } })
    .map(path => path.replace(/\\/g, '/').replace(/\/$/, '')).sort();
}
try {
  process.chdir(dir);
  mkdirSync('packages/web/pages', { recursive: true });
  mkdirSync('packages/admin', { recursive: true });
  writeFileSync('packages/readme.txt', 'fixture');
  assert.deepEqual(roots(), [dir]);
  assert.deepEqual(roots('packages/web'), ['packages/web']);
  assert.deepEqual(roots('packages/*/'), ['packages/admin', 'packages/web']);
  assert.deepEqual(roots('packages/{web,admin}'), ['packages/admin', 'packages/web']);
  assert.deepEqual(roots(['packages/web', 'packages/admin']), ['packages/admin', 'packages/web']);
  assert.deepEqual(roots('packages/missing/*'), []);
  assert.deepEqual(roots(join(dir, 'packages', '*')), [join(dir, 'packages', 'admin'), join(dir, 'packages', 'web')]);
  assert.deepEqual(roots('packages\\web'), ['packages/web']);
} finally {
  process.chdir(previousCwd);
  rmSync(dir, { recursive: true, force: true });
}
console.log('PASS: actual Next lint plugin loads and resolves default, literal, wildcard, brace, array, absolute and Windows-style project roots');
