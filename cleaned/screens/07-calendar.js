/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 07/18 — 현장 일정 달력  (screens/07-calendar.js)
   │ 날짜 계산 도구, 조사일·동별 담당 계산, 일/주/월 달력 화면, 드래그로 일정 옮기기
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════
   현장 일정 — 영구 캘린더 (드래그로 일정 변경)
══════════════════════════════════════════════════════════════ */
/* ── 날짜 계산 도우미 ── */
const pad2 = n => String(n).padStart(2, "0");
const dstr = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseD = s => {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const startOfWeek = d => addDays(d, -d.getDay()); // 일요일 시작
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const EV_KINDS = [["start", "착수", "#0D9B6C"], ["field", "조사", "#1D6FF2"], ["deliverDate", "납품", "#7C3AED"], ["end", "완수", "#B58A00"]];
/* 종류별 표식 — 색만으로는 4가지가 헷갈려서 모양을 함께 쓴다 */
const EV_MARK = {
  field: "◆",
  start: "▶",
  deliverDate: "■",
  end: "●"
};
const evColor = f => f === "field" ? C.blue : f === "start" ? C.green : f === "deliverDate" ? C.purple : C.yellow;
const evLabel = f => f === "field" ? "조사" : f === "start" ? "착수" : f === "deliverDate" ? "납품" : "완수";
/* ── 현장조사 여러 날 ──
   기본은 하루(field). 며칠에 걸치면 fieldEnd(연속 종료일)와
   fieldExtra(따로 떨어진 날 목록)를 함께 쓴다. 둘 다 없으면 예전과 똑같이 동작한다. */
const surveyDates = s => {
  const out = [];
  const f = s && s.field;
  if (f) out.push(f);
  const fe = s && s.fieldEnd;
  if (f && fe && fe > f) {
    let d = addDays(parseD(f), 1);
    const last = parseD(fe);
    let guard = 0;
    while (d <= last && guard++ < 120) {
      out.push(dstr(d));
      d = addDays(d, 1);
    }
  }
  /* Firebase 가 배열을 객체로 돌려줄 수 있어 toArr 로 감싼다 */
  toArr(s && s.fieldExtra).forEach(d => {
    if (d && !out.includes(d)) out.push(d);
  });
  /* 동별 조사일 (시트 시설물 행 R열) — 그 동만 그 날짜에 따로 뜬다 */
  toArr(s && s.buildings).forEach(b => {
    if (b && b.field && !out.includes(b.field)) out.push(b.field);
  });
  return out.sort();
};

/* 학교 조사 기간(동별 조사일 제외) — 여러 날인지·몇 일차인지는 이걸로 센다 */
const schoolSurveyDates = s => surveyDates({
  ...s,
  buildings: []
});

/* 어떤 날에 어느 동이 가는지.
   · 동에 자기 날짜(b.field)가 있으면 그 날에만
   · 없으면 학교 날짜(첫날·연속·따로) 전부에 */
const buildingsOnDate = (s, ds) => {
  const bs = toArr(s && s.buildings).filter(Boolean);
  const own = bs.filter(b => b.field);
  const rest = bs.filter(b => !b.field);
  const schoolDays = (() => {
    const o = [];
    const f = s && s.field;
    if (!f) return o;
    o.push(f);
    const fe = s && s.fieldEnd;
    if (fe && fe > f) {
      let d = addDays(parseD(f), 1);
      const last = parseD(fe);
      let g = 0;
      while (d <= last && g++ < 120) {
        o.push(dstr(d));
        d = addDays(d, 1);
      }
    }
    toArr(s && s.fieldExtra).forEach(d => {
      if (d && !o.includes(d)) o.push(d);
    });
    return o;
  })();
  const out = own.filter(b => b.field === ds);
  if (schoolDays.includes(ds)) out.push(...rest);
  return out;
};
const isMultiSurvey = s => schoolSurveyDates(s).length > 1;
/* 일정 확정 여부 — 값이 없으면 '확정'으로 본다 (예전 데이터가 그대로 보이도록) */
/* 예정/확정 구분은 2026-11-02 부로 없앴다 — 전부 확정으로 본다.
   옛 데이터의 tentative 값은 남아 있어도 무시한다. */
const isTentative = s => false;

/* 그 날 실제로 가는 인원 — 날짜별로 정해둔 게 있으면 그것, 없으면 기본 인원 */
/* ── 동별 배정 ──
   s.bldWho = { "<동이름>": ["한상오"], "__협의": ["한의영"] }
   · 동에 아무도 없으면 그 날 가는 인원 전체가 맡는 것으로 본다 */
const CONSULT_KEY = "__협의";
/* 동 이름을 서버 열쇠로 쓸 때의 규칙 — 저장할 때와 찾을 때가 반드시 같아야 한다.
   (Firebase 가 . $ # [ ] / 를 키로 받지 않아 _ 로 바꿔 올리기 때문) */
const fbKey = k => String(k).replace(/[.$#\[\]\/\u0000-\u001F\u007F]/g, "_");
const bldWhoOf = (s, bname) => {
  const w = s && s.bldWho;
  if (!w) return [];
  const raw = toArr(w[bname]).filter(Boolean);
  if (raw.length) return raw;
  return toArr(w[fbKey(bname)]).filter(Boolean); /* 예전에 바뀐 열쇠로 저장된 것도 찾아낸다 */
};
const consultOf = s => toArr(s && s.bldWho && s.bldWho[CONSULT_KEY]).filter(Boolean);

const whoOnDate = (s, ds) => {
  const w = s && s.fieldWho && s.fieldWho[ds];
  if (w && typeof w === "object") return toArr(w).filter(Boolean);
  return toArr(s && s.assignees);
};

/* ── 학교에서 빠진 인원은 동별 담당·협의에서도 자동으로 뺀다 (별도 추가 기능) ──
   그 학교 조사일 중 어느 날에도 가지 않는 사람이 동별 담당에 남아 있으면 지운다.
   여러 날 조사면 하루라도 가는 날이 남아 있으면 그대로 둔다. */
const sitePeople = s => {
  const set = new Set();
  const ds = surveyDates(s);
  if (ds.length) ds.forEach(d => whoOnDate(s, d).forEach(n => set.add(n)));
  else toArr(s && s.assignees).filter(Boolean).forEach(n => set.add(n));
  return set;
};
const pruneSiteBldWho = s => {
  if (!s || s.deleted || !s.bldWho || typeof s.bldWho !== "object") return s;
  const people = sitePeople(s);
  let changed = false;
  const bw = {};
  Object.entries(s.bldWho).forEach(([k, v]) => {
    const a = toArr(v).filter(Boolean);
    const keep = a.filter(n => people.has(n));
    if (keep.length !== a.length) changed = true;
    if (keep.length) bw[k] = keep;
  });
  if (!changed) return s;
  return { ...s, bldWho: Object.keys(bw).length ? bw : null };
};
/* 바뀐 게 없으면 같은 객체를 그대로 돌려준다 → 저장·화면에 영향 없음 */
const pruneDbBldWho = db => {
  if (!db || typeof db !== "object") return db;
  let dbChanged = false;
  const next = {};
  Object.entries(db).forEach(([yr, halves]) => {
    if (!halves || typeof halves !== "object" || Array.isArray(halves)) { next[yr] = halves; return; }
    let yrChanged = false;
    const nh = {};
    Object.entries(halves).forEach(([half, list]) => {
      if (!Array.isArray(list)) { nh[half] = list; return; }
      let ch = false;
      const nl = list.map(x => { const p = pruneSiteBldWho(x); if (p !== x) ch = true; return p; });
      nh[half] = ch ? nl : list;
      if (ch) yrChanged = true;
    });
    next[yr] = yrChanged ? nh : halves;
    if (yrChanged) dbChanged = true;
  });
  return dbChanged ? next : db;
};

/* 동별 담당 배정 — 평소엔 결과만 한 줄씩 보이고, 고칠 때만 펼친다.
   동이 2개 이상일 때만 나오며, 펼쳐도 한 번에 한 동만 열려 버튼이 쏟아지지 않는다. */
function BldAssign({
  s,
  assignees,
  dateStr,
  onToggle
}) {
  const [open, setOpen] = useState(false);
  const [openRow, setOpenRow] = useState(null);
  const bs = buildingsOnDate(s, dateStr);
  if (!assignees.length || bs.length < 1) return null; /* 1동짜리도 담당·협의를 넣을 수 있게 */
  const rows = [...bs.map(b => ({
    key: b.b,
    label: b.b,
    size: bldSize(b),
    col: C.blue
  })), {
    key: CONSULT_KEY,
    label: "🤝 협의",
    size: "",
    col: C.orange
  }];
  const anySet = rows.some(r => bldWhoOf(s, r.key).length);

  /* 접힌 상태 — 배정한 것만 글자로 요약 */
  if (!open) return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      display: "flex",
      alignItems: "flex-start",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      fontSize: 12,
      color: C.t3,
      lineHeight: 1.6
    }
  }, anySet ? rows.filter(r => bldWhoOf(s, r.key).length).map(r => /*#__PURE__*/React.createElement("div", {
    key: r.key,
    style: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t4
    }
  }, r.label, r.size ? ` ${r.size}` : "", " "), /*#__PURE__*/React.createElement("span", {
    style: {
      color: r.col,
      fontWeight: 800
    }
  }, bldWhoOf(s, r.key).join("·")))) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t4
    }
  }, "동별 담당 없음 · 다 같이")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(true),
    style: {
      flexShrink: 0,
      padding: "5px 11px",
      borderRadius: 7,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      background: anySet ? C.surfaceL : C.blueL,
      color: anySet ? C.t3 : C.blue,
      border: `1px solid ${anySet ? C.border : C.blue + "45"}`,
      whiteSpace: "nowrap"
    }
  }, "동별 배정 ▸"));

  /* 펼친 상태 — 한 줄에 한 동, 누른 동만 인원이 열린다 */
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      padding: "8px 9px",
      background: C.surfaceL,
      borderRadius: 8,
      border: BD
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: C.t4,
      fontWeight: 700,
      flex: 1
    }
  }, "동별 담당 · 안 고르면 다 같이"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setOpen(false);
      setOpenRow(null);
    },
    style: {
      padding: "4px 10px",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      background: C.blue,
      color: "#fff",
      border: "none"
    }
  }, "✓ 닫기")), rows.map(row => {
    const who = bldWhoOf(s, row.key);
    const isOpen = openRow === row.key;
    return /*#__PURE__*/React.createElement("div", {
      key: row.key,
      style: {
        borderTop: row.key === CONSULT_KEY ? `1px dashed ${C.border}` : "none",
        marginTop: row.key === CONSULT_KEY ? 5 : 0,
        paddingTop: row.key === CONSULT_KEY ? 5 : 0
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setOpenRow(isOpen ? null : row.key),
      style: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 7px",
        borderRadius: 6,
        cursor: "pointer",
        textAlign: "left",
        background: isOpen ? C.surface : "transparent",
        border: `1px solid ${isOpen ? row.col + "45" : "transparent"}`
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: C.t2,
        flexShrink: 0
      }
    }, row.label), row.size ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: C.t4,
        fontWeight: 600
      }
    }, row.size) : null, /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        fontSize: 12,
        fontWeight: 800,
        color: who.length ? row.col : C.t4,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, who.length ? who.join("·") : "—"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: C.t4,
        flexShrink: 0
      }
    }, isOpen ? "▴" : "▾")), isOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        padding: "5px 7px 8px"
      }
    }, assignees.map(name => {
      const on = who.includes(name);
      return /*#__PURE__*/React.createElement("button", {
        key: name,
        onClick: () => onToggle(s.id, row.key, name),
        style: {
          padding: "4px 10px",
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          background: on ? row.col : "transparent",
          color: on ? "#fff" : C.t3,
          border: `1px solid ${on ? row.col : C.border}`
        }
      }, on ? "✓ " : "", name);
    })));
  }));
}

/* 그 날짜가 조사 기간의 어디인지 — 첫날/마지막날/중간 */
const surveyPos = (s, ds) => {
  /* 시작·종료 표시는 학교 조사 기간(첫날~종료일·따로 날)만 본다.
     동별 조사일은 별개 일정이라 여기 안 들어간다 */
  const a = surveyDates({
    ...s,
    buildings: []
  });
  if (a.length <= 1) return "";
  if (ds === a[0]) return "시작";
  if (ds === a[a.length - 1]) return "종료";
  return "";
};

/* 납품은 완수일보다 최소 3일 앞서야 한다 — 늦으면 경고 */
const DELIVER_LEAD = 3;
const deliverLate = s => {
  if (!s || !s.deliverDate || !s.end) return false;
  return (parseD(s.end) - parseD(s.deliverDate)) / 86400000 < DELIVER_LEAD;
};

/* 연도·월·주 선택 버튼 — 눌러서 목록을 띄운다 */
function SelBtn({
  main,
  sub,
  onClick,
  isMobile
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      flex: "0 0 auto",
      minWidth: 0,
      padding: sub ? "4px 6px" : isMobile ? "8px 4px" : "8px 8px",
      borderRadius: 10,
      border: "none",
      background: "transparent",
      cursor: "pointer",
      textAlign: "center",
      lineHeight: 1.25
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: isMobile ? 18 : 26,
      fontWeight: 800,
      color: C.t1,
      whiteSpace: "nowrap"
    }
  }, main, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.t3,
      marginLeft: 3
    }
  }, "▾")), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t3,
      fontWeight: 700,
      whiteSpace: "nowrap"
    }
  }, sub));
}

/* 하나만 고르는 선택창 — 연도·월·주·일을 각각 따로 띄운다 */
function ListPicker({
  title,
  items,
  value,
  cols,
  onPick,
  onClose,
  isMobile
}) {
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
      width: isMobile ? "100%" : 400,
      maxWidth: "100vw",
      maxHeight: "84vh",
      overflowY: "auto",
      background: C.surface,
      borderRadius: isMobile ? "18px 18px 0 0" : 16,
      padding: isMobile ? "16px 16px calc(20px + env(safe-area-inset-bottom))" : "20px",
      boxShadow: "0 -8px 40px rgba(20,30,50,.3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      marginBottom: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 800,
      color: C.t1,
      flex: 1
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: 34,
      height: 34,
      borderRadius: "50%",
      border: `1px solid ${C.border}`,
      background: C.surfaceL,
      color: C.t3,
      fontSize: 19,
      cursor: "pointer",
      lineHeight: 1
    }
  }, "×")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`,
      gap: 7
    }
  }, items.map(it => {
    const on = String(it.k) === String(value);
    return /*#__PURE__*/React.createElement("button", {
      key: it.k,
      onClick: () => {
        onPick(it.k);
        onClose();
      },
      style: {
        padding: cols >= 7 ? "12px 0" : "13px 8px",
        borderRadius: 9,
        cursor: "pointer",
        whiteSpace: "nowrap",
        border: `1px solid ${on ? C.blue : C.border}`,
        background: on ? C.blueL : C.surface,
        color: on ? C.blue : C.t2,
        fontSize: 15,
        fontWeight: on ? 800 : 600
      }
    }, it.label);
  }))));
}

/* 담당자 이름을 하나씩 그린다 — 로그인한 본인 이름만 눈에 띄게 */
function WhoList({
  names,
  me,
  sep,
  size,
  baseColor
}) {
  const list = sortMembers(names);
  if (!list.length) return null;
  return list.map((n, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: n
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t4
    }
  }, sep || "·"), /*#__PURE__*/React.createElement("span", {
    style: n === me ? {
      color: "#fff",
      background: C.blue,
      borderRadius: 4,
      padding: "1px 5px",
      fontWeight: 800,
      fontSize: size
    } : {
      color: baseColor || C.t1,
      fontWeight: 800,
      fontSize: size
    }
  }, n)));
}

/* 일정 한 줄 (주 세로 목록 · 일 보기) — 어디로 누가 가는지가 한눈에 들어오도록
   현장명 → 지역 → 담당 인원 순으로 쌓는다 */
function EvRow({
  e,
  compact,
  onClick,
  me
}) {
  const col = evColor(e.field);
  const who = sortMembers(e.assignees).join(" · ");
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    title: `${(e.kinds || []).length ? `[${e.kinds.join("·")}] ` : ""}${e.school}${e.way ? `-${e.way}` : ""}${e.bld > 0 ? ` ${e.bld}동` : ""}${e.region ? ` (${e.region})` : ""} · ${evLabel(e.field)} · ${who || "인원 미배정"}`,
    style: {
      width: "100%",
      textAlign: "left",
      display: "flex",
      alignItems: "flex-start",
      gap: 9,
      padding: compact ? "9px 10px" : "11px 13px",
      marginBottom: 5,
      borderRadius: 8,
      cursor: "pointer",
      border: `1px solid ${col}38`,
      borderLeft: `4px solid ${col}`,
      background: e.tentative ? `repeating-linear-gradient(45deg, ${col}12, ${col}12 5px, transparent 5px, transparent 10px)` : col + "0e",
      opacity: e.done ? .55 : 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      minWidth: 40,
      textAlign: "center",
      padding: "4px 5px",
      borderRadius: 5,
      fontSize: 12,
      fontWeight: 800,
      color: "#fff",
      background: col
    }
  }, e.tentative ? "? " : "", EV_MARK[e.field], " ", evLabel(e.field), e.pos ? ` ${e.pos}` : ""), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: compact ? 14 : 16,
      fontWeight: 800,
      color: C.t1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, e.region ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: col,
      background: col + "18",
      padding: "2px 6px",
      borderRadius: 4,
      marginRight: 6
    }
  }, e.region) : null, (e.kinds || []).map(k => /*#__PURE__*/React.createElement("span", {
    key: k,
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: bkindColor(k),
      background: bkindColor(k) + "18",
      border: `1px solid ${bkindColor(k)}40`,
      borderRadius: 4,
      padding: "1px 5px",
      marginRight: 4
    }
  }, k)), /*#__PURE__*/React.createElement("span", { style: { fontWeight: e.done ? 500 : undefined, textDecoration: e.done ? "line-through" : undefined } }, e.school, e.way ? `-${e.way}` : ""), e.bld > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: col,
      marginLeft: 5
    }
  }, e.bld, "동")), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      marginTop: 5,
      padding: "4px 9px",
      borderRadius: 6,
      fontSize: compact ? 14 : 15,
      fontWeight: 800,
      lineHeight: 1.45,
      color: who ? C.t1 : "#9A5B0A",
      background: who ? C.surfaceD : C.orangeL,
      border: `1px solid ${who ? C.borderD : C.orange + "55"}`
    }
  }, who ? /*#__PURE__*/React.createElement(React.Fragment, null, "👤 ", /*#__PURE__*/React.createElement(WhoList, {
    names: e.assignees,
    me: me,
    sep: " · ",
    size: compact ? 14 : 15
  })) : `⚠ 인원 미배정 · ${e.headcount}명 예정`)));
}

/* 메모 일정 한 줄 — 현장 점검이 아닌 부가 일정 (휴가·회의 등) */
function NoteRow({
  n,
  compact,
  onClick
}) {
  const col = noteColor(n.kind);
  const who = sortMembers(n.who || []).join(" · ");
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    title: `${n.kind} · ${n.text}${who ? ` · ${who}` : ""}`,
    style: {
      width: "100%",
      textAlign: "left",
      display: "flex",
      alignItems: "center",
      gap: 9,
      padding: compact ? "8px 10px" : "10px 12px",
      marginBottom: 5,
      borderRadius: 8,
      cursor: "pointer",
      border: `1px dashed ${col}55`,
      borderLeft: `4px dotted ${col}`,
      background: C.surfaceL
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      minWidth: 40,
      textAlign: "center",
      padding: "3px 5px",
      borderRadius: 5,
      fontSize: 12,
      fontWeight: 800,
      color: col,
      background: col + "16",
      border: `1px solid ${col}40`
    }
  }, n.kind), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: compact ? 14 : 15,
      fontWeight: 700,
      color: C.t1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, n.text), who && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      marginTop: 2,
      fontSize: 12,
      fontWeight: 700,
      color: C.t2,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, "👤 ", who)));
}

/* 일정 칸 (데스크탑 주 보기 7칸) — 좁으니 세 줄로 압축 */
function WeekChip({
  e,
  onClick,
  me
}) {
  const col = evColor(e.field);
  const who = sortMembers(e.assignees).join("·");
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    title: `${(e.kinds || []).length ? `[${e.kinds.join("·")}] ` : ""}${e.school}${e.way ? `-${e.way}` : ""}${e.bld > 0 ? ` ${e.bld}동` : ""}${e.region ? ` (${e.region})` : ""} · ${evLabel(e.field)} · ${who || "인원 미배정"}`,
    style: {
      width: "100%",
      textAlign: "left",
      display: "block",
      padding: "6px 8px",
      marginBottom: 5,
      borderRadius: 7,
      cursor: "pointer",
      border: `1px solid ${col}3a`,
      borderLeft: `4px solid ${col}`,
      background: e.tentative ? `repeating-linear-gradient(45deg, ${col}12, ${col}12 5px, transparent 5px, transparent 10px)` : col + "0e",
      opacity: e.done ? .55 : 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: col
    }
  }, e.tentative ? "? " : "", EV_MARK[e.field], " ", evLabel(e.field), e.pos ? ` ${e.pos}` : "", e.days > 1 && e.field === "field" ? ` (${e.days}일)` : ""), e.region && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.t3,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, e.region)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 800,
      color: C.t1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, (e.kinds || []).map(k => /*#__PURE__*/React.createElement("span", {
    key: k,
    style: {
      color: bkindColor(k),
      fontWeight: 800,
      marginRight: 4
    }
  }, k)), /*#__PURE__*/React.createElement("span", { style: { fontWeight: e.done ? 500 : undefined, textDecoration: e.done ? "line-through" : undefined } }, e.school, e.way ? `-${e.way}` : ""), e.bld > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 800,
      color: col,
      marginLeft: 4
    }
  }, e.bld, "동")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 5,
      padding: "4px 7px",
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 800,
      lineHeight: 1.4,
      wordBreak: "keep-all",
      color: who ? C.t1 : "#9A5B0A",
      background: who ? C.surfaceD : C.orangeL,
      border: `1px solid ${who ? C.borderD : C.orange + "55"}`
    }
  }, who ? /*#__PURE__*/React.createElement(WhoList, {
    names: e.assignees,
    me: me,
    sep: "·",
    size: 14,
    baseColor: C.t2
  }) : "인원 미배정"));
}

/* ══════════════════════════════════════════════════════════════
   현장 일정 — 일 / 주 / 월 보기
   · 제목을 누르면 연·월(·주) 선택 팝업
   · 인원 칩을 누르면 그 사람 일정만 (누가 어디로 가는지 확인용)
   · 주 보기는 폰에서 세로 목록, 데스크탑에서 7칸 가로
══════════════════════════════════════════════════════════════ */
function Calendar({
  allSchools,
  setDb,
  isMobile,
  notes,
  isAdmin,
  editor
}) {
  const [view, setView] = useState("month"); // day | week | month
  const [cursor, setCursor] = useState(() => todayStr());
  const [kinds, setKinds] = useState(["field", "end"]); // 보이는 일정 종류 — 처음엔 현장조사·완수만
  const [onlyTent, setOnlyTent] = useState(false); // 예정만 보기
  /* 전부 켜진 상태에서 하나를 누르면 그것만 남는다.
     그 뒤엔 눌러서 더하거나 뺄 수 있고, 마지막 하나를 끄면 처음 상태(현장조사·완수)로 돌아간다. */
  const toggleKind = k => setKinds(prev => {
    if (prev.length === 3) return [k];
    if (prev.includes(k)) {
      const next = prev.filter(x => x !== k);
      return next.length ? next : ["field", "end"];
    }
    return [...prev, k];
  });
  const [picker, setPicker] = useState(null); // "year" | "month" | "sub"
  const [dragging, setDragging] = useState(null);
  const [overDate, setOverDate] = useState(null);
  const [selDate, setSelDate] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = m => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };
  const cur = parseD(cursor);
  const aY = cur.getFullYear(),
    aM = cur.getMonth() + 1;
  const tStr = todayStr();
  const weekStart = startOfWeek(cur),
    weekEnd = addDays(weekStart, 6);

  /* 날짜별 일정 — 보기 방식과 무관하게 한 번만 계산 */
  const evByDate = useMemo(() => {
    const map = {},
      seen = new Set();
    allSchools.forEach(s => {
      /* 현장조사는 여러 날에 걸칠 수 있어 날짜 목록으로 편다 */
      const list = [];
      surveyDates(s).forEach(d => list.push(["field", d]));
      ["start", "deliverDate", "end"].forEach(f => {
        if (s[f]) list.push([f, s[f]]);
      });
      list.forEach(([f, ds]) => {
        /* 같은 현장·같은 날·같은 종류는 한 번만 (이월본이 양쪽 반기에 있어도 중복 표시 안 됨) */
        const k = `${ds}|${f}|${(s.school || "").trim()}|${(s.no || "").toString().trim()}`;
        if (seen.has(k)) return;
        seen.add(k);
        (map[ds] = map[ds] || []).push({
          schoolId: s.id,
          school: s.school,
          field: f,
          region: s.region || "",
          headcount: s.headcount || 2,
          /* 조사일은 그 날 실제로 가는 인원을 쓴다 (날짜별로 다를 수 있음) */
          assignees: sortMembers(f === "field" ? whoOnDate(s, ds) : s.assignees),
          pos: f === "field" ? surveyPos(s, ds) : "",
          days: f === "field" ? schoolSurveyDates(s).length : 1,
          tentative: isTentative(s),
          /* 시설물(동) 수 — 조사일이면 그 날 가는 동만 (동별 조사일이 다를 수 있음) */
          bld: f === "field" ? buildingsOnDate(s, ds).length : (s.buildings || []).length,
          /* 납품·완수 칩에 "-직납"/"-우편" 을 붙이려고 */
          way: f === "deliverDate" || f === "end" ? deliveryOf(s).way : "",
          /* 납품이 끝난 건 굵기를 풀고 흐리게 — 할 일이 아니라 지난 일이니까 */
          done: (f === "deliverDate" || f === "end") && deliveryOf(s).state === "완료",
          kinds: f === "field" ? siteKinds({
            ...s,
            buildings: buildingsOnDate(s, ds)
          }) : siteKinds(s)
        });
      });
    });
    const ord = {
      field: 0,
      start: 1,
      deliverDate: 2,
      end: 3
    };
    /* 종류(조사→착수→납품→완수) 먼저, 그 안에서 끝난 건은 뒤로, 그다음 지역 → 학교명.
       납품이 ord 에 없으면 비교값이 NaN 이 되어 순서가 뒤섞인다. */
    Object.values(map).forEach(a => a.sort((x, y2) => ord[x.field] - ord[y2.field] || (x.done ? 1 : 0) - (y2.done ? 1 : 0) || byRegionThenName(x, y2)));
    return map;
  }, [allSchools]);

  const evOf = ds => (evByDate[ds] || []).filter(e => kinds.includes(e.field) && (!onlyTent || e.tentative));

  /* 날짜별 메모 — 현장 일정과 따로 모아 둔다 */
  const noteByDate = useMemo(() => {
    const map = {};
    (notes || []).forEach(n => {
      noteDates(n).forEach(d => (map[d] = map[d] || []).push(n));
    });
    Object.values(map).forEach(a => a.sort((x, y2) => String(x.at || 0) - String(y2.at || 0)));
    return map;
  }, [notes]);
  const noteOf = ds => onlyTent ? [] : noteByDate[ds] || [];

  /* 기간 이동 */
  const shift = n => {
    if (view === "month") setCursor(dstr(new Date(aY, aM - 1 + n, 1, 12)));else setCursor(dstr(addDays(cur, view === "week" ? 7 * n : n)));
    setSelDate(null);
  };
  const goToday = () => {
    setCursor(tStr);
    setSelDate(view === "month" ? tStr : null);
  };
  const changeView = v => {
    setView(v);
    setSelDate(null);
    /* 보기를 바꿀 때 지금 보고 있는 달 안에 오늘이 있으면 오늘로 맞춘다 */
    const t = new Date();
    if (t.getFullYear() === aY && t.getMonth() + 1 === aM) setCursor(tStr);
  };

  /* 좌우 스와이프 · 가로 휠 */
  const wheelAcc = useRef(0),
    moveLock = useRef(0),
    swipeStart = useRef(null);
  const guard = dir => {
    const now = Date.now();
    if (now - moveLock.current < 320) return;
    moveLock.current = now;
    shift(dir);
  };
  const onWheel = e => {
    if (Math.abs(e.deltaX) < 2 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    e.preventDefault();
    wheelAcc.current += e.deltaX;
    if (Math.abs(wheelAcc.current) >= 60) {
      guard(wheelAcc.current > 0 ? 1 : -1);
      wheelAcc.current = 0;
    }
  };
  const onTStart = e => {
    swipeStart.current = {
      y: e.touches[0].clientY,
      x: e.touches[0].clientX,
      moved: false
    };
  };
  const onTMove = e => {
    const st = swipeStart.current;
    if (!st || st.moved) return;
    const dy = e.touches[0].clientY - st.y,
      dx = e.touches[0].clientX - st.x;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
      st.moved = true;
      guard(dx < 0 ? 1 : -1);
    }
  };
  const onTEnd = () => {
    swipeStart.current = null;
  };
  const swipeProps = {
    onWheel: onWheel,
    onTouchStart: onTStart,
    onTouchMove: onTMove,
    onTouchEnd: onTEnd
  };

  /* 일정 끌어서 날짜 변경 (월 보기) */
  const handleDrop = useCallback(targetDate => {
    if (!dragging || !targetDate) return;
    const {
      schoolId,
      field,
      from
    } = dragging;
    if (from === targetDate) {
      setDragging(null);
      setOverDate(null);
      return;
    }
    const sc = allSchools.find(s => s.id === schoolId);
    const lb = field === "field" ? "현장조사일" : field === "start" ? "착수일" : field === "deliverDate" ? "납품일" : "완수일";
    if (sc?._year && sc?._half) {
      setDb(prev => {
        const next = {
          ...prev
        };
        next[sc._year] = {
          ...(prev[sc._year] || {})
        };
        next[sc._year][sc._half] = (prev[sc._year]?.[sc._half] || []).map(s => s.id !== schoolId ? s : stampEdit({
          ...s,
          [field]: targetDate
        }, `${lb} 변경`));
        return next;
      });
    }
    logAction("수정", `${sc?.school} · ${lb}`, from || "-", targetDate);
    showToast(`${sc?.school} ${lb} → ${targetDate.slice(5).replace("-", "/")}`);
    setDragging(null);
    setOverDate(null);
  }, [dragging, allSchools, setDb]);

  /* 연·월·일을 따로 지정 — 말일을 넘기면 그 달 마지막 날로 맞춘다 */
  const setYMD = (y, m, d) => {
    const last = new Date(y, m, 0).getDate();
    setCursor(dstr(new Date(y, m - 1, Math.min(d, last), 12)));
    setSelDate(null);
  };

  /* 그 달에 걸친 주 목록 */
  const weeksOfMonth = useMemo(() => {
    const out = [];
    const last = new Date(aY, aM, 0).getDate();
    let ws = startOfWeek(new Date(aY, aM - 1, 1, 12));
    let n = 1;
    while (ws <= new Date(aY, aM - 1, last, 12)) {
      out.push({
        n: n++,
        s: new Date(ws)
      });
      ws = addDays(ws, 7);
    }
    return out;
  }, [aY, aM]);
  const curWeekNo = (weeksOfMonth.find(w => dstr(w.s) === dstr(weekStart)) || {}).n || 1;

  /* ── 보기 전환 ── */
  const viewToggle = /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      background: C.surfaceD,
      borderRadius: 10,
      padding: 3,
      gap: 2,
      flexShrink: 0
    }
  }, [["day", "일"], ["week", "주"], ["month", "월"]].map(([v, l]) => /*#__PURE__*/React.createElement("button", {
    key: v,
    onClick: () => changeView(v),
    style: {
      minWidth: isMobile ? 44 : 52,
      flex: isMobile ? 1 : undefined,
      padding: isMobile ? "11px 0" : "8px 0",
      borderRadius: 8,
      border: "none",
      cursor: "pointer",
      fontSize: 15,
      fontWeight: view === v ? 800 : 600,
      background: view === v ? C.surface : "transparent",
      color: view === v ? C.blue : C.t3,
      boxShadow: view === v ? "0 1px 4px rgba(20,30,50,.14)" : "none"
    }
  }, l)));

  /* ── 종류 버튼 ── 전부 켜진 상태에서 하나를 누르면 그것만 보인다.
     색 구분 설명 역할까지 겸한다. */
  const kindBar = /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 7,
      marginBottom: isMobile ? 12 : 0
    }
  }, EV_KINDS.map(([f, l, c]) => {
    const on = kinds.includes(f);
    const lab = f === "field" ? "현장조사" : f === "start" ? "착수" : f === "deliverDate" ? "납품" : "완수";
    return /*#__PURE__*/React.createElement("button", {
      key: f,
      onClick: () => toggleKind(f),
      style: {
        flex: isMobile ? 1 : "0 0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: isMobile ? "11px 0" : "8px 18px",
        wordBreak: "keep-all",
        borderRadius: 999,
        cursor: "pointer",
        border: `1px solid ${on ? c : C.border}`,
        background: on ? c + "16" : C.surface,
        color: on ? c : C.t4,
        fontSize: isMobile ? 13 : 14,
        fontWeight: on ? 700 : 600
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 9,
        height: 9,
        borderRadius: "50%",
        flexShrink: 0,
        background: on ? c : C.borderD
      }
    }), lab);
  }));

  /* ── 월 보기 ── */
  const monthGrid = () => {
    const daysIn = new Date(aY, aM, 0).getDate();
    const firstDow = new Date(aY, aM - 1, 1).getDay();
    const cells = [...Array(firstDow).fill(null), ...Array.from({
      length: daysIn
    }, (_, i) => i + 1)];
    while (cells.length % 7) cells.push(null);
    const weeks = Array.from({
      length: cells.length / 7
    }, (_, i) => cells.slice(i * 7, i * 7 + 7));
    const cap = isMobile ? 3 : 99;
    return /*#__PURE__*/React.createElement("div", {
      ...swipeProps,
      style: {
        background: C.surface,
        border: BD,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 6px 28px rgba(15,27,45,.07)",
        touchAction: "pan-y"
      }
    }, /*#__PURE__*/React.createElement("table", {
      style: {
        width: "100%",
        borderCollapse: "collapse",
        tableLayout: "fixed"
      }
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
      style: {
        background: C.surface,
        borderBottom: BD
      }
    }, DOW.map((d, i) => /*#__PURE__*/React.createElement("th", {
      key: d,
      style: {
        padding: isMobile ? "9px 0" : "12px 0",
        textAlign: "center",
        fontSize: isMobile ? 12 : 13,
        fontWeight: 700,
        color: i === 0 ? C.red : i === 6 ? C.blue : C.t3,
        borderRight: "none"
      }
    }, d)))), /*#__PURE__*/React.createElement("tbody", null, weeks.map((wk, wi) => /*#__PURE__*/React.createElement("tr", {
      key: wi,
      style: {
        borderBottom: wi < weeks.length - 1 ? BD : "none"
      }
    }, wk.map((day, di) => {
      const ds = day ? `${aY}-${pad2(aM)}-${pad2(day)}` : null;
      const evs = ds ? evOf(ds) : [];
      const over = !!ds && overDate === ds;
      const sel = !!ds && selDate === ds;
      const isT = ds === tStr;
      return /*#__PURE__*/React.createElement("td", {
        key: di,
        onClick: () => ds && setSelDate(sel ? null : ds),
        onDragOver: e => {
          e.preventDefault();
          setOverDate(ds);
        },
        onDragLeave: () => setOverDate(null),
        onDrop: () => handleDrop(ds),
        style: {
          padding: isMobile ? "6px 5px" : "7px 8px",
          verticalAlign: "top",
          height: isMobile ? 132 : 138,
          width: "14.285%",
          borderRight: di < 6 ? BD : "none",
          cursor: ds ? "pointer" : "default",
          background: sel ? "rgba(29,111,242,.11)" : over ? "rgba(29,111,242,.09)" : isT ? "rgba(29,111,242,.05)" : "transparent",
          outline: sel ? `2px solid ${C.blue}` : over ? `2px dashed ${C.blue}` : "none",
          outlineOffset: -2,
          position: "relative"
        }
      }, ds && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
        style: {
          width: isMobile ? 26 : 30,
          height: isMobile ? 26 : 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          background: isT ? C.blue : "transparent",
          color: isT ? "#fff" : di === 0 ? C.red : di === 6 ? C.blue : C.t1,
          fontSize: isMobile ? 14 : 15,
          fontWeight: isT ? 900 : 700,
          marginBottom: isMobile ? 2 : 4,
          boxShadow: isT ? `0 2px 8px ${C.blue}55` : "none"
        }
      }, day), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? 2 : 3
        }
      }, evs.slice(0, cap).map((e, ei) => /*#__PURE__*/React.createElement("div", {
        key: ei,
        draggable: true,
        onDragStart: () => setDragging({
          schoolId: e.schoolId,
          field: e.field,
          from: ds
        }),
        onDragEnd: () => {
          setDragging(null);
          setOverDate(null);
        },
        title: `${(e.kinds || []).length ? `[${e.kinds.join("·")}] ` : ""}${e.school}${e.way ? `-${e.way}` : ""}${e.bld > 0 ? ` ${e.bld}동` : ""} · ${evLabel(e.field)}${e.days > 1 ? ` (${e.days}일 중 ${e.pos || "중간"})` : ""} · ${e.assignees.length ? sortMembers(e.assignees).join(",") : "인원 미배정"}`,
        style: {
          padding: isMobile ? "2px 3px" : "4px 9px",
          borderRadius: 6,
          /* 예정은 빗금 배경 — 메모(점선 막대)와 겹치지 않게 막대는 실선 유지 */
          background: e.tentative ? `repeating-linear-gradient(45deg, ${evColor(e.field)}1c, ${evColor(e.field)}1c 4px, transparent 4px, transparent 8px)` : `${evColor(e.field)}1c`,
          borderLeft: `${isMobile ? e.field === "field" ? 3 : e.field === "start" ? 2 : e.field === "deliverDate" ? 4 : 5 : 0}px solid ${evColor(e.field)}`,
          borderTop: isMobile && e.field === "end" ? `1px solid ${evColor(e.field)}55` : undefined,
          fontSize: isMobile ? 11 : 14,
          lineHeight: isMobile ? 1.25 : 1.5,
          letterSpacing: isMobile ? "-0.4px" : 0,
          color: evColor(e.field),
          fontWeight: e.done ? 500 : 700,
          textDecoration: e.done ? "line-through" : undefined,
          overflow: "hidden",
          cursor: "grab",
          /* 폰에서는 두 줄까지 보여 8글자 정도가 읽힌다 (넘치면 … 로 잘림) */
          ...(isMobile ? {
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            wordBreak: "break-all"
          } : {
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }),
          opacity: dragging?.schoolId === e.schoolId && dragging?.field === e.field ? .4 : e.done ? .55 : 1
        }
      }, e.tentative ? "? " : null, (e.kinds || []).map(k => /*#__PURE__*/React.createElement("span", {
        key: k,
        style: {
          color: bkindColor(k),
          fontWeight: 800,
          marginRight: 3,
          ...(isMobile ? {} : {
            background: bkindColor(k) + "1e",
            borderRadius: 6,
            padding: "0 4px"
          })
        }
      }, k)), isMobile ? null : `${EV_MARK[e.field]} `, e.school, e.way ? `-${e.way}` : "", e.pos === "시작" ? "▸" : e.pos === "종료" ? "◂" : "", e.bld > 0 && /*#__PURE__*/React.createElement("span", {
        style: {
          fontWeight: 800,
          opacity: .75,
          marginLeft: 3
        }
      }, isMobile ? e.bld : `(${e.bld})`))), noteOf(ds).slice(0, Math.max(0, cap - evs.length)).map((n, ni) => /*#__PURE__*/React.createElement("div", {
        key: `n${ni}`,
        title: `${n.kind} · ${n.text}${(n.who || []).length ? ` · ${n.who.join(",")}` : ""}`,
        style: {
          padding: isMobile ? "2px 3px" : "4px 9px",
          borderRadius: 6,
          background: C.surfaceL,
          borderLeft: `${isMobile ? 2 : 3}px dotted ${noteColor(n.kind)}`,
          fontSize: isMobile ? 11 : 14,
          lineHeight: isMobile ? 1.25 : 1.5,
          letterSpacing: isMobile ? "-0.4px" : 0,
          color: C.t2,
          fontWeight: 600,
          overflow: "hidden",
          ...(isMobile ? {
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            wordBreak: "break-all"
          } : {
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          })
        }
      }, isMobile ? null : "✎ ", n.text)), evs.length + noteOf(ds).length > cap && /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: isMobile ? 10 : 12,
          color: C.t4,
          paddingLeft: 3,
          fontWeight: 800
        }
      }, "+", evs.length + noteOf(ds).length - cap, "건"))));
    }))))));
  };

  /* ── 주 보기 (데스크탑) ── 7칸 가로. 칸마다 현장 + 지역 + 인원 */
  const weekGrid = () => {
    const days = Array.from({
      length: 7
    }, (_, i) => addDays(weekStart, i));
    return /*#__PURE__*/React.createElement("div", {
      ...swipeProps,
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(7,minmax(0,1fr))",
        gap: 8,
        background: C.surface,
        border: BD,
        borderRadius: 12,
        padding: 11,
        boxShadow: "0 2px 12px rgba(0,0,0,.06)"
      }
    }, days.map(d => {
      const ds = dstr(d);
      const evs = evOf(ds);
      const isT = ds === tStr;
      const dow = d.getDay();
      return /*#__PURE__*/React.createElement("div", {
        key: ds,
        style: {
          minWidth: 0,
          borderRadius: 9,
          padding: isT ? "6px 7px" : 0,
          background: isT ? C.blueL : "transparent"
        }
      }, /*#__PURE__*/React.createElement("div", {
        onClick: () => setSelDate(ds),
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          paddingBottom: 8,
          marginBottom: 8,
          borderBottom: `1px solid ${isT ? C.blue + "44" : C.border}`,
          cursor: "pointer"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          minWidth: 27,
          height: 27,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          background: isT ? C.blue : "transparent",
          color: isT ? "#fff" : dow === 0 ? C.red : dow === 6 ? C.blue : C.t1,
          fontSize: 16,
          fontWeight: 800
        }
      }, d.getDate()), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: 700,
          color: dow === 0 ? C.red : dow === 6 ? C.blue : C.t2
        }
      }, DOW[dow]), evs.length + noteOf(ds).length > 0 && /*#__PURE__*/React.createElement("span", {
        style: {
          marginLeft: "auto",
          fontSize: 12,
          fontWeight: 700,
          color: C.t3
        }
      }, evs.length + noteOf(ds).length)), evs.length + noteOf(ds).length === 0 ? /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 12,
          color: C.t4,
          padding: "3px 2px"
        }
      }, "일정 없음") : null, evs.map((e, i) => /*#__PURE__*/React.createElement(WeekChip, {
        key: i,
        e: e,
        me: editor,
        onClick: () => setSelDate(ds)
      })), noteOf(ds).map((n, i) => /*#__PURE__*/React.createElement("button", {
        key: `n${i}`,
        onClick: () => setSelDate(ds),
        title: `${n.kind} · ${n.text}`,
        style: {
          width: "100%",
          textAlign: "left",
          display: "block",
          padding: "6px 8px",
          marginBottom: 5,
          borderRadius: 7,
          cursor: "pointer",
          border: `1px dashed ${noteColor(n.kind)}45`,
          borderLeft: `4px dotted ${noteColor(n.kind)}`,
          background: C.surfaceL
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 12,
          fontWeight: 800,
          color: noteColor(n.kind),
          marginBottom: 2
        }
      }, n.kind), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 13,
          fontWeight: 700,
          color: C.t1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, n.text))));
    }));
  };

  /* ── 주 보기 (폰) ── 날짜별 한 줄 세로 목록 */
  const weekList = () => {
    const days = Array.from({
      length: 7
    }, (_, i) => addDays(weekStart, i));
    const total = days.reduce((a, d) => a + evOf(dstr(d)).length + noteOf(dstr(d)).length, 0);
    return /*#__PURE__*/React.createElement("div", {
      ...swipeProps,
      style: {
        touchAction: "pan-y"
      }
    }, total === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        padding: "40px 20px",
        color: C.t4,
        background: C.surface,
        border: BD,
        borderRadius: 12,
        fontSize: 15
      }
    }, "이 주에 등록된 일정이 없습니다."), days.map(d => {
      const ds = dstr(d);
      const evs = evOf(ds);
      const isT = ds === tStr;
      const dow = d.getDay();
      return /*#__PURE__*/React.createElement("div", {
        key: ds,
        style: {
          background: C.surface,
          border: `1px solid ${isT ? C.blue + "66" : C.border}`,
          borderLeft: `4px solid ${isT ? C.blue : evs.length ? C.borderD : C.border}`,
          borderRadius: "0 11px 11px 0",
          padding: "10px 12px",
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement("div", {
        onClick: () => setSelDate(ds),
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          marginBottom: evs.length ? 9 : 0
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          minWidth: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          background: isT ? C.blue : "transparent",
          color: isT ? "#fff" : dow === 0 ? C.red : dow === 6 ? C.blue : C.t1,
          fontSize: 16,
          fontWeight: 800
        }
      }, d.getDate()), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 14,
          fontWeight: 700,
          color: dow === 0 ? C.red : dow === 6 ? C.blue : C.t2
        }
      }, DOW[dow], "요일"), isT && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          fontWeight: 800,
          color: C.blue,
          background: C.blueL,
          padding: "2px 7px",
          borderRadius: 5
        }
      }, "오늘"), /*#__PURE__*/React.createElement("span", {
        style: {
          marginLeft: "auto",
          fontSize: 13,
          fontWeight: 700,
          color: evs.length ? C.t2 : C.t4
        }
      }, evs.length + noteOf(ds).length ? `${evs.length + noteOf(ds).length}건` : "일정 없음")), evs.map((e, i) => /*#__PURE__*/React.createElement(EvRow, {
        key: i,
        e: e,
        compact: true,
        me: editor,
        onClick: () => setSelDate(ds)
      })), noteOf(ds).map((n, i) => /*#__PURE__*/React.createElement(NoteRow, {
        key: `n${i}`,
        n: n,
        compact: true,
        onClick: () => setSelDate(ds)
      })));
    }));
  };

  /* ── 일 보기 ── */
  const dayList = () => {
    const evs = evOf(cursor);
    const byKind = EV_KINDS.map(([f, l, c]) => ({
      f,
      l,
      c,
      items: evs.filter(e => e.field === f)
    })).filter(g => g.items.length);
    return /*#__PURE__*/React.createElement("div", {
      ...swipeProps,
      style: {
        touchAction: "pan-y"
      }
    }, noteOf(cursor).length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 8,
        background: C.surfaceL,
        border: `1px dashed ${C.borderD}`,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 800,
        color: C.t2
      }
    }, "✎ 메모"), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        fontSize: 14,
        fontWeight: 800,
        color: C.t2
      }
    }, noteOf(cursor).length)), noteOf(cursor).map((n, i) => /*#__PURE__*/React.createElement(NoteRow, {
      key: `n${i}`,
      n: n,
      onClick: () => setSelDate(cursor)
    }))), evs.length === 0 && noteOf(cursor).length === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        padding: "50px 20px",
        color: C.t4,
        background: C.surface,
        border: BD,
        borderRadius: 12,
        fontSize: 15
      }
    }, "이 날 등록된 일정이 없습니다."), byKind.map(g => /*#__PURE__*/React.createElement("div", {
      key: g.f,
      style: {
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 8,
        background: g.c + "14",
        border: `1px solid ${g.c}30`,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 800,
        color: g.c
      }
    }, g.l), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        fontSize: 14,
        fontWeight: 800,
        color: g.c
      }
    }, g.items.length)), g.items.map((e, i) => /*#__PURE__*/React.createElement(EvRow, {
      key: i,
      e: e,
      me: editor,
      onClick: () => setSelDate(cursor)
    })))));
  };
  return /*#__PURE__*/React.createElement("div", null, isMobile && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, viewToggle), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      marginBottom: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => shift(-1),
    style: {
      width: 44,
      height: 44,
      borderRadius: 22,
      border: BD,
      background: C.surface,
      color: C.t2,
      fontSize: 21,
      fontWeight: 700,
      cursor: "pointer",
      flexShrink: 0
    }
  }, "‹"), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      display: "flex",
      alignItems: "center",
      gap: 0
    }
  }, /*#__PURE__*/React.createElement(SelBtn, {
    main: `${aY}년`,
    isMobile: isMobile,
    onClick: () => setPicker("year")
  }), /*#__PURE__*/React.createElement(SelBtn, {
    main: `${aM}월`,
    isMobile: isMobile,
    onClick: () => setPicker("month")
  }), view === "week" && /*#__PURE__*/React.createElement(SelBtn, {
    main: `${curWeekNo}주`,
    sub: `${weekStart.getMonth() + 1}/${weekStart.getDate()}~${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`,
    isMobile: isMobile,
    onClick: () => setPicker("sub")
  }), view === "day" && /*#__PURE__*/React.createElement(SelBtn, {
    main: `${cur.getDate()}일`,
    sub: `${DOW[cur.getDay()]}요일`,
    isMobile: isMobile,
    onClick: () => setPicker("sub")
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => shift(1),
    style: {
      width: 44,
      height: 44,
      borderRadius: 22,
      border: BD,
      background: C.surface,
      color: C.t2,
      fontSize: 21,
      fontWeight: 700,
      cursor: "pointer",
      flexShrink: 0
    }
  }, "›"), /*#__PURE__*/React.createElement("button", {
    onClick: goToday,
    style: {
      marginLeft: isMobile ? "auto" : 6,
      padding: isMobile ? "11px 14px" : "11px 18px",
      borderRadius: 22,
      border: `1px solid ${C.blue}`,
      background: C.blueL,
      color: C.blue,
      fontSize: 14,
      fontWeight: 800,
      cursor: "pointer",
      flexShrink: 0
    }
  }, "오늘"), !isMobile && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), !isMobile && kindBar, !isMobile && viewToggle), !isMobile && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginBottom: 10
    }
  }, view === "month" ? "제목을 눌러 연·월 이동 · 일정을 끌어 날짜 변경 · 좌우로 밀면 달 이동" : view === "week" ? "제목을 눌러 주 선택 · 날짜를 누르면 그날 상세 · 좌우로 밀면 주 이동" : "제목을 눌러 날짜 이동 · 좌우로 밀면 하루씩 이동") , isMobile && kindBar, view === "month" ? monthGrid() : view === "week" ? isMobile ? weekList() : weekGrid() : dayList(), selDate && /*#__PURE__*/React.createElement(DayPanel, {
    dateStr: selDate,
    label: (() => {
      const d = parseD(selDate);
      return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
    })(),
    allSchools: allSchools,
    setDb: setDb,
    onClose: () => setSelDate(null),
    isMobile: isMobile,
    notes: notes,
    isAdmin: isAdmin,
    editor: editor,
    viewKinds: kinds
  }), picker && /*#__PURE__*/React.createElement(ListPicker, {
    isMobile: isMobile,
    onClose: () => setPicker(null),
    ...(picker === "year" ? {
      title: "연도 선택",
      cols: 3,
      value: aY,
      items: Array.from({
        length: 6
      }, (_, i) => new Date().getFullYear() - 3 + i).map(y => ({
        k: y,
        label: `${y}년`
      })),
      onPick: y => setYMD(y, aM, cur.getDate())
    } : picker === "month" ? {
      title: `${aY}년 · 월 선택`,
      cols: 4,
      value: aM,
      items: Array.from({
        length: 12
      }, (_, i) => i + 1).map(m => ({
        k: m,
        label: `${m}월`
      })),
      onPick: m => setYMD(aY, m, cur.getDate())
    } : view === "week" ? {
      title: `${aY}년 ${aM}월 · 주 선택`,
      cols: 1,
      value: dstr(weekStart),
      items: weeksOfMonth.map(w => ({
        k: dstr(w.s),
        label: `${w.n}주 · ${w.s.getMonth() + 1}/${w.s.getDate()} ~ ${addDays(w.s, 6).getMonth() + 1}/${addDays(w.s, 6).getDate()}`
      })),
      onPick: ds => {
        setCursor(ds);
        setSelDate(null);
      }
    } : {
      title: `${aY}년 ${aM}월 · 날짜 선택`,
      cols: 7,
      value: cur.getDate(),
      items: Array.from({
        length: new Date(aY, aM, 0).getDate()
      }, (_, i) => i + 1).map(d => ({
        k: d,
        label: String(d)
      })),
      onPick: d => setYMD(aY, aM, d)
    })
  }), /*#__PURE__*/React.createElement(Toast, {
    msg: toast
  }));
}
