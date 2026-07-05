-- 2026-07-05 RLS 미적용 테이블 3종 잠금 (원격 DB에 psql로 적용된 사본)
-- app_users(password_hash 포함)/offerings_log/proficiencies가 RLS off + anon/authenticated 전체 권한 상태였음.
-- 프론트/Flutter 모두 supabase-js 미사용(백엔드 REST 전용)이므로 RLS enable(정책 없음)로
-- PostgREST 경유 접근을 차단한다. 백엔드 pool은 테이블 owner 접속이라 영향 없음.

alter table app_users enable row level security;
alter table offerings_log enable row level security;
alter table proficiencies enable row level security;
