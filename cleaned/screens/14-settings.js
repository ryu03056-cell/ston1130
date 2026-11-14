/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 14/18 — 설정·안전장치  (screens/14-settings.js)
   │ 백업/복원·휴지통·되돌리기 화면, 인원·계정·권한, 시트 연결 관리
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
/* 원격(Firebase) db를 로컬에 병합 — 로컬 학교를 절대 삭제하지 않고, 같은 ID는 원격으로 갱신,
   원격에만 있는 학교는 추가. → 어떤 echo가 와도 화면에서 학교가 사라지지 않음. */
/* ══════════════════════════════════════════════════════════════
   설정 / 관리자 모드 (팀·인원 관리 + 수정 로그)
══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   안전장치 화면 — 백업/복원 · 휴지통 · 최근 변경 되돌리기 · 파일 보관
   ══════════════════════════════════════════════════════════════ */
function SafetyPanel({
  db,
  setDb,
  saveNow,
  isMobile
}) {
  const [tab, setTab] = useState("backup");
  const [list, setList] = useState(null); // 백업 목록
  const [undo, setUndo] = useState([]); // 되돌리기 기록
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(null);
  const fileRef = useRef();
  const say = (t, ms = 2600) => {
    setMsg(t);
    setTimeout(() => setMsg(null), ms);
  };
  useEffect(() => {
    try {
      const r = firebase.database().ref(FB_BK_IDX);
      const cb = r.on("value", sn => {
        const v = sn.val() || {};
        setList(Object.entries(v).map(([id, m]) => ({
          id,
          ...m
        })).sort((a, b) => Number(b.id) - Number(a.id)));
      });
      const r2 = firebase.database().ref(FB_UNDO);
      const cb2 = r2.on("value", sn => {
        const v = sn.val() || {};
        setUndo(Object.entries(v).map(([k, e]) => ({
          key: k,
          ...e
        })).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 50));
      });
      return () => {
        try {
          r.off("value", cb);
          r2.off("value", cb2);
        } catch {}
      };
    } catch {
      return undefined;
    }
  }, []);

  /* 휴지통 */
  const trash = useMemo(() => {
    const out = [];
    Object.entries(db || {}).forEach(([y, hs]) => Object.entries(hs || {}).forEach(([h, arr]) => (arr || []).forEach(s => {
      if (s.deleted) out.push({
        ...s,
        _year: y,
        _half: h
      });
    })));
    return out.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  }, [db]);
  const restoreSite = s => {
    setDb(prev => {
      const next = {
        ...prev
      };
      next[s._year] = {
        ...(prev[s._year] || {})
      };
      next[s._year][s._half] = (prev[s._year][s._half] || []).map(x => x.id !== s.id ? x : {
        ...x,
        deleted: false,
        deletedAt: null,
        deletedBy: null
      });
      return next;
    });
    logAction("수정", `현장 복원 · ${s.school}`, "휴지통", "복원");
    say(`${s.school} 되살렸어요.`);
  };
  /* 오래된 휴지통 정리 — 지운 현장은 계속 서버에 남아 용량에 더해지므로 한 번에 비운다.
     자동으로 지우지는 않는다. 사람이 확인하고 누를 때만. */
  const TRASH_KEEP_DAYS = 30;
  const oldTrash = trash.filter(s => s.deletedAt && s.deletedAt < Date.now() - TRASH_KEEP_DAYS * 86400000);
  const purgeOld = () => {
    if (!oldTrash.length) {
      say(`${TRASH_KEEP_DAYS}일이 지난 항목이 없어요.`);
      return;
    }
    if (!window.confirm(`지운 지 ${TRASH_KEEP_DAYS}일이 넘은 현장 ${oldTrash.length}개를 완전히 삭제합니다.\n되살릴 수 없어요. 계속할까요?`)) return;
    setDb(prev => {
      const next = {
        ...prev
      };
      oldTrash.forEach(s => {
        const cur = next[s._year] && next[s._year][s._half] || prev[s._year] && prev[s._year][s._half] || [];
        next[s._year] = {
          ...(next[s._year] || prev[s._year] || {})
        };
        next[s._year][s._half] = cur.filter(x => x.id !== s.id);
      });
      return next;
    });
    logAction("삭제", "휴지통 비우기", `${oldTrash.length}개`, null);
    say(`${oldTrash.length}개를 완전히 지웠어요.`);
  };
  const purgeSite = s => {
    if (!window.confirm(`'${s.school}'을(를) 완전히 지웁니다.\n이건 되살릴 수 없어요. 계속할까요?`)) return;
    setDb(prev => {
      const next = {
        ...prev
      };
      next[s._year] = {
        ...(prev[s._year] || {})
      };
      next[s._year][s._half] = (prev[s._year][s._half] || []).filter(x => x.id !== s.id);
      return next;
    });
    logAction("삭제", `완전 삭제 · ${s.school}`, s.school, null);
    say(`${s.school} 완전히 삭제했어요.`);
  };

  /* 백업 만들기 */
  const doBackup = async () => {
    setBusy("backup");
    try {
      const r = await makeSnapshot(db, "수동 백업");
      say(`백업 완료 — ${r.cnt}개 현장`);
    } catch (e) {
      say("백업 실패: " + (e && e.message || e), 5000);
    }
    setBusy("");
  };

  /* 복원 — 미리보기 후 확인 */
  const openRestore = async m => {
    setBusy("load-" + m.id);
    try {
      const sn = await firebase.database().ref(`${FB_BK_DAT}/${m.id}`).once("value");
      const data = fbToDb(sn.val());
      if (!data || !countSchools(data)) {
        say("이 백업에 데이터가 없어요.", 4000);
        setBusy("");
        return;
      }
      setConfirmRestore({
        meta: m,
        data
      });
    } catch (e) {
      say("백업을 읽지 못했어요: " + (e && e.message || e), 5000);
    }
    setBusy("");
  };
  const doRestore = async () => {
    const {
      meta,
      data
    } = confirmRestore;
    setBusy("restore");
    try {
      await makeSnapshot(db, "복원 직전"); // 복원 자체도 되돌릴 수 있게
      await firebase.database().ref(FB_DATA).set(stripUndefined(dbToFb(data)));
      setDb(data);
      logAction("수정", "전체 복원", `${countSchools(db)}개`, `${countSchools(data)}개`);
      say(`복원 완료 — ${countSchools(data)}개 현장`);
      setConfirmRestore(null);
    } catch (e) {
      say("복원 실패: " + (e && e.message || e), 6000);
    }
    setBusy("");
  };

  /* 되돌리기 — 그 현장만 이전 상태로 */
  const undoOne = async e => {
    if (!e.path) return;
    const [y, h, id] = String(e.path).split("/");
    setDb(prev => {
      const next = {
        ...prev
      };
      next[y] = {
        ...(prev[y] || {})
      };
      const arr = prev[y] && prev[y][h] || [];
      if (e.before) {
        next[y][h] = arr.some(x => String(x.id) === id) ? arr.map(x => String(x.id) === id ? e.before : x) : [...arr, e.before];
      } else {
        next[y][h] = arr.filter(x => String(x.id) !== id);
      }
      return next;
    });
    logAction("수정", `되돌리기 · ${e.label || ""}`, "변경 후", "변경 전");
    say("되돌렸어요.");
  };

  /* 파일로 보관 / 파일에서 복원 */
  const downloadJson = () => {
    try {
      const blob = new Blob([JSON.stringify({
        savedAt: new Date().toISOString(),
        cnt: countSchools(db),
        data: db
      }, null, 1)], {
        type: "application/json"
      });
      const a = document.createElement("a");
      const t = new Date();
      a.href = URL.createObjectURL(blob);
      a.download = `STON_백업_${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, "0")}${String(t.getDate()).padStart(2, "0")}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      say("백업 파일을 내려받았어요. 회사 드라이브에 보관해 주세요.");
    } catch (e) {
      say("내려받기 실패: " + (e && e.message || e), 5000);
    }
  };
  const uploadJson = file => {
    if (!file) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        const parsed = JSON.parse(r.result);
        const data = parsed && parsed.data ? parsed.data : parsed;
        const n = countSchools(data);
        if (!n) {
          say("이 파일에는 현장 데이터가 없어요.", 4000);
          return;
        }
        if (!window.confirm(`파일에 있는 ${n}개 현장으로 전체를 되돌립니다.\n지금 데이터는 자동 백업된 뒤 교체됩니다. 계속할까요?`)) return;
        await makeSnapshot(db, "파일 복원 직전");
        await firebase.database().ref(FB_DATA).set(stripUndefined(dbToFb(data)));
        setDb(data);
        say(`파일에서 복원 완료 — ${n}개 현장`);
      } catch (e) {
        say("파일을 읽지 못했어요: " + (e && e.message || e), 5000);
      }
    };
    r.readAsText(file);
  };
  const TabBtn = ({
    id,
    label,
    n
  }) => /*#__PURE__*/React.createElement("button", {
    onClick: () => setTab(id),
    style: {
      flex: 1,
      padding: "9px 6px",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      border: `1px solid ${tab === id ? C.blue : C.border}`,
      background: tab === id ? C.blueL : "transparent",
      color: tab === id ? C.blue : C.t3,
      whiteSpace: "nowrap"
    }
  }, label, n > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 4,
      fontSize: 12,
      color: C.t4
    }
  }, n));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: BD,
      borderRadius: 12,
      padding: "16px 18px",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: C.t1,
      marginBottom: 4
    }
  }, "🛡 안전장치 · 백업과 되돌리기"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      lineHeight: 1.7,
      marginBottom: 12
    }
  }, "엑셀 가져오기·전체 초기화 전과 ", /*#__PURE__*/React.createElement("b", null, "하루에 한 번"), " 자동으로 전체 백업이 만들어져요. 잘못돼도 여기서 되돌릴 수 있습니다."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(TabBtn, {
    id: "backup",
    label: "📦 백업",
    n: (list || []).length
  }), /*#__PURE__*/React.createElement(TabBtn, {
    id: "trash",
    label: "🗑 휴지통",
    n: trash.length
  }), /*#__PURE__*/React.createElement(TabBtn, {
    id: "undo",
    label: "↩ 최근 변경",
    n: undo.length
  }), /*#__PURE__*/React.createElement(TabBtn, {
    id: "file",
    label: "💾 파일"
  })), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.blue,
      background: C.blueL,
      border: `1px solid ${C.blue}25`,
      borderRadius: 8,
      padding: "8px 11px",
      marginBottom: 10
    }
  }, msg), tab === "backup" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    onClick: doBackup,
    disabled: busy === "backup",
    style: {
      width: "100%",
      padding: "11px 0",
      borderRadius: 9,
      border: "none",
      marginBottom: 10,
      background: busy === "backup" ? C.t4 : C.blue,
      color: "#fff",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, busy === "backup" ? "백업 중…" : "📦 지금 백업 만들기"), list === null && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.t4,
      padding: "12px 0"
    }
  }, "불러오는 중…"), list && list.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.t4,
      padding: "12px 0"
    }
  }, "아직 백업이 없어요. 위 버튼으로 하나 만들어 두세요."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      maxHeight: 320,
      overflowY: "auto"
    }
  }, (list || []).map(m => {
    const t = new Date(m.at || Number(m.id));
    return /*#__PURE__*/React.createElement("div", {
      key: m.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 11px",
        background: C.surfaceL,
        border: BD,
        borderRadius: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: C.t1
      }
    }, t.getFullYear(), ". ", t.getMonth() + 1, ". ", t.getDate(), ". ", String(t.getHours()).padStart(2, "0"), ":", String(t.getMinutes()).padStart(2, "0"), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 6,
        fontSize: 12,
        color: C.t3,
        fontWeight: 500
      }
    }, m.reason)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: C.t4,
        marginTop: 2
      }
    }, m.cnt, "개 현장 · ", m.by)), /*#__PURE__*/React.createElement("button", {
      onClick: () => openRestore(m),
      disabled: busy.startsWith("load"),
      style: {
        padding: "7px 12px",
        borderRadius: 7,
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        flexShrink: 0,
        border: `1px solid ${C.blue}40`,
        background: C.blueL,
        color: C.blue
      }
    }, busy === "load-" + m.id ? "여는 중…" : "복원"));
  }))), tab === "trash" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      marginBottom: 8
    }
  }, "삭제한 현장은 여기 남아 있어요. 되살리거나 완전히 지울 수 있습니다. 지운 현장도 서버 용량을 차지하니 가끔 비워 주세요."), oldTrash.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: purgeOld,
    style: {
      width: "100%",
      padding: "11px 0",
      borderRadius: 9,
      marginBottom: 10,
      border: `1px solid ${C.red}45`,
      background: C.redL,
      color: C.red,
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, `🧹 ${TRASH_KEEP_DAYS}일 지난 ${oldTrash.length}개 완전 삭제`), trash.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.t4,
      padding: "12px 0"
    }
  }, "휴지통이 비어 있어요."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      maxHeight: 320,
      overflowY: "auto"
    }
  }, trash.map(s => /*#__PURE__*/React.createElement("div", {
    key: `${s._year}-${s._half}-${s.id}`,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 11px",
      background: C.surfaceL,
      border: BD,
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: C.t1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, s.school), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginTop: 2
    }
  }, isLH(s._year) ? "LH" : `${s._year} ${s._half}`, " · ", (s.buildings || []).length, "동", s.deletedAt && ` · ${agoText(s.deletedAt)} ${s.deletedBy || ""}`)), /*#__PURE__*/React.createElement("button", {
    onClick: () => restoreSite(s),
    style: {
      padding: "7px 11px",
      borderRadius: 7,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      flexShrink: 0,
      border: `1px solid ${C.green}45`,
      background: C.greenL,
      color: C.green
    }
  }, "되살리기"), /*#__PURE__*/React.createElement("button", {
    onClick: () => purgeSite(s),
    style: {
      padding: "7px 10px",
      borderRadius: 7,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      flexShrink: 0,
      border: `1px solid ${C.red}35`,
      background: "transparent",
      color: C.red
    }
  }, "완전삭제"))))), tab === "undo" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      marginBottom: 8
    }
  }, "최근 변경을 하나씩 되돌립니다. 그 현장만 이전 상태로 돌아가요."), undo.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.t4,
      padding: "12px 0"
    }
  }, "기록이 아직 없어요."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      maxHeight: 320,
      overflowY: "auto"
    }
  }, undo.map(e => /*#__PURE__*/React.createElement("div", {
    key: e.key,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 11px",
      background: C.surfaceL,
      border: BD,
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: C.t1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, e.label || e.path), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginTop: 2
    }
  }, e.by, " · ", agoText(e.at))), /*#__PURE__*/React.createElement("button", {
    onClick: () => undoOne(e),
    style: {
      padding: "7px 12px",
      borderRadius: 7,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      flexShrink: 0,
      border: `1px solid ${C.orange}45`,
      background: C.orangeL,
      color: C.orange
    }
  }, "↩ 되돌리기"))))), tab === "file" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      lineHeight: 1.8,
      marginBottom: 10
    }
  }, "위 백업은 모두 ", /*#__PURE__*/React.createElement("b", null, "서버 안"), "에 있어요. 계정에 문제가 생기는 상황까지 대비하려면", /*#__PURE__*/React.createElement("b", null, " 파일로 받아 회사 드라이브에 보관"), "해 두는 게 안전합니다. ", /*#__PURE__*/React.createElement("b", null, "주 1회"), "를 권해요."), /*#__PURE__*/React.createElement("button", {
    onClick: downloadJson,
    style: {
      width: "100%",
      padding: "12px 0",
      borderRadius: 9,
      border: "none",
      marginBottom: 8,
      background: C.green,
      color: "#fff",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "💾 백업 파일 내려받기 (", countSchools(db), "개 현장)"), /*#__PURE__*/React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: "application/json,.json",
    style: {
      display: "none"
    },
    onChange: e => {
      uploadJson(e.target.files && e.target.files[0]);
      e.target.value = "";
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => fileRef.current && fileRef.current.click(),
    style: {
      width: "100%",
      padding: "12px 0",
      borderRadius: 9,
      border: `1px solid ${C.border}`,
      background: C.surface,
      color: C.t2,
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "📂 백업 파일에서 되돌리기"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginTop: 8,
      lineHeight: 1.7
    }
  }, "엑셀 관리 탭에서 받는 엑셀도 좋은 보관본이에요. 다만 파일로 되돌릴 땐 이 JSON이 더 정확합니다.")), confirmRestore && (() => {
    const cur = bucketCounts(db),
      old = bucketCounts(confirmRestore.data);
    const keys = [...new Set([...Object.keys(cur), ...Object.keys(old)])].sort().reverse();
    const t = new Date(confirmRestore.meta.at);
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      onClick: () => setConfirmRestore(null),
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
        width: 400,
        maxWidth: "92vw",
        maxHeight: "84vh",
        overflowY: "auto",
        background: C.surface,
        borderRadius: 16,
        padding: "20px 20px 18px",
        boxShadow: "0 20px 60px rgba(20,30,50,.35)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 17,
        fontWeight: 800,
        color: C.t1,
        marginBottom: 4
      }
    }, "이 백업으로 되돌릴까요?"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.t3,
        marginBottom: 12
      }
    }, t.getFullYear(), ". ", t.getMonth() + 1, ". ", t.getDate(), ". ", String(t.getHours()).padStart(2, "0"), ":", String(t.getMinutes()).padStart(2, "0"), " · ", confirmRestore.meta.reason), /*#__PURE__*/React.createElement("div", {
      style: {
        border: BD,
        borderRadius: 9,
        overflow: "hidden",
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 70px 70px",
        background: C.surfaceL,
        padding: "7px 11px",
        fontSize: 12,
        fontWeight: 700,
        color: C.t3
      }
    }, /*#__PURE__*/React.createElement("span", null, "구분"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right"
      }
    }, "지금"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right"
      }
    }, "복원 후")), keys.map(k => {
      const a = cur[k] || 0,
        b = old[k] || 0;
      return /*#__PURE__*/React.createElement("div", {
        key: k,
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 70px 70px",
          padding: "7px 11px",
          fontSize: 14,
          borderTop: `1px solid ${C.surfaceD}`
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          color: C.t2
        }
      }, k), /*#__PURE__*/React.createElement("span", {
        style: {
          textAlign: "right",
          color: C.t3
        }
      }, a), /*#__PURE__*/React.createElement("span", {
        style: {
          textAlign: "right",
          fontWeight: 800,
          color: b === a ? C.t3 : b < a ? C.red : C.green
        }
      }, b));
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 70px 70px",
        padding: "8px 11px",
        fontSize: 14,
        fontWeight: 800,
        borderTop: `1px solid ${C.borderD}`,
        background: C.surfaceL
      }
    }, /*#__PURE__*/React.createElement("span", null, "합계"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right",
        color: C.t2
      }
    }, countSchools(db)), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right",
        color: C.blue
      }
    }, countSchools(confirmRestore.data)))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.t3,
        lineHeight: 1.7,
        marginBottom: 14
      }
    }, "지금 데이터는 ", /*#__PURE__*/React.createElement("b", null, "복원 직전"), "이라는 이름으로 자동 백업된 뒤 교체됩니다. 되돌리기가 잘못돼도 다시 돌아올 수 있어요."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setConfirmRestore(null),
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
      onClick: doRestore,
      disabled: busy === "restore",
      style: {
        flex: 1,
        padding: "13px 0",
        borderRadius: 10,
        border: "none",
        background: busy === "restore" ? C.t4 : C.blue,
        color: "#fff",
        fontSize: 16,
        fontWeight: 800,
        cursor: "pointer"
      }
    }, busy === "restore" ? "복원 중…" : "네, 복원합니다"))));
  })());
}
function SettingsPage({
  sheetMatch,
  sheetErr,
  sheetBusy,
  sheetAt,
  onSheetReload,
  onSheetPick,
  cfgVer,
  logs,
  editor,
  authUser,
  onLogout,
  onResetAll,
  db,
  setDb,
  saveNow,
  kakaoKey,
  isMobile,
  online,
  fbStatus,
  lastSync,
  meta,
  users,
  isAdmin,
  adminCount,
  accounts
}) {
  const [mapKey, setMapKey] = useState(""); // 지도 키 입력값
  const kkSeen = useRef(false);
  useEffect(() => {
    if (!kkSeen.current && kakaoKey) {
      kkSeen.current = true;
      setMapKey(kakaoKey);
    }
  }, [kakaoKey]);
  const [diag, setDiag] = useState(null); // Firebase 직접 확인 결과
  const [diagBusy, setDiagBusy] = useState(false);
  /* 관리자 지정·해제 — ston/admins/<uid> */
  const setAdminFlag = (a, on) => {
    if (isOwnerEmail(a.email)) {
      window.alert("총관리자 계정입니다.\n권한을 바꿀 수 없습니다.");
      return;
    }
    /* 마지막 관리자를 해제하면 아무도 설정에 못 들어간다 → 막는다 */
    if (!on && (adminCount || 0) <= 1) {
      window.alert("마지막 관리자는 해제할 수 없습니다.\n다른 계정을 먼저 관리자로 지정하세요.");
      return;
    }
    if (on && !window.confirm(`${a.name || a.email} 님을 관리자로 지정할까요?\n설정·엑셀 관리·백업을 쓸 수 있게 됩니다.`)) return;
    if (!on && !window.confirm(`${a.name || a.email} 님의 관리자 권한을 해제할까요?`)) return;
    try {
      const ref = firebase.database().ref(`${FB_ADMINS}/${a.k}`);
      (on ? ref.set(true) : ref.remove()).catch(e => window.alert("변경 실패: " + (e && e.message || e)));
      logAction(on ? "추가" : "삭제", "관리자 권한", null, `${a.email} ${on ? "→ 관리자" : "→ 일반"}`);
    } catch (e) {
      window.alert("변경 실패: " + (e && e.message || e));
    }
  };
  /* ── 계정 ↔ 실명 연결 ──
     Firebase 콘솔에서 만든 로그인 계정(이메일)에 실명을 붙여둔다.
     연결해두면 그 사람이 로그인할 때 이름이 자동으로 채워지고,
     수정 기록·게시판에 실명이 남는다. 화면에는 이름만 보인다. */
  const [accEmail, setAccEmail] = useState("");
  const [accName, setAccName] = useState("");
  const [accRank, setAccRank] = useState("");
  /* 전역 ACCOUNTS 대신 상태를 쓴다 — 값이 바뀌면 화면이 바로 다시 그려진다 */
  const accList = Object.entries(accounts || {}).map(([k, v]) => ({
    k,
    email: v && v.email || k,
    name: v && v.name || "",
    rank: v && v.rank || "",
    admin: ADMINS[k] === true
  })).sort((a, b) => byRank(a.name, b.name));
  const writeAccounts = next => {
    try {
      firebase.database().ref(FB_CONFIG).update({
        accounts: next
      }).catch(e => window.alert("저장 실패: " + (e && e.message || e)));
    } catch (e) {
      window.alert("저장 실패: " + (e && e.message || e));
    }
  };
  const addAccount = () => {
    const em = (accEmail || "").trim().toLowerCase();
    const nm = (accName || "").trim();
    if (!nm) {
      window.alert("이름을 입력하세요.");
      return;
    }
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      window.alert("이메일 형식이 올바르지 않습니다.\n로그인하지 않는 인원이면 이메일은 비워 두세요.");
      return;
    }
    if (accList.some(a => a.name === nm)) {
      window.alert(`'${nm}' 은(는) 이미 등록돼 있습니다.`);
      return;
    }
    writeAccounts({
      ...(accounts || {}),
      [entryKey(em, nm)]: {
        email: em,
        name: nm,
        rank: accRank || ""
      }
    });
    logAction("추가", "인원 등록", null, `${accRank ? `${accRank} ` : ""}${nm}${em ? ` (${em})` : " (로그인 없음)"}`);
    setAccEmail("");
    setAccName("");
    setAccRank("");
  };
  /* 등록된 사람의 직급 변경 */
  const setRank = (a, rank) => {
    writeAccounts({
      ...(accounts || {}),
      [a.k]: {
        email: a.email,
        name: a.name,
        rank: rank || ""
      }
    });
    logAction("수정", `직급 · ${a.name}`, a.rank || "미지정", rank || "미지정");
  };
  /* 예전 인원 명단 중 아직 등록되지 않은 사람 — 한 번에 옮길 수 있게 */
  const notRegistered = MEMBERS.filter(n => !accList.some(a => a.name === n));
  const importMembers = () => {
    if (!notRegistered.length) return;
    if (!window.confirm(`아직 등록되지 않은 ${notRegistered.length}명을 명단에 추가할까요?\n(${notRegistered.join(", ")})\n\n이메일 없이 추가되며, 나중에 이메일을 넣으면 로그인할 수 있습니다.`)) return;
    const next = {
      ...(accounts || {})
    };
    notRegistered.forEach(n => {
      next[entryKey("", n)] = {
        email: "",
        name: n
      };
    });
    writeAccounts(next);
    logAction("추가", "인원 등록", null, `기존 명단 ${notRegistered.length}명 가져오기`);
  };
  const delAccount = a => {
    if (isOwnerEmail(a.email)) {
      window.alert("총관리자 계정입니다.\n명단에서 지울 수 없습니다.");
      return;
    }
    if (a.admin) {
      window.alert("관리자로 지정된 계정입니다.\n먼저 '일반'으로 바꾼 뒤 삭제하세요.");
      return;
    }
    if (!window.confirm(`'${a.name}' 을(를) 명단에서 지울까요?\n담당자 목록에서 사라집니다. 이미 배정된 일정은 그대로 남습니다.`)) return;
    const next = {
      ...(accounts || {})
    };
    delete next[a.k];
    writeAccounts(next);
    logAction("삭제", "계정 연결", `${a.email} → ${a.name}`, null);
  };
  const fmtTs = ts => {
    if (!ts) return "";
    const d = new Date(ts);
    const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const actColor = a => a === "추가" ? C.green : a === "삭제" ? C.red : C.blue;

  /* 동기화 진단: 서버에 실제 뭐가 저장돼 있는지 직접 읽고, 쓰기 권한을 테스트 */
  const fmtT = ts => {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  const localBuckets = Object.entries(db || {}).flatMap(([yr, hs]) => Object.entries(hs || {}).map(([h, a]) => `${String(yr).slice(2)}${h === "상반기" ? "상" : "하"} ${(a || []).length}`)).join(" · ") || "없음";
  const checkFirebase = () => {
    setDiagBusy(true);
    setDiag(null);
    try {
      firebase.database().ref(FB_DATA).once("value").then(snap => {
        const raw = snap.val() || {};
        const lines = [];
        let total = 0;
        Object.entries(raw).forEach(([yr, hs]) => Object.entries(hs || {}).forEach(([half, obj]) => {
          const n = obj ? Object.keys(obj).length : 0;
          total += n;
          lines.push(`  ${yr} ${half}: ${n}개`);
        }));
        const loc = countSchools(db);
        setDiag({
          text: `📡 서버에 실제 저장된 데이터:\n${lines.join("\n") || "  (비어 있음)"}\n\n서버 합계 ${total}개 · 화면 ${loc}개\n${total === loc ? "→ 일치 ✓ 저장 정상" : "→ 불일치 ✗ 화면 데이터가 서버에 저장 안 됨"}`
        });
        setDiagBusy(false);
      }).catch(e => {
        setDiag({
          err: true,
          text: `❌ 서버 읽기 실패: ${e.message}\n→ 인증 또는 보안 규칙 문제`
        });
        setDiagBusy(false);
      });
    } catch (e) {
      setDiag({
        err: true,
        text: "Firebase 연결 안됨: " + e.message
      });
      setDiagBusy(false);
    }
  };
  const testWrite = () => {
    setDiagBusy(true);
    setDiag(null);
    try {
      const tRef = firebase.database().ref("ston/_writetest");
      tRef.set({
        at: Date.now(),
        by: editor || "test"
      }).then(() => {
        setDiag({
          text: "✅ 쓰기 성공! 서버에 저장할 권한이 있습니다.\n→ 저장 기능은 정상이에요."
        });
        tRef.remove().catch(() => {});
        setDiagBusy(false);
      }).catch(e => {
        setDiag({
          err: true,
          text: `❌ 쓰기 실패: ${e.message}\n\n이게 데이터가 사라지는 원인일 수 있어요!\nFirebase 콘솔에서 확인하세요:\n1) Authentication → 로그인 방법 → 익명 사용 설정\n2) Realtime Database → 규칙 → ".write": "auth != null"`
        });
        setDiagBusy(false);
      });
    } catch (e) {
      setDiag({
        err: true,
        text: "Firebase 연결 안됨: " + e.message
      });
      setDiagBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      letterSpacing: 2,
      fontWeight: 600,
      marginBottom: 3
    }
  }, "SETTINGS"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 22,
      fontWeight: 800,
      color: C.t1
    }
  }, "설정")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: `1px solid ${lastSync && !lastSync.ok ? C.red + "60" : C.border}`,
      borderRadius: 12,
      padding: "16px 18px",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: C.t1,
      marginBottom: 10
    }
  }, "🩺 동기화 진단"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "auto 1fr",
      gap: "7px 12px",
      fontSize: 14,
      marginBottom: 12,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t3
    }
  }, "인증"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: authUser ? C.green : C.red
    }
  }, authUser ? `이메일 로그인 (${authUser.email})` : "❌ 인증 안 됨 — 저장 불가!"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t3
    }
  }, "실시간 연결"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: online ? C.green : C.orange
    }
  }, online ? "연결됨 ✓" : fbStatus || "끊김"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t3
    }
  }, "화면 데이터"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: C.t1
    }
  }, countSchools(db), "개 학교 (", localBuckets, ")"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t3
    }
  }, "마지막 저장"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: lastSync ? lastSync.ok === null ? C.blue : lastSync.ok ? C.green : C.red : C.t4
    }
  }, lastSync ? lastSync.ok === null ? `저장 중… (${lastSync.n}건)` : lastSync.ok ? `성공 ✓ (${lastSync.n}건, ${fmtT(lastSync.at)})` : `실패 ✗ ${lastSync.err}` : "아직 변경/저장 없음")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: checkFirebase,
    disabled: diagBusy,
    style: {
      padding: "10px 15px",
      borderRadius: 9,
      border: `1px solid ${C.blue}50`,
      background: C.blueL,
      color: C.blue,
      fontSize: 14,
      fontWeight: 700,
      cursor: diagBusy ? "default" : "pointer",
      opacity: diagBusy ? .6 : 1
    }
  }, "🔍 서버에 저장된 것 확인"), /*#__PURE__*/React.createElement("button", {
    onClick: testWrite,
    disabled: diagBusy,
    style: {
      padding: "10px 15px",
      borderRadius: 9,
      border: `1px solid ${C.purple}50`,
      background: C.purpleL,
      color: C.purple,
      fontSize: 14,
      fontWeight: 700,
      cursor: diagBusy ? "default" : "pointer",
      opacity: diagBusy ? .6 : 1
    }
  }, "🧪 쓰기 권한 테스트")), diag && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 11,
      padding: "11px 13px",
      background: diag.err ? C.redL : C.surfaceL,
      border: `1px solid ${diag.err ? C.red + "40" : C.border}`,
      borderRadius: 8,
      fontSize: 13.5,
      color: diag.err ? C.red : C.t2,
      whiteSpace: "pre-wrap",
      lineHeight: 1.6
    }
  }, diag.text)), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: BD,
      borderRadius: 12,
      padding: "16px 18px",
      marginBottom: 14,
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      background: C.blueL,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 19
    }
  }, "👤"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: C.t1
    }
  }, editor || "이름 미설정"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3
    }
  }, authUser?.email || "")), authUser?.email ? /*#__PURE__*/React.createElement("button", {
    onClick: onLogout,
    style: {
      padding: "8px 16px",
      borderRadius: 8,
      border: `1px solid ${C.red}40`,
      background: C.redL,
      color: C.red,
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "로그아웃") : null), /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: BD,
      borderRadius: 12,
      padding: "16px 18px",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: C.t1,
      marginBottom: 6
    }
  }, "🛟 데이터 관리"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      lineHeight: 1.6,
      marginBottom: 12
    }
  }, "현장관리·일정에 학교가 안 보이거나 깨졌을 때 사용하세요. ", /*#__PURE__*/React.createElement("b", null, "강제 저장"), "은 지금 화면의 데이터(", countSchools(db), "개 학교)를 서버에 그대로 덮어써서 고칩니다."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (!window.confirm(`지금 화면의 데이터(${countSchools(db)}개 학교)를 서버(Firebase)에 강제로 저장합니다.\n서버의 기존 데이터는 이 데이터로 교체됩니다. 계속할까요?`)) return;
      try {
        firebase.database().ref(FB_DATA).set(stripUndefined(dbToFb(db))).then(() => window.alert(`✅ 저장 완료! 서버에 ${countSchools(db)}개 학교 저장됨. 다른 기기에서도 동일하게 보입니다.`)).catch(e => window.alert("❌ 저장 실패: " + (e && e.message || e)));
      } catch (e) {
        window.alert("❌ 저장 실패(즉시 오류): " + (e && e.message || e) + "\n\n데이터에 Firebase 금지 문자가 있었을 수 있어요. 이번 업데이트로 자동 정리됩니다.");
      }
    },
    style: {
      padding: "11px 16px",
      borderRadius: 9,
      background: C.blue,
      border: "none",
      color: "#fff",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: `0 3px 10px ${C.blue}33`
    }
  }, "🔄 Firebase에 강제 저장"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (!window.confirm("⚠️ 서버의 모든 데이터를 삭제하고 처음부터 다시 시작합니다.\n삭제 후 엑셀을 다시 가져와야 합니다. 계속할까요?")) return;
      if (!window.confirm("정말 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;
      if (onResetAll) onResetAll();else window.alert("초기화 기능을 사용할 수 없습니다.");
    },
    style: {
      padding: "11px 16px",
      borderRadius: 9,
      background: C.surface,
      border: `1px solid ${C.red}55`,
      color: C.red,
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "🗑 전체 초기화"))), /*#__PURE__*/React.createElement(SafetyPanel, {
    db: db,
    setDb: setDb,
    saveNow: saveNow,
    isMobile: isMobile
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: BD,
      borderRadius: 12,
      padding: "16px 18px",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: C.t1
    }
  }, "🔗 구글 시트 연동"), /*#__PURE__*/React.createElement("button", {
    onClick: onSheetReload,
    disabled: sheetBusy,
    style: {
      marginLeft: "auto",
      padding: "6px 12px",
      borderRadius: 7,
      border: BD,
      background: C.surfaceL,
      color: C.t2,
      fontSize: 12,
      fontWeight: 800,
      cursor: sheetBusy ? "default" : "pointer"
    }
  }, sheetBusy ? "확인 중…" : "⟳ 새로고침")), sheetErr ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 11,
      borderRadius: 8,
      background: C.redL,
      border: `1px solid ${C.red}40`,
      color: C.red,
      fontSize: 13,
      fontWeight: 700
    }
  }, "시트를 읽지 못했습니다 — ", sheetErr) : !sheetMatch ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3
    }
  }, "시트를 불러오는 중입니다…") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 10,
      flexWrap: "wrap"
    }
  }, [[`${SHEET_YEAR}년 ${SHEET_HALF} 현장`, sheetMatch.target, C.blue], ["연동됨", sheetMatch.matched, C.green], ["확인 필요", sheetMatch.unmatched.length, sheetMatch.unmatched.length ? C.orange : C.t4]].map(([lab, n, col]) => /*#__PURE__*/React.createElement("div", {
    key: lab,
    style: {
      flex: 1,
      minWidth: 90,
      padding: "9px 11px",
      borderRadius: 8,
      background: col + "12",
      border: `1px solid ${col}35`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t3,
      fontWeight: 700
    }
  }, lab), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 800,
      color: col
    }
  }, n)))), sheetAt > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginBottom: 10
    }
  }, "마지막 확인 ", new Date(sheetAt).toLocaleTimeString("ko-KR"), " · 5분마다 자동으로 다시 봅니다", sheetMatch.skipped > 0 ? ` · 다른 반기 ${sheetMatch.skipped}건은 연동하지 않습니다 (시트가 ${SHEET_YEAR}년 ${SHEET_HALF} 것이라서)` : ""), sheetMatch.unmatched.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 11,
      borderRadius: 8,
      background: C.greenL,
      border: `1px solid ${C.green}35`,
      color: C.green,
      fontSize: 13,
      fontWeight: 700
    }
  }, "✓ 모든 현장이 시트와 짝지어졌습니다") : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: C.orange,
      marginBottom: 7
    }
  }, "⚠ 짝을 못 찾은 현장 ", sheetMatch.unmatched.length, "건"), sheetMatch.unmatched.slice(0, 30).map(u => /*#__PURE__*/React.createElement("div", {
    key: u.site.id,
    style: {
      border: BD,
      borderLeft: `3px solid ${C.orange}`,
      borderRadius: 8,
      padding: "10px 11px",
      marginBottom: 6,
      background: C.surfaceL
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 800,
      color: C.t1
    }
  }, u.site.region ? u.site.region + " " : "", u.site.school), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: C.orange,
      background: C.orangeL,
      border: `1px solid ${C.orange}40`,
      borderRadius: 4,
      padding: "2px 7px"
    }
  }, u.by)), u.cands && u.cands.length > 0 ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t3,
      marginBottom: 6
    }
  }, "시트에 같은 학교가 ", u.cands.length, "건 있습니다. 어느 것인지 골라주세요."), u.cands.map(r => /*#__PURE__*/React.createElement("button", {
    key: r.row,
    onClick: () => onSheetPick(u.site.id, String(r.row)),
    style: {
      display: "block",
      width: "100%",
      textAlign: "left",
      padding: "8px 10px",
      marginBottom: 4,
      borderRadius: 7,
      border: BD,
      background: C.surface,
      cursor: "pointer",
      fontSize: 12,
      color: C.t2
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.t1
    }
  }, "No.", r.no || "-"), " · ", r.kind || "종류 없음", " · 조사 ", r.field || "-", " · ", (r.buildings || []).length, "동"))) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t3
    }
  }, "시트에서 같은 이름을 찾지 못했습니다. 시트의 학교명과 다를 수 있습니다."), /*#__PURE__*/React.createElement("button", {
    onClick: () => onSheetPick(u.site.id, "none"),
    style: {
      marginTop: 5,
      padding: "6px 11px",
      borderRadius: 7,
      border: BD,
      background: "transparent",
      color: C.t3,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "이 현장은 앱에서만 관리")))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: BD,
      borderRadius: 12,
      padding: "16px 18px",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: C.t1
    }
  }, "🗺 지도(카카오맵) 설정"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: 10,
      background: kakaoKey ? C.greenL : C.surfaceD,
      color: kakaoKey ? C.green : C.t4
    }
  }, kakaoKey ? "연결됨" : "미설정")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      lineHeight: 1.9,
      marginBottom: 10
    }
  }, "무료입니다. 한 번만 넣으면 모든 기기에서 지도가 켜져요.", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.orange,
      fontWeight: 700
    }
  }, " (2026년 7월 21일부터 절차가 바뀌었습니다)"), /*#__PURE__*/React.createElement("br", null), "① ", /*#__PURE__*/React.createElement("b", null, "developers.kakao.com"), " 로그인 → 내 애플리케이션 → 애플리케이션 추가하기", /*#__PURE__*/React.createElement("br", null), "② 만든 앱에서 ", /*#__PURE__*/React.createElement("b", null, "[카카오맵] → [사용 설정] → 상태를 ON"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.red,
      fontWeight: 700
    }
  }, " ← 이걸 안 하면 지도가 안 나와요"), /*#__PURE__*/React.createElement("br", null), "③ ", /*#__PURE__*/React.createElement("b", null, "앱 키 → JavaScript 키 → [JavaScript SDK 도메인]"), "에 아래 주소를 등록", /*#__PURE__*/React.createElement("br", null), "\u3000 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.blue
    }
  }, typeof window !== "undefined" ? window.location.origin : "이 사이트 주소"), /*#__PURE__*/React.createElement("br", null), "④ 그 화면의 ", /*#__PURE__*/React.createElement("b", null, "JavaScript 키"), "를 복사해 아래에 붙여넣기 (REST API 키 아님)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: mapKey,
    onChange: e => setMapKey(e.target.value),
    placeholder: "JavaScript 키 붙여넣기",
    style: {
      flex: 1,
      minWidth: 180,
      padding: "9px 11px",
      background: C.surfaceL,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      color: C.t1,
      fontSize: 15,
      outline: "none"
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      const k = (mapKey || "").trim();
      try {
        firebase.database().ref(FB_CONFIG).update({
          kakaoKey: k
        }).then(() => window.alert(k ? "✅ 저장했어요. '현장 지도'에서 확인해 보세요." : "✅ 키를 지웠어요.")).catch(e => window.alert("저장 실패: " + (e && e.message || e)));
      } catch (e) {
        window.alert("저장 실패: " + (e && e.message || e));
      }
      logAction("수정", "지도 키", null, k ? "설정" : "삭제");
    },
    style: {
      padding: "9px 18px",
      borderRadius: 8,
      background: C.blue,
      border: "none",
      color: "#fff",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "저장"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: BD,
      borderRadius: 12,
      padding: "16px 18px",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: C.t1
    }
  }, "👥 인원 · 계정 관리"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 8,
      fontSize: 12,
      color: C.t4
    }
  }, accList.length, "명 · 관리자 ", adminCount == null ? "-" : adminCount, "명")), notRegistered.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: importMembers,
    style: {
      width: "100%",
      padding: "11px 0",
      borderRadius: 9,
      marginBottom: 11,
      border: `1px solid ${C.blue}45`,
      background: C.blueL,
      color: C.blue,
      fontSize: 14,
      fontWeight: 800,
      cursor: "pointer"
    }
  }, `📥 기존 명단 ${notRegistered.length}명 가져오기`), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t3,
      lineHeight: 1.7,
      marginBottom: 11
    }
  }, "여기 등록된 사람만 ", /*#__PURE__*/React.createElement("b", null, "일정의 담당자로 배정"), "할 수 있습니다.", /*#__PURE__*/React.createElement("br", null), "· 이메일을 넣으면 그 주소로 ", /*#__PURE__*/React.createElement("b", null, "로그인"), "할 수 있고, 로그인 시 이름이 자동으로 채워집니다 (계정은 Firebase 콘솔에서 먼저 생성).", /*#__PURE__*/React.createElement("br", null), "· 현장만 나가고 로그인은 안 하는 사람은 ", /*#__PURE__*/React.createElement("b", null, "이메일을 비워두고"), " 이름만 등록하세요.", /*#__PURE__*/React.createElement("br", null), "· ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.blue
    }
  }, "관리자"), "로 바꾼 계정은 엑셀 관리를 쓸 수 있습니다.", OWNER_EMAIL ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("br", null), "· ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.purple
    }
  }, "총관리자"), "만 이 설정 화면에 들어올 수 있고, 총관리자 권한은 누구도 바꿀 수 없습니다.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("br", null), "· 총관리자가 지정되지 않아 지금은 관리자면 설정도 볼 수 있습니다.")), adminCount === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: "#9A5B0A",
      background: C.orangeL,
      border: `1px solid ${C.orange}45`,
      borderRadius: 8,
      padding: "10px 12px",
      marginBottom: 11,
      lineHeight: 1.6
    }
  }, "⚠ 관리자가 아직 없습니다. 본인 계정을 등록하고 '관리자'로 바꿔 주세요."), accList.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t4,
      padding: "10px 0"
    }
  }, "연결된 계정이 없습니다."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      marginBottom: 11,
      maxHeight: 260,
      overflowY: "auto"
    }
  }, accList.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.k,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      padding: "9px 11px",
      background: C.surfaceL,
      border: BD,
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 800,
      color: C.t1,
      flexShrink: 0
    }
  }, a.name), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      fontSize: 12,
      color: C.t3,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, a.email || "로그인 없음 · 현장 인원"), /*#__PURE__*/React.createElement("select", {
    value: a.rank || "",
    onChange: e => setRank(a, e.target.value),
    title: "직급",
    style: {
      flexShrink: 0,
      minWidth: 84,
      padding: "6px 6px",
      borderRadius: 7,
      border: `1px solid ${a.rank ? C.blue + "50" : C.border}`,
      background: a.rank ? C.blueL : C.surface,
      color: a.rank ? C.blue : C.t4,
      fontSize: 12,
      fontWeight: 800,
      outline: "none",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "직급 없음"), RANKS.map(r => /*#__PURE__*/React.createElement("option", {
    key: r,
    value: r
  }, r))), a.email ? /*#__PURE__*/React.createElement("button", {
    onClick: () => setAdminFlag(a, !a.admin),
    title: "관리자로 지정하면 설정·엑셀 관리를 쓸 수 있습니다",
    style: {
      flexShrink: 0,
      padding: "7px 13px",
      borderRadius: 7,
      border: `1px solid ${isOwnerEmail(a.email) ? C.purple : a.admin ? C.blue : C.border}`,
      background: isOwnerEmail(a.email) ? C.purple : a.admin ? C.blue : C.surface,
      color: isOwnerEmail(a.email) || a.admin ? "#fff" : C.t3,
      fontSize: 12,
      fontWeight: 800,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, isOwnerEmail(a.email) ? "총관리자" : a.admin ? "관리자" : "일반") : /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      fontSize: 12,
      color: C.t4,
      padding: "7px 4px"
    }
  }, "—"), /*#__PURE__*/React.createElement("button", {
    onClick: () => delAccount(a),
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
  }, "연결 해제")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: accEmail,
    onChange: e => setAccEmail(e.target.value),
    placeholder: "이메일 (로그인 안 하면 비워 두기)",
    style: {
      flex: 2,
      minWidth: 170,
      padding: "9px 11px",
      background: C.surfaceL,
      border: `1.5px dashed ${C.border}`,
      borderRadius: 8,
      color: C.t1,
      fontSize: 14,
      outline: "none"
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: accName,
    onChange: e => setAccName(e.target.value),
    onKeyDown: e => e.key === "Enter" && addAccount(),
    placeholder: "이름 (필수)",
    style: {
      flex: 1,
      minWidth: 90,
      padding: "9px 11px",
      background: C.surfaceL,
      border: `1.5px dashed ${C.border}`,
      borderRadius: 8,
      color: C.t1,
      fontSize: 14,
      outline: "none"
    }
  }), /*#__PURE__*/React.createElement("select", {
    value: accRank,
    onChange: e => setAccRank(e.target.value),
    style: {
      flexShrink: 0,
      minWidth: 92,
      padding: "9px 8px",
      background: C.surfaceL,
      border: `1.5px dashed ${C.border}`,
      borderRadius: 8,
      color: accRank ? C.t1 : C.t4,
      fontSize: 14,
      outline: "none"
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "직급"), RANKS.map(r => /*#__PURE__*/React.createElement("option", {
    key: r,
    value: r
  }, r))), /*#__PURE__*/React.createElement("button", {
    onClick: addAccount,
    style: {
      padding: "9px 18px",
      borderRadius: 8,
      background: C.blue,
      border: "none",
      color: "#fff",
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "+ 추가"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: BD,
      borderRadius: 12,
      padding: "16px 18px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: C.t1
    }
  }, "📝 최근 수정 내역"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 8,
      fontSize: 12,
      color: C.t4
    }
  }, logs.length, "건")), logs.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.t4,
      padding: "20px 0",
      textAlign: "center"
    }
  }, "아직 기록된 수정 내역이 없습니다."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      maxHeight: 420,
      overflowY: "auto"
    }
  }, logs.map(l => /*#__PURE__*/React.createElement("div", {
    key: l.id,
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      padding: "9px 11px",
      background: C.surfaceL,
      borderRadius: 8,
      border: BD
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      padding: "2px 7px",
      borderRadius: 4,
      flexShrink: 0,
      background: actColor(l.action) + "18",
      color: actColor(l.action),
      border: `1px solid ${actColor(l.action)}30`
    }
  }, l.action), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: C.t1
    }
  }, l.target), (l.before || l.after) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t3,
      marginTop: 2,
      wordBreak: "break-all"
    }
  }, l.before && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t4
    }
  }, l.before), l.before && l.after && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t4
    }
  }, " → "), l.after && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.t2
    }
  }, l.after)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginTop: 3
    },
    title: l.email || ""
  }, l.by, " · ", fmtTs(l.ts)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginTop: 10
    }
  }, "* 로그는 표시 전용이며 일반 사용자는 수정·삭제할 수 없습니다."))));
}
