import { Module } from "@nestjs/common";
import { RpcController } from "./rpc.controller.js";
import { AuthModule } from "../auth/auth.module.js";

@Module({
  imports: [AuthModule],
  controllers: [RpcController],
})
export class RpcModule {}
