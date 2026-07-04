# 家務室友 (Roomie)

給你和室友用的家務 / 洗衣 / 分帳共享網站。
React + TypeScript (Vite) 前端 + Supabase (PostgreSQL + Auth + Realtime) 後端。

## v1 有什麼

- **首頁**：自動算出「逾期 / 今天 / 待認領 / 我負責的」，紅點提醒。
- **待辦**：個人 / 公共任務；公共任務「先搶先贏」認領；打勾完成。
- **洗衣**：設定起始日 + 間隔天數，完成後自動排下一次；撞到每日名額會順延。
- **分帳**：記一筆花費自動均分，首頁顯示「誰欠誰多少」，一鍵結清。
- **即時同步**：家裡任何人改動，另一個人畫面會即時更新。

（委派 / 交換 / 同意流程與手機推播留給 v2。）

## 開始使用

前提：你已經在 Supabase 跑過 `supabase/schema.sql`，並建立好家、把自己加進 `household_members`。

```bash
npm install
cp .env.example .env      # 填入你的 Supabase URL 與 anon key
npm run dev               # 開 http://localhost:5173
```

`.env` 的兩個值在 Supabase → **Project Settings → API**。
（anon key 本來就是公開的，資料安全靠 RLS 把關，放進前端沒問題。）

## Supabase 登入設定（很重要，不然 magic link 回不來）

Supabase → **Authentication → URL Configuration**：

- **Site URL**：本機開發填 `http://localhost:5173`
- **Redirect URLs**：加入 `http://localhost:5173` 以及之後的 GitHub Pages 網址
  （例：`https://你的帳號.github.io/roomie/`）

## 加入室友

Supabase → **Authentication → Users → Add user** 輸入室友 email（勾 auto-confirm），
再到 SQL Editor 把他的 user id 加進成員：

```sql
insert into household_members (household_id, user_id)
values ('你的household_id', '室友的user_id');
```

## 部署到 GitHub Pages

`vite.config.ts` 已設 `base: './'`，放在任何子路徑都能運作。

```bash
npm run build                 # 產出 dist/（會讀 .env 的值）
npx gh-pages -d dist          # 推到 gh-pages 分支
```

然後到 GitHub repo → Settings → Pages，Source 選 `gh-pages` 分支。
部署後記得把該網址加進上面 Supabase 的 Redirect URLs。

> 用 GitHub Actions 自動部署的話，把 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
> 設成 repo secrets，在 build 步驟帶入即可。

## 專案結構

```
src/
  lib/supabase.ts   Supabase client
  lib/api.ts        所有資料查詢（auth / 任務 / 洗衣 / 分帳）
  lib/time.ts       日期與逾期判斷
  lib/types.ts      對應 DB 的型別
  store.tsx         登入狀態、家、成員、資料 + Realtime 訂閱
  components/       Login / Home / Tasks / Laundry / Money / ui
supabase/schema.sql 資料庫 schema（已在 Supabase 執行過）
```
