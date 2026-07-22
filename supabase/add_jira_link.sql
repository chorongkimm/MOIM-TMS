-- testcases 에 JIRA 링크 컬럼 추가 (nullable)
alter table testcases
  add column if not exists jira_link text;

notify pgrst, 'reload schema';
