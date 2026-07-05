/** JwtAuthGuard가 채워주는 요청 컨텍스트 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export {};
