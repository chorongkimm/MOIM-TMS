-- 47차 스프린트의 latest_result = 'N/T' 인 TC 들을 null(Untested) 로 변경
-- N/T 는 명시적으로 "Not Tested" 로 표시된 상태, null 은 "아직 결과 없음"(Untested)

-- 1단계: 대상 개수 확인 (dry-run)
select count(*) as target_count
from testcases t
join projects p on t.project_id = p.id
where p.name like '%47차%'
  and t.latest_result = 'N/T';

-- 2단계: 실제 업데이트
update testcases
set latest_result = null
where latest_result = 'N/T'
  and project_id in (
    select id from projects where name like '%47차%'
  );

notify pgrst, 'reload schema';
