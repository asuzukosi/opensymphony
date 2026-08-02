#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# install.sh — download the latest Open Symphony release for this machine
#
# how users run it (pulls this file from main, then executes it):
#   curl -fsSL https://raw.githubusercontent.com/asuzukosi/opensymphony/main/scripts/install.sh | bash
#
# what it installs from:
#   the latest *published* github release assets for asuzukosi/opensymphony
#   (draft releases from ci are invisible until you click publish)
# -----------------------------------------------------------------------------

# fail on error, unset vars, and pipe failures
set -euo pipefail

# -----------------------------------------------------------------------------
# config
# -----------------------------------------------------------------------------
REPO="asuzukosi/opensymphony"
APP_NAME="Open Symphony"
# linux only: where the appimage lands (override with OPENSIMPHONY_INSTALL_DIR)
INSTALL_DIR="${OPENSIMPHONY_INSTALL_DIR:-$HOME/.local/bin}"

# -----------------------------------------------------------------------------
# helpers
# -----------------------------------------------------------------------------
log() {
  printf 'opensymphony: %s\n' "$*"
}

die() {
  printf 'opensymphony: error: %s\n' "$*" >&2
  exit 1
}

# exit if a required command is missing from PATH
need() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

# -----------------------------------------------------------------------------
# prereqs — only curl + uname; no rust/bun/node needed
# -----------------------------------------------------------------------------
need curl
need uname

# -----------------------------------------------------------------------------
# detect os + arch, then pick a filename glob that matches tauri-action assets
# examples: Open Symphony_0.1.0_aarch64.dmg, Open Symphony_0.1.0_amd64.AppImage
# -----------------------------------------------------------------------------
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
    # bash on windows is awkward for .exe installers; send people to the release page
    die "windows: download the .exe installer from https://github.com/${REPO}/releases/latest"
    ;;
  *)
    die "unsupported operating system: $os"
    ;;
esac

# -----------------------------------------------------------------------------
# fetch latest release metadata from the github api
# needs a published release; /releases/latest ignores drafts
# -----------------------------------------------------------------------------
api_url="https://api.github.com/repos/${REPO}/releases/latest"
log "fetching latest release from ${REPO}"

release_json="$(curl -fsSL "$api_url")"
tag="$(printf '%s' "$release_json" | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
[ -n "$tag" ] || die "could not resolve latest release tag (is a release published?)"

# -----------------------------------------------------------------------------
# parse assets out of the json (name + browser_download_url pairs)
# then keep the first asset whose name matches $asset_glob
# -----------------------------------------------------------------------------
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
  # lightweight parse: no jq dependency — walk name/url fields in order
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

# -----------------------------------------------------------------------------
# download the chosen installer into a temp directory
# -----------------------------------------------------------------------------
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
archive="${tmpdir}/${asset_name}"

log "downloading ${asset_name} (${tag})"
curl -fL --progress-bar -o "$archive" "$asset_url"

# -----------------------------------------------------------------------------
# install per platform
# -----------------------------------------------------------------------------
case "$os" in
  darwin)
    # open the dmg in finder; user drags .app into /applications
    log "opening disk image — drag ${APP_NAME}.app into Applications"
    open "$archive"
    # clear the cleanup trap so the dmg is not deleted while finder still needs it
    trap - EXIT
    log "done. launch ${APP_NAME} from Applications when the copy finishes."
    ;;
  linux)
    # appimage is a self-contained executable — copy it onto PATH
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
