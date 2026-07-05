-- 2026-07-05 피로도 함수 버그 수정 (원격 DB에 psql로 적용된 사본)
-- 문제: characters 매칭이 WHERE id = p_user_id 였으나, 모든 호출자(백엔드 REST/프론트 RPC)는
--       auth user id(= characters.user_id)를 전달한다. characters.id는 gen_random_uuid() 기본값이라
--       신규 캐릭터는 전부 매칭 실패 → 피로도 소모/조회가 조용히 no-op (레거시 행만 id=user_id 우연 일치).
-- 수정: 4개 함수 모두 WHERE user_id = p_user_id 로 변경. 레거시 행도 user_id 컬럼으로 동일하게 매칭됨.

create or replace function get_user_max_fatigue(p_user_id uuid)
returns integer
language plpgsql
stable
as $$
DECLARE
  v_con integer;
BEGIN
  SELECT (character->'stats'->>'con')::integer INTO v_con
  FROM characters
  WHERE user_id = p_user_id;

  RETURN calculate_max_fatigue_from_con(COALESCE(v_con, 10));
END;
$$;

create or replace function get_current_fatigue(p_user_id uuid)
returns integer
language plpgsql
stable
as $$
DECLARE
  v_fatigue integer;
  v_updated_at timestamptz;
  v_max_fatigue integer;
  v_elapsed_minutes integer;
  v_recovered integer;
BEGIN
  SELECT fatigue, fatigue_updated_at INTO v_fatigue, v_updated_at
  FROM characters
  WHERE user_id = p_user_id;

  v_max_fatigue := get_user_max_fatigue(p_user_id);
  v_elapsed_minutes := EXTRACT(EPOCH FROM (now() - v_updated_at)) / 60;
  v_recovered := v_elapsed_minutes; -- 1분당 1 회복

  RETURN LEAST(v_max_fatigue, v_fatigue + v_recovered);
END;
$$;

create or replace function consume_fatigue(p_user_id uuid, p_amount integer)
returns json
language plpgsql
as $$
DECLARE
  v_current integer;
  v_max integer;
  v_new_fatigue integer;
BEGIN
  v_current := get_current_fatigue(p_user_id);
  v_max := get_user_max_fatigue(p_user_id);

  IF v_current < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'message', '피로도가 부족합니다',
      'current', v_current,
      'required', p_amount
    );
  END IF;

  v_new_fatigue := v_current - p_amount;

  UPDATE characters
  SET fatigue = v_new_fatigue,
      fatigue_updated_at = now()
  WHERE user_id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'fatigue', v_new_fatigue,
    'maxFatigue', v_max
  );
END;
$$;

create or replace function restore_fatigue(p_user_id uuid, p_amount integer)
returns json
language plpgsql
as $$
DECLARE
  v_current integer;
  v_max integer;
  v_new_fatigue integer;
BEGIN
  v_current := get_current_fatigue(p_user_id);
  v_max := get_user_max_fatigue(p_user_id);
  v_new_fatigue := LEAST(v_max, v_current + p_amount);

  UPDATE characters
  SET fatigue = v_new_fatigue,
      fatigue_updated_at = now()
  WHERE user_id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'fatigue', v_new_fatigue,
    'maxFatigue', v_max
  );
END;
$$;
