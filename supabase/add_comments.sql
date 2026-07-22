-- TC 코멘트 테이블
create table if not exists tc_comments (
  id uuid primary key default gen_random_uuid(),
  testcase_id uuid not null references testcases(id) on delete cascade,
  author_name text,
  content text not null,
  created_at timestamptz default now() not null
);

create index if not exists idx_tc_comments_testcase on tc_comments(testcase_id, created_at desc);

-- RLS (MVP: public)
alter table tc_comments enable row level security;
drop policy if exists "public read tc_comments" on tc_comments;
create policy "public read tc_comments" on tc_comments for select using (true);
drop policy if exists "public write tc_comments" on tc_comments;
create policy "public write tc_comments" on tc_comments for all using (true) with check (true);
