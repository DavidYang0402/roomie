# Feature: [目前可用食材, 煮菜規劃]

| 欄位 | 內容 |
|---|---|
| Feature ID | FEAT-001 |
| Status | ✅ Done |
| Priority | P2 中 |
| Milestone | ??? |
| Owner | |
| Created | 2026/07/11 |

---

## Background
> 此功能可以監視目前可用食材，會依照新增食材時候填寫的購買日期進行排序。
> 煮菜規劃，是要不用每天可以明確會用到甚麼食材。

---

## Goal
> 讓使用者管理家中可用食材（依購買日期排序、記錄可用份數），並排定每日菜色；菜在「完成」或「過了當天」後，自動扣用對應食材的份數。

---
**Success Metrics（完成的判斷標準）**

*食材管理*
- [ ] 食材清單可正確依購買日期排序、能新增／檢視食材
- [ ] 新增食材時可設定該食材的「可使用份數（次數）」

*煮菜管理*
- [ ] 可排定一道菜：設定日期、菜名、以及會使用的食材
- [ ] 食材份數一旦被某道菜使用（分配），即不可再分配給其他道菜

*兩功能綁定*
- [ ] 當菜「過了當天」或被「點選完成」時，自動刪除該道菜，並扣除／移除其使用掉的食材份數
---
## Current Situation
> 現在狀況使用者在此網站已經用有不錯的基礎功能，但是目前才發現菜的狀態也要進行管理。


## User Story

**Story A — 食材庫存追蹤**
```
As a 使用者
I want 記錄目前可用的食材（含購買日期與可使用份數），清單依購買日期排序
So that 我能看到家裡有哪些食材、何時買的、還剩幾份可用
```

**Story B — 煮菜規劃**
```
As a 使用者
I want 排定某一天要煮的菜（菜名 + 使用的食材），系統會把所選食材的份數標記為已分配、不可再分配給其他道菜
So that 我能事先規劃每天吃什麼，也不會把同一份食材重複分配到不同菜
```

**Acceptance Criteria**

*Story A*
- [ ] Given 使用者新增食材，When 填寫食材（名稱）、購買日期、可使用份數，Then 系統儲存該食材
- [ ] Given 已有多筆食材，When 檢視食材清單，Then 依購買日期排序顯示
  - TODO：排序方向（舊→新 or 新→舊）未指定，請補

*Story B*
- [ ] Given 使用者排定一道菜，When 填菜名、日期、選擇要用的食材，Then 建立該道菜，並將所選食材份數標記為「已分配」
- [ ] Given 某食材份數已被分配，When 排定另一道菜，Then 該份數不可再被選用（可用份數減少）
- [ ] Given 某食材可用份數為 0，When 排定菜色，Then 無法再選用該食材
  - ⚠️ 待確認：草稿寫「不能被分配給其他**食材**」，推定應為「其他**道菜**」，請確認語意

*兩功能綁定*
- [ ] Given 一道菜「過了當天」或被「點選完成」，When 系統處理，Then 自動刪除該道菜，並扣除／移除該菜使用掉的食材份數

---

## Technical Notes（可選，複雜功能才填）
> 專案歸屬已確認：**Roomie**（見 [PROJECT.md](../PROJECT.md)），資料模型如下已定案，非推定。

**份數概念（2026-07-12 補充確認）**
> 一份食材是使用者自行決定的份量單位，由使用者自訂切分方式（例如一塊牛肉切成 6 份、一顆高麗菜分成
> 4 份），系統不規定「一份」等於多少實際重量或數量。排菜時可指定這道菜要用掉該食材幾份，**不限定
> 每次只能用 1 份**（例如一餐用掉高麗菜 2 份）。因此 `DishIngredient.portions_used` 為使用者輸入的
> 正整數，而非固定值。

- 涉及的資料表(對應 Roomie 既有 Supabase / Postgres 慣例，非 .NET Domain 實體)：
  - `ingredients`（household_id、name、purchased_at、total_portions、remaining_portions）
  - `dishes`（household_id、name、planned_date、status、done_at）
  - `dish_ingredients`（dish_id、ingredient_id、portions_used；菜 ↔ 食材分配關聯）
- API / Endpoint：無自寫 REST API，比照 Roomie 既有模式，透過 `supabase-js` 直接操作資料表 +
  一個 RPC function `create_dish()`（見 Task List §1.5，處理「份量不足時整批擋下」的原子性需求）
- Migration：`supabase/migration_v1_7_cooking.sql`（見 Task List §1）
- 外部依賴 / 第三方服務：無新增依賴，沿用既有 `@supabase/supabase-js`

---

## Reviews

### PM Review
# PM Review:Cooking_and_Ingredients.md(FEAT-001)

## 1. 【範疇邊界】

**疑慮**:專案歸屬本身就是範疇問題,而且「食材管理」與「煮菜規劃」兩個子功能各自都有無限擴大的可能。

**具體依據**:
- 文件本身寫「此 feature 屬於哪個專案?(內容像 Roomie 家務 app,但目前 PROJECT.md 是 .NET 筆記 app)」——這不是小事,兩個專案的資料模型、認證方式、多人共用邏輯完全不同,範疇會因此完全不同。
- Goal 寫「讓使用者管理家中可用食材」,「家中」兩字暗示多人共用情境(呼應 Roomie 的室友模式),但 Success Metrics 和 AC 全部用「使用者」單數視角描述,沒有講到室友之間的資料是否共用。這是範疇邊界不清的直接證據。
- Background 提到「監視目前可用食材」,「監視」這詞如果被理解成主動提醒(例如「食材快過期」),很容易被「順便做」成通知功能,但 Roadmap 明確說推播通知是 v2 未來規劃,兩者容易被混在一起實作。

**建議修改**:在 Background 或 Goal 明確加一句「本 feature 不包含食材共用可見性、不包含到期提醒通知」,把兩個潛在擴大點先劃掉。

---

## 2. 【隱藏需求】

**疑慮 A**:「份數」概念隱含了「每次使用消耗多少」的規則,但沒有講。

**具體依據**:Story B 寫「將所選食材的份數標記為已分配」,AC 也只說「份數標記為已分配」,但 Open Questions 自己也承認「一道菜使用某食材時,是固定消耗 1 份還是可指定份數?」——這代表 User Story 描述的行為(標記份數)其實依賴一個還沒回答的隱藏規則,User Story 寫得像是已經定案的樣子,但底層邏輯是空的。

**疑慮 B**:「依購買日期排序」隱含「同一食材買兩次」的情境沒被處理。

**具體依據**:AC 寫「依購買日期排序顯示」,但沒有講清楚:同名食材(例如兩次買「雞蛋」,不同購買日期、不同剩餘份數)是要顯示成兩筆獨立紀錄,還是合併成一筆?這會直接影響「排序」這件事本身的意義——如果合併,就沒有「依購買日期排序」的問題了。目前文件對「食材」的識別單位(是「雞蛋」還是「這一批雞蛋」)沒有定義。

**建議修改**:在 Story A 補一句「同名食材多次購買時,是否視為獨立項目」;在 Story B 補「份數消耗規則(固定 1 份 vs 可指定)」。

---

## 3. 【邊界情境】

**疑慮**:AC 涵蓋了「份數用完」「過期/完成刪除」,但漏了幾個明顯會發生的情境:

**具體依據**:
- AC 寫「Given 使用者排定一道菜...Then 建立該道菜」,但沒有 AC 講「菜已經排定後,使用者想修改所選食材(換掉一項食材)」時,原本被分配的份數要不要釋放。這是會頻繁發生的操作,卻完全沒被涵蓋。
- AC 寫「Given 一道菜過了當天或被點選完成,Then 自動刪除該道菜」,但沒有 AC 講「使用者想取消/刪除一道尚未到期的菜」時,已分配的食材份數是否要退還。目前只處理了「正常結束」路徑,沒處理「使用者主動放棄」路徑。
- Open Questions 自己也列了「份數被扣到 0 的食材,是否整筆刪除、還是保留顯示為 0」,但這其實應該是一條 AC,而不是留在 Open Questions 裡——因為這會直接影響「食材清單」畫面驗收時看到的結果。

**建議修改**:至少新增兩條 AC:(1)刪除/取消一道未完成的菜時食材份數退還規則;(2)修改菜色所用食材時的份數重新分配規則。

---

## 4. 【衝突檢查】

**疑慮**:與 ROADMAP.md 中「v2:任務委派/交換/同意流程」及待辦(Tasks)功能有潛在的認領/所有權邏輯重疊。

**具體依據**:
- ROADMAP.md 待辦功能已有「先搶先贏認領」「誰的任務誰完成(DB trigger 強制)」的既有邏輯。而本 feature 的「菜」本質上也是一種「待辦事項」(排定日期、可完成、可能過期),但 Cooking_and_Ingredients.md 完全沒提到「菜」是否要沿用既有的 Tasks 表結構或認領機制,也沒說「菜」算不算另一種 task 類型。如果两者是分開的資料模型,未來「任務委派/交換」邏輯(v2)上線時,「菜」要不要比照辦理沒有講。
- ROADMAP.md 提到「生日提醒(設定頁已存生日,曾提可做室友生日提醒)」被列為未來規劃的提醒類功能;而本文件 Background 用「監視」一詞,容易與這類「提醒」功能的規劃產生功能邊界重疊(見第 1 點),但兩份文件互相沒有交叉引用或排除。

**建議修改**:在 Technical Notes 或 Background 補一句「菜色排程是否視為 Tasks 的子類型,或完全獨立資料模型」,並在 Open Questions 明確排除與待辦認領機制的關聯。

---

## 5. 【驗收盲區】

**疑慮**:目前 AC 用「份數」「已分配」這種抽象詞驗收,實際使用者體驗上容易「技術上通過、感覺不對」。

**具體依據**:
- AC 寫「該份數不可再被選用(可用份數減少)」——如果驗收時只檢查資料庫數字有沒有減少,技術上會過;但使用者實際操作介面時,如果沒有 AC 規定「UI 上要不要顯示『已被分配 X 份』的即時反饋」,使用者可能會選到看起來還有庫存、實際上已經被分配光的食材,體驗上會覺得「怎麼還讓我選」。目前 AC 完全沒有涉及「選擇食材時,是否只能看到剩餘可分配份數」這件事。
- 「⚠️ 待確認」那條寫「不能被分配給其他食材,推定應為其他道菜」——這種語意本身就是模糊的,如果工程師照字面驗收(份數不能分配給另一個「食材」),跟 PM 心裡想的(份數不能分配給另一道「菜」)驗收結果會完全不同,而且兩種解讀都能「通過測試」,只是驗證的東西不一樣。這條在定案前不該進入開發。
- AC 對「過了當天」自動刪除,沒有定義「當天」是以哪個時區/哪個時間點判定(例如晚上 11:59 vs 隔天凌晨處理),使用者可能會覺得「明明還沒過完今天,菜怎麼就不見了」。

**建議修改**:(1)AC 明確加入「選擇食材時 UI 需即時顯示剩餘可分配份數」;(2)「其他食材/其他道菜」語意在定案前列為 blocking,不得進入開發;(3)「過了當天」補上明確時間判定規則(例如以當地日期 00:00 為界)。

### Architect Review
# Architect Review:Cooking_and_Ingredients.md(FEAT-001)

## 1. 【架構相容性】

**風險等級:高**

**具體理由**:PROJECT.md §3(Architecture)四層 Domain/Application/Infrastructure/Presentation 內容全部標記 `TODO`,§4(Modules)目前僅列出 Authentication、User、Notebook、Permission 四個 bounded context,Ingredient/Dish 屬於全新且與現有模組無交集的領域。更關鍵的是:§11 明確列出「個人筆記是否統一為 personal workspace」與「授權落地方式(MediatR pipeline vs 各 handler 手寫 EnsureAsync)」為**待確認、定案前不得實作**的決策。而 Cooking_and_Ingredients.md 的 Ingredient/Dish 資料歸屬模型(單人 vs 家戶共用)本質上是同一類「ownership/tenancy」問題,卻完全獨立於 Workspace 設計討論之外。如果現在就實作,等於在 Workspace 授權機制拍板前,又新增一組平行、未來勢必要重新納入 `IWorkspaceAuthorizer` 邏輯的授權路徑,直接打破「授權統一在 Application layer 落地」的既有方向。

**建議做法**:在 §11 的 Workspace ownership 決策拍板前,不新增 Ingredient/Dish 的 Domain 實作;若必須先行,Domain 層設計時就把 owner 抽象化(不要寫死 UserId FK),等 Workspace 決策確定後可直接替換,而不是重寫。

---

## 2. 【資料庫影響】

**風險等級:中**

**具體理由**:新增 `Ingredient`、`Dish`、`DishIngredient` 三張表屬於 additive schema,不直接動到 §6 既有(尚為空白)的 User/Notebook/Folder 實體,單看本次改動不是 breaking change。但 §12「Schema / migration 管理方式」本身也是 `TODO`,代表目前沒有既定 migration 慣例可依循,這次等於要「順便訂規則」,風險不在這次改動本身,而在於沒有 baseline 可驗證這次改動是否符合未來慣例。另外,§11 提到 Workspace 上線會牽動「個人擁有 → workspace 擁有」的 data migration(依你過去對話紀錄,Notebook 已規劃此遷移),若 Ingredient/Dish 現在用 user-owned 方式建表,半年後 Workspace 上線時,就是**第二組**要做同樣遷移的資料表。

**建議做法**:趁機在 §12 訂出 migration 管理慣例(哪怕先寫 TODO 也要指定工具,如 EF Core Migrations);新表 FK 設計預留與 Workspace 遷移對齊的欄位命名慣例,避免屆時要改兩次。

---

## 3. 【依賴風險】

**風險等級:低**

**具體理由**:Technical Notes 未提及任何新套件或第三方服務,純粹是新增資料表 + CRUD,不引入新依賴。唯一需要留意的是「過了當天自動刪除」這條規則(AC 已寫,PM review 也提到時區問題但未談架構面)——如果這個判定要用排程(scheduled job / background worker)而非「使用者進站時即時計算」來實作,PROJECT.md 目前完全沒有提到 .NET 專案有任何背景排程基礎設施(§2、§12 皆無相關記載),等於要新增一個新的 infra 依賴(hosted service 或 Supabase pg_cron 等)。這類依賴一旦導入,移除成本不算低,因為會牽涉部署環境與排程監控。

**建議做法**:優先採「使用者進站/查詢時即時計算是否過期」而非常駐排程,避免無中生有引入新的 infra 依賴;若未來規模需要排程,再獨立評估。

---

## 4. 【一致性】

**風險等級:中**

**具體理由**:§8 既有決策明訂 Repository Pattern、RBAC,且授權應落在 Application layer(對照 Workspace 設計中 `IWorkspaceAuthorizer` 的方向)。但 Cooking_and_Ingredients.md 的 Technical Notes 只給了資料表推定,完全沒說明「份數不可重複分配」「過期自動刪除」這些業務規則要在哪一層強制執行——是 Domain 層的 invariant(如 Aggregate Root 內部檢查),還是 Application 層 handler 呼叫前後檢查,文件沒有講。這與 Roomie 專案(Supabase RLS + DB trigger 強制規則)的做法不同,但兩個專案本來就是不同技術棧,所以不一致本身不是問題;問題是這份文件**沒有明確表態**要沿用哪一種,容易導致工程師各自解讀,實作出跟 Notebook 模組不同的規則強制方式。

**建議做法**:在 Technical Notes 明確寫一句「份數分配/釋放規則於 Application layer 由 Domain entity 方法(如 `Dish.AssignIngredient()`)強制,而非交由 Infrastructure 或 DB constraint 處理」,對齊既有 Clean Architecture 分層原則。

---

## 5. 【技術債】

**風險等級:高**

**具體理由**:目前最快的做法會是「假設單人擁有、UserId 直接掛在 Ingredient/Dish 上」直接開工。但 §11 待確認決策的兩項(personal workspace 統一、授權落地方式)一旦拍板,幾乎必然要求所有既有實體重新掛載 workspace 歸屬與統一授權檢查——這與過去 Notebook 已規劃的「user-owned → workspace-owned」遷移策略是同一類技術債,現在多做一組資料表,就是多一組未來要遷移的對象。半年後大概率會後悔用「先寫死 UserId」的方式起手。

**建議做法**:兩個替代方案擇一——(a)延後本 feature 到 Workspace §11 決策拍板後再開工,一次到位;(b)若業務時程不允許延後,Domain 層 owner 欄位設計成介面/抽象(例如 `IOwnable` 或 `OwnerContext` 概念)而非具體 `UserId` FK,並在 PR 描述中明確記錄「此為暫時實作,待 Workspace 決策後需重構」,避免技術債被無聲吞掉。

### Engineer Review
（最終定案版本,2026-07-12,已完成技術驗證,無剩餘阻塞項)
## 任務 6 最終工時定案(Supabase Realtime 訂閱機制)

| # | 任務 | 樂觀工時 | 悲觀工時 | 差異來源 / 定案說明 |
|---|---|---|---|---|
| 6 | **Supabase Realtime 訂閱機制(整合)** | 4h | 8h | 上一輪估算(3h/7h)包含「payload 是否洩漏其他 household 資料」這個未知風險,現已用真實環境實測排除——INSERT/UPDATE 確認受 RLS 完整過濾,DELETE 只帶 id 且已定案不處理,不需要額外 filter 邏輯或 `replica identity full` 變更。工時上修 1h 的原因不是風險增加,而是把「把三張表加進 `supabase_realtime` publication」這件事的悲觀值算實一點:Roomie 過去踩過「新表忘記加進 publication」的坑([ROADMAP 已記錄],這次是 `Ingredient`/`Dish`/`DishIngredient` 三張新表,只要漏一張,對應功能的即時更新會靜默失效且不會報錯,只能靠手動測試發現) |
| 6a | — publication 設定(`ALTER PUBLICATION supabase_realtime ADD TABLE ...`) | 1h | 2h | 樂觀情況是三張表一次設定完成、寫進 migration 檔案版控(避免重演 Dashboard 手動勾選、不在版控裡的問題,這次直接寫成 SQL migration)。悲觀情況是需要額外確認這個 migration 在部署流程中是否會被正確執行(過去這步是手動在 Dashboard 做的,不確定 CI/CD pipeline 對這類 `ALTER PUBLICATION` 語句有沒有特殊處理) |
| 6b | — Channel 訂閱設計(單一 household,無需 group/切換邏輯) | 1h | 2h | 與上一輪估算相同,household 單一歸屬已確認,訂閱邏輯直接複用 `store.tsx` 現有 pattern(`postgres_changes` + `event: '*'`),不需要額外 filter 參數,因為 RLS 已在資料庫層完成過濾,前端不需要重複做這件事 |
| 6c | — 斷線重連補漏邏輯 | 1h | 2h | 沿用 Roomie 既有 pattern(重連後呼叫一次 REST API 校正當前份數狀態),此為原本估算範圍,無變動 |
| 6d | — 前端訂閱與 UI 更新(含 DELETE 事件觸發的多餘 refresh,不特別處理) | 1h | 2h | 因為決定不處理跨 household 的 DELETE 廣播,`refresh()` 邏輯直接沿用既有 `store.tsx` 寫法即可,不需要為了過濾「這個 DELETE 是不是我 household 的」而新增判斷邏輯——這點原本在上一輪是懸而未決的風險項,現在定案為「不做」,直接省下這部分程式碼與對應測試 |

**任務 6 最終定案:樂觀 4h / 悲觀 8h**
(對照歷程:SignalR 版本 12h/26h → Supabase Realtime 初估 7h/16h → 最終定案 4h/8h)

---

## 測試策略(任務 6,最終調整)

- **移除**:「跨 household payload 洩漏」的手動安全測試不再需要——已在真實環境完成一次性實測並取得結論,不需要在每次開發或每次 PR 都重複驗證這件事(這是環境層級的行為,不是這次新功能程式碼會影響的邏輯,不屬於迴歸測試範圍)。
- **保留**:INSERT/UPDATE 收到 payload 後前端正確更新畫面的 integration test(驗證的是「我方 household 訂閱功能正常」,不是驗證 RLS)。
- **不寫測試**:不需要為「其他 household 的 DELETE 事件觸發我方多餘一次 refresh」寫任何測試或斷言——這是已知且接受的行為,寫測試反而會綁死這個目前允許存在的細節,之後如果要優化(例如真的做 `replica identity full`)還要回頭改測試。

---

## 全案累計工時(整合所有輪次定案後)

| 任務 | 樂觀 | 悲觀 |
|---|---|---|
| 1. Domain 建模 | 3h | 6h |
| 2. 份數分配/釋放邏輯 | 3h | 7h |
| 3. 過期/完成自動處理 | 3h | 7h |
| 4. API endpoints + RLS 授權 | 3h | 6h |
| 5. 前端 UI(非即時部分) | 3h | 5h |
| 6. Supabase Realtime 訂閱機制 | 4h | 8h |
| 7. 份量不足阻擋 + 通知(API+前端) | 4h | 9h |
| 8. 測試撰寫 | 4h | 8h |
| **總計** | **27h** | **56h** |

依賴阻塞方面,目前所有先前列出的未解問題(份數消耗規則、語意確認、owner 歸屬、即時同步技術選型、RLS 洩漏風險)已全數定案或實測排除,**沒有剩餘阻塞項**,可以進入 coding 階段。任務順序建議依 1 → 2/4(可並行,因 RLS policy 與 domain method 互相獨立)→ 3 → 6 → 5/7(可並行)→ 8 收尾。

## Risks & Open Questions
> 還沒想清楚、可能卡住、或需要先驗證的假設

**已由 Success Metrics 補齊：** 食材份數概念、煮菜(日期/菜名/食材)、分配後不可重用、完成/過期自動刪除。

**仍待你補的資訊（TODO，未臆測）：**
- [ ] 本 feature 屬於哪個專案？（內容像 Roomie 家務 app，但目前 `PROJECT.md` 是 .NET 筆記 app）
- [ ] 食材是否有「名稱」欄位？（推定必要，請確認）
- [ ] 食材清單排序方向（舊→新 or 新→舊）
- [ ] 一道菜使用某食材時，是固定消耗「1 份」還是可指定份數？
- [ ] 「不能被分配給其他食材」語意確認（推定為「其他道菜」）
- [ ] 份數被扣到 0 的食材，是否整筆刪除、還是保留顯示為 0？
- [ ] 「過了當天」自動刪除的觸發時機（進站時計算 or 後端排程）
- [ ] 食材 / 菜色是否為室友「共用可見」？（家務情境常見，草稿未提）

---

## Decision
採用。核心模型為 Dish(菜名容器)+ DishIngredient(食材份量關聯),
owner 為家戶共用(單一 household),即時同步採 Supabase Realtime(沿用既有機制),
份量不足時阻擋並回傳結構化錯誤(shortages 陣列),併發扣減與 DELETE 事件跨戶廣播
均為已知且接受的限制,不在第一版處理。

預估工時:樂觀 27h / 悲觀 56h。

理由:三輪 review(PM/Architect/Engineer)+ 實地技術驗證(Realtime payload 
是否受 RLS 過濾)後,所有 open questions 已定案或排除,無剩餘阻塞項。

---

## Task List

> 直接以 **Decision** 段落為基礎展開(核心模型 Dish + DishIngredient、owner 家戶共用、
> Supabase Realtime、份量不足阻擋)。Architect Review 中的 .NET Clean Architecture 討論,
> 是討論過程中早期一度考慮用 SignalR(.NET 技術)做即時同步時的殘留內容,後已確認修正為
> Supabase Realtime——與 Decision 記載的技術棧一致,也與 Roomie 本身的 React + Supabase
> 架構一致,不存在衝突,以下 Task List 全部基於此。
> 標示 ⚠️ 的項目為 Open Questions 中「Decision 未逐條明確回覆」的語意細節,採用 PM/Architect
> Review 的建議作為預設實作方向,**開工前仍建議你明確拍板一次**,避免做完才發現理解不同。

### 1. 資料庫 Schema(Migration)—— ✅ 已完成,待你在 Supabase SQL Editor 執行
> 實作於 [supabase/migration_v1_7_cooking.sql](../../supabase/migration_v1_7_cooking.sql)。
> 我沒有 DB 管理權限(`.env` 只有 anon key,無 service_role),**無法自動執行/測試這份 migration**,
> 語法依現有 6 份 migration 的慣例逐行核對過,但仍需要你手動到 Supabase SQL Editor 貼上執行一次,
> 執行後請回報結果(成功 / 報錯訊息),我才能確認下一步。

- [x] 1.1 新增 `supabase/migration_v1_7_cooking.sql`:建表 `ingredients`(household_id, name, purchased_at, total_portions, remaining_portions, created_by, created_at),另加 `check (remaining_portions <= total_portions)` 防止資料矛盾
- [x] 1.2 同一份 migration 建表 `dishes`(household_id, name, planned_date, status('planned'|'done'), created_by, created_at, done_at)
- [x] 1.3 建表 `dish_ingredients`(dish_id, ingredient_id, portions_used,複合主鍵 (dish_id, ingredient_id))—— AC「份數一旦被使用即不可再分配給其他道菜」
- [x] 1.4 三張新表 `enable row level security`。
  > 實作與原規劃略有差異:`ingredients` 依原計畫用 `for all` + `is_member(household_id)` 全家可讀寫;
  > 但 `dishes`/`dish_ingredients` 只開放 SELECT/UPDATE/DELETE 給同家成員,**刻意不開放 INSERT**——
  > 新增一律要走 1.5 的 `create_dish()` RPC(security definer 繞過 RLS),否則份量檢查會被繞過。
  > 仍然對應 Decision「owner 為家戶共用(單一 household)」,並回答 Open Question「食材/菜色是否室友共用可見」→ 是。
- [x] 1.5 寫 `create_dish(hh_id, dish_name, planned_date, items)` RPC function(security definer):一次檢查 `items`(多個食材+份數)是否都足夠,不足的**全部**收集成 `shortages` 陣列一次擋下(整批都不寫入);足夠才原子建立 `dishes` + `dish_ingredients` + 扣減 `ingredients.remaining_portions`。
  > 設計變更說明:原規劃是比照 `enforce_task_update` 寫成「`dish_ingredients` 逐列新增時觸發的 row-level trigger」,但這種寫法一次只會擋到「第一個」份量不足的食材,無法產生 Decision 要求的「shortages **陣列**」(一次回報所有不足的食材)。改採 RPC function 一次性檢查整批,才能真正符合 Decision 的錯誤格式;手法比照既有 `create_household`/`create_invite` 這類「多表原子寫入」RPC,而非 `enforce_task_update` 這類單表 trigger。
  > 併發扣減(兩人同時排菜搶同一份食材)不在此 function 內加鎖處理,依 Decision「已知且接受的限制,不在第一版處理」。
- [x] 1.6 同一份 migration 內把 `ingredients`/`dishes`/`dish_ingredients` 加入 `supabase_realtime` publication(用 `pg_publication_tables` 檢查是否已加入,確保可安全重複執行,避免 `ALTER PUBLICATION ... ADD TABLE` 重跑報錯——對應 Engineer Review 任務 6a)

### 2. 型別與 API 層 —— ✅ 已完成
- [x] 2.1 `src/lib/types.ts` 新增 `Ingredient`/`Dish`/`DishIngredient`/`DishStatus` 型別
- [x] 2.2 `src/lib/api.ts` 新增:`listIngredients`(依購買日期舊→新排序)、`createIngredient`(AC:填名稱/購買日期/可使用份數)
- [x] 2.3 `src/lib/api.ts` 新增:`listDishes`、`getDishIngredients`、`createDish`(填菜名/日期/選食材+份數)
  > 與原規劃差異:原文字列了 `completeDish`/`deleteDish`,但這兩個實際上是 **Task 4(過期/完成自動處理)** 的行為
  > ——AC 原文是「完成或過期時**自動刪除**並扣除份數」,不是單純把狀態改成 done,觸發時機(進站計算 vs 排程)
  > 也還沒實作。這次沒有實作 `completeDish`/`deleteDish`,改成實作 Task 3 需要的 `cancelDish`(取消尚未完成
  > 的菜、退還份數)與 `updateDishIngredients`(編輯所用食材、重新分配份數),對應 3.2、3.3。
- [x] 2.4 API 層把 RPC 丟出的 `SHORTAGE:` 開頭錯誤,轉換成 `InsufficientPortionsError`(帶結構化 `shortages: DishShortage[]`),供前端 catch 使用

### 3. 份數分配 / 釋放邏輯(Story B AC)—— ✅ 已完成,待你在 Supabase SQL Editor 執行
> DB 層新增於 [supabase/migration_v1_8_dish_lifecycle.sql](../../supabase/migration_v1_8_dish_lifecycle.sql)(v1.7 已執行過,不去改動它,新邏輯另開一份 migration)。
> 同樣沒有 DB 管理權限,**這份也還沒執行**,需要你手動跑一次並回報結果。

- [x] 3.1 建立 Dish 時,依 `dish_ingredients` 指定的 `portions_used` 扣減對應食材 `remaining_portions`(可指定份數,非固定消耗 1 份——已於 2026-07-12 明確確認份數概念,見 Technical Notes)。DB 端邏輯抽成共用函式 `apply_dish_items()`,`create_dish()` 呼叫它(v1.8 對 v1.7 的 `create_dish()` 做 `create or replace`,行為不變、純重構);API 層對應 `createDish()`
- [x] 3.2 新增 `cancel_dish()` RPC:取消一道**尚未到期**(`status='planned'`)的 Dish 時,退還已分配的食材份數並刪除該 Dish;API 層對應 `cancelDish()`。已完成的菜不能用這個函式取消(擋下 `DISH_ALREADY_DONE`),避免誤退還「已經煮掉」的份數
- [x] 3.3 新增 `update_dish_ingredients()` RPC:編輯 Dish 更換所用食材時,先退還舊分配、刪除舊分配列,再依新清單呼叫 `apply_dish_items()` 重新分配;若新清單份量不足,整段(含退還)一起回滾,不會卡在「退了但還沒扣」的中間狀態。API 層對應 `updateDishIngredients()`
- [x] 3.4(2026-07-12 依實際使用回饋修正,取代原本的規則)
  > **原規則(2026-07-12 稍早確認)**:份數被扣到 0 的食材保留顯示為 0,不整筆刪除。
  > **修正原因**:實測時發現「烏龍麵」總份數 16、剩 0/16,且沒有任何 planned 狀態的菜還在引用它,
  > 但清單上仍然一直顯示著,造成清單被用完的食材塞滿、雜訊變多。
  > **新規則**:食材同時符合以下兩個條件時,從清單**隱藏**(不刪除底層資料):
  >   1. `remaining_portions = 0`
  >   2. 沒有任何 `status='planned'` 的 Dish 還透過 `dish_ingredients` 引用這個食材
  >
  > **實作方式**:採用「查詢時過濾、不刪除底層資料」(你提出的兩個方案之一,你傾向這個、我也認同)。
  > 用 DB view `visible_ingredients`(見 [supabase/migration_v1_9_hide_depleted_ingredients.sql](../../supabase/migration_v1_9_hide_depleted_ingredients.sql),手法比照既有 `balances` view、`security_invoker = on` 沿用查詢者的 RLS),
  > `src/lib/api.ts` 的 `listIngredients()` 改成查這個 view 而非 `ingredients` 本表。
  > 選這個方案而非「`completeDish`/`cancelDish` 執行完順便清理」,除了你提到的安全性(判斷邏輯有 bug
  > 也不會真的弄丟資料)之外,還有一個理由:這樣可以直接沿用 Task 6 已經接好的 Realtime
  > 機制——`dishes`/`dish_ingredients` 表有變動時,`refresh()` 本來就會重新呼叫 `listIngredients()`,
  > 食材要不要隱藏會跟著自動重新算,不需要額外在 `completeDish`/`cancelDish` 裡加清理邏輯。

### 4. 過期 / 完成自動處理(兩功能綁定 AC)—— ✅ 邏輯層已完成,無需 migration
> 全部實作於 `src/lib/api.ts`(`deleteDish`、`completeDish`、`sweepExpiredDishes`)。**這次沒有新增
> migration**——判定與清除邏輯都在前端算,DB 端不需要新函式,剛好驗證了 Task 1/3 的設計選擇是對的
> (直接刪除 = 不退還 vs `cancel_dish()` RPC = 退還,兩種語意在 RLS 層本來就分開,Task 4 直接沿用)。

- [x] 4.1 「過了當天」判定採**進站/查詢時即時計算**:`sweepExpiredDishes(householdId)` 撈出該 household 的 `status='planned'` 菜,篩出過期的逐筆刪除,不用排程 infra(採納 Architect Review 建議)
- [x] 4.2 「當天」以使用者當地日期 00:00 為界:直接比對 `planned_date`(YYYY-MM-DD 字串)是否小於 `todayStr()`(採納 PM Review 建議)。
  > ⚠️ 實作細節,非原規劃內容:原本想直接沿用既有的 `dueState()`/`dateOf()`(`src/lib/time.ts`,tasks/laundry 已在用),
  > 但 `dueState()` 內部用 `new Date(ts)` 解析字串——這對 `timestamptz`(tasks.due_at)沒問題,但 `dishes.planned_date`
  > 是純 `date` 欄位(無時間、無時區),`new Date("2026-07-15")` 這種 date-only 字串會被 JS 當成 **UTC 午夜**解析,
  > 在 UTC 以西的時區會少算一天,跟這條 AC「當地日期 00:00 為界」的意圖相反。改成直接用字串比大小
  > (`planned_date < todayStr()`),完全不經過 `new Date()`,避開這個問題。沒有動 `time.ts` 既有程式碼
  > (tasks/laundry 目前都用 `timestamptz`,不受影響,不算 bug,只是這次沒有直接複用)。
- [x] 4.3 Dish 狀態為 `done` 或已過期時,自動刪除該 Dish,不退還其使用掉的食材份數(AC 原文「扣除/移除」對應到:份數在建立菜色當下就已扣除,這裡只是移除紀錄,不重複扣、也不退還)。
  > ⚠️ 設計判斷,非原規劃逐字內容:AC 寫「點選完成 → 自動刪除」,不是「先標記 done、之後才刪」,所以
  > `completeDish()` 直接呼叫 `deleteDish()`,不會真的把 `status` 改成 `'done'` 再留著。這代表 `dishes.status='done'`
  > /`done_at` 這兩個欄位在目前流程下**實際上不會被觀察到**(schema 裡還在,只是這個實作不會寫入)。
  > 如果之後想要「已完成菜色的歷史紀錄」,需要另外設計(目前 AC 沒有要求保留歷史),先讓你知道這個取捨。
  > **尚未接上 UI / `store.tsx`**——`sweepExpiredDishes()` 要在「進站/查詢時」真的被呼叫到才有作用,
  > 但目前還沒有煮菜規劃的畫面(Task 5)或 store 整合(Task 6),所以這一步留給 Task 5/6 處理,現在只是把函式寫好。
- [x] 4.4「不能被分配給其他 XX」語意確認為「其他**道菜**」(2026-07-12 已確認,PM Review 原本列為 blocking 的項目解除)

### 5. 前端 UI(非即時部分)—— ✅ 已完成,已在瀏覽器實測通過
> 新增 [src/components/Cooking.tsx](../../src/components/Cooking.tsx),掛進 [src/App.tsx](../../src/App.tsx)
> 新分頁「煮菜」(比照既有 Login/JoinHousehold/Home/Tasks/Laundry/Money/Settings 的 tab 架構)。
> 樣式沿用既有 `.view`/`.row`/`.check-list`/`.chk`/`.field`/`.error` 等既有 class,只新增一個
> `.qty-input`(份數輸入框,見 [src/index.css](../../src/index.css))。
>
> **依「非即時部分」的範圍,這個畫面自己管理 state、直接呼叫 `api.ts`,沒有接進 `store.tsx` 的全域
> state 或 Realtime 訂閱**——那是 Task 6 的範圍。也因為這個畫面本身就是「進站/查詢」的具體時機點,
> `load()` 裡第一步呼叫 `sweepExpiredDishes()`,順便把 Task 4.3 最後留的「尚未接上 UI」補上了。
>
> **實測**:啟動 `npm run dev`,用瀏覽器對真實 Supabase 專案跑過一輪完整流程(新註冊帳號 + 新建
> household,非之前 RLS 測試留下的帳號):新增食材(高麗菜,4 份)→ 排菜要 5 份 → 正確擋下並顯示
> 「份量不足:高麗菜(要 5、剩 4)」→ 改成 2 份排定成功,食材正確變成剩 2/4 → 取消該道菜,食材正確
> 退還回 4/4 → 再排一次用 1 份(剩 3/4)→ 點完成,菜消失、食材維持 3/4(**沒有**被退還,符合設計)→
> 切回首頁確認其他分頁沒有被這次改動影響。全程 console 無錯誤。

- [x] 5.1 食材清單畫面:新增食材表單(名稱、購買日期、可使用份數)
- [x] 5.2 食材清單依購買日期排序顯示,**排序方向:舊→新**(2026-07-12 已確認)
- [x] 5.3 排定 Dish 時,食材選擇 UI 即時顯示「剩餘可分配份數」(採納 PM Review「驗收盲區」建議,避免使用者選到已被分配光的食材)
- [x] 5.4 煮菜規劃畫面:排定 Dish 表單(菜名、日期、選食材+份數)
- [x] 5.5 Dish 列表畫面,依日期排序、顯示狀態
  > 額外加了「完成」/「取消」兩個操作按鈕(分別對應 `completeDish`/`cancelDish`)——這兩個按鈕沒有被
  > Task 5 的項目逐條列出,但沒有它們,Task 3(退還)、Task 4(自動處理)做出來的邏輯會沒有入口可以
  > 觸發、也無從實測,所以視為讓 Task 5 本身可用/可驗證所必須,一併做了。

### 6. Supabase Realtime 訂閱(對應 Engineer Review 任務 6)—— ✅ 已完成,已實測跨帳號同步
> 無需新 migration。[src/store.tsx](../../src/store.tsx) 的 `ingredients`/`dishes` 併入全域 state,
> [src/components/Cooking.tsx](../../src/components/Cooking.tsx) 同步改為從 `useStore()` 讀取(不再自
> 己管本地 state、自己 fetch),對齊 Tasks/Laundry/Money 既有架構——這是 Task 5 結尾就預告要留給 Task 6
> 做的部分。

- [x] 6.1 `src/store.tsx` 訂閱新增 `ingredients`/`dishes`/`dish_ingredients` 三張表,比照既有 `tasks`/`expenses`/`settlements` pattern(`postgres_changes`、`event: '*'`、無 filter——RLS 已在資料庫層完成過濾,前端不需重複做)。`refresh()` 一併加入 `listIngredients`/`listDishes`,並在最前面呼叫 `sweepExpiredDishes()`(Task 4.1 的「查詢時即時計算」,`refresh()` 是全站唯一會被各種操作觸發的查詢時機點)
- [x] 6.2 斷線重連補漏
  > ⚠️ 實作方式跟原規劃文字不同,想讓你知道:原文字寫「比照既有 pattern」,但實際查了 `store.tsx`
  > 目前的 Realtime 訂閱程式碼,**並沒有現成的「斷線重連」pattern 可以比照**(`.subscribe()` 呼叫本來
  > 就沒有帶任何 callback,單純訂閱,重連完全交給 supabase-js 底層自己處理,不保證補齊斷線期間漏掉
  > 的事件)。改成幫 `.subscribe()` 加上 `(status) => { if (status === 'SUBSCRIBED') refresh() }`——
  > 這個 callback 在「第一次訂閱成功」與「斷線後自動重連成功」都會觸發,兩種情況都補一次 REST 校正。
  > 這個改動套用到整個 channel(不只新的三張表),`tasks`/`expenses`/`settlements` 也一併受惠,這算是
  > 對既有程式碼的最小必要擴充,不是重寫既有邏輯。
- [x] 6.3 不處理 DELETE 事件跨 household 廣播(已定案為已知且接受的限制,見本文件 Engineer Review 與對話中的實測結果,不需 `replica identity full`、不需前端 filter)——三張新表的訂閱都用 `event: '*'` 無 filter,跟既有表一致,天然滿足這條

**實測**:啟動 `npm run dev`,沿用瀏覽器已登入的 session(household 內有先前測試留下的食材資料),產生邀請碼後,另外寫一支一次性腳本(`node`,用 anon key)**在瀏覽器之外**模擬「室友 B」:註冊新帳號、用邀請碼加入同一個 household、直接寫入一筆新食材。全程沒有動瀏覽器分頁,約 2 秒後該分頁自動顯示出這筆室友 B 新增的食材,不需手動整理或重新整理頁面,console 無錯誤——確認 Realtime 訂閱與 `refresh()` 真的有把「別人的改動」推到我的畫面上。另外切回「待辦」分頁確認沒有迴歸。腳本已測完刪除,沒有留在 repo 裡。`npx tsc -b` 型別檢查通過。

### 7. 測試 —— ✅ 已完成,全部實際執行過並通過
> ⚠️ 這個專案原本**完全沒有測試框架**(無 test script、無 Vitest/Jest、無本地 Supabase)。開工前已
> 跟你確認過方向:裝 Vitest(與 Vite 生態最自然整合),7.2 用 integration test 對 `.env` 指到的真實
> Supabase 專案跑(沒有本地 Supabase/pgTAP 可用)。新增裝置:
> - devDependencies:`vitest`、`@testing-library/react`、`jsdom`
> - [vitest.config.ts](../../vitest.config.ts)(獨立於 `vite.config.ts`,用 `mergeConfig` 疊上既有設定——
>   直接把 `test` 欄位塞進 `vite.config.ts` 在這個專案的 `tsc -b`/tsconfig 設定下型別對不起來,拆開比較穩)
> - `package.json` 新增 `npm test`(排除 `*.integration.test.*`,不需要網路/credentials)與
>   `npm run test:integration`(只跑 DB 層 integration test)
> - `tsconfig.node.json` 的 `include` 加入 `vitest.config.ts`

- [x] 7.1 INSERT/UPDATE payload 送達後,前端正確更新畫面的 integration test(驗證我方 household 訂閱功能,不驗證 RLS——RLS 已實測驗證過)
  > 實作於 [src/store.realtime.test.tsx](../../src/store.realtime.test.tsx)。用假的
  > `supabase.channel()/on()/subscribe()` 模擬事件送達(不需要真的連線),取出 `store.tsx` 對
  > `ingredients` 表註冊的 callback 手動觸發,驗證 `refresh()` 真的把新資料反映到畫面上。
- [x] 7.2 份數分配 / 釋放 / 份量不足阻擋的單元測試(含 3.2、3.3 的退還/重新分配情境)
  > 實作於 [src/lib/api.dish.integration.test.ts](../../src/lib/api.dish.integration.test.ts),對真實
  > Supabase 專案跑(新帳號 + 新 household,不影響既有資料)。共 7 個案例:份量足夠成功建立並正確扣減、
  > 份量不足整批擋下不寫入任何資料、**兩個食材同時不足時 shortages 陣列列出全部(不是只有第一個)**
  > ——這條直接驗證了 Task 1.5 從 trigger 改成 RPC 的理由是否真的成立、cancel_dish 退還份數、
  > update_dish_ingredients 重新分配、update_dish_ingredients 新清單不足時整段回滾(舊分配不會被退還
  > 掉)、cancel_dish 對已完成的菜正確拒絕。全部針對真實 DB function 跑,不是只測 mock。
- [x] 7.3 過期自動刪除的單元測試(含「當天」邊界情況,如 23:59 vs 隔天 00:00)
  > 實作前先做了一個小重構:把散在 `api.ts`(`sweepExpiredDishes`)跟 `Cooking.tsx`(`dishDueState`)
  > 裡重複的「日期字串比較」邏輯,抽成 [src/lib/time.ts](../../src/lib/time.ts) 的
  > `isPastLocalDate(dateStr, today?)` 純函式(`today` 預設現在的當地日期,可傳固定值讓測試結果不受
  > 系統時鐘影響),兩處都改呼叫它。測試於 [src/lib/time.test.ts](../../src/lib/time.test.ts):今天/
  > 昨天/明天、跨月邊界、跨年邊界,共 5 案例。
- [x] 明確不寫:「其他 household 的 DELETE 事件觸發我方多餘一次 refresh」的測試(已知且接受的行為,依 Engineer Review 定案不需要用測試把這個細節綁死)

**執行結果**:`npm test`(不含 integration)—— 2 個檔案、6 個測試全過,約 2 秒,不需網路。
`npm run test:integration` —— 7 個測試全過,對真實 Supabase 專案跑,約 13 秒。`npm run build`(`tsc -b && vite build`)確認測試檔不會被打包進正式build、無其他迴歸。

### 8. 開工前拍板項目(2026-07-12 已全數確認,無剩餘阻塞項)
- [x] 食材清單排序方向(§5.2)→ 舊→新
- [x] 「不能分配給其他 XX」= 其他道菜(§4.4)
- [x] 份數歸零食材:保留顯示 0,不整筆刪除(§3.4)

---

## Future Work(未來規劃,尚未排入開發)

### 手動清理舊紀錄(食材/菜色)

> 2026-07-12 記錄方向,尚未排入開發。細節(N 的實際天數等)尚未定案,排入開發前需另外確認。

**背景**:目前的機制是——Dish 完成或過了當天時,`completeDish()`/`sweepExpiredDishes()`
會**立即**刪除該筆 Dish(無確認步驟,見 §4.3);食材份數歸零且無 `planned` 狀態的 Dish 引用時,
`visible_ingredients` view 會把它從清單**隱藏**,但底層 `ingredients` 資料不會被刪除,會一直留在
資料庫裡(見 §3.4、[DECISIONS.md](../doc/DECISIONS.md))。

**已決定不採用**:自動排程刪除(background cron / scheduled job)。理由:避免引入背景排程機制,
也避免自動化的不可逆刪除在判斷邏輯有 bug 時造成無法挽回的資料遺失。

**目前傾向的方向**:
- 設定頁新增一個手動觸發的「清理舊紀錄」功能
- 可刪除「N 天前已完成/用完」的食材與菜色紀錄(N 的具體天數尚未定案,你提到「例如 30 天」但
  強調還要再想,不是確定值)
- 點擊後**先列出這次會刪除哪些項目讓你確認,確認後才真正執行 DELETE**,不能一鍵直接刪除

**排入開發前待確認的範圍問題**(目前的機制跟這個新方向有一處沒對齊,想先點出來):
- Dish 目前完成/過期後**已經被立即刪除**,不會留著等這個手動工具處理。如果要讓這個工具也涵蓋
  Dish,代表要同時把 §4.3 現有的「立即刪除」行為,改成「留著、標記完成時間、N 天後才透過這個工具
  手動刪除」——這是要修改既有、已測試確認過的行為,範圍比「只新增一個清理食材的工具」大很多。
  這個工具的範圍究竟是「只處理食材」還是「食材 + 連 Dish 的既有立即刪除行為都要改」,排入開發前
  需要先跟你確認,不能用猜的動工。

---

## Status Log
| 日期 | 狀態變化 | 備註 |
|---|---|---|
| 2026-07-12 | Decision → Task List 展開 | 依 Decision + AC 展開為可執行 Task List(§Task List)。確認 Architect Review 的 .NET/SignalR 討論為早期考慮方案的殘留內容,已修正為 Supabase Realtime(與 Decision 一致),Task List 直接以 Decision 為基礎、採用 Roomie 實際的 React + Supabase 架構展開。3 項語意細節(排序方向、「其他道菜」語意、份數歸零食材處理)Decision 未逐條明確拍板,已標記 ⚠️ 並彙總於 Task List §8,建議開工前先確認。 |
| 2026-07-12 | §8 三項全數確認 + 補充份數概念 | 排序方向(舊→新)、「其他道菜」語意、份數歸零食材(保留顯示 0)三項全部確認,Task List §3.4/§4.4/§5.2/§8 同步打勾。Technical Notes 補充「份數」為使用者自訂份量單位、單次可用多份的說明。 |
| 2026-07-12 | Task 1(資料庫 Schema/Migration)完成,暫停等待確認 | 依指示只做 Task 1:新增 [supabase/migration_v1_7_cooking.sql](../../supabase/migration_v1_7_cooking.sql)(ingredients/dishes/dish_ingredients 三張表 + RLS + `create_dish()` RPC + Realtime publication)。§Task List 1.5 由原規劃的「row-level trigger」改為「RPC function」,原因見該項下方的設計變更說明。**尚未執行**(僅有 anon key,無法自動跑 migration),需你到 Supabase SQL Editor 手動執行並回報結果。依指示不繼續 Task 2。 |
| 2026-07-12 | Task 1 migration 執行成功,設計變更已認可 | 你回報 v1.7 在 Supabase SQL Editor 執行成功(Success. No rows returned),Task 1.5 的 RPC 設計變更已認可。 |
| 2026-07-12 | Task 2(型別/API 層)+ Task 3(份數釋放邏輯)完成,暫停等待確認 | `src/lib/types.ts` 新增 Ingredient/Dish/DishIngredient 型別;`src/lib/api.ts` 新增 listIngredients/createIngredient/listDishes/getDishIngredients/createDish/updateDishIngredients/cancelDish,以及 `InsufficientPortionsError`(解析 RPC 的 `SHORTAGE:` 錯誤)。§2.3 與原規劃差異:未實作 `completeDish`/`deleteDish`(這兩個屬於 Task 4 的「完成/過期自動刪除」邏輯,觸發時機尚未實作),改為實作 Task 3 所需的 `cancelDish`/`updateDishIngredients`。Task 3 需要新的 DB 邏輯(退還份數、重新分配),新增 [supabase/migration_v1_8_dish_lifecycle.sql](../../supabase/migration_v1_8_dish_lifecycle.sql)(不改動已執行過的 v1.7,新邏輯另開一份 migration;把份量檢查邏輯抽成共用函式 `apply_dish_items()`,並 revoke 其 PUBLIC 執行權限避免前端繞過 `create_dish`/`cancel_dish`/`update_dish_ingredients` 的身分驗證直接呼叫)。`npx tsc -b` 型別檢查通過。**v1.8 尚未執行**,需你到 Supabase SQL Editor 手動執行並回報結果。依指示不繼續 Task 4 以後。 |
| 2026-07-12 | Task 2/3 migration(v1.8)執行成功,調整已認可 | 你回報 v1.8 執行成功(Success. No rows returned),§2.3 的調整與 `apply_dish_items()` 權限收斂均已認可。 |
| 2026-07-12 | Task 4(過期/完成自動處理)完成,暫停等待確認 | `src/lib/api.ts` 新增 `deleteDish`(直接刪除、不退還份數)、`completeDish`(呼叫 `deleteDish`)、`sweepExpiredDishes`(查詢時掃描過期菜並逐筆刪除)。**無需新 migration**——判定與清除邏輯全在前端,DB 端沿用 Task 1/3 已有的 RLS(直接刪除 vs `cancel_dish()` RPC 退還,語意本來就分開)。實作時發現既有 `dueState()`/`dateOf()`(`src/lib/time.ts`)用 `new Date()` 解析純 `date` 欄位會有 UTC 午夜誤判時區的問題,改用字串直接比較 `planned_date < todayStr()`,未動 `time.ts` 既有程式碼。另外「點選完成 = 立即刪除」的設計判斷,代表 `dishes.status='done'`/`done_at` 這兩個欄位目前實際上不會被寫入(schema 仍保留,只是這次沒用到),已在 §4.3 標註供你知悉。`sweepExpiredDishes()` 尚未接上 `store.tsx`/UI(留給 Task 5/6,因為「進站/查詢」這個觸發點要有畫面才有意義)。`npx tsc -b` 型別檢查通過。依指示不繼續 Task 5 以後。 |
| 2026-07-12 | Task 4 設計判斷已認可,繼續 Task 5(前端 UI)並完成、已實測 | 時區 bug 處理方式、status/done_at 暫不使用兩點均已認可。新增 [src/components/Cooking.tsx](../../src/components/Cooking.tsx),掛進 App.tsx 新分頁「煮菜」,樣式沿用既有 class(新增 `.qty-input`)。`sweepExpiredDishes()` 在畫面 `load()` 時呼叫,補上 Task 4 留下的「尚未接上 UI」。額外加了「完成」「取消」操作按鈕(不在 Task 5 條列項目內,但沒有它們 Task 3/4 的邏輯無法從畫面觸發或驗證,視為必要)。**實測**:啟動 `npm run dev`,用新帳號 + 新 household 在瀏覽器跑過完整流程(新增食材 → 排菜超量正確擋下顯示 shortages 訊息 → 改量成功、份數正確扣減 → 取消該菜、份數正確退還 → 再排一次並點完成、份數維持已扣減不退還 → 切回首頁確認無迴歸),全程 console 無錯誤。`npx tsc -b` 型別檢查通過。依指示不繼續 Task 6 以後。 |
| 2026-07-12 | Task 5 實測結果與範圍延伸均已認可,繼續 Task 6(Realtime 訂閱)並完成、已實測跨帳號同步 | `ingredients`/`dishes` 併入 `store.tsx` 全域 state,`refresh()` 一併抓取兩者並在最前面呼叫 `sweepExpiredDishes()`;Realtime channel 新增訂閱 `ingredients`/`dishes`/`dish_ingredients` 三張表;`Cooking.tsx` 改為從 `useStore()` 讀取,不再自己管本地 state(對齊 Tasks/Laundry/Money 既有架構)。§6.2 與原規劃文字有出入:「比照既有 pattern」實際上找不到現成的斷線重連 pattern(`.subscribe()` 本來沒帶 callback),改成幫整個 channel 的 `.subscribe()` 加上 `(status) => status==='SUBSCRIBED' && refresh()`,對既有 tasks/expenses/settlements 也一併生效,已在 §6.2 標註。**無需新 migration**。**實測**:沿用瀏覽器已登入 session,產生邀請碼後,另寫一支一次性腳本在瀏覽器外模擬「室友 B」(新帳號、用邀請碼加入同一 household、直接寫入一筆食材),全程沒碰瀏覽器分頁,約 2 秒後分頁自動顯示這筆室友 B 新增的食材,無需手動整理,console 無錯誤,確認 Realtime 訂閱真的把「別人的改動」推到我的畫面上。切回待辦分頁確認無迴歸。腳本測完已刪除。`npx tsc -b` 型別檢查通過。這次測試又留了一個新測試帳號(`cooking-realtime-b-*@example.com`),一併列入你之後的清理清單。依指示不繼續 Task 7 以後。 |
| 2026-07-12 | Task 6 實測方式與 6.2 改動均已認可,繼續並完成 Task 7(測試撰寫)——全案 Task List 收斂 | 確認專案原本無任何測試框架,先問過方向:裝 Vitest(devDependencies 新增 `vitest`/`@testing-library/react`/`jsdom`)、7.2 對 `.env` 真實 Supabase 專案跑 integration test。新增 [vitest.config.ts](../../vitest.config.ts)(獨立於 vite.config.ts,因型別擴充在這個專案的 tsconfig 設定下不穩定,改用 `mergeConfig`);`package.json` 新增 `test`(排除 integration)/`test:integration` 兩個 script;`tsconfig.node.json` include 加入 `vitest.config.ts`。為讓 7.3 可測,先把 `api.ts`/`Cooking.tsx` 重複的日期比較邏輯抽成 `src/lib/time.ts` 的 `isPastLocalDate()` 純函式再測。三個測試檔:[time.test.ts](../../src/lib/time.test.ts)(5 案例,純函式)、[store.realtime.test.tsx](../../src/store.realtime.test.tsx)(1 案例,mock Realtime channel 驗證 refresh 更新畫面)、[api.dish.integration.test.ts](../../src/lib/api.dish.integration.test.ts)(7 案例,對真實 DB function 跑,含「shortages 陣列列出全部不足食材」這條直接驗證 Task 1.5 改用 RPC 的理由)。**全部實際執行過**:`npm test` 6/6 過、`npm run test:integration` 7/7 過(對真實專案,又留一個測試帳號 `dish-integration-*@example.com` 待你清理)、`npm run build` 確認無迴歸。至此 Task 1–7 全部完成,§8 拍板項目也已全數確認,Task List 沒有剩餘項目。 |
| 2026-07-12 | Task 7 確認完成;Status 改為 ✅ Done;實際使用發現後修正 3.4 規則 | 頁首 `Status` 由「🔵 In Review」改為「✅ Done」。隨後依實際使用回饋(範例:烏龍麵 16 份用完剩 0/16、無 planned 菜引用,但清單仍顯示)修正 3.4:改為「份數=0 且無 planned Dish 引用時,從清單隱藏,不刪除底層資料」。採用你偏好的「查詢時過濾」方案:新增 [supabase/migration_v1_9_hide_depleted_ingredients.sql](../../supabase/migration_v1_9_hide_depleted_ingredients.sql)(view `visible_ingredients`,手法比照既有 `balances` view),`src/lib/api.ts` 的 `listIngredients()` 改查這個 view。除了你提到的安全性,選這個方案還因為能直接沿用 Task 6 的 Realtime 機制,不需要在 `completeDish`/`cancelDish` 額外加清理邏輯。`npx tsc -b` 型別檢查、`npm test`(6/6,不含 DB)均通過。**v1.9 尚未執行**,需你到 Supabase SQL Editor 手動執行並回報結果,之後我才能重跑 `npm run test:integration` 與瀏覽器實測(目前 `visible_ingredients` 還不存在,`listIngredients()` 會直接報錯)。DECISIONS.md 的 Vitest 決策紀錄仍待你補上實際文字(訊息中提到已附上但沒有收到內容)。 |
| 2026-07-12 | DECISIONS.md 補上 Realtime 重連補漏 + Vitest 兩筆(你直接提供文字);第三筆(visible_ingredients)由我依實作內容補上 | 前兩筆連同一筆「Realtime 資料隔離驗證」記錄已存在於檔案中(未動);新增第三筆記錄 `visible_ingredients` view 的決策理由與影響。之後你提出「已完成/用完的食材與菜」的清理方向重新考慮:**不採用自動排程刪除**(避免背景排程機制與不可逆刪除風險),改為設定頁手動觸發、需先列清單確認才真正 DELETE 的「清理舊紀錄」功能,N 天數尚未定案,**這個功能不急,先記錄方向,不排入開發**。已新增文件內 [Future Work](#future-work未來規劃尚未排入開發) 章節記錄。同時點出一處範圍待釐清:目前 Dish 完成/過期後是**立即**刪除(§4.3,無確認步驟),跟這個新方向的原則有出入——這個工具排入開發前,需要先確認範圍是「只處理食材」還是「連 Dish 既有的立即刪除行為都要一併改」,未擅自假設。 |