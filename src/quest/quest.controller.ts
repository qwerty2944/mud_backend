import { Controller, Get, Post, Body, Req, UseGuards, Inject, BadRequestException } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { QuestService } from "./quest.service.js";

@Controller("api/quest")
@UseGuards(JwtAuthGuard)
export class QuestController {
  constructor(@Inject(QuestService) private readonly quest: QuestService) {}

  @Get()
  async list(@Req() req: Request) {
    return this.quest.list(req.userId!);
  }

  @Post("accept")
  async accept(@Req() req: Request, @Body() body: { questId?: unknown }) {
    if (typeof body?.questId !== "string") {
      throw new BadRequestException({ error: "questId가 필요합니다" });
    }
    return this.quest.accept(req.userId!, body.questId);
  }

  @Post("claim")
  async claim(@Req() req: Request, @Body() body: { questId?: unknown }) {
    if (typeof body?.questId !== "string") {
      throw new BadRequestException({ error: "questId가 필요합니다" });
    }
    return this.quest.claim(req.userId!, body.questId);
  }
}
