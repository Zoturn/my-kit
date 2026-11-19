#!/usr/bin/env node
// Builds ~/.my-kit/latest.html from the daily review results and sends a notification.
// Reads ~/.my-kit/digests/<date>.json (written by daily-review.mjs) and the docs-check logs. Local only.
// Usage: node scripts/summary.mjs [YYYY-MM-DD]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { notify } from './notify.mjs';

const root = process.env.KIT_HOME || join(homedir(), '.my-kit');
const digests = join(root, 'digests');
const logsDir = process.env.KIT_LOG_DIR || join(root, 'logs');
const day = process.argv[2] || new Date().toISOString().slice(0, 10);
const out = join(root, 'latest.html');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
const sum = (arr, f) => arr.reduce((n, x) => n + (f(x) || 0), 0);

const history = (existsSync(digests) ? readdirSync(digests) : [])
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().slice(-7)
  .map((f) => readJson(join(digests, f))).filter(Boolean);
const today = history.find((d) => d.day === day) || { day, projects: [], skipped: [] };

const docChecks = [];
const gateLog = [];
if (existsSync(logsDir)) {
  for (const p of readdirSync(logsDir)) {
    for (const [name, target] of [['docs-checks.jsonl', docChecks], ['review-gate.jsonl', gateLog]]) {
      const f = join(logsDir, p, name);
      if (!existsSync(f)) continue;
      for (const l of readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
        try { target.push(JSON.parse(l)); } catch { /* skip bad line */ }
      }
    }
  }
}
docChecks.sort((a, b) => (a.ts < b.ts ? 1 : -1));
const cutoff = new Date(Date.now() - 7 * 864e5).toISOString();
const recentChecks = docChecks.filter((c) => c.ts >= cutoff).slice(0, 30);
gateLog.sort((a, b) => (a.ts < b.ts ? 1 : -1));
const recentGate = gateLog.filter((c) => c.ts >= cutoff).slice(0, 40);
const gateRows = recentGate.map((g) => `<tr><td>${esc(g.ts.slice(0, 16).replace('T', ' '))}</td><td>${esc(basename(g.repo || ''))}</td><td class="${g.verdict === 'blocked' ? 'bad' : ''}">${esc(g.verdict)}</td><td>${esc(g.counts ? `high ${g.counts.high}, medium ${g.counts.medium}, low ${g.counts.low}` : g.note || '')}</td></tr>`).join('\n');

const num = (c, k) => (c ? c[k] : '?');
const tot = (d) => ({
  high: sum(d.projects, (p) => p.counts?.high), medium: sum(d.projects, (p) => p.counts?.medium),
  low: sum(d.projects, (p) => p.counts?.low), proposals: sum(d.projects, (p) => p.proposalCount),
});
const t = tot(today);
const failed = today.projects.filter((p) => p.failed).length;

const rows = [...today.projects]
  .sort((a, b) => (b.counts?.high ?? -1) - (a.counts?.high ?? -1) || (b.counts?.medium ?? -1) - (a.counts?.medium ?? -1))
  .map((p) => `<tr><td>${esc(p.project)} <span class="tag ${p.tag === 'NDA' ? 'nda' : ''}">${esc(p.tag)}</span></td><td>${p.files}</td>
<td class="${p.counts?.high ? 'bad' : ''}">${num(p.counts, 'high')}</td><td>${num(p.counts, 'medium')}</td><td>${num(p.counts, 'low')}</td>
<td>${p.proposalCount ?? '?'}</td><td>${p.failed ? '<span class="bad">review failed</span>' : 'ok'}</td></tr>`).join('\n');

const details = today.projects.map((p) => `<details><summary>${esc(p.project)} [${esc(p.tag)}]</summary>
<h4>Review of today's changes</h4><pre>${esc(p.review)}</pre><h4>Improvement proposals</h4><pre>${esc(p.proposals)}</pre></details>`).join('\n');

const trend = [...history].reverse().map((d) => { const x = tot(d); return `<tr><td>${esc(d.day)}</td><td>${d.projects.length}</td><td>${x.high}</td><td>${x.medium}</td><td>${x.low}</td><td>${x.proposals}</td></tr>`; }).join('\n');
const checks = recentChecks.map((c) => `<tr><td>${esc(c.ts.slice(0, 16).replace('T', ' '))}</td><td>${esc(basename(c.repo || ''))}</td><td>${esc(c.note)}</td></tr>`).join('\n');
const skipped = (today.skipped || []).map((s) => `<li>${esc(s.project)}: ${esc(s.reason)}</li>`).join('');

mkdirSync(root, { recursive: true });
writeFileSync(out, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>my-kit review ${esc(day)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1c1c1e;--mut:#6b7280;--line:#e5e7eb;--bad:#b42318;--chip:#f3f4f6}
@media (prefers-color-scheme:dark){:root{--bg:#161618;--fg:#e8e8ea;--mut:#9aa0a6;--line:#2c2c30;--bad:#ff8a80;--chip:#232326}}
body{font:15px/1.5 system-ui,Segoe UI,sans-serif;background:var(--bg);color:var(--fg);max-width:960px;margin:2rem auto;padding:0 1rem}
h1{font-size:1.4rem;margin:0}h2{font-size:1.05rem;margin:2rem 0 .5rem}h4{margin:.8rem 0 .2rem;color:var(--mut);font-weight:600;font-size:.85rem}
.sub{color:var(--mut)}.cards{display:flex;gap:.75rem;flex-wrap:wrap;margin:1rem 0}.card{background:var(--chip);border-radius:10px;padding:.6rem 1rem;min-width:110px}
.card b{display:block;font-size:1.5rem}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.4rem .6rem;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--mut);font-weight:600;font-size:.8rem}.bad{color:var(--bad);font-weight:600}.tag{font-size:.7rem;background:var(--chip);border-radius:6px;padding:1px 6px;color:var(--mut)}.tag.nda{color:var(--bad)}
details{border:1px solid var(--line);border-radius:8px;padding:.4rem .8rem;margin:.5rem 0}summary{cursor:pointer;font-weight:600}pre{white-space:pre-wrap;word-break:break-word;font:13px/1.45 ui-monospace,Consolas,monospace;margin:.2rem 0}
</style></head><body>
<h1>my-kit daily review</h1><div class="sub">${esc(day)} &middot; generated ${esc(new Date().toISOString().slice(0, 16).replace('T', ' '))} UTC &middot; local file, contains NDA project details</div>
<div class="cards"><div class="card"><b>${today.projects.length}</b>projects reviewed</div><div class="card"><b class="${t.high ? 'bad' : ''}">${t.high}</b>high</div>
<div class="card"><b>${t.medium}</b>medium</div><div class="card"><b>${t.low}</b>low</div><div class="card"><b>${t.proposals}</b>proposals</div>${failed ? `<div class="card"><b class="bad">${failed}</b>failed</div>` : ''}</div>
${today.projects.length ? `<h2>Projects</h2><table><tr><th>Project</th><th>Files</th><th>High</th><th>Medium</th><th>Low</th><th>Proposals</th><th>Status</th></tr>${rows}</table>${details}` : '<p class="sub">No LLM edits were logged for this day.</p>'}
${skipped ? `<h2>Skipped</h2><ul>${skipped}</ul>` : ''}
<h2>Last 7 days</h2><table><tr><th>Day</th><th>Projects</th><th>High</th><th>Medium</th><th>Low</th><th>Proposals</th></tr>${trend}</table>
<h2>Commit reviews by the gate (7 days)</h2>${gateRows ? `<table><tr><th>When (UTC)</th><th>Repo</th><th>Verdict</th><th>Details</th></tr>${gateRows}</table>` : '<p class="sub">None recorded.</p>'}
<h2>Docs checks on Claude's commits (7 days)</h2>${checks ? `<table><tr><th>When (UTC)</th><th>Repo</th><th>Note</th></tr>${checks}</table>` : '<p class="sub">None recorded.</p>'}
</body></html>`);
console.log(`Summary written: ${out}`);

if (today.projects.length || today.skipped?.length) {
  const body = failed
    ? `${failed} review(s) failed. ${t.high} high, ${t.medium} medium, ${t.low} low, ${t.proposals} proposals.`
    : `${t.high} high, ${t.medium} medium, ${t.low} low issues, ${t.proposals} proposals.`;
  notify({ title: `my-kit: ${today.projects.length} project(s) reviewed`, body, file: out });
}
