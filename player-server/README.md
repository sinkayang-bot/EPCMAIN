> 2026-10-24 使用者選擇不綁卡的免費試行版。請改依 `../player-free/README.md` 建立獨立 Spark 專案；本資料夾的 Cloud Functions 為先前的待部署方案，本次不部署。

# EPC 玩家版 — 上線準備

目前 GitHub Pages 可使用 `player/?demo=1` 完整操作示範。`player/config.js` 的 `enabled` 保持 false，正式版不讀取舊會員名單、賽事原始 players 陣列、玩家帳務或活動全庫，也不會假裝示範點數和優惠券是真實發放資料。

## 必須先完成的正式部署

1. 使用有權限的 Firebase 專案管理員部署本資料夾的 Cloud Functions 到 `epcmain-76988`。目前這些函式只完成程式與測試，尚未部署。需先確認專案計費與 Functions 可用；不要擅自啟用計費。
2. **目前舊賽事 `epc_events/{document=**}` 在既有規則中是公開讀寫。這是玩家端對外開放的阻擋條件。** 只加玩家專用 API 無法修復原始資料的公開權限。須先替正式後台、手機與配對電視規劃並驗證認證、收緊原始資料規則，確保現場系統不會因此斷線。不可直接把舊規則關閉或改成全庫公開。
3. 把 `firestore-player.rules.fragment` 合併到實際現行規則；此檔不是完整規則，不能整份替換。新資料集合原始碼完全不含玩家對集合的寫入權限。Firebase Admin SDK 由函式伺服器處理寫入。
4. 驗證 Google provider 與 `sinkayang-bot.github.io` 登入網域。會員綁定需櫃台核對本人與會員編號。六位碼只連接已登入 Google UID，不能由玩家自選會員編號綁定。
5. 在測試專案驗證兩個不同 UID：只能讀自己，不能 list 會員，不能修改自身餘額／優惠券，也不能透過 request.data 冒充其他會員。驗證匿名只讀 sanitized 公開賽事投影。
6. 由既有 `epc_accounting_admins/{uid}.active == true` 的管理員執行首次公開投影初始化（`epcPlayerAdmin` kind `bootstrapPublic`），並使用測試帳號完整驗證綁定與回填、發券、點數、到期與重複核銷。
7. 完成 App Check、配額與濫用評估、規則模擬器／Emulator 與真實裝置測試後，才將 `player/config.js` 的 enabled 改 true 並發布。

部署範例（先在測試專案驗證，執行者須自行登入有權限的 Firebase CLI）：

```sh
cd player-server
npm ci
firebase deploy --config firebase.staging.json --project <已確認的測試專案> --only functions:epc-player
```

`shared/` 是目前正式計時器與計價函式的快照。若計價規則或倒數規則更新，先由專案根目錄複製 `timer-core.js`、`player-pricing.js` 進此目錄，執行測試後才部署，避免兩端公式不同。

## 資料與權限

- `epc_player_public_events/{eventId}`：只含公開名稱、營業日、級別、盲注、倒數、參賽人數、組數、獎池、平均籌碼。沒有個人身分、逐人費用與輸贏。
- `epc_player_profiles/{uid}` 和底下 `history/coupons/points`：只給該 UID 讀；只由伺服器寫入。
- `epcPlayerMe` 完全忽略呼叫者傳入的會員編號，使用已驗證 UID 的櫃台綁定。
- `epcPlayerAdmin` 只接受既有已驗證 Google 管理員；發放與核銷採唯一 operationId 和交易避免重複。
- 輸贏＝已結算獎金減該場含優惠後應付費用；進行中不計入，寄存與是否已領現金另屬帳務。
- 優惠券核銷只改券狀態，不自動改賽事價錢或補收付款；實際折抵作業須與後台既有流程核對後再擴充。
- 點數目前只有人工發放／扣除，沒有未經店主確認的自動累點制度。
- 公開／私人投影資料夾未寫入任何真實會員資料；本次沒有建立帳號綁定、發券或更動正式帳務。

## 已做與尚未做

已做：手機 PWA 外觀、自己的紀錄與日期查詢、優惠券／點數頁、相同倒數核心、離線提示、登入／登出與綁定流程程式、伺服器投影與權限設計、管理頁、單元測試、GitHub Pages 示範。

尚未做：Firebase 部署、來源資料權限改造、真實會員綁定、正式優惠／點數制度確認、真實 Google 登入與跨會員隔離的端到端驗證、原生 App Store／Google Play 上架。

### 活動排行榜（第二版，尚未正式接通）
玩家版新增活動與排行示範。正式讀取 `epc_player_public_activities` 中 `active: true` 的已核定公開投影；伺服器發布器已實作 Google Apps Script 的 activity.get 唯讀同步與指定日期 Firebase 賽事查詢；玩家瀏覽器不讀原始活動、會員或帳務集合。
每份投影包含 `name, subtitle, from, to, status, metric, unit, rules: string[], entries: [{key, displayName, rank, value}]`。名次由後台活動規則核定，可包含並列名次；前端不重新推算。`key` 必須使用會員私有 profile 的隨機 `leaderboardKey`，絕不可使用會員編號、電話或登入 UID；displayName 僅放經同意公開的暱稱。綁定時建立隨機 key，舊綁定需先由可信任後端補齊。排行榜不得含個人輸贏或付款資訊。
活動投影發布器、玩家公開暱稱選擇與撤回遮蔽已實作並以合成資料測試。現有 config.enabled 維持 false；尚未部署 Functions、合併規則或啟用真實資料。

### 第三版：正式來源串接程式（未部署）
- `activities.js` 封裝現行後台的計分函式快照：週排行、獵人、保護傘、極限 10 秒。週排行僅計已結算，保留手動加減分、倍率；極限每人取最佳並列名次。不改後台的現行規則或獎勵。
- `activity-publisher.js` 每 5 分鐘唯讀取得現有 Apps Script `activity.get`，保留 revision；Firebase 查詢限制在已啟用活動的日期範圍，並針對相關登記補讀關聯場次以排除獨立帳。若來源失敗或回傳舊 revision，不清空最後成功的榜單。工作識別碼與交易避免過期工作覆寫新版投影。
- 僅計算已設定完整起訖日期且經管理員啟用的活動。日期可涵蓋至多一年。名稱排序優先採用賽事內已有的 nickname/name，不讀整份會員名單；同分且自動分相同時，舊後台若只在 Google 會員名單修改了顯示名稱，排序可能不同，需於正式驗收核對。計分函式漂移檢查會在後台公式更新時讓測試失敗。
- 管理頁增加活動發布設定、正式規則與立即同步按鈕。伺服器管理 callable 僅接受既有管理員；沒有自動發獎或修改活動登記。
- 公開榜單僅包含隨機識別碼、暱稱、名次與積分／秒數。未綁定或未同意公開暱稱，一律「匿名玩家」。本人可依自己的不透明 leaderboardKey 找到名次。會員編號、姓名、逐人輸贏、付款資料不會出現在投影。
- 玩家可在「我的帳號 → 排行榜公開設定」選擇公開暱稱或撤回。撤回會先直接遮蔽四份公開榜單，再嘗試重算，活動來源故障也不必等重算才遮蔽。模擬版只改記憶體，重新整理恢復示範資料。
- 私有 source/settings/jobs/aliases 集合必須合併禁止客戶端存取的規則。公開活動集合不能由瀏覽器寫入。
- **尚未正式啟用**：須先完成前述現有 EPC 認證與原始資料權限遷移，再由已登入且有部署權限的 Firebase 環境部署 Functions（含 scheduler）。接著在後台設定活動區間、由管理員於 player-admin 配置正式規則並同步；以兩個測試會員驗證隔離、暱稱撤回與名次，確認後才開啟 player/config.js。

驗證：`node tests/player-activities.mjs`、`node tests/player-server-auth.cjs`、`node tests/player-app-model.mjs`、使用 jsdom 執行 `tests/player-app-ui.cjs`。資料均為合成 fixture，尚未執行真實 Google 登入、正式來源讀取或 Firebase Emulator/部署端到端測試。
