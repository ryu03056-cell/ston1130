/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 11/18 — 서버 주소  (data/11-server-config.js)
   │ Firebase 접속 설정과 자료 보관 위치 이름들
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════
   Firebase 실시간 데이터베이스 연동
══════════════════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAZ-uIrJ_x01So8qVC2sIJm9C93BirMeqY",
  authDomain: "ston1130.firebaseapp.com",
  databaseURL: "https://ston1130-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ston1130",
  storageBucket: "ston1130.firebasestorage.app",
  messagingSenderId: "462390983896",
  appId: "1:462390983896:web:a43c8acf2d236203c36bad",
  measurementId: "G-82RR7G869R"
};
/* OneSignal 푸시 전송용 Cloudflare Worker (자매 앱과 동일) */
const PUSH_ENDPOINT = "https://ston03.ryu03056.workers.dev";
const FB_DATA = "ston/data"; // 학교 데이터 (ID로 키잉 → 부분 저장)
const FB_META = "ston/meta"; // 마지막 수정자/시각
const FB_PRESENCE = "ston/presence"; // 동시 접속자
const FB_LOGS = "ston/logs"; // 수정 로그
const FB_CONFIG = "ston/config"; // 팀/인원 설정 (관리자 편집)
const FB_GEO = "ston/geo"; // 현장 좌표 캐시 (한 번 찾으면 재사용)
const FB_BK_IDX = "ston/backup_index"; // 백업 목록(가벼움 — 목록만 읽을 때 사용)
const FB_BK_DAT = "ston/backup_data"; // 백업 본문(무거움 — 복원할 때만 읽음)
const FB_UNDO = "ston/undo"; // 최근 변경 되돌리기용 기록
const FB_BOARD = "ston/board"; // 게시판 글
const FB_ADMINS = "ston/admins"; // 관리자 이메일 목록 — 규칙에서도 이 값을 본다
const FB_NOTES = "ston/notes"; // 현장이 아닌 메모 일정 (휴가·회의 등)
const FB_SYNC = "ston/sync"; // 시트 짝짓기 기억 (한 번 고르면 다시 안 물어봄)
