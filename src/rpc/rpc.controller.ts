import {
  Controller,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from "@nestjs/common";
import type { Request } from "express";
import { callDbFunction } from "../database/rpc.js";
import { pool } from "../database/pool.js";
import { RPC_ALLOWLIST } from "./allowlist.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";

/** supabase.rpc(fn, args) 대체 엔드포인트 */
@Controller("api/rpc")
@UseGuards(JwtAuthGuard)
export class RpcController {
  @Post(":fn")
  async call(@Param("fn") fn: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    const meta = RPC_ALLOWLIST[fn];
    if (!meta) {
      throw new NotFoundException({ error: `허용되지 않은 함수: ${fn}` });
    }

    const args: Record<string, unknown> = { ...(body ?? {}) };

    if (meta.injectUserId) {
      args.p_user_id = req.userId;
    }
    if (meta.ownCharacter && !(await this.ownsCharacter(req.userId!, args.p_character_id))) {
      throw new ForbiddenException({ error: "본인 캐릭터가 아닙니다" });
    }

    try {
      const data = await callDbFunction(fn, args, meta.returns);
      return { data };
    } catch (e) {
      const message = e instanceof Error ? e.message : "RPC 실행 실패";
      console.error(`[rpc:${fn}]`, message);
      throw new InternalServerErrorException({ error: message });
    }
  }

  /** p_character_id가 본인(userId 자체 또는 본인 소유 캐릭터 id)인지 검증 */
  private async ownsCharacter(userId: string, characterId: unknown): Promise<boolean> {
    if (characterId === userId) return true;
    if (typeof characterId !== "string") return false;
    const { rows } = await pool.query(
      `select 1 from characters where id = $1::uuid and user_id = $2 limit 1`,
      [characterId, userId]
    );
    return rows.length > 0;
  }
}
