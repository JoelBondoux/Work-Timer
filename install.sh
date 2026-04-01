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
          npm ci
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

INSTALL_DIR="$REPO_DIR"

if [ -d "$REPO_DIR" ]; then
  if [ ! -d "$REPO_DIR/.git" ]; then
    echo "Directory exists but is not a Git repository: $REPO_DIR" >&2
    exit 1
  fi

  cd "$REPO_DIR"
  ORIGIN_URL="$(git remote get-url origin 2>/dev/null || true)"
  if [[ -z "$ORIGIN_URL" || "$ORIGIN_URL" != *"JoelBondoux/Work-Timer"* ]]; then
    echo "Existing repository does not look like Work-Timer origin: $ORIGIN_URL" >&2
    exit 1
  fi

  if [[ "$ALLOW_DIRTY" != "1" && -n "$(git status --porcelain)" ]]; then
    INSTALL_DIR="${REPO_DIR}-installer"
    echo "Detected uncommitted changes in $REPO_DIR"
    echo "Keeping that folder untouched and using a clean install folder: $INSTALL_DIR"
  fi
fi

if [ -d "$INSTALL_DIR" ]; then
  if [ ! -d "$INSTALL_DIR/.git" ]; then
    echo "Install directory exists but is not a Git repository: $INSTALL_DIR" >&2
    exit 1
  fi

  cd "$INSTALL_DIR"
  INSTALL_ORIGIN_URL="$(git remote get-url origin 2>/dev/null || true)"
  if [[ -z "$INSTALL_ORIGIN_URL" || "$INSTALL_ORIGIN_URL" != *"JoelBondoux/Work-Timer"* ]]; then
    echo "Install directory does not look like Work-Timer origin: $INSTALL_ORIGIN_URL" >&2
    exit 1
  fi

  if [[ "$ALLOW_DIRTY" != "1" && -n "$(git status --porcelain)" ]]; then
    if [[ "$INSTALL_DIR" != "$REPO_DIR" ]]; then
      echo "Detected uncommitted changes in installer directory. Resetting it to a clean state..."
      git reset --hard HEAD
      git clean -fd
    else
      echo "Install directory has uncommitted changes: $INSTALL_DIR" >&2
      echo "Clean it manually or rerun with WORK_TIMER_ALLOW_DIRTY=1 if you intentionally want to keep local edits." >&2
      exit 1
    fi
  fi

  echo "Existing install repository detected. Updating..."
  git fetch origin "$REPO_REF" --tags
  git checkout "$REPO_REF"
  git pull --ff-only origin "$REPO_REF"
else
  echo "No install repository detected. Cloning..."
  git clone --branch "$REPO_REF" --single-branch "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
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
