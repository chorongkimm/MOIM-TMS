-- testcases 테이블에 테스트 결과(PASS/FAIL/N/T/N/A) 컬럼 추가
alter table testcases
  add column if not exists latest_result text default 'N/T';

-- CHECK 제약 (기존 있으면 삭제 후 새로 생성)
alter table testcases drop constraint if exists testcases_latest_result_check;
alter table testcases add constraint testcases_latest_result_check
  check (latest_result in ('PASS', 'FAIL', 'N/T', 'N/A'));

-- 기존 데이터는 모두 N/T 로 (미실행)
update testcases set latest_result = 'N/T' where latest_result is null;
