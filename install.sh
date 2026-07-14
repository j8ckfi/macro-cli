#!/bin/sh
set -eu

REPOSITORY="j8ckfi/macro-cli"
DEFAULT_PACKAGE="https://github.com/${REPOSITORY}/archive/refs/heads/main.tar.gz"
PACKAGE="${MACRO_CLI_PACKAGE:-$DEFAULT_PACKAGE}"
PREFIX="${MACRO_CLI_PREFIX:-${HOME:?HOME is not set}/.local}"

for command_name in node npm; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'macro-cli installer: %s is required but was not found on PATH\n' "$command_name" >&2
    exit 1
  fi
done

if ! node -e '
  const [major, minor] = process.versions.node.split(".").map(Number);
  process.exit(major > 18 || (major === 18 && minor >= 14) ? 0 : 1);
'; then
  printf 'macro-cli installer: Node.js 18.14 or newer is required (found %s)\n' "$(node --version)" >&2
  exit 1
fi

umask 022
mkdir -p "$PREFIX"

printf 'Installing Macro CLI into %s...\n' "$PREFIX"
npm install \
  --global \
  --prefix "$PREFIX" \
  --ignore-scripts \
  --no-audit \
  --no-fund \
  "$PACKAGE"

MACRO_BIN="$PREFIX/bin/macro"
if [ ! -x "$MACRO_BIN" ]; then
  printf 'macro-cli installer: installation completed but %s is not executable\n' "$MACRO_BIN" >&2
  exit 1
fi

printf '\nMacro CLI installed: %s\n' "$MACRO_BIN"
printf 'Next: macro login\n'

case ":${PATH:-}:" in
  *":$PREFIX/bin:"*) ;;
  *)
    printf '\n%s is not currently on PATH. Add this to your shell profile:\n' "$PREFIX/bin"
    printf '  export PATH="%s/bin:$PATH"\n' "$PREFIX"
    ;;
esac
