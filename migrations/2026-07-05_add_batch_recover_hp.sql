-- batch_recover_hp: HP/MP 자연회복 (백엔드 node-cron 전용, service role pool)
-- 최대HP = 50 + con*5 + level*10, 최대MP = 20 + wis*3 + int
-- 부상 상한 존중: light 0.10 / medium 0.25 / critical 0.50 합산(상한 0.8)
-- current_hp / current_mp 가 null(=최대)인 값은 건드리지 않음.
create or replace function public.batch_recover_hp(p_percent integer default 5)
returns integer
language plpgsql
as $function$
declare v_count integer;
begin
  with calc as (
    select
      c.id,
      c.current_hp,
      c.current_mp,
      -- 최대 HP
      (50 + get_main_character_con(c.character) * 5 + coalesce(c.level, 1) * 10) as max_hp,
      -- 최대 MP
      (20
        + coalesce((c.character->'stats'->>'wis')::int, 10) * 3
        + coalesce((c.character->'stats'->>'int')::int, 10)) as max_mp,
      -- 부상 감소 합 (상한 0.8)
      least(0.8, coalesce((
        select sum(
          case elem->>'type'
            when 'light' then 0.10
            when 'medium' then 0.25
            when 'critical' then 0.50
            else 0
          end
        )
        from jsonb_array_elements(
          case when jsonb_typeof(c.injuries) = 'array' then c.injuries else '[]'::jsonb end
        ) as elem
      ), 0)) as injury_reduction
    from characters c
    where c.character is not null
      and (c.current_hp is not null or c.current_mp is not null)
  ),
  targets as (
    select
      id,
      current_hp,
      current_mp,
      max_hp,
      max_mp,
      -- 부상 반영 HP 상한
      floor(max_hp * (1 - injury_reduction))::int as hp_cap
    from calc
  ),
  updated as (
    update characters c
    set
      current_hp = case
        when t.current_hp is null then c.current_hp
        else least(t.hp_cap, t.current_hp + greatest(1, floor(t.max_hp * p_percent / 100.0)::int))
      end,
      current_mp = case
        when t.current_mp is null then c.current_mp
        else least(t.max_mp, t.current_mp + greatest(1, floor(t.max_mp * p_percent / 100.0)::int))
      end
    from targets t
    where c.id = t.id
      and (
        (t.current_hp is not null and t.current_hp < t.hp_cap)
        or (t.current_mp is not null and t.current_mp < t.max_mp)
      )
    returning 1
  )
  select count(*) into v_count from updated;
  return v_count;
end $function$;

-- 크론(service role pool) 전용 — 클라이언트 RPC 노출 금지
-- PUBLIC 기본 grant 때문에 anon/authenticated 가 상속받으므로 PUBLIC 까지 회수 후
-- service_role 만 명시 부여 (postgres 슈퍼유저는 기본 보유).
revoke execute on function public.batch_recover_hp(integer) from public;
revoke execute on function public.batch_recover_hp(integer) from anon, authenticated;
grant execute on function public.batch_recover_hp(integer) to service_role;
