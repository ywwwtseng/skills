---
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git diff --cached:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*), Bash(git branch:*)
description: Commit all pending changes as a series of focused Conventional Commits
---

## Context

Current git status:
!`git status --short`

Current branch:
!`git branch --show-current`

Recent commits:
!`git log --oneline -10`

## Task

Commit every pending change, one focused commit per logical change.

Repeat the cycle below until no committable changes remain.

Do not push any commit.

### 1. Inspect the changes

Run:

- `git status`
- `git diff`
- `git diff --cached`

If there are no staged or unstaged changes, report that there is nothing to commit and stop.

### 2. Group the changes into logical changes

Before committing anything, group all pending changes into logical changes, and decide the order to commit them in.

- Each commit contains exactly one logical change.
- Commit foundational changes before the changes that depend on them.
- If a single file contains changes belonging to several logical changes, keep that file in one commit and describe it by its primary purpose. Do not use interactive or partial staging.

### 3. Stage one logical change

Stage only the files belonging to the logical change being committed in this round.

- Preserve anything already staged by the user, and commit it first.
- Stage files explicitly by path using `git add <path> ...`.
- Do not stage files belonging to a different logical change.
- Never use:
  - `git add -A`
  - `git add .`
  - `git add -u`
  - interactive staging
- Never stage or commit:
  - `node_modules/`
  - `dist/`
  - `.next/`
  - `.turbo/`
  - `.env`
  - `.env.*`
  - credentials
  - private keys
  - certificates containing private material
  - generated build artifacts
  - files that appear to contain secrets
  - other generated or temporary files that are not part of the intended change

Do not modify, revert, discard, or reset any user change.

### 4. Verify the staged changes

After staging, run:

`git diff --cached`

If `gitleaks` is installed, also run `gitleaks git --staged` (gitleaks before 8.19: `gitleaks protect --staged`). Any finding → unstage that file and report it; never commit it. If it is not installed, say so in the report.

Before committing, verify that:

- The staged diff contains only the intended logical change.
- No secrets, credentials, private keys, or sensitive configuration are included.
- No build artifacts or generated files are included unless they are clearly part of the intended source change.
- The staged diff is internally consistent.
- The commit message accurately describes the purpose of the staged changes.

If the staged diff contains unrelated or unsafe changes, do not commit them. Correct the staging selection first.

### 5. Create the commit

Write a concise 1–2 sentence commit message focused on WHY the change was made.

Use Conventional Commits format:

`<type>(<optional scope>): <concise description>`

Allowed types:

- `feat`: A new feature or user-visible capability.
- `fix`: A bug fix or behavior correction.
- `refactor`: Code restructuring without changing intended behavior.
- `perf`: A performance improvement.
- `test`: Adding or modifying tests without changing production behavior.
- `docs`: Documentation-only changes.
- `ci`: Changes to CI/CD workflows or configuration.
- `build`: Changes to the build system or build dependencies.
- `chore`: Maintenance changes that do not fit the categories above.

Commit message rules:

- Always use a valid Conventional Commit type.
- Use a scope when it clearly identifies the affected area, such as `auth`, `api`, `ui`, `db`, or `deploy`.
- Omit the scope when it does not add useful information.
- Choose the type based on the primary purpose of the change.
- Do not combine unrelated changes into one commit.
- Focus the description on WHY the change was made rather than merely listing implementation details.
- Keep the description concise.
- Do not mention Claude or AI in the commit message.
- Do not use vague messages such as:
  - `update code`
  - `fix stuff`
  - `changes`
  - `misc updates`
- Use `!` after the type or scope for breaking changes.

Examples:

- `feat(auth): support refresh token rotation`
- `fix(api): prevent duplicate user creation`
- `refactor(auth): centralize token validation`
- `perf(api): reduce duplicate database queries`
- `test(auth): cover refresh token expiration`
- `docs(deploy): document Compute Engine deployment`
- `ci: run tests before building the image`
- `build: update production build configuration`
- `chore(deps): update TypeScript dependencies`
- `feat!: remove the legacy authentication API`
- `feat(api)!: change the response format`

Follow the repository's existing conventions where they do not conflict with the Conventional Commits rules above.

Create the commit using this exact structure:

```sh
git commit -m "$(cat <<'EOF'
<type>(<optional scope>): <description>

Co-Authored-By: Claude
EOF
)"
```

### 6. Continue until nothing is left

After each commit, run `git status` again.

- If committable changes remain, go back to step 3 and commit the next logical change.
- Treat files that must never be committed, and files ignored by git, as not committable. They never keep the loop running.
- Stop when only such files remain, or when the working tree is clean.
- If a round cannot stage anything new, stop instead of repeating the same round.

### 7. Report

After the last commit, run `git log --oneline -<number of commits created>` and report:

- Each commit hash and message, in the order they were created.
- Which files were included in each commit.
- Any changes that were intentionally left uncommitted, and why.

Do not push. Do not amend previous commits.
