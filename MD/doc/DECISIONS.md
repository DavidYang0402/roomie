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