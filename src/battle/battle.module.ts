import { Module } from "@nestjs/common";
import { BattleController } from "./battle.controller.js";
import { BattleService } from "./battle.service.js";
import { AuthModule } from "../auth/auth.module.js";
import { QuestModule } from "../quest/quest.module.js";

@Module({
  imports: [AuthModule, QuestModule],
  controllers: [BattleController],
  providers: [BattleService],
  exports: [BattleService],
})
export class BattleModule {}
