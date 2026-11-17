---
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch --show-current:*), Bash(git rev-parse:*), Bash(git merge-base:*), Bash(git symbolic-ref:*), Bash(git remote:*), Bash(git fetch:*), Bash(git rebase origin/:*), Bash(git rebase --abort:*), Bash(git push origin HEAD:*), Bash(gh auth status:*), Bash(gh run list:*), Bash(gh run watch:*), Bash(gh run view:*), Bash(gitleaks:*), Bash(pnpm typecheck:*), Bash(pnpm run typecheck:*), Bash(pnpm lint:*), Bash(pnpm run lint:*), Bash(pnpm test:*), Bash(pnpm run test:*), Bash(pnpm build:*), Bash(pnpm run build:*), Bash(npm typecheck:*), Bash(npm run typecheck:*), Bash(npm lint:*), Bash(npm run lint:*), Bash(npm test:*), Bash(npm run test:*), Bash(npm build:*), Bash(npm run build:*), Bash(yarn typecheck:*), Bash(yarn run typecheck:*), Bash(yarn lint:*), Bash(yarn run lint:*), Bash(yarn test:*), Bash(yarn run test:*), Bash(yarn build:*), Bash(yarn run build:*), Bash(bun typecheck:*), Bash(bun run typecheck:*), Bash(bun lint:*), Bash(bun run lint:*), Bash(bun test:*), Bash(bun run test:*), Bash(bun build:*), Bash(bun run build:*), Bash(cargo check:*), Bash(cargo clippy:*), Bash(cargo test:*), Bash(cargo build:*), Bash(uv run pytest:*), Bash(uv run mypy:*), Bash(uv run ruff:*), Bash(make typecheck:*), Bash(make lint:*), Bash(make test:*), Bash(make build:*), Read, Grep, Glob
argument-hint: [base-branch]
description: Push local commits straight to the default branch after a validation gate (the full suite when the version changes, the related tests otherwise) — the everyday delivery path when work is not running under /impl:ship
---

## Context

Current git status:
!`git status --short`

Current branch:
!`git branch --show-current`

Recent commits (empty means the repository has no commits yet):
!`git log --oneline -15 --ignore-missing HEAD`

Remotes:
!`git remote -v`

## Task

Push the local commits on the default branch straight to `origin`, with no branch and no pull request.

This is the everyday delivery path. Only `/impl:ship` delivers through `/git:pr --merge`; everything else — free-form changes, a standalone `/impl:fix`, `/impl:feature`, or `/impl:refactor` — ends here. Since no pull request and no pre-merge CI stand between these commits and the default branch, **this command's gate is the only gate**: it runs the full suite whenever the version changes, and the tests related to the change otherwise (step 3).

Arguments (`$ARGUMENTS`): a branch name to use as the base branch instead of the repository default.

Never force push. Never push a branch other than the base branch.

### 1. Check preconditions

Determine the base branch in this order: the user's argument > `git symbolic-ref refs/remotes/origin/HEAD` > `main` if it exists on the remote > `master`.

Stop and report instead of continuing if any of these hold:

- **The working tree has uncommitted changes.** Tell the user to run `/git:commit` first. Never stash, discard, reset, or commit them here.
- **The current branch is not the base branch.** A feature branch belongs to `/git:pr`. Do not switch branches or merge here.
- **There is no `origin` remote.** Report that the repository is local-only.
- **There are no commits ahead of `origin/<base>`** after fetching. Report that there is nothing to push.

### 2. Catch up with the remote

```sh
git fetch origin <base>
```

- Local is ahead only → continue.
- Local is behind or diverged → `git rebase origin/<base>`. This only replays commits that were never pushed, so no one else's history changes.
  - Conflicts → `git rebase --abort`, report the conflicting files, and stop. Do not resolve them here.

Nothing that is already on the remote may disappear: commits and files pushed from another computer or by someone else must all be in the history that goes out. Before moving on, confirm `git merge-base --is-ancestor origin/<base> HEAD` succeeds; if it does not, stop and report instead of pushing. Never skip this step and run `git push` by hand, even when the local branch looks like it is simply ahead — only the fetch shows what the remote really has.

### 3. Gate: run the validation

Take the commands from `docs/architecture/testing.md`, otherwise the plan's validation table, otherwise `docs/architecture/tech-stack.md`, otherwise `package.json` scripts or the CI workflow. Run them on the rebased commits:

1. Type check
2. Lint
3. **Tests** — the full suite or the related ones, by the rule below
4. Build
5. `test:smoke` when the project has a UI and `testing.md` defines it

#### Full or scoped: decided by the version

The end-to-end suite is the slow part, so its scope follows what is going out:

- **A version change → the full suite.** If any outgoing commit changes the project's release version — the `version` field of `package.json` (or `pyproject.toml`, `Cargo.toml`, `app.json`／`app.config.*`, `build.gradle`, `Info.plist`…), or a version tag is being pushed with these commits — run every test, end-to-end included (`test`／the 「全部」 command in `docs/architecture/testing.md`). A release is what reaches users, so that is where cross-module breakage must be caught.
- **Anything else → the related tests only.** Run the unit tests in full (they are fast), the build, and only the end-to-end specs related to the outgoing diff:
  1. `test:affected` (or the 「相關」 command in `testing.md`) when the project defines one.
  2. Otherwise pick them yourself from `git diff origin/<base>...HEAD --name-only`: every changed spec file; every spec that imports a changed module or helper; every spec that visits a changed page or calls a changed route (match the route path, the page's URL, and the component or view name); and, for a shared module (layout, auth, db client, fixtures, a component used across pages), every spec that depends on it — when in doubt, include the spec.
  3. A change with no runtime effect (docs only, comments, a test-only refactor of one spec) runs just the specs it touched, or none.

  List the specs you chose and why in the report, so the user can see what was and was not covered.

Check for a version change with `git diff origin/<base>...HEAD -- package.json` (and the other manifests the project has) and look at the `version` line itself — a dependency bump in the same file is not a version change.

Anything red → stop and report the failing command and its output. Do not push. Do not fix it here; hand it to `/impl:fix`.

A `verification.md` does not replace this run: it describes the commits it audited, while the rebase in step 2 may have put other people's commits underneath.

### 4. Review the outgoing diff

Run `git diff origin/<base>...HEAD --stat` for the file list, then read the full `git diff origin/<base>...HEAD`. Pushing is publication — what goes out is hard to take back.

If `gitleaks` is installed, scan the outgoing commits: `gitleaks git --log-opts="origin/<base>..HEAD"` (before 8.19: `gitleaks detect --log-opts="origin/<base>..HEAD"`). Any finding → stop. If it is not installed, say so in the report.

Stop and report the specific files if the diff contains:

- `.env`, `.env.*`, credentials, private keys, tokens, or certificates with private material
- `node_modules/`, `dist/`, `.next/`, `.turbo/`, or other build artifacts
- Debug leftovers: `console.log` added for tracing, commented-out blocks, `TODO: remove`

Do not edit the files or rewrite the commits — correcting the history is the user's call.

### 5. Push

```sh
git push origin HEAD:<base>
```

- Never use `--force` or `--force-with-lease`.
- Rejected because the remote moved in the meantime → go back to step 2 once. Rejected a second time, or rejected by branch protection → report it and stop. Branch protection means this repository expects pull requests; suggest `/git:pr`.

### 6. Watch CI on the base branch

If the repository has CI and `gh` is authenticated, find the run for the pushed commit (`gh run list --branch <base> --commit <sha>`) and wait for it with `gh run watch <id> --exit-status`. Cap the wait at about 20 minutes; run it in the background if the tool's timeout is shorter.

- Green → done.
- Red → report the failing job and its output and recommend `/impl:fix`. Do not revert and do not push again here.
- No CI, or `gh` unavailable → say so; step 3 was the only check.

### 7. Report

- The base branch and the commits pushed, oldest first
- Whether step 2 rebased onto new remote commits
- Whether the gate ran the full suite or the related tests (and why: the version change, or its absence), the commands run and their results — for a scoped run, the specs chosen
- The secrets check: gitleaks result, or that it was not installed
- CI status on the base branch
- Anything that stopped the push, and which skill should handle it
