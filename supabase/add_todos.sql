-- Todo 스티커 테이블
create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  content text not null default '',
  color text default 'yellow',
  is_done boolean default false not null,
  author_name text,
  position int default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_todos_created on todos(created_at desc);

-- RLS (MVP: public)
alter table todos enable row level security;
drop policy if exists "public read todos" on todos;
create policy "public read todos" on todos for select using (true);
drop policy if exists "public write todos" on todos;
create policy "public write todos" on todos for all using (true) with check (true);

-- 스키마 캐시 재로드
notify pgrst, 'reload schema';
