# Launches the Agentic OS dashboard like a desktop app:
#   - installs dashboard deps on first run
#   - reuses an already-running server on the port, else starts one minimized
#   - opens an app-frame browser window (Edge/Chrome --app)
# Switches:
#   -Prod   run `npm run start` instead of `npm run dev`
#   -Stop   kill whatever is listening on the port and exit
#   -Port   override the port (default 3000)
param(
    [switch]$Prod,
    [switch]$Stop,
    [int]$Port = 3000
)
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$dashboard = Join-Path $repoRoot "dashboard"
$url = "http://localhost:$Port"

if ($Stop) {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force
        Write-Host "Stopped server on port $Port (pid $($conn.OwningProcess))."
    } else {
        Write-Host "No server listening on port $Port."
    }
    exit 0
}

function Test-Server {
    try {
        $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        return $res.StatusCode -eq 200
    } catch {
        return $false
    }
}

if (-not (Test-Path (Join-Path $dashboard "node_modules"))) {
    Write-Host "First run: installing dashboard dependencies..."
    Push-Location $dashboard
    npm install
    Pop-Location
}

if (Test-Server) {
    Write-Host "Server already running on port $Port; reusing it."
} else {
    $script = if ($Prod) { "start" } else { "dev" }
    Write-Host "Starting Agentic OS ($script) on port $Port..."
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "set PORT=$Port&& npm run $script" `
        -WorkingDirectory $dashboard `
        -WindowStyle Minimized
    $deadline = (Get-Date).AddSeconds(60)
    while (-not (Test-Server)) {
        if ((Get-Date) -gt $deadline) {
            Write-Error "Server did not answer on $url within 60s. Check the minimized terminal window."
            exit 1
        }
        Start-Sleep -Seconds 1
    }
    Write-Host "Server is up."
}

# Prefer an app-frame window (no tabs, own taskbar entry); fall back to the
# default browser if neither Edge nor Chrome resolves.
foreach ($browser in "msedge.exe", "chrome.exe") {
    try {
        Start-Process -FilePath $browser -ArgumentList "--app=$url"
        exit 0
    } catch {
        continue
    }
}
Start-Process $url
