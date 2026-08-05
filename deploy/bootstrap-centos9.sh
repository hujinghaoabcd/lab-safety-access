#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

DEPLOY_USER="${SUDO_USER:-${USER}}"
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
DEPLOY_PATH="/opt/lab-safety-access"
DOCKER_REPO="https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo"

say() {
  printf '\n\033[1;34m==> %s\033[0m\n' "$*"
}

fail() {
  printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2
  exit 1
}

require_centos_9() {
  # shellcheck disable=SC1091
  . /etc/os-release
  [ "${ID:-}" = "centos" ] || fail "This bootstrap supports CentOS Stream 9 only."
  [ "${VERSION_ID:-}" = "9" ] || fail "This bootstrap supports CentOS Stream 9 only."
}

create_swap() {
  if swapon --show --noheadings | grep -q .; then
    say "Swap already exists; leaving it unchanged"
    return
  fi

  say "Creating a 2 GiB swap file"
  $SUDO fallocate -l 2G /swapfile
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile >/dev/null
  $SUDO swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || \
    echo '/swapfile none swap defaults 0 0' | $SUDO tee -a /etc/fstab >/dev/null
}

install_docker() {
  say "Installing Docker through the Aliyun Docker CE mirror"
  $SUDO dnf -y install dnf-plugins-core curl rsync openssl gzip
  $SUDO rm -f /etc/yum.repos.d/docker-ce.repo
  $SUDO dnf config-manager --add-repo "$DOCKER_REPO"
  $SUDO sed -i \
    's#https://download.docker.com#https://mirrors.aliyun.com/docker-ce#g' \
    /etc/yum.repos.d/docker-ce.repo
  $SUDO dnf clean all
  $SUDO dnf -y makecache
  $SUDO dnf -y install \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

  say "Configuring bounded Docker logs"
  $SUDO install -d -m 755 /etc/docker
  printf '%s\n' \
    '{' \
    '  "log-driver": "local"' \
    '}' | $SUDO tee /etc/docker/daemon.json >/dev/null

  $SUDO systemctl enable --now docker
  $SUDO systemctl restart docker
}

open_local_firewall() {
  if $SUDO systemctl is-active --quiet firewalld; then
    say "Opening HTTP in firewalld"
    $SUDO firewall-cmd --permanent --add-service=http >/dev/null
    $SUDO firewall-cmd --reload >/dev/null
  else
    say "firewalld is inactive; no local firewall change is required"
  fi
}

read_secret() {
  local prompt="$1"
  local minimum="$2"
  local value=""

  while true; do
    read -r -s -p "$prompt" value
    printf '\n'
    if [ "${#value}" -lt "$minimum" ]; then
      printf 'At least %s characters are required.\n' "$minimum" >&2
      continue
    fi
    if [[ "$value" == *"'"* ]]; then
      printf "Single quotes are not allowed in this bootstrap prompt.\n" >&2
      continue
    fi
    REPLY="$value"
    return
  done
}

create_environment() {
  say "Creating the server-only production environment"
  $SUDO install -d -m 755 "$DEPLOY_PATH"
  $SUDO chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"

  local env_file="$DEPLOY_PATH/.env"
  if [ -f "$env_file" ]; then
    say "$env_file already exists; leaving secrets unchanged"
    return
  fi

  local admin_username=""
  read -r -p 'Administrator username [admin]: ' admin_username
  admin_username="${admin_username:-admin}"
  [[ "$admin_username" != *"'"* ]] || fail "Administrator username cannot contain a single quote."

  read_secret 'Administrator password (at least 12 characters): ' 12
  local admin_password="$REPLY"
  read_secret 'Default temporary student password (at least 8 characters): ' 8
  local student_password="$REPLY"
  local jwt_secret
  jwt_secret="$(openssl rand -hex 32)"

  umask 077
  cat > "$env_file" <<EOF
SITE_ADDRESS=:80
JWT_SECRET='$jwt_secret'
ADMIN_USERNAME='$admin_username'
ADMIN_PASSWORD='$admin_password'
ADMIN_DISPLAY_NAME='系统管理员'
DEFAULT_USER_PASSWORD='$student_password'
ALLOW_DANGEROUS_DB_OPERATIONS=false
CORS_ORIGINS=
LOG_LEVEL=info
EOF
  chmod 600 "$env_file"
}

create_deploy_key() {
  say "Creating a dedicated GitHub Actions SSH key"
  install -d -m 700 "$DEPLOY_HOME/.ssh"
  local key="$DEPLOY_HOME/.ssh/lab_safety_github_actions"
  local authorized="$DEPLOY_HOME/.ssh/authorized_keys"

  if [ ! -f "$key" ]; then
    ssh-keygen -q -t ed25519 -N '' \
      -C 'github-actions-lab-safety' \
      -f "$key"
  fi

  touch "$authorized"
  chmod 600 "$authorized"
  local public_key
  public_key="$(cat "${key}.pub")"
  grep -Fqx "$public_key" "$authorized" || printf '%s\n' "$public_key" >> "$authorized"

  printf '\nAdd the following GitHub Actions secrets:\n'
  printf 'DEPLOY_HOST=106.52.184.219\n'
  printf 'DEPLOY_PORT=22\n'
  printf 'DEPLOY_USER=%s\n' "$DEPLOY_USER"
  printf 'DEPLOY_PATH=%s\n' "$DEPLOY_PATH"
  printf '\nDEPLOY_SSH_KEY (copy everything between the markers):\n'
  printf '%s\n' '----- COPY FROM HERE -----'
  cat "$key"
  printf '%s\n' '----- COPY TO HERE -----'
  printf '\nAfter the GitHub secret is saved, remove the private-key copy from the server with:\n'
  printf 'rm -f %q\n' "$key"
}

main() {
  require_centos_9
  create_swap
  install_docker
  open_local_firewall
  create_environment
  create_deploy_key

  say "Bootstrap completed"
  free -h
  $SUDO docker version --format 'Docker Engine: {{.Server.Version}}'
  $SUDO docker compose version
  printf '\nTencent Cloud firewall must allow TCP port 80.\n'
  printf 'Automatic deployments can be enabled after the GitHub secrets are added.\n'
}

main "$@"
