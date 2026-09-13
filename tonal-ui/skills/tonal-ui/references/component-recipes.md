# 元件寫法

規則在 `../SKILL.md`，token 在 `tokens.css`。這裡是幾個容易寫錯的地方的參考做法。
程式碼是 CSS Modules + React，但形狀本身跟框架無關。

## 清單：整列是一個項目

```css
/* 只給「整列是一個項目」的清單套；純資料的表格不要套 */
.items {
  border-collapse: separate;
  /* 列與列之間留一道縫，hover 時相鄰兩列的色塊才不會黏在一起；
     最後一列之後那道縫用負 margin 收掉，清單才貼齊卡片底緣 */
  border-spacing: 0 2px;
  margin-bottom: -2px;
}

.items tbody td {
  height: var(--list-item-height);
  background-color: var(--color-background-item);
}

.items tbody tr:hover td {
  background-color: var(--color-background-item-hover);
}

.items th {
  color: var(--color-text-secondary); /* 表頭沒有底線 */
}
```

## 整列可點（stretched link）

真正的連結只有一個（名稱），用看不見的 `::after` 撐滿整列。**不要**在 `<tr>` 上掛
`onClick`：那樣右鍵開新分頁、中鍵、鍵盤 Tab 全部失效。

```css
.items tbody tr {
  position: relative; /* ::after 的定位基準 */
}

.rowLink {
  color: var(--color-text-body); /* 整列都能點時，藍字反而誤導 */
  font-weight: var(--font-weight-bold);
  text-decoration: none;
}

.rowLink::after {
  content: '';
  position: absolute;
  inset: 0;
}

/* 鍵盤走到這一列時要看得出來，框畫在內側才不會把版面推開 */
.rowLink:focus-visible {
  outline: none;
}
.rowLink:focus-visible::after {
  outline: 2px solid var(--color-text-link);
  outline-offset: -2px;
}
```

```tsx
<tr>
  <td>
    <Link className={ui.rowLink} href={`/things/${thing.id}`}>{thing.name}</Link>
  </td>
  <td>{thing.url}</td>
</tr>
```

代價：覆蓋層會蓋掉整列的文字選取。清單上有需要複製的字串（網址、ID）時要先想清楚。

## 按鈕：兩個維度，不給呼叫端拼 className

```tsx
export type ButtonTone = 'normal' | 'primary' | 'danger';

const TONES: Record<ButtonTone, string | null> = {
  normal: null,
  primary: ui.buttonPrimary,
  danger: ui.buttonDanger,
};

function buttonClassName({ tone = 'normal', subtle }, extra?: string) {
  return [ui.button, TONES[tone], subtle && ui.buttonSubtle, extra].filter(Boolean).join(' ');
}

// type 預設 'button'：漏寫的 <button> 在 <form> 裡預設會 submit，會意外送出表單
export function Button({ tone, subtle, className, type = 'button', ...props }) {
  return <button className={buttonClassName({ tone, subtle }, className)} type={type} {...props} />;
}

// 會導頁的用這顆（渲染成 <a>），不要拿 Button 加 onClick 去導頁
export function ButtonLink({ tone, subtle, className, ...props }) {
  return <Link className={buttonClassName({ tone, subtle }, className)} {...props} />;
}
```

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px 20px;
  min-height: 32px;
  border: none;
  border-radius: var(--border-radius-pill);
  background-color: var(--color-background-surface);
  color: var(--color-text-link);
  font-family: inherit;
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
}

.button:disabled {           /* disabled 不換顏色，只降透明度 */
  opacity: 0.6;
  cursor: not-allowed;
}

.buttonPrimary { background-color: var(--color-text-link); color: var(--color-text-inverted); }
.buttonDanger  { background-color: var(--color-background-status-danger); color: var(--color-text-status-danger); }

/* 清單那一列裡的動作用它，不然每列都排著色塊會很吵 */
.buttonSubtle { padding: 4px 12px; background-color: transparent; }
.buttonSubtle:hover { background-color: var(--color-background-surface); }
```

## 標籤（chip）：預設灰，顏色要挑過才給

```tsx
const TINTS = { blue: ui.tagBlue, green: ui.tagGreen, orange: ui.tagOrange, purple: ui.tagPurple };
const CYCLE = ['blue', 'green', 'orange', 'purple'];

// 照順序輪，不要隨機或雜湊：重新整理後顏色不會跳，顏色本身才記得住
export const tintByIndex = (i: number) => CYCLE[i % CYCLE.length];

export function Tag({ tint, children }) {
  return <li className={[ui.tag, tint && TINTS[tint]].filter(Boolean).join(' ')}>{children}</li>;
}
```

有語意的顏色寫在 CSS，用 data 屬性對應，不要在元件裡 if/else 拼：

```tsx
<span className={styles.method} data-method={api.method}>{api.method}</span>
```

```css
.method[data-method='GET']    { background-color: var(--color-chip-blue-background);  color: var(--color-chip-blue-text); }
.method[data-method='POST']   { background-color: var(--color-chip-green-background); color: var(--color-chip-green-text); }
.method[data-method='PUT'],
.method[data-method='PATCH']  { background-color: var(--color-chip-orange-background); color: var(--color-chip-orange-text); }
.method[data-method='DELETE'] { background-color: var(--color-background-status-danger); color: var(--color-text-status-danger); }
```

型別上把值收斂成 union（`'GET' | 'POST' | ...`），寫成小寫或沒對到的值就編譯不過——
CSS 屬性選擇器比對是區分大小寫的，打錯只會安靜地變回灰色。

## 浮動面板：灰底 + 白卡

下拉選單、切換器面板都用這個形狀，**不要**把選項擠成一團小字。

```css
.panel {
  position: absolute;
  z-index: 100;
  padding: 8px;
  border-radius: var(--border-radius-container);
  background-color: var(--color-background-layout); /* 面板自己是灰的 */
  box-shadow: var(--shadow-panel);
}

.panelCard {            /* 裡面每一塊是白卡，卡片之間留 8px */
  margin-bottom: 8px;
  padding: 16px;
  border-radius: var(--border-radius-block);
  background-color: var(--color-background-container);
}
```

選項的 icon 佔的寬度跟頭像一樣並置中，兩張卡的文字才會對齊在同一條線上。

## 輸入框：沒有框，對焦才有

```css
.input {
  padding: 6px 12px;
  min-height: 36px;
  border: none;
  border-radius: var(--border-radius-badge);
  background-color: var(--color-background-surface);
  font-family: inherit;
  font-size: var(--font-size-body);
}

.input:focus {
  background-color: var(--color-background-container);
  /* offset 是負的：框畫在裡面，不會把版面推開 */
  outline: 2px solid var(--color-text-link);
  outline-offset: -2px;
}
```

## 導覽：膠囊 + 每項一個顏色的 icon

```css
.navLink {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0 12px 0 4px;
  padding: 8px 16px;
  border-radius: var(--border-radius-pill); /* 四邊都圓 */
  color: var(--color-text-label);
  text-decoration: none;
}

.navLink:hover      { background-color: var(--color-background-nav-hover); }
.navLinkActive,
.navLinkActive:hover {
  background-color: var(--color-background-selected);
  color: var(--color-text-selected);
  font-weight: var(--font-weight-bold);
}

/* icon 不吃文字色：選中時只有文字變深藍，顏色留給 icon 自己 */
.navIcon[data-tint='projects'] { color: var(--color-icon-nav-projects); }
.navIcon[data-tint='api']      { color: var(--color-icon-nav-api); }
```

inline SVG、`stroke-width: 1.75`（彩色線條看起來比同粗細的灰線細一階）。

## 產品圖示（app 切換器那種）

實心圓角方塊 + 漸層底 + 白色圖形，跟導覽的線條 icon 是兩回事：那種是一排選項，
這種是要從一堆格子裡一眼認出哪個是哪個。**SVG 裡不要寫死色碼**——漸層的兩個端點各掛一個
class，`stop-color` 指向 token：

```css
.markDashboardFrom { stop-color: var(--color-app-dashboard-from); }
.markDashboardTo   { stop-color: var(--color-app-dashboard-to); }
```
