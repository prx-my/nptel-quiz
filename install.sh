#!/usr/bin/env bash
#
# nptel-quiz installer (macOS)
#
#   curl -fsSL https://raw.githubusercontent.com/prx-my/nptel-quiz/main/install.sh | bash
#
# Installs into ~/.nptel-quiz, builds the on-device OCR binary, installs
# Playwright's Chromium, and links the `nptel-quiz` command onto your PATH.

set -euo pipefail

REPO="${NPTEL_QUIZ_REPO:-prx-my/nptel-quiz}"
REF="${NPTEL_QUIZ_REF:-main}"
APP_DIR="${NPTEL_QUIZ_HOME:-$HOME/.nptel-quiz}"

c_info() { printf "\033[1;36m[nptel-quiz]\033[0m %s\n" "$*"; }
c_warn() { printf "\033[1;33m[nptel-quiz]\033[0m %s\n" "$*"; }
c_err()  { printf "\033[1;31m[nptel-quiz]\033[0m %s\n" "$*" >&2; }

# --- 1. Platform -------------------------------------------------------------
if [ "$(uname -s)" != "Darwin" ]; then
  c_err "nptel-quiz targets macOS (Apple Vision OCR). Detected: $(uname -s)."
  exit 1
fi

# --- 2. Node.js --------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    c_info "Installing Node.js via Homebrew..."
    brew install node
  else
    c_err "Node.js >= 18 is required. Install it first:  brew install node"
    exit 1
  fi
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  c_err "Node.js >= 18 required (found $(node -v))."
  exit 1
fi

# --- 3. Xcode Command Line Tools (for swiftc) --------------------------------
if ! xcode-select -p >/dev/null 2>&1; then
  c_warn "Xcode Command Line Tools are missing. A system dialog may open now."
  xcode-select --install >/dev/null 2>&1 || true
  c_warn "Finish the CLT install, then re-run this installer if OCR did not build."
fi

# --- 4. Fetch source ---------------------------------------------------------
c_info "Downloading nptel-quiz@${REF} from ${REPO}..."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
TARBALL_URL="https://codeload.github.com/${REPO}/tar.gz/refs/heads/${REF}"
if ! curl -fsSL "$TARBALL_URL" -o "$TMP/src.tar.gz"; then
  c_err "Download failed: $TARBALL_URL"
  exit 1
fi
mkdir -p "$TMP/src"
tar -xzf "$TMP/src.tar.gz" -C "$TMP/src" --strip-components=1

# --- 5. Install files --------------------------------------------------------
c_info "Installing into ${APP_DIR}..."
mkdir -p "$APP_DIR"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude node_modules --exclude 'bin/ocr' "$TMP/src/" "$APP_DIR/"
else
  cp -R "$TMP/src/." "$APP_DIR/"
fi
cd "$APP_DIR"

# --- 6. Dependencies ---------------------------------------------------------
c_info "Installing dependencies..."
npm install --omit=dev --no-audit --no-fund

# --- 7. Chromium -------------------------------------------------------------
c_info "Installing Chromium for Playwright (one-time, ~150MB)..."
npx --yes playwright install chromium

# --- 8. Native OCR -----------------------------------------------------------
c_info "Building native OCR (Apple Vision)..."
node scripts/build-ocr.js || true
if [ ! -x "$APP_DIR/bin/ocr" ]; then
  c_warn "OCR binary was not built. After installing Xcode CLT run:"
  c_warn "  cd \"$APP_DIR\" && npm run build:ocr"
fi

# --- 9. Link CLI -------------------------------------------------------------
if [ -n "${NPTEL_QUIZ_BIN_DIR:-}" ]; then
  BIN_DIR="$NPTEL_QUIZ_BIN_DIR"
elif [ -w /usr/local/bin ]; then
  BIN_DIR="/usr/local/bin"
else
  BIN_DIR="$HOME/.local/bin"
fi
mkdir -p "$BIN_DIR"
chmod +x "$APP_DIR/bin/nptel-quiz.js"
ln -sf "$APP_DIR/bin/nptel-quiz.js" "$BIN_DIR/nptel-quiz"
c_info "Linked: $BIN_DIR/nptel-quiz"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) c_warn "Add $BIN_DIR to PATH:  echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> ~/.zshrc" ;;
esac

# --- 10. Verify --------------------------------------------------------------
c_info "Verifying installation..."
node "$APP_DIR/bin/nptel-quiz.js" doctor || true

cat <<EOF

  Done. Next steps:

    1) nptel-quiz login        # sign in once (Google SSO), profile is saved
    2) export GEMINI_API_KEY=...   # only needed for 'nptel-quiz run'
    3) nptel-quiz run --url "<quiz url>"

  Agent (opencode) flow:
    nptel-quiz ocr --url "<quiz url>"      # emits questions for the agent
    nptel-quiz submit --url "<quiz url>" --answers "a,b,c,..."

EOF
