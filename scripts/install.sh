#!/usr/bin/env bash
# download and install the latest Open Symphony release for this machine.
# usage:
#   curl -fsSL https://raw.githubusercontent.com/asuzukosi/opensymphony/main/scripts/install.sh | bash
set -euo pipefail

REPO="asuzukosi/opensymphony"
APP_NAME="Open Symphony"
INSTALL_DIR="${OPENSIMPHONY_INSTALL_DIR:-$HOME/.local/bin}"

log() {
  printf 'opensymphony: %s\n' "$*"
}

die() {
  printf 'opensymphony: error: %s\n' "$*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

need curl
need uname

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"

case "$os" in
  darwin)
    case "$arch" in
      arm64 | aarch64) asset_glob='*aarch64.dmg' ;;
      x86_64) asset_glob='*x64.dmg' ;;
      *) die "unsupported macOS architecture: $arch" ;;
    esac
    ;;
  linux)
    case "$arch" in
      x86_64 | amd64) asset_glob='*.AppImage' ;;
      aarch64 | arm64) asset_glob='*aarch64.AppImage' ;;
      *) die "unsupported Linux architecture: $arch" ;;
    esac
    ;;
  mingw* | msys* | cygwin*)
    die "windows: download the .exe installer from https://github.com/${REPO}/releases/latest"
    ;;
  *)
    die "unsupported operating system: $os"
    ;;
esac

api_url="https://api.github.com/repos/${REPO}/releases/latest"
log "fetching latest release from ${REPO}"

release_json="$(curl -fsSL "$api_url")"
tag="$(printf '%s' "$release_json" | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
[ -n "$tag" ] || die "could not resolve latest release tag (is a release published?)"

# pick the first asset url whose name matches the platform glob
asset_url=""
asset_name=""
while IFS=$'\t' read -r name url; do
  case "$name" in
    $asset_glob)
      asset_name="$name"
      asset_url="$url"
      break
      ;;
  esac
done < <(
  printf '%s' "$release_json" | awk '
    /"name":/ {
      name=$0
      sub(/.*"name":[[:space:]]*"/, "", name)
      sub(/".*/, "", name)
    }
    /"browser_download_url":/ {
      url=$0
      sub(/.*"browser_download_url":[[:space:]]*"/, "", url)
      sub(/".*/, "", url)
      if (name != "" && url != "") {
        printf "%s\t%s\n", name, url
        name=""
        url=""
      }
    }
  '
)

[ -n "$asset_url" ] || die "no matching asset for '${asset_glob}' in release ${tag}"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
archive="${tmpdir}/${asset_name}"

log "downloading ${asset_name} (${tag})"
curl -fL --progress-bar -o "$archive" "$asset_url"

case "$os" in
  darwin)
    log "opening disk image — drag ${APP_NAME}.app into Applications"
    open "$archive"
    # keep the dmg around for the Finder dialog; do not delete on exit
    trap - EXIT
    log "done. launch ${APP_NAME} from Applications when the copy finishes."
    ;;
  linux)
    mkdir -p "$INSTALL_DIR"
    target="${INSTALL_DIR}/opensymphony"
    install -m 755 "$archive" "$target"
    log "installed to ${target}"
    if ! printf '%s' ":$PATH:" | grep -q ":${INSTALL_DIR}:"; then
      log "add ${INSTALL_DIR} to your PATH, then run: opensymphony"
    else
      log "run: opensymphony"
    fi
    ;;
esac
