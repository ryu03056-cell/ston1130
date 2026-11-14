/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 08/18 — 현장 수정 패널  (screens/08-edit-panel.js)
   │ 현장 정보·동별 정보·조사 날짜·날짜별 인원을 고치는 옆 창
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
/* 라벨 + 입력칸 — 모듈 레벨에 두어야 입력칸이 안정되고 한글(IME) 조합이 안 끊김 */
function LI({
  label,
  val,
  on,
  type = "text",
  col,
  list,
  placeholder,
  hint,
  locked
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 3
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      color: C.t3,
      fontWeight: 700
    }
  }, label, locked && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 6,
      fontSize: 12,
      color: C.t4,
      fontWeight: 600
    }
  }, "🔒 시트에서 관리")), /*#__PURE__*/React.createElement("input", {
    type: type,
    value: val,
    list: list,
    placeholder: placeholder,
    readOnly: !!locked,
    disabled: !!locked,
    title: locked ? "이 값은 스프레드시트에서 고칩니다. 앱에서는 볼 수만 있습니다." : undefined,
    onChange: e => !locked && on(e.target.value),
    style: {
      padding: "7px 9px",
      background: locked ? C.bg : C.surfaceL,
      border: BD,
      borderRadius: 6,
      color: locked ? C.t4 : col || C.t1,
      fontSize: 13,
      outline: "none",
      width: "100%",
      cursor: locked ? "not-allowed" : undefined
    }
  }), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.t4
    }
  }, hint));
}

/* 현장조사가 며칠에 걸칠 때 — 연속 기간 + 따로 떨어진 날.
   모듈 레벨에 둬야 입력 중 컴포넌트가 다시 만들어지지 않는다. */
function MultiSurvey({
  f,
  setF,
  extraIn,
  setExtraIn,
  tc
}) {
  const all = surveyDates({
    field: f.field,
    fieldEnd: f.fieldEnd,
    fieldExtra: f.fieldExtra
  });
  const runLen = f.fieldEnd && f.fieldEnd > f.field ? Math.round((parseD(f.fieldEnd) - parseD(f.field)) / 86400000) + 1 : f.field ? 1 : 0;
  const dayLabel = d => {
    const x = parseD(d);
    return `${x.getMonth() + 1}/${x.getDate()} ${DOW[x.getDay()]}`;
  };
  const addExtra = () => {
    const v = (extraIn || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    if (all.includes(v)) {
      setExtraIn("");
      return;
    }
    setF(p => ({
      ...p,
      fieldExtra: [...(p.fieldExtra || []), v].sort()
    }));
    setExtraIn("");
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${tc.a}40`,
      borderRadius: 9,
      padding: 11,
      background: tc.a + "0a"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.t3,
      fontWeight: 700,
      flexShrink: 0
    }
  }, "~"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: f.fieldEnd || "",
    min: f.field || undefined,
    onChange: e => setF(p => ({
      ...p,
      fieldEnd: e.target.value
    })),
    style: {
      flex: 1,
      minWidth: 0,
      padding: "7px 9px",
      background: C.surface,
      border: BD,
      borderRadius: 6,
      color: tc.a,
      fontSize: 13,
      outline: "none"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      flexWrap: "wrap",
      marginTop: 7,
      paddingBottom: 9,
      borderBottom: `1px solid ${tc.a}30`
    }
  }, runLen > 1 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: tc.a,
      background: C.surface,
      border: `1px solid ${tc.a}45`,
      borderRadius: 6,
      padding: "3px 9px"
    }
  }, "연속 ", runLen, "일"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.t3
    }
  }, f.fieldEnd && f.fieldEnd < f.field ? "종료일이 시작일보다 앞이라 무시됩니다" : runLen > 1 ? all.slice(0, runLen).map(dayLabel).join(" · ") : "종료일을 비우면 하루짜리입니다")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: tc.a,
      margin: "9px 0 6px"
    }
  }, "따로 떨어진 날"), (f.fieldExtra || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 7
    }
  }, (f.fieldExtra || []).map(d => /*#__PURE__*/React.createElement("span", {
    key: d,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: 13,
      fontWeight: 700,
      background: C.surface,
      border: BD,
      borderRadius: 6,
      padding: "5px 7px 5px 10px",
      color: C.t1
    }
  }, dayLabel(d), /*#__PURE__*/React.createElement("button", {
    onClick: () => setF(p => ({
      ...p,
      fieldExtra: (p.fieldExtra || []).filter(x => x !== d)
    })),
    style: {
      width: 20,
      height: 20,
      borderRadius: "50%",
      border: "none",
      background: C.redL,
      color: C.red,
      fontSize: 13,
      fontWeight: 800,
      cursor: "pointer",
      lineHeight: 1,
      padding: 0
    }
  }, "×")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: extraIn,
    onChange: e => setExtraIn(e.target.value),
    style: {
      flex: 1,
      minWidth: 0,
      padding: "7px 9px",
      background: C.surface,
      border: BD,
      borderRadius: 6,
      color: C.t1,
      fontSize: 13,
      outline: "none"
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: addExtra,
    style: {
      flexShrink: 0,
      padding: "7px 15px",
      borderRadius: 7,
      border: `1px solid ${tc.a}50`,
      background: C.surface,
      color: tc.a,
      fontSize: 13,
      fontWeight: 800,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "+ 추가")), all.length > 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t2,
      marginTop: 9,
      fontWeight: 700
    }
  }, "총 ", all.length, "일 — ", all.map(dayLabel).join(", ")), all.length > 1 && /*#__PURE__*/React.createElement(DayWho, {
    days: all,
    f: f,
    setF: setF,
    tc: tc,
    dayLabel: dayLabel
  }));
}

/* 날짜별 조사 인원 — 날마다 가는 사람이 다를 수 있다.
   따로 정하지 않은 날은 기본 인원이 그대로 간다. */
function DayWho({
  days,
  f,
  setF,
  tc,
  dayLabel
}) {
  const [open, setOpen] = useState(null);
  const base = sortMembers(f.assignees || []);
  const whoOf = d => {
    const w = f.fieldWho && f.fieldWho[d];
    return Array.isArray(w) ? sortMembers(w) : base;
  };
  const own = d => Array.isArray(f.fieldWho && f.fieldWho[d]);
  const setWho = (d, list) => setF(p => ({
    ...p,
    fieldWho: {
      ...(p.fieldWho || {}),
      [d]: sortMembers(list)
    }
  }));
  const resetDay = d => setF(p => {
    const n = {
      ...(p.fieldWho || {})
    };
    delete n[d];
    return {
      ...p,
      fieldWho: n
    };
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: `1px solid ${tc.a}30`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: tc.a,
      marginBottom: 3
    }
  }, "날짜별 조사 인원"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginBottom: 8
    }
  }, "정하지 않은 날은 기본 인원(", base.join("·") || "미배정", ")이 그대로 갑니다"), days.map(d => {
    const list = whoOf(d);
    const mine = own(d);
    const avail = allMembers().filter(n => !list.includes(n));
    return /*#__PURE__*/React.createElement("div", {
      key: d,
      style: {
        background: C.surface,
        border: `1px solid ${mine ? tc.a + "50" : C.border}`,
        borderRadius: 8,
        padding: "9px 10px",
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        marginBottom: 7
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 800,
        color: C.t1,
        minWidth: 68
      }
    }, dayLabel(d)), mine ? /*#__PURE__*/React.createElement("button", {
      onClick: () => resetDay(d),
      style: {
        marginLeft: "auto",
        padding: "4px 9px",
        borderRadius: 6,
        border: `1px solid ${C.border}`,
        background: "transparent",
        color: C.t3,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }
    }, "기본으로") : /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        fontSize: 12,
        color: C.t4
      }
    }, "기본 인원")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 5,
        alignItems: "center"
      }
    }, list.map(n => /*#__PURE__*/React.createElement("span", {
      key: n,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 13,
        fontWeight: 700,
        background: C.surfaceL,
        border: BD,
        borderRadius: 20,
        padding: "4px 6px 4px 11px",
        color: C.t1
      }
    }, n, /*#__PURE__*/React.createElement("button", {
      onClick: () => setWho(d, list.filter(x => x !== n)),
      style: {
        width: 18,
        height: 18,
        borderRadius: "50%",
        border: "none",
        background: C.redL,
        color: C.red,
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
        lineHeight: 1,
        padding: 0
      }
    }, "×"))), list.length === 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.orange,
        fontWeight: 700
      }
    }, "이 날은 미배정"), avail.length > 0 && /*#__PURE__*/React.createElement("button", {
      onClick: () => setOpen(open === d ? null : d),
      style: {
        width: 28,
        height: 28,
        borderRadius: "50%",
        border: `1px solid ${tc.a}`,
        background: open === d ? tc.a : C.surface,
        color: open === d ? "#fff" : tc.a,
        fontSize: 16,
        fontWeight: 700,
        cursor: "pointer",
        lineHeight: 1,
        padding: 0,
        flexShrink: 0
      }
    }, "+")), open === d && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 5,
        marginTop: 8,
        paddingTop: 8,
        borderTop: `1px solid ${C.border}`
      }
    }, avail.map(n => /*#__PURE__*/React.createElement("button", {
      key: n,
      onClick: () => {
        setWho(d, [...list, n]);
        setOpen(null);
      },
      style: {
        padding: "6px 11px",
        borderRadius: 20,
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        background: C.surfaceL,
        color: C.t1,
        border: BD
      }
    }, rankOf(n) ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        opacity: .7,
        marginRight: 4
      }
    }, rankOf(n)) : null, n))));
  }));
}

/* ══════════════════════════════════════════════════════════════
   현장 수정 슬라이드 패널 (학교 + 동별)
══════════════════════════════════════════════════════════════ */
function EditPanel({
  sc,
  yr,
  half,
  setDb,
  onClose,
  isNew
}) {
  const isMobile = useIsMobile();
  /* 시트와 연동된 현장이면 착수·완수일을 잠근다 (시트가 주인) */
  const sheetLinked = !isNew && typeof window.__stonSheetLinked === "function" && window.__stonSheetLinked(sc.id);
  const [nameErr, setNameErr] = useState("");
  /* 현장조사가 며칠에 걸칠 때만 펼친다 (기본은 하루) */
  const [multiOpen, setMultiOpen] = useState(!!(sc.fieldEnd || (sc.fieldExtra || []).length));
  const [extraIn, setExtraIn] = useState("");
  const tc = {
    a: C.blue,
    b: C.blueL,
    c: C.t2
  };
  const [f, setF] = useState({
    school: sc.school || "",
    no: sc.no || "",
    region: sc.region || "",
    kind: sc.kind || "정기점검",
    field: sc.field || "",
    fieldEnd: sc.fieldEnd || "",
    fieldExtra: (sc.fieldExtra || []).slice(),
    fieldWho: {
      ...(sc.fieldWho || {})
    },
    start: sc.start || "",
    deliverDate: sc.deliverDate || "",
    end: sc.end || "",
    assignees: sc.assignees || [],
    tel: sc.tel || "",
    flags: getFlags(sc),
    isNew: isNewSite(sc),
    tentative: !!sc.tentative,
    memo: sc.memo || ""
  });
  const [bf, setBf] = useState(sc.buildings.map(b => ({
    b: b.b || "",
    cat: bldCat(b),
    /* 동별 종류가 없으면 기존 학교 종류를 물려받는다 (지금과 똑같이 보이도록) */
    kind: bldKind(b) || kindToBK(sc.kind),
    floor: b.floor || "",
    area: b.area ? String(b.area) : "",
    fms: b.fms || "",
    note: b.note || "",
    rep: !!b.rep,
    fmsD: !!b.fmsD,
    delivery: b.delivery || "",
    height: b.height ?? null,
    len: b.len ?? null,
    jong: b.jong ?? null,
    budget: b.budget ?? null
  })));
  const [prog, setProg] = useState(() => {
    const o = {};
    STEPS.forEach(k => {
      o[k] = !!(sc.progress && sc.progress[k]);
    });
    return o;
  });
  const [saved, setSaved] = useState(false);
  const progDone = STEPS.filter(k => prog[k]).length;
  const toggleStep = k => setProg(p => ({
    ...p,
    [k]: !p[k]
  }));
  const [confirmDel, setConfirmDel] = useState(false); // 삭제 확인 창

  const save = () => {
    /* 새로 만드는 현장은 이름이 있어야 저장된다 */
    if (isNew && !String(f.school || "").trim()) {
      setNameErr("현장명을 입력해 주세요.");
      return;
    }
    setNameErr("");
    const beforeStr = `${(sc.assignees || []).join(",") || "-"} · 진행 ${STEPS.filter(k => sc.progress && sc.progress[k]).length}/${STEPS.length}`;
    const afterStr = `${f.assignees.join(",") || "-"} · 진행 ${STEPS.filter(k => prog[k]).length}/${STEPS.length}`;
    setDb(prev => {
      const next = {
        ...prev
      };
      next[yr] = {
        ...(prev[yr] || {})
      };
      const arr = prev[yr]?.[half] || [];
      const build = s => stampEdit({
          ...s,
          school: f.school || s.school,
          no: f.no,
          region: f.region,
          kind: f.kind,
          field: f.field,
          fieldEnd: (f.fieldEnd || "") > (f.field || "") ? f.fieldEnd : "",
          fieldExtra: (f.fieldExtra || []).filter(Boolean),
          /* 조사가 하루로 돌아가면 날짜별 인원은 의미가 없으므로 비운다 */
          fieldWho: (() => {
            const days = surveyDates({
              field: f.field,
              fieldEnd: (f.fieldEnd || "") > (f.field || "") ? f.fieldEnd : "",
              fieldExtra: f.fieldExtra
            });
            if (days.length <= 1) return null;
            const out = {};
            days.forEach(d => {
              const w = f.fieldWho && f.fieldWho[d];
              if (Array.isArray(w)) out[d] = sortMembers(w);
            });
            return Object.keys(out).length ? out : null;
          })(),
          start: f.start,
          deliverDate: f.deliverDate,
          end: f.end,
          isNew: !!f.isNew,
          /* 신규를 끄면 엑셀에서 들어온 '신규' 회차 표시도 함께 지운다.
             안 지우면 isNewSite 가 round 를 보고 계속 신규로 판정한다. */
          round: f.isNew ? sc.round || "신규" : String(sc.round || "").includes("신규") ? "" : sc.round || "",
          tentative: !!f.tentative,
          memo: (f.memo || "").trim(),
          tel: (f.tel || "").trim(),
          flags: [...(f.flags || [])],
          assignees: sortMembers(f.assignees),
          headcount: f.assignees.length || s.headcount,
          progress: {
            ...prog
          },
          buildings: bf.map(b => ({
            b: b.b || "동",
            cat: b.cat || "건축",
            kind: b.kind || "정기",
            floor: b.floor || null,
            area: b.area ? parseFloat(b.area) : null,
            fms: b.fms || null,
            note: b.note || null,
            rep: b.rep,
            fmsD: b.fmsD,
            delivery: b.delivery || null,
            height: b.height ?? null,
            len: b.len ?? null,
            jong: b.jong ?? null,
            budget: b.budget ?? null
          }))
        }, isNew ? "현장 추가" : "현장 정보 수정");
      /* 목록에 없으면(=새 현장) 이때 비로소 추가된다 → 취소하면 아무것도 안 남는다 */
      next[yr][half] = arr.some(s => s.id === sc.id) ? arr.map(s => s.id === sc.id ? build(s) : s) : [...arr, build(sc)];
      return next;
    });
    logAction(isNew ? "추가" : "수정", `현장 · ${f.school || sc.school}`, isNew ? null : beforeStr, afterStr);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1100);
  };

  /* 삭제는 두 단계 — 버튼을 눌러도 바로 지워지지 않고 확인 창을 한 번 더 거친다 */
  /* 실제로 지우지 않고 휴지통으로 — 설정 → 휴지통에서 되살릴 수 있음 */
  const doDelete = () => {
    setDb(prev => {
      const next = {
        ...prev
      };
      next[yr] = {
        ...(prev[yr] || {})
      };
      next[yr][half] = (prev[yr]?.[half] || []).map(s => s.id !== sc.id ? s : {
        ...s,
        deleted: true,
        deletedAt: Date.now(),
        deletedBy: typeof CURRENT_USER !== "undefined" && (CURRENT_USER.name || CURRENT_USER.email) || "알수없음"
      });
      return next;
    });
    logAction("삭제", `현장 · ${sc.school}`, sc.school, "휴지통으로 이동");
    setConfirmDel(false);
    onClose();
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(30,35,50,.35)",
      backdropFilter: "blur(2px)",
      zIndex: 300
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      top: 0,
      right: 0,
      width: 520,
      maxWidth: "94vw",
      height: "100vh",
      background: C.surface,
      borderLeft: `3px solid ${tc.a}`,
      zIndex: 301,
      display: "flex",
      flexDirection: "column",
      boxShadow: "-8px 0 32px rgba(0,0,0,.16)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "18px 22px 14px",
      paddingTop: "calc(18px + env(safe-area-inset-top))",
      borderBottom: BD,
      flexShrink: 0,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: tc.a,
      fontWeight: 700,
      marginBottom: 3
    }
  }, isNew ? "➕ 새 현장 · " : "✏ 현장 수정 · ", yr, " ", half), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 800,
      color: C.t1
    }
  }, f.school || (isNew ? "새 현장" : sc.school)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      marginTop: 2
    }
  }, f.region || "지역 미입력", " · ", bf.length, "동", f.no ? ` · No.${f.no}` : "")), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: 28,
      height: 28,
      borderRadius: "50%",
      background: C.surfaceL,
      border: BD,
      color: C.t3,
      fontSize: 17,
      cursor: "pointer"
    }
  }, "×")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "16px 22px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      background: C.surfaceL,
      borderRadius: 10,
      border: BD,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: C.t2,
      marginBottom: 12
    }
  }, "🏫 학교 기본 정보"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "span 2"
    }
  }, /*#__PURE__*/React.createElement(LI, {
    label: "🏫 학교명 / 현장명",
    val: f.school,
    on: v => setF(p => ({
      ...p,
      school: v
    })),
    placeholder: "예: 김포양곡중학교",
    locked: sheetLinked
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "span 2"
    }
  }, /*#__PURE__*/React.createElement(LI, {
    label: "📍 지역",
    val: f.region,
    on: v => setF(p => ({
      ...p,
      region: v
    })),
    list: "region-list",
    placeholder: "예: 김포 · 남양주 · 수원",
    hint: "지도에서 현장 위치를 잡을 때 쓰입니다",
    locked: sheetLinked
  }), /*#__PURE__*/React.createElement("datalist", {
    id: "region-list"
  }, Object.keys(REGION_XY).map(r => /*#__PURE__*/React.createElement("option", {
    key: r,
    value: r
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "span 2"
    }
  }, /*#__PURE__*/React.createElement(LI, {
    label: "No (관리번호 · 선택)",
    val: f.no,
    on: v => setF(p => ({
      ...p,
      no: v
    })),
    locked: sheetLinked
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "span 2",
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      color: C.t3,
      fontWeight: 700
    }
  }, "구분", sheetLinked && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 6,
      fontSize: 12,
      color: C.t4,
      fontWeight: 600
    }
  }, "🔒 시트 A열에서 관리")), /*#__PURE__*/React.createElement("button", {
    onClick: () => !sheetLinked && setF(p => ({
      ...p,
      isNew: !p.isNew
    })),
    disabled: sheetLinked,
    title: sheetLinked ? "시트 A열에 '신규' 가 있으면 신규 현장입니다" : undefined,
    style: {
      opacity: sheetLinked ? .6 : 1,
      cursor: sheetLinked ? "not-allowed" : "pointer",
      alignSelf: "flex-start",
      padding: "9px 15px",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 800,
      cursor: "pointer",
      border: `1px solid ${f.isNew ? C.red : C.border}`,
      background: f.isNew ? C.redL : "transparent",
      color: f.isNew ? C.red : C.t3
    }
  }, f.isNew ? "✓ 🆕 신규 현장" : "🆕 신규 현장"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginTop: -1
    }
  }, "신규는 보고서 작성에 시간이 더 듭니다"), /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      color: C.t3,
      fontWeight: 700,
      marginTop: 6
    }
  }, "현장 표시 ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t4,
      fontWeight: 500
    }
  }, "· 여러 개 선택 가능")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, FLAG_OPTS.map(o => {
    const on = (f.flags || []).includes(o.v);
    return /*#__PURE__*/React.createElement("button", {
      key: o.v,
      onClick: () => setF(p => ({
        ...p,
        flags: on ? (p.flags || []).filter(x => x !== o.v) : [...(p.flags || []), o.v]
      })),
      style: {
        flex: "1 0 auto",
        minWidth: 74,
        padding: "8px 10px",
        borderRadius: 7,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        border: `1px solid ${on ? o.color : C.border}`,
        background: on ? o.color + "18" : "transparent",
        color: on ? o.color : C.t3
      }
    }, on && "✓ ", o.label);
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "span 2"
    }
  }, /*#__PURE__*/React.createElement(LI, {
    label: "학교 연락처 (현장에서 바로 통화)",
    val: f.tel,
    on: v => setF(p => ({
      ...p,
      tel: v
    }))
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 3
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      color: C.t3,
      fontWeight: 700
    }
  }, "점검종류"), /*#__PURE__*/React.createElement("select", {
    value: f.kind,
    disabled: sheetLinked,
    title: sheetLinked ? "시트에서 관리" : undefined,
    onChange: e => setF(p => ({
      ...p,
      kind: e.target.value
    })),
    style: {
      padding: "7px 9px",
      background: C.surfaceL,
      border: BD,
      borderRadius: 6,
      color: C.t1,
      fontSize: 13,
      outline: "none"
    }
  }, [...new Set([...["정기점검", "정밀점검", "내진성능", "구조감리", "내진보강설계", "구조검토"], ...(f.kind ? [f.kind] : [])])].map(k => /*#__PURE__*/React.createElement("option", {
    key: k
  }, k)))), /*#__PURE__*/React.createElement(LI, {
    label: "▶ 착수일",
    val: f.start,
    on: v => setF(p => ({
      ...p,
      start: v
    })),
    type: "date",
    col: C.green,
    locked: sheetLinked
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "span 2",
      display: "flex",
      flexDirection: "column",
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      color: multiOpen ? tc.a : C.t3,
      fontWeight: 700,
      flex: 1
    }
  }, "◆ 현장조사일", surveyDates({
    field: f.field,
    fieldEnd: f.fieldEnd,
    fieldExtra: f.fieldExtra
  }).length > 1 ? ` · 총 ${surveyDates({
    field: f.field,
    fieldEnd: f.fieldEnd,
    fieldExtra: f.fieldExtra
  }).length}일` : "", sheetLinked && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 6,
      fontSize: 12,
      color: C.t4,
      fontWeight: 600
    }
  }, "🔒 첫날은 시트에서 관리")), multiOpen && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setMultiOpen(false);
      setF(p => ({
        ...p,
        fieldEnd: "",
        fieldExtra: []
      }));
    },
    style: {
      padding: "5px 11px",
      borderRadius: 7,
      border: `1px solid ${C.border}`,
      background: "transparent",
      color: C.t3,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "하루로 되돌리기")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: f.field,
    readOnly: sheetLinked,
    disabled: sheetLinked,
    title: sheetLinked ? "첫날은 스프레드시트에서 고칩니다. 여러 날은 + 로 앱에서 붙일 수 있습니다." : undefined,
    onChange: e => !sheetLinked && setF(p => ({
      ...p,
      field: e.target.value
    })),
    style: {
      flex: 1,
      minWidth: 0,
      padding: "7px 9px",
      background: sheetLinked ? C.bg : C.surfaceL,
      border: BD,
      borderRadius: 6,
      color: sheetLinked ? C.t4 : tc.a,
      fontSize: 13,
      outline: "none",
      cursor: sheetLinked ? "not-allowed" : undefined
    }
  }), !multiOpen && /*#__PURE__*/React.createElement("button", {
    onClick: () => setMultiOpen(true),
    title: "며칠에 걸치면 누르세요",
    style: {
      flexShrink: 0,
      width: 40,
      height: 38,
      borderRadius: 8,
      border: `1px solid ${C.border}`,
      background: C.surface,
      color: C.t2,
      fontSize: 20,
      fontWeight: 700,
      cursor: "pointer",
      lineHeight: 1
    }
  }, "+")), !multiOpen && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.t4
    }
  }, "며칠에 걸치면 + 를 누르세요"), multiOpen && /*#__PURE__*/React.createElement(MultiSurvey, {
    f: f,
    setF: setF,
    extraIn: extraIn,
    setExtraIn: setExtraIn,
    tc: tc
  })), /*#__PURE__*/React.createElement(LI, {
    label: "■ 납품일",
    val: f.deliverDate,
    on: v => setF(p => ({
      ...p,
      deliverDate: v
    })),
    type: "date",
    col: C.purple,
    hint: deliverLate(f) ? `⚠ 완수일 ${DELIVER_LEAD}일 전까지 권장` : null,
    locked: sheetLinked
  }), /*#__PURE__*/React.createElement(LI, {
    label: "● 완수일",
    val: f.end,
    on: v => setF(p => ({
      ...p,
      end: v
    })),
    type: "date",
    col: C.orange,
    locked: sheetLinked
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "span 2",
      display: "flex",
      flexDirection: "column",
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      color: C.t3,
      fontWeight: 700
    }
  }, "투입 인원 ", /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 6,
      color: C.blue
    }
  }, f.assignees.length > 0 ? `${f.assignees.length}명` : "미선택")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 10,
      background: C.surfaceL,
      borderRadius: 8,
      border: BD,
      display: "flex",
      flexWrap: "wrap",
      gap: 5
    }
  }, allMembers().map(name => {
    const on = f.assignees.includes(name);
    const mc = memberColor(name);
    return /*#__PURE__*/React.createElement("button", {
      key: name,
      onClick: () => setF(p => ({
        ...p,
        assignees: on ? p.assignees.filter(n => n !== name) : [...p.assignees, name]
      })),
      style: {
        padding: "6px 12px",
        borderRadius: 20,
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        background: on ? mc : C.surface,
        color: on ? "#fff" : mc,
        border: `1px solid ${on ? mc : mc + "40"}`
      }
    }, on && "✓ ", rankOf(name) ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        opacity: .7,
        marginRight: 4
      }
    }, rankOf(name)) : null, name);
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      background: C.surfaceL,
      borderRadius: 10,
      border: BD,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: C.t2
    }
  }, "📋 업무 진행 단계", sheetLinked && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 6,
      fontSize: 12,
      color: C.t4,
      fontWeight: 600
    }
  }, "🔒 시트에서 관리")), sheetLinked ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      fontSize: 14,
      fontWeight: 800,
      color: flowProgress(sc.flow || {}).done === 16 ? C.green : tc.a
    }
  }, flowProgress(sc.flow || {}).done, "/16") : /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      fontSize: 14,
      fontWeight: 800,
      color: progDone === STEPS.length ? C.green : tc.a
    }
  }, progDone, "/", STEPS.length, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginLeft: 4,
      fontWeight: 600
    }
  }, Math.round(progDone / STEPS.length * 100), "%"))), /*#__PURE__*/sheetLinked ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(Flow16Bar, {
    flow: sc.flow || {}
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(2,1fr)",
      gap: 7
    }
  }, [["📝 준비", ["계약서발송", "착수계발송", "앱야장작성"]], ["📍 현장", ["현장조사", "야장엑셀화", "체크리스트"]], ["📄 보고서", ["부록작업", "워드생성", "워드수정", "PDF"]], ["🔍 검수", ["검토", "검수", "제본"]], ["📦 마무리", ["납품", "완수계발송", "계산서발행"]]].map(([grp, keys]) => /*#__PURE__*/React.createElement("div", {
    key: grp,
    style: {
      padding: "9px 11px",
      borderRadius: 8,
      background: C.surface,
      border: BD
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: C.t3,
      marginBottom: 6
    }
  }, grp), keys.map(k => {
    const on = flowDone((sc.flow || {})[k]);
    const v = (sc.flow || {})[k];
    const isDate = typeof v === "string" && /\d{4}/.test(v);
    return /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "3px 0",
        fontSize: 12,
        color: on ? C.t1 : C.t4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: on ? C.blue : "transparent",
        border: `1px solid ${on ? C.blue : C.border}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: 12,
        fontWeight: 800,
        flexShrink: 0
      }
    }, on ? "✓" : ""), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: on ? 700 : 500
      }
    }, k), isDate && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        fontSize: 12,
        color: C.t4
      }
    }, (v.match(/(\d{4})-(\d{2})-(\d{2})/) || [])[0] || ""));
  }))))) : /*#__PURE__*/React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      display: "flex",
      gap: 3,
      marginBottom: 12
    }
  }, STEPS.map(k => {
    const on = prog[k],
      sp = STEP_SPECIAL[k],
      col = sp ? C.purple : C.blue;
    return /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        flex: 1,
        height: 8,
        borderRadius: 3,
        background: on ? col : C.surfaceD,
        border: sp ? `1px solid ${on ? col : col + "55"}` : "none",
        boxSizing: "border-box"
      }
    });
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(2,1fr)",
      gap: 7
    }
  }, STEPS.map((k, i) => {
    const on = prog[k],
      sp = STEP_SPECIAL[k],
      col = sp ? C.purple : k === "완수" ? C.green : C.blue;
    return /*#__PURE__*/React.createElement("button", {
      key: k,
      onClick: () => toggleStep(k),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 11px",
        borderRadius: 8,
        cursor: "pointer",
        background: on ? col + "12" : C.surface,
        border: `1px solid ${on ? col : sp ? col + "40" : C.border}`,
        textAlign: "left"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 24,
        height: 24,
        borderRadius: "50%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 800,
        background: on ? col : C.surfaceD,
        color: on ? "#fff" : C.t4
      }
    }, on ? "✓" : i + 1), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15
      }
    }, STEP_ICON[k]), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: on ? col : C.t2,
        flex: 1
      }
    }, k, STEP_DESC[k] && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: C.t4,
        marginLeft: 5
      }
    }, STEP_DESC[k])), sp && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: C.purple,
        background: C.purpleL,
        padding: "1px 5px",
        borderRadius: 3
      }
    }, "중요"));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginTop: 8
    }
  }, "* 단계를 눌러 완료/미완료를 전환하세요. 검토·제본은 별도 강조됩니다.")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: C.t2,
      marginBottom: 10
    }
  }, "🏗 시설물 (동) 수정"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginTop: -6,
      marginBottom: 8
    }
  }, (() => {
    const cc = catCounts({
      buildings: bf
    });
    return `건축물 ${cc.건축} · 토목(종) ${cc.토목종} · 토목(소) ${cc.토목소}`;
  })()), bf.map((b, bi) => /*#__PURE__*/React.createElement("div", {
    key: bi,
    style: {
      padding: 14,
      background: C.surface,
      borderRadius: 10,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${tc.a}`,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 20,
      height: 20,
      borderRadius: "50%",
      background: tc.b,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 12,
      fontWeight: 700,
      color: tc.a
    }
  }, bi + 1), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.t1,
      flex: 1
    }
  }, b.b || `${bi + 1}번 동`), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4
    }
  }, [{
    k: "보고서",
    f: "rep",
    ac: C.purple,
    bc: C.purpleL
  }, {
    k: "FMS",
    f: "fmsD",
    ac: C.blue,
    bc: C.blueL
  }].map(x => /*#__PURE__*/React.createElement("button", {
    key: x.f,
    onClick: () => setBf(p => p.map((v, i) => i !== bi ? v : {
      ...v,
      [x.f]: !v[x.f]
    })),
    style: {
      padding: isMobile ? "9px 11px" : "3px 8px",
      borderRadius: 5,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      border: `1px solid ${b[x.f] ? x.ac + "60" : C.border}`,
      background: b[x.f] ? x.bc : C.surfaceL,
      color: b[x.f] ? x.ac : C.t4
    }
  }, b[x.f] ? "✓ " : "", x.k)), ["직납", "우편"].map(dv => /*#__PURE__*/React.createElement("button", {
    key: dv,
    onClick: () => setBf(p => p.map((v, i) => i !== bi ? v : {
      ...v,
      delivery: v.delivery === dv ? "" : dv
    })),
    style: {
      padding: isMobile ? "9px 10px" : "3px 7px",
      borderRadius: 5,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      border: `1px solid ${b.delivery === dv ? C.green + "60" : C.border}`,
      background: b.delivery === dv ? C.greenL : C.surfaceL,
      color: b.delivery === dv ? C.green : C.t4
    }
  }, dv[0])), /*#__PURE__*/React.createElement("button", {
    onClick: () => setBf(p => p.filter((_, i) => i !== bi)),
    style: {
      padding: isMobile ? "9px 10px" : "3px 6px",
      borderRadius: 5,
      fontSize: 12,
      cursor: "pointer",
      border: `1px solid ${C.red}30`,
      background: C.redL,
      color: C.red,
      fontWeight: 700
    }
  }, "✕"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr",
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: isMobile ? "span 2" : "span 3",
      display: "flex",
      gap: 6,
      marginBottom: 2
    }
  }, CATS.map(ct => {
    const on = (b.cat || "건축") === ct.v;
    return /*#__PURE__*/React.createElement("button", {
      key: ct.v,
      onClick: () => setBf(p => p.map((x, i) => i !== bi ? x : {
        ...x,
        cat: ct.v
      })),
      style: {
        flex: 1,
        padding: "9px 4px",
        borderRadius: 7,
        fontSize: 13,
        fontWeight: on ? 800 : 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        border: `1px solid ${on ? ct.color : C.border}`,
        background: on ? ct.color + "18" : "transparent",
        color: on ? ct.color : C.t3
      }
    }, on ? "✓ " : "", ct.label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: isMobile ? "span 2" : "span 3",
      background: C.surfaceL,
      border: BD,
      borderRadius: 8,
      padding: 9,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: C.t4,
      marginBottom: 6
    }
  }, "점검종류"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 5,
      flexWrap: "wrap"
    }
  }, BKINDS.map(bk => {
    const on = (b.kind || "정기") === bk.v;
    return /*#__PURE__*/React.createElement("button", {
      key: bk.v,
      onClick: () => !sheetLinked && setBf(p => p.map((x, i) => i !== bi ? x : {
        ...x,
        kind: bk.v
      })),
      disabled: sheetLinked,
      style: {
        flex: "1 1 auto",
        minWidth: 60,
        padding: "8px 6px",
        borderRadius: 7,
        fontSize: 13,
        fontWeight: on ? 800 : 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        border: `1px solid ${on ? bk.color : C.border}`,
        background: on ? bk.color + "18" : C.surface,
        color: on ? bk.color : C.t3
      }
    }, on ? "✓ " : "", bk.label);
  }))), /*#__PURE__*/React.createElement(LI, {
    label: "동명",
    val: b.b,
    on: v => setBf(p => p.map((x, i) => i !== bi ? x : {
      ...x,
      b: v
    })),
    locked: sheetLinked
  }), b.field && /*#__PURE__*/React.createElement(LI, {
    label: "◆ 이 동만 조사일",
    val: b.field,
    on: () => {},
    type: "date",
    col: C.blue,
    hint: "시트 시설물 행에 넣은 날짜 — 이 동은 이 날 따로 갑니다",
    locked: true
  }), /*#__PURE__*/(isCivilB(b) ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(LI, {
    label: "연장 m",
    val: b.len ?? "",
    on: v => setBf(p => p.map((x, i) => i !== bi ? x : {
      ...x,
      len: v
    })),
    type: "number",
    locked: sheetLinked
  }), /*#__PURE__*/React.createElement(LI, {
    label: "높이 m",
    val: b.height ?? "",
    on: v => setBf(p => p.map((x, i) => i !== bi ? x : {
      ...x,
      height: v
    })),
    type: "number",
    locked: sheetLinked
  })) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(LI, {
    label: "층수",
    val: b.floor,
    on: v => setBf(p => p.map((x, i) => i !== bi ? x : {
      ...x,
      floor: v
    })),
    locked: sheetLinked
  }), /*#__PURE__*/React.createElement(LI, {
    label: "연면적㎡",
    val: b.area,
    on: v => setBf(p => p.map((x, i) => i !== bi ? x : {
      ...x,
      area: v
    })),
    type: "number",
    locked: sheetLinked
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      color: C.t3,
      fontWeight: 700,
      display: "block",
      marginBottom: 3
    }
  }, "FMS 계정 (아이디 // 비밀번호)"), /*#__PURE__*/React.createElement("input", {
    value: b.fms,
    disabled: sheetLinked,
    title: sheetLinked ? "시트에서 관리" : undefined,
    onChange: e => !sheetLinked && setBf(p => p.map((x, i) => i !== bi ? x : {
      ...x,
      fms: e.target.value
    })),
    placeholder: "아이디 // 비밀번호",
    style: {
      width: "100%",
      padding: "7px 9px",
      background: sheetLinked ? C.bg : C.surfaceL,
      border: BD,
      borderRadius: 6,
      color: C.blue,
      fontSize: 13,
      outline: "none",
      fontFamily: "monospace"
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      color: C.t3,
      fontWeight: 700,
      display: "block",
      marginBottom: 3
    }
  }, "특이사항 / 메모"), /*#__PURE__*/React.createElement("textarea", {
    value: b.note,
    onChange: e => setBf(p => p.map((x, i) => i !== bi ? x : {
      ...x,
      note: e.target.value
    })),
    placeholder: "담당자 연락처, 주의사항...",
    rows: 2,
    style: {
      width: "100%",
      padding: "7px 9px",
      background: C.surfaceL,
      border: BD,
      borderRadius: 6,
      color: C.t1,
      fontSize: 13,
      outline: "none",
      resize: "vertical",
      lineHeight: 1.5
    }
  })))), /*#__PURE__*/React.createElement("button", {
    onClick: () => sheetLinked ? showToast("동은 스프레드시트의 시설물 행에서 추가합니다") : setBf(p => [...p, {
      b: "",
      cat: "건축",
      kind: kindToBK(sc.kind),
      floor: "",
      area: "",
      fms: "",
      note: "",
      rep: false,
      fmsD: false,
      delivery: ""
    }]),
    style: {
      width: "100%",
      padding: 9,
      borderRadius: 8,
      border: `1.5px dashed ${C.border}`,
      background: "transparent",
      color: C.t3,
      fontSize: 14,
      cursor: "pointer",
      marginBottom: 8
    }
  }, "+ 동 추가")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: nameErr ? "0 22px 8px" : "0",
      fontSize: 13,
      fontWeight: 700,
      color: C.red
    }
  }, nameErr ? `⚠ ${nameErr}` : null), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 22px",
      paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
      borderTop: BD,
      flexShrink: 0,
      display: "flex",
      gap: 8
    }
  }, !isNew && /*#__PURE__*/React.createElement("button", {
    onClick: () => sheetLinked ? window.alert("이 현장은 스프레드시트에서 관리됩니다.\n지우려면 시트에서 행을 지우세요.\n시트에서 지우면 5분 안에 앱에서도 지울 수 있게 됩니다.") : setConfirmDel(true),
    title: sheetLinked ? "시트에서 관리 — 앱에서 지울 수 없음" : "현장 삭제",
    style: {
      flexShrink: 0,
      padding: "11px 14px",
      borderRadius: 9,
      border: `1px solid ${C.red}40`,
      background: C.redL,
      color: C.red,
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "🗑 삭제"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      flex: 1,
      padding: 11,
      borderRadius: 9,
      border: BD,
      background: "transparent",
      color: C.t3,
      fontSize: 15,
      cursor: "pointer"
    }
  }, "취소"), /*#__PURE__*/React.createElement("button", {
    onClick: save,
    style: {
      flex: 2,
      padding: 11,
      borderRadius: 9,
      background: saved ? C.green : C.blue,
      border: "none",
      color: "#fff",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
      transition: "background .3s",
      boxShadow: `0 4px 14px ${saved ? C.green : C.blue}40`
    }
  }, saved ? "✓ 저장됨!" : isNew ? "✓ 이대로 현장 추가" : "✓ 저장 · 캘린더 자동 반영"))), confirmDel && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: () => setConfirmDel(false),
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
      top: "50%",
      left: "50%",
      transform: "translate(-50%,-50%)",
      zIndex: 401,
      width: 340,
      maxWidth: "90vw",
      background: C.surface,
      borderRadius: 16,
      padding: "22px 20px 18px",
      boxShadow: "0 20px 60px rgba(20,30,50,.35)",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 34,
      marginBottom: 10
    }
  }, "🗑"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 800,
      color: C.t1,
      marginBottom: 8
    }
  }, "진짜로 삭제하시겠습니까?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: C.red,
      marginBottom: 6,
      wordBreak: "break-all"
    }
  }, sc.school), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.t3,
      lineHeight: 1.7,
      marginBottom: 18
    }
  }, "이 현장의 ", /*#__PURE__*/React.createElement("b", null, (sc.buildings || []).length, "개 동"), "과 일정·진행상황이 목록에서 사라집니다.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.green
    }
  }, "설정 → 휴지통에서 되살릴 수 있어요.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setConfirmDel(false),
    style: {
      flex: 1,
      padding: "13px 0",
      borderRadius: 10,
      border: `1px solid ${C.border}`,
      background: C.surface,
      color: C.t2,
      fontSize: 16,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "아니요"), /*#__PURE__*/React.createElement("button", {
    onClick: doDelete,
    style: {
      flex: 1,
      padding: "13px 0",
      borderRadius: 10,
      border: "none",
      background: C.red,
      color: "#fff",
      fontSize: 16,
      fontWeight: 800,
      cursor: "pointer",
      boxShadow: `0 4px 14px ${C.red}45`
    }
  }, "네, 삭제합니다")))));
}
