/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 03/18 — 공통 화면 부품  (core/03-ui-common.js)
   │ 꼬리표(태그), 진행 막대(16단계 포함), 알림 토스트, 휴대폰 화면 여부 판별
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════
   공통 UI 헬퍼
══════════════════════════════════════════════════════════════ */
function Tag({
  children,
  bg,
  color,
  border
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      padding: "2px 7px",
      borderRadius: 4,
      background: bg,
      color,
      border: border || "none",
      lineHeight: 1.6,
      whiteSpace: "nowrap"
    }
  }, children);
}
function Pill({
  children,
  active,
  ac,
  onClick,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      padding: "5px 11px",
      borderRadius: 20,
      fontSize: 14,
      fontWeight: 600,
      border: `1px solid ${active ? ac : C.border}`,
      background: active ? ac + "18" : "transparent",
      color: active ? ac : C.t3,
      cursor: "pointer",
      whiteSpace: "nowrap",
      ...style
    }
  }, children);
}

/* 8단계 진행바 (목록용 컴팩트 / 상세용) */
/* 워크플로우 16단계 점 표시 — 시트가 주인, 앱은 보여주기만.
   가로 점 16개 · 완료는 파랑, 현재 위치는 테두리, 나머지 회색 */
function Flow16Bar({
  flow,
  compact
}) {
  const {
    arr,
    done,
    pos
  } = flowProgress(flow || {});
  const sz = compact ? 9 : 12;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: compact ? 3 : 5,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: compact ? 2 : 3,
      alignItems: "center"
    }
  }, FLOW16.map((k, i) => {
    const on = arr[i];
    const cur = !on && i === pos; /* 다음 할 일 */
    return /*#__PURE__*/React.createElement("div", {
      key: k,
      title: `${i + 1}. ${k}${on ? " ✓" : cur ? " ← 다음" : ""}`,
      style: {
        width: sz,
        height: sz,
        borderRadius: "50%",
        background: on ? C.blue : cur ? C.surface : C.surfaceD,
        border: cur ? `2px solid ${C.blue}` : on ? `1px solid ${C.blue}` : `1px solid ${C.border}`,
        boxSizing: "border-box",
        flexShrink: 0
      }
    });
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: compact ? 12 : 12,
      fontWeight: 800,
      color: done === 16 ? C.green : C.t2,
      marginLeft: 3,
      whiteSpace: "nowrap"
    }
  }, done, "/16", !compact && pos < 16 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: C.blue,
      marginLeft: 5
    }
  }, "→ ", FLOW16_LABEL[FLOW16[pos]] || FLOW16[pos])));
}

function StepBar({
  progress,
  compact
}) {
  const {
    p,
    done,
    pct
  } = getProgress({
    progress
  });
  const segH = compact ? 7 : 9;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: compact ? 3 : 4,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: compact ? 2 : 3
    }
  }, STEPS.map(k => {
    const on = !!p[k];
    const sp = STEP_SPECIAL[k];
    const col = sp ? C.purple : C.blue;
    return /*#__PURE__*/React.createElement("div", {
      key: k,
      title: `${STEP_ICON[k]} ${k}${on ? " ✓" : ""}`,
      style: {
        width: compact ? 15 : 22,
        height: segH,
        borderRadius: 3,
        background: on ? col : C.surfaceD,
        border: sp ? `1px solid ${on ? col : col + "55"}` : `1px solid ${on ? col : "transparent"}`,
        boxSizing: "border-box"
      }
    });
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: compact ? 12 : 12,
      fontWeight: 800,
      color: done === STEPS.length ? C.green : C.t2,
      marginLeft: 3
    }
  }, done, "/", STEPS.length, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: compact ? 8 : 12,
      fontWeight: 600,
      color: C.t4,
      marginLeft: 3
    }
  }, pct, "%")));
}
function Toast({
  msg
}) {
  const isMobile = useIsMobile();
  if (!msg) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: isMobile ? `calc(${TAB_H + 18}px + env(safe-area-inset-bottom))` : 28,
      left: "50%",
      transform: "translateX(-50%)",
      background: C.surface,
      border: `1px solid ${C.green}`,
      borderRadius: 10,
      padding: "11px 20px",
      fontSize: 14,
      color: C.green,
      fontWeight: 700,
      boxShadow: "0 8px 24px rgba(0,0,0,.15)",
      zIndex: 600,
      whiteSpace: "nowrap",
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", null, "✓"), msg);
}

/* 모바일 화면 감지 훅 */
function useIsMobile(bp = 820) {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < bp : false);
  useEffect(() => {
    const on = () => setM(window.innerWidth < bp);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [bp]);
  return m;
}

/* (정리본 수정) 어느 화면에서나 쓸 수 있는 안내 문구. 화면 아래에 잠깐 떴다 사라진다.
   달력·현장 관리는 자기 화면 안에 같은 이름의 것을 따로 갖고 있어 그것을 쓰고,
   그게 없는 화면(날짜 상세 창, 현장 수정 창, 설정의 시트 연결)은 이것을 쓴다.
   예전에는 이 세 곳이 없는 기능을 불러서, 눌러도 오류만 나고 아무 표시가 없었다. 모양은 위의 Toast 와 같다. */
function showToast(m) {
  let el = document.getElementById("ston-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "ston-toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  const bottom = window.innerWidth < 820 ? `calc(${TAB_H + 18}px + env(safe-area-inset-bottom))` : "28px";
  el.style.cssText = `position:fixed;bottom:${bottom};left:50%;transform:translateX(-50%);background:${C.surface};border:1px solid ${C.green};border-radius:10px;padding:11px 20px;font-size:14px;color:${C.green};font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.15);z-index:600;max-width:90vw;display:flex;align-items:center;gap:8px`;
  el.textContent = "✓ " + m;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.remove(), 2600);
}
