-- 47차 제외한 모든 스프린트의 폴더 색상을 'sky' (TC 수행 완료) 로 변경
--
-- 1단계: 어떤 프로젝트가 영향받을지 미리 확인 (dry-run)
select id, name from projects where name not like '%47차%';

-- 2단계: 실제 업데이트
update domains
set color = 'sky'
where project_id in (
  select id from projects
  where name not like '%47차%'
);
