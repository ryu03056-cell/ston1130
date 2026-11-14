/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 01/18 — 기본 설정  (core/01-config.js)
   │ 총관리자 이메일, 색상표, 직원·직급, 시설물 분류, 납품 판정, 중복 현장 정리, 지도·길찾기 보조 기능, 진행 단계, 메뉴 목록
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
const { useState, useMemo, useCallback, useRef, useEffect } = React;

/* ══════════════════════════════════════════════════════════════
   ★ 총관리자 이메일 ★  ← 여기 한 줄만 본인 이메일로 바꾸면 됩니다

   이 계정만 '설정'에 들어갈 수 있고, 다른 누구도 이 계정의 권한을
   해제하거나 명단에서 지울 수 없습니다.
   같은 값을 Firebase 규칙에도 넣어야 서버에서도 실제로 막힙니다.
   비워 두면 기존처럼 '관리자'면 누구나 설정에 들어갑니다.
══════════════════════════════════════════════════════════════ */
const OWNER_EMAIL = "ryu03056@naver.com";

const isOwnerEmail = e => !!OWNER_EMAIL && String(e || "").trim().toLowerCase() === OWNER_EMAIL.trim().toLowerCase();

/* ══════════════════════════════════════════════════════════════
   STON — 시설물 정밀안전점검 현장 일정·관리 대시보드
   · 연도/반기별 현장 분리
   · 영구 캘린더 (드래그로 일정 변경 → 현장관리 자동 반영)
   · 팀(4팀) 색상 구분 + 팀원 배정
   · 엑셀 가져오기/내보내기 (원본 형식)
══════════════════════════════════════════════════════════════ */

/* 객체-키 ↔ 배열 변환.
   Firebase 는 배열을 {0:…,1:…} 객체로 돌려주므로 어디서든 이걸 거쳐 배열로 만든다. */
const toArr = v => Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];

/* 지역 → 학교명 순 — 같은 지역이 연속해서 나오게 (캘린더 칩·날짜 상세 공용) */
const byRegionThenName = (a, b) => {
  const ra = String(a.region || "").trim(),
    rb = String(b.region || "").trim();
  if (ra !== rb) {
    if (!ra) return 1; /* 지역 없는 건 맨 뒤 */
    if (!rb) return -1;
    return ra.localeCompare(rb, "ko");
  }
  return String(a.school || "").localeCompare(String(b.school || ""), "ko");
};

/* ── 색상 시스템 ── */
const C = {
  bg: "#F5F7FA",
  surface: "#FFFFFF",
  surfaceL: "#F7F9FB",
  surfaceD: "#ECEEF2",
  border: "#E1E6EE",
  borderD: "#C6CEDA",
  t1: "#1A2332",
  t2: "#3F4A5C",
  t3: "#5C6879",
  t4: "#67717F",
  team1: "#1D6FF2",
  team1b: "#EBF2FF",
  team1c: "#1058CC",
  team2: "#0A9260",
  team2b: "#E6F7F2",
  team2c: "#077A4F",
  team3: "#D93B2B",
  team3b: "#FDF0EE",
  team3c: "#B02E20",
  team4: "#7C3AED",
  team4b: "#F3EFFE",
  team4c: "#5B21B6",
  green: "#0D9B6C",
  greenL: "#E8F7F2",
  red: "#D93B2B",
  redL: "#FDF0EE",
  orange: "#E07A20",
  orangeL: "#FDF3E8",
  purple: "#7C3AED",
  purpleL: "#F3EFFE",
  blue: "#1D6FF2",
  blueL: "#EBF2FF",
  yellow: "#B58A00",
  yellowL: "#FDF8E8"
};

/* ── 인원 명단 (팀 구분 없이 전체 인원) ── */
const MEMBERS = ["한상오", "장민태", "채승준", "함예린", "김동영", "한범용", "권태민", "김유빈", "정도혁", "윤종현", "이동현", "관우남", "이준혁", "박서연", "최민준", "윤지현"];
const allMembers = () => MEMBERS.slice();

/* ── 직급 ──
   순서가 곧 정렬 우선순위. 같은 직급이면 이름 가나다순으로 정렬한다. */
const RANKS = ["대표", "상무", "이사", "차장", "팀장", "과장", "대리", "주임", "보조인원"];
let RANK_OF = {}; // 이름 → 직급
const rankIdx = nm => {
  const r = RANK_OF[nm];
  const i = RANKS.indexOf(r);
  return i < 0 ? RANKS.length : i; // 직급 미지정은 맨 뒤
};
const rankOf = nm => RANK_OF[nm] || "";
/* 직급 → 이름 순으로 정렬 */
const byRank = (a, b) => rankIdx(a) - rankIdx(b) || String(a).localeCompare(String(b), "ko");
const sortMembers = list => toArr(list).filter(Boolean).sort(byRank);

/* 인원별 고정 색상 — 이름 해시로 일관된 색을 주어 일정에서 구분이 쉽도록 */
/* 인원 색상 — 사람마다 다르게 하지 않고 검정으로 통일 (가독성 우선) */
const memberColor = () => C.t1;

/* 카테고리 — 학교 / LH 아파트 정밀점검을 구분해서 관리 */
const CAT_LH = "LH";
const isLH = yr => String(yr) === CAT_LH;

/* 시설물 분류 — 엑셀의 시설물 개수(건축물 / 토목(종) / 토목(소)) 집계에 쓰인다.
   값이 없는 예전 데이터는 건축물로 본다. */
const CATS = [{
  v: "건축",
  label: "건축물",
  short: "건축",
  color: "#1D6FF2"
}, {
  v: "토목종",
  label: "토목(종)",
  short: "토목종",
  color: "#0D9B6C"
}, {
  v: "토목소",
  label: "토목(소)",
  short: "토목소",
  color: "#B58A00"
}];
/* 동별 점검종류 — 실제 엑셀 C열에서 쓰이는 값들.
   정기는 대부분이라 달력에 표시하지 않는다. */
const BKINDS = [{
  v: "정기",
  label: "정기",
  color: "#5C6879",
  plain: true
}, {
  v: "정밀",
  label: "정밀",
  color: "#7C3AED"
}, {
  v: "내진",
  label: "내진",
  color: "#0D9B6C"
}, {
  v: "구조검토",
  label: "구조검토",
  color: "#1D6FF2"
}, {
  v: "성능평가",
  label: "성능평가",
  color: "#B58A00"
}, {
  v: "보강설계",
  label: "보강설계",
  color: "#D93B2B"
}];
const bkindColor = v => (BKINDS.find(x => x.v === v) || BKINDS[0]).color;
/* 학교 단위 kind 문자열에서 동별 기본값을 뽑는다 (기존 데이터 이관용) */
/* 시트 예시 칸("ex) 0825 김도경" · "예) …")은 안 한 것으로 본다 */
const isExampleVal = v => typeof v === "string" && /^\s*(ex\)|예\)|예시)/i.test(v);

/* ── 납품 ──
   우편 납품 담당: 이 이름들이 납품했으면 우편, 그 외(박두환·한상오·한의영·채승준·이동현 등)는 직납 */
const MAIL_DELIVERERS = ["함예린", "김유빈", "김도경"];

/* 워크플로우 "납품" 칸 ("0917함예린" · "0828 박두환" · "ex) 0825 김도경") 과
   시트 납품유무·납품방법·납품일 을 합쳐 하나로 정리한다.
   → { done, way: "우편"|"직납"|"", by, date } */
const parseDelivery = (r, flowSteps) => {
  /* 납품 판정 규칙 (2026-09 정정)
     · 완료 = 실제 기록이 있을 때만: 시트 납품유무 "완료" / 납품 칸 체크 / 납품 칸에 "0917함예린" 같은 기록(날짜가 오늘 이후면 아직 예정)
     · "ex) 0825 김도경" 은 시트 예시 문구 — 기록이 아니다
     · 납품방법(우편/직납)은 시트 '납품방법' 열에 적힌 것만 쓴다. 사람 이름으로 추측하지 않는다 */
  const rawV = flowSteps ? flowSteps["납품"] : null;
  const src = rawV === true ? "true" : String(rawV == null ? "" : rawV).trim();
  const isExample = /^ex\)/i.test(src);
  const checked = !isExample && /^true$/i.test(src);
  let raw = isExample ? "" : src;
  if (/^(false|true)$/i.test(raw)) raw = ""; /* 체크박스 값은 이름이 아니다 */
  const m = raw.match(/(\d{2})(\d{2})\s*(.*)$/);
  const okMD = !!m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31;
  const recDate = okMD ? `${SHEET_YEAR}-${m[1]}-${m[2]}` : "";
  const by = m ? m[3].trim() : raw.replace(/[\d\s]/g, "");
  let date = r.deliver || "";
  if (!date && recDate) date = recDate;
  const sheetWay = String(r.deliverW || "").trim();
  const way = sheetWay ? /우편/.test(sheetWay) ? "우편" : /직/.test(sheetWay) ? "직납" : sheetWay : "";
  const today = dstr(new Date());
  const recorded = checked || !!raw && (!recDate || recDate <= today);
  const done = /완료/.test(String(r.deliverY || "")) || recorded;
  return {
    done,
    way,
    by,
    date
  };
};

/* 현장의 납품 상태 한 줄 — 시트에서 온 것(deliverDone·deliverWay·deliverBy·deliverDate)을 우선,
   없으면 동별 납품 버튼(b.delivery)을 본다.
   → { state: "완료"|"예정"|"미정", way, by, date, label } */
const deliveryOf = s => {
  if (!s) return {
    state: "미정",
    way: "",
    by: "",
    date: "",
    label: "납품 미정"
  };
  if (s.deliverDone) { /* 실제 납품 기록이 있을 때만 완료 (방법만 적어둔 건 예정) */
    const way = s.deliverWay || "";
    const md = s.deliverDate ? s.deliverDate.slice(5).replace(/^0/, "").replace("-", "/").replace(/\/0/, "/") : "";
    return {
      state: "완료",
      way,
      by: s.deliverBy || "",
      date: s.deliverDate || "",
      label: [way || "납품", md, s.deliverBy].filter(Boolean).join(" ")
    };
  }
  if (s.deliverDate || s.deliverWay) {
    const md = s.deliverDate ? s.deliverDate.slice(5).replace(/^0/, "").replace("-", "/").replace(/\/0/, "/") : "";
    return {
      state: "예정",
      way: s.deliverWay || "",
      by: "",
      date: s.deliverDate || "",
      label: `${s.deliverWay || "납품"} 예정${md ? " " + md : ""}`
    };
  }
  const bs = toArr(s.buildings).filter(Boolean);
  const ways = [...new Set(bs.map(b => b.delivery).filter(Boolean))];
  if (ways.length && bs.every(b => b.delivery)) return {
    state: "완료",
    way: ways.join("·"),
    by: "",
    date: "",
    label: ways.join("·") + " (동별)"
  };
  return {
    state: "미정",
    way: "",
    by: "",
    date: "",
    label: "납품 미정"
  };
};

/* 토목 시설(옹벽·교량 등)인지 — 층수·연면적 대신 연장·높이를 보여준다 */
const isCivilB = b => /토목/.test(b && b.cat || "") || /옹벽|교량|터널|축대|담장|육교|암거/.test(b && b.b || "");

/* 시설물 치수 한 줄 — 건물은 "4층 2,500㎡", 토목은 "228m / 12.4m" (연장/높이) */
const bldSize = b => {
  if (!b) return "";
  if (isCivilB(b)) {
    const l = b.len != null && b.len !== "" ? `${Number(b.len).toLocaleString()}m` : "";
    const h = b.height != null && b.height !== "" ? `${Number(b.height).toLocaleString()}m` : "";
    return l && h ? `${l} / ${h}` : l || h;
  }
  const fl = b.floor ? `${b.floor}층` : "";
  const ar = b.area != null && b.area !== "" ? `${Number(b.area).toLocaleString()}㎡` : "";
  return [fl, ar].filter(Boolean).join(" ");
};

/* 시트 점검종류 → 동별 종류. "성능,정기"·"정밀,정기" 처럼 섞여 있으면 정기가 아닌 쪽을 고른다.
   시트에 짧게 쓴 것(성능·구조·보강)도 잡는다. */
const kindToBK = k => {
  const t = String(k || "");
  if (/정밀/.test(t)) return "정밀";
  if (/내진/.test(t)) return "내진";
  if (/구조/.test(t)) return "구조검토";
  if (/성능/.test(t)) return "성능평가";
  if (/보강/.test(t)) return "보강설계";
  return "정기";
};
const bldKind = b => {
  const v = b && b.kind;
  return BKINDS.some(x => x.v === v) ? v : null;
};
/* 이 현장에 걸린 점검종류들 — 정기는 빼고, 나온 순서대로 */
const siteKinds = s => {
  const out = [];
  (s && s.buildings || []).forEach(b => {
    const k = bldKind(b) || kindToBK(s && s.kind);
    if (k && k !== "정기" && !out.includes(k)) out.push(k);
  });
  return out;
};
const bldCat = b => {
  const c = b && b.cat;
  return c === "토목종" || c === "토목소" ? c : "건축";
};
/* 이름·종별로 분류 추정 — 엑셀에서 가져올 때 첫 값을 잡아준다 */
const guessCat = (name, jong) => {
  const t = `${name || ""}`;
  if (/옹벽|사면|석축|절토|성토|용벽/.test(t)) return /소규모|소규모시설/.test(`${jong || ""}`) ? "토목소" : "토목종";
  if (/교량|터널|지하차도|육교|배수로|암거/.test(t)) return "토목종";
  return "건축";
};
/* 학교의 시설물 개수 — [건축물, 토목(종), 토목(소)] */
const catCounts = s => {
  const out = {
    건축: 0,
    토목종: 0,
    토목소: 0
  };
  (s && s.buildings || []).forEach(b => {
    out[bldCat(b)]++;
  });
  return out;
};

/* 현장 표시(드론·1년·피난) — 학교 단위, 중복 선택 가능 */
const FLAG_OPTS = [{
  v: "드론",
  label: "🚁 드론",
  color: C.orange
}, {
  v: "1년",
  label: "📅 1년",
  color: C.blue
}, {
  v: "피난",
  label: "🚪 피난",
  color: C.purple
}];
/* 신규 현장 — 엑셀 A열 '점검회차'가 '신규'이면 표시.
   신규는 보고서 작성에 시간이 더 들어 눈에 띄어야 한다. */
/* 신규 현장 — 그 반기에 처음 들어온 곳.
   이월본(지난 반기에서 넘어온 것)은 신규가 아니다.
   이미 저장된 예전 이월본도 여기서 걸러지므로 데이터를 손댈 필요가 없다. */
const isNewSite = s => !!(s && !s.carried && (s.isNew || String(s.round || "").includes("신규")));

const getFlags = s => {
  if (s && s.flags && typeof s.flags === "object") {
    const a = toArr(s.flags).filter(Boolean);
    if (a.length || Array.isArray(s.flags)) return a;
  }
  /* 예전 데이터 호환: 동별 flag(●=드론)를 학교 단위로 합침 */
  const set = new Set();
  (s?.buildings || []).forEach(b => {
    if (!b || !b.flag) return;
    if (b.flag === "●" || b.flag === "드론") set.add("드론");else if (b.flag === "1년") set.add("1년");else if (b.flag === "피난") set.add("피난");
  });
  return [...set];
};
/* ══════════════════════════════════════════════════════════════
   중복 방지 — 같은 현장이 두 번 올라가지 않게 자동 정리
   · 학교명 표기 차이(여주고 / 여주고등학교 / 공백·괄호)를 같은 이름으로 인식
   · 단, 옹벽과 건물처럼 관리번호도 동도 다른 '별개 건'은 그대로 둔다
   ══════════════════════════════════════════════════════════════ */
const normSchool = v => String(v == null ? "" : v).replace(/\s+/g, "").replace(/[（]/g, "(").replace(/[）]/g, ")").replace(/[·・‧∙\-_.]/g, "").replace(/여자고등학교/g, "여고").replace(/여자중학교/g, "여중").replace(/초등학교/g, "초").replace(/중학교/g, "중").replace(/고등학교/g, "고").toLowerCase();
const bldKey = b => String(b && b.b || "").replace(/\s+/g, "").toLowerCase();

/* 같은 학교명 안에서 '같은 건'인지 판정 */
function isSameSite(a, b) {
  if (a.carried || b.carried) return true; // 이월본은 실제 데이터와 같은 건
  const na = String(a.no || "").trim(),
    nb = String(b.no || "").trim();
  if (na && nb && na === nb) return true; // 관리번호가 같음
  const sa = new Set((a.buildings || []).map(bldKey).filter(Boolean));
  const sb = new Set((b.buildings || []).map(bldKey).filter(Boolean));
  /* 동 구성이 완전히 같으면 같은 건 (번호만 다르게 두 번 적힌 경우) */
  if (sa.size && sa.size === sb.size && [...sa].every(x => sb.has(x))) return true;
  if (!na || !nb) {
    // 한쪽에 번호가 없는 '껍데기 행'
    if ([...sb].some(x => sa.has(x))) return true; // 동이 하나라도 겹치면 같은 건
    const shell = (x, set) => set.size <= 1 && (set.size === 0 || normSchool([...set][0]) === normSchool(x.school));
    if (shell(a, sa) || shell(b, sb)) return true; // 동명이 학교명뿐인 행
  }
  return false; // 번호도 동도 다르면 별개 건(옹벽/건물 등)
}

/* 동 목록 합치기 — 이름 기준 합집합, 값이 있는 쪽을 채택 */
function mergeBuildings(A, B) {
  const out = [],
    idx = new Map();
  [...(A || []), ...(B || [])].forEach(b => {
    if (!b) return;
    const k = bldKey(b);
    if (!k) {
      out.push(b);
      return;
    }
    const i = idx.get(k);
    if (i === undefined) {
      idx.set(k, out.length);
      out.push({
        ...b
      });
      return;
    }
    const cur = out[i];
    Object.entries(b).forEach(([f, v]) => {
      if (v != null && v !== "" && (cur[f] == null || cur[f] === "")) cur[f] = v;
    });
    cur.rep = cur.rep || b.rep;
    cur.fmsD = cur.fmsD || b.fmsD;
    cur.delivery = cur.delivery || b.delivery;
  });
  return out;
}

/* 중복 두 건을 하나로 — 실제 데이터/정보 많은 쪽을 기준으로 삼고 빈 값만 채운다 */
function mergeSites(a, b) {
  const base = a.carried && !b.carried ? b : !a.carried && b.carried ? a : (b.buildings || []).length > (a.buildings || []).length ? b : a;
  const other = base === a ? b : a;
  const pick = f => {
    const v = base[f];
    return v == null || v === "" ? other[f] ?? null : v;
  };
  return {
    ...base,
    id: a.id,
    // 먼저 있던 id 유지
    no: String(base.no || "").trim() || other.no || "",
    school: (base.school || "").length >= (other.school || "").length ? base.school : other.school,
    region: pick("region") || "",
    tel: pick("tel") || "",
    kind: pick("kind") || "정기점검",
    field: pick("field"),
    start: pick("start"),
    end: pick("end"),
    contract: base.contract != null && base.contract > 0 ? base.contract : other.contract ?? null,
    /* 나중에 추가된 항목들 — 한쪽에만 있으면 그 값을 살린다 */
    fieldEnd: pick("fieldEnd") || "",
    fieldExtra: [...new Set([...toArr(base.fieldExtra), ...toArr(other.fieldExtra)])].filter(Boolean).sort(),
    fieldWho: {
      ...(other.fieldWho || {}),
      ...(base.fieldWho || {})
    },
    bldWho: {
      ...(other.bldWho || {}),
      ...(base.bldWho || {})
    },
    deliverDate: pick("deliverDate") || "",
    isNew: !!(base.isNew || other.isNew),
    tentative: !!(base.tentative && other.tentative),
    memo: pick("memo") || "",
    round: pick("round") || "",
    assignees: base.assignees && base.assignees.length ? base.assignees : other.assignees || [],
    headcount: base.headcount || other.headcount || 2,
    progress: base.progress && Object.keys(base.progress).length ? base.progress : other.progress || {},
    flags: [...new Set([...(getFlags(base) || []), ...(getFlags(other) || [])])],
    carried: !!(base.carried && other.carried),
    // 한쪽이라도 실제 데이터면 실제로
    buildings: mergeBuildings(base.buildings, other.buildings)
  };
}

/* 한 반기(또는 LH) 안에서 중복 제거 — 순서 유지 */
function dedupeBucket(arr) {
  const all = (arr || []).filter(Boolean);
  /* 휴지통(삭제 표시) 현장은 병합 대상에서 빼둔다.
     이걸 안 빼면 버려진 '새 현장'이 새로 추가한 현장을 빨아들이고
     deleted:true 까지 물려줘서, 추가해도 화면에 안 나타난다. */
  const trashed = all.filter(s => s.deleted);
  const list = all.filter(s => !s.deleted);
  const kept = [],
    slots = new Map(); // 학교명 → kept 인덱스 목록
  list.forEach(s => {
    const nm = normSchool(s.school);
    if (!nm) {
      kept.push(s);
      return;
    }
    const idxs = slots.get(nm) || [];
    const hit = idxs.find(i => isSameSite(kept[i], s));
    if (hit === undefined) {
      kept.push(s);
      idxs.push(kept.length - 1);
      slots.set(nm, idxs);
    } else kept[hit] = mergeSites(kept[hit], s);
  });
  return kept.concat(trashed);
}

/* db 전체 중복 정리 — 바뀐 게 없으면 원본을 그대로 돌려준다(불필요한 저장 방지) */
function dedupeDb(db) {
  let changed = false;
  const next = {};
  Object.entries(db || {}).forEach(([y, hs]) => {
    next[y] = {};
    Object.entries(hs || {}).forEach(([h, arr]) => {
      const d = dedupeBucket(arr);
      if (d.length !== (arr || []).length) changed = true;
      next[y][h] = d;
    });
  });
  return changed ? next : db;
}

/* ══════════════════════════════════════════════════════════════
   지도 — 지역 대표 좌표 (지오코딩 실패 시 대략 위치로 표시)
   ══════════════════════════════════════════════════════════════ */
const REGION_XY = {
  수원: [37.2636, 127.0286],
  성남: [37.4200, 127.1265],
  용인: [37.2411, 127.1776],
  부천: [37.5035, 126.7660],
  안산: [37.3219, 126.8309],
  안양: [37.3943, 126.9568],
  평택: [36.9921, 127.1129],
  시흥: [37.3800, 126.8028],
  김포: [37.6152, 126.7156],
  광주: [37.4292, 127.2551],
  광명: [37.4785, 126.8646],
  군포: [37.3617, 126.9352],
  하남: [37.5393, 127.2148],
  오산: [37.1499, 127.0774],
  이천: [37.2722, 127.4350],
  안성: [37.0080, 127.2797],
  의왕: [37.3448, 126.9683],
  양평: [37.4917, 127.4875],
  여주: [37.2983, 127.6370],
  과천: [37.4292, 126.9877],
  고양: [37.6584, 126.8320],
  남양주: [37.6360, 127.2165],
  의정부: [37.7381, 127.0337],
  파주: [37.7599, 126.7800],
  가평: [37.8315, 127.5095],
  포천: [37.8949, 127.2003],
  양주: [37.7852, 127.0458],
  구리: [37.5943, 127.1296],
  동두천: [37.9036, 127.0606],
  연천: [38.0965, 127.0748],
  화성: [37.1996, 126.8312],
  안양과천: [37.4100, 126.9700],
  화성오산: [37.1750, 126.9550],
  분당: [37.3826, 127.1189],
  서울: [37.5665, 126.9780],
  인천: [37.4563, 126.7052],
  대구: [35.8714, 128.6014],
  밀양: [35.5038, 128.7466],
  부산: [35.1796, 129.0756],
  대전: [36.3504, 127.3845],
  광주광역: [35.1595, 126.8526],
  울산: [35.5384, 129.3114],
  세종: [36.4800, 127.2890],
  춘천: [37.8813, 127.7300],
  원주: [37.3422, 127.9202],
  천안: [36.8151, 127.1139]
};
const regionXY = region => {
  const r = String(region || "").replace(/\s+/g, "").replace(/(시|군|구)$/, "");
  if (REGION_XY[r]) return REGION_XY[r];
  const hit = Object.keys(REGION_XY).find(k => r.includes(k) || k.includes(r));
  return hit ? REGION_XY[hit] : null;
};
/* 같은 지역 현장이 완전히 겹치지 않게 이름 기반으로 살짝 흩뿌림 */
const jitter = (seed, amp = 0.012) => {
  let h = 0;
  const t = String(seed || "");
  for (let i = 0; i < t.length; i++) h = h * 31 + t.charCodeAt(i) >>> 0;
  return [(h % 1000 / 1000 - 0.5) * amp, ((h >> 10) % 1000 / 1000 - 0.5) * amp];
};

/* 두 좌표 사이 거리(km) — 검색 결과가 엉뚱한 도시로 잡혔는지 검사용 */
const distKm = (a, b) => {
  const R = 6371,
    rad = d => d * Math.PI / 180;
  const dLat = rad(b[0] - a[0]),
    dLng = rad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

/* 카카오맵 SDK 로드 (키가 있을 때만) */
let kakaoLoading = null;
function loadKakao(key) {
  if (typeof window !== "undefined" && window.kakao && window.kakao.maps && window.kakao.maps.services) return Promise.resolve(window.kakao);
  if (kakaoLoading) return kakaoLoading;
  kakaoLoading = new Promise((res, rej) => {
    let done = false;
    const fail = msg => {
      if (done) return;
      done = true;
      kakaoLoading = null;
      rej(new Error(msg));
    };
    /* 키·도메인이 잘못되면 응답 자체가 안 오는 경우가 있어 시간 제한을 둔다 */
    const timer = setTimeout(() => fail("지도를 불러오지 못했습니다(응답 없음).\n① 카카오맵 사용 설정이 ON인지 ② JavaScript 키에 이 사이트 주소가 'JavaScript SDK 도메인'으로 등록됐는지 확인해 주세요."), 12000);
    const sc = document.createElement("script");
    sc.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services,clusterer&autoload=false`;
    sc.onload = () => {
      try {
        window.kakao.maps.load(() => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          res(window.kakao);
        });
      } catch (e) {
        clearTimeout(timer);
        fail(e && e.message || String(e));
      }
    };
    sc.onerror = () => {
      clearTimeout(timer);
      fail("카카오맵 파일을 불러오지 못했습니다.\n키가 'JavaScript 키'가 맞는지(REST API 키 아님), 카카오맵 사용 설정이 ON인지 확인해 주세요.");
    };
    document.head.appendChild(sc);
  });
  return kakaoLoading;
}

/* 현장 전화번호 — tel 칸이 비어 있으면 특이사항·메모 글에서 번호를 찾아낸다 */
const TEL_RE = /(0\d{1,2})[-.\s]?(\d{3,4})[-.\s]?(\d{4})/;
const siteTel = s => {
  const direct = String(s && s.tel || "").trim();
  if (direct) return direct;
  const texts = [];
  (s && s.buildings || []).forEach(b => {
    if (b && b.note) texts.push(String(b.note));
  });
  if (s && s.note) texts.push(String(s.note));
  for (const t of texts) {
    const m = t.match(TEL_RE);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return "";
};

/* 저장된 현장 좌표를 여러 화면에서 함께 쓰기 위한 캐시 */
const GEO_CACHE = {
  data: {}
};
function useGeoCache() {
  const [geo, setGeo] = useState(GEO_CACHE.data);
  useEffect(() => {
    try {
      const r = firebase.database().ref(FB_GEO);
      const cb = r.on("value", sn => {
        GEO_CACHE.data = sn.val() || {};
        setGeo(GEO_CACHE.data);
      });
      return () => {
        try {
          r.off("value", cb);
        } catch {}
      };
    } catch {
      return undefined;
    }
  }, []);
  return geo;
}

/* 길찾기 앱 선택창 — 화면마다 같은 모양으로 */
function RouteChooser({
  site,
  geo,
  isMobile,
  onClose
}) {
  if (!site) return null;
  const g = (geo || {})[normSchool(site.school)];
  const pos = g && g.lat && g.lng ? {
    lat: g.lat,
    lng: g.lng
  } : null;
  const rl = routeLinks(site, pos);
  const go = u => {
    openRoute(u);
    onClose();
  };
  const Btn = ({
    label,
    url,
    bd,
    bg,
    fg
  }) => /*#__PURE__*/React.createElement("button", {
    onClick: () => go(url),
    style: {
      padding: "13px 0",
      borderRadius: 10,
      fontSize: 16,
      fontWeight: 800,
      cursor: "pointer",
      border: `1px solid ${bd}`,
      background: bg,
      color: fg
    }
  }, label);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(20,25,40,.5)",
      backdropFilter: "blur(2px)",
      zIndex: 400
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      left: "50%",
      bottom: isMobile ? 0 : "auto",
      top: isMobile ? "auto" : "50%",
      transform: isMobile ? "translateX(-50%)" : "translate(-50%,-50%)",
      zIndex: 401,
      width: isMobile ? "100%" : 340,
      maxWidth: "100vw",
      background: C.surface,
      borderRadius: isMobile ? "16px 16px 0 0" : 16,
      padding: isMobile ? "18px 18px calc(22px + env(safe-area-inset-bottom))" : "18px 18px 22px",
      boxShadow: "0 -8px 40px rgba(20,30,50,.3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: C.t1,
      marginBottom: 3
    }
  }, "🧭 길찾기"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.t3,
      marginBottom: 4
    }
  }, site.school), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: pos ? C.t4 : C.orange,
      marginBottom: 14
    }
  }, pos ? "저장된 위치로 안내합니다" : "위치 미확정 — 이름으로 검색해서 열려요 (카카오맵만 가능)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    label: "카카오맵",
    url: rl.kakao,
    bd: C.purple + "55",
    bg: C.purpleL,
    fg: C.purple
  }), rl.exact && /*#__PURE__*/React.createElement(Btn, {
    label: "티맵",
    url: rl.tmap,
    bd: C.blue + "50",
    bg: C.blueL,
    fg: C.blue
  }), rl.exact && /*#__PURE__*/React.createElement(Btn, {
    label: "네이버지도",
    url: rl.naver,
    bd: C.green + "55",
    bg: C.greenL,
    fg: C.green
  }), rl.exact && /*#__PURE__*/React.createElement(Btn, {
    label: "애플지도",
    url: rl.apple,
    bd: C.border,
    bg: C.surfaceL,
    fg: C.t2
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: "100%",
      marginTop: 10,
      padding: "12px 0",
      borderRadius: 10,
      border: `1px solid ${C.border}`,
      background: "transparent",
      color: C.t3,
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "취소")));
}

/* 길찾기 — 좌표가 있으면 목적지로 바로, 없으면 이름으로 검색해서 열어준다 */
const routeLinks = (site, pos) => {
  const nm = encodeURIComponent(site && site.school || "현장");
  if (pos && pos.lat && pos.lng) {
    return {
      exact: true,
      kakao: `https://map.kakao.com/link/to/${nm},${pos.lat},${pos.lng}`,
      tmap: `tmap://route?goalname=${nm}&goalx=${pos.lng}&goaly=${pos.lat}`,
      apple: `https://maps.apple.com/?daddr=${pos.lat},${pos.lng}&dirflg=d`,
      naver: `nmap://route/car?dlat=${pos.lat}&dlng=${pos.lng}&dname=${nm}&appname=ston.app`
    };
  }
  const q = encodeURIComponent(`${site && site.school || ""} ${site && site.region || ""}`.trim());
  return {
    exact: false,
    kakao: `https://map.kakao.com/link/search/${q}`
  };
};
const openRoute = url => {
  try {
    window.open(url, "_blank");
  } catch {
    window.location.href = url;
  }
};

/* 현장별 마지막 수정 기록 — 여러 명이 같이 쓸 때 누가 언제 뭘 바꿨는지 바로 알 수 있게
   (관리자 로그와 별개로, 현장 데이터에 같이 저장해 목록에서 작게 보여준다) */
const stampEdit = (s, what) => ({
  ...s,
  lastEdit: {
    by: typeof CURRENT_USER !== "undefined" && (CURRENT_USER.name || CURRENT_USER.email) || "알수없음",
    uid: typeof CURRENT_USER !== "undefined" && CURRENT_USER.uid || null,
    at: Date.now(),
    what: String(what || "수정").slice(0, 40)
  }
});
/* 방금 / 12분 전 / 3시간 전 / 어제 / 7월 24일 */
const agoText = ts => {
  if (!ts) return "";
  const d = Date.now() - ts;
  if (d < 60 * 1000) return "방금";
  if (d < 60 * 60 * 1000) return `${Math.floor(d / 60000)}분 전`;
  if (d < 24 * 60 * 60 * 1000) return `${Math.floor(d / 3600000)}시간 전`;
  if (d < 48 * 60 * 60 * 1000) return "어제";
  const t = new Date(ts);
  return `${t.getMonth() + 1}월 ${t.getDate()}일`;
};

/* 마지막 수정 표시 — 작고 흐리게, 필요할 때만 눈에 들어오게 */
function LastEdit({
  s,
  size = 9
}) {
  const le = s && s.lastEdit;
  if (!le || !le.at) return null;
  const fresh = Date.now() - le.at < 6 * 60 * 60 * 1000; // 6시간 이내면 살짝 강조
  const t = new Date(le.at);
  const full = `${t.getFullYear()}. ${t.getMonth() + 1}. ${t.getDate()}. ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")} · ${le.by} · ${le.what || "수정"}`;
  return /*#__PURE__*/React.createElement("span", {
    title: full,
    style: {
      fontSize: size,
      color: fresh ? C.blue : C.t4,
      fontWeight: fresh ? 600 : 500,
      whiteSpace: "nowrap"
    }
  }, "🕘 ", le.by, " · ", agoText(le.at), le.what ? ` · ${le.what}` : "");
}
const STEPS = ["착수계", "현장조사", "기타자료", "보고서", "검토", "제본", "납품", "완수"];
/* 진행 단계 이름과 일정(날짜) 이름이 겹쳐 헷갈리지 않도록, 화면에 쓰는 표기를 따로 둔다 */
const STEP_DESC = {
  납품: "납품 완료",
  완수: "완수(용역 종료)"
};
const STEP_ICON = {
  착수계: "📝",
  현장조사: "📍",
  기타자료: "📎",
  보고서: "📄",
  검토: "🔍",
  제본: "📚",
  납품: "📦",
  완수: "🏁"
};
const STEP_SPECIAL = {
  검토: true,
  제본: true
}; // 별도 강조
/* 진행도 계산: done(완료 개수), pos(앞에서부터 연속 완료=현재 위치), pct(%) */
function getProgress(s) {
  const p = s && s.progress || {};
  const done = STEPS.filter(k => p[k]).length;
  let pos = 0;
  for (const k of STEPS) {
    if (p[k]) pos++;else break;
  }
  return {
    p,
    done,
    pos,
    pct: Math.round(done / STEPS.length * 100),
    total: STEPS.length
  };
}

/* ── 기준일 & D-day ── */
/* 오늘 날짜 — 앱을 며칠씩 켜두면 자정을 넘겨도 D-day가 안 바뀌던 문제 때문에
   상수로 굳히지 않고 필요할 때마다 다시 계산한다. */
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const calcDday = (end, base) => {
  if (!end) return null;
  const [y, m, d] = end.split("-").map(Number);
  const [by, bm, bd] = (base || todayStr()).split("-").map(Number);
  return Math.floor((new Date(y, m - 1, d) - new Date(by, bm - 1, bd)) / 86400000);
};
/* calcDday: 미래(남음)=+, 과거(지남)=−
   한국식 표기는 반대이므로 남으면 D-n, 지났으면 D+n 으로 뒤집어 표시 */
const ddC = d => d === null ? C.t3 : d < 0 ? C.red : d <= 7 ? C.orange : d <= 30 ? C.blue : C.t2;
const ddL = d => d === null ? "-" : d > 0 ? `D-${d}` : d === 0 ? "D-DAY" : `D+${-d}`;
const fd = s => s ? s.slice(5).replace("-", "/") : "-";
const BD = `1px solid ${C.border}`;
const F = `'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif`;
/* 메뉴 아이콘 — 글자 크기를 따라가는 선 아이콘 (currentColor) */
const Ico = d => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  style: {
    width: "1.2em",
    height: "1.2em",
    display: "inline-block",
    verticalAlign: "-0.22em"
  }
}, /*#__PURE__*/React.createElement("path", {
  d
}));
const ICONS = {
  schedule: Ico("M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"),
  sites: Ico("M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01"),
  board: Ico("M9 3h6v4H9zM9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3M9 12h6M9 16h6"),
  map: Ico("M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"),
  reports: Ico("M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6"),
  export: Ico("M12 15V3M7 8l5-5 5 5M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"),
  settings: Ico("M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M16 4v4M10 10v4M18 16v4"),
  more: Ico("M4 6h16M4 12h16M4 18h16")
};
const MENUS = [{
  id: "schedule",
  icon: ICONS.schedule,
  label: "현장 일정"
}, {
  id: "sites",
  icon: ICONS.sites,
  label: "현장 관리"
}, {
  id: "board",
  icon: ICONS.board,
  label: "게시판"
}, {
  id: "map",
  icon: ICONS.map,
  label: "현장 지도"
}, {
  id: "reports",
  icon: ICONS.reports,
  label: "보고서 현황"
}, {
  id: "export",
  icon: ICONS.export,
  label: "엑셀 관리"
}, {
  id: "settings",
  icon: ICONS.settings,
  label: "설정"
}];
