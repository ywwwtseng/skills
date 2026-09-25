# 人工檢查清單

Step 6.5 用。Semgrep 找得到「這一行的寫法危險」，找不到「這個 route 少了一個檢查」——後者要從入口一路讀到資料存取才看得出來。這份清單就是讀的順序與要找什麼。

## 先做入口清單

不先列入口就開始讀，一定會漏掉沒被想到的那個 route。

1. 依框架找出**所有**對外入口（下表），列成一張表：路徑、method、需不需要登入、有沒有檢查資源擁有者、會不會改資料。
2. 依風險排出**深讀**順序：
   1. 動到金額、點數、庫存的
   2. 認證相關：登入、註冊、重設密碼、OTP、OAuth callback
   3. 會改資料的，特別是帶資源 ID 的（`/orders/:id`）
   4. 檔案上傳與下載
   5. 會對外發請求的：webhook、URL 預覽、圖片代理、匯入
   6. 管理後台
3. 入口清單全部列出；深讀依順序做到涵蓋前三類為止。報告的「掃描涵蓋」表寫明「入口 N 個，深讀 M 個」——沒深讀的不能算檢查過（SKILL 核心規則 5）。

| 框架 | 入口在哪 | 授權通常在哪 |
|---|---|---|
| Next.js App Router | `app/**/route.ts`、有 `"use server"` 的檔案（**每個 server action 都是公開 endpoint**）、`app/**/page.tsx` 的資料讀取 | `middleware.ts` 的 `matcher`（不在 matcher 裡的路徑就沒被保護）、各 handler 內的 session 檢查 |
| Next.js Pages Router | `pages/api/**` | 各 handler、`getServerSideProps` |
| Express / Hono / Fastify / Koa | `grep -rnE "\.(get\|post\|put\|patch\|delete\|all)\(" src/` | `app.use(...)` 掛的 middleware 與掛載順序 |
| NestJS | `@Controller` + `@Get` / `@Post` … | `@UseGuards`、全域 guard、`@Public()` 之類的例外標記 |
| FastAPI | `@app.<method>`、`APIRouter` | `Depends(...)`，特別注意沒有帶 `Depends` 的 route |
| Django / DRF | `urls.py` → views、`ViewSet` | `@login_required`、`permission_classes`、`get_queryset` 有沒有依使用者過濾 |
| Go（net/http / chi / gin / echo） | `HandleFunc`、`r.Get(`、`r.GET(`、`e.GET(` | router group 掛的 middleware |
| Supabase / Firebase | 前端直接查表的地方 | RLS policy / security rules——**前端能直接查的表，policy 就是唯一的授權** |

有 `docs/domain/business-rules/` 時，**權限類與約束類規則就是正確答案**：逐條拿來對照對應的 handler 有沒有真的擋。規則寫「只有訂單擁有者能取消」，程式只檢查「有登入」，就是一條確認的 finding。

## 檢查項目

每一項：去哪裡看、怎麼找、什麼情況成立、成立時的預設嚴重度。嚴重度照 `tools.md` 的調整規則再調。

### A. 存取控制（最常見也最嚴重）

| 項目 | 怎麼找 | 成立條件 | 預設 |
|---|---|---|---|
| IDOR | 入口清單中帶資源 ID 的 route，看查詢條件 | 用 `params.id` 查資料，條件裡沒有 `userId` / `ownerId` / `tenantId`，之後也沒有比對 | HIGH |
| 缺登入檢查 | 入口清單對照 middleware matcher / guard / `Depends` | 會改資料或回傳個資的入口，沒被任何認證機制覆蓋 | HIGH |
| 功能層級授權 | `admin`、`role`、`isAdmin`、管理路由 | 管理功能只在前端隱藏按鈕，後端沒檢查角色 | HIGH |
| Mass assignment | `create(req.body)`、`update({...body})`、`**data`、`Object.assign(model, body)` | 整包請求內容寫進資料庫，沒有白名單；可以多送 `role`、`isAdmin`、`ownerId`、`price` | HIGH |
| 多租戶隔離 | 有 `tenant_id` / `org_id` 的表 | 有任何查詢沒帶租戶條件，且沒有 RLS 兜底 | HIGH |
| RLS / security rules | Supabase migration 的 `create policy`、`firestore.rules` | 前端可查的表沒開 RLS、policy 是 `using (true)`、rules 是 `allow read, write: if true` | CRITICAL |
| service role key 外露 | `SUPABASE_SERVICE_ROLE`、`service_role`、admin SDK 初始化的位置 | 出現在前端程式碼或 `NEXT_PUBLIC_` / `VITE_` / `EXPO_PUBLIC_` 開頭的變數 | CRITICAL |

### B. 認證與 session

| 項目 | 怎麼找 | 成立條件 | 預設 |
|---|---|---|---|
| JWT 沒驗簽 | `jwt.decode`、`jose`、`jsonwebtoken`、`PyJWT` | 用 `decode` 而不是 `verify`；沒限定 `algorithms`；允許 `none`；沒驗 `exp` | CRITICAL |
| 密碼雜湊 | 註冊與登入的 handler | 用 MD5 / SHA-1 / SHA-256 直接雜湊，或明文存；沒用 bcrypt / argon2 / scrypt | HIGH |
| Cookie 設定 | `cookies().set`、`res.cookie`、`set_cookie` | session cookie 沒有 `httpOnly`、`secure`，或 `sameSite` 是 `none` 又沒有 CSRF 防護 | MEDIUM |
| 重設密碼 token | 重設密碼的流程 | token 可預測（見 H）、沒有效期、用過不失效、重設後沒讓舊 session 失效 | HIGH |
| 暴力破解 | 登入、OTP、重設密碼、邀請碼 | 沒有 rate limit 或次數上限；OTP 位數少又沒上限 | MEDIUM（OTP 為 HIGH） |
| 帳號列舉 | 登入與忘記密碼的錯誤訊息 | 「帳號不存在」與「密碼錯誤」回不同訊息或不同 status | LOW |

### C. 注入

| 項目 | 怎麼找 | 成立條件 | 預設 |
|---|---|---|---|
| SQL injection | `$queryRawUnsafe`、`$executeRawUnsafe`、`sql.raw(`、`knex.raw(`、`.query(\``、`execute(f"`、`% (` 拼進 SQL | 使用者輸入進到 SQL 字串而不是參數；`ORDER BY` / 欄位名 / 表名沒有白名單 | HIGH |
| Command injection | `exec(`、`execSync`、`spawn(... { shell: true })`、`subprocess(... shell=True)`、`os.system` | 使用者輸入進到指令字串 | CRITICAL |
| Path traversal | `path.join(`、`fs.readFile`、`send_file`、`open(`、下載檔案的 route | 使用者給的檔名或路徑沒有正規化並檢查仍在允許的目錄內 | HIGH |
| NoSQL injection | `find(req.body)`、`$where`、`$regex` 接使用者輸入 | 整個物件傳進查詢，可以送 `{"$ne": null}` | HIGH |
| XSS | `dangerouslySetInnerHTML`、`v-html`、`innerHTML`、`{@html`、`\|safe`、`mark_safe` | 內容來自使用者且沒有經過 sanitizer（DOMPurify 等） | HIGH（儲存型）/ MEDIUM（反射型） |
| Template / eval | `eval(`、`new Function(`、`render_template_string`、`vm.runIn` | 使用者輸入進到被執行或被當成模板的字串 | CRITICAL |

### D. 請求偽造與重導

| 項目 | 怎麼找 | 成立條件 | 預設 |
|---|---|---|---|
| SSRF | `fetch(`、`axios(`、`requests.get(`、`http.Get(` 的 URL 參數 | URL 來自使用者，沒有網域白名單，也沒擋私有 IP 與 `169.254.169.254`（雲端 metadata） | HIGH（雲端環境為 CRITICAL） |
| Open redirect | `redirect(`、`res.redirect`、`next` / `returnTo` / `callbackUrl` 參數 | 導向目標來自使用者，沒限制只能是站內相對路徑 | MEDIUM |
| CSRF | 用 cookie 認證、會改資料的 route | 沒有 `sameSite=lax/strict`、沒有 CSRF token；或用 **GET** 改資料 | MEDIUM |
| CORS | `cors(`、`Access-Control-Allow-Origin` | `origin` 是 `*` 或直接反射請求的 Origin，同時 `credentials: true` | HIGH |
| Webhook 沒驗簽 | Stripe / GitHub / LINE 等 webhook handler | 沒驗簽章就處理；或用 `===` 比對簽章（應該用 timing-safe compare） | HIGH / LOW |

### E. 檔案上傳

| 項目 | 怎麼找 | 成立條件 | 預設 |
|---|---|---|---|
| 型別只看副檔名 | 上傳 handler、`multer`、`UploadFile` | 只檢查副檔名或前端送的 `Content-Type` | MEDIUM |
| 同源提供使用者檔案 | 上傳檔案的存放與讀取位置 | 使用者上傳的 SVG / HTML 由主網域直接提供（等於儲存型 XSS） | HIGH |
| 沒有大小限制 | body parser 設定、上傳 handler | 沒設上限 | MEDIUM |
| Presigned URL 範圍 | S3 / R2 / GCS 簽 URL 的地方 | key 由使用者決定（可覆蓋別人的檔案）、效期過長、讀取 URL 沒檢查擁有者 | HIGH |

### F. 業務邏輯（掃描器完全看不到）

| 項目 | 怎麼找 | 成立條件 | 預設 |
|---|---|---|---|
| 信任前端算的金額 | 結帳、下單、儲值的 handler | 價格、總額、折扣從請求來，而不是伺服器端重算 | CRITICAL |
| 負數與零 | 數量、金額、點數的輸入驗證 | 可以送負數或零（負數轉帳 = 反向轉帳） | HIGH |
| 狀態跳步 | 狀態轉換的 handler，對照 `docs/domain/model/` 的狀態機 | 沒檢查目前狀態就轉換（未付款直接出貨） | HIGH |
| Race condition | 先查再寫：餘額、庫存、優惠券、每人限一次 | 查詢與寫入之間沒有交易鎖、條件式更新或唯一約束；連送兩次可以用兩次 | HIGH |
| 重複送出 | 付款、下單、扣款 | 沒有冪等鍵，重送會重複扣款 | MEDIUM |

### G. 資料外洩

| 項目 | 怎麼找 | 成立條件 | 預設 |
|---|---|---|---|
| 回傳整個 ORM 物件 | `return user`、`res.json(user)`、`select *` 直接回傳 | 回應帶出密碼雜湊、內部欄位、別人的個資 | HIGH |
| 錯誤細節 | 全域錯誤處理、`catch` 回傳 | production 回傳 stack trace、SQL 錯誤、內部路徑 | MEDIUM |
| Log 帶敏感資料 | `console.log`、`logger.` 記錄 request / header / body | 記下 `Authorization`、cookie、密碼、完整連線字串 | MEDIUM |
| 前端 bundle 帶 secret | `NEXT_PUBLIC_*`、`VITE_*`、`EXPO_PUBLIC_*`、`REACT_APP_*` | 這類變數裡放了 secret（它們會被打包進前端） | CRITICAL |
| Source map 公開 | build 設定（`productionBrowserSourceMaps`、`sourcemap: true`） | production 對外提供 source map | LOW |

### H. 密碼學與隨機

| 項目 | 怎麼找 | 成立條件 | 預設 |
|---|---|---|---|
| 可預測的 token | `Math.random`、`random.random`、`rand.Int` 用來產 token、驗證碼、重設連結 | 應該用 `crypto.randomBytes` / `crypto.randomUUID` / `secrets` / `crypto/rand` | HIGH |
| 寫死或重複的 IV / key | `createCipheriv`、`AES.new` | IV 固定、key 寫在程式碼、用 ECB 模式 | HIGH |
| 自製加密 | 自己寫的 encrypt / hash 函式 | 不是用標準函式庫的現成方案 | MEDIUM |

### I. 設定

| 項目 | 怎麼找 | 成立條件 | 預設 |
|---|---|---|---|
| Debug 模式 | `DEBUG = True`、`NODE_ENV` 判斷、`app.run(debug=True)` | production 設定開著 debug | HIGH |
| Security headers | `next.config` 的 `headers()`、`helmet`、反向代理設定 | 沒有 CSP、HSTS、`X-Frame-Options` / `frame-ancestors` | LOW |

## 信心與證據

- **信心 `高`**：從入口一路讀到危險的那一行（sink），中間確認沒有任何檢查。報告的 Source 要寫出入口與 sink 兩個位置。
- **信心 `中`**：找到 sink，但檢查可能在沒讀到的地方（全域 middleware、上層 service、DB policy）。寫明「沒讀到的是哪裡」。
- 讀了之後發現有檢查 → 不列 finding，也不用寫進「已排除」（那是給掃描器誤報用的）。
- 同一個模式在多個入口出現（十個 route 都沒檢查擁有者）→ 合併成一條，列出全部位置，修法寫成「在共用的一層統一處理」。
