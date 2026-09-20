---
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git diff --cached:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*), Bash(git branch:*)
description: Stage relevant changes and create one focused Conventional Commit
---

## Context

Current git status:
!`git status --short`

Current branch:
!`git branch --show-current`

Recent commits:
!`git log --oneline -10`

## Task

Create exactly one focused git commit for the current logical change.

Do not push the commit.

### 1. Inspect the changes

Run:

- `git status`
- `git diff`
- `git diff --cached`

If there are no staged or unstaged changes, report that there is nothing to commit and stop.

### 2. Decide what belongs in this commit

Commit only changes that belong to the same logical change.

- Preserve anything already staged by the user.
- If relevant unstaged changes belong to the same logical change, stage them explicitly by path.
- Do not stage unrelated changes.
- Never use:
  - `git add -A`
  - `git add .`
  - `git add -u`
  - interactive staging
- Stage files explicitly by path using `git add <path> ...`.
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

If staged and unstaged changes clearly represent different logical changes:

- Preserve the user's existing staged changes.
- Commit only one logical change.
- Leave unrelated unstaged changes untouched.

Do not modify, revert, discard, or reset unrelated user changes.

### 3. Verify the staged changes

After staging, run:

`git diff --cached`

Before committing, verify that:

- The staged diff contains only the intended logical change.
- No secrets, credentials, private keys, or sensitive configuration are included.
- No build artifacts or generated files are included unless they are clearly part of the intended source change.
- The staged diff is internally consistent.
- The commit message accurately describes the purpose of the staged changes.

If the staged diff contains unrelated or unsafe changes, do not commit them. Correct the staging selection first.

### 4. Create the commit

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

### 5. Report

After committing, run `git log --oneline -1` and report:

- The commit hash and message.
- Which files were included.
- Any unstaged or unrelated changes that were intentionally left out.

Do not push. Do not amend previous commits.
