#!/usr/bin/env node
// kit-config: tell my-kit where your projects live and which are public or under NDA.
// Writes ~/.my-kit/projects.json (outside the repo: it is private).
// Interactive:      node bin/kit-config.mjs
// Non-interactive:  node bin/kit-config.mjs --public "~/pets;~/tasks" --nda "~/client-work"
// Separate several folders with ; (or a comma). Anything not listed is treated as NDA.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { CONFIG_PATH } from '../lib/projects.mjs';

const split = (s) => (s || '').split(/[;,]/).map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] || '' : null; };

let pub = arg('--public');
let nda = arg('--nda');

if (pub === null && nda === null) {
  if (!process.stdin.isTTY) { console.error('Not interactive: pass --public "<dirs>" and/or --nda "<dirs>".'); process.exit(1); }
  const old = existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) : null;
  if (old) console.log(`Current config (${CONFIG_PATH}):\n` + old.roots.map((r) => `  ${r.sensitivity}: ${r.path}`).join('\n') + '\n');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('my-kit needs the folders that contain your projects (it looks 2 levels deep).');
  console.log('Public = your own / open source / test tasks. NDA = client or employer work: kept out of git, proposals stay abstract.');
  console.log('Separate several folders with ;  Leave empty for none.\n');
  pub = await rl.question('Public project folders: ');
  nda = await rl.question('NDA project folders:    ');
  rl.close();
}

const roots = [
  ...split(pub).map((path) => ({ path, sensitivity: 'public' })),
  ...split(nda).map((path) => ({ path, sensitivity: 'nda' })),
];
if (!roots.length) { console.error('No folders given, nothing written.'); process.exit(1); }
for (const r of roots) if (!existsSync(r.path)) console.warn(`warning: ${r.path} does not exist (kept anyway)`);

mkdirSync(dirname(CONFIG_PATH), { recursive: true });
writeFileSync(CONFIG_PATH, JSON.stringify({ roots, defaultSensitivity: 'nda' }, null, 2) + '\n');
console.log(`\nSaved ${CONFIG_PATH}\nNext: node ${new URL('./kit-init-all.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')}   (dry run)`);
