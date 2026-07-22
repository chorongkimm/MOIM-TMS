-- 샘플 프로젝트 '브랜드메시지'를 'MA QA'로 이름 변경
-- prefix도 MSG → MA 로 변경 (기존 TC들 자동으로 MA-001, MA-002 로 표기 바뀜)
update projects
set name = 'MA QA', tc_prefix = 'MA'
where tc_prefix = 'MSG';
