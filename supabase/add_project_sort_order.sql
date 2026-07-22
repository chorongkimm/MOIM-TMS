-- projects 테이블에 sort_order 컬럼 추가
alter table projects
  add column if not exists sort_order int default 0 not null;

-- 기존 프로젝트에 생성 순서대로 sort_order 부여 (10 간격)
with ordered as (
  select id, row_number() over (order by created_at) as rn
  from projects
)
update projects p
set sort_order = o.rn * 10
from ordered o
where p.id = o.id and p.sort_order = 0;
