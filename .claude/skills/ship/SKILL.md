---
name: ship
description: Unify Junga Workspace across this computer, GitHub main, and the live site at tylergriffith.us/JungaWorkspace. Use when Tyler asks to commit, push, merge, sync, deploy, ship, or "get everything in line" after work done in another chat, or asks where the three copies stand.
---

# Ship

Everything lives on one branch, `main`. `scripts/ship.sh` does the whole
linear path in one run: commit pending changes, fast-forward (or rebase)
against origin, `npm run check`, push, wait for CI, vendor the build into
the website repo, push it, pull it on the host, and confirm the live page
serves the new build. Details and refusals: `docs/RELEASING.md`.

Deploying is Tyler's decision. This skill runs only when he asks for it in
chat; an agent finishing a feature never runs it as a side effect.

## Procedure

1. **See where things stand.**

   ```sh
   npm run status
   ```

   It prints local HEAD, origin/main, what the website repo vendors, and
   what the live site serves, then lists what is out of line.

2. **If the tree is dirty, write the commit message from the diff**, not
   from guesswork: `git status --short`, `git diff --stat`, and the newest
   entries in `docs/WORK_LOG.md` and `docs/DECISIONS.md` (the other chat
   usually wrote them). Subject line in the imperative, under 72 characters,
   saying what changed for the user; a body only if the subject cannot
   carry it. Do not commit anything under `JungaLibrarySaves/`, builds, or
   test artifacts; the script refuses new library backups and files over
   5 MB, but look anyway.

3. **Ship.**

   ```sh
   npm run ship -- -m "Subject line"
   ```

   Use `--no-deploy` when Tyler only asked to push, `--no-wait` only if he
   says to skip CI, `--e2e` to run the Chromium suite locally as well.
   `--dry-run` shows the plan without changing anything.

4. **If it stops, fix the cause, not the guard.** A rebase conflict is
   resolved by hand and then `ship` is re-run. A failing `npm run check` or
   a red CI run means the code is not ready; report what failed and stop.
   Never pass `--allow-unpushed` or `--skip-checks` to `deploy.sh` to get
   past a red run.

5. **Report** the final status block the script prints: the sha now on
   local, GitHub, and the live site, and the CI run URL. One paragraph.
