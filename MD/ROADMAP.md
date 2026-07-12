ROADMAP.md


依本對話紀錄整理。原則：


只列「已完成」與「已討論但尚未執行」的項目，不臆測未來規劃。
無明確時程者不編造日期，僅分 完成 / 進行中 / 未來規劃 三類。
缺乏資訊處標 TODO，不腦補。


注意：本對話橫跨兩個技術棧不同的專案，以下分開列，未合併。
兩專案是否屬同一產品線／各自 repo —— TODO（對話未確認）。



═══════════════════════════════════════

Roomie（家務室友 app）

Stack：React + TypeScript (Vite) + Supabase(Postgres/Auth/Realtime) + Cloudflare Pages


版本說明：對話中以「v1」統稱首版；DB migration 依序標為 v1.1–v1.6；「v2」為明確講好延後的項目。



v1 · 完成


技術選型與部署：初期試 GitHub Pages，因部署卡關改用 Cloudflare Pages（已上線）
資料庫：schema + RLS + triggers（households / profiles / household_members / tasks / expenses / expense_splits / settlements / laundry_config；含洗衣自動排程 trigger、餘額 view）
登入與成員：Email magic link → 追加 Email 密碼登入 + 註冊 + 限時單次邀請碼加入
首頁提醒面板：進站計算「逾期 / 今天 / 待認領 / 我負責的」+ 紅點徽章
待辦：個人／公共、先搶先贏認領、完成、編輯、刪除，權限（誰的任務誰完成，DB trigger 強制）
洗衣：週期（起始日＋間隔天數）、每日名額（平日／週末）自動排程順延、完成、編輯
分帳：記一筆、參與者分攤（誰付／誰分）、淨額顯示、結清、編輯、可見性（只有相關人看得到）、可指定任意付款人
設定頁：暱稱、生日、變更密碼、家庭成員清單、登出
安全／隱私：任務寫入 RLS、分帳可見性 RLS、邀請碼限時單次
修復：手機長名稱跑版、checkbox 版面、npm ci lock 檔不同步、啟用 Supabase Realtime



進行中

食材 / 煮菜規劃（FEAT-001）：規格草擬中（Goal / User Story / Acceptance Criteria 已補；仍有 open questions 未清；此 feature 專案歸屬待你確認 —— 內容像 Roomie 但尚未確認）

Future · 未來規劃（已討論、尚未執行，無時程）

v2：任務委派 / 交換 / 同意流程（當初明確延後至 v2；task_requests 表已建、功能未實作）
手機推播通知（v1 僅做進站計算，推播留 v2）
食材 / 煮菜規劃「實作」（待規格定案後）
生日提醒（設定頁已存生日，曾提可做室友生日提醒）
重新開啟 Email 確認 / 接自有 SMTP（安全檢視時建議過）
3+ 人分帳的介面優化（曾提及）
時程：TODO（對話中未定義任何日期）