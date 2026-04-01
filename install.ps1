param(
  [string]$RepoDir = $(if ($env:WORK_TIMER_REPO_DIR) { $env:WORK_TIMER_REPO_DIR } else { Join-Path $HOME "Work-Timer" }),
  [string]$RepoRef = $(if ($env:WORK_TIMER_REPO_REF) { $env:WORK_TIMER_REPO_REF } else { "master" }),
  [switch]$SkipBuild = $($env:WORK_TIMER_SKIP_BUILD -eq "1"),
  [switch]$AllowDirty = $($env:WORK_TIMER_ALLOW_DIRTY -eq "1"),
  [switch]$SkipLink = $($env:WORK_TIMER_SKIP_LINK -eq "1")
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/JoelBondoux/Work-Timer.git"

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found on PATH: $Name"
  }
}

Assert-Command git
Assert-Command node
Assert-Command npm

Write-Host "Work-Timer installer"
Write-Host "Target directory: $RepoDir"
Write-Host "Source ref: $RepoRef"

$installDir = $RepoDir

if (Test-Path $RepoDir) {
  if (-not (Test-Path (Join-Path $RepoDir ".git"))) {
    throw "Directory exists but is not a Git repository: $RepoDir"
  }

  Set-Location $RepoDir
  $origin = (git remote get-url origin 2>$null).Trim()
  if (-not $origin -or $origin -notmatch "JoelBondoux/Work-Timer") {
    throw "Existing repository does not look like Work-Timer origin: $origin"
  }

  $dirty = (git status --porcelain 2>$null)
  if ($dirty -and -not $AllowDirty) {
    $installDir = "$RepoDir-installer"
    Write-Host "Detected uncommitted changes in $RepoDir"
    Write-Host "Keeping that folder untouched and using a clean install folder: $installDir"
  }
}

if (Test-Path $installDir) {
  if (-not (Test-Path (Join-Path $installDir ".git"))) {
    throw "Install directory exists but is not a Git repository: $installDir"
  }

  Set-Location $installDir
  $installOrigin = (git remote get-url origin 2>$null).Trim()
  if (-not $installOrigin -or $installOrigin -notmatch "JoelBondoux/Work-Timer") {
    throw "Install directory does not look like Work-Timer origin: $installOrigin"
  }

  Write-Host "Existing install repository detected. Updating..."
  git fetch origin $RepoRef --tags
  git checkout $RepoRef
  git pull --ff-only origin $RepoRef
} else {
  Write-Host "No install repository detected. Cloning..."
  git clone --branch $RepoRef --single-branch $RepoUrl $installDir
  Set-Location $installDir
}

if (Test-Path "package-lock.json") {
  Write-Host "Installing dependencies with npm ci..."
  npm ci
} else {
  Write-Host "Installing dependencies with npm install..."
  npm install
}

if (-not $SkipBuild) {
  Write-Host "Building project..."
  npm run build
} else {
  Write-Host "Skipping build (requested)."
}

if (-not $SkipLink) {
  Write-Host "Linking work-timer globally..."
  npm link
}

Write-Host ""
Write-Host "Installation complete."
Write-Host "Run: work-timer setup"
Write-Host "Optional MCP setup: work-timer mcp install --dry-run"
Write-Host "Then run: work-timer mcp install --create-missing"
