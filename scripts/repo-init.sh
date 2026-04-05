#!/bin/bash
set -euo pipefail

echo "[optio] Initializing workspace"
echo "[optio] Repo: ${OPTIO_REPO_URL} (branch: ${OPTIO_REPO_BRANCH})"

# Configure git author for initial clone (overridden per-worktree at task exec time)
git config --global user.name "${GITHUB_APP_BOT_NAME:-Optio Agent}"
git config --global user.email "${GITHUB_APP_BOT_EMAIL:-optio-agent@noreply.github.com}"

# Set up GitHub credentials for initial clone.
# Priority: Envoy secret proxy > dynamic credential helper > static PAT fallback.
# Dynamic credential helpers are re-configured per-task at exec time by the API server.
if [ "${OPTIO_SECRET_PROXY:-}" = "true" ]; then
  echo "[optio] Secret proxy mode — configuring CA trust and proxy settings"

  # Update CA certificates if the Envoy CA cert has been mounted
  if [ -f /usr/local/share/ca-certificates/optio-envoy-ca.crt ]; then
    update-ca-certificates 2>/dev/null || true
    # Also set NODE_EXTRA_CA_CERTS for Node.js tools (gh, claude)
    export NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/optio-envoy-ca.crt
    echo "export NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/optio-envoy-ca.crt" >> ~/.bashrc
    echo "[optio] CA certificate trusted"
  fi

  # Configure git to use the proxy for HTTPS operations
  git config --global http.proxy "${HTTP_PROXY:-http://127.0.0.1:10080}"
  git config --global https.proxy "${HTTPS_PROXY:-http://127.0.0.1:10080}"
  echo "[optio] Git proxy configured"
  echo "[optio] Secret proxy configured — credentials are injected by the Envoy sidecar"

elif [ -n "${OPTIO_GIT_CREDENTIAL_URL:-}" ] && [ -f /usr/local/bin/optio-git-credential ]; then
  # Dynamic credential helper — fetches token from Optio API
  git config --global credential.helper '/usr/local/bin/optio-git-credential'
  echo "[optio] Dynamic git credential helper configured"

elif [ -n "${GITHUB_TOKEN:-}" ]; then
  # Static PAT fallback
  git config --global credential.helper store
  echo "https://x-access-token:${GITHUB_TOKEN}@github.com" > ~/.git-credentials
  chmod 600 ~/.git-credentials
  echo "[optio] Git credentials configured (static token)"

  echo "${GITHUB_TOKEN}" | gh auth login --with-token 2>/dev/null || true
  echo "[optio] GitHub CLI configured"
fi

# ── Runtime provisioning ────────────────────────────────────────────────────
# New: structured manifest-based provisioning (OPTIO_RUNTIME_MANIFEST)
# Legacy: comma/space-separated package list (OPTIO_EXTRA_PACKAGES)
install_validated_packages() {
  local PACKAGES="$1"
  for pkg in ${PACKAGES}; do
    if [[ ! "$pkg" =~ ^[a-zA-Z0-9][a-zA-Z0-9.+\-\[\]]+$ ]]; then
      echo "[optio] Error: invalid package name: $pkg" >&2
      return 1
    fi
  done
  if [ -n "${PACKAGES}" ]; then
    echo "[optio] Installing system packages: ${PACKAGES}"
    sudo apt-get update -qq 2>/dev/null && sudo apt-get install -y -qq ${PACKAGES} 2>&1 | tail -3 || echo "[optio] Warning: package install failed"
  fi
}

if [ -n "${OPTIO_RUNTIME_MANIFEST:-}" ]; then
  echo "[optio] Provisioning from runtime manifest"

  # ── Language toolchain installation ──────────────────────────────────────
  LANG_NAMES=$(echo "${OPTIO_RUNTIME_MANIFEST}" | jq -r '[.languageInstalls[]?.name] | unique | .[]' 2>/dev/null || echo "")
  for lang in ${LANG_NAMES}; do
    case "$lang" in
      node)
        echo "[optio] Installing Node.js dev toolchain (pnpm, yarn, bun, build-essential)"
        sudo apt-get update -qq 2>/dev/null
        sudo apt-get install -y -qq build-essential python3-dev 2>&1 | tail -3 || true
        npm install -g pnpm yarn 2>&1 | tail -3 || true
        # Install bun
        if ! command -v bun &>/dev/null; then
          curl -fsSL https://bun.sh/install | bash 2>&1 | tail -3 || true
          export BUN_INSTALL="$HOME/.bun"
          export PATH="$BUN_INSTALL/bin:$PATH"
          echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
          echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
        fi
        echo "[optio] Node.js toolchain ready: $(node --version), pnpm $(pnpm --version 2>/dev/null || echo 'n/a')"
        ;;
      python)
        echo "[optio] Installing Python dev toolchain (pip, uv, poetry, venv)"
        sudo apt-get update -qq 2>/dev/null
        sudo apt-get install -y -qq python3-full python3-pip python3-venv python3-dev build-essential 2>&1 | tail -3 || true
        pip install --break-system-packages uv poetry 2>&1 | tail -3 || true
        echo "[optio] Python toolchain ready: $(python3 --version), uv $(uv --version 2>/dev/null || echo 'n/a')"
        ;;
      go)
        echo "[optio] Installing Go toolchain"
        GO_VERSION=$(echo "${OPTIO_RUNTIME_MANIFEST}" | jq -r '.languageInstalls[] | select(.name=="go") | .version // "1.23.4"' 2>/dev/null || echo "1.23.4")
        # Remove minor-only version (e.g., "1.23" → "1.23.4")
        [[ "$GO_VERSION" =~ ^[0-9]+\.[0-9]+$ ]] && GO_VERSION="${GO_VERSION}.4"
        curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" | sudo tar -C /usr/local -xzf - 2>&1 || true
        export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH"
        echo 'export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH"' >> ~/.bashrc
        echo "[optio] Go toolchain ready: $(go version 2>/dev/null || echo 'install failed')"
        ;;
      rust)
        echo "[optio] Installing Rust toolchain"
        sudo apt-get update -qq 2>/dev/null
        sudo apt-get install -y -qq build-essential pkg-config libssl-dev 2>&1 | tail -3 || true
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y 2>&1 | tail -5 || true
        source "$HOME/.cargo/env" 2>/dev/null || true
        echo 'source "$HOME/.cargo/env"' >> ~/.bashrc
        echo "[optio] Rust toolchain ready: $(rustc --version 2>/dev/null || echo 'install failed')"
        ;;
      *)
        echo "[optio] Warning: unknown language '$lang', skipping"
        ;;
    esac
  done

  # ── System packages ──────────────────────────────────────────────────────
  SYS_PKGS=$(echo "${OPTIO_RUNTIME_MANIFEST}" | jq -r '[.systemPackages[]?] | join(" ")' 2>/dev/null || echo "")
  install_validated_packages "${SYS_PKGS}"

  # ── Global node packages ─────────────────────────────────────────────────
  NODE_PKGS=$(echo "${OPTIO_RUNTIME_MANIFEST}" | jq -r '[.nodePackages[]?] | join(" ")' 2>/dev/null || echo "")
  if [ -n "${NODE_PKGS}" ]; then
    echo "[optio] Installing node packages: ${NODE_PKGS}"
    npm install -g ${NODE_PKGS} 2>&1 | tail -3 || echo "[optio] Warning: node package install failed"
  fi

  # ── Python packages ──────────────────────────────────────────────────────
  PY_PKGS=$(echo "${OPTIO_RUNTIME_MANIFEST}" | jq -r '[.pythonPackages[]?] | join(" ")' 2>/dev/null || echo "")
  if [ -n "${PY_PKGS}" ]; then
    echo "[optio] Installing python packages: ${PY_PKGS}"
    pip install --break-system-packages ${PY_PKGS} 2>&1 | tail -3 || echo "[optio] Warning: python package install failed"
  fi

  # ── Environment variables ────────────────────────────────────────────────
  ENV_KEYS=$(echo "${OPTIO_RUNTIME_MANIFEST}" | jq -r '.envVars // {} | keys[]' 2>/dev/null || echo "")
  for key in ${ENV_KEYS}; do
    val=$(echo "${OPTIO_RUNTIME_MANIFEST}" | jq -r ".envVars[\"${key}\"]")
    export "${key}=${val}"
    echo "export ${key}=\"${val}\"" >> ~/.bashrc
  done

  # ── Setup commands ───────────────────────────────────────────────────────
  SETUP_CMDS=$(echo "${OPTIO_RUNTIME_MANIFEST}" | jq -r '[.setupCommands[]?] | join("\n")' 2>/dev/null || echo "")
  if [ -n "${SETUP_CMDS}" ]; then
    echo "[optio] Running manifest setup commands"
    echo "${SETUP_CMDS}" | while IFS= read -r cmd; do
      [ -n "${cmd}" ] && eval "${cmd}" || true
    done
  fi

  echo "[optio] Runtime manifest provisioning complete"

elif [ -n "${OPTIO_EXTRA_PACKAGES:-}" ]; then
  # Legacy fallback: comma or space separated package list
  PACKAGES=$(echo "${OPTIO_EXTRA_PACKAGES}" | tr ',' ' ')
  install_validated_packages "${PACKAGES}"
fi

# Clone repo (--recurse-submodules handles repos with submodules)
cd /workspace
echo "[optio] Cloning..."
git clone --branch "${OPTIO_REPO_BRANCH}" --recurse-submodules "${OPTIO_REPO_URL}" repo 2>&1
echo "[optio] Repo cloned"

# Create tasks directory for worktrees
mkdir -p /workspace/tasks

# Run repo-level setup if present (.optio/setup.sh)
if [ -f /workspace/repo/.optio/setup.sh ]; then
  echo "[optio] Running repo setup script (.optio/setup.sh)..."
  chmod +x /workspace/repo/.optio/setup.sh
  cd /workspace/repo && ./.optio/setup.sh
  echo "[optio] Repo setup complete"
fi

# Run custom setup commands from Optio repo settings
# NOTE: .optio/setup.sh is the preferred extensibility hook.
# OPTIO_SETUP_COMMANDS is deprecated and will be removed in a future release.
if [ -n "${OPTIO_SETUP_COMMANDS:-}" ]; then
  echo "[optio] Running setup commands (consider migrating to .optio/setup.sh)..."
  cd /workspace/repo
  SETUP_SCRIPT="$(mktemp /tmp/optio-setup-XXXXXX.sh)"
  printf '%s\n' "${OPTIO_SETUP_COMMANDS}" > "${SETUP_SCRIPT}"
  chmod 700 "${SETUP_SCRIPT}"
  bash "${SETUP_SCRIPT}"
  SETUP_EXIT=$?
  rm -f "${SETUP_SCRIPT}"
  if [ "${SETUP_EXIT}" -ne 0 ]; then
    echo "[optio] Warning: setup commands exited with status ${SETUP_EXIT}" >&2
  fi
  echo "[optio] Setup commands complete"
fi

# Signal that the pod is ready for tasks
touch /workspace/.ready
echo "[optio] Workspace ready — waiting for tasks"

# Keep the pod alive
exec sleep infinity
