param(
  [string]$RepoDir = $(if ($env:WORK_TIMER_REPO_DIR) { $env:WORK_TIMER_REPO_DIR } else { Join-Path $HOME "Work-Timer" }),
  [string]$RepoRef = $(if ($env:WORK_TIMER_REPO_REF) { $env:WORK_TIMER_REPO_REF } else { "master" }),
  [switch]$SkipBuild = $($env:WORK_TIMER_SKIP_BUILD -eq "1"),
  [switch]$AllowDirty = $($env:WORK_TIMER_ALLOW_DIRTY -eq "1"),
  [switch]$SkipLink = $($env:WORK_TIMER_SKIP_LINK -eq "1")
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/JoelBondoux/Work-Timer.git"

function Invoke-External {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $false)][string[]]$CommandArgs = @(),
    [Parameter(Mandatory = $true)][string]$FailureMessage
  )

  & $Command @CommandArgs
  if ($LASTEXITCODE -ne 0) {
    throw "$FailureMessage (exit code: $LASTEXITCODE)"
  }
}

function Install-Dependencies {
  if (Test-Path "package-lock.json") {
    Write-Host "Installing dependencies with npm ci..."
    try {
      Invoke-External -Command "npm" -CommandArgs @("ci") -FailureMessage "npm ci failed"
    } catch {
      if (($env:OS -eq "Windows_NT") -and (Test-Path "node_modules")) {
        Write-Host "npm ci failed on Windows (possible file lock). Retrying once after clearing node_modules..."
        Remove-Item "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Invoke-External -Command "npm" -CommandArgs @("ci") -FailureMessage "npm ci retry failed"
      } else {
        throw
      }
    }
  } else {
    Write-Host "Installing dependencies with npm install..."
    Invoke-External -Command "npm" -CommandArgs @("install") -FailureMessage "npm install failed"
  }
}

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

  $isDedicatedInstallerDir = $installDir -ne $RepoDir
  if (-not $AllowDirty) {
    $installDirty = (git status --porcelain 2>$null)
    if ($installDirty) {
      if ($isDedicatedInstallerDir) {
        Write-Host "Detected uncommitted changes in installer directory. Resetting it to a clean state..."
        Invoke-External -Command "git" -CommandArgs @("reset", "--hard", "HEAD") -FailureMessage "git reset failed"
        Invoke-External -Command "git" -CommandArgs @("clean", "-fd") -FailureMessage "git clean failed"
      } else {
        throw "Install directory has uncommitted changes: $installDir. Clean it manually or rerun with WORK_TIMER_ALLOW_DIRTY=1 if you intentionally want to keep local edits."
      }
    }
  }

  Write-Host "Existing install repository detected. Updating..."
  Invoke-External -Command "git" -CommandArgs @("fetch", "origin", $RepoRef, "--tags") -FailureMessage "git fetch failed"
  Invoke-External -Command "git" -CommandArgs @("checkout", $RepoRef) -FailureMessage "git checkout failed"
  Invoke-External -Command "git" -CommandArgs @("pull", "--ff-only", "origin", $RepoRef) -FailureMessage "git pull failed"
} else {
  Write-Host "No install repository detected. Cloning..."
  Invoke-External -Command "git" -CommandArgs @("clone", "--branch", $RepoRef, "--single-branch", $RepoUrl, $installDir) -FailureMessage "git clone failed"
  Set-Location $installDir
}

Install-Dependencies

if (-not $SkipBuild) {
  Write-Host "Building project..."
  Invoke-External -Command "npm" -CommandArgs @("run", "build") -FailureMessage "npm run build failed"
} else {
  Write-Host "Skipping build (requested)."
}

if (-not $SkipLink) {
  Write-Host "Linking work-timer globally..."
  Invoke-External -Command "npm" -CommandArgs @("link") -FailureMessage "npm link failed"
}

Write-Host ""
Write-Host "Installation complete."
Write-Host "Run: work-timer setup"
Write-Host "Optional MCP setup: work-timer mcp install --dry-run"
Write-Host "Then run: work-timer mcp install --create-missing"
