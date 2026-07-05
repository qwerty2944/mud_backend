/**
 * 특성(Trait) 서버 정산용 경제 효과 맵.
 *
 * ⚠️ 수동 동기화 필요.
 * 이 맵은 프론트 `public/data/traits/traits.json`의 specialEffects 중
 * exp_gain / gold_gain / rare_drop 값만 추출한 것이다.
 * traits.json이 바뀌면 이 파일도 손으로 맞춰야 한다 (서버는 오직 이 값만 신뢰한다).
 *
 * 값 의미:
 * - expGain / goldGain: 퍼센트 (+10 = 획득량 +10%)
 * - rareDrop: 퍼센트 포인트 (드롭 확률에 더해지는 보너스, +10 = +0.10)
 *
 * 현재 반영 특성 (traits.json 기준, 총 34개 중 경제 효과 보유분):
 *   greedy(+10% gold), generous(-5% gold), genius(+10% exp),
 *   lucky(+10%p rare drop), quick_learner(+15% exp), merchant_blood(+15% gold)
 */

export interface TraitEconomyEffect {
  expGain?: number; // %
  goldGain?: number; // %
  rareDrop?: number; // %p (0~100)
}

const TRAIT_ECONOMY_EFFECTS: Record<string, TraitEconomyEffect> = {
  greedy: { goldGain: 10 },
  generous: { goldGain: -5 },
  genius: { expGain: 10 },
  lucky: { rareDrop: 10 },
  quick_learner: { expGain: 15 },
  merchant_blood: { goldGain: 15 },
};

export interface AggregatedTraitEconomy {
  /** 경험치 배율 (1.0 기준) */
  expMultiplier: number;
  /** 골드 배율 (1.0 기준) */
  goldMultiplier: number;
  /** 희귀 드롭 확률 보너스 (0~1, 드롭 chance에 가산) */
  rareDropBonus: number;
}

/**
 * characters.traits(JSONB 배열)에서 exp/gold 배율과 rareDrop 보너스를 집계한다.
 *
 * traits가 null / undefined / 빈배열 / 알 수 없는 형태여도 안전하게
 * 기본값(배율 1.0, 보너스 0)을 반환한다 — 기존(특성 없는) 캐릭터 회귀 방지.
 */
export function aggregateTraitEconomy(traits: unknown): AggregatedTraitEconomy {
  let expPercent = 0;
  let goldPercent = 0;
  let rareDropPercent = 0;

  if (Array.isArray(traits)) {
    for (const entry of traits) {
      const id =
        entry && typeof entry === "object"
          ? (entry as { id?: unknown }).id
          : undefined;
      if (typeof id !== "string") continue;

      const eff = TRAIT_ECONOMY_EFFECTS[id];
      if (!eff) continue;

      if (eff.expGain) expPercent += eff.expGain;
      if (eff.goldGain) goldPercent += eff.goldGain;
      if (eff.rareDrop) rareDropPercent += eff.rareDrop;
    }
  }

  return {
    expMultiplier: 1 + expPercent / 100,
    goldMultiplier: 1 + goldPercent / 100,
    rareDropBonus: rareDropPercent / 100,
  };
}
