# Links the kit's skills into Claude Code's global skills folder (no admin needed):
# the meta skills in global\skills (kit-setup, kit-new) and the shared skills in pool\common\skills (spec-gate).
$skills = Join-Path $HOME ".claude\skills"
New-Item -ItemType Directory -Force -Path $skills | Out-Null
$kit = $PSScriptRoot
# Skills read the kit location from here, so the repo can live anywhere.
$data = Join-Path $HOME ".my-kit"
New-Item -ItemType Directory -Force -Path $data | Out-Null
Set-Content -Path (Join-Path $data "kit-root.txt") -Value $kit -NoNewline
foreach ($source in @((Join-Path $kit "global\skills"), (Join-Path $kit "pool\common\skills"))) {
  Get-ChildItem -Directory $source | ForEach-Object {
    $link = Join-Path $skills $_.Name
    if (-not (Test-Path $link)) {
      New-Item -ItemType Junction -Path $link -Target $_.FullName | Out-Null
      Write-Host "linked $($_.Name)"
    } else {
      Write-Host "already linked $($_.Name)"
    }
  }
}
Write-Host "Restart Claude Code. Global skills: /kit-setup, /kit-new, spec-gate."
