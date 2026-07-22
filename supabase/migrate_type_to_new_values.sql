-- type 컬럼: 기존 CHECK 제약 제거 → 값 마이그레이션 → 새 CHECK 제약 추가
-- 새 허용값: '기능' / '예외' / 'UI' / '회귀'

-- 1단계: 현재 값 확인 (dry-run)
select type, count(*) as cnt
from testcases
group by type
order by cnt desc;

-- 2단계: 기존 CHECK 제약 제거
alter table testcases
  drop constraint if exists testcases_type_check;

-- 3단계: 기존 값(수동/자동/기타)을 '기능' 으로 일괄 변경
update testcases
set type = '기능'
where type not in ('기능', '예외', 'UI', '회귀')
   or type is null;

-- 4단계: 새 CHECK 제약 추가 (이제 데이터가 다 유효하므로 성공)
alter table testcases
  add constraint testcases_type_check
  check (type in ('기능', '예외', 'UI', '회귀'));

-- 5단계: 스키마 캐시 리로드
notify pgrst, 'reload schema';
