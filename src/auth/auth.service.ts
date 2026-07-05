import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { pool } from "../database/pool.js";
import { signToken } from "./jwt.js";

export interface AuthResult {
  token: string;
  user: { id: string; email: string };
  hasCharacter: boolean;
}

@Injectable()
export class AuthService {
  async hasCharacter(userId: string): Promise<boolean> {
    const { rows } = await pool.query(
      `select 1 from characters where user_id = $1 and character is not null limit 1`,
      [userId]
    );
    return rows.length > 0;
  }

  async signup(email: string, password: string): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      const { rows } = await pool.query(
        `insert into app_users (email, password_hash) values ($1, $2) returning id, email`,
        [email.toLowerCase(), passwordHash]
      );
      const user = rows[0];
      return {
        token: signToken({ sub: user.id, email: user.email }),
        user: { id: user.id, email: user.email },
        hasCharacter: false,
      };
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "23505") {
        throw new ConflictException({ error: "이미 가입된 이메일입니다" });
      }
      throw e;
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const { rows } = await pool.query(
      `select id, email, password_hash, must_reset_password from app_users where email = $1`,
      [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user) {
      throw new UnauthorizedException({ error: "이메일 또는 비밀번호가 올바르지 않습니다" });
    }

    // Supabase에서 백필된 유저: 비밀번호 해시가 없으므로 재설정 필요
    if (!user.password_hash || user.must_reset_password) {
      throw new ConflictException({ error: "비밀번호 재설정이 필요합니다", code: "PASSWORD_RESET_REQUIRED" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException({ error: "이메일 또는 비밀번호가 올바르지 않습니다" });
    }

    return {
      token: signToken({ sub: user.id, email: user.email }),
      user: { id: user.id, email: user.email },
      hasCharacter: await this.hasCharacter(user.id),
    };
  }

  /** 백필 유저 전용 — must_reset_password가 true인 계정만 허용 */
  async resetPassword(email: string, password: string): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `update app_users
       set password_hash = $2, must_reset_password = false
       where email = $1 and must_reset_password = true
       returning id, email`,
      [email.toLowerCase(), passwordHash]
    );
    const user = rows[0];
    if (!user) {
      throw new BadRequestException({ error: "재설정 대상 계정이 아닙니다" });
    }

    return {
      token: signToken({ sub: user.id, email: user.email }),
      user: { id: user.id, email: user.email },
      hasCharacter: await this.hasCharacter(user.id),
    };
  }
}
