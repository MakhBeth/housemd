#!/usr/bin/env bash
# First setup of HouseMD on https://ape.taila31b51.ts.net:8446 (docs/deploy.md).
# Run as Davide, not with sudo: it uses sudo where needed. Backs up Caddy files and restores them on failure.
set -euo pipefail
export GIT_TERMINAL_PROMPT=0

REPO_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CADDY_DIR="${CADDY_DIR:-/srv/caddy}"
BLOCK="$REPO_DIR/deploy/Caddyfile.housemd"
VOLUME='      - /srv/housemd:/srv/housemd:ro'
URL=https://ape.taila31b51.ts.net:8446/

echo "== a. Folders and mirror"
sudo mkdir -p /srv/housemd && sudo chown "$USER:$USER" /srv/housemd
MIRROR=/home/agent/work/mirrors/housemd.git
if [ ! -d "$MIRROR" ]; then
  sudo -u agent git clone --mirror https://github.com/MakhBeth/housemd.git "$MIRROR" || echo "Mirror not created (fallback unavailable)." >&2
fi

echo "== b. Backup"
sudo cp "$CADDY_DIR/Caddyfile" "$CADDY_DIR/Caddyfile.bak-housemd"
sudo cp "$CADDY_DIR/compose.yaml" "$CADDY_DIR/compose.yaml.bak-housemd"

rollback() {
  echo "!! Something went wrong: restoring Caddyfile and compose" >&2
  sudo sh -c "cat '$CADDY_DIR/Caddyfile.bak-housemd' > '$CADDY_DIR/Caddyfile'"
  sudo cp "$CADDY_DIR/compose.yaml.bak-housemd" "$CADDY_DIR/compose.yaml"
  (cd "$CADDY_DIR" && docker compose up -d caddy) || true
  exit 1
}

echo "== c. First deploy"
"$REPO_DIR/scripts/deploy.sh" || rollback

echo "== d. Volume and Caddy block"
if ! grep -q '/srv/housemd:/srv/housemd' "$CADDY_DIR/compose.yaml"; then
  sudo sed -i "\#- /srv/calorie:/srv/calorie:ro#a\\$VOLUME" "$CADDY_DIR/compose.yaml"
fi
grep -q '/srv/housemd:/srv/housemd' "$CADDY_DIR/compose.yaml" || rollback
if ! grep -q ':8446' "$CADDY_DIR/Caddyfile"; then
  # same inode: the file is mounted in the container
  sudo sh -c "printf '\n' >> '$CADDY_DIR/Caddyfile'; cat '$BLOCK' >> '$CADDY_DIR/Caddyfile'"
fi
(cd "$CADDY_DIR" && docker compose up -d caddy) || rollback
docker exec caddy caddy validate --config /etc/caddy/Caddyfile || rollback

echo "== e. Check (the first certificate can take a few seconds)"
sleep 10
curl -fsSI "$URL" | head -n 1 || rollback
curl -fsS "$URL" | grep -qi '<title' || rollback
echo "Done: $URL"
echo "Rollback Caddy: sudo cp $CADDY_DIR/Caddyfile.bak-housemd $CADDY_DIR/Caddyfile && sudo cp $CADDY_DIR/compose.yaml.bak-housemd $CADDY_DIR/compose.yaml && cd $CADDY_DIR && docker compose up -d caddy"
