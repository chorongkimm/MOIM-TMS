-- status 체크 제약조건에 '완료' 추가
alter table testcases drop constraint if exists testcases_status_check;
alter table testcases add constraint testcases_status_check
  check (status in ('정상', '보류', '폐기', '완료'));
