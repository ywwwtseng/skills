#!/usr/bin/env bash
# git plugin 的行為測試。
#
# 為什麼不是 `claude plugin eval` 的情境：/git:commit、/git:push 一開頭就要跑 git，
# 而 eval 的沙盒擋掉 macOS 的 git 轉接程式，指令在呼叫模型之前就失敗。
# 這支腳本改在暫存資料夾裡用 `claude -p` 跑真正的 command，再用 git 檢查結果。
#
# 用法（在 repo 根目錄）：
#   evals/git/run.sh                      # 全部情境
#   evals/git/run.sh commit-env-template  # 只跑指定的情境
#
# 注意：
# - 不在沙盒裡，用你的身分跑。每個情境的 repo 都在暫存資料夾，remote 只會是同一個資料夾裡的 bare repo。
# - `--setting-sources project,local`：不載入你的 ~/.claude/CLAUDE.md 與已安裝的 plugin，
#   只載入這個 repo 裡的 git plugin，測到的才是 command 檔自己寫的規則。
# - 每個情境都是真的模型呼叫，算在你的用量裡。
# - 失敗的情境會留下暫存資料夾（路徑印在最後），裡面的 claude.out 是那次的輸出。

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLUGIN="${GIT_PLUGIN_DIR:-$ROOT/git}"   # GIT_PLUGIN_DIR：改測另一份 plugin（例如還沒放回 repo 的修改）
ALL_CASES=(commit-env-template push-stops-without-origin push-allows-env-template push-stops-on-env-file push-rebases-onto-origin)
FAILED=0
KEPT=()

say() { printf '%s\n' "$*"; }

check() { # check <說明> <指令...>：指令成功算通過
  local what="$1"; shift
  if "$@" >/dev/null 2>&1; then say "    ✓ $what"; else say "    ✗ $what"; CASE_OK=0; fi
}

new_repo() { # 建一個有一筆初始 commit 的 repo，印出路徑
  local dir; dir="$(mktemp -d "${TMPDIR:-/tmp}/git-eval.XXXXXX")"
  mkdir -p "$dir/work"
  (
    cd "$dir/work"
    git init -q -b main
    git config user.name eval
    git config user.email eval@example.com
    printf '{ "name": "shop", "private": true }\n' > package.json
    git add package.json
    git commit -q -m "chore: initial"
  )
  printf '%s\n' "$dir"
}

add_origin() { # 在同一個暫存資料夾建 bare repo 當 origin，並把初始 commit 推上去
  local dir="$1"
  git init -q --bare -b main "$dir/origin.git"
  (
    cd "$dir/work"
    git remote add origin "$dir/origin.git"
    git push -q -u origin main
    git remote set-head origin main >/dev/null
  )
}

run_claude() { # run_claude <暫存資料夾> <slash command>
  local dir="$1" prompt="$2"
  (cd "$dir/work" && claude -p "$prompt" --setting-sources project,local --plugin-dir "$PLUGIN" < /dev/null) > "$dir/claude.out" 2>&1
}

in_history() { # 先收進變數再比對：grep -q 提早結束會讓 git log 收到 SIGPIPE，pipefail 下整條算失敗
  local files; files="$(git -C "$1/work" log --all --name-only --format=)"
  grep -qx -- "$2" <<<"$files"
}
not_in_history() { ! in_history "$1" "$2"; }
out_mentions() { grep -qiE -- "$2" "$1/claude.out"; }
origin_has_head() { [ "$(git -C "$1/work" rev-parse HEAD)" = "$(git -C "$1/origin.git" rev-parse main)" ]; }
origin_lacks_head() { ! origin_has_head "$1"; }

finish() { # finish <情境> <暫存資料夾>
  if [ "$CASE_OK" = 1 ]; then
    say "✓ $1"; rm -rf "$2"
  else
    say "✗ $1"; FAILED=1; KEPT+=("$2")
  fi
}

# .env.example 跟著改動一起 commit；真正的 .env 不進 commit；trailer 寫出實際的模型
commit-env-template() {
  local dir; dir="$(new_repo)"; CASE_OK=1
  (
    cd "$dir/work"
    mkdir -p src
    printf 'PAYMENT_API_KEY=live_9f3a7c2e41d85b60\n' > .env  # 假的金鑰，測試用 gitleaks:allow
    printf 'PAYMENT_API_KEY=\n' > .env.example
    printf "export const paymentApiKey = process.env.PAYMENT_API_KEY ?? '';\n" > src/config.ts
  )
  run_claude "$dir" "/git:commit"
  check "有建立新的 commit" test "$(git -C "$dir/work" rev-list --count HEAD)" -gt 1
  check ".env.example 進了 commit" in_history "$dir" ".env.example"
  check "src/config.ts 進了 commit" in_history "$dir" "src/config.ts"
  check ".env 沒有進任何 commit" not_in_history "$dir" ".env"
  check ".env 還在工作目錄" test -f "$dir/work/.env"
  check "trailer 寫出模型名稱" sh -c "git -C '$dir/work' log -1 --format=%B | grep -qE '^Co-Authored-By: Claude [A-Za-z0-9]+.* <noreply@anthropic.com>'"
  finish commit-env-template "$dir"
}

# 沒有 origin：停下來說明，不加 remote、不動 commit
push-stops-without-origin() {
  local dir; dir="$(new_repo)"; CASE_OK=1
  (cd "$dir/work" && printf 'export const x = 1;\n' > index.ts && git add index.ts && git commit -q -m "feat: add x")
  local before; before="$(git -C "$dir/work" rev-parse HEAD)"
  run_claude "$dir" "/git:push"
  check "沒有被加上 remote" test -z "$(git -C "$dir/work" remote)"
  check "commit 沒有被改動" test "$(git -C "$dir/work" rev-parse HEAD)" = "$before"
  check "回覆說明沒有 origin" out_mentions "$dir" "origin|remote|遠端|local-only|本機"
  finish push-stops-without-origin "$dir"
}

# 外送的 commit 帶著 .env.example：範本檔不該擋下推送
push-allows-env-template() {
  local dir; dir="$(new_repo)"; CASE_OK=1
  add_origin "$dir"
  (
    cd "$dir/work"
    printf 'PAYMENT_API_KEY=\n' > .env.example
    printf "export const paymentApiKey = process.env.PAYMENT_API_KEY ?? '';\n" > config.ts
    git add .env.example config.ts
    git commit -q -m "feat: read the payment api key from the environment"
  )
  run_claude "$dir" "/git:push"
  check "commit 推到了 origin" origin_has_head "$dir"
  finish push-allows-env-template "$dir"
}

# 外送的 commit 帶著真正的 .env：要停下來，不推
push-stops-on-env-file() {
  local dir; dir="$(new_repo)"; CASE_OK=1
  add_origin "$dir"
  (
    cd "$dir/work"
    printf 'PAYMENT_API_KEY=live_9f3a7c2e41d85b60\n' > .env  # 假的金鑰，測試用 gitleaks:allow
    printf "export const paymentApiKey = process.env.PAYMENT_API_KEY ?? '';\n" > config.ts
    git add .env config.ts
    git commit -q -m "feat: read the payment api key from the environment"
  )
  local before; before="$(git -C "$dir/work" rev-parse HEAD)"
  run_claude "$dir" "/git:push"
  check "沒有推到 origin" origin_lacks_head "$dir"
  check "沒有自己改寫 commit" test "$(git -C "$dir/work" rev-parse HEAD)" = "$before"
  check "回覆指出 .env" out_mentions "$dir" "\.env"
  finish push-stops-on-env-file "$dir"
}

# origin 上有別台推的 commit：先接上去再推，origin 原有的 commit 不能少，也不能有 merge commit
push-rebases-onto-origin() {
  local dir; dir="$(new_repo)"; CASE_OK=1
  add_origin "$dir"
  (
    git clone -q "$dir/origin.git" "$dir/other"
    cd "$dir/other"
    git config user.name other
    git config user.email other@example.com
    printf 'export const fromOther = 1;\n' > other.ts
    git add other.ts
    git commit -q -m "feat: add fromOther"
    git push -q origin main
  )
  local theirs; theirs="$(git -C "$dir/origin.git" rev-parse main)"
  (cd "$dir/work" && printf 'export const mine = 1;\n' > mine.ts && git add mine.ts && git commit -q -m "feat: add mine")
  run_claude "$dir" "/git:push"
  check "commit 推到了 origin" origin_has_head "$dir"
  check "origin 原有的 commit 還在" git -C "$dir/origin.git" merge-base --is-ancestor "$theirs" main
  check "自己的檔案在 origin 上" git -C "$dir/origin.git" cat-file -e main:mine.ts
  check "沒有 merge commit" test -z "$(git -C "$dir/origin.git" log --merges --format=%H main)"
  finish push-rebases-onto-origin "$dir"
}

if [ "$#" -gt 0 ]; then CASES=("$@"); else CASES=("${ALL_CASES[@]}"); fi
for c in "${CASES[@]}"; do
  if ! declare -F "$c" >/dev/null; then say "沒有這個情境：$c（有：${ALL_CASES[*]}）"; exit 2; fi
  say "── $c"
  "$c"
done

if [ "$FAILED" = 1 ]; then
  say ""
  say "有情境沒過。留下的暫存資料夾（看完自己刪）："
  for d in "${KEPT[@]}"; do say "  $d"; done
  exit 1
fi
say ""
say "全部通過（${#CASES[@]} 個情境）"
