#!/usr/bin/env node
// kit-init-all: set up every project under the roots in ~/.my-kit/projects.json.
// Finds projects up to 2 levels deep (a folder with package.json), detects stacks from it,
// and uses --personal mode for every root that is not "public".
// Dry run by default; pass --apply to write.
// Usage: node bin/kit-init-all.mjs [--apply]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { configExists, detectStacks, loadConfig, scan } from '../lib/projects.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const apply = process.argv.includes('--apply');
if (!configExists() && process.stdin.isTTY) {
  console.log('First run: no project folders configured yet.\n');
  const r = spawnSync(process.execPath, [join(here, 'kit-config.mjs')], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
const config = loadConfig();

for (const root of config.roots) {
  if (!existsSync(root.path)) { console.log(`\n${root.path} [${root.sensitivity}]: folder not found`); continue; }
  console.log(`\n${root.path} [${root.sensitivity}]`);
  const { found, withoutPkg } = scan(root.path);
  const personal = root.sensitivity !== 'public';

  // A folder that holds several projects and has its own Claude setup (.claude, CLAUDE.md, AGENTS.md) is a workspace:
  // it gets the common setup (workflow rules, reviewer agent, edit-logging hook); each part gets its stack rules.
  const workspaces = [...new Set(found.map((d) => dirname(d)))].filter(
    (d) => resolve(d) !== resolve(root.path) && !found.includes(d)
      && [".claude", "CLAUDE.md", "AGENTS.md"].some((f) => existsSync(join(d, f))),
  );
  for (const dir of workspaces) {
    const done = existsSync(join(dir, ".claude", "kit.json")) ? " (already set up, will refresh)" : "";
    console.log(`  ${relative(root.path, dir)} (workspace): common only${personal ? " [personal mode]" : ""}${done}`);
    if (apply) {
      const r = spawnSync(process.execPath, [join(here, "kit-init.mjs"), resolve(dir), "--stacks", "", ...(personal ? ["--personal"] : [])], { encoding: "utf8" });
      if (r.status !== 0) console.log(`    FAILED: ${r.stderr.trim()}`);
      for (const l of (r.stdout || '').split('\n')) if (l.startsWith('WARNING')) console.log(`    ${l}`);
    }
  }

  for (const dir of found) {
    const name = relative(root.path, dir);
    let stacks;
    try { stacks = detectStacks(dir); } catch { console.log(`  ${name}: unreadable package.json, skipped`); continue; }
    const done = existsSync(join(dir, '.claude', 'kit.json')) ? ' (already set up, will refresh)' : '';
    console.log(`  ${name}: ${stacks.join(', ') || 'common only'}${personal ? ' [personal mode]' : ''}${done}`);
    if (apply) {
      const r = spawnSync(
        process.execPath,
        [join(here, 'kit-init.mjs'), resolve(dir), '--stacks', stacks.join(','), ...(personal ? ['--personal'] : [])],
        { encoding: 'utf8' },
      );
      if (r.status !== 0) console.log(`    FAILED: ${r.stderr.trim()}`);
      for (const l of (r.stdout || '').split('\n')) if (l.startsWith('WARNING')) console.log(`    ${l}`);
    }
  }
  if (!found.length) console.log('  (no folder with package.json found within 2 levels)');
  if (withoutPkg.length) {
    console.log(`  not set up, no package.json: ${withoutPkg.map((d) => relative(root.path, d)).join(', ')}`);
  }
}
if (!apply) console.log('\nDry run. Nothing was written. Re-run with --apply to set these projects up.');
