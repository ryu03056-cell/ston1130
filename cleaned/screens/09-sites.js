/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 09/18 — 현장 관리  (screens/09-sites.js)
   │ 연도/반기별 현장 표, 다른 반기에서 현장 복사
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════
   다른 반기에서 현장 복사 (상반기 → 하반기 등)
══════════════════════════════════════════════════════════════ */
function CopyHalfModal({
  db,
  setDb,
  toYr,
  toHalf,
  onClose,
  onDone,
  isMobile
}) {
  const [sel, setSel] = useState(new Set());
  const [search, setSearch] = useState("");
  const [keepOrig, setKeepOrig] = useState(false); // 원본 날짜·진행 그대로 이월

  const buckets = [];
  Object.keys(db || {}).filter(y => !isLH(y)).sort((a, b) => b - a).forEach(y => ["상반기", "하반기"].forEach(h => {
    if (y === toYr && h === toHalf) return;
    const arr = db[y]?.[h] || [];
    if (arr.length) buckets.push({
      y,
      h,
      arr
    });
  }));
  const destKeys = new Set((db[toYr]?.[toHalf] || []).map(s => `${(s.school || "").trim()}|${(s.no || "").toString().trim()}`));
  const keyOf = (bk, s) => `${bk.y}|${bk.h}|${s.id}`;
  const ms = s => !search || (s.school || "").includes(search) || (s.region || "").includes(search);
  const toggle = k => setSel(p => {
    const n = new Set(p);
    n.has(k) ? n.delete(k) : n.add(k);
    return n;
  });
  const bucketKeys = bk => bk.arr.filter(ms).map(s => keyOf(bk, s));
  const allSelInBucket = bk => {
    const ks = bucketKeys(bk);
    return ks.length > 0 && ks.every(k => sel.has(k));
  };
  const toggleBucket = bk => {
    const ks = bucketKeys(bk);
    setSel(p => {
      const n = new Set(p);
      const all = ks.every(k => n.has(k));
      ks.forEach(k => all ? n.delete(k) : n.add(k));
      return n;
    });
  };

  /* 완수일이 목적지 반기에 속하는지 (1년계약 이월용) */
  const range = toHalf === "상반기" ? [1, 6] : [7, 12];
  const inDestHalf = s => {
    if (!s.end) return false;
    const y = String(s.end).slice(0, 4);
    const m = parseInt(String(s.end).slice(5, 7), 10);
    return y === String(toYr) && m >= range[0] && m <= range[1];
  };
  const autoCandidates = [];
  buckets.forEach(bk => bk.arr.forEach(s => {
    if (inDestHalf(s) && !destKeys.has(`${(s.school || "").trim()}|${(s.no || "").toString().trim()}`)) autoCandidates.push(keyOf(bk, s));
  }));
  const autoSelect = () => {
    setSel(new Set(autoCandidates));
    setKeepOrig(true);
  };
  const doCopy = () => {
    const picked = [];
    buckets.forEach(bk => bk.arr.forEach(s => {
      if (sel.has(keyOf(bk, s))) picked.push(s);
    }));
    if (!picked.length) return;
    const newId = () => `copy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${Math.floor(Math.random() * 9999)}`;
    const cleanBld = s => (s.buildings || []).map(b => ({
      ...b,
      rep: false,
      fmsD: false,
      delivery: null
    }));
    const copies = picked.map(s => keepOrig ? {
      ...s,
      id: newId(),
      progress: {},
      // 진행단계 초기화
      /* 이번 반기에는 더 이상 신규가 아니다 — 지난 반기 표시를 물려받지 않는다 */
      isNew: false,
      round: "",
      lastEdit: null,
      buildings: cleanBld(s)
    } // 날짜는 유지, 보고서·FMS·납품은 미완으로
    : {
      ...s,
      id: newId(),
      field: "",
      fieldEnd: "",
      fieldExtra: [],
      fieldWho: null,
      start: "",
      deliverDate: "",
      end: "",
      progress: {},
      assignees: [],
      headcount: s.headcount || 1,
      /* 새 점검이므로 신규·예정 표시와 지난 메모는 가져오지 않는다 */
      isNew: false,
      tentative: false,
      round: "",
      memo: "",
      lastEdit: null,
      buildings: cleanBld(s)
    }); // 새 점검으로 초기화
    setDb(prev => {
      const n = {
        ...prev
      };
      n[toYr] = {
        ...(prev[toYr] || {})
      };
      n[toYr][toHalf] = [...(prev[toYr]?.[toHalf] || []), ...copies];
      return n;
    });
    onDone(copies.length);
  };
  const selCount = sel.size;
  const hc = toHalf === "상반기" ? C.blue : C.orange;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(30,35,50,.4)",
      backdropFilter: "blur(2px)",
      zIndex: 300
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%,-50%)",
      width: isMobile ? "94vw" : 560,
      maxWidth: "94vw",
      maxHeight: "88vh",
      background: C.surface,
      borderRadius: 16,
      zIndex: 301,
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 20px 60px rgba(0,0,0,.3)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "18px 20px",
      borderBottom: BD,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 800,
      color: C.t1
    }
  }, "📋 다른 반기에서 현장 복사"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.t3,
      marginTop: 4
    }
  }, "선택한 현장을 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: hc
    }
  }, toYr, "년 ", toHalf), "로 복사해요."), autoCandidates.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      padding: "11px 13px",
      background: hc + "0e",
      border: `1px solid ${hc}40`,
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 19
    }
  }, "⚡"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 800,
      color: hc
    }
  }, "완수일이 ", toYr, "년 ", toHalf, "인 현장 ", autoCandidates.length, "개"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t3,
      marginTop: 2
    }
  }, "1년 계약 등 하반기까지 이어지는 현장을 자동으로 골라줘요")), /*#__PURE__*/React.createElement("button", {
    onClick: autoSelect,
    style: {
      padding: "8px 14px",
      borderRadius: 8,
      border: "none",
      background: hc,
      color: "#fff",
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "자동 선택")), /*#__PURE__*/React.createElement("label", {
    style: {
      marginTop: 10,
      display: "flex",
      alignItems: "center",
      gap: 8,
      cursor: "pointer",
      padding: "8px 11px",
      background: C.surfaceL,
      borderRadius: 8,
      border: BD
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => setKeepOrig(v => !v),
    style: {
      width: 38,
      height: 22,
      borderRadius: 11,
      background: keepOrig ? C.green : C.borderD,
      position: "relative",
      transition: "background .15s",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 2,
      left: keepOrig ? 18 : 2,
      width: 18,
      height: 18,
      borderRadius: "50%",
      background: "#fff",
      transition: "left .15s",
      boxShadow: "0 1px 3px rgba(0,0,0,.3)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    },
    onClick: () => setKeepOrig(v => !v)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: C.t1
    }
  }, "날짜·진행상태 그대로 이월"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t3,
      marginTop: 1
    }
  }, keepOrig ? "완수일·날짜는 그대로, 보고서·FMS·납품은 미완으로 초기화 (이어지는 계약)" : "새 점검으로 날짜·진행·상태 모두 초기화해요"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      background: C.surfaceL,
      border: BD,
      borderRadius: 8,
      padding: "7px 11px",
      gap: 7,
      alignItems: "center",
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t4
    }
  }, "⌕"), /*#__PURE__*/React.createElement("input", {
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "학교명·지역 검색",
    style: {
      background: "transparent",
      border: "none",
      color: C.t1,
      fontSize: 15,
      outline: "none",
      flex: 1
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "12px 16px"
    }
  }, buckets.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 0",
      color: C.t4,
      fontSize: 15
    }
  }, "복사할 다른 반기 데이터가 없습니다."), buckets.map(bk => {
    const rows = bk.arr.filter(ms);
    if (!rows.length) return null;
    const bhc = bk.h === "상반기" ? C.blue : C.orange;
    return /*#__PURE__*/React.createElement("div", {
      key: bk.y + bk.h,
      style: {
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
        position: "sticky",
        top: 0,
        background: C.surface,
        padding: "4px 0",
        zIndex: 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: bhc
      }
    }, bk.h === "상반기" ? "🌱" : "🍂", " ", bk.y, "년 ", bk.h), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: C.t4
      }
    }, rows.length, "개"), /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleBucket(bk),
      style: {
        marginLeft: "auto",
        padding: "4px 10px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 700,
        border: `1px solid ${bhc}40`,
        background: allSelInBucket(bk) ? bhc : C.surfaceL,
        color: allSelInBucket(bk) ? "#fff" : bhc,
        cursor: "pointer"
      }
    }, allSelInBucket(bk) ? "전체 해제" : "전체 선택")), rows.map(s => {
      const k = keyOf(bk, s);
      const on = sel.has(k);
      const dup = destKeys.has(`${(s.school || "").trim()}|${(s.no || "").toString().trim()}`);
      return /*#__PURE__*/React.createElement("div", {
        key: k,
        onClick: () => toggle(k),
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 11px",
          borderRadius: 8,
          cursor: "pointer",
          border: `1px solid ${on ? C.blue : C.border}`,
          background: on ? C.blueL : C.surface,
          marginBottom: 6
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 20,
          height: 20,
          borderRadius: 5,
          border: `2px solid ${on ? C.blue : C.borderD}`,
          background: on ? C.blue : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#fff",
          fontSize: 15,
          fontWeight: 800
        }
      }, on ? "✓" : ""), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 15,
          fontWeight: 700,
          color: C.t1,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, s.school), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          color: C.t4
        }
      }, s.region, " · ", (s.buildings || []).length, "동"), dup && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          color: C.orange,
          fontWeight: 700,
          background: C.orangeL,
          padding: "2px 6px",
          borderRadius: 4,
          whiteSpace: "nowrap"
        }
      }, "이미 있음"));
    }));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 18px",
      borderTop: BD,
      flexShrink: 0,
      display: "flex",
      gap: 10,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.t2,
      fontWeight: 600
    }
  }, selCount, "개 선택됨"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      marginLeft: "auto",
      padding: "11px 18px",
      borderRadius: 9,
      border: BD,
      background: "transparent",
      color: C.t3,
      fontSize: 15,
      cursor: "pointer"
    }
  }, "취소"), /*#__PURE__*/React.createElement("button", {
    onClick: doCopy,
    disabled: selCount === 0,
    style: {
      padding: "11px 22px",
      borderRadius: 9,
      border: "none",
      background: selCount === 0 ? C.surfaceD : C.blue,
      color: selCount === 0 ? C.t4 : "#fff",
      fontSize: 15,
      fontWeight: 700,
      cursor: selCount === 0 ? "default" : "pointer"
    }
  }, toHalf, "로 복사 (", selCount, ")"))));
}

/* ══════════════════════════════════════════════════════════════
   현장 관리 — 연도/반기 탭 + 테이블
══════════════════════════════════════════════════════════════ */
function SitesManager({
  db,
  setDb,
  isMobile
}) {
  const [yr, setYr] = useState(String(new Date().getFullYear()));
  const [half, setHalf] = useState(new Date().getMonth() + 1 <= 6 ? "상반기" : "하반기");
  /* 데이터가 들어왔는데 현재 탭이 비어 있으면, 데이터 있는 연/반기로 자동 이동 (최초 1회) */
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    const anyData = Object.values(db).some(hs => Object.values(hs || {}).some(a => (a || []).length));
    if (!anyData) return; // 아직 데이터 없음 → 대기
    if ((db[yr]?.[half] || []).length) {
      didInit.current = true;
      return;
    } // 현재 탭에 데이터 있음
    const years = Object.keys(db).sort((a, b) => b - a);
    for (const y of years) for (const h of Object.keys(db[y] || {})) {
      if ((db[y]?.[h] || []).length) {
        setYr(y);
        setHalf(h);
        didInit.current = true;
        return;
      }
    }
  }, [db]);
  const [stF, setStF] = useState("전체");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(new Set());
  const [copied, setCopied] = useState(null);
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null); // 아직 저장 안 한 새 현장
  const [copyOpen, setCopyOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = m => {
    setToast(m);
    setTimeout(() => setToast(null), 2000);
  };
  const copy = (t, id) => {
    navigator.clipboard?.writeText(t).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  /* 새 현장 추가 → 현재 연/반기에 빈 학교 생성 후 편집창 열기 */
  const addNewSite = () => {
    const id = `new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    /* 여기서는 목록에 넣지 않는다. 수정창에서 '저장'을 눌러야 비로소 추가된다.
       취소하면 아무 흔적도 남지 않는다. */
    const newSc = {
      id,
      school: "",
      no: "",
      region: "",
      kind: "정기점검",
      field: "",
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
      }]
    };
    setDraft(newSc);
    setEditId(id);
    /* 필터·검색이 켜져 있으면 저장 후에도 목록에서 걸러져 안 보인다 */
    setStF("전체");
    setSearch("");
  };
  const schools = useMemo(() => (db[yr]?.[half] || []).filter(s => !s.deleted), [db, yr, half]);
  const updDate = (sid, field, v) => {
    const sc = schools.find(s => s.id === sid);
    const lblChk = field === "field" ? "현장조사일" : field === "start" ? "착수일" : field === "deliverDate" ? "납품일" : "완수일";
    /* 시트가 주인인 날짜는 앱에서 못 고친다 (납품일만 앱) */
    if (field !== "deliverDate" && typeof window.__stonSheetLinked === "function" && window.__stonSheetLinked(sid)) {
      showToast(`${lblChk}은 스프레드시트에서 고칩니다`);
      return;
    }
    const lbl = field === "field" ? "현장조사일" : field === "start" ? "착수일" : field === "deliverDate" ? "납품일" : "완수일";
    setDb(prev => {
      const n = {
        ...prev
      };
      n[yr] = {
        ...prev[yr]
      };
      n[yr][half] = (prev[yr]?.[half] || []).map(s => s.id !== sid ? s : stampEdit({
        ...s,
        [field]: v
      }, `${lbl} 변경`));
      return n;
    });
    logAction("수정", `${sc?.school} · ${lbl}`, sc?.[field] || "-", v || "-");
    showToast("날짜 변경됨 · 캘린더 자동 반영");
  };
  const toggleB = (sid, bi, field) => {
    const sc = schools.find(s => s.id === sid);
    const b = sc?.buildings[bi];
    const fl = field === "rep" ? "보고서" : field === "fmsD" ? "FMS등록" : field;
    setDb(prev => {
      const n = {
        ...prev
      };
      n[yr] = {
        ...prev[yr]
      };
      n[yr][half] = (prev[yr]?.[half] || []).map(s => s.id !== sid ? s : stampEdit({
        ...s,
        buildings: s.buildings.map((x, j) => j !== bi ? x : {
          ...x,
          [field]: !x[field]
        })
      }, `${b?.b || ""} ${fl}`));
      return n;
    });
    logAction("수정", `${sc?.school} · ${b?.b || ""} ${fl}`, b?.[field] ? "완료" : "미완료", b?.[field] ? "미완료" : "완료");
  };
  const setDel = (sid, bi, v) => {
    const sc = schools.find(s => s.id === sid);
    const b = sc?.buildings[bi];
    setDb(prev => {
      const n = {
        ...prev
      };
      n[yr] = {
        ...prev[yr]
      };
      n[yr][half] = (prev[yr]?.[half] || []).map(s => s.id !== sid ? s : stampEdit({
        ...s,
        buildings: s.buildings.map((x, j) => j !== bi ? x : {
          ...x,
          delivery: x.delivery === v ? null : v
        })
      }, `${b?.b || ""} 납품`));
      return n;
    });
    logAction("수정", `${sc?.school} · ${b?.b || ""} 납품`, b?.delivery || "-", b?.delivery === v ? "-" : v);
  };
  const filtered = useMemo(() => schools.filter(s => {
    if (search && !s.school.includes(search) && !(s.region || "").includes(search)) return false;
    if (stF === "보고서 미완") return s.buildings.some(b => !b.rep);
    if (stF === "FMS 미완") return s.buildings.some(b => !b.fmsD);
    if (stF === "납품 미정") return deliveryOf(s).state !== "완료";
    if (stF === "납품 완료") return deliveryOf(s).state === "완료";
    if (stF === "완료") return s.buildings.every(b => b.rep && b.fmsD);
    return true;
  }).sort((a, b) => {
    const da = calcDday(a.end) ?? 9999,
      dbb = calcDday(b.end) ?? 9999;
    if (da < 0 && dbb >= 0) return -1;
    if (da >= 0 && dbb < 0) return 1;
    if (da < 0 && dbb < 0) return dbb - da;
    return da - dbb;
  }), [schools, stF, search]);
  const allB = filtered.flatMap(s => s.buildings);
  const st = {
    total: allB.length,
    rep: allB.filter(b => b.rep).length,
    fms: allB.filter(b => b.fmsD).length,
    noD: filtered.filter(s => deliveryOf(s).state !== "완료").length,
    done: filtered.filter(s => deliveryOf(s).state === "완료").length
  };
  const years = Object.keys(db).sort((a, b) => b - a);
  const isDraft = !!(draft && draft.id === editId);
  const editSc = isDraft ? draft : editId ? schools.find(s => s.id === editId) : null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 22,
      fontWeight: 800,
      color: C.t1
    }
  }, "현장 관리"))), isMobile ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: BD,
      borderRadius: 12,
      padding: "9px 10px",
      boxShadow: "0 1px 6px rgba(0,0,0,.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginBottom: 7
    }
  }, years.map(y => /*#__PURE__*/React.createElement("button", {
    key: y,
    onClick: () => {
      setYr(y);
      setHalf(Object.keys(db[y] || {})[0] || "상반기");
    },
    style: {
      flex: "1 1 auto",
      padding: "9px 6px",
      borderRadius: 8,
      border: `1px solid ${yr === y ? C.blue : C.border}`,
      background: yr === y ? C.blueL : "transparent",
      color: yr === y ? C.blue : C.t3,
      fontSize: 15,
      fontWeight: yr === y ? 800 : 600,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, isLH(y) ? "🏢 LH" : `${String(y).slice(2)}년`))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, (isLH(yr) ? ["정밀"] : ["상반기", "하반기"]).map(h => {
    const cnt = (db[yr]?.[h] || []).length,
      on = half === h,
      hc = h === "상반기" ? C.blue : h === "정밀" ? C.purple : C.orange;
    return /*#__PURE__*/React.createElement("button", {
      key: h,
      onClick: () => setHalf(h),
      style: {
        flex: 1,
        padding: "10px 6px",
        borderRadius: 8,
        border: `1px solid ${on ? hc : C.border}`,
        background: on ? hc + "12" : "transparent",
        color: on ? hc : C.t3,
        fontSize: 15,
        fontWeight: on ? 800 : 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        whiteSpace: "nowrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16
      }
    }, h === "상반기" ? "🌱" : h === "정밀" ? "🏢" : "🍂"), h, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        padding: "1px 6px",
        borderRadius: 10,
        background: on ? hc + "20" : C.surfaceL,
        color: on ? hc : C.t4,
        fontWeight: 700
      }
    }, cnt));
  }))) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      background: C.surface,
      border: BD,
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 1px 6px rgba(0,0,0,.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      borderRight: `2px solid ${C.border}`,
      flexShrink: 0
    }
  }, years.map(y => /*#__PURE__*/React.createElement("button", {
    key: y,
    onClick: () => {
      setYr(y);
      setHalf(Object.keys(db[y] || {})[0] || "상반기");
    },
    style: {
      padding: "12px 20px",
      border: "none",
      borderBottom: `3px solid ${yr === y ? C.blue : "transparent"}`,
      background: yr === y ? C.blueL : "transparent",
      color: yr === y ? C.blue : C.t3,
      fontSize: 16,
      fontWeight: yr === y ? 800 : 500,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, isLH(y) ? "🏢 LH" : `${y}년`, " ", yr === y && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      marginLeft: 5,
      color: C.t4
    }
  }, Object.values(db[y] || {}).reduce((a, arr) => a + (arr || []).length, 0), "건")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      padding: "0 8px",
      flexShrink: 0
    }
  }, (isLH(yr) ? ["정밀"] : ["상반기", "하반기"]).map(h => {
    const cnt = (db[yr]?.[h] || []).length,
      on = half === h,
      hc = h === "상반기" ? C.blue : h === "정밀" ? C.purple : C.orange;
    return /*#__PURE__*/React.createElement("button", {
      key: h,
      onClick: () => setHalf(h),
      style: {
        padding: "12px 18px",
        border: "none",
        borderBottom: `3px solid ${on ? hc : "transparent"}`,
        background: on ? hc + "12" : "transparent",
        color: on ? hc : C.t3,
        fontSize: 15,
        fontWeight: on ? 700 : 500,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 7,
        whiteSpace: "nowrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16
      }
    }, h === "상반기" ? "🌱" : h === "정밀" ? "🏢" : "🍂"), h, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        padding: "1px 6px",
        borderRadius: 10,
        background: on ? hc + "20" : C.surfaceL,
        color: on ? hc : C.t4,
        fontWeight: 700
      }
    }, cnt));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      padding: "0 16px",
      fontSize: 13,
      color: C.t3,
      fontWeight: 600,
      whiteSpace: "nowrap"
    }
  }, isLH(yr) ? "LH 정밀" : `${yr}년 ${half}`, " · ", filtered.length, "개 / ", filtered.flatMap(s => s.buildings).length, "동")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: isMobile ? "repeat(4,1fr)" : "repeat(4,1fr)",
      gap: isMobile ? 6 : 10
    }
  }, [{
    label: isMobile ? "전체" : "전체 동",
    val: st.total,
    c: C.t2,
    f: "전체"
  }, {
    label: isMobile ? "보고서" : "📄 보고서 완료",
    val: isMobile ? `${st.rep}` : `${st.rep}/${st.total}`,
    c: C.purple,
    f: "보고서 미완"
  }, {
    label: isMobile ? "FMS" : "🖥 FMS 완료",
    val: isMobile ? `${st.fms}` : `${st.fms}/${st.total}`,
    c: C.blue,
    f: "FMS 미완"
  }, {
    label: isMobile ? "납품" : "📦 납품 완료",
    val: isMobile ? `${st.done}` : `${st.done}/${filtered.length}`,
    c: C.green,
    f: "납품 완료"
  }].map(x => /*#__PURE__*/React.createElement("button", {
    key: x.label,
    onClick: () => setStF(x.f),
    style: {
      padding: isMobile ? "10px 4px" : "16px 18px",
      background: stF === x.f ? x.c + "12" : C.surface,
      border: `1px solid ${stF === x.f ? x.c : C.border}`,
      borderRadius: 14,
      textAlign: isMobile ? "center" : "left",
      cursor: "pointer",
      boxShadow: "0 1px 6px rgba(0,0,0,.04)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: isMobile ? 18 : 28,
      fontWeight: 800,
      color: x.c,
      lineHeight: 1
    }
  }, x.val), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: isMobile ? 12 : 12,
      color: C.t3,
      marginTop: 6,
      fontWeight: 600,
      whiteSpace: "nowrap"
    }
  }, x.label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "center",
      padding: isMobile ? "10px 11px" : "10px 14px",
      background: C.surface,
      border: BD,
      borderRadius: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      background: C.surfaceL,
      border: BD,
      borderRadius: 7,
      padding: "8px 11px",
      gap: 7,
      alignItems: "center",
      width: isMobile ? "100%" : 190
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t4
    }
  }, "⌕"), /*#__PURE__*/React.createElement("input", {
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "학교명·지역",
    style: {
      background: "transparent",
      border: "none",
      color: C.t1,
      fontSize: 15,
      outline: "none",
      flex: 1
    }
  }), search && /*#__PURE__*/React.createElement("button", {
    onClick: () => setSearch(""),
    style: {
      background: "transparent",
      border: "none",
      color: C.t4,
      fontSize: 16,
      padding: 0,
      cursor: "pointer"
    }
  }, "×")), !isMobile && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 18,
      background: C.border
    }
  }), ["전체", "보고서 미완", "FMS 미완", "납품 미정", "납품 완료", "완료"].map(ff => /*#__PURE__*/React.createElement(Pill, {
    key: ff,
    active: stF === ff,
    ac: C.purple,
    onClick: () => setStF(ff),
    style: {
      fontSize: 13
    }
  }, ff)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: isMobile ? 0 : "auto",
      display: "flex",
      gap: 8,
      width: isMobile ? "100%" : "auto"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setCopyOpen(true),
    style: {
      flex: isMobile ? 1 : "none",
      padding: "10px 14px",
      borderRadius: 8,
      border: `1px solid ${C.blue}40`,
      background: C.blueL,
      color: C.blue,
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "📋 반기 복사"), /*#__PURE__*/React.createElement("button", {
    onClick: () => showToast("현장은 스프레드시트에 추가하면 5분 안에 앱에 자동으로 생깁니다"),
    title: "시트가 주인 — 앱에서는 만들지 않습니다",
    style: {
      flex: isMobile ? 1 : "none",
      padding: "10px 16px",
      borderRadius: 8,
      border: "none",
      background: C.blue,
      color: "#fff",
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap",
      boxShadow: `0 3px 10px ${C.blue}33`
    }
  }, "📄 시트에서 추가"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: BD,
      borderRadius: 12,
      overflowX: isMobile ? "visible" : "hidden",
      overflowY: "hidden",
      boxShadow: "0 2px 10px rgba(0,0,0,.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: isMobile ? "auto" : "auto"
    }
  }, !isMobile && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "2fr 126px 126px 68px 116px 46px",
      background: C.surfaceL,
      borderBottom: `1px solid ${C.borderD}`,
      padding: "10px 16px",
      gap: 8
    }
  }, ["학교 · 시설명", "현장조사일", "완수일", "D-day", "보고서·FMS·납품", "수정"].map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      fontSize: 12,
      color: C.t3,
      fontWeight: 700,
      letterSpacing: .5,
      textAlign: i >= 1 ? "center" : "left"
    }
  }, h))), filtered.map((s, si) => {
    const isOpen = open.has(s.id);
    const repAll = s.buildings.every(b => b.rep),
      fmsAll = s.buildings.every(b => b.fmsD);
    const delAll = s.buildings.every(b => b.delivery);
    const allDone = repAll && fmsAll && delAll;
    const dd = calcDday(s.end),
      urgent = dd !== null && dd <= 7; // 지났거나 7일 이내
    const tel = siteTel(s);
    const toggleOpen = () => setOpen(p => {
      const n = new Set(p);
      n.has(s.id) ? n.delete(s.id) : n.add(s.id);
      return n;
    });
    /* 줄무늬를 없애고 흰색으로 통일 — 대신 행 사이 구분선을 진하게 했다.
       긴급·완료만 아주 옅게 표시해 눈에 걸리게 둔다. */
    const rowBg = urgent ? C.redL + "60" : allDone ? C.greenL + "40" : C.surface;
    const rowAccent = urgent ? C.red : allDone ? C.green : "transparent";

    /* ── 휴대폰: 칸을 나누지 않고 위아래로 쌓아서 표시 ── */
    if (isMobile) return /*#__PURE__*/React.createElement("div", {
      key: s.id,
      style: {
        borderBottom: `1px solid ${C.borderD}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "12px 13px",
        background: rowBg,
        borderLeft: `3px solid ${rowAccent}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: toggleOpen,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        cursor: "pointer",
        userSelect: "none"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.t4,
        fontSize: 14,
        transform: isOpen ? "rotate(90deg)" : "none",
        transition: "transform .2s",
        flexShrink: 0
      }
    }, "›"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: deliveryOf(s).state === "완료" ? 500 : 800,
        fontSize: 16,
        color: deliveryOf(s).state === "완료" ? C.t3 : C.t1,
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, s.school), isTentative(s) && /*#__PURE__*/React.createElement(Tag, {
      bg: C.orangeL,
      color: C.orange,
      border: `1px solid ${C.orange}45`
    }, "◌ 예정"), isNewSite(s) && /*#__PURE__*/React.createElement(Tag, {
      bg: C.redL,
      color: C.red,
      border: `1px solid ${C.red}45`
    }, "🆕 신규"), urgent && /*#__PURE__*/React.createElement(Tag, {
      bg: C.redL,
      color: C.red,
      border: `1px solid ${C.red}30`
    }, "⚡"), s.carried && /*#__PURE__*/React.createElement(Tag, {
      bg: C.orange + "18",
      color: C.orange,
      border: `1px solid ${C.orange}40`
    }, "🍂"), /*#__PURE__*/React.createElement("button", {
      onClick: e => {
        e.stopPropagation();
        openRoute(routeLinks(s, null).kakao);
      },
      title: "길찾기",
      style: {
        padding: isMobile ? "9px 12px" : "5px 10px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 800,
        background: C.purpleL,
        border: `1px solid ${C.purple}45`,
        color: C.purple,
        cursor: "pointer",
        flexShrink: 0
      }
    }, "🧭"), /*#__PURE__*/React.createElement("button", {
      onClick: e => {
        e.stopPropagation();
        setEditId(s.id);
      },
      style: {
        padding: isMobile ? "9px 13px" : "5px 11px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 700,
        background: C.blueL,
        border: `1px solid ${C.blue}40`,
        color: C.blue,
        cursor: "pointer",
        flexShrink: 0
      }
    }, "✏ 수정")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        flexWrap: "wrap",
        marginTop: 6,
        paddingLeft: 19
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: C.t3
      }
    }, s.region), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: C.t4
      }
    }, s.buildings.length, "동"), (() => {
      const dv = deliveryOf(s);
      const col = dv.state === "완료" ? C.green : dv.state === "예정" ? C.blue : C.orange;
      return /*#__PURE__*/React.createElement("span", {
        title: dv.state === "완료" ? `납품 완료 · ${dv.way || "방법 미기재"}${dv.date ? " · " + dv.date : ""}${dv.by ? " · " + dv.by : ""}` : dv.label,
        style: {
          fontSize: 12,
          fontWeight: 800,
          padding: "2px 7px",
          borderRadius: 4,
          background: col + "14",
          border: `1px solid ${col}45`,
          color: col,
          whiteSpace: "nowrap"
        }
      }, dv.state === "완료" ? (dv.way === "우편" ? "📮 " : dv.way === "직납" ? "🚚 " : "📦 ") + dv.label : dv.state === "예정" ? "📦 " + dv.label : "📦 미정");
    })(), getFlags(s).map(fv => {
      const o = FLAG_OPTS.find(x => x.v === fv);
      return o ? /*#__PURE__*/React.createElement("span", {
        key: fv,
        style: {
          fontSize: 13,
          fontWeight: 700,
          color: o.color
        }
      }, o.label) : null;
    }), tel && /*#__PURE__*/React.createElement("a", {
      href: `tel:${tel.replace(/[^0-9+]/g, "")}`,
      onClick: e => e.stopPropagation(),
      style: {
        padding: isMobile ? "9px 12px" : "3px 9px",
        borderRadius: 5,
        fontSize: 13,
        fontWeight: 800,
        textDecoration: "none",
        border: `1px solid ${C.green}55`,
        background: C.greenL,
        color: C.green,
        whiteSpace: "nowrap"
      }
    }, "📞 ", tel)), (s.assignees || []).length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.t2,
        marginTop: 5,
        paddingLeft: 19
      }
    }, "👤 ", sortMembers(s.assignees).join(" · ")), s.lastEdit && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4,
        paddingLeft: 19
      }
    }, /*#__PURE__*/React.createElement(LastEdit, {
      s: s,
      size: 10
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginTop: 9,
        paddingLeft: 19,
        paddingRight: 2
      },
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 3,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.t4,
        fontWeight: 700
      }
    }, "현장조사일"), /*#__PURE__*/React.createElement("input", {
      type: "date",
      value: s.field || "",
      onChange: e => updDate(s.id, "field", e.target.value),
      disabled: typeof window.__stonSheetLinked === "function" && window.__stonSheetLinked(s.id),
      title: typeof window.__stonSheetLinked === "function" && window.__stonSheetLinked(s.id) ? "시트에서 관리" : undefined,
      style: {
        background: typeof window.__stonSheetLinked === "function" && window.__stonSheetLinked(s.id) ? C.bg : C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 7,
        color: C.blue,
        fontSize: 15,
        padding: "9px 4px",
        outline: "none",
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
        WebkitAppearance: "none",
        appearance: "none",
        textAlign: "center",
        fontWeight: 700
      }
    })), /*#__PURE__*/React.createElement("label", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 3,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.t4,
        fontWeight: 700
      }
    }, "완수일 ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: ddC(dd)
      }
    }, ddL(dd))), /*#__PURE__*/React.createElement("input", {
      type: "date",
      value: s.end || "",
      onChange: e => updDate(s.id, "end", e.target.value),
      disabled: typeof window.__stonSheetLinked === "function" && window.__stonSheetLinked(s.id),
      title: typeof window.__stonSheetLinked === "function" && window.__stonSheetLinked(s.id) ? "시트에서 관리" : undefined,
      style: {
        background: typeof window.__stonSheetLinked === "function" && window.__stonSheetLinked(s.id) ? C.bg : C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 7,
        color: C.orange,
        fontSize: 15,
        padding: "9px 4px",
        outline: "none",
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
        WebkitAppearance: "none",
        appearance: "none",
        textAlign: "center",
        fontWeight: 700
      }
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        marginTop: 9,
        paddingLeft: 19
      },
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/(s.flow || s.fromSheet ? /*#__PURE__*/React.createElement(Flow16Bar, {
      flow: s.flow || {},
      compact: true
    }) : /*#__PURE__*/React.createElement(StepBar, {
      progress: s.progress,
      compact: true
    })), [{
      k: "보고서",
      v: repAll,
      c: C.purple
    }, {
      k: "FMS",
      v: fmsAll,
      c: C.blue
    }, {
      k: "납품",
      v: delAll,
      c: C.green
    }].map(x => /*#__PURE__*/React.createElement("span", {
      key: x.k,
      style: {
        fontSize: 12,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 5,
        background: x.v ? x.c + "18" : C.surfaceL,
        color: x.v ? x.c : C.t4,
        border: `1px solid ${x.v ? x.c + "50" : C.border}`
      }
    }, x.v ? "✓ " : "", x.k)))), isOpen && s.buildings.map((b, bi) => {
      const iid = `${s.id}-${bi}`;
      return /*#__PURE__*/React.createElement("div", {
        key: bi,
        style: {
          padding: "10px 13px 10px 32px",
          background: C.surfaceL,
          borderTop: `1px solid ${C.border}`,
          borderLeft: `3px solid ${b.rep && b.fmsD && b.delivery ? C.green + "40" : "transparent"}`
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 7,
          flexWrap: "wrap"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 15,
          color: C.t1,
          fontWeight: 700,
          flex: 1,
          minWidth: 0
        }
      }, b.b), b.field && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          fontWeight: 800,
          padding: "1px 6px",
          borderRadius: 4,
          background: C.blueL,
          border: `1px solid ${C.blue}45`,
          color: C.blue,
          whiteSpace: "nowrap"
        }
      }, "◆ ", b.field.slice(5).replace("-", "/")), bldSize(b) && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          color: C.t4
        }
      }, isCivilB(b) ? "연장/높이 " : "", bldSize(b)), b.fms && /*#__PURE__*/React.createElement("button", {
        onClick: () => copy(b.fms, `f-${iid}`),
        style: {
          padding: "4px 9px",
          borderRadius: 5,
          fontSize: 12,
          fontWeight: 700,
          border: `1px solid ${copied === `f-${iid}` ? C.green : C.border}`,
          background: copied === `f-${iid}` ? C.greenL : C.surface,
          color: copied === `f-${iid}` ? C.green : C.blue,
          cursor: "pointer"
        }
      }, copied === `f-${iid}` ? "✓ 복사" : "🔐 FMS")), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 5,
          alignItems: "center",
          flexWrap: "wrap",
          marginTop: 7
        }
      }, [{
        v: b.rep,
        f: "rep",
        l: "보고서",
        ac: C.purple,
        bc: C.purpleL
      }, {
        v: b.fmsD,
        f: "fmsD",
        l: "FMS",
        ac: C.blue,
        bc: C.blueL
      }].map(x => /*#__PURE__*/React.createElement("button", {
        key: x.f,
        onClick: () => toggleB(s.id, bi, x.f),
        style: {
          padding: "6px 11px",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 700,
          border: `1px solid ${x.v ? x.ac + "60" : C.border}`,
          background: x.v ? x.bc : C.surface,
          color: x.v ? x.ac : C.t4,
          cursor: "pointer"
        }
      }, x.v ? "✓ " : "", x.l)), ["직납", "우편"].map(dv => /*#__PURE__*/React.createElement("button", {
        key: dv,
        onClick: () => setDel(s.id, bi, dv),
        style: {
          padding: "6px 11px",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 700,
          border: `1px solid ${b.delivery === dv ? C.green + "60" : C.border}`,
          background: b.delivery === dv ? C.greenL : C.surface,
          color: b.delivery === dv ? C.green : C.t4,
          cursor: "pointer"
        }
      }, dv))), b.note && /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 13,
          color: C.t2,
          marginTop: 7,
          padding: "6px 9px",
          background: C.yellowL,
          borderRadius: 5,
          borderLeft: `2px solid ${C.yellow}`,
          lineHeight: 1.6
        }
      }, "⚠ ", b.note));
    }));

    /* ── PC: 기존 표 형태 ── */
    return /*#__PURE__*/React.createElement("div", {
      key: s.id,
      style: {
        borderBottom: `1px solid ${C.borderD}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: toggleOpen,
      style: {
        display: "grid",
        gridTemplateColumns: "2fr 126px 126px 68px 116px 46px",
        gap: 8,
        padding: "12px 16px",
        cursor: "pointer",
        userSelect: "none",
        background: rowBg,
        borderLeft: `3px solid ${rowAccent}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 5,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.t4,
        fontSize: 13,
        display: "inline-block",
        transform: isOpen ? "rotate(90deg)" : "none",
        transition: "transform .2s"
      }
    }, "›"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: deliveryOf(s).state === "완료" ? 500 : 800,
        fontSize: 16,
        color: deliveryOf(s).state === "완료" ? C.t3 : C.t1
      }
    }, s.school), isTentative(s) && /*#__PURE__*/React.createElement(Tag, {
      bg: C.orangeL,
      color: C.orange,
      border: `1px solid ${C.orange}45`
    }, "◌ 예정"), isNewSite(s) && /*#__PURE__*/React.createElement(Tag, {
      bg: C.redL,
      color: C.red,
      border: `1px solid ${C.red}45`
    }, "🆕 신규"), s.carried && /*#__PURE__*/React.createElement(Tag, {
      bg: C.orange + "18",
      color: C.orange,
      border: `1px solid ${C.orange}40`
    }, "🍂 이월"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.t3
      }
    }, s.region), tel && /*#__PURE__*/React.createElement("a", {
      href: `tel:${tel.replace(/[^0-9+]/g, "")}`,
      onClick: e => e.stopPropagation(),
      title: `${tel} 로 전화`,
      style: {
        padding: "2px 8px",
        borderRadius: 5,
        fontSize: 12,
        fontWeight: 800,
        textDecoration: "none",
        border: `1px solid ${C.green}55`,
        background: C.greenL,
        color: C.green,
        whiteSpace: "nowrap"
      }
    }, "📞 ", tel), urgent && /*#__PURE__*/React.createElement(Tag, {
      bg: C.redL,
      color: C.red,
      border: `1px solid ${C.red}30`
    }, "⚡긴급"), (() => {
      const dv = deliveryOf(s);
      const col = dv.state === "완료" ? C.green : dv.state === "예정" ? C.blue : C.orange;
      return /*#__PURE__*/React.createElement("span", {
        title: dv.state === "완료" ? `납품 완료 · ${dv.way || "방법 미기재"}${dv.date ? " · " + dv.date : ""}${dv.by ? " · " + dv.by : ""}` : dv.label,
        style: {
          fontSize: 12,
          fontWeight: 800,
          padding: "2px 7px",
          borderRadius: 4,
          background: col + "14",
          border: `1px solid ${col}45`,
          color: col,
          whiteSpace: "nowrap"
        }
      }, dv.state === "완료" ? (dv.way === "우편" ? "📮 " : dv.way === "직납" ? "🚚 " : "📦 ") + dv.label : dv.state === "예정" ? "📦 " + dv.label : "📦 미정");
    })(), getFlags(s).map(fv => {
      const o = FLAG_OPTS.find(x => x.v === fv);
      return o ? /*#__PURE__*/React.createElement("span", {
        key: fv,
        style: {
          fontSize: 12,
          fontWeight: 700,
          color: o.color
        }
      }, o.label) : null;
    }), (s.assignees || []).length > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.t2
      }
    }, "👤 ", sortMembers(s.assignees).join("·")), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.t4
      }
    }, s.buildings.length, "동")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        paddingLeft: 19
      },
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/(s.flow || s.fromSheet ? /*#__PURE__*/React.createElement(Flow16Bar, {
      flow: s.flow || {},
      compact: true
    }) : /*#__PURE__*/React.createElement(StepBar, {
      progress: s.progress,
      compact: true
    })), (() => {
      const pg = s.progress || {};
      const chip = (label, on, col) => /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          fontWeight: 700,
          padding: "1px 6px",
          borderRadius: 4,
          background: on ? col + "18" : C.surfaceL,
          color: on ? col : C.t4,
          border: `1px solid ${on ? col + "50" : C.border}`
        }
      }, on ? "✓ " : "", label);
      return /*#__PURE__*/React.createElement(React.Fragment, null, chip("착수계", !!pg["착수계"], C.blue), chip("검토", !!pg["검토"], C.purple), chip("제본", !!pg["제본"], C.purple), chip("완수", !!pg["완수"], C.green));
    })(), /*#__PURE__*/React.createElement(LastEdit, {
      s: s
    }))), /*#__PURE__*/React.createElement("div", {
      onClick: e => e.stopPropagation(),
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "date",
      value: s.field || "",
      onChange: e => updDate(s.id, "field", e.target.value),
      disabled: typeof window.__stonSheetLinked === "function" && window.__stonSheetLinked(s.id),
      title: typeof window.__stonSheetLinked === "function" && window.__stonSheetLinked(s.id) ? "시트에서 관리" : undefined,
      style: {
        background: typeof window.__stonSheetLinked === "function" && window.__stonSheetLinked(s.id) ? C.bg : "transparent",
        border: `1px solid ${C.border}`,
        borderRadius: 5,
        color: C.blue,
        fontSize: 12,
        padding: "4px 3px",
        outline: "none",
        width: "100%",
        textAlign: "center",
        fontWeight: 600
      }
    })), /*#__PURE__*/React.createElement("div", {
      onClick: e => e.stopPropagation(),
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "date",
      value: s.end || "",
      onChange: e => updDate(s.id, "end", e.target.value),
      disabled: typeof window.__stonSheetLinked === "function" && window.__stonSheetLinked(s.id),
      title: typeof window.__stonSheetLinked === "function" && window.__stonSheetLinked(s.id) ? "시트에서 관리" : undefined,
      style: {
        background: typeof window.__stonSheetLinked === "function" && window.__stonSheetLinked(s.id) ? C.bg : "transparent",
        border: `1px solid ${C.border}`,
        borderRadius: 5,
        color: C.orange,
        fontSize: 12,
        padding: "4px 3px",
        outline: "none",
        width: "100%",
        textAlign: "center",
        fontWeight: 600
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: ddC(dd),
        textAlign: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, ddL(dd)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 4,
        alignItems: "center",
        justifyContent: "center"
      }
    }, [{
      k: "보",
      v: repAll,
      c: C.purple
    }, {
      k: "F",
      v: fmsAll,
      c: C.blue
    }, {
      k: "납",
      v: delAll,
      c: C.green
    }].map(x => /*#__PURE__*/React.createElement("div", {
      key: x.k,
      style: {
        width: 32,
        height: 26,
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: x.v ? x.c + "18" : C.surfaceL,
        border: `1px solid ${x.v ? x.c + "50" : C.border}`,
        fontSize: 12,
        fontWeight: 700,
        color: x.v ? x.c : C.t4
      }
    }, x.v ? "✓" : x.k))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: e => {
        e.stopPropagation();
        setEditId(s.id);
      },
      style: {
        padding: isMobile ? "9px 12px" : "3px 9px",
        borderRadius: 5,
        fontSize: 12,
        fontWeight: 700,
        background: C.blueL,
        border: `1px solid ${C.blue}40`,
        color: C.blue,
        cursor: "pointer"
      }
    }, "✏"))), isOpen && s.buildings.map((b, bi) => {
      const iid = `${s.id}-${bi}`;
      return /*#__PURE__*/React.createElement("div", {
        key: bi,
        style: {
          display: "grid",
          gridTemplateColumns: "2fr 126px 126px 68px 116px 46px",
          gap: 8,
          padding: "8px 16px 8px 38px",
          background: C.surfaceL,
          borderTop: `1px solid ${C.border}`,
          borderLeft: `3px solid ${b.rep && b.fmsD && b.delivery ? C.green + "40" : "transparent"}`
        }
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 7,
          flexWrap: "wrap"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 15,
          color: C.t1,
          fontWeight: 600
        }
      }, b.b), b.field && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          fontWeight: 800,
          padding: "1px 6px",
          borderRadius: 4,
          background: C.blueL,
          border: `1px solid ${C.blue}45`,
          color: C.blue,
          whiteSpace: "nowrap"
        }
      }, "◆ ", b.field.slice(5).replace("-", "/")), bldSize(b) && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          color: C.t4
        }
      }, isCivilB(b) ? "연장/높이 " : "", bldSize(b))), b.note && /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 12,
          color: C.t2,
          marginTop: 3,
          padding: "3px 9px",
          background: C.yellowL,
          borderRadius: 4,
          borderLeft: `2px solid ${C.yellow}`,
          maxWidth: 500,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        },
        title: b.note
      }, b.note)), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }, b.fms ? /*#__PURE__*/React.createElement("button", {
        onClick: () => copy(b.fms, `f-${iid}`),
        style: {
          padding: "4px 8px",
          borderRadius: 5,
          fontSize: 12,
          fontWeight: 700,
          border: `1px solid ${copied === `f-${iid}` ? C.green : C.border}`,
          background: copied === `f-${iid}` ? C.greenL : C.surfaceL,
          color: copied === `f-${iid}` ? C.green : C.blue,
          cursor: "pointer"
        }
      }, copied === `f-${iid}` ? "✓ 복사" : "🔐 FMS") : /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          color: C.t4
        }
      }, "-")), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          color: C.t3
        }
      }, fd(s.end))), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: 700,
          color: ddC(dd)
        }
      }, ddL(dd))), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 3,
          alignItems: "center",
          justifyContent: "center"
        }
      }, [{
        v: b.rep,
        f: "rep",
        l: "보",
        ac: C.purple,
        bc: C.purpleL
      }, {
        v: b.fmsD,
        f: "fmsD",
        l: "F",
        ac: C.blue,
        bc: C.blueL
      }].map(x => /*#__PURE__*/React.createElement("button", {
        key: x.f,
        onClick: () => toggleB(s.id, bi, x.f),
        style: {
          width: 32,
          height: 26,
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 700,
          border: `1px solid ${x.v ? x.ac + "60" : C.border}`,
          background: x.v ? x.bc : C.surfaceL,
          color: x.v ? x.ac : C.t4,
          cursor: "pointer"
        }
      }, x.v ? "✓" : x.l)), ["직납", "우편"].map(dv => /*#__PURE__*/React.createElement("button", {
        key: dv,
        onClick: () => setDel(s.id, bi, dv),
        style: {
          height: 22,
          padding: "0 5px",
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 700,
          border: `1px solid ${b.delivery === dv ? C.green + "60" : C.border}`,
          background: b.delivery === dv ? C.greenL : C.surfaceL,
          color: b.delivery === dv ? C.green : C.t4,
          cursor: "pointer"
        }
      }, dv[0]))), /*#__PURE__*/React.createElement("div", null));
    }));
  }), filtered.length === 0 && (() => {
    const totalDb = Object.values(db).reduce((a, hs) => a + Object.values(hs || {}).reduce((b, arr) => b + (arr || []).length, 0), 0);
    const filterOn = stF !== "전체" || !!search;
    const bucketEmpty = schools.length === 0;
    const firstFull = (() => {
      for (const y of Object.keys(db).sort((a, b) => b - a)) for (const h of Object.keys(db[y] || {})) if ((db[y]?.[h] || []).length) return {
        y,
        h
      };
      return null;
    })();
    return /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        padding: "40px 20px",
        color: C.t4
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 600,
        color: C.t3,
        marginBottom: 6
      }
    }, bucketEmpty ? `이 기간(${yr} ${half})에 등록된 현장이 없습니다.` : `필터에 맞는 현장이 없습니다. (${yr} ${half} 전체 ${schools.length}개)`), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.t4,
        marginBottom: 14
      }
    }, "전체 저장된 학교: ", totalDb, "개", firstFull && bucketEmpty ? ` · 데이터가 있는 기간: ${firstFull.y} ${firstFull.h}` : ""), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        justifyContent: "center",
        flexWrap: "wrap"
      }
    }, filterOn && /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setStF("전체");
        setSearch("");
      },
      style: {
        padding: "10px 18px",
        borderRadius: 9,
        background: C.blue,
        border: "none",
        color: "#fff",
        fontSize: 15,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, "필터 모두 해제"), bucketEmpty && firstFull && /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setYr(firstFull.y);
        setHalf(firstFull.h);
        setStF("전체");
        setSearch("");
      },
      style: {
        padding: "10px 18px",
        borderRadius: 9,
        background: C.blue,
        border: "none",
        color: "#fff",
        fontSize: 15,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, "데이터 있는 기간으로 이동 (", firstFull.y, " ", firstFull.h, ")")));
  })())), editSc && /*#__PURE__*/React.createElement(EditPanel, {
    sc: editSc,
    yr: yr,
    half: half,
    setDb: setDb,
    isNew: isDraft,
    onClose: () => {
      setEditId(null);
      setDraft(null);
    }
  }), copyOpen && /*#__PURE__*/React.createElement(CopyHalfModal, {
    db: db,
    setDb: setDb,
    toYr: yr,
    toHalf: half,
    onClose: () => setCopyOpen(false),
    onDone: n => {
      setCopyOpen(false);
      showToast(`${n}개 현장 복사됨`);
    },
    isMobile: isMobile
  }), /*#__PURE__*/React.createElement(Toast, {
    msg: toast
  }));
}
