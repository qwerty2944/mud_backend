import { Module, Controller, Get } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module.js";
import { RpcModule } from "./rpc/rpc.module.js";
import { TablesModule } from "./tables/tables.module.js";
import { CronModule } from "./cron/cron.module.js";

@Controller()
class HealthController {
  @Get("health")
  health() {
    return { ok: true };
  }
}

@Module({
  imports: [AuthModule, RpcModule, TablesModule, CronModule],
  controllers: [HealthController],
})
export class AppModule {}
