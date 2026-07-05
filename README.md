# TALEBOUND Backend

테일바운드(TALEBOUND) 게임 백엔드. **NestJS + Colyseus** — REST API와 실시간 멀티플레이(맵 룸/채팅/결투)를 한 서버에서 제공한다.

## 관련 레포/URL

| 항목 | 값 |
|---|---|
| 프론트엔드 | [talebound_frontend](https://github.com/qwerty2944/talebound_frontend) → https://talebound-web.vercel.app |
| 앱 (Flutter) | [talebound_app](https://github.com/qwerty2944/talebound_app) |
| 프로덕션 API | https://kr-icn-db6aac61.colyseus.cloud (Colyseus Cloud, 앱 ID `1664-mud-backend`) |
| DB | Supabase Postgres (프로젝트 `krwmncolecywlkmlviqu`, Session pooler `aws-1-ap-northeast-2`) |

## 아키텍처

NestJS 표준 구조가 뼈대이고, Colyseus는 Nest의 http 서버에 WebSocket으로 부착된다.

```
src/
├── main.ts            # Nest 부트스트랩 + Colyseus 부착 (로컬: TCP, 클라우드: Unix 소켓)
├── index.ts           # build/index.js 진입점 (PM2 호환용, main.ts를 임포트만 함)
├── app.module.ts      # 루트 모듈 + /health
├── config/env.ts      # .env(.cloud) 로드, 필수값 검증
├── database/          # pg Pool, callDbFunction(RPC 헬퍼), ensureSchema
├── auth/              # /api/auth/* (signup/login/reset-password/me), JwtAuthGuard
├── rpc/               # /api/rpc/:fn — Supabase rpc() 대체 프록시 (allowlist 기반)
├── tables/            # /api/profile, proficiencies, equipment-instances 등 테이블 REST
├── game/rooms/        # Colyseus MapRoom (presence/채팅/귓속말/결투 릴레이)
└── cron/              # 스케줄 작업 (아래 참조)
```

### 요청 인증
- `POST /api/auth/login` → JWT 발급 (7일). 클라이언트는 `Authorization: Bearer` 헤더 사용.
- Supabase Auth에서 백필된 계정은 `password_hash`가 없어 첫 로그인 시 `PASSWORD_RESET_REQUIRED`(409) → `/api/auth/reset-password`로 새 비밀번호 설정.
- Colyseus 룸 입장은 join options의 `token`을 `onAuth`에서 검증.

### RPC 프록시 (`/api/rpc/:fn`)
기존 `supabase.rpc(fn, args)` 호출을 대체한다. `src/rpc/allowlist.ts`에 등록된 함수만 허용되며:
- `injectUserId`: `p_user_id`를 JWT의 userId로 강제 (클라이언트 값 무시)
- `ownCharacter`: `p_character_id` 소유권 검증

## 크론 작업 (src/cron/cron.module.ts)

Supabase pg_cron + Edge Function에서 **전부 백엔드로 이전 완료** (Supabase 쪽 크론 잡은 모두 unschedule 됨, 2026-07-05):

| 작업 | 주기 | 내용 |
|---|---|---|
| 피로도 회복 | 10분 | `batch_recover_fatigue(10)` — CON 기반 최대치까지 +10 (구 `recover-fatigue` 엣지펑션 대체) |
| 게임 시간/날씨 | 30분 | `game_settings.current_game_hour/current_period/current_weather` 갱신 (구 `update-game-time` 엣지펑션 대체) |

참고: 프론트는 `game_epoch`/`weather_epoch`로 클라이언트에서 직접 계산하므로 위 컬럼들은 표시/호환용이다.
`batch_recover_fatigue`는 DB에 직접 생성한 함수다 (2026-07-05, 이 레포 커밋 히스토리 참조).

## 환경 변수

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | Supabase Session pooler 연결 문자열. **호스트는 `aws-1-ap-northeast-2`** (aws-0 아님!), 비밀번호 특수문자는 URL 인코딩 (`!` → `%21`) |
| `JWT_SECRET` | JWT 서명 키 (`openssl rand -hex 32`) |
| `PORT` | 로컬 포트 (기본 2567) |
| `CORS_ORIGIN` | 허용 origin, 콤마 구분 (예: `https://talebound-web.vercel.app,http://localhost:3000`) |

로드 순서: `.env.cloud`(Colyseus Cloud가 대시보드 값을 이 파일로 심음) → `.env`(로컬). 이미 설정된 값은 덮어쓰지 않는다.

## 배포 (Colyseus Cloud)

푸시 후 대시보드에서 Deploy 하거나, deploy 웹훅 호출. **주의사항 (전부 실제로 겪은 것):**

1. **Unix 소켓 리슨**: 클라우드에선 TCP가 아니라 `/run/colyseus/{2567+NODE_APP_INSTANCE}.sock`으로 리슨해야 프록시가 연결된다. `main.ts`가 `COLYSEUS_CLOUD` 환경변수로 분기.
2. **PM2 앱 이름/엔트리 고정**: 플랫폼이 기존 PM2 앱 정의(이름 `mud-backend`, 스크립트 `build/index.js`)를 기억하므로 `ecosystem.config.cjs`의 이름과 빌드 진입점(`build/index.js`)을 바꾸면 안 된다. 바꾸면 새 프로세스가 안 뜬다.
3. **환경변수는 대시보드에서**: Settings → Environment Variables. 변경은 다음 배포에 적용.
4. 배포 로그: 대시보드 Deployments 탭. 런타임 로그는 `GET https://cloud-prod.colyseus.io/api/application/{id}/logs` (SSE, Bearer 토큰 = `.colyseus-cloud.json`의 token).

## 로컬 실행

```bash
npm install
cp .env.example .env   # DATABASE_URL 등 채우기
npm run dev            # tsx watch (포트 2567)
npm run build && npm start
npm run backfill-users # Supabase auth.users → app_users 백필 (멱등)
```

## 이전 히스토리 (Supabase → 자체 백엔드)

| Supabase 기능 | 대체 |
|---|---|
| Auth | `app_users` 테이블 + bcrypt + JWT (`/api/auth/*`) |
| `supabase.rpc()` | `/api/rpc/:fn` allowlist 프록시 |
| `supabase.from()` 테이블 접근 | `/api/*` REST (tables 모듈) |
| Realtime (`map:{mapId}` 채널) | Colyseus `MapRoom` (presence/채팅/귓속말/결투) |
| Edge Function `recover-fatigue` + pg_cron | 백엔드 크론 (10분) |
| Edge Function `update-game-time` + pg_cron | 백엔드 크론 (30분) |
| Storage (게임 데이터 JSON) | 프론트 `public/data/` 정적 파일 |
