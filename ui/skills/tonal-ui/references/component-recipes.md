# 元件寫法

規則在 `../SKILL.md`，token 在 `tokens.css`。這裡是容易寫錯的地方的參考做法（React + Tailwind v4），
形狀本身跟框架無關——換棧時照著 class 對應的 CSS 值搬。

## 按鈕：一個 variants 函式，不給呼叫端拼樣式

```js
const base = 'inline-flex items-center gap-2 whitespace-nowrap rounded-full text-md font-medium '
  + 'tracking-tight transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35';

const variants = {
  default: 'bg-ink text-white hover:bg-black',                        // 實心主要，一畫面最多一顆
  sec: 'bg-fill-solid text-ink hover:bg-fill-strong',                 // 灰色填色，不畫框
  ghost: 'bg-transparent text-ink-2 hover:bg-fill hover:text-ink',    // 清單列裡的動作
  danger: 'bg-danger text-white hover:bg-danger-strong',
};
const sizes = { default: 'px-5.5 py-2.5', sm: 'px-3.5 py-1.5 text-sm', lg: 'px-7.5 py-3.25 text-lg' };

export const buttonVariants = ({ variant = 'default', size = 'default', block = false } = {}) =>
  [base, variants[variant], sizes[size], block && 'w-full justify-center'].filter(Boolean).join(' ');
```

是函式不是 `<Button>` 元件：導頁用 `<Link className={buttonVariants(...)}>`，動作用 `<button type="button">`
（漏寫 `type` 的 `<button>` 在 `<form>` 裡預設會 submit），語意跟樣式分開。

`sm` 的視覺高度不到 44：在行動裝置上會被點的，用擴大的偽元素補點擊區（`relative after:absolute after:-inset-2`），
不要把按鈕本身撐大。

## 後台殼：一整片 shell，不畫線

```jsx
<div className="flex h-dvh flex-col bg-shell">
  <header className="flex h-14 items-center px-5 pt-[var(--safe-top)]">…</header>   {/* 不畫底線 */}
  <div className="flex min-h-0 flex-1">
    <nav className="w-60 overflow-y-auto">…</nav>                                    {/* 不畫右框 */}
    <main className="flex min-w-0 flex-1 flex-col p-5 pl-1">
      <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-surface">…</div>   {/* 白色面板 */}
    </main>
  </div>
</div>
```

面板裡要再分一欄（左邊清單、右邊內容）時，清單那欄鋪 `surface-muted`，不畫分隔線。

## 卡片與數字面板

```js
// 卡片：白色色塊、圓角 12、不畫框、沒陰影（靠跟 shell 底色的色差分開）。accent 才帶 shadow-card。
const card = {
  default: 'rounded-lg bg-surface p-6.5 max-sm:p-5',
  accent: 'rounded-lg bg-accent-soft shadow-card p-6.5 max-sm:p-5',
};

// 數字面板：放頁面最上方
<div className="rounded-lg bg-surface p-5">
  <div className="text-2xs font-semibold uppercase tracking-widest text-ink-3">本期營收</div>
  <div className="mt-2 text-3xl font-semibold leading-tight tracking-tight tabular-nums">1,268</div>
  <div className="mt-1 text-xs text-ink-3">扣除退款後</div>
</div>
```

一排數字面板：`grid grid-cols-[repeat(auto-fit,minmax(178px,1fr))] gap-3.5`。

## 表格：不要再包卡片、不畫外框

```jsx
// ✗ <Card><h3>擷取紀錄</h3><DataTable …/></Card>   —— 卡片包卡片
// ✓ 白色面板（色塊）裡直接放表格：表頭是 surface-muted 色帶、列線最淡，表格自己不畫外框
<section className="rounded-lg bg-surface">
  <h3 className="px-5 pt-4 pb-3">擷取紀錄</h3>
  <div className="overflow-x-auto">
    <table>…</table>   {/* 基底樣式在 tokens.css 的 @layer base */}
  </div>
</section>
```

合計列：`border-t border-ink bg-accent-soft font-semibold`；子列：`text-sm text-ink-2 [&>td:first-child]:pl-8`；
hover 列：`hover:bg-surface-muted`。

## 整列可點（stretched link）

真正的連結只有一個（名稱），用看不見的 `::after` 撐滿整列。**不要**在 `<tr>` 上掛 `onClick`：
那樣右鍵開新分頁、中鍵、鍵盤 Tab 全部失效。

```jsx
<tr className="relative hover:bg-surface-muted">
  <td>
    <Link
      href={`/things/${thing.id}`}
      className="font-semibold text-ink after:absolute after:inset-0 after:content-['']
        focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2
        focus-visible:after:outline-ink"
    >
      {thing.name}
    </Link>
  </td>
  <td><code className="rounded-sm bg-fill px-1.5 py-0.5 text-sm text-ink-2">{thing.id}</code></td>
</tr>
```

名稱用 `text-ink` 不用連結色；焦點框畫在列的內側（負 offset），不推動版面。
代價：覆蓋層會蓋掉整列的文字選取。清單上有需要複製的字串（網址、ID）時要先想清楚。

## 寬報表的全螢幕試算表檢視

```jsx
// 區塊標題列：左標題，右「放大檢視」(sec) + 「匯出」(實心)
<div className="flex flex-wrap items-center justify-between gap-2.5">
  <h3>費用明細</h3>
  <div className="flex gap-2.5">
    <button type="button" className={buttonVariants({ variant: 'sec', size: 'sm' })}>放大檢視</button>
    <button type="button" className={buttonVariants({ size: 'sm' })}>匯出 Excel</button>
  </div>
</div>

// 全螢幕 modal 裡：表格撐滿剩餘高度，自己捲動
<div className="min-h-0 flex-1 overflow-auto border-t border-border text-sm">
  <table className="min-w-full border-separate border-spacing-0 tabular-nums">
    {/* thead sticky top-0：第一列欄字母 A B C…（灰小字），第二列欄名 */}
    {/* 每列最左一格列號；前兩欄 sticky left-*；合計列 sticky bottom-0 */}
    {/* 儲存格 border border-border px-2.5 py-1.5 whitespace-nowrap；凍結格一定要不透明底色 */}
  </table>
</div>
```

試算表檢視是「框線盡量少用」的例外：格線本身就是這個檢視要的東西。`border-separate` 而不是
`collapse`，sticky 儲存格的框線才不會在捲動時消失。

## Note：沒有框，只有底色

```js
const note = {
  info: 'bg-fill-solid text-ink',
  warn: 'bg-danger-soft text-ink',
  amb: 'bg-warning-soft text-ink',
  ok: 'bg-success-soft text-ink',
  teal: 'bg-accent-soft-solid text-ink',
  danger: 'bg-danger text-white [&_b]:text-white',   // 必須馬上處理：實心紅，不要粉紅
};
<div className={`flex items-start gap-3 rounded-lg p-4 text-base leading-relaxed ${note[tone]}`}>
  <span className="shrink-0 text-xs font-bold opacity-55">!</span>
  <div><b>標題一句。</b>說明…</div>
</div>
```

## 徽章與計數

```js
// 狀態徽章：膠囊、無框
const badge = {
  default: 'bg-fill text-ink-2', ok: 'bg-success-soft text-success', warn: 'bg-danger-soft text-danger',
  amb: 'bg-warning-soft text-warning', teal: 'bg-link-soft text-link',
};
// 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium leading-none'

// 計數（未讀、待處理）：另一個元件，實心紅圓，兩位數變膠囊
'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-0.75 bg-danger text-2xs font-semibold leading-none text-white tabular-nums'
```

有語意的顏色用 data 屬性或對照表對應，不要在元件裡 if/else 拼；值在型別上收斂成 union，
打錯就編譯不過，不會安靜地變回灰色。

## 選中狀態：色塊，不加框

```js
// 選項卡（都不畫框）
selected ? 'bg-accent-soft' : 'bg-surface-muted hover:bg-fill-solid'
// Chip（分段切換）
pressed ? 'bg-ink font-medium text-white' : 'bg-fill-solid text-ink-2 hover:bg-fill-strong'
// 側邊導覽項目（中性灰，不用 accent）
on ? 'bg-ink/8 font-semibold text-ink' : 'text-ink-2 hover:bg-ink/4 hover:text-ink'
```

## 分頁：灰軌道 + 浮起來的白色選中項

```jsx
<div role="tablist" className="flex gap-1 overflow-x-auto rounded-lg bg-fill p-1">
  <button type="button" role="tab" aria-selected={sel}
    className={`shrink-0 rounded-md px-3.5 py-2 text-left transition-colors
      ${sel ? 'bg-surface shadow-card' : 'text-ink-2 hover:bg-surface/60 hover:text-ink'}`}>
    <b className="block text-sm">@handle</b>
    <span className="block text-xs text-ink-3">副標</span>
  </button>
</div>
```

## 頂端列右上：只有頭像，點開是選單

```js
// 頭像顏色：從名稱雜湊，同帳號永遠同色（不用 Math.random）
const TONES = ['bg-avatar-1', 'bg-avatar-2', 'bg-avatar-3', 'bg-avatar-4', 'bg-avatar-5', 'bg-avatar-6'];
const avatarTone = (s) => { let h = 0; for (const ch of s || '') h = (h * 31 + ch.codePointAt(0)) >>> 0; return TONES[h % TONES.length]; };
const avatarInitial = (s) => ([...(s || '')][0] || '').toUpperCase();
```

```jsx
<button type="button" aria-haspopup="menu" aria-expanded={open} aria-label="帳號選單"
  className="relative flex rounded-full hover:opacity-85 after:absolute after:-inset-1.5">
  <span className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarTone(name)}`}>
    {avatarInitial(name)}
  </span>
</button>
{open && (
  <div role="menu" className="absolute right-0 top-full z-popover mt-1.5 min-w-40 overflow-hidden rounded-lg bg-surface shadow-lg">
    <div className="bg-surface-muted px-4 py-2.5">
      <div className="truncate whitespace-nowrap text-sm text-ink" title={name}>{name}</div>
      <div className="text-xs text-ink-3">管理員</div>
    </div>
    <button type="button" role="menuitem" className="block w-full px-4 py-2.25 text-left text-sm hover:bg-surface-muted">登出</button>
  </div>
)}
```

「我是誰」那格用 `surface-muted` 色塊跟動作分開，不畫分隔線。點外面、Esc 都要關。
通知鈴做成跟頭像一樣大的圓。

## ⓘ 說明

- 放在標題**旁邊**：`<div className="flex items-center gap-2"><h2>…</h2><InfoTip label="費用說明">…</InfoTip></div>`。
- 桌機 hover／focus 開、手機點擊開；再點、點外面、Esc 關。
- 面板 portal 到 `<body>`、`position: fixed`，左右夾在視窗內 12px，下方放不下就放上方。
- 內容只在打開時才掛上，所以**金額、期限、警示、下一步不能放進去**。

## Modal

```js
// 背景
'fixed inset-0 z-modal grid place-items-center bg-ink/[0.38] p-6 backdrop-blur-[3px] animate-fade-in'
// 面板：浮層只用陰影、不加框
'w-full max-w-[560px] max-h-[88vh] overflow-auto rounded-lg bg-surface shadow-lg animate-dialog-in'
// 關閉鈕：右上圓形 ✕（視覺 34，點擊區用偽元素補到 44）
'relative grid size-8.5 place-items-center rounded-full bg-fill-solid text-ink-2 hover:bg-fill-strong after:absolute after:-inset-1.25'
// 全螢幕版（寬報表）：背景不留 padding；面板 'flex h-dvh w-screen flex-col bg-surface'；內容區 'flex min-h-0 flex-1 flex-col'
```

動作列靠右：次要（sec）在左、主要（實心）在右。

## 自製下拉（取代原生 select）

- 觸發鈕是 `<button role="combobox">`，吃跟輸入框同一套基底樣式。
- 介面跟原生 `<select>` 一樣（`<option>` 子元素、`value`、`onChange(e)`），可以直接替換。
- 選單 portal 到 body、fixed 定位，下方空間不夠就翻到上方；z-index 用 popover（要蓋過 modal）。
- 鍵盤：↑↓ Home End PageUp PageDown 移動，Enter／Space／Tab 選定，Esc 關，打字跳到開頭相符的選項。

## 即時檢查的 debounce

```js
useEffect(() => {
  if (!valueIsWellFormed) { setTaken(false); return; }   // 格式不對不送
  let cancelled = false;
  setChecking(true);
  const timer = setTimeout(() => {
    fetch(`/api/…-check?id=${encodeURIComponent(value)}`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setTaken(!!j.inUse); })
      .finally(() => { if (!cancelled) setChecking(false); });
  }, 400);
  return () => { cancelled = true; clearTimeout(timer); };   // 繼續打字就取消上一次、丟掉舊回應
}, [value]);
```

送出時伺服器端再檢查一次——前端的檢查只是提示。
