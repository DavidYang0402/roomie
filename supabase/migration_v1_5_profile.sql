-- ================================================================
-- 家務室友 · v1.5 遷移：個人資料（生日）
-- display_name（暱稱）在 profiles 已存在，這裡補上 birthday。
-- profiles 既有 RLS：本人可讀寫、同家成員可讀 → 生日自動沿用同樣規則。
-- 在 Supabase SQL Editor 執行一次即可（可安全重複執行）。
-- ================================================================

alter table profiles add column if not exists birthday date;
