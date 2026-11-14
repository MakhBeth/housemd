# Deploy on ape

HouseMD is published at **https://ape.taila31b51.ts.net:8446** (Tailscale only). HTTPS is mandatory: File System Access and the service worker need a secure context. The certificate is the Tailscale one, as for calor.ie (port 8445).

| What | Where |
|---|---|
| Static files | `/srv/housemd/releases/<sha>`, relative symlink `/srv/housemd/current` |
| Caddy block | `deploy/Caddyfile.housemd` |
| Source | `origin/main` on GitHub, fallback to `/home/agent/work/mirrors/housemd.git` |

## First setup (one command, as Davide)

```sh
git clone https://github.com/MakhBeth/housemd.git ~/housemd
~/housemd/scripts/setup-ape.sh
```

It creates `/srv/housemd` and the mirror, backs up Caddy's `Caddyfile` and `compose.yaml`, runs the first deploy, adds the read-only volume and the Caddy block, recreates the container, and checks the URL with `curl`. On any failure it restores the backups.

**Note:** `docker compose up -d caddy` recreates the container: the other sites stop for a few seconds.

## Next releases

```sh
~/housemd/scripts/deploy.sh              # builds origin/main, switches `current` atomically
~/housemd/scripts/deploy.sh --rollback   # back to the previous release (or: --rollback <sha>)
```

Options: `--root DIR` (default `/srv/housemd`). Environment: `HOUSEMD_REPO_URL`, `HOUSEMD_MIRROR`, `HOUSEMD_REF`, `HOUSEMD_KEEP` (releases kept, default 5). No sudo needed, no credential prompt (`GIT_TERMINAL_PROMPT=0`). Caddy needs no reload: it reads `current` at every request.

## Manual Caddy steps (what setup-ape.sh does)

1. In `/srv/caddy/compose.yaml`, under `volumes:` add `- /srv/housemd:/srv/housemd:ro`.
2. Append `deploy/Caddyfile.housemd` to `/srv/caddy/Caddyfile`.
3. `cd /srv/caddy && docker compose up -d caddy`, then `docker exec caddy caddy validate --config /etc/caddy/Caddyfile`.

Validate the block without sudo: `CADDY_BIN=/home/agent/work/caddy-bin/caddy; $CADDY_BIN adapt --config deploy/Caddyfile.housemd`.

## AI bridge

Not deployed on ape. The bridge (`npm run bridge`) accepts only the origins in `ALLOWED_ORIGINS` and talks to the local `claude` CLI, so it stays on the machine of whoever uses it. On the published site the AI features are unavailable until a bridge unit (user `kit`, like calor.ie) is added in a later task.
