#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

SOURCE_REF="${SOURCE_REF:-main}"
RAW_BASE="https://raw.githubusercontent.com/hujinghaoabcd/lab-safety-access/${SOURCE_REF}"

$SUDO curl -fL --retry 5 --retry-all-errors \
  "$RAW_BASE/deploy/release-updater.sh" \
  -o /usr/local/sbin/lab-safety-release-update
$SUDO chmod 755 /usr/local/sbin/lab-safety-release-update

$SUDO tee /etc/systemd/system/lab-safety-update.service >/dev/null <<'EOF'
[Unit]
Description=Update Lab Safety Access from the latest verified GitHub release
Wants=network-online.target
After=network-online.target docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/lab-safety-release-update
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=6
EOF

$SUDO tee /etc/systemd/system/lab-safety-update.timer >/dev/null <<'EOF'
[Unit]
Description=Check for Lab Safety Access releases periodically

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
RandomizedDelaySec=30s
Persistent=true
Unit=lab-safety-update.service

[Install]
WantedBy=timers.target
EOF

$SUDO systemctl daemon-reload
$SUDO systemctl enable --now lab-safety-update.timer
$SUDO systemctl start lab-safety-update.service || true

printf '\nKeyless pull deployment is installed.\n'
$SUDO systemctl status lab-safety-update.timer --no-pager || true
$SUDO systemctl list-timers lab-safety-update.timer --no-pager || true
