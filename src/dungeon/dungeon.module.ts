import { Module } from "@nestjs/common";
import { DungeonController } from "./dungeon.controller.js";
import { DungeonService } from "./dungeon.service.js";
import { BattleModule } from "../battle/battle.module.js";
import { AuthModule } from "../auth/auth.module.js";

@Module({
  imports: [AuthModule, BattleModule],
  controllers: [DungeonController],
  providers: [DungeonService],
})
export class DungeonModule {}
