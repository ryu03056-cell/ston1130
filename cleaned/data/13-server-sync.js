/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 13/18 — 서버 자료 주고받기  (data/13-server-sync.js)
   │ 메모 일정 종류, 알림 보내기, 자동 백업, 되돌리기 기록, 수정 내역, 서버 자료 ↔ 앱 자료 변환, 현장 기본 순서
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
/* 메모 일정 종류 — 현장 점검과 구분되는 부가 일정 */
const NOTE_KINDS = [{
  v: "일반",
  color: "#5C6879"
}, {
  v: "휴가",
  color: "#1D6FF2"
}, {
  v: "반차",
  color: "#0D9B6C"
}, {
  v: "회의",
  color: "#7C3AED"
}];
const noteColor = k => (NOTE_KINDS.find(x => x.v === k) || NOTE_KINDS[0]).color;
/* 메모가 걸리는 날짜들 — 현장조사와 같은 방식(기간 + 따로 떨어진 날) */
const noteDates = n => {
  const out = [];
  const f = n && n.date;
  if (!f) return out;
  out.push(f);
  const fe = n && n.dateEnd;
  if (fe && fe > f) {
    let d = addDays(parseD(f), 1);
    const last = parseD(fe);
    let guard = 0;
    while (d <= last && guard++ < 120) {
      out.push(dstr(d));
      d = addDays(d, 1);
    }
  }
  toArr(n && n.extra).forEach(d => {
    if (d && !out.includes(d)) out.push(d);
  });
  return out.sort();
};

/* 푸시 알림 — OneSignal (Cloudflare Worker 경유, 본인 제외 전송) */
function registerOneSignal(userName) {
  if (!window.OneSignalDeferred) return;
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.Notifications.requestPermission();
      await OneSignal.login(userName || "익명");
      await OneSignal.User.addTag("username", userName || "익명");
    } catch (e) {
      console.warn("OneSignal 등록 실패:", e.message);
    }
  });
}
function sendPush(title, body) {
  try {
    fetch(PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title,
        body,
        sender: CURRENT_USER.name || ""
      })
    }).catch(() => {});
  } catch {}
}


/* 현재 로그인 사용자 (로그 기록용) */
let CURRENT_USER = {
  uid: null,
  email: null,
  name: ""
};

/* 수정 로그 한 건 기록 */
/* ══════════════════════════════════════════════════════════════
   안전장치 — 스냅샷(전체 백업) / 되돌리기 기록
   ══════════════════════════════════════════════════════════════ */
const BK_KEEP = 30; // 백업 보관 개수

/* 반기별 건수 요약 — 목록에서 "뭐가 들어있는 백업인지" 보여주기 위함 */
function bucketCounts(db) {
  const out = {};
  Object.entries(db || {}).forEach(([y, hs]) => Object.entries(hs || {}).forEach(([h, arr]) => {
    out[`${y} ${h}`] = (arr || []).length;
  }));
  return out;
}

/* 전체 데이터를 통째로 복사해 둔다. reason 예: "엑셀 가져오기 전", "자동(하루 1회)" */
async function makeSnapshot(db, reason) {
  if (typeof firebase === "undefined" || !firebase.apps.length) throw new Error("Firebase 미연결");
  const id = String(Date.now());
  const meta = {
    at: Date.now(),
    by: typeof CURRENT_USER !== "undefined" && (CURRENT_USER.name || CURRENT_USER.email) || "알수없음",
    reason: String(reason || "수동 백업").slice(0, 40),
    cnt: countSchools(db),
    buckets: bucketCounts(db)
  };
  await firebase.database().ref(`${FB_BK_DAT}/${id}`).set(stripUndefined(dbToFb(db)));
  await firebase.database().ref(`${FB_BK_IDX}/${id}`).set(meta);
  /* 오래된 백업 정리 */
  try {
    const snap = await firebase.database().ref(FB_BK_IDX).once("value");
    const ids = Object.keys(snap.val() || {}).sort((a, b) => Number(b) - Number(a));
    for (const old of ids.slice(BK_KEEP)) {
      firebase.database().ref(`${FB_BK_DAT}/${old}`).remove().catch(() => {});
      firebase.database().ref(`${FB_BK_IDX}/${old}`).remove().catch(() => {});
    }
  } catch {}
  return {
    id,
    ...meta
  };
}

/* 변경 하나하나를 되돌릴 수 있게 기록. 대량 변경(가져오기 등)은 스냅샷이 담당하므로 제외 */
const UNDO_KEEP = 60;
function pushUndo(entries) {
  if (!entries.length || entries.length > 20) return;
  try {
    const ref = firebase.database().ref(FB_UNDO);
    const by = typeof CURRENT_USER !== "undefined" && (CURRENT_USER.name || CURRENT_USER.email) || "알수없음";
    entries.forEach(e => ref.push({
      at: Date.now(),
      by,
      path: e.path,
      before: e.before == null ? null : stripUndefined(e.before),
      after: e.after == null ? null : stripUndefined(e.after),
      label: e.label || ""
    }).catch(() => {}));
    /* 오래된 기록 정리 */
    ref.once("value").then(sn => {
      const v = sn.val() || {};
      const keys = Object.keys(v).sort((a, b) => (v[a].at || 0) - (v[b].at || 0));
      keys.slice(0, Math.max(0, keys.length - UNDO_KEEP)).forEach(k => ref.child(k).remove().catch(() => {}));
    }).catch(() => {});
  } catch {}
}
function logAction(action, target, before, after) {
  try {
    if (typeof firebase === "undefined" || !firebase.apps.length) return;
    firebase.database().ref(FB_LOGS).push({
      action,
      // 추가 / 수정 / 삭제
      target: String(target || ""),
      // 대상(학교/항목)
      before: before == null ? "" : (typeof before === "string" ? before : JSON.stringify(before)).slice(0, 500),
      after: after == null ? "" : (typeof after === "string" ? after : JSON.stringify(after)).slice(0, 500),
      by: CURRENT_USER.name || CURRENT_USER.email || "알수없음",
      email: CURRENT_USER.email || "",
      uid: CURRENT_USER.uid || "",
      ts: Date.now()
    }).catch(() => {});
  } catch {}
}

/* 새 팀 색상 팔레트 */

/* 항상 존재해야 하는 기본 5개 팀 */

/* 계정(이메일) → 실명 매핑.
   Firebase 키에 . 을 쓸 수 없어 이메일을 안전한 문자로 바꿔 저장한다.
   화면에는 이름만 보이고 이메일·UID는 기록용으로만 남는다. */
/* 이메일을 Firebase 키로 — 규칙에서도 email.lower().replace('.','_').replace('@','_') 로 같은 값을 만든다 */
const emailKey = e => String(e || "").trim().toLowerCase().replace(/\./g, "_").replace(/@/g, "_");
let ACCOUNTS = {};
let ADMINS = {};
const nameOfEmail = e => (ACCOUNTS[emailKey(e)] || {}).name || "";
/* 로그인 계정이 없는 현장 인원도 등록할 수 있게 — 이메일이 없으면 이름으로 키를 만든다 */
const entryKey = (email, name) => String(email || "").trim() ? emailKey(email) : "n_" + String(name || "").trim().replace(/[.@#$\[\]\/\s]/g, "_");

/* Firebase config → 인원 명단(MEMBERS) 갱신 */
function applyConfig(cfg) {
  if (!cfg) return;
  ACCOUNTS = cfg.accounts || {};
  const flat = [];
  const push = n => {
    const nm = String(n || "").trim();
    if (nm && !flat.includes(nm)) flat.push(nm);
  };
  /* 인원 명단 = 등록된 사람 목록. 아직 등록이 하나도 없으면 예전 members 를 그대로 쓴다
     (등록을 마치기 전에 담당자 배정이 막히지 않도록) */
  RANK_OF = {};
  Object.values(ACCOUNTS).forEach(a => {
    if (a && a.name) {
      push(a.name);
      if (a.rank) RANK_OF[a.name] = a.rank;
    }
  });
  if (!flat.length && cfg.members) {
    if (Array.isArray(cfg.members)) cfg.members.forEach(push);else if (typeof cfg.members === "object") Object.values(cfg.members).forEach(v => toArr(v).forEach(push));
  }
  if (flat.length) {
    MEMBERS.length = 0;
    /* 직급 순 → 같은 직급이면 이름 순 */
    flat.sort(byRank).forEach(n => MEMBERS.push(n));
  }
}


/* 현장 기본 순서 — 관리번호 순, 번호가 없는 현장은 맨 뒤, 같으면 id 순.
   (정리본 수정) 예전 규칙은 번호 없는 현장이 끼면 A<B, B<C 인데 C<A 가 되는 모순이 생겨
   현장 하나만 추가·삭제돼도 다른 현장 100여 곳의 순서가 바뀌었다. */
function bySiteNo(a, b) {
  const ka = parseInt(a.no, 10),
    kb = parseInt(b.no, 10);
  const na = isNaN(ka) ? Infinity : ka,
    nb = isNaN(kb) ? Infinity : kb;
  if (na !== nb) return na < nb ? -1 : 1;
  return String(a.id).localeCompare(String(b.id));
}

/* Firebase(키잉 객체) → 화면용 배열 db */
function fbToDb(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  Object.entries(raw).forEach(([yr, halves]) => {
    out[yr] = {};
    Object.entries(halves || {}).forEach(([half, schoolsObj]) => {
      out[yr][half] = toArr(schoolsObj).filter(Boolean).map(s => ({
        ...s,
        assignees: toArr(s.assignees),
        buildings: toArr(s.buildings).filter(Boolean),
        /* Firebase 는 배열을 {0:…,1:…} 객체로 돌려준다.
           배열로 되돌리지 않으면 새로고침 후 값이 사라지거나 오류가 난다. */
        fieldExtra: toArr(s.fieldExtra).filter(Boolean),
        fieldWho: (() => {
          const w = s.fieldWho;
          if (!w || typeof w !== "object") return null;
          const o = {};
          Object.entries(w).forEach(([d, v]) => {
            o[d] = toArr(v).filter(Boolean);
          });
          return Object.keys(o).length ? o : null;
        })(),
        /* 동별 담당도 배열로 되돌린다 — 빠뜨리면 새로고침 뒤 배정이 사라진다 */
        bldWho: (() => {
          const w = s.bldWho;
          if (!w || typeof w !== "object") return null;
          const o = {};
          Object.entries(w).forEach(([k, v]) => {
            const a = toArr(v).filter(Boolean);
            if (a.length) o[k] = a;
          });
          return Object.keys(o).length ? o : null;
        })(),
        flags: toArr(s.flags).filter(Boolean)
      })).sort(bySiteNo);
    });
  });
  return out;
}

/* 화면용 배열 db → Firebase(키잉 객체) — 초기 시드용 */
function dbToFb(db) {
  const out = {};
  Object.entries(db).forEach(([yr, halves]) => {
    out[yr] = {};
    Object.entries(halves).forEach(([half, schools]) => {
      out[yr][half] = {};
      schools.forEach(s => {
        out[yr][half][s.id] = stripUndefined(s);
      });
    });
  });
  return out;
}

/* 두 db를 학교 단위로 비교 → 변경된 경로만 추출 (부분 저장용)
   결과: { "2026/상반기/26u1": {school} | null(삭제) } */
/* Firebase는 undefined 값을 거부(전체 저장 실패) → 재귀적으로 제거 */
function stripUndefined(v) {
  if (Array.isArray(v)) return v.map(stripUndefined);
  if (v && typeof v === "object") {
    const o = {};
    for (const k in v) {
      if (v[k] === undefined) continue;
      /* Firebase 키 금지 문자(. $ # [ ] / 와 제어문자) → _ 로 치환해야 저장이 거부되지 않음 */
      const safeK = String(k).replace(/[.$#\[\]\/\u0000-\u001F\u007F]/g, "_");
      o[safeK] = stripUndefined(v[k]);
    }
    return o;
  }
  if (typeof v === "number" && !isFinite(v)) return null; // NaN/Infinity → null (Firebase가 거부 → 전체 저장 실패 방지)
  return v;
}
function countSchools(db) {
  let n = 0;
  Object.values(db || {}).forEach(hs => Object.values(hs || {}).forEach(a => {
    n += (a || []).length;
  }));
  return n;
}

/* 두 db를 학교 단위로 비교 → 바뀐 경로만 추출 (부분 저장).
   - 추가/수정된 학교: "yr/half/id" → 학교객체
   - 삭제된 학교(이전엔 있었는데 지금 없음): "yr/half/id" → null (명시적 삭제)
   전체 트리를 .set()으로 덮어쓰지 않으므로, 다른 기기가 모르는 데이터(예: 다른 기기가 추가한 하반기)를
   실수로 지우는 일이 없음. 삭제는 null로 명시 → 되살아나지 않음. */
function flatMapDb(db) {
  const m = {};
  const safe = s => String(s).replace(/[.$#\[\]\/\u0000-\u001F\u007F]/g, "_");
  Object.entries(db || {}).forEach(([yr, hs]) => Object.entries(hs || {}).forEach(([half, arr]) => {
    (arr || []).forEach(s => {
      if (s && s.id != null) m[`${safe(yr)}/${safe(half)}/${safe(s.id)}`] = s;
    });
  }));
  return m;
}
function diffPaths(prev, next) {
  const updates = {};
  const pm = flatMapDb(prev),
    nm = flatMapDb(next);
  for (const k in nm) {
    const cur = stripUndefined(nm[k]);
    if (!(k in pm) || JSON.stringify(stripUndefined(pm[k])) !== JSON.stringify(cur)) updates[k] = cur;
  }
  for (const k in pm) {
    if (!(k in nm)) updates[k] = null;
  } // 삭제 → null
  return updates;
}
