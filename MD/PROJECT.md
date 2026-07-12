# PROJECT.md

> **本文件為此專案的唯一真實來源(Single Source of Truth, SSOT)。**
> Claude Code 及所有協作者應以本文件為準。
>
> **維護規則**
> - 標記 `TODO` 之處為尚未提供、待確認的資訊 —— 請勿臆測填補。
> - 任何新事實應先寫入本文件,再據以實作。
> - 依 [CLAUDE.md](CLAUDE.md) 工作流程:架構有變動 → 更新本文件;功能有變動 → 更新對應 Feature 文件。
>
> **對象專案**:Roomie(家務室友)—— 給室友共用的家務 / 洗衣 / 分帳網站。

---

## 1. 專案概述

| 項目 | 內容 |
|---|---|
| 名稱 | Roomie(家務室友) |
| 一句話介紹 | 給你和室友用的家務 / 洗衣 / 分帳共享網站 |
| package.json 版本號 | `0.1.0` |
| 對外版本代號 | v1(已完成,見 §5、[ROADMAP.md](ROADMAP.md)) |
| 目前目標 | TODO(§9、§10 為已知的進行中 / 未來項目,但未提供明確的「目前主要目標」) |
| 進行中的功能 | 食材 / 煮菜規劃(FEAT-001,見 §9 與 [features/Cooking_and_Ingredients.md](features/Cooking_and_Ingredients.md)) |

## 2. 技術堆疊與限制(Constraints)

- 前端框架:**React 18.3.1** + **TypeScript 5.5.4**,建置工具 **Vite 5.4.2**
- 後端 / 資料庫:**Supabase**(Postgres + Auth + Realtime),前端直接呼叫 Supabase(`@supabase/supabase-js` 2.45.4),**沒有獨立的自寫後端 API 層**
- 認證:Supabase Auth —— Email 密碼登入 + Email magic link;`.env` 存放 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`(anon key 依 [README.md](README.md) 設計上可公開,安全性靠 RLS 把關)
- 前端部署:**Cloudflare Pages**(依 [ROADMAP.md](ROADMAP.md):「初期試 GitHub Pages,因部署卡關改用 Cloudflare Pages(已上線)」)

⚠️ **待確認的不一致**:
- [README.md](README.md) 的「部署到 GitHub Pages」段落與 `package.json` 的 `deploy` script(`gh-pages -d dist -t`,推到 `gh-pages` 分支)仍是 GitHub Pages 流程,與 ROADMAP 所述「已改用 Cloudflare Pages」矛盾。**目前實際生產環境用哪一種部署方式 —— `TODO(待確認)`**,修改部署相關設定前請先確認。

未提供、待補:
- Node.js 版本需求 —— `TODO`
- Cloudflare Pages 專案設定(build command、output 目錄、環境變數注入方式)—— `TODO`

## 3. 架構(Architecture)

不是 Clean Architecture / 分層後端架構 —— 這是一個**純前端 SPA 直連 Supabase** 的專案,沒有自寫的 Domain / Application / Infrastructure / Presentation 分層。

實際目錄結構:

```
src/
  App.tsx            主畫面:分頁切換(首頁/待辦/洗衣/分帳/設定)、邀請室友 Modal
  main.tsx           React 進入點
  store.tsx           全域狀態(StoreProvider/useStore):登入 session、household、members、
                      tasks、laundry、expenses、balances、laundryConfig;
                      登入後載入資料 + 訂閱 Supabase Realtime(tasks/expenses/settlements)
  index.css           全站樣式
  lib/
    supabase.ts        Supabase client 初始化
    api.ts              所有資料查詢與寫入(auth / household / tasks / laundry / money)
    types.ts            對應 DB 的 TypeScript 型別(Member/Task/Expense/Balance/LaundryConfig)
    time.ts              日期與逾期判斷(dueState 等)
    tasks.ts              TODO(用途未逐行確認,推測為 tasks 相關輔助函式)
  components/
    Login.tsx, JoinHousehold.tsx, Home.tsx, Tasks.tsx,
    Laundry.tsx, Money.tsx, Settings.tsx, ui.tsx(共用 UI元件:Button/Modal/Segmented 等)
supabase/
  schema.sql                    v1 基礎 schema(表、view、function、RLS)
  migration_v1_1_invite.sql     註冊 + 邀請碼加入家庭
  migration_v1_2_expense_privacy.sql  分帳可見性 RLS
  migration_v1_3_task_perms.sql       任務寫入權限(DB trigger 強制)+ 重新產生邀請碼(後於 v1.4 淘汰)
  migration_v1_4_invite_expiry.sql    邀請碼改為限時、單次使用(取代 v1.1 的永久碼)
  migration_v1_5_profile.sql          profiles 補 birthday 欄位
  migration_v1_6_split_fix.sql        修正分帳明細寫入的 RLS 死結
```

- Migration 執行方式:手動在 Supabase SQL Editor 依序貼上執行(依各檔案註解),**沒有** migration 工具(如 Supabase CLI migration)自動化管理 —— `TODO(是否要改用工具化管理待確認)`
- 前後端邊界:前端透過 `supabase-js` 直接讀寫資料表(受 RLS 保護)與呼叫 Postgres RPC function(`create_household` / `join_household` / `create_invite` 等),無自寫 REST API

## 4. 模組(Modules / 前端分頁)

- **Home**(首頁):逾期 / 今天 / 待認領 / 我負責的 統計與紅點提醒
- **Tasks**(待辦):個人 / 公共任務,先搶先贏認領,完成 / 編輯 / 刪除
- **Laundry**(洗衣):週期排程(起始日 + 間隔天數),平日 / 週末每日名額,撞名額自動順延
- **Money**(分帳):記一筆花費、參與者分攤、淨額顯示、結清、可指定任意付款人
- **Settings**(設定):暱稱、生日、變更密碼、家庭成員清單、登出
- **JoinHousehold**:建立新家 or 用限時邀請碼加入
- **Login**:Email 密碼登入 / 註冊、magic link

> 各模組詳細行為邊界、例外規則 —— 尚無個別 Feature 文件,`TODO`(可依 [features/Feature_template.md](features/Feature_template.md) 補齊,新功能規格請一律先建立 Feature 文件,見 FEAT-001 範例)

## 5. 既有功能(Existing Features,v1 已完成)

依 [ROADMAP.md](ROADMAP.md):

- 技術選型與部署:GitHub Pages → Cloudflare Pages(見 §2 待確認的不一致)
- 資料庫:schema + RLS + triggers(households / profiles / household_members / tasks / expenses / expense_splits / settlements / laundry_config;含洗衣自動排程 trigger、餘額 view `balances`)
- 登入與成員:Email magic link → 追加 Email 密碼登入 + 註冊 + 限時單次邀請碼加入
- 首頁提醒面板:進站計算「逾期 / 今天 / 待認領 / 我負責的」+ 紅點徽章
- 待辦:個人 / 公共、先搶先贏認領、完成、編輯、刪除,權限由 DB trigger 強制(誰的任務誰完成)
- 洗衣:週期(起始日 + 間隔天數)、每日名額(平日 / 週末)自動排程順延、完成、編輯
- 分帳:記一筆、參與者分攤(誰付 / 誰分)、淨額顯示、結清、編輯、可見性 RLS(只有相關人看得到)、可指定任意付款人
- 設定頁:暱稱、生日、變更密碼、家庭成員清單、登出
- 安全 / 隱私:任務寫入 RLS、分帳可見性 RLS、邀請碼限時單次
- 已修復:手機長名稱跑版、checkbox 版面、`npm ci` lock 檔不同步、啟用 Supabase Realtime

> 各功能的詳細行為細節、邊界、限制(例:洗衣名額滿了的順延規則細節、分帳均分餘數怎麼分配)—— 部分可見於 `src/lib/api.ts`、`supabase/schema.sql` 原始碼與註解,尚無獨立 Feature 文件整理,`TODO`

## 6. 資料庫(Database)

Supabase Postgres,已啟用 RLS(每張表皆有 policy)。以下依 `supabase/schema.sql` 與 migrations 整理**目前實際結構**:

| 實體(表 / view) | 主要欄位 | 關聯 / 備註 |
|---|---|---|
| `households` | id, name, invite_code(可為 null), invite_expires_at, created_at | 一個 household 對應一個「家」 |
| `profiles` | id(= auth.users.id), display_name, birthday(v1.5 新增), created_at | 新用戶註冊時由 trigger `handle_new_user` 自動建立 |
| `household_members` | household_id, user_id, role(預設 'member'), joined_at | household ↔ profiles 多對多(組合主鍵) |
| `tasks` | id, household_id, title, notes, category('chore'\|'laundry'\|'other'), scope('personal'\|'public'), status('open'\|'done'), assignee_id, created_by, due_at, done_at, is_recurring, recurrence_days, parent_task_id, created_at | 待辦與洗衣共用同一張表(以 `category` 區分);`parent_task_id` 指向洗衣自動排程的前一筆 |
| `task_requests` | id, task_id, type('delegate'\|'swap'), from_user, to_user, swap_with_task, status('pending'\|'accepted'\|'rejected'\|'cancelled'), created_at, resolved_at, resolved_by | **表已建立,前端功能未實作**(v2 委派 / 交換流程,見 §9) |
| `expenses` | id, household_id, description, amount(numeric 12,2, >0), currency(預設 'TWD'), paid_by, created_by, spent_at, created_at | |
| `expense_splits` | expense_id, user_id, share(numeric 12,2, >=0) | 組合主鍵 (expense_id, user_id);sum(share) 應等於對應 expense 的 amount |
| `settlements` | id, household_id, from_user, to_user, amount(>0), note, settled_at | 結清紀錄,不會刪改 expenses,而是新增一筆抵銷紀錄 |
| `laundry_config` | household_id(PK), weekday_capacity(預設 1), weekend_capacity(預設 2) | |
| `balances`(view) | household_id, user_id, net | 由 paid / owed / settle_out / settle_in 彙總計算;正值 = 別人欠他,負值 = 他欠別人 |

**主要 DB function / RPC**(security definer,供前端 `supabase.rpc(...)` 呼叫):
- `create_household(hh_name text) returns uuid`(v1.4 版本;不再產生常駐邀請碼)
- `join_household(code text) returns uuid`(v1.4 版本;驗證限時碼、成功後立即作廢,單次使用)
- `create_invite(hh_id uuid, ttl_minutes int) returns json`(產生限時邀請碼,同時只有一組有效)
- `is_member(hid uuid) returns boolean`(RLS 內部判斷是否為家庭成員)
- `can_see_expense(exp_id uuid)` / `expense_household(exp_id uuid)`(分帳可見性 RLS 輔助函式)
- `laundry_capacity_on(hid uuid, d date)` / `next_free_laundry_date(hid uuid, start_date date)`(洗衣順延排程邏輯)
- Trigger `schedule_next_laundry`:洗衣任務打勾完成 → 自動插入下一筆(依名額順延)
- Trigger `enforce_task_update`(v1.3):資料庫層強制任務修改權限(建立者 / 負責人可自由編輯;其他人僅能在「無人負責」時認領,或完成無人負責的洗衣)

> 註:`regenerate_invite_code` 函式曾於 v1.3 引入,已在 v1.4 被 `drop function` 淘汰(改為 `create_invite` 的限時碼機制)。

- Schema / migration 管理方式:手動 SQL 檔,依版號(v1.1 ~ v1.6)在 Supabase SQL Editor 依序執行,無自動化工具 —— 詳見 §3

## 7. API

**沒有自寫 REST API** —— 前端透過 `@supabase/supabase-js` 直接對 Supabase 進行:
- 資料表 CRUD(受 RLS 限制),詳見 `src/lib/api.ts` 各函式(如 `listTasks`、`createExpense`、`getBalances` 等)
- RPC 呼叫(見 §6 的 DB function 清單)

> 若之後需要「完整端點清單」的概念,應理解為 `src/lib/api.ts` 匯出的函式清單 + 對應的 Supabase 資料表 / RPC,而非傳統 HTTP API route —— 此文件目前未逐一列出映射表,`TODO(如需要可補)`

## 8. 既有決策(Decisions)

- 認證採 Supabase Auth(Email 密碼 + magic link),前端不自行處理 JWT 簽發
- 資料庫層強制關鍵權限(任務修改權限用 trigger `enforce_task_update`,而非只靠前端畫面擋)—— 見 [ROADMAP.md](ROADMAP.md)「權限(誰的任務誰完成,DB trigger 強制)」
- 邀請機制採「限時 + 單次使用」邀請碼(v1.4 起),取代早期的永久邀請碼(v1.1)
- 分帳可見性以 RLS 限制在「付款人或被分攤到的人」,而非全家庭成員皆可見(v1.2)
- [MD/doc/DECISIONS.md](doc/DECISIONS.md) 目前僅有標題、無內容 —— 尚未有正式 ADR 紀錄流程,`TODO`

## 9. Roadmap

依 [ROADMAP.md](ROADMAP.md)(注意:該檔案聲明其內容橫跨兩個技術棧不同的專案整理而成,以下僅摘錄屬於 Roomie 的部分):

**v1 · 已完成** —— 見 §5

**進行中**
- 食材 / 煮菜規劃(FEAT-001):規格草擬中,詳見 [features/Cooking_and_Ingredients.md](features/Cooking_and_Ingredients.md)。狀態 `🔵 In Review`,Milestone `???`,尚有 open questions 未清;**此 feature 是否歸屬 Roomie 專案待確認**(ROADMAP 原文:「內容像 Roomie 但尚未確認」)

**Future · 未來規劃(已討論、尚未執行,無時程)**
- v2:任務委派 / 交換 / 同意流程(`task_requests` 表已建、功能未實作,見 §6)
- 手機推播通知(v1 僅做進站計算,推播留 v2)
- 食材 / 煮菜規劃「實作」(待 FEAT-001 規格定案後)
- 生日提醒(設定頁已存生日,曾提可做室友生日提醒)
- 重新開啟 Email 確認 / 接自有 SMTP(安全檢視時建議過)
- 3+ 人分帳的介面優化

- 明確時程:`TODO`(ROADMAP 原文:「對話中未定義任何日期」)

## 10. Open Issues(現況缺口)

- 部署方式(Cloudflare Pages vs GitHub Pages)文件不一致,待確認 —— 見 §2
- FEAT-001(食材 / 煮菜規劃)專案歸屬待確認 —— 見 §9
- `MD/doc/DECISIONS.md` 目前為空,無正式決策紀錄機制

## 11. 待確認決策(Pending Decisions)

- 部署管線最終採用哪個平台(Cloudflare Pages / GitHub Pages)—— `TODO(待確認)`,確認前請勿修改部署設定或相關文件敘述
- FEAT-001 的 open questions(規格細節)—— 詳見 [features/Cooking_and_Ingredients.md](features/Cooking_and_Ingredients.md),**定案前請勿實作**
- Migration 是否改用工具化管理(如 Supabase CLI)—— `TODO`

## 12. 開發約定與流程(供 Claude Code)

依 [CLAUDE.md](CLAUDE.md) 之 workflow 規則,另補充以下已知資訊:

- Repo 位置:本機 `E:\WEB\roomie`;分支策略 —— `TODO`(僅知目前在 `main` 分支;`gh-pages` 分支存在但用途待 §2 確認)
- 建置指令:`npm run build`(即 `tsc -b && vite build`)
- 執行指令(dev):`npm run dev`(Vite,預設 `http://localhost:5173`)
- 預覽指令:`npm run preview`
- 部署指令:`npm run deploy`(`npm run build && gh-pages -d dist -t`)—— 是否為目前實際使用的部署方式待確認,見 §2
- 測試框架與指令:`package.json` 未設定任何測試框架或 test script —— 目前**沒有自動化測試**
- Lint / 格式化:未發現 ESLint / Prettier 設定檔 —— 目前**沒有 lint 工具**,命名慣例依現有程式碼風格(camelCase 函式 / 變數,PascalCase 元件)
- CI / CD:未發現 `.github/workflows` —— 目前**沒有 CI 自動化**,部署為手動執行 `npm run deploy` 或 Cloudflare Pages 自動建置(待確認)
- 環境變數 / secrets:`.env`(不進版控,見 `.gitignore`)存放 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`,範本見 [.env.example](../.env.example);若用 GitHub Actions 部署,對應設為 repo secrets(依 README 建議,惟目前無實際 workflow 檔案)

---

## 附註

- 本文件依「目前 repo 實際程式碼、`supabase/*.sql`、[README.md](README.md)、[ROADMAP.md](ROADMAP.md)」整理而成,未臆測;凡未提供或有疑義者一律標 `TODO` 或「待確認」。
- 舊版 `PROJECT.md`(內容為另一個 .NET 8 + Clean Architecture 筆記應用,與 Roomie 無關)已依指示刪除,不再保留於本目錄。
- FEAT-001 詳細設計另見 [features/Cooking_and_Ingredients.md](features/Cooking_and_Ingredients.md)(該文件為**規格草案**,部分決策尚待拍板,不屬既定事實)。
