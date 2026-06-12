# Creates a Start Menu shortcut "Agentic OS" that runs bin/launch-dashboard.ps1.
# Run once: powershell -ExecutionPolicy Bypass -File bin/install-shortcut.ps1
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $repoRoot "bin\launch-dashboard.ps1"
$ico = Join-Path $repoRoot "dashboard\public\icons\app.ico"

$psExe = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
if (-not $psExe) { $psExe = (Get-Command powershell).Source }

$programs = [Environment]::GetFolderPath("Programs")
$lnkPath = Join-Path $programs "Agentic OS.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)
$shortcut.TargetPath = $psExe
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""
$shortcut.WorkingDirectory = $repoRoot
if (Test-Path $ico) { $shortcut.IconLocation = $ico }
$shortcut.Description = "Agentic OS command center"
$shortcut.Save()

Write-Host "Created: $lnkPath"
Write-Host "It appears in the Start Menu as 'Agentic OS'."
