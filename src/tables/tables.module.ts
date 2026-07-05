import { Module } from "@nestjs/common";
import { TablesController } from "./tables.controller.js";
import { AuthModule } from "../auth/auth.module.js";

@Module({
  imports: [AuthModule],
  controllers: [TablesController],
})
export class TablesModule {}
