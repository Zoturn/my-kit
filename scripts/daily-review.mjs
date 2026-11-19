#!/usr/bin/env node
// Daily reviewer. For every project with LLM edits logged today it:
//   1. reviews the day's diffs against the project's rules, and
//   2. proposes improvements for the project itself (architecture, tests, security, performance...).
// Claude runs headless with read-only tools: it never changes your code.
// Output: ~/.my-kit/digests/<date>.md and ~/.my-kit/proposals/<project>/<date>.md
// Usage: node scripts/daily-review.mjs [YYYY-MM-DD]   (default: today, UTC, matching the log files)
// Env: KIT_PROPOSALS=0 skips the proposals pass.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { CONFIG_PATH, configExists } from '../lib/projects.mjs';

const root = process.env.KIT_HOME || join(homedir(), '.my-kit');
const logsDir = process.env.KIT_LOG_DIR || join(root, 'logs');
const outDir = join(root, 'digests');
const proposalsDir = join(root, 'proposals');
const claudeCmd = process.env.KIT_CLAUDE_CMD || 'claude';
const withProposals = process.env.KIT_PROPOSALS !== '0';
const MAX_DIFF = 60000;

// Which projects are public (pet projects, test tasks) and which are under NDA. Unknown = NDA (safe default).
const config = configExists() ? JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) : { roots: [] };
const norm = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const sensitivityOf = (cwd) => {
  const c = norm(cwd);
  const hit = (config.roots || []).find((r) => c === norm(r.path) || c.startsWith(norm(r.path) + '/'));
  return hit?.sensitivity || config.defaultSensitivity || 'nda';
};
const day = process.argv[2] || new Date().toISOString().slice(0, 10);

const git = (cwd, args) =>
  spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const ask = (cwd, input) => {
  const run = spawnSync(claudeCmd, ['-p', '--allowedTools', 'Read,Grep,Glob'], {
    cwd,
    input,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 10 * 60 * 1000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return run.status === 0
    ? run.stdout.trim()
    : `Failed (exit ${run.status}): ${(run.stderr || run.error?.message || '').slice(0, 500)}`;
};

const REVIEW_PROMPT = `You are a strict code reviewer with no memory of how this code was written.
The diff below contains changes made today, mostly by an LLM. Read the project rules in
CLAUDE.md and .claude/rules/ first. Report only real problems, most severe first:
bugs, security issues, rule violations, invented APIs or packages, skipped or weak tests,
unrequested changes, duplicated components. For each: file:line, what is wrong, a concrete fix.
If nothing is wrong, say "No issues found." Do not invent issues. Be brief.
Finish with one last line exactly in this form (counts of the problems you reported): SEVERITY: high=<n> medium=<n> low=<n>

--- DIFF ---
`;

const proposalPrompt = (files, stat, previous) => `You are a senior engineer reviewing the health of THIS project (not the tooling around it).
Today's changes touched the files listed below. Read them and the code around them, plus CLAUDE.md and .claude/rules/.
Propose improvements the project needs: architecture, duplicated code, missing or weak tests, performance,
security, accessibility, dependency problems, developer experience.
Rules:
- At most 5 proposals, most valuable first. Only propose what you verified by reading the code.
- Each: title; why it matters with evidence (file:line); the suggested change; effort (S/M/L); impact (low/medium/high).
- Do not change any files. Do not repeat proposals already made earlier (listed below).
- If nothing is worth proposing, say "No proposals."
- Finish with one last line exactly in this form: PROPOSALS: <n>

--- FILES EDITED TODAY ---
${files.join('\n')}

--- DIFF STAT ---
${stat}

--- ALREADY PROPOSED EARLIER (do not repeat) ---
${previous || '(none)'}
`;

const latestPrevious = (project) => {
  const dir = join(proposalsDir, project);
  if (!existsSync(dir)) return '';
  const prior = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== `${day}.md`).sort().slice(-3);
  return prior.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n\n').slice(-8000);
};

const sections = [];
const results = [];
const skipped = [];
const projects = existsSync(logsDir) ? readdirSync(logsDir) : [];

for (const project of projects) {
  const logFile = join(logsDir, project, `${day}.jsonl`);
  if (!existsSync(logFile)) continue;

  const entries = readFileSync(logFile, 'utf8').split('\n').filter(Boolean).flatMap((l) => {
    try { return [JSON.parse(l)]; } catch { return []; }
  });
  const files = [...new Set(entries.map((e) => e.file).filter(Boolean))];
  const cwd = [...entries].reverse().find((e) => e.cwd)?.cwd;

  if (!cwd || !existsSync(cwd) || git(cwd, ['rev-parse', '--is-inside-work-tree']).status !== 0) {
    sections.push(`## ${project}\n\nSkipped: project folder or git repo not found (${cwd ?? 'no cwd logged'}).\n`);
    skipped.push({ project, reason: 'project folder or git repo not found' });
    continue;
  }

  const sensitivity = sensitivityOf(cwd);
  const tag = sensitivity === 'nda' ? 'NDA' : 'public';

  const since = `--since=${day}T00:00:00Z`;
  const uncommitted = git(cwd, ['diff', 'HEAD', '--', ...files]).stdout || '';
  const committed = git(cwd, ['log', since, '-p', '--no-color', '--', ...files]).stdout || '';
  let diff = `${committed}\n${uncommitted}`.trim();

  if (!diff) {
    sections.push(`## ${project}\n\n${files.length} file(s) edited, but no diff found (already reverted or committed before today).\n`);
    skipped.push({ project, reason: 'no diff found (reverted or committed earlier)' });
    continue;
  }
  const truncated = diff.length > MAX_DIFF;
  if (truncated) diff = diff.slice(0, MAX_DIFF);

  const reviewRaw = ask(cwd, REVIEW_PROMPT + diff);
  const sev = /^SEVERITY:\s*high=(\d+)\s+medium=(\d+)\s+low=(\d+)\s*$/im.exec(reviewRaw);
  const review = reviewRaw.replace(/^SEVERITY:.*$/gim, '').trim();

  let proposals = '_Skipped (KIT_PROPOSALS=0)._';
  let proposalsRaw = '';
  if (withProposals) {
    const stat = `${git(cwd, ['log', since, '--stat', '--no-color', '--', ...files]).stdout || ''}\n${git(cwd, ['diff', 'HEAD', '--stat', '--', ...files]).stdout || ''}`.trim();
    proposalsRaw = ask(cwd, proposalPrompt(files, stat, latestPrevious(project)));
    proposals = proposalsRaw.replace(/^PROPOSALS:.*$/gim, '').trim();
    const pdir = join(proposalsDir, project);
    mkdirSync(pdir, { recursive: true });
    writeFileSync(join(pdir, `${day}.md`), `# ${project} [${tag}] — proposals ${day}\n\n${proposals}\n`);
  }

  const propMatch = /^PROPOSALS:\s*(\d+)\s*$/im.exec(proposalsRaw);
  results.push({
    project, tag, files: files.length, truncated, review, proposals,
    counts: sev ? { high: +sev[1], medium: +sev[2], low: +sev[3] } : null,
    proposalCount: propMatch ? +propMatch[1] : /no proposals/i.test(proposals) ? 0 : null,
    failed: /^Failed \(exit/.test(reviewRaw) || /^Failed \(exit/.test(proposals),
  });

  sections.push(
    `## ${project} [${tag}]\n\n${files.length} file(s) edited by the LLM${truncated ? ' (diff truncated for review)' : ''}.\n\n### Review of today's changes\n\n${review}\n\n### Improvement proposals for the project\n\n${proposals}\n`,
  );
}

mkdirSync(outDir, { recursive: true });
const digest = `# my-kit daily review — ${day}\n\n${sections.length ? sections.join('\n') : 'No LLM edits logged.\n'}`;
const outFile = join(outDir, `${day}.md`);
writeFileSync(outFile, digest);
// Keep the knowledge index (used by /kit-new) fresh.
spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'index-projects.mjs')], { stdio: 'ignore' });
writeFileSync(join(outDir, `${day}.json`), JSON.stringify({ day, projects: results, skipped }, null, 2));
spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'summary.mjs'), day], { stdio: 'inherit' });
console.log(`Digest written: ${outFile}`);
