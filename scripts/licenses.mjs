import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const entries = Object.entries(lock.packages).filter(([key]) => key !== '').map(([key, value]) => ({
  path: key,
  name: key.split('node_modules/').at(-1),
  version: value.version,
  license: value.license ?? 'NOASSERTION',
  developmentOnly: value.dev === true,
  optional: value.optional === true,
  direct: Object.hasOwn(manifest.dependencies ?? {}, key.slice('node_modules/'.length)) || Object.hasOwn(manifest.devDependencies ?? {}, key.slice('node_modules/'.length)),
})).sort((a, b) => a.path.localeCompare(b.path, 'en'));

let notices = 'NP3DP — THIRD-PARTY NOTICES\n\nThe project distribution license is undecided. The following notices apply to\nthird-party runtime packages and font assets, not to the original NP3DP code.\nGenerated from installed packages by scripts/licenses.mjs.\n';
for (const entry of entries.filter((item) => !item.developmentOnly)) {
  const directory = path.join(root, entry.path);
  const names = (await readdir(directory)).filter((name) => /^(licen[cs]e|copying)([._-].*)?$/i.test(name)).sort();
  if (!names.length || entry.license === 'NOASSERTION') throw new Error(`Review missing license information for ${entry.name}.`);
  notices += `\n${'='.repeat(72)}\n${entry.name}@${entry.version} — ${entry.license}\n${'='.repeat(72)}\n`;
  for (const name of names) notices += `\n${(await readFile(path.join(directory, name), 'utf8')).replace(/\r\n/g, '\n').trim()}\n`;
}
const outputs = [
  ['docs/dependency-inventory.json', `${JSON.stringify({ lockfileVersion: lock.lockfileVersion, packages: entries }, null, 2)}\n`],
  ['public/THIRD_PARTY_NOTICES.txt', notices],
];
for (const [filename, text] of outputs) {
  const destination = path.join(root, filename);
  if (process.argv.includes('--check')) {
    if ((await readFile(destination, 'utf8')).replace(/\r\n/g, '\n') !== text) throw new Error(`${filename} is stale. Run npm run licenses and review the changes.`);
  } else { await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, text); }
}
console.log(`${entries.length} locked packages inventoried; ${entries.filter((entry) => !entry.developmentOnly).length} runtime notices verified.`);
