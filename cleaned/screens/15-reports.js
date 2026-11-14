/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 15/18 — 보고서 현황  (screens/15-reports.js)
   │ 긴급/완료 보고서 목록 화면
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════
   전체 현황 (대시보드 요약)
══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   보고서 현황 — 긴급/완료 두 탭이 같은 화면 구조를 공유
   · 연도·반기 탭으로 그 시기에 어떤 현장이 있는지 확인
   · 카드에서 보고서·FMS·납품을 바로 눌러 처리 (수정 화면 안 들어가도 됨)
   · 완료에서 체크를 풀면 기준이 같아 긴급 쪽으로 다시 나타남
   ══════════════════════════════════════════════════════════════ */
/* ── 완수·납품 판정 — 시트가 주인 ──
   시트 연동 현장은 워크플로우 16단계와 시트 완수유무·납품유무를 본다.
   시트에 없는 앱 전용 현장만 옛 8단계(progress)를 쓴다. */
const siteDone = s => {
  if (!s) return false;
  const fl = s.flow || {};
  if (Object.keys(fl).length) {
    /* 제본·납품이 끝나고 완수계까지 나갔으면 완료.
       완수계가 아직이어도 납품까지 끝났으면 실무상 마무리로 본다. */
    if (flowDone(fl["완수계발송"])) return true;
    if (flowDone(fl["납품"]) && flowDone(fl["제본"])) return true;
  }
  if (s.deliverDone) return true; /* 시트 납품유무 완료 */
  return !!(s.progress && s.progress["완수"]);
};
/* 납품 판정 — 앞서 만든 deliveryOf 와 같은 기준 */
const siteDelivered = s => {
  if (!s) return false;
  if (s.deliverDone) return true;
  const fl = s.flow || {};
  if (Object.keys(fl).length && flowDone(fl["납품"])) return true;
  return !!(s.progress && s.progress["납품"]);
};
const doneAt = s => {
  // 완료로 볼 기준 날짜(완수일)
  return s && s.end ? s.end : "";
};
/* 보고서 현황 카드 — ReportsPage 안에 두면 검색어를 한 글자 칠 때마다
   컴포넌트가 새로 만들어져 카드 전체가 다시 그려진다. 밖으로 빼서 고정. */
function ReportCard({
  s,
  accent,
  isUrgent,
  isMobile,
  setAllB,
  setEditId
}) {
    const dd = calcDday(s.end);
    const bs = s.buildings || [];
    const cnt = f => bs.filter(b => f === "delivery" ? !!b.delivery : !!b[f]).length;
    const tel = siteTel(s);
    const done = siteDone(s);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: C.surface,
        border: BD,
        borderLeft: `4px solid ${accent}`,
        borderRadius: "0 11px 11px 0",
        padding: isMobile ? "12px 13px" : "13px 16px",
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 7
      }
    }, isUrgent && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 17,
        fontWeight: 800,
        color: ddC(dd),
        minWidth: 46
      }
    }, ddL(dd)), !isUrgent && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        color: C.green
      }
    }, "✓"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        fontWeight: 800,
        color: C.t1,
        flex: 1,
        minWidth: 90,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, s.school), isTentative(s) && /*#__PURE__*/React.createElement("span", {
      style: {
        flexShrink: 0,
        fontSize: 12,
        fontWeight: 800,
        color: C.orange,
        background: C.orangeL,
        border: `1px solid ${C.orange}45`,
        borderRadius: 4,
        padding: "2px 6px"
      }
    }, "◌ 예정"), isNewSite(s) && /*#__PURE__*/React.createElement("span", {
      style: {
        flexShrink: 0,
        fontSize: 12,
        fontWeight: 800,
        color: C.red,
        background: C.redL,
        border: `1px solid ${C.red}45`,
        borderRadius: 4,
        padding: "2px 6px"
      }
    }, "🆕 신규"), tel && /*#__PURE__*/React.createElement("a", {
      href: `tel:${tel.replace(/[^0-9+]/g, "")}`,
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
    }, "📞 ", tel), /*#__PURE__*/React.createElement("button", {
      onClick: () => openRoute(routeLinks(s, null).kakao),
      style: {
        padding: isMobile ? "9px 12px" : "3px 9px",
        borderRadius: 5,
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
        whiteSpace: "nowrap",
        border: `1px solid ${C.purple}45`,
        background: C.purpleL,
        color: C.purple
      }
    }, "🧭"), /*#__PURE__*/React.createElement("button", {
      onClick: () => setEditId(s.id),
      style: {
        padding: isMobile ? "9px 13px" : "3px 10px",
        borderRadius: 5,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
        border: `1px solid ${C.blue}40`,
        background: C.blueL,
        color: C.blue
      }
    }, "✏ 수정")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.t3,
        marginBottom: 8
      }
    }, s.region, " · ", isLH(s._year) ? "LH" : `${String(s._year).slice(2)}년 ${s._half === "상반기" ? "상" : "하"}`, " · 시설 ", bs.length, s.deliverDate && ` · 납품 ${fd(s.deliverDate)}`, deliverLate(s) && /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.orange,
        fontWeight: 800
      }
    }, " ⚠"), s.end && ` · 완수 ${fd(s.end)}`, (s.assignees || []).length > 0 && ` · 👤 ${sortMembers(s.assignees).join("·")}`), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        alignItems: "center"
      }
    }, (() => {
      const fl = s.flow || {};
      const linked = Object.keys(fl).length > 0;
      /* 시트 연동 현장은 워크플로우 16단계를, 앱 전용은 옛 동별 체크를 쓴다 */
      const items = linked ? [{
        l: "보고서",
        ok: flowDone(fl["PDF"]) || flowDone(fl["워드수정"]),
        c: C.purple,
        by: fl["PDF"] || fl["워드수정"]
      }, {
        l: "검수",
        ok: flowDone(fl["검수"]) || flowDone(fl["검토"]),
        c: C.blue,
        by: fl["검수"] || fl["검토"]
      }, {
        l: "제본",
        ok: flowDone(fl["제본"]),
        c: C.orange,
        by: fl["제본"]
      }, {
        l: "납품",
        ok: siteDelivered(s),
        c: C.green,
        by: deliveryOf(s).label
      }, {
        l: "완수계",
        ok: flowDone(fl["완수계발송"]),
        c: C.t2,
        by: fl["완수계발송"]
      }] : [{
        l: "보고서",
        ok: bs.length > 0 && cnt("rep") === bs.length,
        c: C.purple,
        n: cnt("rep")
      }, {
        l: "FMS",
        ok: bs.length > 0 && cnt("fmsD") === bs.length,
        c: C.blue,
        n: cnt("fmsD")
      }, {
        l: "납품",
        ok: bs.length > 0 && cnt("delivery") === bs.length,
        c: C.green,
        n: cnt("delivery")
      }];
      return items.map(x => /*#__PURE__*/React.createElement("span", {
        key: x.l,
        title: x.ok && typeof x.by === "string" && x.by !== "true" ? `${x.l} · ${x.by}` : x.l + (x.ok ? " 완료" : " 아직"),
        style: {
          padding: "6px 11px",
          borderRadius: 7,
          fontSize: 13,
          fontWeight: 700,
          whiteSpace: "nowrap",
          border: `1px solid ${x.ok ? x.c + "70" : C.border}`,
          background: x.ok ? x.c + "14" : C.surfaceL,
          color: x.ok ? x.c : C.t4
        }
      }, x.ok ? "✓ " : "○ ", x.l, x.n !== undefined ? /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          opacity: .75,
          marginLeft: 4
        }
      }, x.n, "/", bs.length) : null));
    })(), !isUrgent && done && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.t4
      }
    }, "← 눌러서 해제하면 다시 진행 중으로")), /*#__PURE__*/React.createElement(LastEdit, {
      s: s,
      size: 9
    }));
  }

function ReportsPage({
  db,
  setDb,
  isMobile
}) {
  const [mode, setMode] = useState("urgent"); // 긴급 / 완료를 한 화면에서 전환
  const isUrgent = mode === "urgent";
  const [hideLH, setHideLH] = useState(true); // LH는 완수일이 '도래시기'라 기본으로 접어둠
  const buckets = useMemo(() => {
    const out = [];
    Object.keys(db || {}).forEach(y => Object.keys(db[y] || {}).forEach(h => {
      if ((db[y][h] || []).length) out.push({
        y,
        h
      });
    }));
    const rank = b => isLH(b.y) ? -1 : (parseInt(b.y, 10) || 0) * 2 + (b.h === "하반기" ? 1 : 0);
    return out.sort((a, b) => rank(b) - rank(a));
  }, [db]);

  /* 기본은 지금 시기(연도+반기). 옛날 반기는 탭을 눌러야 보인다. */
  const nowBucket = useMemo(() => {
    const d = new Date();
    const y = String(d.getFullYear());
    const h = d.getMonth() + 1 <= 6 ? "상반기" : "하반기";
    return buckets.find(b => b.y === y && b.h === h) || buckets[0] || null;
  }, [buckets]);
  const [tab, setTab] = useState(null);
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || !buckets.length) return;
    didInit.current = true;
    setTab(nowBucket);
  }, [buckets, nowBucket]);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);
  const pool = useMemo(() => {
    const out = [];
    Object.entries(db || {}).forEach(([y, hs]) => Object.entries(hs || {}).forEach(([h, arr]) => {
      if (tab && (tab.y !== y || tab.h !== h)) return;
      if (hideLH && isLH(y) && !tab) return; // 전체 볼 때 LH는 빼고 (도래시기가 지난 게 많아 화면을 덮음)
      (arr || []).forEach(s => {
        if (!s.deleted) out.push({
          ...s,
          _year: y,
          _half: h
        });
      });
    }));
    const q = search.trim();
    return q ? out.filter(s => (s.school || "").includes(q) || (s.region || "").includes(q)) : out;
  }, [db, tab, search, hideLH]);

  /* 보고서·FMS·납품을 그 현장 전체 동에 한 번에 적용 */
  const setAllB = (s, field) => {
    const label = field === "rep" ? "보고서" : field === "fmsD" ? "FMS" : "납품";
    const bs = s.buildings || [];
    const allOn = bs.length > 0 && bs.every(b => field === "delivery" ? !!b.delivery : !!b[field]);
    setDb(prev => {
      const next = {
        ...prev
      };
      next[s._year] = {
        ...(prev[s._year] || {})
      };
      next[s._year][s._half] = (prev[s._year][s._half] || []).map(x => x.id !== s.id ? x : stampEdit({
        ...x,
        buildings: (x.buildings || []).map(b => field === "delivery" ? {
          ...b,
          delivery: allOn ? null : b.delivery || "직납"
        } : {
          ...b,
          [field]: !allOn
        })
      }, `${label} ${allOn ? "해제" : "완료"}`));
      return next;
    });
    logAction("수정", `${s.school} · ${label} 일괄`, allOn ? "완료" : "미완", allOn ? "미완" : "완료");
    setToast(`${s.school} · ${label} ${allOn ? "해제했어요" : "완료 처리했어요"}`);
    setTimeout(() => setToast(null), 1800);
  };

  /* 긴급: 완료 안 된 것 중 기한 기준으로 묶음 / 완료: 반기별 또는 완수일 순 */
  const groups = useMemo(() => {
    if (isUrgent) {
      const live = pool.filter(s => !siteDone(s));
      const withD = live.map(s => ({
        s,
        d: calcDday(s.end)
      })).filter(x => x.d !== null);
      const pick = (lo, hi) => withD.filter(x => x.d >= lo && x.d <= hi).sort((a, b) => a.d - b.d).map(x => x.s);
      const g = [{
        key: "over",
        label: "기한 초과",
        desc: "완수일이 지났어요",
        color: C.red,
        items: withD.filter(x => x.d < 0).sort((a, b) => a.d - b.d).map(x => x.s)
      }, {
        key: "d7",
        label: "D-7 이내",
        desc: "이번 주 안에 끝내야 해요",
        color: C.orange,
        items: pick(0, 7)
      }, {
        key: "d30",
        label: "D-30 이내",
        desc: "한 달 안",
        color: C.yellow,
        items: pick(8, 30)
      }];
      const rest = live.filter(s => {
        const d = calcDday(s.end);
        return d === null || d > 30;
      });
      if (rest.length) g.push({
        key: "rest",
        label: "그 외 진행 중",
        desc: "완수일 여유 있음 · 미정 포함",
        color: C.t3,
        items: rest
      });
      return g.filter(x => x.items.length);
    }
    const done = pool.filter(siteDone);
    if (tab) {
      return done.length ? [{
        key: "all",
        label: `${isLH(tab.y) ? "LH 정밀" : `${tab.y}년 ${tab.h}`} 완료`,
        desc: "",
        color: C.green,
        items: done.sort((a, b) => String(doneAt(b)).localeCompare(String(doneAt(a))))
      }] : [];
    }
    const byBucket = new Map();
    done.forEach(s => {
      const k = `${s._year}|${s._half}`;
      if (!byBucket.has(k)) byBucket.set(k, []);
      byBucket.get(k).push(s);
    });
    return buckets.map(b => {
      const items = byBucket.get(`${b.y}|${b.h}`) || [];
      return {
        key: `${b.y}-${b.h}`,
        label: isLH(b.y) ? "LH 정밀" : `${b.y}년 ${b.h}`,
        desc: "",
        color: C.green,
        items: items.sort((a, b2) => String(doneAt(b2)).localeCompare(String(doneAt(a))))
      };
    }).filter(g => g.items.length);
  }, [pool, isUrgent, tab, buckets]);
  const totalShown = groups.reduce((a, g) => a + g.items.length, 0);
  const editing = editId ? pool.find(s => s.id === editId) : null;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "0 0 10px",
      fontSize: isMobile ? 18 : 22,
      fontWeight: 800,
      color: C.t1
    }
  }, "보고서 현황"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 10
    }
  }, [{
    k: "urgent",
    l: "🚨 긴급",
    c: C.red
  }, {
    k: "done",
    l: "✅ 완료",
    c: C.green
  }].map(x => {
    const on = mode === x.k;
    return /*#__PURE__*/React.createElement("button", {
      key: x.k,
      onClick: () => {
        setMode(x.k);
        setEditId(null);
      },
      style: {
        flex: 1,
        padding: "11px 0",
        borderRadius: 9,
        fontSize: 16,
        fontWeight: 800,
        cursor: "pointer",
        border: `1px solid ${on ? x.c : C.border}`,
        background: on ? x.c + "12" : C.surface,
        color: on ? x.c : C.t3
      }
    }, x.l, on && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 6,
        fontSize: 14
      }
    }, totalShown));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      marginBottom: 10
    }
  }, isUrgent ? "완수일이 임박했거나 지난 현장이에요. 아래 버튼을 눌러 바로 처리할 수 있어요." : "보고서·FMS·납품이 모두 끝난 현장이에요. 다시 손봐야 하면 버튼을 눌러 해제하세요."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center",
      marginBottom: 9,
      overflowX: "auto",
      paddingBottom: 2,
      WebkitOverflowScrolling: "touch"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setTab(null),
    style: {
      padding: "7px 13px",
      borderRadius: 20,
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap",
      flexShrink: 0,
      border: `1px solid ${!tab ? C.blue : C.border}`,
      background: !tab ? C.blueL : C.surface,
      color: !tab ? C.blue : C.t3
    }
  }, "전체"), !tab && buckets.some(b => isLH(b.y)) && /*#__PURE__*/React.createElement("button", {
    onClick: () => setHideLH(v => !v),
    style: {
      padding: "7px 12px",
      borderRadius: 20,
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap",
      flexShrink: 0,
      border: `1px solid ${hideLH ? C.border : C.purple}`,
      background: hideLH ? C.surface : C.purpleL,
      color: hideLH ? C.t4 : C.purple
    }
  }, "🏢 LH ", hideLH ? "제외" : "포함"), buckets.map(b => {
    const on = tab && tab.y === b.y && tab.h === b.h;
    return /*#__PURE__*/React.createElement("button", {
      key: `${b.y}-${b.h}`,
      onClick: () => setTab(b),
      style: {
        padding: "7px 12px",
        borderRadius: 20,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
        border: `1px solid ${on ? C.blue : C.border}`,
        background: on ? C.blueL : C.surface,
        color: on ? C.blue : C.t3
      }
    }, isLH(b.y) ? "🏢 LH" : `${String(b.y).slice(2)}년 ${b.h === "상반기" ? "상" : "하"}`);
  })), /*#__PURE__*/React.createElement("input", {
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "학교명·지역 검색",
    style: {
      width: "100%",
      boxSizing: "border-box",
      padding: "10px 13px",
      background: C.surface,
      border: `1px solid ${search ? C.blue : C.border}`,
      borderRadius: 9,
      color: C.t1,
      fontSize: 16,
      outline: "none",
      marginBottom: 12
    }
  }), groups.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "44px 20px",
      color: C.t4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 26,
      marginBottom: 8
    }
  }, isUrgent ? "👍" : "—"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15
    }
  }, isUrgent ? "급한 현장이 없습니다." : "이 기간에 완료된 현장이 없습니다.")), groups.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.key,
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 8,
      background: g.color + "12",
      border: `1px solid ${g.color}25`,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: g.color
    }
  }, g.label), g.desc && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.t3
    }
  }, g.desc), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      fontSize: 14,
      fontWeight: 800,
      color: g.color
    }
  }, g.items.length)), g.items.map(s => /*#__PURE__*/React.createElement(ReportCard, {
    key: `${s._year}-${s._half}-${s.id}`,
    s: s,
    accent: g.color,
    isUrgent: isUrgent,
    isMobile: isMobile,
    setAllB: setAllB,
    setEditId: setEditId
  })))), editing && /*#__PURE__*/React.createElement(EditPanel, {
    sc: editing,
    yr: editing._year,
    half: editing._half,
    setDb: setDb,
    onClose: () => setEditId(null),
    isMobile: isMobile
  }), toast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: isMobile ? `calc(${TAB_H + 16}px + env(safe-area-inset-bottom))` : 24,
      left: "50%",
      transform: "translateX(-50%)",
      background: C.t1,
      color: "#fff",
      padding: "11px 18px",
      borderRadius: 22,
      fontSize: 15,
      fontWeight: 600,
      zIndex: 320,
      boxShadow: "0 8px 24px rgba(0,0,0,.25)"
    }
  }, toast));
}
