#!/usr/bin/env bash
# ==============================================================================
# LogSentinel Linux Background Collector Agent Installer
# Version: 1.0.0 (Phase 3)
# ==============================================================================
# Note: Inspect this script before running. Do NOT pipe untrusted curl into bash.
# This script sets up the least-privilege 'logsentinel' service user,
# creates dedicated state directories, and registers the hardened systemd unit.
# ==============================================================================

set -euo pipefail

INSTALL_DIR="/opt/logsentinel-collector"
CONFIG_DIR="/etc/logsentinel"
STATE_DIR="/var/lib/logsentinel"
SERVICE_USER="logsentinel"
SERVICE_GROUP="logsentinel"
SYSTEMD_FILE="/etc/systemd/system/tamper-agent.service"

echo "=== LogSentinel Linux Collector Installation ==="

# 1. Verify Root privileges for setup tasks
if [ "$(id -u)" -ne 0 ]; then
  echo "[ERROR] This installer must be run as root (or via sudo) to provision systemd services." >&2
  exit 1
fi

# 2. Check Node.js version
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is required but was not found. Please install Node.js >= 20.x first." >&2
  exit 1
fi

NODE_VERSION=$(node -v | tr -d 'v' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "[ERROR] Node.js version must be 20 or higher. Found: $(node -v)" >&2
  exit 1
fi
echo "[OK] Node.js version $(node -v) verified."

# 3. Create dedicated system user and group if not present
if ! getent group "$SERVICE_GROUP" >/dev/null 2>&1; then
  echo "[INFO] Creating system group: $SERVICE_GROUP"
  groupadd -r "$SERVICE_GROUP"
fi

if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  echo "[INFO] Creating system service user: $SERVICE_USER (nologin)"
  useradd -r -g "$SERVICE_GROUP" -d "$STATE_DIR" -s /usr/sbin/nologin "$SERVICE_USER"
fi

# 4. Create directories with restrictive permissions
echo "[INFO] Provisioning application and state directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$STATE_DIR"

chmod 0750 "$CONFIG_DIR"
chown root:"$SERVICE_GROUP" "$CONFIG_DIR"

chmod 0700 "$STATE_DIR"
chown "$SERVICE_USER":"$SERVICE_GROUP" "$STATE_DIR"

# 5. Copy Collector codebase to /opt
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "[INFO] Deploying agent source from $SCRIPT_DIR to $INSTALL_DIR..."
cp -r "$SCRIPT_DIR/package.json" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/src" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/config" "$INSTALL_DIR/"
chown -R root:root "$INSTALL_DIR"
chmod -R 0755 "$INSTALL_DIR"

# 6. Copy example configuration if config.json does not exist
if [ ! -f "$CONFIG_DIR/collector.json" ]; then
  cp "$INSTALL_DIR/config/config.example.json" "$CONFIG_DIR/collector.json"
  chmod 0640 "$CONFIG_DIR/collector.json"
  chown root:"$SERVICE_GROUP" "$CONFIG_DIR/collector.json"
  echo "[INFO] Initialized template config at $CONFIG_DIR/collector.json"
else
  echo "[INFO] Preserved existing config at $CONFIG_DIR/collector.json"
fi

# 7. Install Systemd Service Unit
echo "[INFO] Registering systemd service unit..."
cp "$SCRIPT_DIR/systemd/tamper-agent.service" "$SYSTEMD_FILE"
chmod 0644 "$SYSTEMD_FILE"
systemctl daemon-reload

# 8. Log Access Permissions Advisory
echo ""
echo "=== Log Source Permissions Guidance ==="
echo "The agent runs as the unprivileged user '$SERVICE_USER'."
echo "To grant read access to specific system log files (e.g. /var/log/auth.log):"
echo "  Option A (POSIX ACL - Recommended, least privilege):"
echo "    setfacl -m u:$SERVICE_USER:r /var/log/auth.log"
echo "  Option B (Group membership for standard Linux log group):"
echo "    usermod -a -G adm $SERVICE_USER   # (Debian/Ubuntu)"
echo ""
echo "=== Next Steps to Activate Agent ==="
echo "1. Edit /etc/logsentinel/collector.json with your Server ID and Enrollment Token:"
echo "     nano /etc/logsentinel/collector.json"
echo "2. Start and enable the service:"
echo "     systemctl enable --now tamper-agent"
echo "3. Inspect agent telemetry and status:"
echo "     systemctl status tamper-agent"
echo "     journalctl -u tamper-agent -f"
echo "=========================================================="
