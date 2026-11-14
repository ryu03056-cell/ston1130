/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 06/18 — 날짜 상세 패널  (screens/06-day-panel.js)
   │ 메모 일정 편집, 현장 고르기, 달력에서 날짜를 눌렀을 때 나오는 상세 창
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
/* 메모 일정 편집 — 현장이 아닌 부가 일정(휴가·반차·회의 등).
   현장조사와 같은 방식으로 기간과 따로 떨어진 날을 함께 지정할 수 있다. */
function NoteEditor({
  dateStr,
  note,
  editor,
  onClose
}) {
  const [kind, setKind] = useState(note ? note.kind : "일반");
  const [text, setText] = useState(note ? note.text : "");
  const [who, setWho] = useState(note ? (note.who || []).slice() : []);
  const [dEnd, setDEnd] = useState(note ? note.dateEnd || "" : "");
  const [extra, setExtra] = useState(note ? (note.extra || []).slice() : []);
  const [extraIn, setExtraIn] = useState("");
  const [multi, setMulti] = useState(!!(note && (note.dateEnd || (note.extra || []).length)));
  const [pick, setPick] = useState(false);
  const base = note ? note.date : dateStr;
  const all = noteDates({ date: base, dateEnd: dEnd, extra });
  const dayLabel = d => { const x = parseD(d); return `${x.getMonth() + 1}/${x.getDate()} ${DOW[x.getDay()]}`; };
  const addExtra = () => {
    const v = (extraIn || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || all.includes(v)) { setExtraIn(""); return; }
    setExtra(p => [...p, v].sort());
    setExtraIn("");
  };
  const save = () => {
    const t = (text || "").trim();
    if (!t) { window.alert("내용을 입력하세요."); return; }
    const body = {
      kind, text: t, who,
      date: base,
      dateEnd: dEnd && dEnd > base ? dEnd : null,
      extra: extra.length ? extra : null,
      by: editor || "익명",
      at: note ? note.at || Date.now() : Date.now(),
      editedAt: note ? Date.now() : null
    };
    try {
      const ref = firebase.database().ref(FB_NOTES);
      (note ? ref.child(note.id).update(body) : ref.push(body))
        .catch(e => window.alert("저장 실패: " + (e && e.message || e)));
      logAction(note ? "수정" : "추가", `메모 · ${kind}`, note ? note.text : null, t);
    } catch (e) { window.alert("저장 실패: " + (e && e.message || e)); }
    onClose();
  };
  const inp = { padding: "9px 11px", background: C.surface, border: BD, borderRadius: 8, color: C.t1, fontSize: 14, outline: "none" };
  return React.createElement("div", {
    style: { marginTop: 8, padding: 12, borderRadius: 10, border: `1px solid ${noteColor(kind)}45`, background: noteColor(kind) + "0a" }
  },
    React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: noteColor(kind), marginBottom: 8 } },
      note ? "✎ 메모 수정" : "✎ 이 날짜에 메모 추가"),
    React.createElement("div", { style: { display: "flex", gap: 5, marginBottom: 8 } },
      NOTE_KINDS.map(k => {
        const on = kind === k.v;
        return React.createElement("button", {
          key: k.v, onClick: () => setKind(k.v),
          style: { flex: 1, padding: "8px 4px", borderRadius: 7, fontSize: 13, fontWeight: on ? 800 : 600, cursor: "pointer", whiteSpace: "nowrap",
            border: `1px solid ${on ? k.color : C.border}`, background: on ? k.color + "18" : C.surface, color: on ? k.color : C.t3 }
        }, k.v);
      })),
    React.createElement("input", {
      value: text, onChange: e => setText(e.target.value), autoFocus: true,
      placeholder: "예: 본사 회의 14시 · 장비 점검",
      onKeyDown: e => { if (e.key === "Enter") save(); },
      style: { ...inp, width: "100%", boxSizing: "border-box", marginBottom: 8 }
    }),
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 } },
      React.createElement("span", { style: { fontSize: 12, color: C.t3, fontWeight: 700 } }, "담당"),
      sortMembers(who).map(n => React.createElement("span", {
        key: n,
        style: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, background: C.surface, border: BD, borderRadius: 20, padding: "4px 6px 4px 11px", color: C.t1 }
      }, n, React.createElement("button", {
        onClick: () => setWho(p => p.filter(x => x !== n)),
        style: { width: 18, height: 18, borderRadius: "50%", border: "none", background: C.redL, color: C.red, fontSize: 12, fontWeight: 800, cursor: "pointer", lineHeight: 1, padding: 0 }
      }, "×"))),
      React.createElement("button", {
        onClick: () => setPick(v => !v),
        style: { padding: "5px 11px", borderRadius: 7, border: `1px solid ${C.blue}45`, background: pick ? C.blue : C.blueL, color: pick ? "#fff" : C.blue, fontSize: 12, fontWeight: 800, cursor: "pointer" }
      }, pick ? "닫기" : "+ 인원"),
      React.createElement("span", { style: { fontSize: 12, color: C.t4 } }, "선택 안 해도 됩니다")),
    pick && React.createElement("div", {
      style: { display: "flex", flexWrap: "wrap", gap: 5, padding: 9, marginBottom: 8, background: C.surface, border: BD, borderRadius: 8 }
    }, allMembers().filter(n => !who.includes(n)).map(n =>
      React.createElement("button", {
        key: n, onClick: () => { setWho(p => [...p, n]); },
        style: { padding: "6px 11px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", background: C.surfaceL, color: C.t1, border: BD }
      }, rankOf(n) ? React.createElement("span", { style: { fontSize: 12, opacity: .7, marginRight: 4 } }, rankOf(n)) : null, n))),
    !multi && React.createElement("button", {
      onClick: () => setMulti(true),
      style: { padding: "7px 12px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.t3, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 8 }
    }, "+ 여러 날에 걸쳐요"),
    multi && React.createElement("div", {
      style: { padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, marginBottom: 8 }
    },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 7, marginBottom: 7 } },
        React.createElement("span", { style: { fontSize: 13, color: C.t3, fontWeight: 700 } }, base, " ~"),
        React.createElement("input", {
          type: "date", value: dEnd, min: base, onChange: e => setDEnd(e.target.value),
          style: { ...inp, flex: 1, minWidth: 0, fontSize: 13 }
        }),
        React.createElement("button", {
          onClick: () => { setMulti(false); setDEnd(""); setExtra([]); },
          style: { padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.t3, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }
        }, "하루로")),
      extra.length > 0 && React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 7 } },
        extra.map(d => React.createElement("span", {
          key: d,
          style: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, background: C.surfaceL, border: BD, borderRadius: 6, padding: "4px 6px 4px 9px", color: C.t1 }
        }, dayLabel(d), React.createElement("button", {
          onClick: () => setExtra(p => p.filter(x => x !== d)),
          style: { width: 17, height: 17, borderRadius: "50%", border: "none", background: C.redL, color: C.red, fontSize: 12, fontWeight: 800, cursor: "pointer", lineHeight: 1, padding: 0 }
        }, "×")))),
      React.createElement("div", { style: { display: "flex", gap: 6 } },
        React.createElement("input", { type: "date", value: extraIn, onChange: e => setExtraIn(e.target.value), style: { ...inp, flex: 1, minWidth: 0, fontSize: 13 } }),
        React.createElement("button", {
          onClick: addExtra,
          style: { padding: "7px 13px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.t2, fontSize: 13, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }
        }, "+ 따로")),
      all.length > 1 && React.createElement("div", { style: { fontSize: 12, color: C.t2, marginTop: 8, fontWeight: 700 } },
        "총 ", all.length, "일 — ", all.map(dayLabel).join(", "))),
    React.createElement("div", { style: { display: "flex", gap: 6 } },
      React.createElement("button", {
        onClick: onClose,
        style: { flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.t3, fontSize: 13, fontWeight: 700, cursor: "pointer" }
      }, "취소"),
      React.createElement("button", {
        onClick: save,
        style: { flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: noteColor(kind), color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }
      }, note ? "저장" : "메모 추가")));
}

/* 기존 현장을 찾아 이 날짜를 넣는다 — 현장 관리에 이미 있는 현장에 일정만 추가할 때 */
function SitePicker({
  dateStr,
  allSchools,
  setDb,
  onDone
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("field");
  const KINDS = [["field", "◆ 현장조사"], ["start", "▶ 착수"], ["deliverDate", "■ 납품"], ["end", "● 완수"]];
  const hits = useMemo(() => {
    const key = normSchool(q);
    if (!key) return [];
    return allSchools.filter(s => !s.deleted && normSchool(s.school).includes(key)).sort((a, b) => {
      const na = normSchool(a.school),
        nb = normSchool(b.school);
      return (na.startsWith(key) ? 0 : 1) - (nb.startsWith(key) ? 0 : 1) || a.school.length - b.school.length;
    }).slice(0, 8);
  }, [q, allSchools]);
  const apply = s => {
    const cur = s[kind] || "";
    const label = KINDS.find(k => k[0] === kind)[1].slice(2);
    if (cur === dateStr) {
      onDone(`${s.school} — 이미 같은 날짜입니다`);
      return;
    }
    if (cur && !window.confirm(`${s.school}\n${label}: ${cur} → ${dateStr}\n\n덮어쓸까요?`)) return;
    setDb(prev => {
      const next = { ...prev };
      next[s._year] = { ...(prev[s._year] || {}) };
      next[s._year][s._half] = (prev[s._year]?.[s._half] || []).map(x => x.id !== s.id ? x : stampEdit({ ...x, [kind]: dateStr }, `${label}일 지정`));
      return next;
    });
    logAction("수정", `${s.school} · ${label}일`, cur || "-", dateStr);
    onDone(`${s.school} · ${label} ${dateStr.slice(5).replace("-", "/")} 지정됨`);
  };
  return React.createElement("div", {
    style: { marginTop: 8, padding: 12, borderRadius: 10, border: `1px solid ${C.blue}40`, background: C.blue + "0a" }
  }, React.createElement("div", {
    style: { fontSize: 12, fontWeight: 800, color: C.blue, marginBottom: 8 }
  }, "이미 등록된 현장에 이 날짜를 넣습니다"), React.createElement("div", {
    style: { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }
  }, KINDS.map(([k, l]) => {
    const on = kind === k;
    return React.createElement("button", {
      key: k,
      onClick: () => setKind(k),
      style: { flex: 1, minWidth: 74, padding: "8px 4px", borderRadius: 7, fontSize: 12, fontWeight: on ? 800 : 600, cursor: "pointer", whiteSpace: "nowrap", border: `1px solid ${on ? evColor(k) : C.border}`, background: on ? evColor(k) + "18" : C.surface, color: on ? evColor(k) : C.t3 }
    }, l);
  })), React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "현장 이름으로 찾기",
    autoFocus: true,
    style: { width: "100%", boxSizing: "border-box", padding: "10px 12px", background: C.surface, border: `1px solid ${q ? C.blue : C.border}`, borderRadius: 8, color: C.t1, fontSize: 14, outline: "none" }
  }), q && hits.length === 0 && React.createElement("div", {
    style: { fontSize: 13, color: C.t4, padding: "12px 2px" }
  }, "찾는 현장이 없습니다."), React.createElement("div", {
    style: { display: "flex", flexDirection: "column", gap: 5, marginTop: 8, maxHeight: 300, overflowY: "auto" }
  }, hits.map(s => {
    const cur = s[kind] || "";
    const lh = isLH(s._year);
    const hc = lh ? C.purple : s._half === "상반기" ? C.blue : C.orange;
    return React.createElement("div", {
      key: `${s._year}-${s._half}-${s.id}`,
      style: { display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", background: C.surface, border: BD, borderRadius: 8 }
    }, React.createElement("span", {
      style: { flexShrink: 0, minWidth: 50, textAlign: "center", padding: "3px 5px", borderRadius: 5, fontSize: 12, fontWeight: 800, color: hc, background: hc + "16", border: `1px solid ${hc}45` }
    }, lh ? "LH" : `${String(s._year).slice(2)}년 ${s._half === "상반기" ? "상" : "하"}`), React.createElement("span", {
      style: { flex: 1, minWidth: 0 }
    }, React.createElement("span", {
      style: { display: "block", fontSize: 14, fontWeight: 700, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
    }, s.school), React.createElement("span", {
      style: { display: "block", fontSize: 12, color: cur ? C.orange : C.t4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
    }, s.region ? `${s.region} · ` : "", cur ? `${cur.slice(5).replace("-", "/")} → 덮어씀` : "날짜 없음")), React.createElement("button", {
      onClick: () => apply(s),
      style: { flexShrink: 0, padding: "8px 14px", borderRadius: 7, border: "none", background: C.blue, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }
    }, "넣기"));
  })));
}

/* ══════════════════════════════════════════════════════════════
   날짜 클릭 상세 패널 (현장조사 · 완수일)
══════════════════════════════════════════════════════════════ */
function DayPanel({
  dateStr,
  label,
  allSchools,
  setDb,
  onClose,
  isMobile,
  notes,
  isAdmin,
  editor,
  viewKinds
}) {
  /* 위에서 고른 보기 종류 — 현장조사만 보고 있으면 이 탭도 현장조사만 */
  const showK = f => !viewKinds || viewKinds.length === 0 || viewKinds.includes(f);
  const [pickerId, setPickerId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [dragY, setDragY] = useState(0); // 아래로 쓸어내려 닫기
  const dragStart = useRef(null);
  const [routeFor, setRouteFor] = useState(null); // 길찾기 앱 선택
  const [draft, setDraft] = useState(null); // 아직 저장 안 한 새 현장
  const [pickOpen, setPickOpen] = useState(false); // 기존 현장 찾아 넣기
  const [pickMsg, setPickMsg] = useState(null);
  const [noteOpen, setNoteOpen] = useState(false); // 메모 작성
  const [noteEdit, setNoteEdit] = useState(null); // 수정 중인 메모
  const dayNotes = (notes || []).filter(n => noteDates(n).includes(dateStr));
  /* 관리자는 전부, 일반 사용자는 본인이 쓴 메모만 고치거나 지울 수 있다 */
  const canEditNote = n => isAdmin || !!(editor && n && n.by === editor);
  const delNote = n => {
    if (!window.confirm(`'${n.text}' 메모를 지울까요?`)) return;
    try {
      firebase.database().ref(`${FB_NOTES}/${n.id}`).remove().catch(e => window.alert("삭제 실패: " + (e && e.message || e)));
      logAction("삭제", `메모 · ${n.kind}`, n.text, null);
    } catch (e) {
      window.alert("삭제 실패: " + (e && e.message || e));
    }
  };
  const geoAll = useGeoCache();

  /* 같은 현장이 상·하반기 양쪽에 있으면(1년 계약 이월) 한 번만 표시.
     그 날짜가 속한 반기의 기록을 우선으로 남긴다. */
  const dHalf = parseInt(String(dateStr).slice(5, 7), 10) <= 6 ? "상반기" : "하반기";
  const dYear = String(dateStr).slice(0, 4);
  const dedup = arr => {
    const m = new Map();
    arr.forEach(s => {
      const k = `${(s.school || "").trim()}|${(s.no || "").toString().trim()}`;
      const prev = m.get(k);
      if (!prev) {
        m.set(k, s);
        return;
      }
      const fits = x => String(x._year) === dYear && x._half === dHalf;
      if (!fits(prev) && fits(s)) m.set(k, s);
    });
    return [...m.values()];
  };
  /* 조사가 며칠에 걸치면 그 기간의 모든 날에 나타난다 */
  /* 지역별로 묶어 보이게 — 같은 지역이 연속해서 나온다 */
  const fieldSchools = showK("field") ? dedup(allSchools.filter(s => surveyDates(s).includes(dateStr))).sort(byRegionThenName) : [];
  const startSchools = showK("start") ? dedup(allSchools.filter(s => s.start === dateStr)).sort(byRegionThenName) : [];
  const endSchools = showK("end") ? dedup(allSchools.filter(s => s.end === dateStr)).sort(byRegionThenName) : [];
  const deliverSchools = showK("deliverDate") ? dedup(allSchools.filter(s => s.deliverDate === dateStr)).sort(byRegionThenName) : [];
  const total = fieldSchools.length + startSchools.length + endSchools.length + deliverSchools.length;
  const isDraft = !!(draft && draft.id === editId);
  const editSc = isDraft ? draft : editId ? allSchools.find(s => s.id === editId) : null;

  /* 이 날짜로 새 현장 만들기 — 클릭한 날짜가 현장조사일로 들어가고,
     그 날짜가 속한 연도·반기에 저장되므로 현장 관리 탭에도 그대로 나타난다.
     저장을 누를 때까지는 아무것도 기록되지 않는다. */
  const addSiteHere = () => {
    const id = `new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setDraft({
      id,
      school: "",
      no: "",
      region: "",
      kind: "정기점검",
      field: dateStr,
      start: "",
      end: "",
      headcount: 1,
      assignees: [],
      progress: {},
      buildings: [{
        b: "본관",
        cat: "건축",
        kind: "정기",
        floor: null,
        area: null,
        fms: null,
        flag: null,
        note: null,
        rep: false,
        fmsD: false,
        delivery: null
      }],
      _year: dYear,
      _half: dHalf
    });
    setEditId(id);
  };
  const toggleAssignee = (sid, name) => {
    if (!setDb) return;
    const sc = allSchools.find(s => s.id === sid);
    if (!sc?._year || !sc?._half) return;
    /* 조사가 여러 날이면 이 날짜에만 반영한다 (다른 날 인원은 건드리지 않음) */
    const multi = isMultiSurvey(sc);
    const had = whoOnDate(sc, dateStr).includes(name);
    setDb(prev => {
      const next = {
        ...prev
      };
      next[sc._year] = {
        ...(prev[sc._year] || {})
      };
      next[sc._year][sc._half] = (prev[sc._year]?.[sc._half] || []).map(s => {
        if (s.id !== sid) return s;
        const cur = whoOnDate(s, dateStr);
        const upd = sortMembers(cur.includes(name) ? cur.filter(n => n !== name) : [...cur, name]);
        const label = `${name} ${had ? "제외" : "배정"}${multi ? ` (${dateStr.slice(5).replace("-", "/")})` : ""}`;
        if (multi) return stampEdit({
          ...s,
          fieldWho: {
            ...(s.fieldWho || {}),
            [dateStr]: upd
          }
        }, label);
        return stampEdit({
          ...s,
          assignees: upd,
          headcount: upd.length || s.headcount || 1
        }, label);
      });
      return next;
    });
    logAction(had ? "삭제" : "추가", `인원 배정 · ${sc.school}${multi ? ` · ${dateStr}` : ""}`, had ? name : null, had ? null : name);
  };

  /* 현장에서 바로 통화 — 번호가 있으면 탭 한 번으로 전화 앱 연결 */
  const TelBtn = ({
    tel
  }) => {
    const num = String(tel || "").trim();
    if (!num) return null;
    const dial = num.replace(/[^0-9+]/g, "");
    if (!dial) return null;
    return /*#__PURE__*/React.createElement("a", {
      href: `tel:${dial}`,
      onClick: e => e.stopPropagation(),
      title: `${num} 로 전화`,
      style: {
        padding: isMobile ? "9px 12px" : "3px 9px",
        borderRadius: 5,
        fontSize: 12,
        fontWeight: 800,
        textDecoration: "none",
        border: `1px solid ${C.green}55`,
        background: C.greenL,
        color: C.green,
        whiteSpace: "nowrap"
      }
    }, "📞 ", num);
  };

  /* 카드 공통 머리줄 — 현장명 · 지역 · 표시 · 전화 · 수정 */
  /* 동별 담당(또는 협의) 켜고 끄기 — 현장 단위로 한 번만 정한다 */
  const toggleBldWho = React.useCallback((sid, bname, name) => {
    if (!setDb) return;
    const sc = allSchools.find(s => s.id === sid);
    if (!sc?._year || !sc?._half) return;
    const had = bldWhoOf(sc, bname).includes(name);
    setDb(prev => {
      const next = { ...prev };
      next[sc._year] = { ...(prev[sc._year] || {}) };
      next[sc._year][sc._half] = (prev[sc._year]?.[sc._half] || []).map(s => {
        if (s.id !== sid) return s;
        const cur = bldWhoOf(s, bname);
        const upd = sortMembers(cur.includes(name) ? cur.filter(n => n !== name) : [...cur, name]);
        const bw = { ...(s.bldWho || {}) };
        const bk = fbKey(bname); /* 저장도 찾기와 같은 열쇠로 */
        delete bw[bname];
        delete bw[bk];
        if (upd.length) bw[bk] = upd;
        return stampEdit({ ...s, bldWho: bw }, `${bname === CONSULT_KEY ? "협의" : bname} · ${name} ${had ? "제외" : "배정"}`);
      });
      return next;
    });
    logAction(had ? "삭제" : "추가", `${bname === CONSULT_KEY ? "협의" : "동 배정"} · ${sc.school}`, had ? name : null, had ? null : name);
  }, [allSchools, setDb]);

  const CardHead = React.useCallback(({
    s
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 7,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 800,
      color: C.t1,
      flex: 1,
      minWidth: 90,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, s.school), getFlags(s).map(fv => {
    const o = FLAG_OPTS.find(x => x.v === fv);
    return o ? /*#__PURE__*/React.createElement("span", {
      key: fv,
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: o.color
      }
    }, o.label) : null;
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.t3
    }
  }, s.region), TelBtn({
    tel: siteTel(s)
  }), /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      setRouteFor(s);
    },
    title: "길찾기",
    style: {
      padding: isMobile ? "9px 13px" : "3px 10px",
      borderRadius: 5,
      fontSize: 12,
      fontWeight: 800,
      border: `1px solid ${C.purple}45`,
      background: C.purpleL,
      color: C.purple,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "🧭 길찾기"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setEditId(s.id),
    style: {
      padding: isMobile ? "9px 13px" : "3px 10px",
      borderRadius: 5,
      fontSize: 12,
      fontWeight: 700,
      border: `1px solid ${C.blue}40`,
      background: C.blueL,
      color: C.blue,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "✏ 수정")), [allSchools, setDb, dateStr, pickerId, isMobile, isAdmin, editor]);
  const EditLine = React.useCallback(({
    s
  }) => s && s.lastEdit ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 5,
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement(LastEdit, {
    s: s,
    size: 9
  })) : null, [allSchools, setDb, dateStr, pickerId, isMobile, isAdmin, editor]);
  const FieldCard = React.useCallback(({
    s
  }) => {
    /* 이 날짜에 실제로 가는 인원 (조사가 여러 날이면 날짜마다 다를 수 있다) */
    const assignees = sortMembers(whoOnDate(s, dateStr));
    const available = allMembers().filter(n => !assignees.includes(n));
    const open = pickerId === s.id;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "10px 11px",
        background: C.surface,
        borderRadius: 9,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${C.blue}`,
        marginBottom: 6
      }
    }, CardHead({
      s: s
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "8px 9px",
        background: C.surfaceL,
        borderRadius: 9,
        border: BD
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 5
      }
    }, assignees.map(name => {
      const mc = memberColor(name);
      return /*#__PURE__*/React.createElement("span", {
        key: name,
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 13,
          fontWeight: 700,
          color: "#fff",
          background: mc,
          padding: "4px 9px",
          borderRadius: 20,
          whiteSpace: "nowrap",
          boxShadow: `0 2px 6px ${mc}40`
        }
      }, name, /*#__PURE__*/React.createElement("button", {
        onClick: () => toggleAssignee(s.id, name),
        style: {
          width: 19,
          height: 19,
          borderRadius: "50%",
          border: "none",
          background: "rgba(255,255,255,.3)",
          color: "#fff",
          fontSize: 12,
          fontWeight: 800,
          cursor: "pointer",
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0
        }
      }, "×"));
    }), available.length > 0 && /*#__PURE__*/React.createElement("button", {
      onClick: () => setPickerId(open ? null : s.id),
      style: {
        width: 26,
        height: 26,
        borderRadius: "50%",
        border: `1px solid ${C.blue}`,
        background: open ? C.blue : C.surface,
        color: open ? "#fff" : C.blue,
        fontSize: 17,
        fontWeight: 700,
        cursor: "pointer",
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0
      }
    }, "+"), assignees.length === 0 && !open && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.t4
      }
    }, "+ 버튼으로 인원 추가")), open && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        padding: 8,
        background: C.surface,
        borderRadius: 8,
        border: BD
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: C.t4,
        fontWeight: 600,
        marginBottom: 5
      }
    }, "인원 선택 · 여러 명 이어서 누르세요"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 5
      }
    }, allMembers().map(name => {
      const mc = memberColor(name);
      const on = assignees.includes(name);
      return /*#__PURE__*/React.createElement("button", {
        key: name,
        /* 누를 때마다 목록을 닫지 않는다 — 여러 명을 이어서 고를 수 있게 */
        onClick: () => toggleAssignee(s.id, name),
        style: {
          padding: "5px 12px",
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          background: on ? mc : mc + "14",
          color: on ? "#fff" : mc,
          border: `1px solid ${on ? mc : mc + "55"}`
        }
      }, on ? "✓ " : "", rankOf(name) ? /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          fontWeight: 600,
          opacity: .7,
          marginRight: 4
        }
      }, rankOf(name)) : null, name);
    })), /*#__PURE__*/React.createElement("button", {
      onClick: () => setPickerId(null),
      style: {
        marginTop: 8,
        width: "100%",
        padding: "8px 0",
        borderRadius: 7,
        border: "none",
        background: C.blue,
        color: "#fff",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer"
      }
    }, `✓ 완료 · ${assignees.length}명`))), /*#__PURE__*/React.createElement(BldAssign, {
      s: s,
      assignees: assignees,
      dateStr: dateStr,
      onToggle: toggleBldWho
    }), EditLine({
      s: s
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 3,
        marginTop: 7
      }
    }, isMultiSurvey(s) && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 800,
        padding: "2px 7px",
        borderRadius: 4,
        marginRight: 3,
        background: C.blueL,
        border: `1px solid ${C.blue}45`,
        color: C.blue,
        whiteSpace: "nowrap"
      }
    }, `조사 ${schoolSurveyDates(s).length}일 중 ${schoolSurveyDates(s).indexOf(dateStr) + 1}일차`), buildingsOnDate(s, dateStr).map((b, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        fontSize: 12,
        padding: "1px 6px",
        borderRadius: 3,
        background: C.surfaceL,
        border: BD,
        color: C.t2,
        whiteSpace: "nowrap"
      }
    }, b.b, bldSize(b) ? /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 5,
        color: C.t4,
        fontWeight: 600
      }
    }, bldSize(b)) : null))), s.buildings.some(b => b.note) && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6,
        fontSize: 12,
        color: C.t3,
        padding: "3px 8px",
        background: C.yellowL,
        borderRadius: 4,
        borderLeft: `2px solid ${C.yellow}`,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, "⚠ ", s.buildings.find(b => b.note)?.note));
  }, [allSchools, setDb, dateStr, pickerId, isMobile, isAdmin, editor]);
  const StartCard = React.useCallback(({
    s
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 11px",
      background: C.surface,
      borderRadius: 9,
      border: `1px solid ${C.green}40`,
      borderLeft: `3px solid ${C.green}`,
      marginBottom: 6
    }
  }, CardHead({
    s: s
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t2
    }
  }, "▶ 용역 착수 · ", s.buildings.length, "동 · 완수 ", fd(s.end), " (", ddL(calcDday(s.end)), ")"), EditLine({
    s: s
  })), [allSchools, setDb, dateStr, pickerId, isMobile, isAdmin, editor]);
  const EndCard = React.useCallback(({
    s
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 11px",
      background: C.surface,
      borderRadius: 9,
      border: `1px solid ${C.orange}40`,
      borderLeft: `3px solid ${C.orange}`,
      marginBottom: 6
    }
  }, CardHead({
    s: s
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t2
    }
  }, "🏁 완수 예정 · ", s.buildings.length, "동", (() => {
    const dv = deliveryOf(s);
    return dv.state === "완료" ? ` · ${dv.way === "우편" ? "📮" : "🚚"} ${dv.label}` : dv.state === "예정" ? ` · 📦 ${dv.label}` : " · 📦 납품 미정";
  })(), (s.assignees || []).length ? ` · ${sortMembers(s.assignees).join("·")}` : ""), EditLine({
    s: s
  })), [allSchools, setDb, dateStr, pickerId, isMobile, isAdmin, editor]);
  /* 납품 카드 — 납품일이 이 날인 현장 */
  const DeliverCard = React.useCallback(({
    s
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 11px",
      background: C.surface,
      borderRadius: 9,
      border: `1px solid ${C.purple}40`,
      borderLeft: `3px solid ${C.purple}`,
      marginBottom: 6
    }
  }, CardHead({
    s: s
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t2
    }
  }, (() => {
    const dv = deliveryOf(s);
    return dv.state === "완료" ? `${dv.way === "우편" ? "📮 우편" : dv.way === "직납" ? "🚚 직납" : "📦 납품"} 완료${dv.by ? " · " + dv.by : ""}` : "📦 납품 예정";
  })(), " · ", s.buildings.length, "동"), EditLine({
    s: s
  })), [allSchools, setDb, dateStr, pickerId, isMobile, isAdmin, editor]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(30,35,50,.35)",
      backdropFilter: "blur(2px)",
      zIndex: 290
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: isMobile ? {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      height: "86vh",
      width: "100%",
      background: C.surface,
      borderTop: `4px solid ${C.blue}`,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      boxShadow: "0 -10px 40px rgba(0,0,0,.22)",
      zIndex: 291,
      paddingBottom: "env(safe-area-inset-bottom)",
      display: "flex",
      flexDirection: "column",
      transform: dragY ? `translateY(${dragY}px)` : undefined,
      transition: dragStart.current ? "none" : "transform .22s cubic-bezier(.2,.8,.2,1)",
      animation: dragY ? undefined : "daySheet .24s cubic-bezier(.2,.8,.2,1)"
    } : {
      position: "fixed",
      top: 0,
      right: 0,
      height: "100vh",
      width: "max(460px, 50vw)",
      maxWidth: "96vw",
      background: C.surface,
      borderLeft: `4px solid ${C.blue}`,
      boxShadow: "-10px 0 40px rgba(0,0,0,.20)",
      zIndex: 291,
      display: "flex",
      flexDirection: "column",
      animation: "daySlide .22s cubic-bezier(.2,.8,.2,1)"
    }
  }, /*#__PURE__*/React.createElement("style", null, `@keyframes daySlide{from{transform:translateX(100%)}to{transform:translateX(0)}}
                 @keyframes daySheet{from{transform:translateY(100%)}to{transform:translateY(0)}}`), isMobile && (() => {
    /* 손잡이나 제목줄을 아래로 쓸어내리면 닫힘 */
    const onStart = e => {
      dragStart.current = e.touches[0].clientY;
    };
    const onMove = e => {
      if (dragStart.current == null) return;
      const dy = e.touches[0].clientY - dragStart.current;
      if (dy > 0) setDragY(dy);
    };
    const onEnd = () => {
      const dy = dragY;
      dragStart.current = null;
      if (dy > 90) {
        setDragY(0);
        onClose();
      } else setDragY(0);
    };
    return /*#__PURE__*/React.createElement("div", {
      onTouchStart: onStart,
      onTouchMove: onMove,
      onTouchEnd: onEnd,
      onClick: onClose,
      style: {
        padding: "11px 0 5px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        flexShrink: 0,
        cursor: "pointer",
        touchAction: "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 46,
        height: 5,
        borderRadius: 3,
        background: C.borderD
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.t4
      }
    }, "아래로 쓸어내리면 닫혀요"));
  })(), /*#__PURE__*/React.createElement("div", {
    onTouchStart: isMobile ? e => {
      dragStart.current = e.touches[0].clientY;
    } : undefined,
    onTouchMove: isMobile ? e => {
      if (dragStart.current == null) return;
      const dy = e.touches[0].clientY - dragStart.current;
      if (dy > 0) setDragY(dy);
    } : undefined,
    onTouchEnd: isMobile ? () => {
      const dy = dragY;
      dragStart.current = null;
      if (dy > 90) {
        setDragY(0);
        onClose();
      } else setDragY(0);
    } : undefined,
    style: {
      padding: isMobile ? "6px 16px 13px" : "18px 20px",
      borderBottom: BD,
      background: C.blueL,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexShrink: 0,
      touchAction: isMobile ? "none" : undefined
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: isMobile ? 19 : 22,
      fontWeight: 800,
      color: C.blue,
      lineHeight: 1.1
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: isMobile ? 12 : 12,
      color: C.blue + "bb",
      marginTop: 4
    }
  }, "현장 ", fieldSchools.length, " · 착수 ", startSchools.length, " · 납품 ", deliverSchools.length, " · 완수 ", endSchools.length, dayNotes.length ? ` · 메모 ${dayNotes.length}` : "", " · 총 ", total + dayNotes.length, "건")), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: 32,
      height: 32,
      borderRadius: "50%",
      background: `${C.blue}20`,
      border: `1px solid ${C.blue}40`,
      color: C.blue,
      fontSize: 19,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 1,
      flexShrink: 0
    }
  }, "×")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "16px 18px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setPickOpen(false);
      setNoteOpen(false);
      setNoteEdit(null);
      showToast("현장은 스프레드시트에 추가하면 5분 안에 앱에 자동으로 생깁니다");
    },
    style: {
      flex: 1,
      minWidth: 0,
      padding: "11px 4px",
      borderRadius: 9,
      border: "none",
      background: C.blue,
      color: "#fff",
      fontSize: 14,
      fontWeight: 800,
      cursor: "pointer",
      whiteSpace: "nowrap",
      boxShadow: `0 2px 8px ${C.blue}35`
    }
  }, "시트에서 추가"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setNoteOpen(false);
      setNoteEdit(null);
      setPickOpen(v => !v);
    },
    style: {
      flex: 1,
      minWidth: 0,
      padding: "11px 4px",
      borderRadius: 9,
      border: `1px solid ${pickOpen ? C.blue : C.border}`,
      background: pickOpen ? C.blueL : C.surface,
      color: pickOpen ? C.blue : C.t2,
      fontSize: 14,
      fontWeight: 800,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "⌕ 기존 현장"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setPickOpen(false);
      setNoteEdit(null);
      setNoteOpen(v => !v);
    },
    style: {
      flex: 1,
      minWidth: 0,
      padding: "11px 4px",
      borderRadius: 9,
      border: `1px solid ${noteOpen ? C.t2 : C.border}`,
      background: noteOpen ? C.surfaceD : C.surface,
      color: C.t2,
      fontSize: 14,
      fontWeight: 800,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "✎ 메모")), (noteOpen || noteEdit) && /*#__PURE__*/React.createElement(NoteEditor, {
    dateStr: dateStr,
    note: noteEdit,
    editor: editor,
    onClose: () => {
      setNoteOpen(false);
      setNoteEdit(null);
    }
  }), dayNotes.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, dayNotes.map(n => /*#__PURE__*/React.createElement("div", {
    key: n.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      padding: "10px 11px",
      marginBottom: 6,
      background: C.surfaceL,
      border: `1px dashed ${noteColor(n.kind)}55`,
      borderLeft: `4px dotted ${noteColor(n.kind)}`,
      borderRadius: 8
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
      color: noteColor(n.kind),
      background: noteColor(n.kind) + "16",
      border: `1px solid ${noteColor(n.kind)}40`
    }
  }, n.kind), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: 14,
      fontWeight: 700,
      color: C.t1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, n.text), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: 12,
      color: C.t3,
      marginTop: 2,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, (n.who || []).length ? `👤 ${sortMembers(n.who).join(" · ")} · ` : "", noteDates(n).length > 1 ? `${noteDates(n).length}일 · ` : "", n.by || "")), canEditNote(n) && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setNoteOpen(false);
      setNoteEdit(n);
    },
    style: {
      flexShrink: 0,
      padding: "6px 11px",
      borderRadius: 7,
      border: `1px solid ${C.blue}40`,
      background: C.blueL,
      color: C.blue,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "수정"), canEditNote(n) && /*#__PURE__*/React.createElement("button", {
    onClick: () => delNote(n),
    style: {
      flexShrink: 0,
      padding: "6px 11px",
      borderRadius: 7,
      border: `1px solid ${C.red}35`,
      background: "transparent",
      color: C.red,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "삭제")))), pickOpen && /*#__PURE__*/React.createElement(SitePicker, {
    dateStr: dateStr,
    allSchools: allSchools,
    setDb: setDb,
    onDone: msg => {
      setPickOpen(false);
      setPickMsg(msg);
      setTimeout(() => setPickMsg(null), 2600);
    }
  }), pickMsg && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      padding: "9px 12px",
      background: C.greenL,
      border: `1px solid ${C.green}35`,
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 700,
      color: C.green
    }
  }, "✓ ", pickMsg), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      textAlign: "center",
      marginBottom: 14,
      marginTop: 7
    }
  }, `${isLH(dYear) ? "LH" : `${dYear}년 ${dHalf}`}에 등록됩니다`), total === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "60px 0",
      color: C.t4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 30,
      marginBottom: 10
    }
  }, "—"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15
    }
  }, "등록된 일정 없음")), fieldSchools.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 9,
      padding: "7px 10px",
      background: C.blueL,
      borderRadius: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16
    }
  }, "📍"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: C.blue
    }
  }, "현장조사"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      background: C.blue,
      color: "#fff",
      padding: "2px 9px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 700
    }
  }, fieldSchools.length)), fieldSchools.map(s => /*#__PURE__*/React.createElement(React.Fragment, { key: s.id }, FieldCard({ s: s })))), startSchools.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 9,
      padding: "7px 10px",
      background: C.greenL,
      borderRadius: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16
    }
  }, "▶"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: C.green
    }
  }, "착수일"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      background: C.green,
      color: "#fff",
      padding: "2px 9px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 700
    }
  }, startSchools.length)), startSchools.map(s => /*#__PURE__*/React.createElement(React.Fragment, { key: s.id }, StartCard({ s: s })))), endSchools.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 9,
      padding: "7px 10px",
      background: C.orangeL,
      borderRadius: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16
    }
  }, "📦"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: C.orange
    }
  }, "완수일"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      background: C.orange,
      color: "#fff",
      padding: "2px 9px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 700
    }
  }, endSchools.length)), endSchools.map(s => /*#__PURE__*/React.createElement(React.Fragment, { key: s.id }, EndCard({ s: s })))), deliverSchools.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 9,
      padding: "7px 10px",
      background: C.purpleL,
      borderRadius: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16
    }
  }, "🚚"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: C.purple
    }
  }, "납품일"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      background: C.purple,
      color: "#fff",
      padding: "2px 9px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 700
    }
  }, deliverSchools.length)), deliverSchools.map(s => /*#__PURE__*/React.createElement(React.Fragment, { key: s.id }, DeliverCard({ s: s })))))), editSc && /*#__PURE__*/React.createElement(EditPanel, {
    sc: editSc,
    yr: editSc._year,
    half: editSc._half,
    setDb: setDb,
    isNew: isDraft,
    isMobile: isMobile,
    onClose: () => {
      setEditId(null);
      setDraft(null);
    }
  }), /*#__PURE__*/React.createElement(RouteChooser, {
    site: routeFor,
    geo: geoAll,
    isMobile: isMobile,
    onClose: () => setRouteFor(null)
  }));
}
