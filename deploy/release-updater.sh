#!/usr/bin/env bash
set -Eeuo pipefail

REPOSITORY="hujinghaoabcd/lab-safety-access"
ARTIFACT_BRANCH="deploy-artifacts"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/lab-safety-access}"
CACHE_ROOT="${CACHE_ROOT:-/var/cache/lab-safety-release}"
RAW_BASE="https://raw.githubusercontent.com/${REPOSITORY}/${ARTIFACT_BRANCH}"
BUNDLE_NAME="lab-safety-production.tar.gz"
CURRENT_FILE="${DEPLOY_PATH}/.current-image-tag"

log() { printf '[lab-safety-update] %s\n' "$*"; }
fail() { log "ERROR: $*"; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Run this updater as root."
command -v curl >/dev/null || fail "curl is required."
command -v docker >/dev/null || fail "Docker is required."
command -v flock >/dev/null || fail "flock is required."
command -v sha256sum >/dev/null || fail "sha256sum is required."

install -d -m 755 /run/lock "$CACHE_ROOT"
exec 9>/run/lock/lab-safety-release.lock
flock -n 9 || exit 0

install -d -m 755 "$DEPLOY_PATH"
[ -f "$DEPLOY_PATH/.env" ] || fail "$DEPLOY_PATH/.env is missing."

cache_bust="$(date +%s)"
new_tag="$(curl -fsSL --connect-timeout 15 --max-time 60 \
  --retry 4 --retry-delay 3 --retry-all-errors \
  "${RAW_BASE}/release-sha.txt?t=${cache_bust}" 2>/dev/null || true)"
new_tag="$(printf '%s' "$new_tag" | tr -d '[:space:]')"
[ -n "$new_tag" ] || { log "No chunked production deployment is published yet."; exit 0; }
[[ "$new_tag" =~ ^[0-9a-f]{40}$ ]] || fail "Invalid deployment SHA."

old_tag="$(cat "$CURRENT_FILE" 2>/dev/null || true)"
[ "$new_tag" != "$old_tag" ] || { log "Release ${new_tag:0:12} is already active."; exit 0; }

workdir="${CACHE_ROOT}/${new_tag}"
install -d -m 700 "$workdir"
cd "$workdir"

fetch_small() {
  local name="$1"
  curl -fsSL --connect-timeout 15 --max-time 120 \
    --retry 5 --retry-delay 3 --retry-all-errors \
    "${RAW_BASE}/${name}?v=${new_tag}" \
    -o "${name}.tmp"
  mv "${name}.tmp" "$name"
}

log "Reading deployment manifest for ${new_tag:0:12}"
fetch_small chunks.sha256
fetch_small bundle.sha256
fetch_small manifest.env

mapfile -t chunks < <(awk '{print $2}' chunks.sha256)
[ "${#chunks[@]}" -gt 0 ] || fail "The deployment manifest contains no chunks."

for chunk in "${chunks[@]}"; do
  [[ "$chunk" =~ ^lab-safety-production\.part-[0-9]{4}$ ]] || \
    fail "Unsafe chunk name in manifest: $chunk"
done

index=0
for chunk in "${chunks[@]}"; do
  index=$((index + 1))
  if grep -F "  ${chunk}" chunks.sha256 | sha256sum -c - >/dev/null 2>&1; then
    log "Chunk ${index}/${#chunks[@]} already verified"
    continue
  fi

  log "Downloading chunk ${index}/${#chunks[@]}"
  curl -fL --silent --show-error \
    --connect-timeout 15 --max-time 900 \
    --retry 8 --retry-delay 5 --retry-all-errors \
    --continue-at - \
    "${RAW_BASE}/${chunk}?v=${new_tag}" \
    -o "$chunk"

  grep -F "  ${chunk}" chunks.sha256 | sha256sum -c - >/dev/null || \
    fail "Checksum failed for $chunk"
done

log "Verifying all downloaded chunks"
sha256sum -c chunks.sha256 >/dev/null

rm -f "$BUNDLE_NAME"
for chunk in "${chunks[@]}"; do
  cat "$chunk" >> "$BUNDLE_NAME"
done
sha256sum -c bundle.sha256 >/dev/null || fail "Bundle checksum failed."

rm -rf unpacked
install -d -m 700 unpacked
tar -xzf "$BUNDLE_NAME" -C unpacked
[ "$(tr -d '[:space:]' < unpacked/release-sha.txt)" = "$new_tag" ] || \
  fail "Deployment metadata mismatch."

log "Loading verified Docker images"
docker load --input unpacked/images.tar.gz
install -m 644 unpacked/docker-compose.prod.yml "$DEPLOY_PATH/docker-compose.prod.yml"
cd "$DEPLOY_PATH"

start_release() {
  env IMAGE_TAG="$1" docker compose \
    --env-file .env \
    --file docker-compose.prod.yml \
    up -d --no-build --remove-orphans
}

log "Starting release ${new_tag:0:12}"
start_release "$new_tag"

healthy=false
for _ in $(seq 1 36); do
  if curl -fsS --max-time 5 http://127.0.0.1/api/health \
    >/tmp/lab-safety-health.json 2>/dev/null; then
    healthy=true
    break
  fi
  sleep 5
done

if [ "$healthy" != true ]; then
  log "New release failed its health check."
  env IMAGE_TAG="$new_tag" docker compose \
    --env-file .env \
    --file docker-compose.prod.yml \
    logs --tail=200 || true

  if [[ "$old_tag" =~ ^[0-9a-f]{40}$ ]]; then
    log "Rolling back to ${old_tag:0:12}"
    start_release "$old_tag"
  else
    log "No previous healthy release is available for rollback."
  fi
  exit 1
fi

printf '%s\n' "$new_tag" > "$CURRENT_FILE"
chmod 600 "$CURRENT_FILE"
log "Release ${new_tag:0:12} is healthy."

rm -rf "$workdir"
rm -f /tmp/lab-safety-health.json
docker image prune -f >/dev/null 2>&1 || true
