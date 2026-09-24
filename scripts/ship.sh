#!/usr/bin/env bash
# One command to bring the three copies of Junga Workspace into line:
#
#   this checkout  ──commit, push──▶  GitHub main  ──deploy──▶  tylergriffith.us/JungaWorkspace/
#
# Everything lives on one branch (main), so the whole path is linear:
# commit what is pending, fast-forward against origin, check, push, wait for
# CI, vendor the build into the website repo, push that, pull it on the host,
# and confirm the live page serves the build that was just made.
#
# Usage: scripts/ship.sh [options]
#   --status         report where the three copies stand and change nothing
#   -m "message"     commit message for pending changes (required when the
#                    tree is dirty; may also be given as the first bare argument)
#   --no-deploy      stop after pushing to GitHub
#   --no-wait        do not wait for CI before deploying
#   --e2e            also run the Chromium suite locally before pushing
#   --allow-large    permit new files over 5 MB
#   --dry-run        print the plan, run nothing that changes state
#
# Env vars (all optional): WEBSITE_REPO, DEPLOY_SSH_HOST, DEPLOY_SSH_DIR are
# passed through to scripts/deploy.sh; LIVE_URL overrides the page checked
# at the end (default https://tylergriffith.us/JungaWorkspace/).
#
# Refusals, and why:
#   not on main                 the one-branch flow only makes sense from main
#   dirty tree and no -m        what ships must be a commit with a message
#   new file under JungaLibrarySaves/ or over 5 MB
#                               library backups and blobs do not belong in git
#   local and origin diverged and rebase conflicts
#                               a human resolves that; the script stops cleanly
#   npm run check fails         nothing broken reaches GitHub or the site
#   CI failed or was cancelled  the site only ever serves what CI passed

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBSITE_REPO="${WEBSITE_REPO:-$APP_DIR/../tylergriffith.us}"
LIVE_URL="${LIVE_URL:-https://tylergriffith.us/JungaWorkspace/}"
LARGE_BYTES=$((5 * 1024 * 1024))

STATUS_ONLY=false
DEPLOY=true
WAIT_CI=true
E2E=false
ALLOW_LARGE=false
DRY_RUN=false
MESSAGE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --status) STATUS_ONLY=true ;;
    --no-deploy) DEPLOY=false ;;
    --no-wait) WAIT_CI=false ;;
    --e2e) E2E=true ;;
    --allow-large) ALLOW_LARGE=true ;;
    --dry-run) DRY_RUN=true ;;
    -m|--message)
      shift
      [[ $# -gt 0 ]] || { echo "-m needs a message" >&2; exit 1; }
      MESSAGE="$1"
      ;;
    -m*) MESSAGE="${1#-m}" ;;
    --help|-h) sed -n '2,40p' "${BASH_SOURCE[0]}"; exit 0 ;;
    --*) echo "Unknown flag: $1 (see --help)" >&2; exit 1 ;;
    *)
      if [[ -z "$MESSAGE" ]]; then MESSAGE="$1"; else
        echo "Unexpected argument: $1" >&2; exit 1
      fi
      ;;
  esac
  shift
done

say()  { printf '\n==> %s\n' "$*"; }
note() { printf '    %s\n' "$*"; }
fail() { printf '\nSTOP: %s\n' "$*" >&2; exit 1; }
run()  { if $DRY_RUN; then note "(dry-run) $*"; else "$@"; fi; }

cd "$APP_DIR"

# --- gather state ---------------------------------------------------------

BRANCH="$(git branch --show-current)"
git fetch -q origin main || fail "could not fetch origin"
DIRTY="$(git status --porcelain)"
LOCAL_SHA="$(git rev-parse --short HEAD)"
ORIGIN_SHA="$(git rev-parse --short origin/main)"
read -r AHEAD BEHIND <<<"$(git rev-list --left-right --count HEAD...origin/main)"

website_state() {
  # Prints: <deployed source sha or ?> <website unpushed count or ?> <live sha or ?>
  local deployed="?" unpushed="?" live="?"
  if [[ -d "$WEBSITE_REPO/.git" ]]; then
    local subject
    subject="$(git -C "$WEBSITE_REPO" log -1 --format=%s -- JungaWorkspace 2>/dev/null || true)"
    [[ "$subject" =~ @\ ([0-9a-f]{7,}) ]] && deployed="${BASH_REMATCH[1]}"
    git -C "$WEBSITE_REPO" fetch -q origin 2>/dev/null || true
    unpushed="$(git -C "$WEBSITE_REPO" rev-list --count '@{u}..HEAD' 2>/dev/null || echo '?')"
  fi
  # The live page and the vendored index.html name the same hashed entry
  # bundle when they are the same build; the website repo's deploy commit
  # says which source sha that build came from.
  local live_entry vendored_entry
  live_entry="$(curl -fsS --max-time 15 "$LIVE_URL" 2>/dev/null | grep -o 'assets/index-[^"]*\.js' | head -1 || true)"
  vendored_entry="$(grep -o 'assets/index-[^"]*\.js' "$WEBSITE_REPO/JungaWorkspace/index.html" 2>/dev/null | head -1 || true)"
  if [[ -n "$live_entry" && "$live_entry" == "$vendored_entry" ]]; then
    live="$deployed"
  elif [[ -n "$live_entry" ]]; then
    live="other"
  fi
  echo "$deployed $unpushed $live"
}

print_status() {
  read -r DEPLOYED WEB_UNPUSHED LIVE <<<"$(website_state)"
  local dirty_n
  dirty_n="$(printf '%s' "$DIRTY" | grep -c . || true)"
  printf '\n%-22s %s\n' "branch" "$BRANCH"
  printf '%-22s %s%s\n' "local HEAD" "$LOCAL_SHA" "$([[ -n "$DIRTY" ]] && echo "  (+ $dirty_n uncommitted paths)")"
  printf '%-22s %s  (local ahead %s, behind %s)\n' "origin/main" "$ORIGIN_SHA" "$AHEAD" "$BEHIND"
  printf '%-22s %s%s\n' "website repo vendors" "$DEPLOYED" "$([[ "$WEB_UNPUSHED" != "0" ]] && echo "  ($WEB_UNPUSHED unpushed website commit(s))")"
  case "$LIVE" in
    other) printf '%-22s %s\n' "live site serves" "a different build than the website repo (server not pulled?)" ;;
    "?")   printf '%-22s %s\n' "live site serves" "unreachable" ;;
    *)     printf '%-22s %s\n' "live site serves" "$LIVE" ;;
  esac
  echo
  if [[ -z "$DIRTY" && "$AHEAD" == 0 && "$BEHIND" == 0 && "$LIVE" == "$LOCAL_SHA" && "$WEB_UNPUSHED" == 0 ]]; then
    echo "Everything is in sync."
    return 0
  fi
  [[ -n "$DIRTY" ]]        && echo "- uncommitted changes here (ship with -m \"message\")"
  [[ "$AHEAD"  != 0 ]]     && echo "- $AHEAD local commit(s) not on GitHub"
  [[ "$BEHIND" != 0 ]]     && echo "- $BEHIND commit(s) on GitHub not here (ship fast-forwards, or rebases if diverged)"
  [[ "$LIVE" != "$LOCAL_SHA" ]] && echo "- live site is not serving local HEAD"
  [[ "$WEB_UNPUSHED" != 0 && "$WEB_UNPUSHED" != "?" ]] && echo "- website repo has commits not pushed"
  return 1
}

if $STATUS_ONLY; then
  print_status || true
  exit 0
fi

# --- preflight -----------------------------------------------------------

[[ "$BRANCH" == "main" ]] || fail "on '$BRANCH', not main. The one-branch flow ships from main only."
command -v gh >/dev/null || fail "gh (GitHub CLI) is required for the CI wait; install it or pass --no-wait"
$DRY_RUN && say "DRY RUN — nothing below changes state"

# --- 1. commit what is pending --------------------------------------------

if [[ -n "$DIRTY" ]]; then
  say "Pending changes"
  git status --short
  [[ -n "$MESSAGE" ]] || fail "the tree is dirty and no commit message was given (-m \"...\")"

  # Guard against sweeping in things that must never be committed.
  while IFS= read -r line; do
    [[ "$line" == "?? "* ]] || continue
    path="${line#?? }"; path="${path%\"}"; path="${path#\"}"
    [[ "$path" == JungaLibrarySaves/* ]] && fail "new library backup $path would be committed; move it or add it to .gitignore"
    while IFS= read -r f; do
      size=$(stat -c %s "$f" 2>/dev/null || echo 0)
      if (( size > LARGE_BYTES )) && ! $ALLOW_LARGE; then
        fail "$f is $((size / 1024 / 1024)) MB; pass --allow-large if that is intended"
      fi
    done < <(find "$path" -type f 2>/dev/null)
  done <<<"$DIRTY"

  say "Committing: $MESSAGE"
  run git add -A
  run git commit -q -m "$MESSAGE"
  $DRY_RUN || LOCAL_SHA="$(git rev-parse --short HEAD)"
  $DRY_RUN || read -r AHEAD BEHIND <<<"$(git rev-list --left-right --count HEAD...origin/main)"
elif [[ -n "$MESSAGE" ]]; then
  note "Tree is clean; the message \"$MESSAGE\" is not needed and was ignored."
fi

# --- 2. line up with origin ----------------------------------------------

if [[ "$BEHIND" != 0 ]]; then
  if [[ "$AHEAD" == 0 ]]; then
    say "Fast-forwarding to origin/main ($BEHIND commit(s))"
    run git merge -q --ff-only origin/main
  else
    say "Diverged: $AHEAD local, $BEHIND remote. Rebasing local commits onto origin/main"
    if ! run git rebase -q origin/main; then
      git rebase --abort || true
      fail "rebase hit conflicts. Resolve by hand: git rebase origin/main, then re-run ship."
    fi
  fi
  $DRY_RUN || LOCAL_SHA="$(git rev-parse --short HEAD)"
  $DRY_RUN || read -r AHEAD BEHIND <<<"$(git rev-list --left-right --count HEAD...origin/main)"
fi

read -r DEPLOYED WEB_UNPUSHED LIVE <<<"$(website_state)"
NEED_PUSH=$([[ "$AHEAD" != 0 ]] && echo true || echo false)
NEED_DEPLOY=false
if $DEPLOY && { [[ "$LIVE" != "$LOCAL_SHA" ]] || [[ "$WEB_UNPUSHED" != 0 ]]; }; then NEED_DEPLOY=true; fi
if $DRY_RUN && [[ -n "$DIRTY" ]]; then NEED_PUSH=true; NEED_DEPLOY=$DEPLOY; fi

if ! $NEED_PUSH && ! $NEED_DEPLOY; then
  say "Nothing to do"
  print_status || true
  exit 0
fi

# --- 3. check locally ----------------------------------------------------

say "Checking @ $LOCAL_SHA (unit tests, TypeScript, production build)"
run npm run check
if $E2E; then
  say "Chromium suite"
  run npm run test:e2e
fi

# --- 4. push -------------------------------------------------------------

if $NEED_PUSH; then
  say "Pushing main → origin ($( $DRY_RUN && [[ -n "$DIRTY" ]] && echo "$((AHEAD + 1))" || echo "$AHEAD") commit(s))"
  run git push -q origin main
fi

# --- 5. wait for CI ------------------------------------------------------

if $NEED_DEPLOY && $WAIT_CI && ! $DRY_RUN; then
  FULL_SHA="$(git rev-parse HEAD)"
  say "Waiting for CI (Application checks) on $LOCAL_SHA"
  RUN_ID=""
  for _ in $(seq 1 30); do
    RUN_ID="$(gh run list --workflow 'Application checks' --commit "$FULL_SHA" --limit 1 --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null || true)"
    [[ -n "$RUN_ID" ]] && break
    sleep 4
  done
  [[ -n "$RUN_ID" ]] || fail "no CI run appeared for $LOCAL_SHA after two minutes. Check GitHub, or re-run with --no-wait."
  note "run $RUN_ID: $(gh run view "$RUN_ID" --json url --jq .url)"
  if ! gh run watch "$RUN_ID" --exit-status --interval 10 >/dev/null; then
    CONCLUSION="$(gh run view "$RUN_ID" --json conclusion --jq .conclusion)"
    fail "CI finished with '$CONCLUSION'; not deploying. See: gh run view $RUN_ID --log-failed"
  fi
  note "CI passed"
elif $NEED_DEPLOY && ! $WAIT_CI; then
  note "Not waiting for CI (--no-wait); local checks are the only gate for this deploy."
fi

# --- 6. deploy -----------------------------------------------------------

if $NEED_DEPLOY; then
  say "Deploying to the website repo and the live host"
  run scripts/deploy.sh --live --prebuilt
fi

# --- 7. verify -----------------------------------------------------------

if $DRY_RUN; then
  say "Dry run complete"
  exit 0
fi

if $NEED_DEPLOY; then
  say "Verifying $LIVE_URL"
  LOCAL_ENTRY="$(grep -o 'assets/index-[^"]*\.js' dist/index.html | head -1)"
  LIVE_ENTRY=""
  for _ in $(seq 1 6); do
    LIVE_ENTRY="$(curl -fsS --max-time 15 "$LIVE_URL" | grep -o 'assets/index-[^"]*\.js' | head -1 || true)"
    [[ "$LIVE_ENTRY" == "$LOCAL_ENTRY" ]] && break
    sleep 5
  done
  if [[ "$LIVE_ENTRY" == "$LOCAL_ENTRY" ]]; then
    note "live page serves this build ($LOCAL_ENTRY)"
  else
    fail "live page serves '${LIVE_ENTRY:-nothing}', expected '$LOCAL_ENTRY'. The host pull may have failed; check with ssh."
  fi
fi

# Re-read everything so the summary reflects what actually happened.
git fetch -q origin main || true
DIRTY="$(git status --porcelain)"
LOCAL_SHA="$(git rev-parse --short HEAD)"
ORIGIN_SHA="$(git rev-parse --short origin/main)"
read -r AHEAD BEHIND <<<"$(git rev-list --left-right --count HEAD...origin/main)"
say "Done"
print_status || true
