#!/usr/bin/env bash
set -Eeuo pipefail

REPOSITORY="hujinghaoabcd/lab-safety-access"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/lab-safety-access}"
DOWNLOAD_BASE="https://github.com/${REPOSITORY}/releases/latest/download"
BUNDLE_NAME="lab-safety-production.tar.gz"
CHECKSUM_NAME="${BUNDLE_NAME}.sha256"
CURRENT_FILE="${DEPLOY_PATH}/.current-image-tag"

log() { printf '[lab-safety-update] %s\n' "$*"; }
fail() { log "ERROR: $*"; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Run this updater as root."
command -v curl >/dev/null || fail "curl is required."
command -v docker >/dev/null || fail "Docker is required."
command -v flock >/dev/null || fail "flock is required."

install -d -m 755 /run/lock
exec 9>/run/lock/lab-safety-release.lock
flock -n 9 || exit 0

install -d -m 755 "$DEPLOY_PATH"
[ -f "$DEPLOY_PATH/.env" ] || fail "$DEPLOY_PATH/.env is missing."

new_tag="$(curl -fsSL --connect-timeout 15 --max-time 60 --retry 4 --retry-all-errors "$DOWNLOAD_BASE/release-sha.txt" 2>/dev/null || true)"
new_tag="$(printf '%s' "$new_tag" | tr -d '[:space:]')"
[ -n "$new_tag" ] || { log "No production release is published yet."; exit 0; }
[[ "$new_tag" =~ ^[0-9a-f]{40}$ ]] || fail "Invalid release SHA."
old_tag="$(cat "$CURRENT_FILE" 2>/dev/null || true)"
[ "$new_tag" != "$old_tag" ] || { log "Release ${new_tag:0:12} is already active."; exit 0; }

workdir="$(mktemp -d /tmp/lab-safety-release.XXXXXX)"
trap 'rm -rf "$workdir"' EXIT
cd "$workdir"

log "Downloading production release ${new_tag:0:12}"
curl -fL --connect-timeout 15 --max-time 1800 --retry 5 --retry-delay 5 --retry-all-errors "$DOWNLOAD_BASE/$BUNDLE_NAME" -o "$BUNDLE_NAME"
curl -fL --connect-timeout 15 --max-time 120 --retry 5 --retry-delay 3 --retry-all-errors "$DOWNLOAD_BASE/$CHECKSUM_NAME" -o "$CHECKSUM_NAME"
sha256sum -c "$CHECKSUM_NAME"
tar -xzf "$BUNDLE_NAME"
[ "$(tr -d '[:space:]' < release-sha.txt)" = "$new_tag" ] || fail "Release metadata mismatch."

docker load --input images.tar.gz
install -m 644 docker-compose.prod.yml "$DEPLOY_PATH/docker-compose.prod.yml"
cd "$DEPLOY_PATH"

start_release() {
  env IMAGE_TAG="$1" docker compose --env-file .env --file docker-compose.prod.yml up -d --no-build --remove-orphans
}

start_release "$new_tag"
healthy=false
for _ in $(seq 1 36); do
  if curl -fsS --max-time 5 http://127.0.0.1/api/health >/tmp/lab-safety-health.json 2>/dev/null; then
    healthy=true
    break
  fi
  sleep 5
done

if [ "$healthy" != true ]; then
  log "New release failed its health check."
  env IMAGE_TAG="$new_tag" docker compose --env-file .env --file docker-compose.prod.yml logs --tail=200 || true
  if [[ "$old_tag" =~ ^[0-9a-f]{40}$ ]]; then
    log "Rolling back to ${old_tag:0:12}"
    start_release "$old_tag"
  fi
  exit 1
fi

printf '%s\n' "$new_tag" > "$CURRENT_FILE"
chmod 600 "$CURRENT_FILE"
log "Release ${new_tag:0:12} is healthy."

docker image prune -f >/dev/null 2>&1 || true
