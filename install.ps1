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
      & npm ci
      if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed (exit code: $LASTEXITCODE)"
      }
    } catch {
      if (($env:OS -eq "Windows_NT") -and (Test-Path "node_modules")) {
        Write-Host "npm ci failed on Windows (possible file lock). Retrying once after clearing node_modules..."
        $attempt = 0
        while ((Test-Path "node_modules") -and ($attempt -lt 3)) {
          Remove-Item "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
          if (Test-Path "node_modules") {
            cmd /c rmdir /s /q "node_modules" 2>$null
          }
          if (-not (Test-Path "node_modules")) {
            break
          }
          $attempt += 1
          Start-Sleep -Seconds 2
        }

        Start-Sleep -Seconds 2
        & npm ci
        if ($LASTEXITCODE -ne 0) {
          Write-Host "npm ci retry failed on Windows. Falling back to npm install..."
          & npm install
          if ($LASTEXITCODE -ne 0) {
            throw "npm install fallback failed (exit code: $LASTEXITCODE)"
          }
        }
      } else {
        throw
      }
    }
  } else {
    Write-Host "Installing dependencies with npm install..."
    & npm install
    if ($LASTEXITCODE -ne 0) {
      throw "npm install failed (exit code: $LASTEXITCODE)"
    }
  }
}

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found on PATH: $Name"
  }
}

function Ensure-GitCommand() {
  if (Get-Command git -ErrorAction SilentlyContinue) {
    return
  }

  if ($env:OS -eq "Windows_NT") {
    $candidates = @(
      "C:\Program Files\Git\cmd\git.exe",
      "C:\Program Files\Git\bin\git.exe",
      "C:\Program Files (x86)\Git\cmd\git.exe",
      "C:\Program Files (x86)\Git\bin\git.exe"
    )

    foreach ($candidate in $candidates) {
      if (Test-Path $candidate) {
        Set-Alias -Name git -Value $candidate -Scope Script
        $gitDir = Split-Path -Parent $candidate
        if ($env:Path -notlike "*$gitDir*") {
          $env:Path = "$gitDir;$env:Path"
        }
        Write-Host "Git found at $candidate"
        return
      }
    }
  }

  throw "Required command not found on PATH: git. Install Git from https://git-scm.com/downloads and retry."
}

function Move-ToBackup([string]$Path) {
  $parent = Split-Path -Parent $Path
  $name = Split-Path -Leaf $Path
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupPath = Join-Path $parent "$name-backup-$stamp"
  $suffix = 0
  while (Test-Path $backupPath) {
    $suffix += 1
    $backupPath = Join-Path $parent "$name-backup-$stamp-$suffix"
  }

  Set-Location $parent
  Move-Item -Path $Path -Destination $backupPath
  Write-Host "Moved existing folder to backup: $backupPath"
}

function Get-PackageVersionFromFile([string]$Path) {
  if (-not (Test-Path $Path)) {
    return $null
  }

  try {
    $raw = Get-Content -Path $Path -Raw -Encoding UTF8
    $obj = $raw | ConvertFrom-Json
    return [string]$obj.version
  } catch {
    return $null
  }
}

function Get-PackageVersionFromGitRef([string]$GitRef) {
  try {
    $raw = git show "$GitRef`:package.json" 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $raw) {
      return $null
    }
    $obj = ($raw | Out-String) | ConvertFrom-Json
    return [string]$obj.version
  } catch {
    return $null
  }
}

function Confirm-RepairOrCancel([string]$Version) {
  $mode = [string]$env:WORK_TIMER_REPAIR_MODE
  if (-not $mode) {
    $mode = ''
  }
  $mode = $mode.Trim().ToLowerInvariant()
  if ($mode -eq 'repair') {
    Write-Host "Same version detected. Proceeding with repair mode (WORK_TIMER_REPAIR_MODE=repair)."
    return $true
  }
  if ($mode -eq 'cancel') {
    Write-Host "Same version detected. Cancelling (WORK_TIMER_REPAIR_MODE=cancel)."
    return $false
  }

  $interactive = $true
  try { $null = $Host.UI.RawUI } catch { $interactive = $false }
  if (-not $interactive -or [Console]::IsInputRedirected -or [Console]::IsOutputRedirected) {
    Write-Host "Same version ($Version) is already installed."
    Write-Host "Set WORK_TIMER_REPAIR_MODE=repair to continue with repair, or WORK_TIMER_REPAIR_MODE=cancel to skip."
    return $false
  }

  $answer = (Read-Host "Same version ($Version) is already installed. Repair this installation or cancel? [r/C]").Trim().ToLowerInvariant()
  return ($answer -eq 'r' -or $answer -eq 'repair')
}

function Get-MeaningfulDirtyStatus() {
  # Ignore generated dist artifacts; block only meaningful tracked changes.
  try {
    $dirty = git status --porcelain --untracked-files=no -- . ":(exclude)dist" 2>$null
    if ($LASTEXITCODE -ne 0) {
      return $null
    }
    return $dirty
  } catch {
    return $null
  }
}

function Get-DistDirtyStatus() {
  try {
    $dirty = git status --porcelain --untracked-files=no -- dist 2>$null
    if ($LASTEXITCODE -ne 0) {
      return $null
    }
    return $dirty
  } catch {
    return $null
  }
}

function Get-GitBranchName() {
  try {
    $branch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
    if ($LASTEXITCODE -eq 0 -and $branch) {
      return $branch
    }
  } catch {
    # Ignore and fall back.
  }
  return '<unknown>'
}

function Get-DirtyPreview([string]$DirtyStatus, [int]$MaxLines = 5) {
  if (-not $DirtyStatus) {
    return '  (none)'
  }

  $lines = @($DirtyStatus -split "`r?`n" | Where-Object { $_ -and $_.Trim().Length -gt 0 })
  if ($lines.Count -eq 0) {
    return '  (none)'
  }

  $shown = $lines | Select-Object -First $MaxLines | ForEach-Object {
    $line = $_.TrimEnd()
    if ($line.Length -ge 4) {
      "  - $($line.Substring(3).Trim())"
    } else {
      "  - $line"
    }
  }

  if ($lines.Count -gt $MaxLines) {
    $shown += "  - ...and $($lines.Count - $MaxLines) more"
  }

  return ($shown -join "`n")
}

function Resolve-DistOnlyDirtyBeforePull([string]$Path) {
  $meaningfulDirty = Get-MeaningfulDirtyStatus
  if ($meaningfulDirty) {
    return
  }

  $distDirty = Get-DistDirtyStatus
  if ($distDirty) {
    Write-Host "Found generated dist/ changes from a prior local build. Resetting dist/ to avoid pull conflicts..."
    Invoke-External -Command "git" -CommandArgs @("checkout", "--", "dist") -FailureMessage "failed to reset dist before pull"
  }
}

Ensure-GitCommand
Assert-Command node
Assert-Command npm

Write-Host "Work-Timer installer"
Write-Host "Target directory: $RepoDir"
Write-Host "Source ref: $RepoRef"

$installDir = $RepoDir
$existingInstall = $false

if (Test-Path $RepoDir) {
  if (Test-Path (Join-Path $RepoDir ".git")) {
    Set-Location $RepoDir
    $origin = (git remote get-url origin 2>$null).Trim()
    if ($origin -and $origin -match "JoelBondoux/Work-Timer") {
      $existingInstall = $true
      if (-not $AllowDirty) {
        $dirty = Get-MeaningfulDirtyStatus
        if ($dirty) {
          $branch = Get-GitBranchName
          $preview = Get-DirtyPreview -DirtyStatus $dirty -MaxLines 5
          throw "Existing Work-Timer installation has uncommitted changes: $RepoDir.`nBranch: $branch`nBlocking files (first 5):`n$preview`nClean/stash changes first, or rerun with WORK_TIMER_ALLOW_DIRTY=1 to proceed."
        }
      }
    } else {
      Write-Host "Target folder exists but is not a Work-Timer installation. Backing it up before install..."
      Move-ToBackup -Path $RepoDir
    }
  } else {
    Write-Host "Target folder exists but is not a Git Work-Timer installation. Backing it up before install..."
    Move-ToBackup -Path $RepoDir
  }
}

if ($existingInstall) {
  Write-Host "Existing install repository detected. Updating..."
  Invoke-External -Command "git" -CommandArgs @("fetch", "origin", $RepoRef, "--tags") -FailureMessage "git fetch failed"
  Invoke-External -Command "git" -CommandArgs @("checkout", $RepoRef) -FailureMessage "git checkout failed"

  $currentVersion = Get-PackageVersionFromFile (Join-Path $installDir "package.json")
  $targetVersion = Get-PackageVersionFromGitRef "origin/$RepoRef"
  if ($currentVersion -and $targetVersion -and $currentVersion -eq $targetVersion) {
    if (-not (Confirm-RepairOrCancel -Version $currentVersion)) {
      Write-Host "Installation cancelled."
      exit 0
    }
    Write-Host "Proceeding with repair for version $currentVersion..."
  }

  if (-not $AllowDirty) {
    Resolve-DistOnlyDirtyBeforePull -Path $installDir
  }

  Invoke-External -Command "git" -CommandArgs @("pull", "--ff-only", "origin", $RepoRef) -FailureMessage "git pull failed"
} else {
  Write-Host "No existing Work-Timer install detected. Cloning into target directory..."
  Invoke-External -Command "git" -CommandArgs @("clone", "--branch", $RepoRef, "--single-branch", $RepoUrl, $installDir) -FailureMessage "git clone failed"
  Set-Location $installDir
}

Install-Dependencies

if (-not $SkipBuild) {
  Write-Host "Building project..."
  & npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "npm run build failed (exit code: $LASTEXITCODE)"
  }
} else {
  Write-Host "Skipping build (requested)."
}

if (-not $SkipLink) {
  Write-Host "Linking work-timer globally..."
  & npm link
  if ($LASTEXITCODE -ne 0) {
    throw "npm link failed (exit code: $LASTEXITCODE)"
  }
}

Write-Host ""
Write-Host "Installation complete."
Write-Host "Run: work-timer setup"
Write-Host "Optional MCP setup: work-timer mcp install --dry-run"
Write-Host "Then run: work-timer mcp install --create-missing"
