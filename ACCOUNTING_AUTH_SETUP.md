# EPCMAIN 帳務管理員設定

登入程式與規則檔已提交，不代表 Firebase Console 設定已發布。

1. 開啟 Firebase 專案 `epcmain-76988` → Authentication → Sign-in method，啟用 Google，選擇自己的支援電子郵件並儲存。
2. Authentication → Settings → Authorized domains，加入 `sinkayang-bot.github.io`（僅網域，不含 https 或路徑）。
3. 在 EPCMAIN 按「Google 管理員登入」，使用你確定要授權的管理員 Google 帳號登入。登入成功後尚未取得權限是正常的。展開「首次啟用帳務管理員」複製 UID。
4. 在 Firebase Console 的 Firestore → 資料，建立集合 `epc_accounting_admins`。文件 ID 設為上一步 UID，新增欄位 `active`，型別 boolean，值為 true。確認登入帳號是要授權的管理員再儲存。這會授予該帳號全部每日帳務的讀取、修改和刪除權限。
5. Firestore → 規則，用 `firestore-accounting.rules` 完整替換截圖中的規則並發布。不要加全資料庫的公開讀寫規則。若現有規則已與截圖不同，先比對再合併。
6. 回 EPCMAIN 按「重試帳務連線」。必須顯示「管理員已連線」才可儲存。另一台電腦也需要用授權帳號登入。

規則只允許已驗證的 Google 帳號，且它的 UID 文件 `active == true`。其他登入者和未登入者均無帳務權限。瀏覽器不能新增或修改管理員名單。撤銷時，由 Firebase Console 將該 UID 的 `active` 改成 false。

賽事集合保留你截圖中已有的公開權限；本次只新增受管理員驗證的帳務權限，並未完成整個專案的安全改造。

## 驗證

- `node tests/accounting-regression.cjs`：帳务新增後數字、日期、刪除、舊快照與失敗回復。
- `node tests/accounting-auth.cjs`：未登入不訂閱帳務、未授權錯誤、伺服器權限確認、登出取消訂閱、過期回呼忽略。
- 真實 Firebase 規則仍須在 Console 規則模擬器檢查：未登入/其他 UID 被拒，授權 UID 可讀寫帳務，所有 UID 都不能透過客戶端寫入管理員名單。

官方依據：
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/firestore/security/rules-conditions
