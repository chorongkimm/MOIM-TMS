-- domains (폴더) 에 색상 컬럼 추가
alter table domains
  add column if not exists color text;

-- 스키마 캐시 재로드
notify pgrst, 'reload schema';
