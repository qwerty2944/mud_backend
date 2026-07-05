import dotenv from "dotenv";

// Colyseus Cloud는 대시보드 환경변수를 .env.production 으로 심어준다.
// 로컬은 .env 사용. (이미 설정된 값은 덮어쓰지 않음)
const nodeEnv = process.env.NODE_ENV || "development";
if (process.env.REGION) {
  dotenv.config({ path: `.env.${process.env.REGION}.${nodeEnv}` });
}
dotenv.config({ path: `.env.${nodeEnv}` });
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경변수 ${name}이(가) 설정되지 않았습니다. server/.env를 확인하세요.`);
  }
  return value;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  PORT: Number(process.env.PORT || 2567),
  // 콤마로 여러 origin 허용 (예: "https://mug-web.vercel.app,http://localhost:3000")
  CORS_ORIGIN: (process.env.CORS_ORIGIN || "http://localhost:3000").split(",").map((s) => s.trim()),
};
