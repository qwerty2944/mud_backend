-- 2026-07-05 퀘스트 MVP: user_quests 테이블 (원격 DB에 psql로 적용 완료된 사본)
-- 접근은 백엔드 service role pool 전용 — RLS enable + 정책 없음(anon/authenticated 차단)

create table if not exists user_quests (
  user_id uuid not null,
  quest_id text not null,
  status text not null default 'accepted'
    check (status in ('accepted', 'completed', 'claimed')),
  progress jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, quest_id)
);

create index if not exists user_quests_user_idx on user_quests (user_id);

alter table user_quests enable row level security;
