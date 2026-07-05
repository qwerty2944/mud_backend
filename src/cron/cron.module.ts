import { Module, Injectable, type OnModuleInit } from "@nestjs/common";
import cron from "node-cron";
import { pool } from "../database/pool.js";

/**
 * Supabase Edge Function 크론 대체.
 * - recover-fatigue (10분): batch_recover_fatigue 호출
 * - recover-hp (10분): batch_recover_hp 호출 (HP/MP 자연회복)
 * - update-game-time (30분): game_settings의 현재 시간/시간대/날씨 컬럼 갱신
 *   (프론트는 epoch로 직접 계산하므로 이 컬럼들은 표시/호환용)
 */
@Injectable()
class FatigueCronService implements OnModuleInit {
  onModuleInit() {
    cron.schedule("*/10 * * * *", async () => {
      try {
        const { rows } = await pool.query(`select batch_recover_fatigue(10) as updated`);
        console.log(`[cron] 피로도 회복 완료 (${rows[0]?.updated}명)`);
      } catch (e) {
        console.error("[cron] 피로도 회복 실패:", e instanceof Error ? e.message : e);
      }
    });

    // HP/MP 자연회복 (10분마다 최대치의 5%). current_hp/current_mp가 null(=최대)인
    // 행은 건드리지 않고, 부상 상한을 존중한다(DB 함수 batch_recover_hp).
    // 전투 중에도 회복될 수 있으나 battle.service complete()가 정산 시 클라이언트
    // 최종 HP로 덮어쓰므로 전투 중 크론 회복은 자동 무효화된다.
    cron.schedule("*/10 * * * *", async () => {
      try {
        const { rows } = await pool.query(`select batch_recover_hp(5) as updated`);
        console.log(`[cron] HP/MP 회복 완료 (${rows[0]?.updated}명)`);
      } catch (e) {
        console.error("[cron] HP/MP 회복 실패:", e instanceof Error ? e.message : e);
      }
    });

    cron.schedule("0,30 * * * *", async () => {
      try {
        await pool.query(`
          update game_settings set
            current_game_hour = floor(
              (extract(epoch from (now() - game_epoch)) % (day_cycle_hours * 3600))
              / (day_cycle_hours * 3600) * 24
            )::int,
            current_period = (array['night','dawn','day','dusk'])[
              floor(
                (extract(epoch from (now() - game_epoch)) % (day_cycle_hours * 3600))
                / (day_cycle_hours * 3600) * 4
              )::int + 1
            ],
            current_weather = (array['sunny','cloudy','rainy','stormy','foggy'])[
              floor(
                (extract(epoch from (now() - weather_epoch::timestamptz)) % (weather_cycle_hours * 3600))
                / (weather_cycle_hours * 3600) * 5
              )::int + 1
            ],
            updated_at = now()
        `);
        console.log("[cron] 게임 시간/날씨 갱신 완료");
      } catch (e) {
        console.error("[cron] 게임 시간 갱신 실패:", e instanceof Error ? e.message : e);
      }
    });
  }
}

@Module({
  providers: [FatigueCronService],
})
export class CronModule {}
