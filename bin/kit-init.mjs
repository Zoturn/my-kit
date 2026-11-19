#!/usr/bin/env node
// kit-init: compose the pool (common + chosen stacks) into a project's .claude/ folder.
// Usage: node bin/kit-init.mjs <projectDir> --stacks typescript,react,nextjs [--personal] [--force]
//   --personal  leave tracked files alone: imports go to CLAUDE.local.md, hooks to .claude/settings.local.json,
//               and every file the kit adds is listed in .git/info/exclude so git never sees it.
//   --force     overwrite pool files that were edited locally.
// Safe to re-run.
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const POOL = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'pool');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const target = resolve(args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--stacks') ?? '.');
const stacks = (opt('--stacks') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const force = flag('--force');
const personal = flag('--personal');
const posix = (p) => p.split(sep).join('/');

const available = readdirSync(join(POOL, 'stacks'));
const unknown = stacks.filter((s) => !available.includes(s));
if (unknown.length) {
  console.error(`Unknown stack(s): ${unknown.join(', ')}\nAvailable: ${available.join(', ')}`);
  process.exit(1);
}

const sources = [join(POOL, 'common'), ...stacks.map((s) => join(POOL, 'stacks', s))];
const claudeDir = join(target, '.claude');
const report = { added: [], updated: [], skipped: [] };
const pooled = []; // files in the project that came from the pool

const IGNORE = new Set(['node_modules', '.git']);

// Copy one file into the project: add it, keep it if identical, or skip it when edited locally (unless --force).
function place(s, d) {
  mkdirSync(dirname(d), { recursive: true });
  const rel = relative(target, d);
  if (!existsSync(d)) {
    copyFileSync(s, d);
    report.added.push(rel);
    pooled.push(rel);
  } else if (readFileSync(s, 'utf8') === readFileSync(d, 'utf8')) {
    pooled.push(rel);
  } else if (force) {
    copyFileSync(s, d);
    report.updated.push(rel);
    pooled.push(rel);
  } else {
    report.skipped.push(rel);
  }
}

function copyTree(src, dest) {
  for (const name of readdirSync(src)) {
    if (IGNORE.has(name)) continue;
    const s = join(src, name);
    if (statSync(s).isDirectory()) copyTree(s, join(dest, name));
    else place(s, join(dest, name));
  }
}

const skillsCfg = join(POOL, '..', 'config', 'skills.json');
const extCfg = existsSync(skillsCfg) ? JSON.parse(readFileSync(skillsCfg, 'utf8')) : {};
const expand = (p) => (p.startsWith('~') ? join(homedir(), p.slice(1)) : p);
const excluded = new Set(extCfg.exclude ?? []);

// Your own global skills and agents win over the kit's defaults of the same name.
const globalSkills = new Set();
const globalAgents = new Set();
for (const r of (extCfg.skillSources ?? []).map(expand).filter(existsSync)) {
  for (const n of readdirSync(r)) if (!excluded.has(n) && existsSync(join(r, n, 'SKILL.md'))) globalSkills.add(n);
}
for (const r of (extCfg.agentSources ?? []).map(expand).filter(existsSync)) {
  for (const n of readdirSync(r)) if (n.endsWith('.md') && !excluded.has(n.slice(0, -3))) globalAgents.add(n);
}

for (const src of sources) {
  for (const kind of ['rules', 'agents', 'skills', 'hooks']) {
    const dir = join(src, kind);
    if (!existsSync(dir)) continue;
    if (kind === 'skills') {
      for (const n of readdirSync(dir)) {
        if (!globalSkills.has(n) && statSync(join(dir, n)).isDirectory()) copyTree(join(dir, n), join(claudeDir, 'skills', n));
      }
    } else if (kind === 'agents') {
      for (const n of readdirSync(dir)) if (!globalAgents.has(n)) place(join(dir, n), join(claudeDir, 'agents', n));
    } else {
      copyTree(dir, join(claudeDir, kind));
    }
  }
}

// Global skills and agents (config/skills.json): every project carries its own copy in .claude/.
for (const srcRoot of (extCfg.skillSources ?? []).map(expand).filter(existsSync)) {
  for (const name of readdirSync(srcRoot)) {
    const s = join(srcRoot, name);
    if (excluded.has(name) || !statSync(s).isDirectory() || !existsSync(join(s, 'SKILL.md'))) continue;
    copyTree(s, join(claudeDir, 'skills', name));
  }
}
for (const srcRoot of (extCfg.agentSources ?? []).map(expand).filter(existsSync)) {
  for (const name of readdirSync(srcRoot)) {
    const s = join(srcRoot, name);
    if (name.endsWith('.md') && !excluded.has(name.slice(0, -3)) && statSync(s).isFile()) place(s, join(claudeDir, 'agents', name));
  }
}

// Import block listing every rule file: CLAUDE.md normally, CLAUDE.local.md in personal mode.
const rulesDir = join(claudeDir, 'rules');
const rules = existsSync(rulesDir) ? readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort() : [];
const START = '<!-- my-kit:start -->';
const END = '<!-- my-kit:end -->';
const block = `${START}\n${rules.map((r) => `@.claude/rules/${r}`).join('\n')}\n${END}`;
const mdPath = join(target, personal ? 'CLAUDE.local.md' : 'CLAUDE.md');
let md = existsSync(mdPath) ? readFileSync(mdPath, 'utf8') : personal ? '# Personal notes (my-kit)\n' : '# Project\n';
md = md.includes(START)
  ? md.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block)
  : `${md.trimEnd()}\n\n${block}\n`;
writeFileSync(mdPath, md);

// Hooks from the manifest, without duplicates: settings.json normally, settings.local.json in personal mode.
const manifest = JSON.parse(readFileSync(join(POOL, 'manifest.json'), 'utf8'));
const settingsPath = join(claudeDir, personal ? 'settings.local.json' : 'settings.json');
const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {};
settings.hooks ??= {};
for (const h of manifest.hooks) {
  const command = `node "$CLAUDE_PROJECT_DIR/.claude/hooks/${h.script}"${h.args ? ' ' + h.args : ''}`;
  const groups = (settings.hooks[h.event] ??= []);
  const exists = groups.some((g) => g.hooks?.some((x) => x.command === command));
  if (!exists) groups.push({ matcher: h.matcher, hooks: [{ type: 'command', command, ...(h.timeout ? { timeout: h.timeout } : {}) }] });
}
for (const [k, v] of Object.entries(manifest.settings ?? {})) if (!(k in settings)) settings[k] = v;
settings.env ??= {};
for (const [k, v] of Object.entries(manifest.env ?? {})) if (!(k in settings.env)) settings.env[k] = v;
mkdirSync(claudeDir, { recursive: true });
writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
writeFileSync(join(claudeDir, 'kit.json'), JSON.stringify({ stacks, personal }, null, 2) + '\n');

// Personal mode: keep everything the kit added out of git, without touching the repo's .gitignore.
function gitInfoDir(dir) {
  const g = join(dir, '.git');
  if (!existsSync(g)) return null;
  if (statSync(g).isDirectory()) return join(g, 'info');
  const m = /gitdir:\s*(.+)/.exec(readFileSync(g, 'utf8'));
  if (!m) return null;
  const gd = resolve(dir, m[1].trim());
  const cd = join(gd, 'commondir');
  return join(existsSync(cd) ? resolve(gd, readFileSync(cd, 'utf8').trim()) : gd, 'info');
}

// The git repo may sit above the project (workspace or monorepo): walk up to find it.
function findRepoRoot(dir) {
  let cur = dir;
  for (;;) {
    if (existsSync(join(cur, ".git"))) return cur;
    const up = dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
}

let excludeNote = '';
if (personal) {
  const repoRoot = findRepoRoot(target);
  const info = repoRoot ? gitInfoDir(repoRoot) : null;
  const prefix = repoRoot ? posix(relative(repoRoot, target)) : '';
  if (!info) {
    excludeNote = 'WARNING: not a git repo, so nothing was added to the git exclude list.';
  } else {
    mkdirSync(info, { recursive: true });
    const file = join(info, 'exclude');
    const S = '# my-kit:start';
    const E = '# my-kit:end';
    const own = ['CLAUDE.local.md', '.claude/settings.local.json', '.claude/kit.json', ...pooled.map(posix)].map((p) => (prefix ? `${prefix}/${p}` : p));
    let cur = existsSync(file) ? readFileSync(file, 'utf8') : '';
    const re = new RegExp(`${S}[\\s\\S]*?${E}\\n?`);
    const prev = (re.exec(cur)?.[0] ?? '').split('\n').filter((l) => l && !l.startsWith('#'));
    const all = [...new Set([...prev, ...own])].sort();
    const blk = `${S}\n${all.join('\n')}\n${E}\n`;
    cur = re.test(cur) ? cur.replace(re, blk) : (cur && !cur.endsWith('\n') ? cur + '\n' : cur) + blk;
    writeFileSync(file, cur);
    excludeNote = `git: ${all.length} kit file(s) excluded via .git/info/exclude`;
  }
}

console.log(`kit-init${personal ? ' (personal)' : ''} → ${target}\nstacks: common${stacks.length ? ', ' + stacks.join(', ') : ''}`);
for (const [k, v] of Object.entries(report)) if (v.length) console.log(`${k}:\n  ${v.join('\n  ')}`);
if (excludeNote) console.log(excludeNote);
if (report.skipped.length) console.log('(skipped files differ from the pool; use --force to overwrite)');
