# 處理紀錄格式

寫在 audit 報告檔裡，兩個地方：報告標題下面的「處理紀錄」表（一眼看全部），以及每條 finding 底下的「處理」區塊（細節）。處理完一條就兩處一起寫回。

## 狀態值

| 狀態 | 意思 | 下次執行 |
|---|---|---|
| `待處理` | 還沒問、沒人回答，或被 hook 擋下 | 會問 |
| `已修復` | 測試先紅後綠、驗收通過、已 commit | 不問 |
| `跳過` | 使用者決定不修，附理由 | 不問 |
| `之後再說` | 使用者決定延後 | 會再問 |
| `誤報` | 使用者判定不成立，附理由 | 不問 |
| `已不存在` | 動手前檢查發現程式碼已經改過、問題不在了 | 不問 |
| `修復失敗` | 驗收沒過，這一條的改動已還原，附原因 | 會再問 |

## 處理紀錄表

放在報告標題與摘要那一行的下面、`CRITICAL / HIGH / …` 計數的上面。

````markdown
# Security Audit Report

> 專案：shop　|　commit：a1b2c3d　|　日期：2026-10-13

## 處理紀錄

> 由 `/security:fix` 維護。最後更新：2026-10-14　|　已修復 3 / 共 6

| # | 嚴重度 | Finding | 狀態 | Commit | 回歸測試 | 日期 |
|---|---|---|---|---|---|---|
| 1 | CRITICAL | 商家 token 沒有驗證 | 已修復 | `4f2e9a1` | `lib/auth.test.ts` › rejects unsigned token | 2026-10-14 |
| 2 | CRITICAL | LLM 產生的 SQL 直接執行 | 已修復 | `8c13d07` | `app/api/assistant/route.test.ts` › never executes model SQL | 2026-10-14 |
| 3 | HIGH | 訂單查詢用 query string 的 shopId | 已修復 | `b7e0c52` | `app/api/orders/route.test.ts` › ignores shopId param | 2026-10-14 |
| 4 | HIGH | 未登入可無限呼叫 LLM | 之後再說 | — | — | 2026-10-14 |
| 5 | MEDIUM | xxx 4.17.20 套件漏洞 | 修復失敗 | — | — | 2026-10-14 |
| 6 | LOW | 帳號列舉 | 跳過 | — | — | 2026-10-14 |

```
CRITICAL  2
...
```
````

- `#` 是處理順序（照建議處理順序排），不是報告裡出現的順序。
- 「最後更新」與「已修復 N / 共 M」每次寫回都更新。
- 計數區塊不改——它是 audit 當時的結果，跟處理進度分開看。

## 每條 finding 底下的「處理」區塊

接在該條 finding 的 `Fix:` 那幾行後面：

```markdown
### [HIGH] 訂單查詢用 query string 的 shopId，而不是登入商家的 shopId
File: `app/api/orders/route.ts:6-9`
...
Fix: 刪掉 query 參數，改用 `where: { shopId: merchant.shopId }`。...

處理: 已修復（2026-10-14，commit `b7e0c52`）
- 做法: `route.ts` 改用 `merchant.shopId` 查詢，移除 `searchParams.get('shopId')`
- 測試: `app/api/orders/route.test.ts` › ignores shopId param——修前失敗（回傳了商店 B 的 2 筆訂單），修後通過
- 驗收: `pnpm test:affected` 14 passed、`pnpm typecheck` 通過
```

其他狀態的寫法：

```markdown
處理: 跳過（2026-10-14）
- 理由: 只有內部管理員會用到這個帳號列舉訊息，使用者決定接受風險

處理: 誤報（2026-10-14）
- 理由: `middleware.ts:12` 的 matcher 涵蓋 `/api/admin/*`，已確認 `requireAdmin` 實作會檢查角色

處理: 之後再說（2026-10-14）

處理: 已不存在（2026-10-14）
- 證據: `lib/db.ts:30` 現在是 `sql\`… WHERE id = ${id}\``（參數化），報告時的字串拼接已被 commit `91aa0e2` 改掉

處理: 修復失敗（2026-10-14）
- 原因: 升到 4.17.21 後 `test/date.test.ts` 有 3 個失敗，是時區格式變更，不是測試寫錯；改動已還原
- 需要: 確認是否接受新的日期格式，或改升 4.18.x 並調整呼叫端

處理: 已修復（2026-10-14）
- 類型: git 歷史中的 secret
- 使用者確認: 已到 AWS IAM 撤銷並換發（2026-10-14）
- git 歷史: 未改寫（需要的話另行處理，會影響所有人的 clone 並需要 force push）
```

- 「測試」要寫修前怎麼失敗、修後通過，這是核心規則 4 的證據。
- 不寫 secret 的值、不寫可以直接拿來攻擊的完整 payload。
- `修復失敗` 一定要寫「需要什麼才能繼續」，下次執行時接手的人才知道從哪開始。
