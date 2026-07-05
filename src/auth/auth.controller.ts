import { Controller, Post, Get, Body, Req, UseGuards, BadRequestException, Inject } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

interface Credentials {
  email?: unknown;
  password?: unknown;
}

@Controller("api/auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("signup")
  async signup(@Body() body: Credentials) {
    const { email, password } = body ?? {};
    if (typeof email !== "string" || !email.includes("@") || typeof password !== "string" || password.length < 6) {
      throw new BadRequestException({ error: "이메일 형식과 6자 이상 비밀번호가 필요합니다" });
    }
    return this.auth.signup(email, password);
  }

  @Post("login")
  async login(@Body() body: Credentials) {
    const { email, password } = body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      throw new BadRequestException({ error: "이메일과 비밀번호가 필요합니다" });
    }
    return this.auth.login(email, password);
  }

  @Post("reset-password")
  async resetPassword(@Body() body: Credentials) {
    const { email, password } = body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || password.length < 6) {
      throw new BadRequestException({ error: "이메일과 6자 이상 새 비밀번호가 필요합니다" });
    }
    return this.auth.resetPassword(email, password);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    return {
      user: { id: req.userId, email: req.userEmail },
      hasCharacter: await this.auth.hasCharacter(req.userId!),
    };
  }
}
