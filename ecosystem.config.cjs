// PM2 / Colyseus Cloud 프로세스 정의.
// exec_mode는 반드시 "fork" (Colyseus는 cluster 미지원).
module.exports = {
  apps: [
    {
      name: "talebound-backend",
      script: "build/main.js",
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
      },
    },
    {
      // 구 프로세스(mud-backend, build/index.js) 잔재 제거용 일회성 작업.
      // 다음 배포에서 이 항목은 삭제해도 된다.
      name: "cleanup-old-mud-backend",
      script: "/bin/bash",
      args: ["-c", "pm2 delete mud-backend || true"],
      instances: 1,
      exec_mode: "fork",
      autorestart: false,
    },
  ],
};
