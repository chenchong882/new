# 📋 萬用鑰匙功能 — 交付 Opus 4.8 執行計畫

> 由 Fable 5 盤點、待 Opus 4.8 執行完成。
> 目標：讓老師能臨時叫出任何學生做過的任何一課展示，**完全不影響學生的固定連結、也不改任何 lessons.json**。

---

## 背景快照（本 session 最後一次成功讀取的狀態）

| 項目 | 狀態 |
|------|------|
| HEAD | `c97a969 單字填空題加作答提示`，本機 == origin/main（fetch 後同步） |
| 工作區未提交 | `M admin.html`、`M play.html`、`?? CLAUDE.md` |
| 萬用鑰匙功能碼 | **已在工作區**：`admin.html` 有 `setupMasterKey` 面板、`play.html` 有 `unitsParam` 引擎 |
| `lessons.json` `all` 欄位 | 5 個資料夾全補齊，已 commit 進歷史 |
| 填空題提示 | 已被別的 session commit 進 `c97a969`（非本功能，勿誤動） |
| ⚠️ 風險 | 對話橫跨數日、有平行 session 動過同 repo，功能碼曾被覆蓋又出現 → **不可信任此快照，須先重新 baseline** |

---

## 執行步驟

| # | 步驟 | 動作 | 驗收標準 |
|---|------|------|----------|
| 1 | **重新 baseline** | `git fetch` → 比對 `HEAD..origin/main` 與 `origin/main..HEAD` | 若遠端有本機沒有的 commit → **停下回報 Ivan，勿 push**（全域新規則「Git 雙電腦同步檢查」）；同步才續 |
| 2 | **核對 diff 乾淨** | `git diff -- admin.html play.html` | 只含萬用鑰匙功能（admin：`.mkey` CSS ＋ `<section class="mkey">` ＋ `setupMasterKey`；play：`src`/`units`/`folder`/`unitsParam` 那段 useEffect）；**無夾帶別人的半成品** |
| 3 | **端對端實測（不自驗）** | headless Chrome 跑三條測試 | 見下方「驗收測試」三條全綠、console 無非 favicon 錯誤 |
| 4 | **跨平台快檢** | 依 `~/Desktop/studentgames/CLAUDE.md`「跨平台相容標準」 | 本次只動網址解析/DOM、無發音改動，低風險；確認 iOS/Android 選單與開啟連結正常即可 |
| 5 | **決定 CLAUDE.md 去留** | `?? CLAUDE.md` 未追蹤 | **問 Ivan**：專案規範要不要一起進 repo／上 Pages？（預設先不 commit，避免內部規範上公開部署） |
| 6 | **commit** | 只 commit `admin.html` + `play.html` | 訊息例：`admin 加臨時展示萬用鑰匙；play 支援 ?src=&units= 臨時載入（學生固定連結不受影響）` |
| 7 | **push 前再 fetch** | 重跑步驟 1 的比對 | 確認遠端無新增才 push；回報註明「已確認遠端無額外改動」 |
| 8 | **push + 驗上線** | `git push` → 等 Cloudflare 部署 | `new-3a8.pages.dev` 進 admin（密碼 1999）看得到 🔑 面板、能開舊課 |

---

## 驗收測試（步驟 3 用；本機 `python3 -m http.server`）

1. **學生固定連結不變**：`play.html?id=雄工` → 只出本次段考（Unit 5/6），**不含** Unit 3。
2. **鑰匙列得出被藏的舊課**：admin 選來源「雄工」→ chips 應含 `Unit 3`、`Unit 4`（無 ★）與 `★Unit 5`、`★Unit 6`（★ = 本次段考）。
3. **臨時連結真的載入舊課**：點 Unit 3 產生 `play.html?src=雄工&units=h1-4-u3` → 開啟後載入 Unit 3，**不混進** Unit 5。

---

## 功能設計要點（驗收對照用）

- **學生端** `?id=<資料夾>`：永久不變，發一次一輩子有效。
- **`?units=`**：覆蓋要載入的課程代號清單（逗號分隔）。
- **`?src=`**：把課程檔改從指定資料夾抓（跨學生展示用）。
- `folder = src || id`；有 `units` 就用網址清單、否則讀該資料夾 `lessons.json` 的 `units`。
- `?units=` / `?src=` 只給老師臨時展示，**不改任何 lessons.json**。
- `lessons.json` 的 `all` 欄位：列該資料夾全部課程代號，**只給 admin 鑰匙列選項用，學生端不讀**。

---

## 交接注意

- 🚫 **沙箱/權限**：執行的 session 必須能存取 `~/Desktop/新組合`。（Fable 盤點時對該路徑 `EPERM`，無法讀寫。）
- 🔧 **日後維護習慣**：出新課時，把代號加進該資料夾 `lessons.json` 的 `all` 陣列，鑰匙才列得出來。既有課程已補齊。
