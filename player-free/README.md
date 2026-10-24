# EPC 免費試行版（Spark）

本版依使用者選擇，不啟用計費、不部署 Cloud Functions，不建立付費 Cloud Scheduler 或 Storage bucket。使用獨立的 epc-player-* 專案；setup.py 明確拒絕原 EPCMAIN 與交易專案，亦不修改 gcloud 的預設專案。

## 建立與驗收

1. 在已登入專案管理員 Google 帳號的 Cloud Shell 複製此 GitHub 專案，執行 `python3 player-free/setup.py`。建立新的 Cloud 專案、加入 Firebase、開啟免費 API、建立台灣 asia-east1 預設 Firestore、部署本目錄規則、建立 Web App，最後印出公開網頁設定。若計費不是明確 false，立即停止。首次執行尚未在真實 Google 專案驗證；若 Google 拒絕某步，保留原目錄與本機狀態檔，依錯誤修正，不重新產生多個專案。
2. 至輸出的 Firebase Console 網址啟用 Authentication 與 Google provider，選擇管理員支援電子郵件；在 Authorized domains 加入 sinkayang-bot.github.io。這是目前唯一需要 Firebase Console 手動完成的設定。
3. 開啟 `/player-free/setup.html` 貼入輸出 JSON。只儲存 apiKey/authDomain/projectId/appId；不接受 production project ID、外部 auth domain、權杖或私鑰。此設定僅存在該瀏覽器；正式發布同一份公開設定前，先完成測試。新裝置試行需自行貼相同設定。
4. 開啟 `/player/?trial=1` Google 登入並取得六位綁定碼；櫃台於 `/player-admin/?trial=1` 用建立專案的管理員帳號登入，核對身分後綁定。重碼時拒絕綁定，不會錯配。
5. 管理員設定各活動正式規則與是否發布，於 `/player-free/publisher.html?trial=1` 載入原 EPC 後台的檢視來源，完成雲端讀取後按同步。保持同步頁開啟才能每分鐘更新；背景頁會暫停，瀏覽器可能限制背景執行。
6. 以兩個測試 Google 帳號核對自己的紀錄與公開暱稱；本版於櫃台綁定後同步個人歷史，也可手動補同步。既有 EPC 原始資料權限仍需獨立改造驗證，不能因玩家版隔離就宣稱原系統已完成保護。

## 免費架構與範圍

- Google Firebase Auth + Firestore rules；讀寫直接經規則檢查，未使用付費 callable Functions。
- 初始專案建立者的 Google email 為規則內的初始管理員；必須是已驗證 Google provider，Email/Password 或未驗證同名 email 不通過。其他管理員只能由既有管理員建立 epc_player_admins 文件。
- 玩家僅可讀自己的 profile/history/coupons/points；不能自建綁定、改點數、發券、核銷或改活動分數。管理操作採 transaction/audit operationId 防止重複處理。櫃台必須核對本人；不接受玩家自行指定會員編號綁定。
- 公開賽事僅有場名、日期、盲注、截止時間與總計；活動 entries 只有隨機 key、匿名標籤、名次與成績。公開暱稱另存單份 directory，讀取一次即取得所有名稱，避免每位玩家每分鐘掃描數百份暱稱文件。玩家只能改自己已綁定的隨機 key，撤回時設成空字串；其他玩家下次輪詢即匿名。
- 免費同步頁只讀原 EPC，僅寫新專案。保持檢視模式；不匯出姓名、會員編號、逐人金額或輸贏。使用最小必要的活躍計時器讀取，沒有變更時不重寫公開文件，別名做本機快取。
- 名次計算沿用既有公式；個人資料同步與真實歷史回填仍未開放。券與點數為櫃台人工操作，不自動套入原賽事帳務。
- 玩家公開輪詢 60 秒，最多 16 場賽事／活動文件；個人歷史按日期查詢，每次最多 500 筆，月份摘要另保留當月結果；優惠券與點數各最近 200 筆。目錄最多 2000 個別名。大量資料需分頁擴充及實測免費額度，不保證任何流量下均不超額。
- 原倒數核心本機運算，不每秒讀 Firestore。來源關閉後，本機仍依最後截止時間倒數，但無法得知新一場、人工暫停、調整盲注等新指令，頁面只代表最後同步狀態。

## 測試

- `node tests/player-free-config.mjs`：拒絕原 EPC project／外部登入網域，安全解析本機設定。
- Firestore Emulator + `tests/player-free.rules.cjs`：跨帳號隔離、偽造管理員、禁止自行改點數發券、自有暱稱修改與撤回、綁定碼 TTL、停用會員、管理員交易綁定／點數冪等／重複核銷。
- `tests/player-app-ui.cjs`、`tests/player-app-model.mjs`、`tests/player-activities.mjs`、`tests/timer-frame.mjs`：既有玩家介面、公式與投影回歸。
- 尚未執行：新 Google 專案建立 API 的端到端驗證、真實 Google provider 登入、新專案的公開賽事同步。

Cloud Shell 的 setup-state.local.json 與 firebase-web-config.local.json 只留當地並已列入 gitignore。Google access token 僅在記憶體送往 Google API 的 Authorization header，絕不印出或保存。

## 櫃台快速綁定（v6）

玩家登入後到「我的帳號」產生 QR Code／六位碼（有效十分鐘）。
管理員在 `player-admin/?trial=1` 掃描 QR Code、選擇 QR 圖片或輸入六位碼，
再輸入原系統會員編號，會透過既有唯讀 `member.list` 查詢自動帶入綽號。
會員編號採完整比對；找不到、重複、停用或資料變更會停止，須重新查詢。
櫃台核對本人後按「確認會員並綁定」，才會寫入試行專案。
掃碼本身不會自動綁定。相機與圖片只在瀏覽器解碼；無相機可用六位碼。
QR Code 只含專案 ID 與短效綁定碼，不含會員資料、金鑰或權杖。
會員來源只於管理員權限確認後查詢，不儲存或發布完整名冊，不修改原會員資料。
本次不需重新執行 Cloud Shell 或更新 Firebase 規則。

## 個人紀錄同步（v7）

原後台左側「玩家服務管理」開啟櫃台頁。新綁定後立即同步；
舊綁定可填會員編號按「同步此會員參賽紀錄」。
管理員的免費版同步頁開啟時，來源或綁定變更也會於下一輪檢查同步。
使用既有計價模組；進行中不顯示領回獎金、不納入已結算輸贏。
只有管理員讀取原專案並按已綁定會員分流，玩家端不載入原專案 SDK 設定。
每次同步都以 server snapshot 取得來源，失敗不刪除舊紀錄；
交易重新核對 UID、會員編號與有效狀態，並用同步 token 阻止舊作業蓋掉新同步。
刪除賽事或移除玩家會移除對應的私有副本。發券、點數、寄存金不受影響。
這是副本同步，不會修補原 EPC 專案既有的存取規則。

## 活動同步與多活動列表（v8）

櫃台「立即同步活動成績」會開啟同步頁並自動載入現場來源及發布。
也可手動載入來源，勾選要公開的週排行、獵人、保護傘、極限 10 秒再同步。
初次發布預選原後台已設定有效日期的活動；曾停用的活動不會自動重新啟用。
頁面明確顯示活動數量、來源日期與同步失敗原因；來源未載入前不能同步。
公開活動先發布，個人歷史同步另行處理，失敗不再阻斷公開活動。
玩家活動頁同時呈現所有已發布活動的卡片，點選卡片查看該活動完整排行榜。
