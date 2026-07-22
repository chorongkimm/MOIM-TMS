-- TC 수정 이력 테이블
create table if not exists tc_edit_history (
  id uuid primary key default gen_random_uuid(),
  testcase_id uuid not null references testcases(id) on delete cascade,
  editor_name text,
  action text not null,       -- 예: "수정", "확인결과 변경", "우선순위 변경", "환경 변경"
  details text,               -- 예: "Medium → High"
  created_at timestamptz default now() not null
);

create index if not exists idx_tc_edit_history_testcase on tc_edit_history(testcase_id, created_at desc);

-- RLS (MVP: public)
alter table tc_edit_history enable row level security;
drop policy if exists "public read tc_edit_history" on tc_edit_history;
create policy "public read tc_edit_history" on tc_edit_history for select using (true);
drop policy if exists "public write tc_edit_history" on tc_edit_history;
create policy "public write tc_edit_history" on tc_edit_history for all using (true) with check (true);

-- 코멘트 테이블도 이 SQL 안에 함께 (이미 실행됐어도 안전)
create table if not exists tc_comments (
  id uuid primary key default gen_random_uuid(),
  testcase_id uuid not null references testcases(id) on delete cascade,
  author_name text,
  content text not null,
  created_at timestamptz default now() not null
);
create index if not exists idx_tc_comments_testcase on tc_comments(testcase_id, created_at desc);
alter table tc_comments enable row level security;
drop policy if exists "public read tc_comments" on tc_comments;
create policy "public read tc_comments" on tc_comments for select using (true);
drop policy if exists "public write tc_comments" on tc_comments;
create policy "public write tc_comments" on tc_comments for all using (true) with check (true);
