/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 12/18 — 구글 시트 연동 규칙  (data/12-sheet-sync.js)
   │ 시트 주소, 워크플로우 16단계, 시트 한 줄 ↔ 앱 현장 짝짓기 (실제 반영 실행은 18-app.js)
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════
   구글 시트 연동 — 시트가 주인, 앱은 읽기만
   · 시트 → 앱 : 열 때 + 5분마다 + 창 복귀 시 + 새로고침 버튼
   · 앱 → 시트 : 없음
   · 시트가 주인: 착수일·현장조사(첫날)·완수일·계약일·특이사항·지역·워크플로우 16단계
   · 앱에만 있음: 조사 여러 날·날짜별 인원·예정/확정·납품일·메모·동별 점검종류
   ══════════════════════════════════════════════════════════════ */
const SHEET_URL = "https://script.google.com/macros/s/AKfycbwq4rsh_BiZMBLWhm1pfKNPRLhfI9-j01PAKI8vyTol1dUqQ6a9nukJi3BjeJ7Iitzt8Q/exec";
const SHEET_KEY = "ston-live-2026";

/* 시트가 담고 있는 반기 — 이 반기 현장만 연동한다.
   시트가 26년(하) 하나뿐이라, 다른 반기까지 맞추면
   상반기 값이 하반기 행에 잘못 써지는 사고가 난다. */
/* 워크플로우 시트의 16단계 — 시트가 주인, 앱은 보여주기만 */
const FLOW16 = ["계약서발송", "착수계발송", "앱야장작성", "현장조사", "야장엑셀화", "체크리스트", "부록작업", "워드생성", "워드수정", "PDF", "검토", "검수", "제본", "납품", "완수계발송", "계산서발행"];
const FLOW16_LABEL = {
  계약서발송: "계약서",
  착수계발송: "착수계",
  앱야장작성: "야장",
  현장조사: "조사",
  야장엑셀화: "엑셀",
  체크리스트: "체크",
  부록작업: "부록",
  워드생성: "워드",
  워드수정: "수정",
  PDF: "PDF",
  검토: "검토",
  검수: "검수",
  제본: "제본",
  납품: "납품",
  완수계발송: "완수계",
  계산서발행: "계산서"
};
/* 단계 값이 "됐다"로 볼 수 있는지 — 체크박스 true 또는 날짜/글자가 있으면 */
const flowDone = v => v === true || typeof v === "string" && v.trim() !== "" && v !== "false" && v !== "FALSE" && !isExampleVal(v);
/* 워크플로우 한 줄 → {done: 개수, pos: 연속완료 위치, arr: 16개 true/false} */
const flowProgress = st => {
  const arr = FLOW16.map(k => flowDone(st && st[k]));
  let pos = 0;
  for (const b of arr) {
    if (b) pos++;else break;
  }
  return {
    arr,
    done: arr.filter(Boolean).length,
    pos
  };
};

const SHEET_YEAR = "2026";
const SHEET_HALF = "하반기";

/* 학교 이름을 견줄 수 있게 다듬는다 — 고등학교↔고, 띄어쓰기 차이 흡수 */
const normName = v => String(v || "").replace(/\s+/g, "").replace(/\(.*?\)/g, "").replace(/고등학교$/, "고").replace(/중학교$/, "중").replace(/초등학교$/, "초").replace(/유치원$/, "유").toLowerCase();

/* 시트의 FMS ID·PW 를 앱 형식 "아이디 // 비밀번호" 로 합친다 */
const sheetFms = r => {
  const id = String(r.fmsId || "").trim(),
    pw = String(r.fmsPw || "").trim();
  if (!id && !pw) return null;
  return pw ? `${id} // ${pw}` : id;
};

/* 시트 한 줄 → 앱 현장 하나. 시트에 있는 것만 채우고 인원·여러 날 등은 비워둔다 */
function siteFromSheetRow(r, flowSteps, yr, half) {
  const kindOf = kindToBK;
  const blds = (r.buildings || []).map(b => ({
    b: b.b || "",
    cat: /옹벽|교량|터널|축대|담장/.test(b.b || "") ? "토목종" : "건축",
    kind: kindOf(b.kind || r.kind),
    floor: b.floor || null,
    area: b.area ?? null,
    len: b.len ?? null,
    height: b.height ?? null,
    field: b.field || null, /* 동별 조사일 — 있으면 이 동만 이 날짜 */
    jong: b.jong || null,
    fms: sheetFms(r),
    flag: null,
    note: null,
    rep: false,
    fmsD: false,
    delivery: null
  }));
  return {
    id: `sheet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    school: r.school || "",
    no: r.no || "",
    region: r.region || "",
    kind: r.kind || "정기점검", /* 시트 F열 값 그대로 (시트가 주인) */
    memo: r.memo || "",
    contract: r.contract || "",
    start: r.start || "",
    field: r.field || "",
    end: r.end || "",
    deliverDate: parseDelivery(r, flowSteps).date || "",
    deliverWay: parseDelivery(r, flowSteps).way || "",
    deliverBy: parseDelivery(r, flowSteps).by || "",
    deliverDone: !!parseDelivery(r, flowSteps).done,
    headcount: 1,
    assignees: [],
    /* 신규 여부는 시트 A열의 "신규" 로 정한다 */
    isNew: !!r.isNew,
    tentative: false,
    progress: {},
    flow: flowSteps || {},
    buildings: blds.length ? blds : [{
      b: "본관",
      cat: "건축",
      kind: kindOf(r.kind),
      floor: null,
      area: null,
      fms: sheetFms(r),
      flag: null,
      note: null,
      rep: false,
      fmsD: false,
      delivery: null
    }],
    fromSheet: true,
    createdAt: Date.now()
  };
}

/* 시트 한 줄을 찾는다 — 단계별로 좁혀간다.
   같은 학교가 두 번 나오면 점검종류·동 이름·FMS 로 갈라낸다. */
function matchSheetRow(site, rows, saved, appNames) {
  const memo = saved && saved[site.id];
  if (memo === "none") return {
    row: null,
    by: "앱 전용"
  };
  if (memo) {
    const hit = rows.find(r => String(r.row) === String(memo));
    if (hit) return {
      row: hit,
      by: "지정됨"
    };
  }
  let c = rows.filter(r => normName(r.school) === normName(site.school) && (!site.region || !r.region || String(r.region).trim() === String(site.region).trim()));
  if (!c.length) {
    /* 이름으로 못 찾음 — 시트에서 학교명이 바뀐 경우일 수 있다.
       No. 가 있고 시트에서 그 No. 가 하나뿐이면 그걸로 잇는다 (이름이 바뀌어도 같은 현장) */
    const no = String(site.no || "").trim();
    /* 안전장치 — 앱의 No. 가 틀린 경우가 있어서:
       · 휴지통 현장은 No. 로 잇지 않는다 (이름이 다른 행으로 되살아나는 사고 방지)
       · 그 행의 이름이 앱의 다른 현장 이름이면 잇지 않는다 (이름 주인이 가져가야 함) */
    if (no && !site.deleted) {
      const byNo = rows.filter(r => String(r.no || "").trim() === no);
      if (byNo.length === 1 && !(appNames && normName(byNo[0].school) !== normName(site.school) && appNames.has(normName(byNo[0].school)))) return {
        row: byNo[0],
        by: "No.로 연결 (이름 바뀜)"
      };
    }
    return {
      row: null,
      by: "시트에 없음",
      cands: []
    };
  }
  if (c.length === 1) return {
    row: c[0],
    by: "지역+학교명"
  };
  const kinds = [...new Set((site.buildings || []).map(b => bldKind(b)).filter(Boolean))];
  if (kinds.length) {
    const c2 = c.filter(r => kinds.some(k => String(r.kind || "").includes(k)));
    if (c2.length === 1) return {
      row: c2[0],
      by: "+ 점검종류"
    };
    if (c2.length) c = c2;
  }
  const bn = (site.buildings || []).map(b => normName(b.b)).filter(Boolean);
  if (bn.length) {
    const c3 = c.filter(r => (r.buildings || []).some(rb => bn.includes(normName(rb.b))));
    if (c3.length === 1) return {
      row: c3[0],
      by: "+ 동 이름"
    };
    if (c3.length) c = c3;
  }
  const fms = (site.buildings || []).map(b => b.fms).filter(Boolean)[0];
  if (fms) {
    const c4 = c.filter(r => r.fmsId && String(fms).includes(r.fmsId));
    if (c4.length === 1) return {
      row: c4[0],
      by: "+ FMS"
    };
  }
  return {
    row: null,
    by: "여러 건",
    cands: c
  };
}

/* (정리본 수정) 시트의 동 정보가 앱에 저장된 것과 같은지 견준다.
   서버는 빈 값(null)을 저장하지 않아서 다시 읽으면 '없음(undefined)'이 된다. 예전에는 층·면적·종별을
   null 과 undefined 그대로 견줘 항상 "다르다"가 나왔고, 그런 현장(62곳)을 접속한 사람 모두의 화면이
   앱을 열 때·5분마다·창으로 돌아올 때마다 통째로 다시 저장했다 → 남이 방금 고친 내용이 예전 값으로 덮였다. */
function sameSheetBuildings(oldB, nb) {
  return oldB.length === nb.length && oldB.every((b, i) => b.b === nb[i].b && b.kind === nb[i].kind && (b.floor || null) === (nb[i].floor || null) && (b.area ?? null) === (nb[i].area ?? null) && (b.jong || null) === (nb[i].jong || null) && (b.len ?? null) === (nb[i].len ?? null) && (b.height ?? null) === (nb[i].height ?? null) && (b.fms || null) === (nb[i].fms || null) && (b.field || null) === (nb[i].field || null));
}
