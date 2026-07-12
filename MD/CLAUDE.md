# Claude Code Workflow

## 適用範圍
本規則適用於所有 Coding 任務。若任務僅是閱讀/說明/除錯不涉及修改,可略過「Decision」步驟,但仍需先讀 Context。

## Before Coding(必讀,依序)
1. PROJECT.md — 專案架構與現況
2. 對應的 Feature 文件(若不存在,先確認是否要建立,不可跳過)
3. 若任務涉及既有程式碼,先讀該檔案本身,不可憑記憶假設內容

## Workflow
Project Context
↓
Review(列出目前理解 + 影響範圍)
↓
Decision(提出方案,等待確認)
↓
Coding
↓
Verify(能跑起來 / 通過既有測試 / 至少手動檢查一次)
↓
Update Documents

## Rules
1. 不准用猜的。缺資訊時,先問,不動工。
2. 不准在沒有明確提案並經確認前,修改架構(資料模型、API 介面、模組邊界等)。
3. 小範圍修改(命名、單一函式邏輯)可直接做;跨檔案、跨模組的改動視為架構層級,需先提案。
4. 修改既有檔案時,優先提供完整檔案內容,而非片段 diff。
5. 每個 session 收斂在可執行、可提交(committable)的狀態才結束,不留半成品。
6. 若一次任務範圍過大,主動拆分並提出分段計劃,而非硬做到底。

## Update Documents
- 架構有變動 → 更新 PROJECT.md
- 功能有變動 → 更新對應 Feature 文件
- 更新時同步記錄「為什麼改」,不只是「改了什麼」