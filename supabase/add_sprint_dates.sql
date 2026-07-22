-- projects (스프린트) 에 시작일·종료일 추가
alter table projects
  add column if not exists start_date date,
  add column if not exists end_date date;
