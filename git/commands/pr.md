---
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git switch:*), Bash(git checkout:*), Bash(git rev-parse:*), Bash(git merge-base:*), Bash(git symbolic-ref:*), Bash(git remote:*), Bash(git fetch:*), Bash(git push:*), Bash(gh:*), Bash(pnpm:*), Bash(npm:*), Bash(yarn:*), Bash(bun:*), Bash(cargo:*), Bash(uv:*), Bash(make:*), Read, Grep, Glob, AskUserQuestion
argument-hint: [--merge] [base-branch]
description: Move the current feature branch's commits to a reviewable pull request, with traceability back to the plan and business rules; with --merge, land it and return to the base branch
---

## Context

Current git status:
!`git status --short`

Current branch:
!`git branch --show-current`

Recent commits:
!`git log --oneline -15`

Remotes:
!`git remote -v`

## Task

Take the commits produced by this feature's implementation and turn them into one reviewable pull request.

This is the exit of the pipeline: `/domain:business-rules` → `/domain:model` → `/db:schema` → `/impl:plan` → `/impl:feature` → `/git:commit` → **`/git:pr`**. Every earlier step refuses to push, so nothing leaves the machine until this command runs.

Arguments (`$ARGUMENTS`):

- **`--merge`** — after the pull request is green, land it and return to the base branch (steps 8 and 9). This is the unattended solo mode: no other person is going to review it, so `/impl:verify` is the gate. Without this flag, stop after opening the pull request and leave merging to a human.
- **A branch name** — use it as the base branch instead of the repository default.

Never merge without `--merge`. Never push to the default branch.

### 1. Check preconditions

Stop and report instead of continuing if any of these hold:

- **The working tree has uncommitted changes.** Report them and tell the user to run `/git:commit` first. Never stash, discard, reset, or commit them here.
- **There is no `origin` remote.** Report that the repository is local-only.
- **`gh` is not authenticated** (`gh auth status`). Report what the user needs to run.
- **There are no commits ahead of the base branch.** Report that there is nothing to open a pull request for.

Determine the base branch in this order: the user's argument > `git symbolic-ref refs/remotes/origin/HEAD` > `main` if it exists on the remote > `master`.

Run `git fetch origin <base>` before comparing, so the comparison is against the current remote state.

### 2. Put the commits on a feature branch

The unattended implementation loop often leaves commits on the default branch. They must move to a feature branch before pushing.

If the current branch is **not** the base branch, keep it and go to step 3.

If the current branch **is** the base branch and has commits ahead of `origin/<base>`:

1. Verify the local base branch is a fast-forward of the remote one: `git merge-base --is-ancestor origin/<base> <base>`. If it is not (the histories diverged), stop and report — do not attempt to untangle it.
2. Pick a branch name (step 2a) and create it at the current commit: `git switch -c <branch>`.
3. Verify the commits are now reachable from the new branch with `git log --oneline origin/<base>..<branch>`.
4. Only after that verification, move the local base branch back to the remote state: `git branch -f <base> origin/<base>`.
5. Report that the commits were moved, and list them.

Never run `git reset --hard`, `git rebase`, `git cherry-pick`, or `git branch -D` as part of this step. The commits must stay reachable at every moment.

#### 2a. Branch name

Derive it from, in order:

- The feature directory under `docs/impl/<feature>/` that the commits' task IDs belong to → `feat/<feature>`
- The dominant Conventional Commit type and scope across the commits → `<type>/<scope>`
- A short kebab-case summary of the change

Use only lowercase letters, digits, `/`, `-`. If the branch name already exists locally or on the remote, append `-2`, `-3`, and so on.

### 3. Gate on verification

A pull request must never be opened on red code.

1. Look for `docs/impl/<feature>/verification.md`. If it exists and is newer than the last commit, use its verdict as the evidence.
   - Verdict `fail` → stop. Report the failing findings and tell the user to address them (`/impl:feature` for missing tasks, `/impl:fix` for defects) before opening the pull request.
   - Verdict `pass with findings` → continue, and carry the findings into the pull request body.
2. If there is no usable verification report, run the project's validation commands yourself — take them from the plan's validation table, otherwise from `docs/architecture/tech-stack.md`, otherwise from `package.json` scripts or the CI workflow. Run type check, lint, tests, and build.
   - Anything red → stop and report the failing command and its output. Do not open the pull request. Do not "fix" it here.
   - Recommend running `/impl:verify` first, since a green test run does not prove the business rules are covered.

### 4. Review the outgoing diff

Run `git diff origin/<base>...HEAD --stat` and inspect the diff before pushing. Pushing is publication — what goes out is hard to take back.

Stop and report if the diff contains:

- `.env`, `.env.*`, credentials, private keys, tokens, or certificates with private material
- `node_modules/`, `dist/`, `.next/`, `.turbo/`, or other build artifacts
- Files clearly unrelated to this feature
- Debug leftovers: `console.log` added for tracing, commented-out blocks, `TODO: remove`

Report the specific files and stop rather than editing them — correcting the history is the user's call.

### 5. Push

```sh
git push -u origin <branch>
```

- Never push to the base branch.
- Never use `git push --force`. Use `--force-with-lease` only on this feature branch, and only when the user explicitly asked for it in this session.
- If the push is rejected, report the rejection and stop.

### 6. Open or update the pull request

Check first: `gh pr view --json number,url,state,isDraft`. If a pull request for this branch already exists and is open, update its body with `gh pr edit --body-file` instead of creating a new one, and say so in the report.

Open it as a **draft** when any of these hold, and state the reason in the body:

- The plan still has `todo`, `doing`, or `blocked` tasks
- The verification verdict was `pass with findings`
- Business rules are listed as uncovered

Write the body to a file in the scratchpad directory and pass it with `--body-file`; do not inline a long body on the command line.

```sh
gh pr create --base <base> --head <branch> --title "<title>" --body-file <path> [--draft]
```

Title: the Conventional Commit style summary of the feature, matching what a reviewer would look for — `feat(order): 訂單狀態轉換`. No task IDs in the title.

#### Body template

Fill every section from files, not from memory. Omit a section only when the source document does not exist.

```markdown
## 目的

<1–3 sentences from the plan's 目標與範圍: what a user can do once this ships.>

## 範圍

**做**：<from the plan>
**不做**：<from the plan — this is what a reviewer should not expect to find>

## Tasks

| Task | 標題 | Commit | 狀態 |
|---|---|---|---|
| T-001 | <title> | <short hash> | done |

## 規則覆蓋

| BR-ID | 規則摘要 | 測試 |
|---|---|---|
| BR-order-012 | <summary> | `src/domain/order.test.ts` |
| BR-order-018 | <summary> | **未覆蓋** — <reason> |

## 驗收

| 指令 | 結果 |
|---|---|
| `pnpm typecheck` | 通過 |
| `pnpm test` | 通過（N 個測試） |

## 待處理

<blocked tasks, verification findings, and the plan's 上游回饋 — each with the skill that should handle it. Write 「無」 if there is none.>

## 審查重點

<2–4 bullets: where the risk actually is — the invariant enforced in application code, the destructive migration, the assumption that could be wrong.>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Do not invent coverage, test names, or results. A rule with no test is listed as `未覆蓋`, not omitted.

### 7. Wait for CI

Run `gh pr checks --watch` with a bounded wait (stop waiting after a few minutes or when checks settle).

- All green → continue.
- Red → report which check failed and the failing output. Do not attempt to fix it here; hand back to `/impl:fix`. **Never merge on red.**
- No checks configured → say so, and treat step 3's verification evidence as the only gate.

### 8. Merge (only with `--merge`)

Merging is not reversible for the people who already pulled, so every one of these must hold. If any fails, leave the pull request open, say which check stopped it, and skip to step 10.

- `--merge` was passed
- The pull request is **not** a draft
- The verification verdict was `pass` — not `pass with findings`, not absent
- CI is green, or there are no checks
- `gh pr view --json mergeable,mergeStateStatus` reports no conflicts
- `gh pr view --json reviewDecision` is not `CHANGES_REQUESTED`
- There are no unresolved comment threads asking for changes

Then:

```sh
gh pr merge --rebase --delete-branch
```

Use `--rebase`, not `--squash`: every task commit is a restore point that `/impl:feature` deliberately created, and squashing collapses a whole feature into one commit that cannot be bisected. Use `--squash` only when the user asked for one commit per feature.

If the merge is rejected, report the reason and stop. Do not retry with `--admin`, do not force anything, and do not close the pull request.

### 9. Return to the base branch (only after a successful merge)

```sh
git switch <base>
git pull --ff-only origin <base>
```

Then confirm the working tree is clean and the merged commits are present in the base branch. This is what lets the next feature start from a clean base instead of stacking on top of this one — without it, the next feature's commits land on this branch and end up inside this pull request.

If `git pull --ff-only` fails, report it and stop; do not merge or rebase to force it through.

### 10. Report

- The pull request URL and whether it was created or updated, and whether it is a draft
- The branch that was pushed, and whether commits were moved off the base branch in step 2
- The commits included, oldest first
- Verification evidence used: the report file, or the commands run and their results
- CI status
- **Whether it was merged**, and if not, which condition in step 8 stopped it
- The branch you are on now, and whether the working tree is clean
- Anything that blocked or was deliberately left out, and which skill should handle it

Do not amend or rewrite commits. Do not merge without `--merge`.
