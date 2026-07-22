-- MOINTMS 초기 스키마
-- Supabase SQL Editor에 전체 붙여넣고 Run

-- ============================================
-- 1. projects (프로젝트)
-- ============================================
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tc_prefix text not null unique,
  description text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- 2. domains (폴더/카테고리 트리)
-- ============================================
create table if not exists domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  parent_id uuid references domains(id) on delete cascade,
  name text not null,
  sort_order int default 0 not null,
  created_at timestamptz default now() not null
);
create index if not exists idx_domains_project on domains(project_id);
create index if not exists idx_domains_parent on domains(parent_id);

-- ============================================
-- 3. testcases (테스트 케이스)
-- ============================================
create table if not exists testcases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  domain_id uuid references domains(id) on delete set null,
  tc_no int not null,
  title text not null,
  priority text default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Critical')),
  type text default '수동' check (type in ('수동', '자동')),
  environment text default 'Staging',
  status text default '정상' check (status in ('정상', '보류', '폐기')),
  precondition text,
  procedure text,
  expected text,
  notes text,
  author_name text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(project_id, tc_no)
);
create index if not exists idx_testcases_project on testcases(project_id);
create index if not exists idx_testcases_domain on testcases(domain_id);

-- ============================================
-- 4. updated_at 자동 업데이트 트리거
-- ============================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at before update on projects
  for each row execute function set_updated_at();

drop trigger if exists trg_testcases_updated_at on testcases;
create trigger trg_testcases_updated_at before update on testcases
  for each row execute function set_updated_at();

-- ============================================
-- 5. RLS (Row Level Security) - MVP 단계: 공개 접근
-- 나중에 인증 붙일 때 정책 강화 예정
-- ============================================
alter table projects enable row level security;
alter table domains enable row level security;
alter table testcases enable row level security;

drop policy if exists "public read projects" on projects;
create policy "public read projects" on projects for select using (true);
drop policy if exists "public write projects" on projects;
create policy "public write projects" on projects for all using (true) with check (true);

drop policy if exists "public read domains" on domains;
create policy "public read domains" on domains for select using (true);
drop policy if exists "public write domains" on domains;
create policy "public write domains" on domains for all using (true) with check (true);

drop policy if exists "public read testcases" on testcases;
create policy "public read testcases" on testcases for select using (true);
drop policy if exists "public write testcases" on testcases;
create policy "public write testcases" on testcases for all using (true) with check (true);

-- ============================================
-- 6. 샘플 데이터 (동작 확인용)
-- ============================================
insert into projects (name, tc_prefix, description) values
  ('브랜드메시지', 'MSG', '브랜드 메시지 관련 TC'),
  ('오디언스', 'AUD', '오디언스 세그먼트 관련 TC')
on conflict (tc_prefix) do nothing;

insert into testcases (project_id, tc_no, title, priority, type, environment, status, author_name)
select p.id, 1, '[와이드리스트형] 소재 만들기 Step2. 쿠폰 링크 입력 (정상)', 'Medium', '수동', 'Staging', '정상', '김초롱'
from projects p where p.tc_prefix = 'MSG'
on conflict (project_id, tc_no) do nothing;

insert into testcases (project_id, tc_no, title, priority, type, environment, status, author_name)
select p.id, 2, '[와이드리스트형] 소재 만들기 Step2. 쿠폰 타이틀_배송비 할인', 'Medium', '수동', 'Staging', '정상', '김초롱'
from projects p where p.tc_prefix = 'MSG'
on conflict (project_id, tc_no) do nothing;
