---
name: tonal-ui
description: Borderless, tonal-surface UI style（Gmail / Material 3 的長相）：不畫框線、用底色色塊分層、顏色只給有語意的東西。含完整的 design token（顏色／字級／圓角／間距）、元件規則與交件前檢查清單。當使用者要做**後台或內部系統**的新畫面、新元件、改版既有 UI、做 design review、或把這套風格搬到另一個技術棧（CSS / Tailwind / React Native）時使用。同一個介面內跟 /ui:calm-ui 二選一、不可混用：console・後台與內部系統用本 skill（淺色、色塊分層），使用者端 Web 與行動 App 用 calm-ui（深色、極少裝飾）；同一個專案的不同介面可以各用一套。
---

# Tonal UI：不畫框線，用色塊分層

這是一套後台／內部系統用的視覺語言，從實際的 Next.js 後台實作抽出來，**與框架無關**：
token 可以落在 CSS variables、Tailwind theme、React Native StyleSheet 或任何地方，規則不變。

**同一個介面內跟 `/ui:calm-ui` 二選一。** 那套是消費級 AI 產品的深色語言（近黑表面、極少卡片、Agent Feed）；
這套是 console・後台與內部系統的淺色語言。一個介面（一個 app）只能有一套；
同一個專案裡 console 用本套、使用者端 Web 與行動 App 用 calm-ui 是正常的——那是不同介面，不算混用。

## 先確認這個介面選的是哪一套

先看要動的檔案屬於哪個介面（`apps/console`、`apps/web`、`apps/mobile`……），再依序查那個介面的風格，查到就停：

1. `CLAUDE.md` 技術約束段的 UI 風格對照（`/arch:init` 寫的「UI 風格（依介面）：…」）
2. `docs/architecture/tech-stack.md` 的「UI 風格」對照表或「約束與慣例」第一條
3. 該介面的既有程式碼：有 `tokens.css` / `theme.ts` 就看它是淺色還是深色階梯
4. 都沒有 → 用 `AskUserQuestion` 問一題，並建議把答案寫進 `CLAUDE.md` 的對照

**這個介面查到的是另一套，就停下來說明，不要改用這一套做。** 混用會得到一個既不像工具也不像產品的東西，而且下一個 session 會再混一次。

新做一個畫面、加一個元件、或把既有畫面改成這套風格時照這份做。所有數值在
`references/tokens.css`（可直接貼），常見元件的寫法在 `references/component-recipes.md`。

## 一句話

> **不畫框線。要分隔就換底色。**

視覺參考是 Gmail：一層很淺的灰底，內容浮成白色圓角面板，靠色差而不是線條劃分區域。

## 三條原則

1. **不要 `border`。** 兩塊東西要分開，就讓底色差一階。整包 CSS 裡不該出現
   `border: 1px solid`；唯一合理的 `border`／`outline` 是輸入框對焦時的那一圈。
2. **只有「浮起來」的東西才有陰影**：選單、modal、toast、下拉面板。平鋪在頁面上的卡片、
   清單、按鈕一律沒有陰影也沒有框——卡片是白的、頁面是灰的，色差就是邊界。
3. **選中用色塊，不用線。** 導覽項目、分頁選中時是一塊淡藍色塊配深藍字，不是底線，
   也不是左側色條。

## 版面分層

由外而內，相鄰兩層的顏色一定不一樣：

```
頂端列（白）
├─ 側邊導覽（幾乎白）   內容區（最淺的灰）
│                       └─ 卡片（白，圓角 16）
│                           └─ 卡片裡的區塊（填色灰）
```

**這幾層一律中性灰**，只留一點點冷調，不要帶藍。畫面上刻意帶顏色的只有三種東西：
選中的色塊、狀態色塊（info／warning／danger／success）、導覽 icon。底色要是也跟著上色，
這些該跳出來的東西就跳不出來了。

**浮動面板套用同一套邏輯，縮小一號**：面板自己是灰底 + 陰影，裡面每一塊浮成白色圓角卡片，
卡片之間留 8px 的白。使用者選單就是「我是誰」一張卡、「我能做什麼」一張卡，一眼分得開。

## 顏色怎麼選

完整 token 見 `references/tokens.css`。挑色時照這個順序問：

1. **這是背景嗎？** 用底色階梯（container／nav／layout／surface／item）的其中一階，
   不要自己調。互動元素的 hover 一律比自己的底色**深一階**——淡到看不出來等於沒有。
2. **這是狀態嗎？**（成功／警告／錯誤／提示）用 status 的四組「文字色 + 色塊底色」。
3. **這是需要被認出來的分類嗎？** 用四個 chip 色調（blue／green／orange／purple）。
   紅色那階直接借 status-danger。
4. **都不是** → 灰。

**顏色要挑過才給**，預設是灰的：

- **有語意的**才上色，而且顏色要對應語意（HTTP method：GET 藍、POST 綠、PUT/PATCH 橘、
  DELETE 紅；啟用中是綠的、停用是灰的——關掉的東西不該比開著的還搶眼）。
- 一份清單裡**每個項目各自獨立、需要被認出來**（人名、帳號）才輪著配色，照 index 順序輪，
  不要隨機或雜湊：重新整理後顏色不會跳，顏色本身才記得住位置。
- **原樣照抄的資料一律灰**：網址、ID、路徑這種只是照實顯示的字串不要上色，它沒有
  「是哪一類」的意思，上了色只是在搶注意力。也不要只為了讓兩份長得像的清單看起來不一樣
  就各給一色——那是版面要解決的問題。

**彩色 icon 只給導覽**：每個導覽項目一個顏色，選中與否都不變色（只有文字跟著變）。
位置與顏色綁在一起最好認，也讓整個介面有一個活潑的點。彩色線條看起來比同粗細的灰線細，
描邊要比灰線粗一階（1.75 vs 1.5）。

## 字級與粗細

**頁面 CSS 不寫 `font-size: 14px` 這種數字**——每多一個 15px，就多一種沒人說得出理由的
大小。一律用 token，名字講的是「用在哪一層」：page-title 24／brand 20／section-title 18／
lead 15／body 14／compact 13／caption 12／micro 11。

粗細只有三階：400（內文）、600（標題型，例如頂端列的系統名稱）、700（標題與內文強調）。
字型家族兩組：介面字 + 等寬字（等寬字給 ID、路徑、`code`、帳號這種**要逐字比對**的字串）。

唯一的例外是**頭像裡的縮寫**：它跟著圓的直徑縮放（40 的圓配 14、48 的圓配 16），
是圖不是文字。

## 形狀

| 用途 | 圓角 |
|---|---|
| 卡片、modal、登入卡片 | 16 |
| 浮動面板、toast、alert | 12 |
| 輸入框、程式碼區塊、卡片裡的小色塊 | 6 |
| 按鈕、標籤、徽章、導覽項目、分頁 | 膠囊（999） |

**清單裡的一列不要圓角**：圓角屬於卡片，item 是方的，貼齊卡片邊緣（卡片 `overflow: hidden`
會把最後一列的兩個角裁掉一點，那是刻意的）。

## 元件規則

寫法與程式碼見 `references/component-recipes.md`，這裡只列必須遵守的判斷。

- **卡片**：白底、圓角 16、沒框沒陰影。表頭與內容之間不畫線，靠留白分開。
  內容是清單時讓它貼齊邊緣（卡片不上內距）。
- **清單**：整列是一個項目時，每列白底、固定列高、沒有圓角、滿版；列與列之間留 2px 的縫，
  hover 換底色。**純資料的表格不要套**，不然使用者會以為整列可以點。
- **整列可點**：連結掛在名稱上，用一層看不見的 `::after` 撐滿整列（stretched link）。
  鍵盤、右鍵開新分頁、螢幕報讀都跟一般連結一樣。名稱**不寫成藍字**：整列都能點的時候，
  藍字反而讓人以為只有那幾個字可以點。鍵盤焦點的框畫在列的內側。
- **按鈕**：收成一個元件，只開兩個樣式維度——`tone`（normal／primary／danger）與
  `subtle`（平常透明、hover 才上色）。**呼叫端不准自己拼 className**。
  `primary` 一個畫面或一個 modal **最多一顆**。清單那一列裡的動作一律 `subtle`，
  不然每列都排著色塊會很吵。會導頁的用連結元件（渲染成 `<a>`），不要用按鈕加 onClick。
- **輸入框**：平常是一塊填色，沒有框；對焦翻白底加一圈內縮的 outline（不會把版面推開）。
- **分頁**：沒有底線。選中是膠囊色塊，其他是純文字。
- **導覽**：項目是四邊都圓的膠囊，選中就是一塊淡藍色塊。icon 直接寫 inline SVG，
  不為了幾個圖示裝一套 icon 套件。
- **Alert**：只有底色沒有框，左邊一顆對應狀態文字色的圓點。**Toast** 是浮起來的，有陰影。
- **標籤與徽章**：填色膠囊，沒有框。**壓在白底上的小元件不能也是白的**，不然會消失。
- **層級與導覽字串**：**不要麵包屑**。最上層頁面什麼都不放（側邊導覽已經標著現在在哪），
  深一層放一顆返回鍵（箭頭 + 上一層的名字，sticky 在內容區頂端）。
- **空狀態**：置中一行次要色文字，需要的話底下一顆按鈕。
- **說明文字**：貼在它要解釋的那個東西**下面**，不是頁面最上方。

## Safe area、點擊區與圖層

後台也會在手機上打開，也可能被搬到 React Native；只要會跑在行動裝置上，每個畫面都要過這三件事。畫面看起來對、實際卻按不到或被系統 UI 蓋住，是最常見、也最難從截圖看出來的問題。

### Safe area

- **靠近上緣或下緣的東西，位置一律是「safe area inset + 版面間距」**，不能只寫固定的 `top` / `bottom`。`top: 24px` 在有動態島、瀏海的 iPhone 上會落進狀態列。
- **用平台的 safe area 機制，不要依機型寫死數字**：
  - Web：viewport 要有 `viewport-fit=cover`，再用 `env(safe-area-inset-*)`（見 `references/tokens.css` 的 `--safe-*`）。少了 `viewport-fit=cover`，`env()` 永遠是 0
  - React Native / Expo：`react-native-safe-area-context` 的 `SafeAreaView` 或 `useSafeAreaInsets()`；不要用 RN 內建、只支援 iOS 的 `SafeAreaView`
  - iOS 原生：`safeAreaLayoutGuide`；SwiftUI 的 `ignoresSafeArea()` 只給背景
  - Android：edge-to-edge 之後用 `WindowInsets` 處理狀態列與手勢列
- **上方**：頂列內容、返回鈕、關閉鈕、頁首動作都在 inset-top 之下。頂列的底色可以延伸到狀態列底下，內容不行。
- **下方**：tab bar、常駐輸入框、全寬送出按鈕、底部面板的按鈕列都在 inset-bottom（home indicator）之上。tab bar 的高度是 token 高度 + inset-bottom，底色延伸到螢幕底。
- **左右**：橫向時 inset-left / right 也要算，左右留白取 `max(gutter, inset)`。
- **背景、底色、圖片可以滿版延伸進 safe area；可互動的東西與文字不行。**
- **捲動內容的底部留白**＝底部固定元件的高度 + inset-bottom，捲到底時最後一項不能被 tab bar 或輸入框蓋住。
- 鍵盤彈出也是一種 inset：常駐輸入框、表單送出鈕要跟著鍵盤上移，不能被蓋住。

### 點擊區

- **每個可互動的控制項，實際點擊區至少 44 × 44pt**（`--touch-target-min`）。圖示或按鈕視覺上可以更小，用透明內距補足（Web 用 padding 或擴大的偽元素；RN 用 `hitSlop` 或外層 `Pressable` 最小 44），不要為了點擊區把圖示放大。
- 相鄰的點擊區不重疊；小圖示鈕並排時，中心距至少 44。
- **點擊區不能壓到系統 UI**：狀態列、動態島、home indicator、Android 手勢列。貼邊的按鈕擴大點擊區時只往內擴，不往 safe area 裡擴。

### 圖層

- 重要的互動元件一律在裝飾層、背景層之上，層級從 `references/tokens.css` 的 `--z-*` 取，不要寫 `9999`。
- **看得到但按不到，先查 z-index 與 stacking context**：`transform`、`opacity < 1`、`filter`、`position` + `z-index` 都會建立新的 stacking context，子元素的 z-index 出不了父層。
- **看得到的元件上面不能蓋著透明或看不見的層**：全螢幕的漸層遮罩、關閉後沒卸載的 overlay、`opacity: 0` 但還在的面板。純裝飾層加 `pointer-events: none`（RN：`pointerEvents="none"`）；關閉的 overlay 要卸載，或同時設 `visibility: hidden` 與 `pointer-events: none`。

## 交件前檢查清單

- [ ] 有沒有寫到 `border`？除了對焦的 outline 之外都不該有，改成兩塊底色。
- [ ] 顏色是不是從 token 拿的？頁面 CSS 裡不該出現色碼。
- [ ] 新的區塊壓在什麼底色上？白底上的小元件不能也是白的。
- [ ] 可以互動的東西有沒有 hover？要比自己的底色深一階。
- [ ] 這個顏色真的有語意嗎？照抄的資料一律留灰。
- [ ] 清單整列可點嗎？只有名稱可點就太難按了。
- [ ] 按鈕有沒有用共用元件？這頁的 primary 是不是只有一顆？
- [ ] 字級與粗細、圓角、間距是不是都用 token，沒有寫死 px？
- [ ] 這頁在第幾層？最上層不放導覽字串，深一層才放返回鍵，不要加回麵包屑。
- [ ] 鍵盤走得完嗎？焦點看得見嗎（框畫在內側）？
- [ ] 在有動態島的 iPhone（或模擬器）與有手勢列的 Android 上看過：頂端的按鈕都在狀態列下方、底部的按鈕都在 home indicator 上方？沒有寫死的 `top` / `bottom` 偏移？
- [ ] 每個可點的東西點擊區 ≥ 44 × 44、彼此不重疊、不壓到系統 UI？
- [ ] 每個看得到的按鈕都按得到？上面沒有透明層或沒卸載的 overlay？

## 換一個技術棧怎麼落地

規則不變，落點不同：

- **CSS / CSS Modules**：`references/tokens.css` 直接貼進全域樣式的 `:root`。
- **Tailwind**：把 token 填進 `theme.extend`（colors／fontSize／borderRadius／spacing），
  然後只用 theme 裡的名字，不要用 `bg-[#f5f6f7]` 這種任意值。
- **React Native / 行動 app**：token 變成一個 `theme.ts` 常數物件；陰影用
  `shadowOpacity`／`elevation`，「不畫框線」在行動端一樣成立（`borderWidth: 0`，
  用 `backgroundColor` 分層）。列高、膠囊圓角照舊；safe area、44pt 點擊區與圖層見上方「Safe area、點擊區與圖層」。
- **任何棧**：先把 token 定好再寫畫面。**先寫死顏色之後再抽 token，最後一定會漏。**
