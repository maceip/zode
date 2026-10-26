#!/usr/bin/env bash
#
# Publish the Zode repository to GitHub as a PUBLIC repo named `zode`.
#
# Requires a GitHub token with `repo` scope. Provide it in ONE of these ways:
#
#   1. Environment variable (recommended):
#        export GH_TOKEN=ghp_xxxxxxxxxxxxxxxx
#        ./scripts/publish-github.sh
#
#   2. Existing `gh` CLI session:
#        gh auth login
#        ./scripts/publish-github.sh
#
#   3. Interactive prompt (if neither is set).
#
# The script is idempotent: if the repo already exists it will push to it
# instead of failing.
#
set -euo pipefail

REPO_NAME="${ZODE_REPO_NAME:-zode}"
REPO_OWNER="${ZODE_REPO_OWNER:-}"
REMOTE_URL=""
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT"

command -v gh >/dev/null 2>&1 || {
  echo "error: the GitHub CLI ('gh') is required." >&2
  echo "  macOS:   brew install gh" >&2
  echo "  Windows: winget install GitHub.cli" >&2
  exit 1
}

# ---- resolve auth ---------------------------------------------------------
if [[ -z "${GH_TOKEN:-}" && -z "${GITHUB_TOKEN:-}" ]]; then
  if gh auth status >/dev/null 2>&1; then
    echo "==> using existing gh authentication"
  else
    echo "No GitHub credentials found."
    echo "Create a token at https://github.com/settings/tokens/new with the 'repo' scope."
    printf "Paste token (input hidden): "
    read -rs GH_TOKEN
    echo
    export GH_TOKEN
  fi
fi

# ---- sanity checks --------------------------------------------------------
if [[ ! -d .git ]]; then
  echo "==> initialising git repository"
  git init -q -b main
  git config user.name  "${ZODE_GIT_NAME:-zode}"
  git config user.email "${ZODE_GIT_EMAIL:-zode@users.noreply.github.com}"
fi

if [[ -z "$(git status --porcelain)" ]]; then
  echo "==> nothing to commit; working tree is clean"
else
  echo "==> staging and committing"
  git add -A
  git commit -q -m "Zode: native shells, Metro web app, and mobile clients"
fi

# ---- create / push --------------------------------------------------------
target_args=(--repo "$REPO_NAME")
if [[ -n "$REPO_OWNER" ]]; then
  target_args=(--repo "$REPO_OWNER/$REPO_NAME")
fi

if gh repo view "${target_args[@]}" >/dev/null 2>&1; then
  echo "==> repository already exists; pushing"
else
  echo "==> creating PUBLIC repository '$REPO_NAME'"
  gh repo create "$REPO_NAME" \
    --public \
    --source=. \
    --remote=origin \
    --description "Zune-era agent app — native macOS/Windows shells, Metro web app, iOS + Android" \
    "${target_args[@]:2}"
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo set-default "${target_args[@]}" >/dev/null 2>&1 || true
  git remote add origin "https://github.com/${REPO_OWNER:-$(
    gh api user --jq .login 2>/dev/null || echo ""
  )}/$REPO_NAME.git" 2>/dev/null || true
fi

echo "==> pushing to origin"
git push -u origin main

echo
echo "Done. Repository: https://github.com/${REPO_OWNER:+$REPO_OWNER/}$REPO_NAME"
echo
echo "Optional follow-ups:"
echo "  gh repo edit $REPO_NAME --homepage 'https://github.com/$REPO_NAME'"
echo "  # upload the social preview image (1280x640) as the repo social preview:"
echo "  #   open Settings -> General -> Social preview -> upload icons/social-preview.png"
