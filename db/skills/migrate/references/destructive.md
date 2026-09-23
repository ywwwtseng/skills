# 破壞性變更配方

每一種變更都拆成 **expand（相容的新增）→ migrate（搬資料）→ contract（移除舊的）** 三階段。

分階段的理由只有一個：**部署不是瞬間的**。migration 跑完到新版程式碼全部上線之間，一定有一段時間新舊程式碼同時在跑。contract 階段刪掉的東西，只要還有一個舊 process 在讀，線上就噴錯。

所以：**expand 可以套用，contract 只產檔不執行**（SKILL 核心規則 5），它的前置條件是「不再使用舊欄位的程式碼已經部署完」，而那件事不在本 skill 的視野裡。

## 加 NOT NULL 欄位

| 階段 | 動作 |
|---|---|
| expand | 加**可空**欄位（有合理預設就一併給 DEFAULT） |
| migrate | 分批回填既有列；附「還有幾列是 NULL」的驗證查詢 |
| contract | 確認 NULL 數為 0 後，加上 NOT NULL 約束 |

直接 `ADD COLUMN ... NOT NULL` 在有資料的表上會整個失敗。沒失敗，代表你是在空資料庫上測的。

PostgreSQL 11+ 對有 DEFAULT 的新欄位不重寫整張表，可以一步完成；但仍建議照三步走，除非確定沒有舊程式碼會 INSERT 不帶這個欄位。

## 改欄位型別

| 階段 | 動作 |
|---|---|
| expand | 加一個新型別的新欄位（`amount_minor`），程式碼改成**雙寫**（新舊都寫） |
| migrate | 分批把舊欄位的值轉換寫進新欄位；驗證兩欄一致 |
| contract | 程式碼改成只讀新欄位並部署完 → 刪掉舊欄位 |

能「原地轉型且不失真」（varchar(50) → varchar(100)、int → bigint）時可以一步 `ALTER COLUMN`，但仍要確認沒有鎖表風險（PostgreSQL 某些轉型會重寫整張表）。

會失真的轉換（numeric → int、text → enum）**一律走三階段**，因為 down 回不去。

## 改欄位名 / 改表名

| 階段 | 動作 |
|---|---|
| expand | 加新名字的欄位，雙寫 |
| migrate | 回填 |
| contract | 刪舊欄位 |

原生 `RENAME` 是瞬間完成的，但它讓舊程式碼**立刻**找不到欄位，等於強制同步部署。只有在確定可以停機、或這張表還沒有任何程式碼在用時才直接 RENAME。

工具的自動產生器常把「改名」判成 drop + add（`references/tools.md` 各段都標了），那會直接刪掉資料——產出的 SQL 一定要打開看。

## 刪欄位 / 刪表

| 階段 | 動作 |
|---|---|
| expand | 程式碼停止讀寫它（本 skill 視野外，寫進 runbook 的前置條件） |
| migrate | 確認一段時間內確實沒有存取（有監控就看監控） |
| contract | 備份 → 刪除 |

down 寫不出來（資料已經沒了），照 SKILL 核心規則 4 標成**不可逆**、單獨一個檔案、檔頭寫明「回復方式 = 還原備份」。

先改名成 `<欄位>_deprecated` 放一個週期再刪，比直接刪安全：出事時改回來就好。

## 加唯一約束

| 階段 | 動作 |
|---|---|
| expand | 先查既有資料有沒有重複（附查詢），有就要先決定怎麼處理——這題要問人 |
| migrate | 清掉重複資料 |
| contract | 建唯一索引（PostgreSQL 用 `CREATE UNIQUE INDEX CONCURRENTLY` 避免鎖表） |

既有資料一定有重複的可能，直接加約束會失敗。「怎麼處理重複」是業務決策（保留哪一筆？合併？），用 `AskUserQuestion` 問（SKILL 核心規則 10）。

有軟刪除時照 `db/skills/schema/references/conventions.md`：唯一約束要排除已刪除列（部分索引或把 `deleted_at` 併進複合唯一）。

## 收緊 CHECK

| 階段 | 動作 |
|---|---|
| expand | 查有幾列不符合新條件 |
| migrate | 修正或清理那些列 |
| contract | 加上 CHECK |

PostgreSQL 可以先 `ADD CONSTRAINT ... NOT VALID`（只擋新資料、不檢查既有列），清理完再 `VALIDATE CONSTRAINT`，這樣不會長時間鎖表。

## 改主鍵

最貴的一種，通常需要停機或長時間雙寫：

| 階段 | 動作 |
|---|---|
| expand | 加新主鍵欄位並填值、建唯一索引；所有指向它的外鍵表加對應的新外鍵欄位並回填 |
| migrate | 雙寫兩套鍵，確認一致 |
| contract | 切換主鍵與全部外鍵約束、刪舊欄位 |

走到這一步前先確認：真的要改主鍵，還是加一個唯一的 `number` 欄位就夠了（`conventions.md` 的主鍵段）。

## 拆表 / 併表

| 階段 | 動作 |
|---|---|
| expand | 建新表，程式碼雙寫 |
| migrate | 分批搬既有資料，驗證兩邊筆數與內容 |
| contract | 程式碼改成只讀新表並部署完 → 刪舊表 |

搬資料的腳本照 SKILL Step 6：冪等、分批、附進度查詢。

## 引擎差異

### PostgreSQL

- `ALTER TABLE` 大多是 DDL 交易安全的，可以包在交易裡一起回滾。
- `CREATE INDEX CONCURRENTLY` **不能**在交易內；失敗會留下無效索引，要先 `DROP INDEX` 再重建。
- `ADD CONSTRAINT ... NOT VALID` + `VALIDATE CONSTRAINT` 是加約束不鎖表的標準做法。
- 加有 DEFAULT 的欄位（11+）不重寫整張表。

### MySQL 8

- DDL 不在交易內：**一個 migration 中途失敗會停在中間狀態**，所以檔案要切得更小，而且 down 更重要。
- 線上 DDL 用 `ALGORITHM=INPLACE, LOCK=NONE`；不支援的操作會退回鎖表複製，先確認。
- 沒有部分索引，帶條件的唯一性照 `dialects.md` 走生成欄位或應用層。

### SQLite / D1 / Turso

沒有 `ALTER COLUMN`、不能加 / 刪約束。改型別或改約束一律走**四步表重建**：

1. 依新定義建 `<table>_new`
2. `INSERT INTO <table>_new SELECT ... FROM <table>`（轉換寫在 SELECT 裡）
3. `DROP TABLE <table>`
4. `ALTER TABLE <table>_new RENAME TO <table>`，重建所有索引與觸發器

注意：

- 重建前後要 `PRAGMA foreign_keys = OFF/ON`（D1 用 `defer_foreign_keys`），完成後跑 `PRAGMA foreign_key_check` 確認沒有斷掉的外鍵。
- 指向這張表的其他表的外鍵會在 DROP 時失效，重建後要一起檢查。
- D1 沒有交易式 migration，這四步要能容忍中途失敗後重跑（每步都先判斷目標狀態是否已存在）。

### MongoDB

- 沒有 schema migration 的概念，但 JSON Schema validator 的收緊等同加約束：先 `validationLevel: "moderate"`（只驗新寫入）→ 回填 → 再改 `"strict"`。
- 欄位改名要雙寫，並用批次更新搬既有 document。
- 加唯一索引前同樣要先查重複。

## runbook 檢查清單

contract 階段的檔案交出去前，確認 runbook 回答得出這五題（SKILL Step 7）：

1. 哪一版程式碼要先部署完？怎麼確認它真的部署完了？
2. 資料回填完了嗎？驗證查詢是哪一條、預期結果是什麼？
3. 備份在哪裡？怎麼還原？
4. 要不要停機？大概多久？
5. 出事怎麼回滾？回滾會不會有資料遺失，範圍多大？

有任何一題答不出來，就不要把這個檔案交出去說「可以跑了」。
