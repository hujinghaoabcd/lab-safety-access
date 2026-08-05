#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

SOURCE_REF="${SOURCE_REF:-main}"
RAW_BASE="https://raw.githubusercontent.com/hujinghaoabcd/lab-safety-access/${SOURCE_REF}"

$SUDO systemctl disable --now lab-safety-update.timer >/dev/null 2>&1 || true
$SUDO systemctl stop lab-safety-update.service >/dev/null 2>&1 || true
$SUDO rm -rf /tmp/lab-safety-release.*

$SUDO curl -fL --retry 5 --retry-delay 3 --retry-all-errors \
  "$RAW_BASE/deploy/release-updater.sh" \
  -o /usr/local/sbin/lab-safety-release-update
$SUDO chmod 755 /usr/local/sbin/lab-safety-release-update

$SUDO tee /etc/systemd/system/lab-safety-update.service >/dev/null <<'EOF'
[Unit]
Description=Update Lab Safety Access from verified GitHub chunks
Wants=network-online.target
After=network-online.target docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/lab-safety-release-update
TimeoutStartSec=45min
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=6
EOF

$SUDO tee /etc/systemd/system/lab-safety-update.timer >/dev/null <<'EOF'
[Unit]
Description=Check for Lab Safety Access deployments periodically

[Timer]
OnBootSec=2min
OnUnitInactiveSec=5min
RandomizedDelaySec=30s
Persistent=true
Unit=lab-safety-update.service

[Install]
WantedBy=timers.target
EOF

$SUDO systemctl daemon-reload
$SUDO systemctl reset-failed lab-safety-update.service >/dev/null 2>&1 || true
$SUDO systemctl enable --now lab-safety-update.timer
$SUDO systemctl start --no-block lab-safety-update.service

printf '\nChunked keyless deployment is installed.\n'
printf 'The first update is running in the background. Follow it with:\n'
printf '  sudo journalctl -fu lab-safety-update.service\n\n'
$SUDO systemctl status lab-safety-update.timer --no-pager || true
$SUDO systemctl list-timers lab-safety-update.timer --no-pager || true
