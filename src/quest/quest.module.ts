import { Module } from "@nestjs/common";
import { QuestController } from "./quest.controller.js";
import { QuestService } from "./quest.service.js";
import { AuthModule } from "../auth/auth.module.js";

@Module({
  imports: [AuthModule],
  controllers: [QuestController],
  providers: [QuestService],
  exports: [QuestService],
})
export class QuestModule {}
