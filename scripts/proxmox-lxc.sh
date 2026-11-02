#!/usr/bin/env bash
# ==============================================================================
# Proxmox VE LXC-Installationsskript für WarnWetter Web (Nativ / Ohne Docker)
# Ausführung direkt auf der Proxmox-VE-Host-Shell als root.
# ==============================================================================

set -Eeuo pipefail

CT_CREATED=0

fehler_behandlung() {
  local zeile="$1"
  local code="$2"
  echo "" >&2
  echo "[FEHLER] Skriptabbruch in Zeile ${zeile} (Exit-Code: ${code})." >&2
  if [ "${CT_CREATED}" -eq 1 ] && [ -n "${CTID:-}" ]; then
    echo "[HINWEIS] Unvollständigen Container bereinigen mit: pct stop ${CTID} 2>/dev/null || true; pct destroy ${CTID}" >&2
  fi
}
trap 'fehler_behandlung "$LINENO" "$?"' ERR

info() {
  echo -e "\033[1;34m[INFO]\033[0m $*"
}

erfolg() {
  echo -e "\033[1;32m[OK]\033[0m   $*"
}

# 1. Vorbedingungen auf dem Proxmox-Host prüfen
if [ "$(id -u)" -ne 0 ]; then
  echo "[FEHLER] Dieses Skript muss als root auf dem Proxmox-VE-Host ausgeführt werden." >&2
  exit 1
fi

for befehl in pct pveam pvesh awk sort; do
  if ! command -v "${befehl}" >/dev/null 2>&1; then
    echo "[FEHLER] Befehl '${befehl}' nicht gefunden. Bitte direkt auf einem Proxmox-VE-Host ausführen." >&2
    exit 1
  fi
done

# 2. Konfiguration (per Umgebungsvariablen überschreibbar)
CTID="${CTID:-$(pvesh get /cluster/nextid)}"
CT_HOSTNAME="${CT_HOSTNAME:-warnwetter}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
ROOTFS_STORAGE="${STORAGE:-${ROOTFS_STORAGE:-local-lvm}}"
DISK_SIZE="${DISK_SIZE:-3}"
DISK_GB="${DISK_SIZE%[Gg]}"
CORES="${CORES:-1}"
MEMORY="${MEMORY:-512}"
SWAP="${SWAP:-0}"
BRIDGE="${BRIDGE:-vmbr0}"
IP="${IP:-dhcp}"
GW="${GW:-}"
VLAN="${VLAN:-}"
IP6="${IP6:-}"
TZ_NAME="${TZ_NAME:-Europe/Berlin}"
REPO_URL="${REPO_URL:-https://github.com/moritztw/WarnWetterWeb.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"

# 3. Eingaben validieren
if ! [[ "${CTID}" =~ ^[0-9]+$ ]] || [ "${CTID}" -lt 100 ]; then
  echo "[FEHLER] Ungültige CTID '${CTID}' (muss eine ganze Zahl >= 100 sein)." >&2
  exit 1
fi

if pct status "${CTID}" >/dev/null 2>&1; then
  echo "[FEHLER] Container-ID ${CTID} existiert bereits." >&2
  exit 1
fi

for wert_name in DISK_GB CORES MEMORY SWAP; do
  wert="${!wert_name}"
  if ! [[ "${wert}" =~ ^[0-9]+$ ]]; then
    echo "[FEHLER] ${wert_name}='${wert}' ist keine gültige nicht-negative Zahl." >&2
    exit 1
  fi
done

if [ "${IP}" != "dhcp" ] && [[ "${IP}" != */* ]]; then
  echo "[FEHLER] Statische IP '${IP}' benötigt eine Subnetzmaske in CIDR-Notation (z. B. IP=192.168.178.90/24)." >&2
  exit 1
fi

NET_CONF="name=eth0,bridge=${BRIDGE},ip=${IP}"
if [ "${IP}" != "dhcp" ] && [ -n "${GW}" ]; then
  NET_CONF="${NET_CONF},gw=${GW}"
fi
if [ -n "${VLAN}" ]; then
  NET_CONF="${NET_CONF},tag=${VLAN}"
fi
if [ -n "${IP6}" ]; then
  NET_CONF="${NET_CONF},ip6=${IP6}"
fi

info "Konfiguration: CTID=${CTID}, Hostname=${CT_HOSTNAME}, CPU=${CORES}, RAM=${MEMORY}MB, Disk=${ROOTFS_STORAGE}:${DISK_GB}G, Netz=${NET_CONF}"

# 4. Aktuelles Debian-12-Standard-Template ermitteln und bei Bedarf laden
info "Aktualisiere Proxmox-Template-Katalog ..."
pveam update >/dev/null

TEMPLATE_NAME="$(pveam available -section system | awk '/debian-12-standard_.*_amd64\.tar\.zst/ {print $2}' | sort -V | tail -n1)"
if [ -z "${TEMPLATE_NAME}" ]; then
  echo "[FEHLER] Kein 'debian-12-standard_*_amd64.tar.zst' Template im Katalog gefunden." >&2
  exit 1
fi

if ! pveam list "${TEMPLATE_STORAGE}" | awk '{print $1}' | grep -qF "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE_NAME}"; then
  info "Lade Template ${TEMPLATE_NAME} auf '${TEMPLATE_STORAGE}' herunter ..."
  pveam download "${TEMPLATE_STORAGE}" "${TEMPLATE_NAME}"
else
  erfolg "Template ${TEMPLATE_NAME} ist bereits auf '${TEMPLATE_STORAGE}' vorhanden."
fi

# 5. Unprivilegierten LXC-Container anlegen und starten
# Hinweis: nesting=1 ist unter Debian 12 für systemd Mount-Namespace-Sandboxing
# (systemd-logind, ProtectSystem=strict, PrivateTmp=true) erforderlich.
info "Erstelle unprivilegierten LXC-Container ${CTID} (${CT_HOSTNAME}) ..."
pct create "${CTID}" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE_NAME}" \
  --hostname "${CT_HOSTNAME}" \
  --unprivileged 1 \
  --features nesting=1 \
  --ostype debian \
  --arch amd64 \
  --cores "${CORES}" \
  --memory "${MEMORY}" \
  --swap "${SWAP}" \
  --rootfs "${ROOTFS_STORAGE}:${DISK_GB}" \
  --net0 "${NET_CONF}" \
  --onboot 1 \
  --timezone "${TZ_NAME}"

CT_CREATED=1

info "Starte Container ${CTID} ..."
pct start "${CTID}"

# 6. Auf Netzwerk- und DNS-Bereitschaft im Container warten
info "Warte auf Netzwerkverbindung im Container ..."
NETZ_BEREIT=0
for _ in $(seq 1 30); do
  if pct exec "${CTID}" -- getent hosts deb.debian.org >/dev/null 2>&1; then
    NETZ_BEREIT=1
    break
  fi
  sleep 1
done

if [ "${NETZ_BEREIT}" -ne 1 ]; then
  echo "[FEHLER] Keine Namensauflösung/Netzwerkverbindung im Container nach 30 Sekunden (bitte BRIDGE/IP/GW/VLAN prüfen)." >&2
  exit 1
fi
erfolg "Netzwerk im Container aktiv."

# 7. Native Bereitstellung im LXC (Node.js 22 LTS, App-Build, systemd-Service, Update-Befehl)
info "Installiere Node.js 22 LTS, baue WarnWetter Web und richte systemd-Dienst ein ..."
pct exec "${CTID}" -- bash -s -- "${REPO_URL}" "${REPO_BRANCH}" <<'EOF_GUEST'
set -Eeuo pipefail

REPO_URL="$1"
REPO_BRANCH="$2"

export DEBIAN_FRONTEND=noninteractive
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

printf 'LANG=C.UTF-8\nLC_ALL=C.UTF-8\n' > /etc/default/locale

apt-get update -qq
apt-get dist-upgrade -y -qq
apt-get install -y --no-install-recommends -qq ca-certificates curl gnupg git

install -m 0755 -d /usr/share/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | gpg --dearmor --yes -o /usr/share/keyrings/nodesource.gpg
chmod a+r /usr/share/keyrings/nodesource.gpg

echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
  > /etc/apt/sources.list.d/nodesource.list

apt-get update -qq
apt-get install -y --no-install-recommends -qq nodejs

if ! id -u warnwetter >/dev/null 2>&1; then
  useradd --system --home-dir /opt/warnwetter --create-home --shell /usr/sbin/nologin warnwetter
fi

install -d -o warnwetter -g warnwetter /opt/warnwetter

if [ ! -d /opt/warnwetter/app/.git ]; then
  rm -rf /opt/warnwetter/app
  runuser -u warnwetter -- git clone --depth 1 --branch "${REPO_BRANCH}" "${REPO_URL}" /opt/warnwetter/app
fi

runuser -u warnwetter -- bash -c '
  cd /opt/warnwetter/app
  if [ -f package-lock.json ]; then
    npm ci --include=dev --no-audit --no-fund
  else
    npm install --include=dev --no-audit --no-fund
  fi
  npm run build
  npm prune --omit=dev
  npm cache clean --force >/dev/null 2>&1 || true
'

if [ ! -f /etc/warnwetter.env ]; then
  if [ -f /opt/warnwetter/app/.env.example ]; then
    cp /opt/warnwetter/app/.env.example /etc/warnwetter.env
  else
    cat <<'EOF_ENV' > /etc/warnwetter.env
APP_URL="http://localhost:3000"
BRIGHTSKY_BASE_URL="https://api.brightsky.dev"
GEOCODING_BASE_URL="https://geocoding-api.open-meteo.com/v1"
DWD_ICON_BASE_URL="https://api.open-meteo.com/v1/dwd-icon"
CACHE_TTL_MS="180000"
EOF_ENV
  fi
  chown root:warnwetter /etc/warnwetter.env
  chmod 0640 /etc/warnwetter.env
fi

cat <<'EOF_SERVICE' > /etc/systemd/system/warnwetter.service
[Unit]
Description=WarnWetter Web (DWD Open Data Webanwendung)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=warnwetter
Group=warnwetter
WorkingDirectory=/opt/warnwetter/app
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--no-warnings
EnvironmentFile=-/etc/warnwetter.env
ExecStart=/usr/bin/node server.ts
Restart=on-failure
RestartSec=5

# Prozess- und Dateisystem-Haertung
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF_SERVICE

cat <<'EOF_UPDATE' > /usr/local/bin/warnwetter-update
#!/usr/bin/env bash
set -Eeuo pipefail

echo "[INFO] Aktualisiere WarnWetter Web aus Git-Repository ..."
runuser -u warnwetter -- bash -c '
  cd /opt/warnwetter/app
  git fetch --depth 1 origin
  AKTUELLER_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  git reset --hard "origin/${AKTUELLER_BRANCH}"
  npm ci --include=dev --no-audit --no-fund
  npm run build
  npm prune --omit=dev
  npm cache clean --force >/dev/null 2>&1 || true
'

systemctl restart warnwetter

for _ in $(seq 1 15); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "[OK]   WarnWetter Web erfolgreich aktualisiert und neu gestartet."
    exit 0
  fi
  sleep 1
done

echo "[FEHLER] Dienst antwortet nach Update nicht auf Port 3000. Logs pruefen: journalctl -u warnwetter -n 50" >&2
exit 1
EOF_UPDATE
chmod 0755 /usr/local/bin/warnwetter-update

systemctl daemon-reload
systemctl enable --now warnwetter

DIENST_BEREIT=0
for _ in $(seq 1 15); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    DIENST_BEREIT=1
    break
  fi
  sleep 1
done

if [ "${DIENST_BEREIT}" -ne 1 ]; then
  journalctl -u warnwetter -n 30 --no-pager >&2 || true
  echo "[FEHLER] WarnWetter-Dienst antwortet nicht unter http://127.0.0.1:3000/api/health." >&2
  exit 1
fi

apt-get autoremove -y --purge -qq
apt-get clean
rm -rf /var/lib/apt/lists/*
EOF_GUEST

CT_IP="$(pct exec "${CTID}" -- hostname -I | awk '{print $1}')"

echo ""
erfolg "WarnWetter Web LXC-Container erfolgreich bereitgestellt!"
echo "  Container-ID : ${CTID} (${CT_HOSTNAME})"
echo "  Web-Zugriff  : http://${CT_IP:-<Container-IP>}:3000"
echo "  Konfiguration: /etc/warnwetter.env (im Container)"
echo "  Service-Logs : pct exec ${CTID} -- journalctl -u warnwetter -f"
echo "  App-Update   : pct exec ${CTID} -- warnwetter-update"
