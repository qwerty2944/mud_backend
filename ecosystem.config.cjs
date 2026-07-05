// PM2 / Colyseus Cloud 프로세스 정의.
// exec_mode는 반드시 "fork" (Colyseus는 cluster 미지원).
module.exports = {
  apps: [
    {
      // Colyseus Cloud가 기존 PM2 앱 이름 기준으로 재시작하므로 이름은 유지한다.
      name: "mud-backend",
      script: "build/main.js",
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
