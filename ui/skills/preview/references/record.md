# 輸出格式

## 對照頁：`docs/ui/preview/<畫面>/index.html`

每輪截圖後重新產生，用 `open` 打開。一列一個狀態，一欄一個寬度；tweak 模式改成「改前 / 改後」兩欄（改前的圖用暫存目錄的絕對路徑）。不放外部資源，背景跟著介面的明暗。

```html
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<title>訂單列表 — 預覽第 2 輪</title>
<style>
  body { margin: 0; padding: 24px; font: 14px/1.5 system-ui, sans-serif; background: #111; color: #eee; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p { margin: 0 0 24px; color: #999; }
  section { margin-bottom: 40px; }
  h2 { font-size: 14px; margin: 0 0 12px; }
  .row { display: flex; gap: 24px; align-items: flex-start; overflow-x: auto; }
  figure { margin: 0; }
  figcaption { color: #999; margin-bottom: 6px; }
  img { display: block; max-height: 80vh; border-radius: 8px; }
</style>
</head>
<body>
  <h1>訂單列表 — 第 2 輪</h1>
  <p>這輪改了：列表去掉卡片、空狀態文案改短。預覽網址：http://localhost:3000/dev-preview/order-list</p>

  <section>
    <h2>空（從來沒有訂單）</h2>
    <div class="row">
      <figure><figcaption>mobile 390</figcaption><img src="empty--mobile.png"></figure>
      <figure><figcaption>desktop 1440</figcaption><img src="empty--desktop.png"></figure>
    </div>
  </section>
  <!-- 每個狀態一段 -->
</body>
</html>
```

## 紀錄：`docs/ui/preview/<畫面>.md`

```markdown
# 訂單列表 — 預覽紀錄

> 狀態：已確認 | 草稿　|　確認日期：<YYYY-MM-DD>　|　commit：<git rev-parse --short HEAD>
> 規格：`docs/ui/screens/order-list.md`　|　介面：`apps/web`（`/ui:calm-ui`）
> 元件：`src/screens/order-list/OrderList.tsx`　|　假資料：`OrderList.fixtures.ts`
> 預覽：`/dev-preview/order-list?state=<狀態>`

## 確認稿

| 狀態 | 截圖 | 備註 |
|---|---|---|
| 載入 | `order-list/loading--mobile.png`、`loading--desktop.png` | |
| 空 | `order-list/empty--mobile.png`、`empty--desktop.png` | |
| 最壞情況 | `order-list/worst-case--mobile.png`、`worst-case--desktop.png` | 超長店名截斷成一行 |
| 離線 | — | 不適用：規格寫明此畫面離線時顯示快取，同「一般」 |

## 迭代中的決定

- 列表去掉卡片，改成分隔留白（第 1 輪回饋）
- 空狀態只留一行說明與一個主要按鈕（第 2 輪回饋）

## 例外

| 項目 | 違反 | 使用者的理由 |
|---|---|---|
| 金額用強調色 | calm-ui「顏色只給狀態」 | 金額是這個畫面唯一要被看到的東西 |

## 轉給 /ui:screens 的內容改動

| 改動 | 狀態 |
|---|---|
| 列表每列加顯示「預計送達」 | 待處理 |

## 未處理的回饋（草稿時）

- …

## 歷次調整（tweak）

| 日期 | 改了什麼 | commit |
|---|---|---|
```

`/impl:plan`、`/impl:feature`、`/impl:verify` 只把狀態是 `已確認` 的紀錄當驗收依據；`草稿` 只表示做過、還沒定。
