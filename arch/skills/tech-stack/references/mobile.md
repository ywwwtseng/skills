# Mobile 候選與判斷準則

## 候選清單（窄範圍）

| 技術 | 語言 | 定位 |
|---|---|---|
| Expo（React Native） | TypeScript | RN 的標準發行版，OTA 更新、EAS 建置、與 React Web 共用邏輯 |
| Flutter | Dart | 單一 codebase 高一致 UI，效能好，與 Web 技術棧不共用 |
| Swift（SwiftUI）+ Kotlin（Compose） | Swift / Kotlin | 原生雙寫，最佳體驗與原生 API 存取，成本最高 |
| Capacitor | TypeScript | 把現有 Web app 包成 App，最低成本，體驗偏 Web |
| PWA | TypeScript | 不上架，僅安裝到主畫面；iOS 功能受限 |

## 情境 → 推薦

| 情境 | 首選 | 替代 | 避免 |
|---|---|---|---|
| Web + App（Web 用 React） | Expo | Capacitor（若 App 只是 Web 的延伸） | Flutter（兩套技術棧） |
| 只做 App、iOS + Android、無特殊 UI 需求 | Expo | Flutter | 原生雙寫 |
| 只做 App、UI 高度客製 / 動畫重 | Flutter | Expo + Reanimated | Capacitor |
| 只做單一平台（如只有 iOS） | SwiftUI 原生 | Expo | Flutter |
| 需要深度原生功能 | Expo + Expo Modules API（custom native module） | 原生雙寫（原生功能是產品核心、或指定 Swift / Kotlin 時） | Capacitor / PWA |
| 已有 Web app、想最快上架 | Capacitor | Expo 重寫 | — |
| 不需上架、內部工具 | PWA | Capacitor | 任何原生方案 |
| 需要離線 | Expo + SQLite（expo-sqlite）或 WatermelonDB | Flutter + Drift | 純 PWA（iOS 儲存限制） |
| 個人・小型 | Expo | — | 原生雙寫 |

## 額外判斷

- **優先順序**：語言限制 > 單一 codebase > 原生功能需求。無語言限制或含 TS 時一律 Expo（一套程式碼、與 Web 共用型別，維護面最小），原生功能需求轉為「風險」與「未決事項」（逐一查 Expo SDK 是否已有 module）；原生雙寫只在原生功能是產品核心時推薦，並標注兩套 codebase 的同步成本。

- **與 Web 共用**：選 Expo 且 Web 用 React 時，建議 monorepo（Turborepo / pnpm workspace），共用 `packages/api-client`、`packages/types`、`packages/validation`；UI 層不強求共用。
- **本機開發平台**：**預設 iOS 模擬器**。理由是啟動最快、不需要先開 Android Studio 的 AVD、而且 macOS 上一定裝得起來；Android 的差異留到實機測試與上架前的回歸再處理。這一條要寫進「約束與慣例」，因為 `/impl:feature` 與 `/impl:verify` 每個 UI task 都要照它開來確認。
  | 技術 | 開發指令 | 備註 |
  |---|---|---|
  | Expo | 建置：`npx expo run:ios`；日常：`npx expo start --dev-client --ios` | 預設用 dev build（見下一條），不用 Expo Go |
  | Flutter | `flutter run -d ios` | 先 `open -a Simulator` 開好模擬器 |
  | 原生 Swift | `xcodebuild` 或直接開 Xcode | CI 用 `xcodebuild -scheme <name> -destination 'platform=iOS Simulator,name=iPhone 15'` |
  | Capacitor | `npx cap run ios` | |

  開發者在 Windows / Linux、或產品明確以 Android 為主時改成 Android 並在文件寫明——這是預設值，不是硬規則。
- **Expo 一律用 dev build，不用 Expo Go。** Expo Go 是預先編好的 App，只帶 Expo SDK 內建的原生模組。專案一旦裝了任何帶原生程式碼的套件（Google 登入、IAP、部分分析 / 推播 SDK……），在 Expo Go 裡**一啟動就崩**（`TurboModuleRegistry.getEnforcing(...): '<Module>' could not be found`）——JS 打包、typecheck、Jest 全都是綠的，要到真的開 App 才看得到。而 v1 需要什麼原生套件在選型時通常還不確定，所以一開始就裝 `expo-dev-client`、用 `expo run:ios` 建自己的 binary，比等到某個 feature 引入原生套件才切換便宜。
  - **原生依賴的判斷**：套件目錄下有 `ios/`、`android/`、`*.podspec`、`expo-module.config.json` 或 `app.plugin.js` 其中之一。
  - **加了或升級原生依賴，binary 就要重建**（`npx expo run:ios`，或先 `npx expo prebuild --clean`）。舊的 binary 裡沒有新模組，錯誤跟 Expo Go 一模一樣。
  - 這兩條都要寫進「約束與慣例」，`/impl:plan`、`/impl:feature`、`/impl:verify` 依它判斷何時要重建。
- **推播**：Expo → Expo Push（底層 FCM / APNs）；Flutter / 原生 → Firebase Cloud Messaging；backend 只需一個 push 發送端點。
- **Auth**：與 Web 共用同一套（Supabase Auth / Clerk / 自建 JWT），mobile 端用 secure storage 存 token。
- **發布**：Expo → EAS Build + EAS Submit；Flutter / 原生 → Fastlane。App store 審核週期（iOS 約 1–3 天）寫入「風險 / 注意事項」。
- **Backend 影響**：有 App 時 API 需版本化（舊版 App 無法強制更新），在 backend 段落標注。
- 使用者選 Flutter 但 Web 也要做：明確警告「Flutter Web 不適合 SEO 導向網站」，Web 仍應用 references/frontend.md 選型。
