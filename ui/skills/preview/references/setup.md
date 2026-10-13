# 預覽路由與截圖

照專案的技術棧選一段。目錄與命名以既有慣例為準，下面的路徑只是預設。

## 元件的形狀（所有技術棧共用）

```tsx
// <畫面>.tsx — 只吃 props，不 import API client / store / query
export type OrderListProps = {
  state: 'loading' | 'empty' | 'filtered-empty' | 'error' | 'ready';
  orders: Order[];               // 欄位名稱對齊模型與契約
  error?: { code: string };      // 契約錯誤碼，畫面依規格的錯誤行為顯示
  onRetry: () => void;
  onOpen: (id: string) => void;
};
```

```ts
// <畫面>.fixtures.ts — 一個狀態一組，加最壞情況
export const fixtures: Record<string, OrderListProps> = {
  loading: { state: 'loading', orders: [], onRetry() {}, onOpen() {} },
  empty: { state: 'empty', orders: [], onRetry() {}, onOpen() {} },
  ready: { state: 'ready', orders: realisticOrders, onRetry() {}, onOpen() {} },
  'worst-case': { state: 'ready', orders: worstCaseOrders, onRetry() {}, onOpen() {} },
  // …規格狀態矩陣的每一列
};
```

之後 `/impl:feature` 寫的容器（`OrderListContainer` 或 route 的 page）負責抓資料、算出 `state`，再 render 同一個元件。

## Next.js（App Router）

不要用 `_` 開頭的資料夾——App Router 把 `_folder` 視為私有資料夾，不會產生路由。

```tsx
// app/dev-preview/[screen]/page.tsx
import { notFound } from 'next/navigation';
import { registry } from './registry';

export default async function Page({ params, searchParams }: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { screen } = await params;
  const { state = 'ready' } = await searchParams;
  const entry = registry[screen];
  const props = entry?.fixtures[state];
  if (!entry || !props) notFound();
  const Screen = entry.Component;
  return <Screen {...props} />;
}
```

`registry.ts` 列出 `{ 'order-list': { Component: OrderList, fixtures } }`。版面需要 layout（側邊導覽、頂端列）時，預覽頁包上同一個 layout，截出來才是使用者實際看到的樣子。

網址：`http://localhost:3000/dev-preview/order-list?state=empty`

## Vite + React Router / TanStack Router

同樣做一個 `/dev-preview/:screen` 路由，只在 `import.meta.env.DEV` 時註冊：

```tsx
const routes = [
  ...appRoutes,
  ...(import.meta.env.DEV ? [{ path: '/dev-preview/:screen', element: <DevPreview /> }] : []),
];
```

## Expo（expo-router）

```tsx
// app/dev-preview/[screen].tsx
import { Redirect, useLocalSearchParams } from 'expo-router';
import { registry } from '@/dev-preview/registry';

export default function DevPreview() {
  const { screen, state = 'ready' } = useLocalSearchParams<{ screen: string; state?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  const entry = registry[screen];
  const props = entry?.fixtures[state];
  if (!entry || !props) return <Redirect href="/" />;
  const Screen = entry.Component;
  return <Screen {...props} />;
}
```

網址：`<scheme>://dev-preview/order-list?state=empty`，`scheme` 在 `app.json` 的 `expo.scheme`。

## Flutter

一個只在 `kDebugMode` 註冊的 `/dev-preview` 路由，用 query 參數選畫面與狀態；或用 Widgetbook（專案已經有的話）。

## 截圖

### Web：Playwright

專案已經有 Playwright 就用它；沒有的話用 `npx`，**不要加進 `package.json`**（第一次要下載 Chromium，先告訴使用者）。版本鎖一個確定存在的版本，不要用 `@latest`。

```bash
# 一個狀態一張；calm-ui 的介面加 --color-scheme=dark
npx playwright screenshot --viewport-size=390,844 --color-scheme=dark --wait-for-timeout=500 \
  "http://localhost:3000/dev-preview/order-list?state=empty" docs/ui/preview/order-list/empty--mobile.png

npx playwright screenshot --viewport-size=1440,900 --color-scheme=dark --wait-for-timeout=500 \
  "http://localhost:3000/dev-preview/order-list?state=empty" docs/ui/preview/order-list/empty--desktop.png
```

- 內容比視窗長、需要看到整頁時加 `--full-page`；預設只截第一屏，因為那是使用者第一眼看到的。
- 載入狀態若是動畫，截圖前不要等太久，否則截到的是別的畫面。

### iOS 模擬器

```bash
xcrun simctl list devices booted              # 確認有開著的模擬器（要有動態島的機型）
xcrun simctl openurl booted "<scheme>://dev-preview/order-list?state=empty"
xcrun simctl io booted screenshot docs/ui/preview/order-list/empty--ios.png
```

- 深色：`xcrun simctl ui booted appearance dark`
- `openurl` 後等畫面換完再截（App 還沒開時第一次會比較久）。
- 截完用 Read 打開檢查：頂端元素在狀態列與動態島下方、底部按鈕在 home indicator 上方。

### Android 模擬器（需要時）

```bash
adb shell am start -W -a android.intent.action.VIEW -d "<scheme>://dev-preview/order-list?state=empty"
adb exec-out screencap -p > docs/ui/preview/order-list/empty--android.png
```

## tweak 模式的「改前」截圖

存在 repo 外的暫存目錄（`$TMPDIR/ui-preview/<畫面>/before/`），不要放進 `docs/`。只有確認後的「改後」會進 repo。
