-- 샘플 프로젝트 '오디언스' 삭제 (하위 TC/도메인은 cascade로 함께 삭제됨)
delete from projects where tc_prefix = 'AUD';
