#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/JoelBondoux/Work-Timer.git"
REPO_DIR="${WORK_TIMER_REPO_DIR:-$HOME/Work-Timer}"
REPO_REF="${WORK_TIMER_REPO_REF:-master}"
SKIP_BUILD="${WORK_TIMER_SKIP_BUILD:-0}"
ALLOW_DIRTY="${WORK_TIMER_ALLOW_DIRTY:-0}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found on PATH: $1" >&2
    exit 1
  fi
}

require_cmd git
require_cmd node
require_cmd npm

backup_existing_dir() {
  local target="$1"
  local parent
  local name
  local stamp
  local backup
  local suffix=0

  parent="$(dirname "$target")"
  name="$(basename "$target")"
  stamp="$(date +%Y%m%d-%H%M%S)"
  backup="$parent/${name}-backup-$stamp"
  while [ -e "$backup" ]; do
    suffix=$((suffix + 1))
    backup="$parent/${name}-backup-$stamp-$suffix"
  done

  cd "$parent"
  mv "$target" "$backup"
  echo "Moved existing folder to backup: $backup"
}

install_dependencies() {
  if [ -f "package-lock.json" ]; then
    echo "Installing dependencies with npm ci..."
    if ! npm ci; then
      local uname_s
      uname_s="$(uname -s 2>/dev/null || echo unknown)"
      case "$uname_s" in
        MINGW*|MSYS*|CYGWIN*)
          echo "npm ci failed on Windows-like shell (possible file lock). Retrying once after clearing node_modules..."
          rm -rf node_modules || true
          sleep 2
          if ! npm ci; then
            echo "npm ci retry failed on Windows-like shell. Falling back to npm install..."
            npm install
          fi
          ;;
        *)
          return 1
          ;;
      esac
    fi
  else
    echo "Installing dependencies with npm install..."
    npm install
  fi
}

echo "Work-Timer installer"
echo "Target directory: $REPO_DIR"
echo "Source ref: $REPO_REF"
EXISTING_INSTALL=0

if [ -d "$REPO_DIR" ]; then
  if [ -d "$REPO_DIR/.git" ]; then
    cd "$REPO_DIR"
    ORIGIN_URL="$(git remote get-url origin 2>/dev/null || true)"
    if [[ -n "$ORIGIN_URL" && "$ORIGIN_URL" == *"JoelBondoux/Work-Timer"* ]]; then
      EXISTING_INSTALL=1
      if [[ "$ALLOW_DIRTY" != "1" && -n "$(git status --porcelain)" ]]; then
        echo "Existing Work-Timer installation has uncommitted changes: $REPO_DIR" >&2
        echo "Clean/stash changes first, or rerun with WORK_TIMER_ALLOW_DIRTY=1 to proceed." >&2
        exit 1
      fi
    else
      echo "Target folder exists but is not a Work-Timer installation. Backing it up before install..."
      backup_existing_dir "$REPO_DIR"
    fi
  else
    echo "Target folder exists but is not a Git Work-Timer installation. Backing it up before install..."
    backup_existing_dir "$REPO_DIR"
  fi
fi

if [ "$EXISTING_INSTALL" = "1" ]; then
  echo "Existing install repository detected. Updating..."
  git fetch origin "$REPO_REF" --tags
  git checkout "$REPO_REF"
  git pull --ff-only origin "$REPO_REF"
else
  echo "No existing Work-Timer install detected. Cloning into target directory..."
  git clone --branch "$REPO_REF" --single-branch "$REPO_URL" "$REPO_DIR"
  cd "$REPO_DIR"
fi

install_dependencies

if [ "$SKIP_BUILD" != "1" ]; then
  echo "Building project..."
  npm run build
else
  echo "Skipping build (requested)."
fi

if [ "${WORK_TIMER_SKIP_LINK:-0}" != "1" ]; then
  echo "Linking work-timer globally..."
  npm link
fi

echo
echo "Installation complete."
echo "Run: work-timer setup"
echo "Optional MCP setup: work-timer mcp install --dry-run"
echo "Then run: work-timer mcp install --create-missing"
