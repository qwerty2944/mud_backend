import { Controller, Post, Body, Req, UseGuards, Inject, BadRequestException } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DungeonService } from "./dungeon.service.js";

@Controller("api/dungeon")
@UseGuards(JwtAuthGuard)
export class DungeonController {
  constructor(@Inject(DungeonService) private readonly dungeon: DungeonService) {}

  @Post("start")
  async start(@Req() req: Request, @Body() body: { dungeonId?: unknown }) {
    if (typeof body?.dungeonId !== "string") {
      throw new BadRequestException({ error: "dungeonId가 필요합니다" });
    }
    return this.dungeon.start(req.userId!, body.dungeonId);
  }

  @Post("advance")
  async advance(
    @Req() req: Request,
    @Body() body: { runToken?: unknown; battleToken?: unknown; currentHp?: unknown; currentMp?: unknown }
  ) {
    const { runToken, battleToken } = body ?? {};
    if (typeof runToken !== "string") {
      throw new BadRequestException({ error: "runToken이 필요합니다" });
    }
    if (typeof battleToken !== "string") {
      throw new BadRequestException({ error: "battleToken이 필요합니다" });
    }
    return this.dungeon.advance(
      req.userId!,
      runToken,
      battleToken,
      Number(body.currentHp),
      Number(body.currentMp)
    );
  }
}
