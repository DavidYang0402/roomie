# Decision Log
## 2026-07-12

Cooking and Ingredients - Realtime 資料隔離驗證

Decision:
Supabase Realtime 的 postgres_changes 訂閱,INSERT/UPDATE 完全受 RLS 過濾,
DELETE 事件會跨 household 廣播但只帶主鍵(id),無實質內容外洩。
決定不處理 DELETE 跨戶廣播(僅造成一次不必要 refresh,非資安問題)。

Reason:
實測兩個不同 household 帳號訂閱同一張表驗證得出,非文件推論。
加 replica identity full 屬架構層級變動,成本高於效益(家戶場景資料量小)。

Impact:
往後任何新表加入 supabase_realtime publication,都會有同樣的 DELETE 
跨戶廣播行為(僅 id,無內容外洩),團隊已知悉並接受,不需要每次重新驗證。

## 2026-07-12

Realtime 訂閱新增斷線重連補漏機制

Decision:
所有訂閱(tasks/expenses/settlements/ingredients/dishes/dish_ingredients)
的 channel .subscribe() 加上狀態回呼,SUBSCRIBED 時觸發一次 refresh()

Reason:
開發 Cooking_and_Ingredients 的 Task 6(即時同步)時發現,原本的訂閱完全沒有
斷線重連補漏邏輯,若斷線期間有資料變更,重連後畫面不會自動校正,這是既有的
缺口,一併補上,不只是這次新功能的範圍

Impact:
所有既有分頁(Tasks/Laundry/Money)的訂閱行為也一併改變,已做迴歸測試確認正常

## 2026-07-12

引入 Vitest 測試框架 + 對外部 Supabase 跑 integration test

Decision:
安裝 Vitest + @testing-library/react + jsdom,拆成 npm test(單元測試,
不碰網路)與 npm run test:integration(對正式 .env 指向的 Supabase 專案跑)
兩個獨立指令

Reason:
Roomie 之前完全沒有測試框架;開發 Cooking_and_Ingredients 時,份數分配/
退還/份量不足這類核心邏輯在 Postgres function 裡,本地沒有 Supabase
環境可用 pgTAP,只能對真實專案跑 integration test

Impact:
- 這是目前唯一可用的 Supabase 環境,integration test 會建立/清理真實資料
- 之後若要接 CI(GitHub Actions 等自動化),不能繼續共用這個正式專案,
  需另外申請一個測試專用的 Supabase 專案
- 之後其他 feature 的測試會沿用這套框架與這兩個 npm script 的切分方式

## 2026-07-12

食材份數歸零且無 planned 菜引用時,自動從清單隱藏

Decision:
新增 view visible_ingredients(見 supabase/migration_v1_9_hide_depleted_ingredients.sql),
規則:remaining_portions = 0 且沒有任何 status='planned' 的 Dish 透過 dish_ingredients
引用該食材時,從清單隱藏,底層 ingredients 資料不刪除。src/lib/api.ts 的 listIngredients()
改查這個 view,而非 ingredients 本表。

Reason:
原始規則(Task List 3.4)是「份數歸零保留顯示 0,不整筆刪除」,但實際使用後發現這樣會讓
清單被用完的食材塞滿(例:烏龍麵剩 0/16、已無菜引用,卻仍一直顯示)。選擇在查詢時用 view
過濾,而非在 completeDish/cancelDish 執行完後主動清理:除了資料安全(判斷邏輯有 bug也
不會真的刪掉資料)之外,也是因為這樣能直接沿用 Task 6 已接好的 Realtime 機制——
ingredients/dishes/dish_ingredients 有變動時 refresh() 本來就會重新查一次,不需要另外
加清理邏輯的觸發點。

Impact:
listIngredients() 的資料來源從 ingredients 本表改成 visible_ingredients view,其餘寫入
路徑(createIngredient、create_dish、cancel_dish、update_dish_ingredients)不受影響,
仍直接對 ingredients 本表操作。往後若要做「顯示所有食材(含已隱藏)」的畫面(例如查歷史
用量),需要另外查 ingredients 本表,不能沿用 listIngredients()。

## 2026-07-12

舊紀錄清理:不採用自動排程刪除,改為手動觸發 + 確認清單

Decision:
已完成/用完的食材與菜色,不做自動排程刪除(background cron / scheduled job)。改為之後
在設定頁新增一個手動觸發的「清理舊紀錄」功能:刪除「N 天前已完成/用完」的食材與菜色紀錄
(N 的具體天數尚未定案),點擊後先列出這次會刪除哪些項目讓使用者確認,確認後才真正執行
DELETE。這個功能目前不急,先記錄方向,不排入開發。

Reason:
避免引入背景排程機制;避免自動化的不可逆刪除在判斷邏輯有 bug 時造成無法挽回的資料遺失。
改為手動 + 先預覽清單再確認,即使邏輯有誤,使用者在確認畫面就能發現、可以取消。

Impact:
目前 Dish 完成/過期後是立即刪除(completeDish/sweepExpiredDishes,見
MD/features/Cooking_and_Ingredients.md §4.3),沒有確認步驟,跟這裡的原則不一致。這個
手動清理工具排入開發前,需要先確認範圍:只處理食材(份數歸零、被 visible_ingredients
隱藏但底層資料還在的那些),還是連 Dish 既有的「完成/過期立即刪除」行為都要一併改成
「留著、N 天後才手動清」——兩種範圍差異很大,尚未決定,已記錄在 Cooking_and_Ingredients.md
的 Future Work 章節。