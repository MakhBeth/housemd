#!/usr/bin/env bash
# Deploys origin/main of HouseMD on ape: build into releases/<sha>, atomic `current` symlink.
# Source: GitHub (no credential prompt), fallback to the local mirror. Caddy is not touched: docs/deploy.md.
set -euo pipefail
export GIT_TERMINAL_PROMPT=0

WORK=""
ROOT="${HOUSEMD_ROOT:-/srv/housemd}"
REPO_URL="${HOUSEMD_REPO_URL:-https://github.com/MakhBeth/housemd.git}"
MIRROR="${HOUSEMD_MIRROR:-/home/agent/work/mirrors/housemd.git}"
REF="${HOUSEMD_REF:-main}"
KEEP="${HOUSEMD_KEEP:-5}"

usage() {
  echo "usage: scripts/deploy.sh [--root DIR]"
  echo "       scripts/deploy.sh --rollback [SHA] [--root DIR]"
}

step() { echo "==> $*"; }

switch_current() {
  ln -sfn "releases/$1" "$ROOT/.current.new"
  mv -T "$ROOT/.current.new" "$ROOT/current"
}

rollback() {
  local target="$1" now
  [ -L "$ROOT/current" ] || { echo "Missing $ROOT/current: nothing to roll back from." >&2; exit 1; }
  now=$(basename "$(readlink "$ROOT/current")")
  if [ -z "$target" ]; then
    target=$(ls -t "$ROOT/releases" | grep -vx "$now" | head -n 1 || true)
    [ -n "$target" ] || { echo "No release older than $now." >&2; exit 1; }
  fi
  [ -d "$ROOT/releases/$target" ] || { echo "No such release: $ROOT/releases/$target" >&2; exit 1; }
  switch_current "$target"
  echo "current -> releases/$target (was $now)."
}

clone_source() {
  local dest="$1" url
  for url in "$REPO_URL" "$MIRROR"; do
    if git clone --quiet --branch "$REF" --depth 1 "$url" "$dest" 2>/dev/null; then
      echo "Source: $url"
      return 0
    fi
    rm -rf "$dest"
    echo "Cannot clone $url, trying the next source." >&2
  done
  echo "No source available (GitHub and mirror failed)." >&2
  return 1
}

main() {
  local rollback_sha="" do_rollback=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --root) ROOT="${2:?--root needs a value}"; shift 2 ;;
      --rollback) do_rollback=1; shift; if [ $# -gt 0 ] && [[ "$1" != -* ]]; then rollback_sha="$1"; shift; fi ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
    esac
  done

  if [ "$do_rollback" -eq 1 ]; then rollback "$rollback_sha"; exit 0; fi

  mkdir -p "$ROOT/releases"
  local sha
  WORK=$(mktemp -d "$ROOT/.build.XXXXXX")
  trap 'rm -rf "$WORK"' EXIT

  step "1/3 Fetching $REF"
  clone_source "$WORK/src"
  sha=$(git -C "$WORK/src" rev-parse --short=12 HEAD)

  if [ -d "$ROOT/releases/$sha" ]; then
    step "2/3 Release $sha already present, skipping the build"
  else
    step "2/3 Building $sha"
    npm --prefix "$WORK/src" ci --no-audit --no-fund
    npm --prefix "$WORK/src" run build
    rm -rf "$ROOT/releases/.$sha.new"
    cp -r "$WORK/src/dist" "$ROOT/releases/.$sha.new"
    mv "$ROOT/releases/.$sha.new" "$ROOT/releases/$sha"
  fi

  step "3/3 current -> releases/$sha"
  local old
  old=$(basename "$(readlink "$ROOT/current" 2>/dev/null || true)")
  switch_current "$sha"
  # keep the newest $KEEP releases, never the live one
  local r
  for r in $(ls -t "$ROOT/releases" | tail -n +"$((KEEP + 1))"); do
    [ "$r" = "$sha" ] || rm -rf "$ROOT/releases/$r"
  done
  echo "Installed $sha. Rollback: scripts/deploy.sh --rollback${old:+ $old}"
}

main "$@"
