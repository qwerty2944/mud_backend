// @colyseus/schema v3는 TC39 데코레이터 메타데이터를 사용한다.
// 서버 Node(22)에는 Symbol.metadata가 없어 폴리필 필수 (없으면 상태 동기화 시 크래시).
// 반드시 @colyseus/* 임포트보다 먼저 평가되어야 한다.
(Symbol as { metadata?: symbol }).metadata ??= Symbol.for("Symbol.metadata");

export {};
