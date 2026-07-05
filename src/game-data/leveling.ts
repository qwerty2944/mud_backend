/**
 * 공용 레벨업 계산 (battle / quest / dungeon 공유).
 * 필요 경험치 = 현재 레벨 × 100 (프론트 checkLevelUp과 동일 공식).
 */
export interface LevelUpResult {
  newLevel: number;
  newExp: number;
  levelsGained: number;
}

export function applyLevelUps(currentLevel: number, currentExp: number, gainedExp: number): LevelUpResult {
  let newLevel = Math.max(1, Math.floor(currentLevel) || 1);
  let newExp = Math.max(0, Math.floor(currentExp) || 0) + Math.max(0, Math.floor(gainedExp) || 0);
  let levelsGained = 0;
  while (newExp >= newLevel * 100) {
    newExp -= newLevel * 100;
    newLevel++;
    levelsGained++;
  }
  return { newLevel, newExp, levelsGained };
}
