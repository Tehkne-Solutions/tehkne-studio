param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$HardwareId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error "AF001L_TARGET_HARDWARE_PREFLIGHT BLOCKED · $Message"
  exit 1
}

function Pass([string]$Message) {
  Write-Host "PASS · $Message"
}

if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
  Fail "This preflight is intended for Windows physical target hardware."
}

if ([string]::IsNullOrWhiteSpace($HardwareId)) {
  Fail "HardwareId is required."
}
Pass "hardware_id=$HardwareId"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail "Node.js was not found in PATH." }
$nodeVersion = (& node --version).Trim()
Pass "Node.js $nodeVersion"

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) { Fail "npm was not found in PATH." }
$npmVersion = (& npm --version).Trim()
Pass "npm $npmVersion"

$packagePath = Join-Path (Get-Location) "package.json"
if (-not (Test-Path $packagePath)) {
  Fail "Run this script from the tehkne-studio repository root. package.json was not found."
}

$chromeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { $_ -and (Test-Path $_) }

if ($chromeCandidates.Count -eq 0) {
  Fail "Google Chrome was not found. AF-001L requires a headful Chromium-class browser on the physical machine."
}
Pass "Chrome=$($chromeCandidates[0])"

$gpus = @(Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion, AdapterRAM, PNPDeviceID)
if ($gpus.Count -eq 0) {
  Fail "No Win32_VideoController was reported."
}

$softwareMarkers = @(
  "microsoft basic render",
  "basic display",
  "swiftshader",
  "llvmpipe",
  "softpipe",
  "software renderer",
  "lavapipe"
)

$hardwareGpuFound = $false
foreach ($gpu in $gpus) {
  $name = [string]$gpu.Name
  Write-Host "GPU · $name · driver=$($gpu.DriverVersion)"
  $lower = $name.ToLowerInvariant()
  $software = $false
  foreach ($marker in $softwareMarkers) {
    if ($lower.Contains($marker)) {
      $software = $true
      Write-Warning "Rejected GPU candidate because it matches software/basic renderer marker '$marker': $name"
      break
    }
  }
  if (-not $software) { $hardwareGpuFound = $true }
}

if (-not $hardwareGpuFound) {
  Fail "No acceptable physical GPU candidate was detected."
}
Pass "physical GPU candidate detected"

$sessionName = $env:SESSIONNAME
if ([string]::IsNullOrWhiteSpace($sessionName)) {
  Write-Warning "SESSIONNAME is unavailable. Before AF-001L, ensure the runner is started interactively with run.cmd."
} else {
  Pass "interactive session hint SESSIONNAME=$sessionName"
}

if ($env:GITHUB_ACTIONS -eq "true") {
  if ($env:AF001L_RUNNER_CONTEXT -ne "self-hosted:tehkne-af001l") {
    Fail "GitHub Actions context is not the required self-hosted:tehkne-af001l runner."
  }
  Pass "runner context self-hosted:tehkne-af001l"
}

Write-Host ""
Write-Host "AF001L_TARGET_HARDWARE_PREFLIGHT PASS"
Write-Host "Next: configure the GitHub self-hosted runner with label 'tehkne-af001l', keep it interactive via run.cmd, then dispatch AF-001L with PHYSICAL_HARDWARE_CONFIRMED."
Write-Host "Tehkné Solutions"
