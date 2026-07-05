import "dotenv/config";

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
