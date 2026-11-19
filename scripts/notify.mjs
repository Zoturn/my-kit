#!/usr/bin/env node
// Windows toast notification that opens a file or URL when clicked.
// Usage: node scripts/notify.mjs --test      (sends a test notification)
// Other platforms and KIT_NOTIFY_DRYRUN=1 only print the message. Never throws: a failed toast must not break a run.
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PS = `
$ErrorActionPreference = 'Stop'
[void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
[void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
$t = [Security.SecurityElement]::Escape($env:KIT_TOAST_TITLE)
$b = [Security.SecurityElement]::Escape($env:KIT_TOAST_BODY)
$u = [Security.SecurityElement]::Escape($env:KIT_TOAST_URL)
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml("<toast activationType='protocol' launch='$u'><visual><binding template='ToastGeneric'><text>$t</text><text>$b</text></binding></visual></toast>")
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
$id = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($id).Show($toast)
`;

export function notify({ title, body, file }) {
  const url = file ? pathToFileURL(file).href : '';
  if (process.platform !== 'win32' || process.env.KIT_NOTIFY_DRYRUN === '1') {
    console.log(`[notify] ${title} | ${body} | ${url}`);
    return true;
  }
  try {
    const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', PS], {
      encoding: 'utf8',
      env: { ...process.env, KIT_TOAST_TITLE: title, KIT_TOAST_BODY: body, KIT_TOAST_URL: url },
      timeout: 30000,
    });
    if (r.status !== 0) console.error(`[notify] failed: ${(r.stderr || '').trim().slice(0, 300)}`);
    return r.status === 0;
  } catch (e) {
    console.error(`[notify] failed: ${e.message}`);
    return false;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--test')) {
  notify({ title: 'my-kit', body: 'Test notification. Clicking it opens the my-kit data folder.', file: join(process.env.KIT_HOME || join(homedir(), '.my-kit')) });
}
