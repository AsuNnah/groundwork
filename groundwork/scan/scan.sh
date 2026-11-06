#!/bin/sh
# Groundwork H0 host scan (Linux, macOS, WSL). Zero dependencies: POSIX sh + coreutils.
# Prints host-profile JSON to stdout. Collects no hostnames, usernames, serials or IPs.
# Usage: sh scan.sh [--out FILE]
# Windows native: use scan.ps1 (same JSON shape). Part of Groundwork.
set -u

str() { printf '"%s"' "$(printf '%s' "$1" | tr -d '"\\' | tr '\n\t' '  ' | sed 's/  *$//')"; }
num() { case "$1" in ''|*[!0-9]*) printf 'null' ;; *) printf '%s' "$1" ;; esac; }
bool() { if [ "$1" = 1 ]; then printf true; else printf false; fi; }
has() { command -v "$1" >/dev/null 2>&1; }

OS_FAMILY=unknown; DISTRO=""; OS_VER=""; WSL=0
case "$(uname -s)" in
  Linux)  OS_FAMILY=linux
          [ -r /etc/os-release ] && . /etc/os-release && DISTRO="${ID:-}" && OS_VER="${VERSION_ID:-}"
          grep -qi microsoft /proc/version 2>/dev/null && WSL=1 ;;
  Darwin) OS_FAMILY=macos; DISTRO=macos; OS_VER="$(sw_vers -productVersion 2>/dev/null)" ;;
  *BSD)   OS_FAMILY=bsd; DISTRO="$(uname -s)"; OS_VER="$(uname -r)" ;;
  MINGW*|MSYS*|CYGWIN*) OS_FAMILY=windows-posix-shell ;;  # run scan.ps1 instead
esac
KERNEL="$(uname -r)"
ARCH="$(uname -m)"; [ "$ARCH" = aarch64 ] && ARCH=arm64; [ "$ARCH" = amd64 ] && ARCH=x86_64

PKG=""
for p in apt dnf yum pacman zypper apk brew port nix; do has "$p" && PKG="$PKG $p"; done

# cpu / memory / disk
if [ "$OS_FAMILY" = macos ]; then
  CPU_MODEL="$(sysctl -n machdep.cpu.brand_string 2>/dev/null)"
  THREADS="$(sysctl -n hw.logicalcpu 2>/dev/null)"
  MEM_GB=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824 ))
  VIRT_EXT=$( [ "$(sysctl -n kern.hv_support 2>/dev/null)" = 1 ] && echo 1 || echo 0 )
else
  CPU_MODEL="$(grep -m1 -E 'model name|Hardware|Model' /proc/cpuinfo 2>/dev/null | cut -d: -f2-)"
  THREADS="$(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo)"
  MEM_GB=$(( $(awk '/MemTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 0) / 1048576 ))
  VIRT_EXT=$(grep -qE '\b(vmx|svm)\b' /proc/cpuinfo 2>/dev/null && echo 1 || echo 0)
fi
DISK_FREE_GB=$(df -Pk . 2>/dev/null | awk 'NR==2{print int($4/1048576)}')

# gpu (best effort)
GPU=""
if has nvidia-smi; then GPU="$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)"
elif has lspci; then GPU="$(lspci 2>/dev/null | grep -iE 'vga|3d|display' | head -1 | cut -d: -f3-)"
elif [ "$OS_FAMILY" = macos ]; then GPU="$(system_profiler SPDisplaysDataType 2>/dev/null | awk -F': ' '/Chipset Model/{print $2; exit}')"
fi

# machine kind: container > vm > laptop > desktop
KIND=desktop; HYPERVISOR=""
if [ -f /.dockerenv ] || grep -qE 'docker|containerd|kubepods' /proc/1/cgroup 2>/dev/null; then KIND=container
elif has systemd-detect-virt && HYPERVISOR="$(systemd-detect-virt 2>/dev/null)" && [ "$HYPERVISOR" != none ]; then KIND=vm
elif [ "$OS_FAMILY" = macos ] && [ "$(sysctl -n kern.hv_vmm_present 2>/dev/null)" = 1 ]; then KIND=vm; HYPERVISOR=apple
else HYPERVISOR=""; fi
[ "$HYPERVISOR" = none ] && HYPERVISOR=""
BATTERY=0
ls /sys/class/power_supply/BAT* >/dev/null 2>&1 && BATTERY=1
[ "$OS_FAMILY" = macos ] && pmset -g batt 2>/dev/null | grep -q InternalBattery && BATTERY=1
if [ "$KIND" = desktop ]; then
  CHASSIS="$(cat /sys/class/dmi/id/chassis_type 2>/dev/null)"
  case "$CHASSIS" in 8|9|10|14|31|32) KIND=laptop ;; esac
  [ "$BATTERY" = 1 ] && KIND=laptop
fi
[ "$WSL" = 1 ] && KIND=wsl

# virtualization
KVM=0; KVM_DEV=0; KVM_MOD=0; KVM_GROUP=0
[ -e /dev/kvm ] && KVM_DEV=1
[ -r /dev/kvm ] && [ -w /dev/kvm ] && KVM=1
grep -qE '^kvm(_intel|_amd)? ' /proc/modules 2>/dev/null && KVM_MOD=1
id -nG 2>/dev/null | tr ' ' '\n' | grep -qx kvm && KVM_GROUP=1
APPLE_VZ=0; [ "$OS_FAMILY" = macos ] && [ "$ARCH" = arm64 ] && APPLE_VZ=1

# containers
DOCKER=0; DOCKER_OK=0; PODMAN=0; COMPOSE=0
has docker && DOCKER=1 && docker info >/dev/null 2>&1 && DOCKER_OK=1
DOCKER_WHY=""
if [ "$DOCKER" = 1 ] && [ "$DOCKER_OK" = 0 ]; then
  if [ -S /var/run/docker.sock ] && [ ! -w /var/run/docker.sock ]; then DOCKER_WHY="no permission on docker.sock (add user to docker group or use rootless)"
  else DOCKER_WHY="daemon not running"; fi
fi
[ "$DOCKER_OK" = 1 ] && docker compose version >/dev/null 2>&1 && COMPOSE=1
has podman && podman info >/dev/null 2>&1 && PODMAN=1

# display / rights
GUI=0
{ [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; } && GUI=1
[ "$OS_FAMILY" = macos ] && [ "$KIND" != vm ] && GUI=1
ADMIN=0
{ [ "$(id -u)" = 0 ] || sudo -n true 2>/dev/null; } && ADMIN=1
PROXY=0; [ -n "${HTTPS_PROXY:-}${https_proxy:-}" ] && PROXY=1

# toolchains: name -> version string (first line), only if present
tool() { # tool <json-key> <cmd> [version-args...]
  key="$1"; cmd="$2"; shift 2
  has "$cmd" || return 0
  v="$("$cmd" "$@" 2>&1 | grep -m1 -oE '[0-9]+(\.[0-9]+)+' | head -1)"
  [ -n "$TOOLS" ] && TOOLS="$TOOLS,"
  TOOLS="$TOOLS$(str "$key"):$(str "${v:-present}")"
}
TOOLS=""
tool git git --version;      tool gh gh --version
tool node node --version;    tool npm npm --version;   tool pnpm pnpm --version; tool bun bun --version
tool python python3 --version; tool uv uv --version
tool java java -version;     tool kotlin kotlin -version; tool gradle gradle --version
tool adb adb version;        tool emulator emulator -version; tool sdkmanager sdkmanager --version
tool flutter flutter --version; tool dart dart --version
tool dotnet dotnet --version; tool go go version;       tool rustc rustc --version; tool cargo cargo --version
tool xcodebuild xcodebuild -version; tool swift swift --version
tool gcc gcc --version;      tool clang clang --version; tool cmake cmake --version
tool wine wine --version;    tool qemu qemu-system-x86_64 --version
tool xvfb Xvfb -help;        tool playwright playwright --version
tool appium appium --version; tool maestro maestro --version
tool mise mise --version;    tool asdf asdf --version
tool claude claude --version
tool skillspector skillspector --version
tool rea rea --version;      tool scrapling scrapling --version
tool godot godot --version

json=$(cat <<EOF
{
  "schema": "groundwork.host-profile.v1",
  "scanned_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "scanner": "scan.sh",
  "os": {"family": $(str "$OS_FAMILY"), "distro": $(str "$DISTRO"), "version": $(str "$OS_VER"), "kernel": $(str "$KERNEL"), "wsl": $(bool $WSL), "package_managers": $(str "${PKG# }")},
  "cpu": {"arch": $(str "$ARCH"), "model": $(str "${CPU_MODEL# }"), "threads": $(num "$THREADS"), "virt_extensions": $(bool $VIRT_EXT)},
  "memory": {"total_gb": $(num "$MEM_GB")},
  "disk": {"free_gb_workdir": $(num "$DISK_FREE_GB")},
  "gpu": {"model": $(str "${GPU# }")},
  "machine": {"kind": $(str "$KIND"), "hypervisor": $(str "$HYPERVISOR"), "battery": $(bool $BATTERY)},
  "virtualization": {"kvm_usable": $(bool $KVM), "kvm_device": $(bool $KVM_DEV), "kvm_module_loaded": $(bool $KVM_MOD), "in_kvm_group": $(bool $KVM_GROUP), "apple_vz": $(bool $APPLE_VZ)},
  "containers": {"docker_installed": $(bool $DOCKER), "docker_daemon_ok": $(bool $DOCKER_OK), "docker_problem": $(str "$DOCKER_WHY"), "compose": $(bool $COMPOSE), "podman_ok": $(bool $PODMAN)},
  "display": {"gui": $(bool $GUI)},
  "user": {"admin_noninteractive": $(bool $ADMIN), "proxy": $(bool $PROXY)},
  "toolchains": {$TOOLS}
}
EOF
)

if [ "${1:-}" = --out ] && [ -n "${2:-}" ]; then
  mkdir -p "$(dirname "$2")" && printf '%s\n' "$json" > "$2" && echo "wrote $2" >&2
else
  printf '%s\n' "$json"
fi
