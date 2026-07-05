// PM2 / Colyseus Cloud 프로세스 정의.
// exec_mode는 반드시 "fork" (Colyseus는 cluster 미지원).
module.exports = {
  apps: [
    {
      name: "mud-backend",
      script: "build/index.js",
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
