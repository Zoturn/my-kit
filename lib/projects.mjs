// Shared project discovery for the kit scripts.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const MAX_DEPTH = 2;
const SKIP = new Set(['node_modules', 'dist', 'build', 'out', 'coverage']);

// Your project roots live OUTSIDE the repo (they are private): ~/.my-kit/projects.json. Create it with `node bin/kit-config.mjs`.
export const CONFIG_PATH = process.env.KIT_CONFIG || join(homedir(), '.my-kit', 'projects.json');
export const configExists = () => existsSync(CONFIG_PATH);

export function loadConfig() {
  if (!configExists()) {
    console.error(`my-kit: no project config at ${CONFIG_PATH}.\nRun: node ${join(here, '..', 'bin', 'kit-config.mjs')}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

export const readPkg = (dir) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

export function detectStacks(dir, pkg = readPkg(dir)) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const has = (...names) => names.some((n) => n in deps);
  const stacks = [];
  if (has('typescript') || existsSync(join(dir, 'tsconfig.json'))) stacks.push('typescript');
  if (has('react')) stacks.push('react');
  if (has('next')) stacks.push('nextjs');
  if (has('@nestjs/core')) stacks.push('nestjs');
  if (has('pg', 'postgres', 'typeorm', 'prisma', '@prisma/client')) stacks.push('postgres');
  return stacks;
}

// Folders with a package.json are projects; other folders are searched up to 2 levels deep.
export function scan(rootPath) {
  const found = [];
  const withoutPkg = [];
  const walk = (dir, depth) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.') || SKIP.has(name)) continue;
      const sub = join(dir, name);
      let isDir = false;
      try { isDir = statSync(sub).isDirectory(); } catch { /* unreadable entry */ }
      if (!isDir) continue;
      if (existsSync(join(sub, 'package.json'))) found.push(sub);
      else if (depth < MAX_DEPTH) walk(sub, depth + 1);
      else withoutPkg.push(sub);
    }
  };
  walk(rootPath, 1);
  return { found, withoutPkg };
}
