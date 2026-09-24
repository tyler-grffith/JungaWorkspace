#!/usr/bin/env bash
# Build Junga Workspace and vendor the output into the tylergriffith.us
# website repo's JungaWorkspace/ folder, then commit it there.
#
# The website repo has no build step of its own — it vendors this repo's
# dist/ output as plain static files (see README.md "Deploying"). This
# script does that copy and commit; it does not push or touch the live
# server unless you pass --push / --live, and never runs those as a side
# effect of anything else.
#
# Usage: scripts/deploy.sh [--push] [--live] [--skip-checks] [--prebuilt] [--allow-unpushed]
#   (no flags)       check, build, vendor, commit locally in the website repo
#   --push           also `git push` the website repo
#   --live           also SSH into the host and `git pull` (implies --push)
#   --skip-checks    build without running `npm run check` first
#   --prebuilt       vendor the existing dist/ as is (scripts/ship.sh has
#                    just checked and built it); implies --skip-checks
#   --allow-unpushed deploy a commit that is not on origin/main yet
#
# scripts/ship.sh is the one-command path (commit, sync, check, push, CI,
# then this script with --live --prebuilt). Run this directly when you want
# only the website half.
#
# What gets published is whatever is checked out here, so by default this
# refuses to publish a commit GitHub has never seen: if it is not on
# origin/main, CI never ran on it. See docs/RELEASING.md.
#
# Env vars:
#   WEBSITE_REPO     path to the tylergriffith.us checkout
#                    (default: a sibling directory next to this repo)
#   DEPLOY_SSH_HOST  ssh target for --live (default: junga.com@ssh.us.stackcp.com)
#   DEPLOY_SSH_DIR   remote directory to `git pull` in (default: tylergriffith.us)

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBSITE_REPO="${WEBSITE_REPO:-$APP_DIR/../tylergriffith.us}"
DEST="$WEBSITE_REPO/JungaWorkspace"
SSH_HOST="${DEPLOY_SSH_HOST:-junga.com@ssh.us.stackcp.com}"
SSH_DIR="${DEPLOY_SSH_DIR:-tylergriffith.us}"

PUSH=false
LIVE=false
CHECKS=true
PREBUILT=false
REQUIRE_PUSHED=true
for arg in "$@"; do
  case "$arg" in
    --push) PUSH=true ;;
    --live) PUSH=true; LIVE=true ;;
    --skip-checks) CHECKS=false ;;
    --prebuilt) CHECKS=false; PREBUILT=true ;;
    --allow-unpushed) REQUIRE_PUSHED=false ;;
    *)
      echo "Unknown flag: $arg (expected --push, --live, --skip-checks, --prebuilt or --allow-unpushed)" >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$WEBSITE_REPO/.git" ]]; then
  echo "No git repo at $WEBSITE_REPO. Set WEBSITE_REPO to your tylergriffith.us checkout." >&2
  exit 1
fi

cd "$APP_DIR"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "JungaWorkspace working tree is not clean. Commit or stash before deploying." >&2
  exit 1
fi
if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "Warning: deploying from $(git branch --show-current), not main." >&2
fi
APP_SHA="$(git rev-parse --short HEAD)"

# Publishing a commit that never reached GitHub publishes code CI never saw.
if $REQUIRE_PUSHED; then
  if git fetch -q origin main 2>/dev/null; then
    if ! git merge-base --is-ancestor HEAD origin/main; then
      echo "HEAD ($APP_SHA) is not on origin/main, so CI has not run on it." >&2
      echo "Merge it first, or pass --allow-unpushed to publish it anyway." >&2
      exit 1
    fi
  else
    echo "Warning: could not reach origin, so this build was not verified against main." >&2
  fi
fi

if $PREBUILT; then
  [[ -f dist/index.html ]] || { echo "--prebuilt given but dist/index.html does not exist; run npm run build first." >&2; exit 1; }
  echo "==> Vendoring the existing dist/ @ $APP_SHA (prebuilt)"
elif $CHECKS; then
  echo "==> Checking Junga Workspace @ $APP_SHA"
  npm run check
else
  echo "==> Building Junga Workspace @ $APP_SHA (checks skipped)"
  npm run build
fi

echo "==> Vendoring dist/ into $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r dist/. "$DEST/"

cd "$WEBSITE_REPO"
if [[ -z "$(git status --porcelain -- JungaWorkspace)" ]]; then
  echo "No changes: $DEST already matches this build. Nothing to commit."
  exit 0
fi

git add JungaWorkspace
git commit -m "Deploy Junga Workspace @ $APP_SHA"
echo "==> Committed in $WEBSITE_REPO"

if $PUSH; then
  echo "==> Pushing $WEBSITE_REPO"
  git push
fi

if $LIVE; then
  echo "==> Deploying live: ssh $SSH_HOST"
  ssh "$SSH_HOST" "cd $SSH_DIR && git pull"
fi

echo "Done."
