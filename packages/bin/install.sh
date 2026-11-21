#!/bin/sh
# Installs the single-file svjeez for this machine from the newest GitHub release that has one:
#
#   curl -fsSL https://raw.githubusercontent.com/saiashirwad/svjeez/main/packages/bin/install.sh | sh
#
# SVJEEZ_VERSION=v0.8.0 installs that release instead; SVJEEZ_INSTALL=/usr/local/bin installs there instead of
# ~/.local/bin. On Windows, download svjeez-windows-x64.exe from the releases page.
set -eu

repo=saiashirwad/svjeez
fail() {
  echo "svjeez: $*" >&2
  exit 1
}

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) fail "no build for $(uname -s) here; download one from https://github.com/$repo/releases" ;;
esac

case "$(uname -m)" in
  x86_64 | amd64) arch=x64 ;;
  arm64 | aarch64) arch=arm64 ;;
  *) fail "no build for $(uname -m)" ;;
esac

# A shell running under Rosetta reports x86_64 on Apple silicon; the native build is faster.
if [ "$os" = darwin ] && [ "$arch" = x64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || true)" = 1 ]; then
  arch=arm64
fi

asset="svjeez-$os-$arch"

if [ -n "${SVJEEZ_VERSION:-}" ]; then
  tag=$SVJEEZ_VERSION
else
  # Releases come newest first; svjeez's are tagged v<version>, the add-on packages' @svjeez/<name>@<version>.
  tag=$(curl -fsSL "https://api.github.com/repos/$repo/releases?per_page=50" |
    grep -o "/releases/download/v[^/\"]*/$asset\"" | head -n 1 | cut -d/ -f4) || true
  [ -n "$tag" ] || fail "no release has $asset yet"
fi

dir=${SVJEEZ_INSTALL:-$HOME/.local/bin}
base="https://github.com/$repo/releases/download/$tag"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "downloading svjeez $tag ($asset)"
curl -fL --progress-bar "$base/$asset" -o "$tmp/$asset"
curl -fsSL "$base/svjeez-checksums.txt" -o "$tmp/sums"

expected=$(grep " $asset\$" "$tmp/sums" | cut -d' ' -f1)

if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "$tmp/$asset" | cut -d' ' -f1)
else
  actual=$(shasum -a 256 "$tmp/$asset" | cut -d' ' -f1)
fi

[ -n "$expected" ] && [ "$expected" = "$actual" ] || fail "$asset doesn't match its checksum in $tag"

mkdir -p "$dir"
chmod +x "$tmp/$asset"
mv "$tmp/$asset" "$dir/svjeez"

echo "installed $("$dir/svjeez" version) at $dir/svjeez"

case ":$PATH:" in
  *":$dir:"*) ;;
  *) echo "$dir isn't on your PATH: add it, or run $dir/svjeez" ;;
esac

echo "next: svjeez init scenes && svjeez check scenes/scene.tsx"
