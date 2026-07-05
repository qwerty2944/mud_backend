import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { verifyToken } from "./jwt.js";

/** Express requireAuth 미들웨어를 대체하는 Nest 가드. req.userId/userEmail을 채운다. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException({ error: "인증이 필요합니다" });
    }
    try {
      const payload = verifyToken(header.slice(7));
      req.userId = payload.sub;
      req.userEmail = payload.email;
      return true;
    } catch {
      throw new UnauthorizedException({ error: "유효하지 않은 토큰입니다" });
    }
  }
}
