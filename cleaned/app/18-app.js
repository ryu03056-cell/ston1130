/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 18/18 — 로그인·전체 틀  (app/18-app.js)
   │ 로그인 화면, 휴대폰 하단 탭, 사이드바와 화면 전환, 서버와의 실시간 동기화, 구글 시트 반영 실행. 맨 마지막 줄에서 앱을 화면에 띄움
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════
   로그인 화면 (이메일/비밀번호)
══════════════════════════════════════════════════════════════ */
function LoginScreen({
  onLogin
}) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  /* 비밀번호를 잊었을 때 — 재설정 메일을 보낸다 (관리자 손 안 빌리고 해결) */
  const reset = () => {
    const em = (email || "").trim();
    if (!em) {
      setErr("이메일을 먼저 입력하세요.");
      return;
    }
    setErr("");
    firebase.auth().sendPasswordResetEmail(em).then(() => setSent(`${em} 으로 재설정 메일을 보냈어요. 메일함을 확인하세요.`)).catch(e => setErr("재설정 메일 발송 실패: " + (e.message || e.code)));
  };
  const submit = () => {
    if (!email || !pw) {
      setErr("이메일과 비밀번호를 입력하세요.");
      return;
    }
    if (typeof firebase === "undefined" || !firebase.auth) {
      setErr("인증 모듈을 불러오지 못했습니다.");
      return;
    }
    setBusy(true);
    setErr("");
    firebase.auth().signInWithEmailAndPassword(email.trim(), pw).then(() => {/* onAuthStateChanged 가 처리 */}).catch(e => {
      const m = {
        "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
        "auth/user-not-found": "등록되지 않은 계정입니다.",
        "auth/wrong-password": "비밀번호가 올바르지 않습니다.",
        "auth/invalid-credential": "이메일 또는 비밀번호가 올바르지 않습니다.",
        "auth/too-many-requests": "시도가 많아 잠시 후 다시 시도하세요.",
        "auth/network-request-failed": "네트워크 연결을 확인하세요."
      }[e.code] || "로그인 실패: " + (e.message || e.code);
      setErr(m);
      setBusy(false);
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: C.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: F,
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 380,
      background: C.surface,
      borderRadius: 18,
      border: BD,
      boxShadow: "0 12px 40px rgba(0,0,0,.12)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "28px 28px 20px",
      textAlign: "center",
      borderBottom: BD
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 30,
      fontWeight: 800,
      color: C.t1,
      letterSpacing: -.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.blue
    }
  }, "◈"), " STON"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      marginTop: 4,
      letterSpacing: 2,
      fontWeight: 600
    }
  }, "현장 일정·관리 시스템")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "24px 28px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.t1,
      marginBottom: 14
    }
  }, "팀원 로그인"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      color: C.t3,
      fontWeight: 700,
      display: "block",
      marginBottom: 4
    }
  }, "이메일"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    value: email,
    onChange: e => setEmail(e.target.value),
    onKeyDown: e => e.key === "Enter" && submit(),
    placeholder: "name@stoneng.co.kr",
    autoComplete: "username",
    style: {
      width: "100%",
      padding: "11px 12px",
      background: C.surfaceL,
      border: BD,
      borderRadius: 9,
      color: C.t1,
      fontSize: 16,
      outline: "none"
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      color: C.t3,
      fontWeight: 700,
      display: "block",
      marginBottom: 4
    }
  }, "비밀번호"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: pw,
    onChange: e => setPw(e.target.value),
    onKeyDown: e => e.key === "Enter" && submit(),
    placeholder: "••••••••",
    autoComplete: "current-password",
    style: {
      width: "100%",
      padding: "11px 12px",
      background: C.surfaceL,
      border: BD,
      borderRadius: 9,
      color: C.t1,
      fontSize: 16,
      outline: "none"
    }
  })), err && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.red,
      background: C.redL,
      padding: "8px 11px",
      borderRadius: 8,
      border: `1px solid ${C.red}30`
    }
  }, err), sent && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.green,
      background: C.greenL,
      padding: "9px 11px",
      borderRadius: 8,
      border: `1px solid ${C.green}30`,
      lineHeight: 1.6
    }
  }, sent), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    disabled: busy,
    style: {
      marginTop: 4,
      padding: "12px",
      borderRadius: 10,
      background: busy ? C.t4 : C.blue,
      border: "none",
      color: "#fff",
      fontSize: 16,
      fontWeight: 700,
      cursor: busy ? "default" : "pointer",
      boxShadow: `0 4px 14px ${C.blue}40`
    }
  }, busy ? "로그인 중…" : "로그인")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginTop: 16,
      lineHeight: 1.6
    }
  }, "계정이 없으면 관리자에게 문의하세요."), /*#__PURE__*/React.createElement("button", {
    onClick: reset,
    style: {
      width: "100%",
      marginTop: 10,
      padding: "11px 0",
      borderRadius: 9,
      border: `1px solid ${C.border}`,
      background: "transparent",
      color: C.t3,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "비밀번호를 잊으셨나요?"))));
}

/* ══════════════════════════════════════════════════════════════
   하단 탭바 (휴대폰 전용)
   · 자주 쓰는 4개를 화면 아래 고정 → 메뉴 이동이 두 번에서 한 번으로
   · 나머지(게시판·엑셀·설정)와 상태 정보는 ☰ 더보기 서랍으로
══════════════════════════════════════════════════════════════ */
const TABS = [{
  id: "schedule",
  icon: ICONS.schedule,
  label: "일정"
}, {
  id: "sites",
  icon: ICONS.sites,
  label: "현장"
}, {
  id: "map",
  icon: ICONS.map,
  label: "지도"
}, {
  id: "reports",
  icon: ICONS.reports,
  label: "보고서"
}];
const MORE_MENUS = ["board", "export", "settings"];
const TAB_H = 54;
function TabItem({
  icon,
  label,
  on,
  onClick,
  badge
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      flex: 1,
      minWidth: 0,
      minHeight: TAB_H,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      padding: "6px 0 5px",
      border: "none",
      background: "transparent",
      color: on ? C.blue : C.t3,
      position: "relative",
      WebkitTapHighlightColor: "transparent"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      lineHeight: 1,
      display: "flex"
    }
  }, icon), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: on ? 800 : 600,
      letterSpacing: -.2,
      whiteSpace: "nowrap"
    }
  }, label), badge > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 3,
      left: "50%",
      marginLeft: 6,
      background: C.red,
      color: "#fff",
      fontSize: 12,
      fontWeight: 800,
      padding: "1px 5px",
      borderRadius: 9,
      lineHeight: 1.5
    }
  }, badge > 99 ? "99+" : badge));
}
function BottomTabs({
  menu,
  setMenu,
  onMore,
  urgentCount
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 90,
      display: "flex",
      background: C.surface,
      borderTop: `1px solid ${C.borderD}`,
      paddingBottom: "env(safe-area-inset-bottom)",
      boxShadow: "0 -2px 14px rgba(20,30,50,.10)"
    }
  }, TABS.map(t => /*#__PURE__*/React.createElement(TabItem, {
    key: t.id,
    icon: t.icon,
    label: t.label,
    on: menu === t.id,
    badge: t.id === "reports" ? urgentCount : 0,
    onClick: () => setMenu(t.id)
  })), /*#__PURE__*/React.createElement(TabItem, {
    icon: ICONS.more,
    label: "더보기",
    on: MORE_MENUS.includes(menu),
    onClick: onMore
  }));
}

/* ══════════════════════════════════════════════════════════════
   메인 앱 — 사이드바 + 라우팅
══════════════════════════════════════════════════════════════ */
function App() {
  const isMobile = useIsMobile();
  const [authUser, setAuthUser] = useState(undefined); // undefined=확인중, null=미로그인, obj=로그인
  const [db, setDbRaw] = useState(() => {
    try {
      if (localStorage.getItem("ston_fresh")) {
        localStorage.removeItem("ston_fresh");
        return {};
      }
    } catch {}
    /* 신호가 약하거나 서버 응답이 늦어도 마지막으로 본 내용부터 바로 보이게 */
    try {
      const c = JSON.parse(localStorage.getItem("ston_cache") || "null");
      if (c && c.data && countSchools(c.data) > 0) return c.data;
    } catch {}
    return DB;
  });
  /* 모든 변경이 여기를 지난다 — 학교에서 빠진 인원은 동별 담당에서도 같이 뺀다.
     정리하다 오류가 나면 원래 변경을 그대로 반영한다 */
  const setDb = React.useCallback(u => setDbRaw(prev => {
    const nx = typeof u === "function" ? u(prev) : u;
    try {
      return pruneDbBldWho(nx);
    } catch (e) {
      console.error("[동별 담당 정리] 실패:", e);
      return nx;
    }
  }), []);
  const [sideOpen, setSideOpen] = useState(typeof window !== "undefined" ? window.innerWidth >= 820 : true);
  const [menu, setMenuRaw] = useState("schedule");
  // 모바일에서 메뉴 선택 시 사이드바 자동 닫힘
  const setMenu = m => {
    setMenuRaw(m);
    if (window.innerWidth < 820) setSideOpen(false);
  };

  /* ── Firebase 상태 ── */
  const [fbStatus, setFbStatus] = useState("연결 중...");
  const [online, setOnline] = useState(false); // .info/connected
  const [syncing, setSyncing] = useState(false); // 저장 중 표시
  const [lastSync, setLastSync] = useState(null); // 마지막 저장 결과 {ok,at,n,err}
  const [loaded, setLoaded] = useState(false); // 첫 데이터 도착
  const [users, setUsers] = useState(0); // 동시 접속자
  const [meta, setMeta] = useState(null); // { at, by }
  const [editor, setEditor] = useState(() => {
    try {
      return localStorage.getItem("ston_editor") || "";
    } catch {
      return "";
    }
  });
  const saveName = n => {
    setEditor(n);
    try {
      localStorage.setItem("ston_editor", n);
    } catch {}
  };
  const dataRef = useRef(null);
  const metaRef = useRef(null);
  const lastSynced = useRef(null); // 마지막으로 FB와 일치한 db
  const fbReady = useRef(false);
  const dbLive = useRef(db); // 항상 현재 db (onData 클로저용)
  dbLive.current = db;
  const dirty = useRef(false); // 저장 안 된 로컬 변경 있음
  const seededOnce = useRef(false); // 빈 Firebase 최초 1회만 시드(루프 방지)
  const dailyBkDone = useRef(false); // 하루 1회 자동 백업
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const saveTimer = useRef(null);
  const [cfgVer, setCfgVer] = useState(0); // 인원 설정 갱신 트리거
  const [accounts, setAccounts] = useState({}); // 등록된 인원·계정 (화면 갱신용)
  const [notes, setNotes] = useState([]); // 현장이 아닌 메모 일정
  const [sheet, setSheet] = useState(null); // 시트에서 받아온 것
  const [sheetAt, setSheetAt] = useState(0); // 마지막으로 받은 시각
  const [sheetErr, setSheetErr] = useState(null); // 실패 사유
  const [sheetBusy, setSheetBusy] = useState(false);
  const [syncMap, setSyncMap] = useState({}); // 사람이 골라둔 짝짓기
  const [sheetChanges, setSheetChanges] = useState([]); // 시트에서 바뀐 것들
  const [showChanges, setShowChanges] = useState(false); // 목록 펼침
  const prevSheet = useRef(null); // 직전에 받은 시트 (견주기용)

  /* 시트에서 무엇이 바뀌었는지 찾아낸다 */
  const diffSheet = (before, after) => {
    if (!before || !before.sites) return [];
    const oldMap = {};
    before.sites.forEach(r => oldMap[r.row] = r);
    const FIELDS = [["field", "현장조사일"], ["start", "착수일"], ["end", "완수일"], ["deliver", "납품일"], ["contract", "계약일"], ["kind", "점검종류"], ["region", "지역"], ["school", "학교명"], ["memo", "특이사항"], ["fmsId", "FMS ID"], ["deliverY", "납품유무"], ["deliverW", "납품방법"], ["doneY", "완수유무"]];
    const out = [];
    after.sites.forEach(r => {
      const o = oldMap[r.row];
      if (!o) {
        out.push({
          kind: "새로 추가",
          school: `${r.region || ""} ${r.school}`.trim(),
          row: r.row
        });
        return;
      }
      FIELDS.forEach(([k, label]) => {
        if (String(o[k] || "") !== String(r[k] || "")) out.push({
          kind: "바뀜",
          school: `${r.region || ""} ${r.school}`.trim(),
          row: r.row,
          field: label,
          before: o[k] || "(없음)",
          after: r[k] || "(없음)"
        });
      });
      /* 동(시설물) 개수 변화도 알려준다 */
      const ob = (o.buildings || []).length,
        nb = (r.buildings || []).length;
      if (ob !== nb) out.push({
        kind: "바뀜",
        school: `${r.region || ""} ${r.school}`.trim(),
        row: r.row,
        field: "동 개수",
        before: ob + "동",
        after: nb + "동"
      });
      delete oldMap[r.row];
    });
    /* 시트에서 사라진 것 */
    Object.values(oldMap).forEach(o => out.push({
      kind: "시트에서 사라짐",
      school: `${o.region || ""} ${o.school}`.trim(),
      row: o.row
    }));
    return out;
  };

  /* 시트에서 받아오기 — 열 때 + 5분마다 + 새로고침 버튼 */
  const sheetPending = useRef(false); // 이미 부르는 중인지
  const loadSheet = React.useCallback(async () => {
    /* 앞 요청이 안 끝났으면 건너뛴다 — 겹쳐 부르면 느려지고 순서가 꼬인다 */
    if (sheetPending.current) return;
    sheetPending.current = true;
    setSheetBusy(true);
    setSheetErr(null);

    /* 20초 안에 답이 없으면 포기한다 (인터넷이 끊겼을 때 매달리지 않도록) */
    const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ac ? setTimeout(() => ac.abort(), 20000) : null;
    try {
      /* Apps Script 가 가끔 JSON 대신 HTML 오류 페이지를 준다 — 최대 3번 다시 받는다 */
      let j = null,
        lastErr = null;
      for (let tryN = 0; tryN < 3 && !j; tryN++) {
        if (tryN) await new Promise(r => setTimeout(r, 1500));
        try {
          const res = await fetch(`${SHEET_URL}?key=${encodeURIComponent(SHEET_KEY)}&t=${Date.now()}_${tryN}`, ac ? {
            signal: ac.signal
          } : undefined);
          if (!res.ok) throw new Error(`시트 서버 응답 ${res.status}`);
          const txt = await res.text();
          if (!txt.trim().startsWith("{")) throw new Error("시트가 잠깐 응답을 못 했습니다");
          j = JSON.parse(txt);
        } catch (e) {
          lastErr = e;
          if (e && e.name === "AbortError") throw e;
        }
      }
      if (!j) throw lastErr || new Error("시트를 읽지 못했습니다");
      if (!j || !j.ok) throw new Error(j && j.error || "시트를 읽지 못했습니다");
      if (!Array.isArray(j.sites)) throw new Error("시트 내용이 올바르지 않습니다");
      /* 직전에 받은 것과 견줘 무엇이 바뀌었는지 찾는다 (처음 받을 때는 건너뜀) */
      const ch = diffSheet(prevSheet.current, j);
      prevSheet.current = j;
      if (ch.length) setSheetChanges(prev => [...ch, ...prev].slice(0, 200));
      setSheet(j);
      setSheetAt(Date.now());
    } catch (e) {
      const msg = e && e.name === "AbortError" ? "시트 응답이 너무 늦습니다 (20초 초과)" : e && e.message || String(e);
      setSheetErr(msg);
    }
    if (timer) clearTimeout(timer);
    sheetPending.current = false;
    setSheetBusy(false);
  }, []);

  /* 로그인한 뒤에만 시트를 부른다 */
  useEffect(() => {
    if (!authUser) return;
    loadSheet();
    const t = setInterval(loadSheet, 5 * 60 * 1000);
    /* 다른 창을 보다 돌아오면 한 번 더 확인 — 오래 잠들어 있었을 수 있다 */
    const onWake = () => {
      if (!document.hidden) loadSheet();
    };
    document.addEventListener("visibilitychange", onWake);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [loadSheet, authUser]);




  /* 사람이 골라둔 짝짓기 기억 */
  useEffect(() => {
    if (!authUser || typeof firebase === "undefined" || !firebase.apps.length) return;
    const r = firebase.database().ref(FB_SYNC);
    const on = sn => setSyncMap(sn.val() || {});
    r.on("value", on, () => setSyncMap({}));
    return () => r.off("value", on);
  }, [authUser]);
  const [kakaoKey, setKakaoKey] = useState(""); // 지도(카카오맵) 키 — 설정에 저장
  const [logs, setLogs] = useState([]); // 수정 로그

  /* A) Firebase 초기화 + 접속 상태 + 인증 상태 감시 */
  useEffect(() => {
    let offConn = null,
      offAuth = null;
    try {
      if (typeof firebase === "undefined") {
        setFbStatus("오프라인 (SDK 없음)");
        setLoaded(true);
        setAuthUser(null);
        return;
      }
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      const rootDb = firebase.database();
      const connRef = rootDb.ref(".info/connected");
      const onConn = s => {
        const c = s.val() === true;
        setOnline(c);
        setFbStatus(c ? "실시간 연결됨" : "재연결 중...");
      };
      connRef.on("value", onConn);
      offConn = () => connRef.off("value", onConn);
      if (firebase.auth) {
        offAuth = firebase.auth().onAuthStateChanged(user => {
          /* 익명 세션은 기기에 남아 있다가 다음 접속 때 그대로 되살아난다.
             콘솔에서 익명 인증을 꺼도 이미 발급된 세션은 살아 있으므로
             여기서 직접 걷어내고 로그인 화면으로 보낸다. */
          if (user && user.isAnonymous) {
            firebase.auth().signOut().catch(() => {});
            setFbStatus("이전 익명 접속을 정리했습니다. 다시 로그인해 주세요.");
            CURRENT_USER = {
              uid: null,
              email: null,
              name: ""
            };
            setAuthUser(null);
            return;
          }
          if (user) {
            CURRENT_USER = {
              uid: user.uid,
              email: user.email,
              name: editorRef.current || user.email || ""
            };
            setAuthUser(user);
          } else {
            /* 로그인하지 않은 상태 → 로그인 화면. (익명 자동 로그인은 폐지) */
            CURRENT_USER = {
              uid: null,
              email: null,
              name: ""
            };
            setAuthUser(null);
          }
        });
      } else {
        setAuthUser(null);
        setFbStatus("오프라인 (인증 SDK 없음)");
      }
    } catch (e) {
      console.error("[Firebase] 초기화 실패:", e);
      setFbStatus("오프라인 (로컬)");
      setLoaded(true);
      setAuthUser(null);
    }
    return () => {
      if (offConn) offConn();
      if (offAuth) offAuth();
    };
  }, []);

  /* 관리자 여부 — ston/admins/<uid> 가 true 인 사람만.
     이 값은 Firebase 규칙에서도 그대로 쓰이므로 화면을 숨기는 것에 그치지 않는다. */
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCount, setAdminCount] = useState(null); // null=확인 전
  useEffect(() => {
    if (!authUser || typeof firebase === "undefined" || !firebase.apps.length) {
      setIsAdmin(false);
      return;
    }
    const aRef = firebase.database().ref(FB_ADMINS);
    const onAdmins = sn => {
      ADMINS = sn.val() || {};
      setAdminCount(Object.values(ADMINS).filter(Boolean).length);
      setIsAdmin(ADMINS[emailKey(authUser.email)] === true || isOwnerEmail(authUser.email));
    };
    aRef.on("value", onAdmins, () => {
      setAdminCount(0);
      setIsAdmin(false);
    });
    return () => aRef.off("value", onAdmins);
  }, [authUser]);

  /* 권한 없는 메뉴에 머물러 있으면 일정 화면으로 돌린다 */
  useEffect(() => {
    if (menu === "export" && !isAdmin) setMenuRaw("schedule");
    if (menu === "settings" && !(OWNER_EMAIL ? isOwnerEmail(authUser && authUser.email) : isAdmin)) setMenuRaw("schedule");
  }, [isAdmin, authUser, menu]);

  /* B) 로그인 후에만 데이터/메타/설정/로그/presence 구독 */
  useEffect(() => {
    if (!authUser || typeof firebase === "undefined" || !firebase.apps.length) return;
    const rootDb = firebase.database();
    const dRef = rootDb.ref(FB_DATA),
      mRef = rootDb.ref(FB_META);
    const cRef = rootDb.ref(FB_CONFIG),
      presRef = rootDb.ref(FB_PRESENCE);
    const lRef = rootDb.ref(FB_LOGS).limitToLast(200);
    const nRef = rootDb.ref(FB_NOTES);
    dataRef.current = dRef;
    metaRef.current = mRef;
    const onData = snap => {
      const val = fbToDb(snap.val());
      if (val && Object.keys(val).length) {
        /* Firebase value 이벤트는 항상 전체 상태 → 그대로 반영(추가·수정·삭제 모두 정확).
           lastSynced를 원격값으로 갱신 → 저장 effect의 diff가 비어 에코 재저장이 안 됨(플래그 불필요). */
        lastSynced.current = val;
        /* 서버에 이미 쌓여 있던 중복도 불러오는 즉시 정리 → 저장 effect가 서버에서도 지움 */
        const clean = dedupeDb(val);
        setDb(clean);
        /* 현장에서 신호가 약할 때를 대비해 기기에도 마지막 상태를 보관 */
        try {
          localStorage.setItem("ston_cache", JSON.stringify({
            at: Date.now(),
            data: clean
          }));
        } catch {}
      } else {
        /* Firebase가 비었을 때: 최초 1회만 시드. 로컬에 데이터가 있으면 올리고,
           로컬도 비었으면(초기화 직후) 빈 상태 유지 → 초기화가 유지됨 */
        if (!seededOnce.current) {
          seededOnce.current = true;
          if (countSchools(dbLive.current) > 0) {
            dRef.set(stripUndefined(dbToFb(dbLive.current))).catch(() => {});
            lastSynced.current = dbLive.current;
          } else {
            lastSynced.current = {};
          }
        }
      }
      fbReady.current = true;
      setLoaded(true);
    };
    const onErr = err => {
      console.error("[Firebase] 구독 오류:", err);
      setFbStatus("오프라인 (권한 확인)");
      setLoaded(true);
    };
    dRef.on("value", onData, onErr);
    const onMeta = s => {
      const m = s.val();
      if (m) setMeta(m);
    };
    mRef.on("value", onMeta);
    const onCfg = s => {
      const cfg = s.val();
      if (cfg) {
        applyConfig(cfg);
        setAccounts(cfg.accounts || {});
        setKakaoKey(cfg.kakaoKey || "");
        setCfgVer(v => v + 1);
      } else {
        cRef.set({
          members: MEMBERS
        }).catch(() => {});
      }
    };
    cRef.on("value", onCfg);
    const onLogs = s => {
      const v = s.val() || {};
      setLogs(Object.entries(v).map(([id, o]) => ({
        id,
        ...o
      })).sort((a, b) => (b.ts || 0) - (a.ts || 0)));
    };
    lRef.on("value", onLogs);
    const onNotes = sn => {
      const v = sn.val() || {};
      /* who·extra 도 배열이라 객체로 돌아온다 → 배열로 복원 */
      setNotes(Object.entries(v).map(([id, o]) => ({
        id,
        ...o,
        who: toArr(o && o.who).filter(Boolean),
        extra: toArr(o && o.extra).filter(Boolean)
      })));
    };
    nRef.on("value", onNotes, () => setNotes([]));
    const presNode = presRef.push();
    presNode.set({
      name: editorRef.current || CURRENT_USER.email || "익명",
      ts: Date.now()
    });
    presNode.onDisconnect().remove();
    const onPres = s => setUsers(s.numChildren());
    presRef.on("value", onPres);
    return () => {
      dRef.off("value", onData);
      mRef.off("value", onMeta);
      cRef.off("value", onCfg);
      lRef.off("value", onLogs);
      nRef.off("value", onNotes);
      presRef.off("value", onPres);
      presNode.remove().catch(() => {});
    };
  }, [authUser]);

  /* 2) 로컬 db 변경 → 바뀐 학교만 부분 저장 (update + 삭제는 null).
        에코 차단은 lastSynced와의 diff로만 처리(플래그 없음) → 진짜 변경을 절대 건너뛰지 않음.
        변경이 크면(가져오기 등) 즉시 저장, 작은 편집은 0.4초 디바운스. */
  useEffect(() => {
    if (!fbReady.current || !dataRef.current) return;
    /* 빈 db는 자동 저장하지 않음(실수로 전체 삭제 방지). 전체 비우기는 설정의 '전체 초기화' 사용 */
    if (countSchools(db) === 0) {
      lastSynced.current = db;
      return;
    }
    const snapshot = db;
    const updates = diffPaths(lastSynced.current || {}, snapshot);
    const keys = Object.keys(updates);
    if (keys.length === 0) {
      lastSynced.current = snapshot;
      return;
    } // 변경 없음/원격 에코 → 저장 안 함

    /* 되돌리기 기록 — 바뀐 현장의 '변경 전' 모습을 남겨 둔다 (대량 변경은 스냅샷이 담당) */
    if (keys.length <= 20) {
      const beforeMap = flatMapDb(lastSynced.current || {});
      pushUndo(keys.map(k => {
        const before = beforeMap[k] || null;
        const after = updates[k] || null;
        const nm = after && after.school || before && before.school || "";
        return {
          path: k,
          before,
          after,
          label: nm + (after ? before ? " 수정" : " 추가" : " 삭제")
        };
      }));
    }
    setSyncing(true);
    setLastSync({
      ok: null,
      at: Date.now(),
      n: keys.length
    }); // 저장 시도 시작(진행 중)
    const doSave = () => {
      let p;
      try {
        p = dataRef.current.update(updates);
      } // update()가 동기적으로 throw할 수 있음(잘못된 키 등)
      catch (e) {
        console.error("[Firebase] update 호출 실패:", e);
        setLastSync({
          ok: false,
          at: Date.now(),
          n: keys.length,
          err: e && e.message || String(e)
        });
        setSyncing(false);
        return;
      }
      p.then(() => {
        metaRef.current?.set({
          at: Date.now(),
          by: editorRef.current || "익명",
          cnt: countSchools(snapshot)
        }).catch(() => {});
        lastSynced.current = snapshot;
        setLastSync({
          ok: true,
          at: Date.now(),
          n: keys.length
        });
      }).catch(e => {
        console.error("[Firebase] 저장 실패:", e);
        setLastSync({
          ok: false,
          at: Date.now(),
          n: keys.length,
          err: e && e.message || String(e)
        });
      }).finally(() => setSyncing(false));
    };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (keys.length > 5) doSave(); // 큰 변경(가져오기 등) → 즉시 저장
    else saveTimer.current = setTimeout(doSave, 400); // 작은 편집 → 디바운스
  }, [db]);

  /* 로그인한 계정에 연결된 실명을 자동으로 가져온다 (설정에서 관리자가 연결) */
  const mappedName = authUser && authUser.email ? nameOfEmail(authUser.email) : "";
  useEffect(() => {
    if (mappedName && mappedName !== editor) saveName(mappedName);
  }, [mappedName]);

  /* 내 이름 변경 시 로그 기록용 사용자명 갱신 + 푸시 등록 */
  useEffect(() => {
    CURRENT_USER = {
      ...CURRENT_USER,
      name: editor || CURRENT_USER.email || ""
    };
  }, [editor]);
  const logout = () => {
    try {
      localStorage.removeItem("ston_editor");
    } catch {}
    setEditor("");
    try {
      firebase.auth().signOut();
    } catch {}
  };

  /* 전체 초기화: 리스너 끊고 → Firebase 비우고 → 빈 상태로 새로고침 (재시드 차단) */
  const resetAll = () => {
    /* 초기화 전 상태를 통째로 백업 */
    try {
      makeSnapshot(dbLive.current, "전체 초기화 전").catch(() => {});
    } catch {}
    try {
      localStorage.setItem("ston_fresh", "1");
    } catch {}
    lastSynced.current = {};
    const ref = dataRef.current;
    dataRef.current = null; // 저장 effect 차단 (guard: !dataRef.current → return)
    try {
      if (ref) ref.off();
    } catch {}
    const done = () => setTimeout(() => {
      try {
        location.reload();
      } catch {
        window.location.href = window.location.href;
      }
    }, 300);
    try {
      if (ref) ref.set(null).then(done).catch(done);else done();
    } catch {
      done();
    }
  };

  /* 명시적 즉시 저장 — 가져오기 등에서 직접 호출. 자동 effect 타이밍과 무관하게 확실히 서버에 기록하고
     결과(성공/실패+에러)를 화면에 표시. 바뀐 학교만 update(삭제는 null) → 다른 데이터 안 건드림. */
  const saveNow = newDb => {
    const ref = dataRef.current || (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length ? firebase.database().ref(FB_DATA) : null);
    if (!ref) {
      setLastSync({
        ok: false,
        at: Date.now(),
        n: 0,
        err: "Firebase 미연결"
      });
      return Promise.reject(new Error("no-ref"));
    }
    const updates = diffPaths(lastSynced.current || {}, newDb);
    const keys = Object.keys(updates);
    if (!keys.length) {
      lastSynced.current = newDb;
      setLastSync({
        ok: true,
        at: Date.now(),
        n: 0
      });
      return Promise.resolve();
    }
    setSyncing(true);
    setLastSync({
      ok: null,
      at: Date.now(),
      n: keys.length
    });
    let p;
    try {
      p = ref.update(updates);
    } catch (e) {
      console.error("[Firebase] saveNow update throw:", e);
      setLastSync({
        ok: false,
        at: Date.now(),
        n: keys.length,
        err: e && e.message || String(e)
      });
      setSyncing(false);
      return Promise.reject(e);
    }
    return p.then(() => {
      lastSynced.current = newDb;
      setLastSync({
        ok: true,
        at: Date.now(),
        n: keys.length
      });
      metaRef.current?.set({
        at: Date.now(),
        by: editorRef.current || "익명",
        cnt: countSchools(newDb)
      }).catch(() => {});
    }).catch(e => {
      console.error("[Firebase] saveNow 저장 실패:", e);
      setLastSync({
        ok: false,
        at: Date.now(),
        n: keys.length,
        err: e && e.message || String(e)
      });
      throw e;
    }).finally(() => setSyncing(false));
  };

  /* 푸시 알림 켜기 */
  const enablePush = () => {
    registerOneSignal(editor || authUser && authUser.email || "익명");
    alert("알림 권한을 허용해 주세요. 아이폰은 홈 화면에 추가한 앱 아이콘에서 열어야 알림이 옵니다.");
  };
  const fmtMeta = ts => {
    if (!ts) return "";
    const d = new Date(ts),
      now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hh = String(d.getHours()).padStart(2, "0"),
      mm = String(d.getMinutes()).padStart(2, "0");
    return sameDay ? `오늘 ${hh}:${mm}` : `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
  };

  /* 하루에 한 번, 그날 첫 사용자가 자동으로 전체 백업 */
  useEffect(() => {
    if (dailyBkDone.current) return;
    if (countSchools(db) === 0) return;
    const today = new Date();
    const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    let tid = setTimeout(async () => {
      try {
        const snap = await firebase.database().ref(FB_BK_IDX).once("value");
        const list = Object.values(snap.val() || {});
        const has = list.some(m => {
          if (!m || !m.at) return false;
          const d = new Date(m.at);
          return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` === key && String(m.reason || "").startsWith("자동");
        });
        if (!has) await makeSnapshot(dbLive.current, "자동(하루 1회)");
        dailyBkDone.current = true;
      } catch {
        dailyBkDone.current = true;
      }
    }, 4000); // 첫 로딩이 끝난 뒤 조용히
    return () => clearTimeout(tid);
  }, [db]);
  /* 자정을 넘기면 화면을 한 번 다시 그린다 — 앱을 켜둔 채로 날이 바뀌어도 D-day가 맞게 */
  const [, setDayTick] = useState(0);
  useEffect(() => {
    let cur = todayStr();
    const t = setInterval(() => {
      const now = todayStr();
      if (now !== cur) {
        cur = now;
        setDayTick(v => v + 1);
      }
    }, 60000);
    return () => clearInterval(t);
  }, []);
  const allSchools = useMemo(() => {
    const list = [];
    Object.entries(db).forEach(([yr, halves]) => Object.entries(halves).forEach(([half, schools]) => (schools || []).forEach(s => {
      if (!s.deleted) list.push({
        ...s,
        _year: yr,
        _half: half
      });
    })));
    return list;
  }, [db]);

  /* 시트와 짝지은 결과 — 어느 현장이 시트 몇 행에 붙는지.
     · 시트가 담은 반기(26년 하반기)만 대상으로 삼는다
     · 한 시트 줄에는 앱 현장 하나만 붙는다 */
  const sheetMatch = useMemo(() => {
    if (!sheet || !sheet.sites) return null;
    const rows = sheet.sites;
    const map = {},
      unmatched = [],
      taken = {};

    /* 이 반기 현장만 — 다른 반기는 애초에 후보에서 뺀다 */
    /* 휴지통에 있는 현장도 짝짓기 후보에 넣는다 — 시트에 여전히 있으면 시트가 주인이니 되살린다 */
    const trashed = [];
    toArr(db[SHEET_YEAR] && db[SHEET_YEAR][SHEET_HALF]).forEach(x => {
      if (x && x.deleted) trashed.push({
        ...x,
        _year: SHEET_YEAR,
        _half: SHEET_HALF
      });
    });
    const target = [...allSchools.filter(s => s._year === SHEET_YEAR && s._half === SHEET_HALF), ...trashed];
    const skipped = allSchools.length - target.length;

    /* 살아있는 앱 현장 이름들 — No. 로 이을 때 "그 이름의 주인이 따로 있는지" 보려고 */
    const appNames = new Set(target.filter(s => !s.deleted).map(s => normName(s.school)));
    /* 사람이 직접 고른 것을 먼저 처리해 자리를 잡아준다 */
    const ordered = [...target].sort((a, b) => (syncMap[b.id] ? 1 : 0) - (syncMap[a.id] ? 1 : 0));
    ordered.forEach(s => {
      const m = matchSheetRow(s, rows, syncMap, appNames);
      if (m.row) {
        const rk = String(m.row.row);
        /* 이미 다른 현장이 차지한 줄이면 사람이 확인하게 넘긴다 */
        if (taken[rk]) {
          unmatched.push({
            site: s,
            by: "다른 현장이 사용 중",
            cands: rows.filter(r => normName(r.school) === normName(s.school))
          });
          return;
        }
        taken[rk] = s.id;
        map[s.id] = {
          row: m.row,
          by: m.by
        };
      } else if (m.by !== "앱 전용") {
        unmatched.push({
          site: s,
          by: m.by,
          cands: m.cands || []
        });
      }
    });

    /* 이름 경쟁에서 밀린 현장("다른 현장이 사용 중")은 No. 로 한 번 더 잇는다.
       같은 학교가 앱에 둘인데 시트에서 한쪽 이름이 바뀐 경우(예: 은혜고 No.247 → 율곡연수원) —
       시트에 그 No. 가 하나뿐이고 그 줄이 아직 비어 있을 때만 */
    for (let i = unmatched.length - 1; i >= 0; i--) {
      const u = unmatched[i];
      if (u.by !== "다른 현장이 사용 중" || u.site.deleted) continue;
      const no = String(u.site.no || "").trim();
      if (!no) continue;
      const byNo = rows.filter(r => String(r.no || "").trim() === no);
      if (byNo.length !== 1 || taken[String(byNo[0].row)]) continue;
      if (normName(byNo[0].school) !== normName(u.site.school) && appNames.has(normName(byNo[0].school))) continue;
      taken[String(byNo[0].row)] = u.site.id;
      map[u.site.id] = {
        row: byNo[0],
        by: "No.로 연결 (이름 바뀜)"
      };
      unmatched.splice(i, 1);
    }

    return {
      map,
      unmatched,
      total: rows.length,
      matched: Object.keys(map).length,
      target: target.length,
      skipped,
      at: sheet.at /* 어느 시트로 계산했는지 — 자동 반영이 새 시트인지 가릴 때 쓴다 */
    };
  }, [sheet, allSchools, syncMap, db]);

  /* 시트가 주인인 항목은 시트 값을 앱에 자동으로 덮어쓴다.
     착수일·현장조사(첫날)·완수일·계약일·특이사항·지역·워크플로우 16단계.
     조사 여러 날·날짜별 인원·예정/확정·메모는 앱에만 있으니 그대로 둔다.

     ★ 시트를 새로 받았을 때(sheetAt 이 바뀔 때)만 한 번 돈다.
       sheetMatch 나 allSchools 를 보고 돌면 덮어쓰기 → db 변경 → 다시 덮어쓰기로
       무한 반복하므로 절대 그 둘을 의존성에 넣지 않는다. */
  const appliedAt = useRef(null);
  useEffect(() => {
    if (!sheet || !sheetMatch) return;
    /* sheetMatch 가 아직 옛 시트로 계산된 상태면 기다린다 (useMemo 가 한 박자 늦게 온다) */
    if (sheetMatch.at !== sheet.at) return;
    /* "같은 시트 + 같은 연결 상태" 면 이미 반영한 것 — 무한 반복 방지.
       사람이 설정에서 "이 행으로 연결" 을 누르면 syncMap 이 바뀌어 키가 달라지므로 즉시 다시 돈다. */
    const key = sheet.at + "|" + JSON.stringify(syncMap || {});
    if (appliedAt.current === key) return;
    appliedAt.current = key;

    const flow = sheet.flow || {};
    const patch = {};
    /* 휴지통 현장도 돈다 — 시트에 있으면 되살린다 */
    const trashedAll = [];
    toArr(db[SHEET_YEAR] && db[SHEET_YEAR][SHEET_HALF]).forEach(x => {
      if (x && x.deleted) trashedAll.push({
        ...x,
        _year: SHEET_YEAR,
        _half: SHEET_HALF
      });
    });
    [...allSchools, ...trashedAll].forEach(s => {
      const m = sheetMatch.map[s.id];
      if (!m) return;
      const r = m.row;
      const fl = flow[`${r.region}|${r.school}`];
      const next = {};
      if (s.deleted) next.deleted = null; /* 시트에 있으니 휴지통에서 꺼낸다 */
      if ((r.start || "") !== (s.start || "")) next.start = r.start || "";
      /* 현장조사 첫날 — 시트가 주인. 여러 날(fieldEnd·fieldExtra)과 날짜별 인원은 앱에만 있으니 건드리지 않는다.
         다만 첫날이 바뀌어 종료일이 첫날보다 앞서게 되면 종료일은 비운다(뒤집힌 기간은 뜻이 없다).
         첫날이 "따로 떨어진 날" 목록에 이미 있으면 겹치니 뺀다. */
      if ((r.field || "") !== (s.field || "")) {
        const nf = r.field || "";
        next.field = nf;
        if (!nf || s.fieldEnd && s.fieldEnd <= nf) next.fieldEnd = "";
        const ex = toArr(s.fieldExtra).filter(d => d && d !== nf);
        if (ex.length !== toArr(s.fieldExtra).filter(Boolean).length) next.fieldExtra = ex;
        /* 날짜별 인원에서 옛 첫날 배정은 그대로 두되, 새 첫날에 배정이 없으면 기본 인원이 쓰인다 (whoOnDate) */
      }
      if ((r.end || "") !== (s.end || "")) next.end = r.end || "";
      /* 납품 — 시트 열 + 워크플로우 납품 칸을 합쳐서 */
      {
        const dv = parseDelivery(r, fl ? fl.steps : null);
        if ((dv.date || "") !== (s.deliverDate || "")) next.deliverDate = dv.date || "";
        if ((dv.way || "") !== (s.deliverWay || "")) next.deliverWay = dv.way || "";
        if ((dv.by || "") !== (s.deliverBy || "")) next.deliverBy = dv.by || "";
        if (!!dv.done !== !!s.deliverDone) next.deliverDone = !!dv.done;
      }
      if ((r.contract || "") !== (s.contract || "")) next.contract = r.contract || "";
      if ((r.memo || "") !== (s.memo || "")) next.memo = r.memo || "";
      if (r.region && r.region !== (s.region || "")) next.region = r.region;
      if (r.school && r.school !== (s.school || "")) next.school = r.school;
      if ((r.no || "") !== (s.no || "")) next.no = r.no || "";
      if (r.kind && r.kind !== (s.kind || "")) next.kind = r.kind;
      if (!!r.isNew !== !!s.isNew) next.isNew = !!r.isNew;
      /* 동 정보 — 시트 시설물 행 기준. 앱에서만 쓰는 값(rep·fmsD·delivery·note·flag)은 이름으로 짝지어 보존 */
      if (r.buildings && r.buildings.length) {
        const kindOf = kindToBK;
        const oldB = toArr(s.buildings).filter(Boolean);
        const byName = {};
        oldB.forEach(b => byName[normName(b.b)] = b);
        const nb = r.buildings.map(b => {
          const prev = byName[normName(b.b)] || {};
          return {
            ...prev,
            b: b.b || "",
            cat: prev.cat || (/옹벽|교량|터널|축대|담장/.test(b.b || "") ? "토목종" : "건축"),
            kind: kindOf(b.kind || r.kind),
            floor: b.floor || null,
            area: b.area ?? null,
            len: b.len ?? null,
            height: b.height ?? null,
            field: b.field || null,
            jong: b.jong || null,
            fms: sheetFms(r) || prev.fms || null,
            rep: prev.rep || false,
            fmsD: prev.fmsD || false,
            delivery: prev.delivery || null,
            note: prev.note || null,
            flag: prev.flag || null
          };
        });
        const same = sameSheetBuildings(oldB, nb);
        if (!same) next.buildings = nb;
      }
      /* 워크플로우 — 값이 실제로 다를 때만 (키 순서 무관하게 견줌) */
      const fs = fl ? fl.steps || {} : {}; /* 워크플로우에 없어도 {} — 시트 연동 현장은 16단계로 보인다 */
      {
        const a = JSON.stringify(Object.keys(fs).sort().map(k => [k, fs[k]]));
        const b = JSON.stringify(Object.keys(s.flow || {}).sort().map(k => [k, (s.flow || {})[k]]));
        if (a !== b || !s.flow) next.flow = fs;
      }
      if (Object.keys(next).length) patch[s.id] = next;
    });
    /* ── 시트에만 있고 앱에 없는 현장 → 앱에 새로 만든다 ──
       · 이미 짝지어진 시트 행은 건너뛴다
       · 앱에 이름이 비슷한 현장(휴지통 포함)이 있으면 만들지 않는다 → 사람이 설정에서 연결
       · "앱 전용" 으로 지정된 것도 건너뛴다 */
    const takenRows = new Set(Object.values(sheetMatch.map).map(m => String(m.row.row)));
    const matchedIds = new Set(Object.keys(sheetMatch.map)); /* 이미 시트 행과 짝지어진 앱 현장 */
    /* 이름별로 "아직 짝 없는 앱 현장이 있는지" — 있으면 사람이 연결해야 하니 만들지 않는다.
       같은 이름이라도 전부 짝지어져 있으면(예: 같은 학교 두 번째 계약) 새로 만든다. */
    /* 시트가 담은 반기(26년 하반기)만 본다 — 다른 반기의 같은 학교는 다른 계약이니 상관없다 */
    const unmatchedNames = new Set(),
      allNos = new Set();
    toArr(db[SHEET_YEAR] && db[SHEET_YEAR][SHEET_HALF]).forEach(x => {
      if (!x || !x.school) return;
      if (!x.deleted && !matchedIds.has(x.id)) unmatchedNames.add(normName(x.school));
      /* 이미 다른 행에 붙은 현장의 No. 는 소모된 것 — 짝 없는 현장의 No. 만 차단 근거로 */
      if (x.no && !matchedIds.has(x.id)) allNos.add(String(x.no).trim());
    });
    const toCreate = [];
    sheet.sites.forEach(r => {
      if (takenRows.has(String(r.row))) return;
      if (!r.school) return;
      if (unmatchedNames.has(normName(r.school))) return; /* 짝 없는 같은 이름이 앱에 있다 → 사람이 연결 */
      if (r.no && allNos.has(String(r.no).trim())) return; /* 같은 No. 가 앱에 있다 → 이름만 바뀐 것, 만들지 않음 */
      const fl = flow[`${r.region}|${r.school}`];
      toCreate.push(siteFromSheetRow(r, fl ? fl.steps : null, SHEET_YEAR, SHEET_HALF));
    });
    if (toCreate.length) {
      setSheetChanges(prev => [...toCreate.map(c => ({
        kind: "새로 추가",
        school: `${c.region} ${c.school}`.trim(),
        row: "앱에 생성"
      })), ...prev].slice(0, 200));
      logAction("추가", `시트에서 새 현장 ${toCreate.length}건 자동 생성`, null, toCreate.map(c => c.school).join(", "));
    }

    if (!Object.keys(patch).length && !toCreate.length) return;

    setDb(prev => {
      const out = {
        ...prev
      };
      let changed = false;
      /* ① 기존 현장에 시트 값 반영 — 먼저 한다 */
      Object.entries(prev).forEach(([yr, halves]) => {
        Object.entries(halves || {}).forEach(([half, list]) => {
          const arr = toArr(list);
          let touched = false;
          const nl = arr.map(x => {
            if (!x || !patch[x.id]) return x;
            touched = true;
            return stampEdit({
              ...x,
              ...patch[x.id]
            }, "시트에서 자동 반영");
          });
          if (touched) {
            out[yr] = {
              ...(out[yr] || {})
            };
            out[yr][half] = nl;
            changed = true;
          }
        });
      });
      /* ② 새 현장 붙이기 — ①이 끝난 뒤에. 앞에 하면 ①이 그 반기를 덮어써서 새 현장이 사라진다 */
      if (toCreate.length) {
        out[SHEET_YEAR] = {
          ...(out[SHEET_YEAR] || {})
        };
        const cur = toArr(out[SHEET_YEAR][SHEET_HALF]);
        out[SHEET_YEAR][SHEET_HALF] = [...cur, ...toCreate];
        changed = true;
      }
      return changed ? out : prev;
    });
  }, [sheet, sheetMatch, syncMap]); // eslint-disable-line

  /* 시트와 짝지어진 현장인지 — 수정창에서 착수·조사·완수일을 잠글 때 쓴다 */
  useEffect(() => {
    window.__stonSheetLinked = siteId => !!(sheetMatch && sheetMatch.map[siteId]);
    return () => {
      delete window.__stonSheetLinked;
    };
  }, [sheetMatch]);

  const urgent = allSchools.filter(s => {
    const d = calcDday(s.end);
    return d !== null && d < 0 && d >= -7;
  });
  /* 관리자만 엑셀 관리·설정을 볼 수 있다.
     단 관리자가 한 명도 없는 최초 상태에서는 설정만 열어둔다 — 첫 관리자를 지정해야 하므로. */
  const isOwner = !!authUser && isOwnerEmail(authUser.email);
  const canSettings = OWNER_EMAIL ? isOwner : isAdmin; // 총관리자 미지정이면 기존 동작
  const menus = MENUS.filter(m => m.id === "settings" ? canSettings : m.id === "export" ? isAdmin : true);
  const pages = {
    schedule: /*#__PURE__*/React.createElement(Calendar, {
      allSchools: allSchools,
      setDb: setDb,
      isMobile: isMobile,
      notes: notes,
      isAdmin: isAdmin,
      editor: editor
    }),
    sites: /*#__PURE__*/React.createElement(SitesManager, {
      db: db,
      setDb: setDb,
      isMobile: isMobile
    }),
    map: /*#__PURE__*/React.createElement(MapPage, {
      db: db,
      setDb: setDb,
      allSchools: allSchools,
      kakaoKey: kakaoKey,
      isMobile: isMobile
    }),
    board: /*#__PURE__*/React.createElement(BoardPage, {
      editor: editor,
      isMobile: isMobile
    }),
    reports: /*#__PURE__*/React.createElement(ReportsPage, {
      db: db,
      setDb: setDb,
      isMobile: isMobile
    }),
    export: isAdmin && /*#__PURE__*/React.createElement(ExportImportPage, {
      db: db,
      setDb: setDb,
      saveNow: saveNow,
      notes: notes
    }),
    settings: canSettings && /*#__PURE__*/React.createElement(SettingsPage, {
      sheetMatch: sheetMatch,
      sheetErr: sheetErr,
      sheetBusy: sheetBusy,
      sheetAt: sheetAt,
      onSheetReload: loadSheet,
      onSheetPick: (siteId, rowNo) => {
        firebase.database().ref(`${FB_SYNC}/${siteId}`).set(rowNo).then(() => showToast("연결했습니다 · 5분 안에 시트 값이 반영됩니다")).catch(e => window.alert("연결 저장 실패 — 관리자만 연결할 수 있습니다.\n" + (e && e.message || e)));
      },
      cfgVer: cfgVer,
      logs: logs,
      editor: editor,
      authUser: authUser,
      onLogout: logout,
      onResetAll: resetAll,
      db: db,
      setDb: setDb,
      saveNow: saveNow,
      kakaoKey: kakaoKey,
      isMobile: isMobile,
      online: online,
      fbStatus: fbStatus,
      lastSync: lastSync,
      meta: meta,
      users: users,
      isAdmin: isAdmin,
      adminCount: adminCount,
      accounts: accounts
    })
  };

  /* 인증 게이트 */
  if (authUser === undefined) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        fontFamily: F
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 26,
        fontWeight: 800,
        color: C.t1
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.blue
      }
    }, "◈"), " STON"), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 30,
        height: 30,
        border: `3px solid ${C.border}`,
        borderTopColor: C.blue,
        borderRadius: "50%",
        animation: "spin .8s linear infinite"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: C.t3
      }
    }, "불러오는 중…"), /*#__PURE__*/React.createElement("style", null, `@keyframes spin{to{transform:rotate(360deg)}}`));
  }
  if (!authUser) return /*#__PURE__*/React.createElement(LoginScreen, null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: F,
      background: C.bg,
      minHeight: "100vh",
      display: "flex",
      color: C.t1,
      fontSize: 15
    }
  }, sheetChanges.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9000,
      background: C.surface,
      borderTop: `2px solid ${C.blue}`,
      boxShadow: "0 -4px 20px rgba(0,0,0,.14)",
      maxHeight: showChanges ? "60vh" : "auto",
      overflowY: showChanges ? "auto" : "visible"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setShowChanges(v => !v),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      padding: "11px 14px",
      cursor: "pointer",
      background: C.blueL,
      borderBottom: showChanges ? BD : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16
    }
  }, "🔄"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 800,
      color: C.blue
    }
  }, "시트에서 ", sheetChanges.length, "건이 바뀌었습니다"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      padding: "5px 11px",
      borderRadius: 7,
      border: `1px solid ${C.blue}45`,
      background: C.surface,
      color: C.blue,
      fontSize: 12,
      fontWeight: 800
    }
  }, showChanges ? "접기" : "보기"), /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      setSheetChanges([]);
      setShowChanges(false);
    },
    style: {
      padding: "5px 11px",
      borderRadius: 7,
      border: BD,
      background: C.surface,
      color: C.t3,
      fontSize: 12,
      fontWeight: 800
    }
  }, "닫기"))), showChanges && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 14px 14px"
    }
  }, sheetChanges.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 10px",
      marginBottom: 5,
      borderRadius: 7,
      background: C.surfaceL,
      border: BD,
      borderLeft: `3px solid ${c.kind === "새로 추가" ? C.green : c.kind === "시트에서 사라짐" ? C.red : C.blue}`,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 800,
      color: C.t1,
      minWidth: 130
    }
  }, c.school), c.kind === "바뀜" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t3,
      minWidth: 70,
      fontWeight: 700
    }
  }, c.field), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t4,
      textDecoration: "line-through"
    }
  }, c.before), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t4
    }
  }, "→"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.blue,
      fontWeight: 800
    }
  }, c.after)) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: c.kind === "새로 추가" ? C.green : C.red,
      fontWeight: 800
    }
  }, c.kind === "새로 추가" ? "✚ 시트에 새로 추가됨" : "✕ 시트에서 사라짐"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      fontSize: 12,
      color: C.t4
    }
  }, c.row, "행"))))), /*#__PURE__*/React.createElement("style", null, `*{box-sizing:border-box}html,body{overflow-x:hidden;max-width:100%}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:${C.surfaceL}}::-webkit-scrollbar-thumb{background:${C.borderD};border-radius:4px}input::placeholder,textarea::placeholder{color:${C.t4}}button{cursor:pointer;transition:all .12s}button:hover{opacity:.85}input,textarea,select{max-width:100%}input[type="date"]{color-scheme:light}@keyframes spin{to{transform:rotate(360deg)}}
/* ── 휴대폰 ── iOS는 글자 16px 미만 입력칸을 누르면 화면을 확대해버린다 → 16px 고정으로 막는다 */
@media(max-width:819px){
  input,textarea,select{font-size:16px !important}
  input[type="date"]{min-height:44px}
  button,a,label,input,textarea,select{touch-action:manipulation}
  button,a{-webkit-tap-highlight-color:rgba(29,111,242,.14)}
}`), !loaded && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: C.bg,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 800,
      color: C.t1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.blue
    }
  }, "◈"), " STON"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      border: `3px solid ${C.border}`,
      borderTopColor: C.blue,
      borderRadius: "50%",
      animation: "spin .8s linear infinite"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.t3
    }
  }, "Firebase 실시간 데이터 불러오는 중…")), isMobile && sideOpen && /*#__PURE__*/React.createElement("div", {
    onClick: () => setSideOpen(false),
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(20,25,40,.45)",
      zIndex: 99
    }
  }), /*#__PURE__*/React.createElement("aside", {
    style: {
      width: sideOpen ? isMobile ? 280 : 214 : 0,
      minWidth: sideOpen ? isMobile ? 280 : 214 : 0,
      maxWidth: "85vw",
      background: C.surface,
      borderRight: BD,
      overflow: "hidden",
      transition: "width .22s,min-width .22s",
      position: "fixed",
      top: 0,
      left: 0,
      height: "100vh",
      zIndex: 100,
      display: "flex",
      flexDirection: "column",
      boxShadow: sideOpen ? "2px 0 16px rgba(0,0,0,.12)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: isMobile ? 280 : 214,
      maxWidth: "85vw",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 18px 14px",
      paddingTop: "calc(20px + env(safe-area-inset-top))",
      borderBottom: BD,
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 800,
      color: C.t1,
      letterSpacing: -.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.blue
    }
  }, "◈"), " STON"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginTop: 2,
      letterSpacing: 2,
      fontWeight: 600
    }
  }, "현장조사팀")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSideOpen(false),
    style: {
      background: "transparent",
      border: "none",
      color: C.t4,
      fontSize: 19,
      padding: "2px 4px"
    }
  }, "☰"))), /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: 1,
      padding: "8px 0",
      overflowY: "auto"
    }
  }, menus.slice(0, 2).map(m => /*#__PURE__*/React.createElement("button", {
    key: m.id,
    onClick: () => setMenu(m.id),
    style: {
      width: "calc(100% - 16px)",
      margin: "1px 8px",
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "11px 12px",
      background: menu === m.id ? C.blueL : "transparent",
      border: "none",
      color: menu === m.id ? C.blue : C.t2,
      fontSize: 15,
      fontWeight: menu === m.id ? 700 : 500,
      textAlign: "left",
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16
    }
  }, m.icon), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, m.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: C.border,
      margin: "8px 14px"
    }
  }), menus.slice(2).map(m => /*#__PURE__*/React.createElement("button", {
    key: m.id,
    onClick: () => setMenu(m.id),
    style: {
      width: "calc(100% - 16px)",
      margin: "1px 8px",
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 12px",
      background: menu === m.id ? C.blueL : "transparent",
      border: "none",
      color: menu === m.id ? C.blue : C.t3,
      fontSize: 14,
      fontWeight: menu === m.id ? 700 : 400,
      textAlign: "left",
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15
    }
  }, m.icon), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, m.label), m.id === "urgent" && urgent.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      background: C.red,
      color: "#fff",
      fontSize: 12,
      fontWeight: 700,
      padding: "1px 5px",
      borderRadius: 10
    }
  }, urgent.length)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 16px",
      borderTop: BD
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginBottom: 8,
      letterSpacing: 1,
      fontWeight: 700
    }
  }, "연도별 현장"), Object.entries(db).sort((a, b) => b[0] - a[0]).map(([y, hs]) => /*#__PURE__*/React.createElement("div", {
    key: y,
    style: {
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.t2,
      marginBottom: 3
    }
  }, y, "년"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 5
    }
  }, Object.entries(hs).map(([h, ss]) => /*#__PURE__*/React.createElement("div", {
    key: h,
    style: {
      fontSize: 12,
      color: h === "상반기" ? C.blue : C.orange,
      background: h === "상반기" ? C.blueL : C.orangeL,
      padding: "2px 7px",
      borderRadius: 5,
      fontWeight: 600
    }
  }, h === "상반기" ? "🌱" : "🍂", " ", ss.length)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "4px 16px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      padding: "7px 9px",
      background: C.surfaceL,
      borderRadius: 7,
      border: BD
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      fontSize: 12,
      color: C.t2,
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: "50%",
      background: users > 0 ? C.green : C.t4
    }
  }), "동시 접속 ", users, "명"), meta?.at && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t3,
      marginTop: 4,
      whiteSpace: "normal",
      lineHeight: 1.4
    }
  }, "마지막 수정 · ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.t2
    }
  }, meta.by || "익명"), "님 ", fmtMeta(meta.at))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, mappedName ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 10px",
      background: C.blueL,
      border: `1px solid ${C.blue}30`,
      borderRadius: 7,
      fontSize: 13,
      fontWeight: 800,
      color: C.blue,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, "👤 ", mappedName) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("select", {
    value: editor,
    onChange: e => saveName(e.target.value),
    style: {
      width: "100%",
      padding: "6px 8px",
      background: C.surface,
      border: BD,
      borderRadius: 6,
      color: editor ? C.t1 : C.t4,
      fontSize: 13,
      outline: "none",
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "내 이름 선택 (수정 기록용)"), allMembers().map(n => /*#__PURE__*/React.createElement("option", {
    key: n,
    value: n
  }, n))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginTop: 4,
      whiteSpace: "normal",
      lineHeight: 1.5
    }
  }, "이 계정에 연결된 이름이 없어요. 관리자가 설정 → 계정 연결에서 등록하면 자동으로 채워집니다."))), /*#__PURE__*/React.createElement("div", {
    onClick: loadSheet,
    title: sheetErr || "눌러서 새로고침",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "7px 9px",
      marginTop: 8,
      borderRadius: 7,
      cursor: "pointer",
      background: sheetErr ? C.redL : C.surfaceL,
      border: `1px solid ${sheetErr ? C.red + "40" : C.border}`,
      fontSize: 12,
      color: sheetErr ? C.red : C.t3,
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      flexShrink: 0,
      background: sheetBusy ? C.orange : sheetErr ? C.red : C.green
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, sheetBusy ? "시트 확인 중…" : sheetErr ? "시트 연결 실패" : sheetMatch ? `시트 ${sheetMatch.matched}/${sheetMatch.target} 연동` : "시트 대기 중"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      opacity: .8
    }
  }, "⟳")), sheetMatch && sheetMatch.unmatched.length > 0 && /*#__PURE__*/React.createElement("div", {
    onClick: () => setMenuRaw("settings"),
    style: {
      padding: "6px 9px",
      marginTop: 7,
      borderRadius: 7,
      cursor: "pointer",
      background: C.orangeL,
      border: `1px solid ${C.orange}40`,
      fontSize: 12,
      color: C.orange,
      fontWeight: 800
    }
  }, "⚠ 짝을 못 찾은 현장 ", sheetMatch.unmatched.length), /*#__PURE__*/React.createElement("details", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("summary", {
    style: {
      padding: "8px 2px",
      fontSize: 13,
      fontWeight: 700,
      color: C.t3,
      cursor: "pointer"
    }
  }, "계정 · 알림"), /*#__PURE__*/React.createElement("button", {
    onClick: enablePush,
    style: {
      width: "100%",
      marginTop: 7,
      padding: "7px 8px",
      borderRadius: 7,
      border: `1px solid ${C.blue}40`,
      background: C.blueL,
      color: C.blue,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 5
    }
  }, "🔔 알림 켜기"), authUser && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 7,
      paddingTop: 8,
      borderTop: BD
    }
  }, authUser.email && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginBottom: 5,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, authUser.email), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (window.confirm("로그아웃할까요?\n다시 쓰려면 이메일과 비밀번호로 로그인해야 합니다.")) logout();
    },
    style: {
      width: "100%",
      padding: "9px 8px",
      borderRadius: 7,
      border: `1px solid ${C.border}`,
      background: "transparent",
      color: C.t2,
      fontSize: 13,
      fontWeight: 800,
      cursor: "pointer"
    }
  }, "🚪 로그아웃")))))), /*#__PURE__*/React.createElement("main", {
    style: {
      marginLeft: isMobile ? 0 : sideOpen ? 214 : 0,
      flex: 1,
      transition: "margin .22s",
      display: "flex",
      flexDirection: "column",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      height: "auto",
      minHeight: 52,
      background: C.surface,
      borderBottom: BD,
      display: "flex",
      alignItems: "center",
      padding: isMobile ? "0 14px" : "0 22px",
      paddingTop: "env(safe-area-inset-top)",
      boxSizing: "content-box",
      gap: 12,
      position: "sticky",
      top: 0,
      zIndex: 50
    }
  }, !isMobile && /*#__PURE__*/React.createElement("button", {
    onClick: () => setSideOpen(v => !v),
    style: {
      width: 34,
      height: 34,
      borderRadius: 8,
      background: C.surfaceL,
      border: BD,
      color: C.t2,
      fontSize: 18,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      flexShrink: 0
    }
  }, "☰", !sideOpen && urgent.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: -4,
      right: -4,
      background: C.red,
      color: "#fff",
      fontSize: 12,
      fontWeight: 700,
      padding: "1px 4px",
      borderRadius: 8
    }
  }, urgent.length)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: C.t1
    }
  }, menus.find(m => m.id === menu)?.icon, " ", menus.find(m => m.id === menu)?.label), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: loadSheet,
    disabled: sheetBusy,
    title: sheetErr ? "시트 연결 실패 — " + sheetErr : sheetAt ? "마지막 확인 " + new Date(sheetAt).toLocaleTimeString("ko-KR") + " · 눌러서 지금 받기" : "시트에서 최신 내용 받기",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      padding: isMobile ? "6px 9px" : "6px 12px",
      marginRight: 7,
      borderRadius: 8,
      cursor: sheetBusy ? "default" : "pointer",
      border: `1px solid ${sheetErr ? C.red + "50" : C.border}`,
      background: sheetErr ? C.redL : C.surface,
      color: sheetErr ? C.red : C.t2,
      fontSize: 13,
      fontWeight: 700,
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      fontSize: 14,
      animation: sheetBusy ? "spin 1s linear infinite" : "none"
    }
  }, "⟳"), isMobile ? null : sheetBusy ? "받는 중…" : sheetErr ? "시트 실패" : "시트 새로고침"), !isMobile && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t3
    }
  }, "기준일 ", todayStr(), " · 연도/반기별 분리"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexShrink: 0,
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      fontSize: 12,
      fontWeight: 700,
      color: online ? C.green : fbStatus === "연결 중..." ? C.orange : C.t3
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: online ? C.green : fbStatus === "연결 중..." ? C.orange : C.t4,
      boxShadow: online ? `0 0 6px ${C.green}` : "none"
    }
  }), online ? "실시간 연결됨" : fbStatus), syncing && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.blue,
      fontWeight: 600,
      marginLeft: "auto"
    }
  }, "저장 중…"), !syncing && online && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginLeft: "auto"
    }
  }, "✓ 저장됨"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: isMobile ? 14 : 22,
      paddingBottom: isMobile ? `calc(${TAB_H + 22}px + env(safe-area-inset-bottom))` : 22,
      overflowY: "auto",
      flex: 1
    }
  }, pages[menu])), isMobile && /*#__PURE__*/React.createElement(BottomTabs, {
    menu: menu,
    setMenu: setMenu,
    urgentCount: urgent.length,
    onMore: () => setSideOpen(true)
  }));
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
