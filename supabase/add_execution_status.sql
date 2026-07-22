-- testcases 에 수행 상태 컬럼 추가 (nullable)
alter table testcases
  add column if not exists execution_status text;

notify pgrst, 'reload schema';
