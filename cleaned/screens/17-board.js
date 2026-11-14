/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 17/18 — 게시판·팀 채팅  (screens/17-board.js)
   │ 글·첨부파일·새 글 알림
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════
   팀 채팅 (방별 · 이미지 첨부 · 새 메시지 푸시)
══════════════════════════════════════════════════════════════ */
/* 채팅 방: 전체 · 공지 + 팀별(설정의 팀 목록 자동 반영) */
function BoardPage({
  editor,
  isMobile
}) {
  const [posts, setPosts] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]); // 새 글에 붙일 파일 [{name,size,url,path}]
  const [busy, setBusy] = useState("");
  const [prog, setProg] = useState(null); // 큰 파일 올릴 때 진행률
  const [msg, setMsg] = useState(null);
  const [pin, setPin] = useState(false);
  const [q, setQ] = useState("");
  const fileRef = useRef();
  /* ── 글 수정 ── */
  const [editId, setEditId] = useState(null); // 수정 중인 글 id
  const [eTitle, setETitle] = useState("");
  const [eBody, setEBody] = useState("");
  const [eFiles, setEFiles] = useState([]); // 수정 중 첨부 목록(원본 + 새로 올린 것)
  const [ePin, setEPin] = useState(false);
  const eOrigin = useRef([]); // 수정 시작 당시 첨부 (취소 시 되돌리기 판단용)
  const eAdded = useRef([]); // 수정 중 새로 올린 것 (취소하면 저장소에서 지움)
  const eFileRef = useRef();
  const me = editor || "익명";
  const say = (t, ms = 2600) => {
    setMsg(t);
    setTimeout(() => setMsg(null), ms);
  };
  useEffect(() => {
    try {
      const r = firebase.database().ref(FB_BOARD).limitToLast(200);
      const cb = r.on("value", sn => {
        const v = sn.val() || {};
        setPosts(Object.entries(v).map(([id, p2]) => ({
          id,
          ...p2
        })).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.at || 0) - (a.at || 0)));
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
  const fmtSize = n => n >= 1048576 ? (n / 1048576).toFixed(1) + "MB" : n >= 1024 ? Math.round(n / 1024) + "KB" : n + "B";

  /* 파일 올리기 — Firebase Storage 에 저장하고 주소만 글에 붙인다 */
  const MAX_MB = 200; // 한 파일 최대 용량
  const uploadFiles = async (list, mode = "new") => {
    if (!list || !list.length) return;
    if (typeof firebase === "undefined" || !firebase.storage) {
      say("파일 저장소를 사용할 수 없어요.", 4000);
      return;
    }
    setBusy("upload");
    const added = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_MB * 1024 * 1024) {
        say(`${f.name} 은(는) ${MAX_MB}MB를 넘어 건너뛰었어요. 압축하거나 나눠서 올려주세요.`, 5000);
        continue;
      }
      try {
        const safe = String(f.name).replace(/[^\w.\-가-힣() ]/g, "_");
        const path = `board/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safe}`;
        /* 큰 파일은 시간이 걸리므로 진행률을 보여준다 */
        const task = firebase.storage().ref(path).put(f);
        await new Promise((res, rej) => {
          task.on("state_changed", sn => setProg({
            name: f.name,
            pct: sn.totalBytes ? Math.round(sn.bytesTransferred / sn.totalBytes * 100) : 0
          }), rej, res);
        });
        const url = await task.snapshot.ref.getDownloadURL();
        added.push({
          name: f.name,
          size: f.size,
          url,
          path
        });
      } catch (e) {
        say(`${f.name} 올리기 실패: ${e && e.message || e}`, 5000);
      }
    }
    setProg(null);
    if (mode === "edit") {
      eAdded.current = [...eAdded.current, ...added];
      setEFiles(p2 => [...p2, ...added]);
    } else {
      setFiles(p2 => [...p2, ...added]);
    }
    setBusy("");
    if (added.length) say(`${added.length}개 올렸어요.`);
  };

  /* ── 수정 시작 / 취소 / 저장 ──
     첨부는 '저장'을 눌러야 실제로 반영된다. 취소하면 새로 올린 파일만 저장소에서 지우고
     원래 있던 첨부는 그대로 남는다 → 잘못 눌러도 자료가 날아가지 않음. */
  const startEdit = p2 => {
    setWriting(false);
    setEditId(p2.id);
    setETitle(p2.title || "");
    setEBody(p2.body || "");
    const fs = p2.files || [];
    setEFiles(fs);
    setEPin(!!p2.pin);
    eOrigin.current = fs;
    eAdded.current = [];
  };
  const cancelEdit = () => {
    /* 수정 중 새로 올렸던 파일은 쓰이지 않으므로 저장소에서 정리 */
    try {
      eAdded.current.forEach(f => {
        if (f.path) firebase.storage().ref(f.path).delete().catch(() => {});
      });
    } catch {}
    eAdded.current = [];
    eOrigin.current = [];
    setEditId(null);
    setETitle("");
    setEBody("");
    setEFiles([]);
    setEPin(false);
  };
  const saveEdit = p2 => {
    const t = eTitle.trim();
    if (!t) {
      say("제목을 넣어주세요.");
      return;
    }
    const keptPaths = new Set(eFiles.map(f => f.path).filter(Boolean));
    try {
      firebase.database().ref(`${FB_BOARD}/${p2.id}`).update({
        title: t,
        body: eBody.trim(),
        pin: !!ePin,
        files: eFiles.length ? eFiles : null,
        editedAt: Date.now(),
        editedBy: me
      }).then(() => {
        /* 저장이 끝난 뒤에야 빠진 첨부를 저장소에서 지운다 */
        try {
          (eOrigin.current || []).forEach(f => {
            if (f.path && !keptPaths.has(f.path)) firebase.storage().ref(f.path).delete().catch(() => {});
          });
        } catch {}
        eAdded.current = [];
        eOrigin.current = [];
        say("수정했어요.");
      }).catch(e => say("수정 실패: " + (e && e.message || e), 5000));
      logAction("수정", "게시판", p2.title, t);
      setEditId(null);
    } catch (e) {
      say("수정 실패: " + (e && e.message || e), 5000);
    }
  };
  const submit = () => {
    const t = title.trim();
    if (!t) {
      say("제목을 넣어주세요.");
      return;
    }
    try {
      firebase.database().ref(FB_BOARD).push({
        title: t,
        body: body.trim(),
        by: me,
        at: Date.now(),
        pin: !!pin,
        files: files.length ? files : null
      }).catch(e => say("올리기 실패: " + (e && e.message || e), 5000));
      logAction("추가", "게시판", null, t);
      sendPush("📋 새 게시글", `${me} · ${t}`); // 등록만 해두고 실제로는 아무도 안 보내던 알림
      setTitle("");
      setBody("");
      setFiles([]);
      setPin(false);
      setWriting(false);
      say("올렸어요.");
    } catch (e) {
      say("올리기 실패: " + (e && e.message || e), 5000);
    }
  };
  const removePost = p2 => {
    if (!window.confirm(`'${p2.title}' 글을 지울까요?\n첨부한 자료도 함께 지워집니다.`)) return;
    try {
      (p2.files || []).forEach(f => {
        if (f.path) firebase.storage().ref(f.path).delete().catch(() => {});
      });
      firebase.database().ref(`${FB_BOARD}/${p2.id}`).remove().catch(() => {});
      logAction("삭제", "게시판", p2.title, null);
      setOpenId(null);
      say("지웠어요.");
    } catch {}
  };
  const togglePin = p2 => {
    try {
      firebase.database().ref(`${FB_BOARD}/${p2.id}/pin`).set(!p2.pin).catch(() => {});
    } catch {}
  };
  const shown = useMemo(() => {
    const key = q.trim();
    if (!key) return posts;
    return posts.filter(p2 => (p2.title || "").includes(key) || (p2.body || "").includes(key) || (p2.by || "").includes(key));
  }, [posts, q]);
  const open = openId ? posts.find(p2 => p2.id === openId) : null;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: isMobile ? 18 : 22,
      fontWeight: 800,
      color: C.t1
    }
  }, "게시판"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.t3
    }
  }, posts.length, "개"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (editId) cancelEdit();
      setWriting(v => !v);
      setOpenId(null);
    },
    style: {
      marginLeft: "auto",
      padding: "9px 16px",
      borderRadius: 9,
      border: "none",
      background: writing ? C.t3 : C.blue,
      color: "#fff",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, writing ? "취소" : "✏ 글쓰기")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      marginBottom: 10
    }
  }, "공지·인수인계·양식 공유용이에요. 한 파일 최대 200MB까지 올릴 수 있고, 누구나 내려받을 수 있습니다."), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.blue,
      background: C.blueL,
      border: `1px solid ${C.blue}25`,
      borderRadius: 8,
      padding: "8px 11px",
      marginBottom: 10
    }
  }, msg), writing && /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: `1px solid ${C.blue}35`,
      borderRadius: 12,
      padding: "14px 15px",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: title,
    onChange: e => setTitle(e.target.value),
    placeholder: "제목",
    style: {
      width: "100%",
      boxSizing: "border-box",
      padding: "11px 12px",
      background: C.surfaceL,
      border: BD,
      borderRadius: 8,
      color: C.t1,
      fontSize: 16,
      fontWeight: 700,
      outline: "none",
      marginBottom: 8
    }
  }), /*#__PURE__*/React.createElement("textarea", {
    value: body,
    onChange: e => setBody(e.target.value),
    rows: isMobile ? 6 : 8,
    placeholder: "내용을 적어주세요",
    style: {
      width: "100%",
      boxSizing: "border-box",
      padding: "11px 12px",
      background: C.surfaceL,
      border: BD,
      borderRadius: 8,
      color: C.t1,
      fontSize: 16,
      outline: "none",
      resize: "vertical",
      lineHeight: 1.7,
      fontFamily: "inherit"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      alignItems: "center",
      marginTop: 9
    }
  }, /*#__PURE__*/React.createElement("input", {
    ref: fileRef,
    type: "file",
    multiple: true,
    style: {
      display: "none"
    },
    onChange: e => {
      uploadFiles(e.target.files);
      e.target.value = "";
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => fileRef.current && fileRef.current.click(),
    disabled: busy === "upload",
    style: {
      padding: "9px 14px",
      borderRadius: 8,
      border: `1px solid ${C.border}`,
      background: C.surface,
      color: C.t2,
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, busy === "upload" ? "올리는 중…" : `📎 자료 첨부 (최대 ${MAX_MB}MB)`), /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      fontSize: 14,
      color: C.t2,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: pin,
    onChange: e => setPin(e.target.checked)
  }), " 맨 위 고정"), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    style: {
      marginLeft: "auto",
      padding: "9px 20px",
      borderRadius: 8,
      border: "none",
      background: C.blue,
      color: "#fff",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "올리기")), prog && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 9
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: 13,
      color: C.t2,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, prog.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 800,
      color: C.blue
    }
  }, prog.pct, "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      background: C.surfaceD,
      borderRadius: 3,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${prog.pct}%`,
      height: "100%",
      background: C.blue,
      borderRadius: 3,
      transition: "width .2s"
    }
  }))), files.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 5,
      marginTop: 9
    }
  }, files.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "7px 10px",
      background: C.surfaceL,
      border: BD,
      borderRadius: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.t1,
      flex: 1,
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, "📎 ", f.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.t4
    }
  }, fmtSize(f.size)), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (f.path) firebase.storage().ref(f.path).delete().catch(() => {});
      setFiles(p2 => p2.filter((_, j) => j !== i));
    },
    style: {
      border: "none",
      background: "transparent",
      color: C.red,
      fontSize: 16,
      cursor: "pointer",
      lineHeight: 1
    }
  }, "×"))))), /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "제목·내용·작성자 검색",
    style: {
      width: "100%",
      boxSizing: "border-box",
      padding: "10px 13px",
      background: C.surface,
      border: `1px solid ${q ? C.blue : C.border}`,
      borderRadius: 9,
      color: C.t1,
      fontSize: 16,
      outline: "none",
      marginBottom: 12
    }
  }), shown.length === 0 && /*#__PURE__*/React.createElement("div", {
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
  }, "📋"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15
    }
  }, q ? "찾는 글이 없어요." : "아직 올라온 글이 없어요.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, shown.map(p2 => {
    const isOpen = openId === p2.id;
    const mine = p2.by === me;
    const isEditing = editId === p2.id;
    return /*#__PURE__*/React.createElement("div", {
      key: p2.id,
      style: {
        background: C.surface,
        border: `1px solid ${p2.pin ? C.orange + "45" : C.border}`,
        borderLeft: `4px solid ${p2.pin ? C.orange : C.border}`,
        borderRadius: "0 11px 11px 0",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => setOpenId(isOpen ? null : p2.id),
      style: {
        padding: isMobile ? "13px 14px" : "14px 16px",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        flexWrap: "wrap"
      }
    }, p2.pin && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 800,
        color: C.orange,
        background: C.orangeL,
        border: `1px solid ${C.orange}40`,
        borderRadius: 4,
        padding: "2px 6px"
      }
    }, "고정"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        fontWeight: 800,
        color: C.t1,
        flex: 1,
        minWidth: 80,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, p2.title), (p2.files || []).length > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: C.blue,
        fontWeight: 700
      }
    }, "📎 ", p2.files.length), /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.t4,
        fontSize: 14,
        transform: isOpen ? "rotate(90deg)" : "none",
        transition: "transform .2s"
      }
    }, "›")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.t3,
        marginTop: 5
      }
    }, p2.by, " · ", agoText(p2.at), p2.editedAt && /*#__PURE__*/React.createElement("span", {
      title: `${p2.editedBy || ""} 님이 ${agoText(p2.editedAt)} 수정`,
      style: {
        marginLeft: 6,
        color: C.t4
      }
    }, "· 수정됨 ", agoText(p2.editedAt)))), isOpen && !isEditing && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: isMobile ? "0 14px 14px" : "0 16px 16px",
        borderTop: `1px solid ${C.surfaceD}`
      }
    }, p2.body && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 16,
        color: C.t1,
        lineHeight: 1.85,
        whiteSpace: "pre-wrap",
        padding: "12px 0 4px",
        wordBreak: "break-word"
      }
    }, p2.body), (p2.files || []).length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginTop: 10
      }
    }, p2.files.map((f, i) => /*#__PURE__*/React.createElement("a", {
      key: i,
      href: f.url,
      target: "_blank",
      rel: "noreferrer",
      download: f.name,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "11px 12px",
        background: C.surfaceL,
        border: BD,
        borderRadius: 8,
        textDecoration: "none"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 17
      }
    }, "📎"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        fontSize: 15,
        fontWeight: 700,
        color: C.blue,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, f.name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.t4,
        whiteSpace: "nowrap"
      }
    }, fmtSize(f.size)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 800,
        color: C.green,
        whiteSpace: "nowrap"
      }
    }, "내려받기")))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => togglePin(p2),
      style: {
        padding: "8px 13px",
        borderRadius: 7,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        border: `1px solid ${C.border}`,
        background: C.surface,
        color: C.t2
      }
    }, p2.pin ? "고정 해제" : "맨 위 고정"), mine && /*#__PURE__*/React.createElement("button", {
      onClick: () => startEdit(p2),
      style: {
        padding: "8px 13px",
        borderRadius: 7,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        border: `1px solid ${C.blue}40`,
        background: C.blueL,
        color: C.blue
      }
    }, "✏ 수정"), mine && /*#__PURE__*/React.createElement("button", {
      onClick: () => removePost(p2),
      style: {
        padding: "8px 13px",
        borderRadius: 7,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        border: `1px solid ${C.red}35`,
        background: C.redL,
        color: C.red
      }
    }, "삭제"))), isOpen && isEditing && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: isMobile ? "12px 14px 14px" : "14px 16px 16px",
        borderTop: `1px solid ${C.surfaceD}`,
        background: C.blue + "06"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 800,
        color: C.blue,
        marginBottom: 8
      }
    }, "✏ 글 수정"), /*#__PURE__*/React.createElement("input", {
      value: eTitle,
      onChange: e => setETitle(e.target.value),
      placeholder: "제목",
      style: {
        width: "100%",
        boxSizing: "border-box",
        padding: "11px 12px",
        background: C.surface,
        border: BD,
        borderRadius: 8,
        color: C.t1,
        fontSize: 16,
        fontWeight: 700,
        outline: "none",
        marginBottom: 8
      }
    }), /*#__PURE__*/React.createElement("textarea", {
      value: eBody,
      onChange: e => setEBody(e.target.value),
      rows: isMobile ? 6 : 8,
      placeholder: "내용을 적어주세요",
      style: {
        width: "100%",
        boxSizing: "border-box",
        padding: "11px 12px",
        background: C.surface,
        border: BD,
        borderRadius: 8,
        color: C.t1,
        fontSize: 16,
        outline: "none",
        resize: "vertical",
        lineHeight: 1.7,
        fontFamily: "inherit"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        alignItems: "center",
        marginTop: 9
      }
    }, /*#__PURE__*/React.createElement("input", {
      ref: eFileRef,
      type: "file",
      multiple: true,
      style: {
        display: "none"
      },
      onChange: e => {
        uploadFiles(e.target.files, "edit");
        e.target.value = "";
      }
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => eFileRef.current && eFileRef.current.click(),
      disabled: busy === "upload",
      style: {
        padding: "9px 14px",
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        background: C.surface,
        color: C.t2,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, busy === "upload" ? "올리는 중…" : "📎 자료 추가"), /*#__PURE__*/React.createElement("label", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontSize: 14,
        color: C.t2,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: ePin,
      onChange: e => setEPin(e.target.checked)
    }), " 맨 위 고정")), eFiles.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 5,
        marginTop: 9
      }
    }, eFiles.map((f, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 10px",
        background: C.surface,
        border: BD,
        borderRadius: 7
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        color: C.t1,
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, "📎 ", f.name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.t4
      }
    }, fmtSize(f.size)), /*#__PURE__*/React.createElement("button", {
      onClick: () => setEFiles(p3 => p3.filter((_, j) => j !== i)),
      title: "이 첨부 빼기",
      style: {
        border: "none",
        background: "transparent",
        color: C.red,
        fontSize: 16,
        cursor: "pointer",
        lineHeight: 1
      }
    }, "×")))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: C.t4,
        marginTop: 8
      }
    }, "첨부를 빼도 '저장'을 눌러야 실제로 지워져요. 취소하면 원래대로 돌아갑니다."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: cancelEdit,
      style: {
        padding: "9px 16px",
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        background: C.surface,
        color: C.t3,
        fontSize: 15,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, "취소"), /*#__PURE__*/React.createElement("button", {
      onClick: () => saveEdit(p2),
      disabled: busy === "upload",
      style: {
        marginLeft: "auto",
        padding: "9px 22px",
        borderRadius: 8,
        border: "none",
        background: busy === "upload" ? C.t4 : C.blue,
        color: "#fff",
        fontSize: 15,
        fontWeight: 700,
        cursor: busy === "upload" ? "default" : "pointer"
      }
    }, "저장"))));
  })));
}
