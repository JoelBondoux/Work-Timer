#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/JoelBondoux/Work-Timer.git"
REPO_DIR="${WORK_TIMER_REPO_DIR:-$HOME/Work-Timer}"
REPO_REF="${WORK_TIMER_REPO_REF:-master}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found on PATH: $1" >&2
    exit 1
  fi
}

require_cmd git
require_cmd node
require_cmd npm

echo "Work-Timer installer"
echo "Target directory: $REPO_DIR"
echo "Source ref: $REPO_REF"

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

  echo "Existing repository detected. Updating..."
  git fetch origin "$REPO_REF" --tags
  git checkout "$REPO_REF"
  git pull --ff-only origin "$REPO_REF"
else
  echo "No local repository detected. Cloning..."
  git clone --branch "$REPO_REF" --single-branch "$REPO_URL" "$REPO_DIR"
  cd "$REPO_DIR"
fi

if [ -f "package-lock.json" ]; then
  echo "Installing dependencies with npm ci..."
  npm ci
else
  echo "Installing dependencies with npm install..."
  npm install
fi

echo "Building project..."
npm run build

if [ "${WORK_TIMER_SKIP_LINK:-0}" != "1" ]; then
  echo "Linking work-timer globally..."
  npm link
fi

echo
echo "Installation complete."
echo "Run: work-timer setup"
echo "Optional MCP setup: work-timer mcp install --dry-run"
