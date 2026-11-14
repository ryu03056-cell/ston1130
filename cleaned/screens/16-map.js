/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 16/18 — 현장 지도  (screens/16-map.js)
   │ 카카오 지도에 현장 위치 표시, 길찾기
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════
   지도 — 현장 위치를 지도에 찍어 근방에 몰린 현장 확인
   · 카카오맵 키가 있으면 학교명/주소로 실제 위치를 찾아 표시(한 번 찾은 위치는 서버에 저장)
   · 키가 없어도 지역 기준 대략 위치로 분포를 볼 수 있음
   ══════════════════════════════════════════════════════════════ */
function MapPage({
  db,
  setDb,
  allSchools,
  kakaoKey,
  isMobile
}) {
  /* 최근 시기가 앞으로 — 지금이 26년 하반기면 26하 → 26상 → 25하 … 순, LH는 맨 뒤 */
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
  const [sel, setSel] = useState(null);
  const cur = sel || buckets[0] || null;
  const [geo, setGeo] = useState({}); // 학교키 → {lat,lng}
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [picked, setPicked] = useState(null); // 마커 클릭한 현장
  const [onlySoon, setOnlySoon] = useState(false);
  const [showLabels, setShowLabels] = useState(true); // 핀 위에 날짜 라벨 표시
  const [undoStack, setUndoStack] = useState([]); // 핀 이동 되돌리기
  const [editId, setEditId] = useState(null); // 지도에서 바로 수정
  const [placeQ, setPlaceQ] = useState(""); // 위치 지정용 장소 검색어
  const [placeHits, setPlaceHits] = useState(null); // 장소 검색 결과
  const [pickMode, setPickMode] = useState(false); // 지도 눌러서 위치 찍기
  const [dragMode, setDragMode] = useState(false); // 핀 끌어서 옮기기 (평소엔 꺼둬야 탭이 잘 먹음)
  const [helpOpen, setHelpOpen] = useState(false); // 도움말 (평소엔 접어둠)
  const [cardY, setCardY] = useState(0); // 현장 카드 쓸어내려 닫기
  const cardStart = useRef(null);
  const [ready, setReady] = useState(false); // 지도 생성 완료 여부
  const [q, setQ] = useState(""); // 현장 검색어
  const [focusId, setFocusId] = useState(null); // 검색으로 이동할 현장
  const [diag, setDiag] = useState({
    step: "대기 중",
    markers: 0
  });
  const mapRef = useRef(null),
    boxRef = useRef(null),
    clRef = useRef(null),
    kkRef = useRef(null);
  const stopRef = useRef(false),
    fitRef = useRef(false),
    autoRef = useRef({});
  const ovRef = useRef([]),
    labelOnRef = useRef(true),
    zoomBoundRef = useRef(false);
  const pickRef = useRef(null),
    clickBoundRef = useRef(false);
  const sites = useMemo(() => {
    if (!cur) return [];
    let list = (db[cur.y] && db[cur.y][cur.h] || []).filter(s => !s.deleted);
    if (onlySoon) list = list.filter(s => {
      const d = calcDday(s.end);
      return d !== null && d <= 30;
    });
    return list;
  }, [db, cur, onlySoon]);

  /* 이름으로 현장 찾기 — 반기를 몰라도 전체에서 찾아준다 */
  const matches = useMemo(() => {
    const key = normSchool(q);
    if (!key || key.length < 1) return [];
    const out = [];
    Object.keys(db || {}).forEach(y => Object.keys(db[y] || {}).forEach(h => {
      (db[y][h] || []).forEach(s2 => {
        if (s2.deleted) return;
        const nm = normSchool(s2.school);
        if (!nm.includes(key)) return;
        out.push({
          s: s2,
          y,
          h,
          score: nm.startsWith(key) ? 0 : 1
        });
      });
    }));
    /* 같은 학교가 여러 반기에 걸쳐 있으면 최근 것부터 (LH는 맨 뒤) */
    const rank = x => isLH(x.y) ? -1 : (parseInt(x.y, 10) || 0) * 2 + (x.h === "하반기" ? 1 : 0);
    return out.sort((a, b) => a.score - b.score || rank(b) - rank(a) || a.s.school.length - b.s.school.length).slice(0, 8);
  }, [db, q]);

  /* 검색 결과 선택 → 그 반기로 옮기고 지도 확대 */
  const goTo = m => {
    setQ("");
    if (!cur || cur.y !== m.y || cur.h !== m.h) setSel({
      y: m.y,
      h: m.h
    });
    fitRef.current = true; // 전체보기로 되돌아가지 않게
    setFocusId(m.s.id);
    setPicked(m.s);
  };

  /* 저장된 좌표 불러오기 */
  useEffect(() => {
    try {
      const r = firebase.database().ref(FB_GEO);
      const cb = r.on("value", sn => setGeo(sn.val() || {}));
      return () => r.off("value", cb);
    } catch {
      return undefined;
    }
  }, []);

  /* 지도 띄우기 */
  useEffect(() => {
    if (!kakaoKey) {
      setDiag({
        step: "키 없음",
        markers: 0
      });
      return;
    }
    let dead = false;
    setDiag(d => ({
      ...d,
      step: "지도 파일 불러오는 중…"
    }));
    loadKakao(kakaoKey).then(kakao => {
      if (dead) return;
      kkRef.current = kakao;
      setDiag(d => ({
        ...d,
        step: "지도 만드는 중…"
      }));
      /* 지도 넣을 자리가 아직 안 그려졌을 수 있어 준비될 때까지 기다린다 */
      const make = () => {
        if (dead) return;
        if (!boxRef.current) {
          setTimeout(make, 60);
          return;
        }
        try {
          if (!mapRef.current) {
            mapRef.current = new kakao.maps.Map(boxRef.current, {
              center: new kakao.maps.LatLng(37.4138, 127.0180),
              level: 10
            });
          }
          setTimeout(() => {
            try {
              mapRef.current.relayout();
            } catch {}
          }, 120); // 크기 잡히면 다시 그리기
          /* 지도를 눌러 위치를 직접 찍는 모드 */
          if (!clickBoundRef.current) {
            kakao.maps.event.addListener(mapRef.current, "click", me => {
              const target = pickRef.current;
              if (!target) return;
              const ll = me.latLng;
              saveGeo(target.school, {
                lat: ll.getLat(),
                lng: ll.getLng(),
                src: "manual",
                at: Date.now()
              });
              setStatus(`${target.school} 위치를 지도에서 지정했어요.`);
              pickRef.current = null;
              setPickMode(false);
            });
            clickBoundRef.current = true;
          }
          setReady(true);
          setErr(null);
          setDiag(d => ({
            ...d,
            step: "지도 준비 완료"
          }));
        } catch (e) {
          setErr(e && e.message || String(e));
          setDiag(d => ({
            ...d,
            step: "지도 생성 실패"
          }));
        }
      };
      make();
    }).catch(e => {
      setErr(e && e.message || String(e));
      setDiag(d => ({
        ...d,
        step: "불러오기 실패"
      }));
    });
    return () => {
      dead = true;
    };
  }, [kakaoKey]);

  /* 위치 저장 — 되돌릴 수 있게 이전 값을 기억해 둔다 */
  const saveGeo = (school, val, {
    remember = true
  } = {}) => {
    const k = normSchool(school);
    if (remember) setUndoStack(st => [{
      k,
      school,
      prev: geo[k] || null
    }, ...st].slice(0, 20));
    setGeo(prev => {
      const n = {
        ...prev
      };
      if (val) n[k] = val;else delete n[k];
      return n;
    });
    try {
      const ref = firebase.database().ref(FB_GEO).child(k);
      if (val) ref.set(stripUndefined(val)).catch(() => {});else ref.remove().catch(() => {});
    } catch {}
  };
  const undoMove = () => {
    const top = undoStack[0];
    if (!top) return;
    setUndoStack(st => st.slice(1));
    saveGeo(top.school, top.prev, {
      remember: false
    });
    setStatus(`${top.school} 위치를 되돌렸어요.`);
  };

  /* 위치 자동 찾기 — 좌표가 없는 현장을 카카오 장소·주소 검색으로 채운다.
     · 직접 지정(🟢)한 위치는 건드리지 않는다
     · 지역 대표좌표에서 25km 넘게 떨어지면 엉뚱한 동명이 현장으로 보고 버린다
     · '■ 중지'를 누르면 즉시 멈춘다 */
  const runGeocode = (ids, opts = {}) => {
    const kakao = kkRef.current;
    if (!kakao || !kakao.maps || !kakao.maps.services) {
      setStatus("지도가 아직 준비되지 않았어요. 잠시 후 다시 눌러 주세요.");
      return;
    }
    const targets = sites.filter(s => {
      if (ids) return ids.includes(s.id); // 콕 집어 지정한 건 무조건 다시 찾는다
      const g = geo[normSchool(s.school)];
      if (g && g.src === "manual") return false; // 손으로 맞춰둔 건 보존
      if (g && g.lat) return false; // 이미 좌표 있음
      if (!opts.includeFailed && autoRef.current[normSchool(s.school)]) return false; // 아까 실패한 건 건너뜀
      return true;
    });
    if (!targets.length) {
      setStatus("새로 찾을 현장이 없어요.");
      return;
    }
    stopRef.current = false;
    setBusy(true);
    const places = new kakao.maps.services.Places();
    const coder = new kakao.maps.services.Geocoder();
    let done = 0,
      ok = 0,
      fail = 0;
    const finish = () => {
      setBusy(false);
      setStatus(stopRef.current ? `중지했어요 — ${ok}곳 찾음 · ${fail}곳 실패` : `완료 — ${ok}곳 찾았어요.${fail ? ` ${fail}곳은 못 찾았으니 핀을 끌거나 이름·주소로 지정해 주세요.` : ""}`);
    };
    const step = () => {
      if (stopRef.current || done >= targets.length) return finish();
      const s = targets[done++];
      setStatus(`위치 찾는 중… (${done}/${targets.length}) ${s.school}`);
      const rx = regionXY(s.region);
      const ok25 = (lat, lng) => !rx || distKm([lat, lng], rx) <= 25;
      const keep = (lat, lng) => {
        saveGeo(s.school, {
          lat,
          lng,
          src: "auto",
          at: Date.now()
        }, {
          remember: !!ids
        });
        ok++;
      };
      const next = () => setTimeout(step, 120); // 연속 호출이 막히지 않게 간격을 둔다
      const q = `${s.region || ""} ${s.school}`.trim();
      const byAddress = () => {
        coder.addressSearch(q, (r, st) => {
          const h = st === kakao.maps.services.Status.OK && r && r.find(x => ok25(+x.y, +x.x));
          if (h) keep(+h.y, +h.x);else {
            autoRef.current[normSchool(s.school)] = true;
            fail++;
          }
          next();
        });
      };
      const opt = rx ? {
        location: new kakao.maps.LatLng(rx[0], rx[1]),
        radius: 20000
      } : {};
      places.keywordSearch(q, (r, st) => {
        const h = st === kakao.maps.services.Status.OK && r && r.find(x => ok25(+x.y, +x.x));
        if (h) {
          keep(+h.y, +h.x);
          next();
        } else byAddress();
      }, opt);
    };
    step();
  };
  const posOf = useCallback(s => {
    const g = geo[normSchool(s.school)];
    if (g && g.lat && g.lng) return {
      lat: g.lat,
      lng: g.lng,
      exact: true,
      manual: g.src === "manual"
    };
    const rx = regionXY(s.region);
    if (!rx) return null;
    const [dy, dx] = jitter(s.school);
    return {
      lat: rx[0] + dy,
      lng: rx[1] + dx,
      exact: false
    };
  }, [geo]);

  /* 이동 대상이 정해지면 그 위치로 확대 (반기 전환 후 마커가 다시 그려진 뒤 실행) */
  useEffect(() => {
    if (!focusId || !ready) return;
    const map = mapRef.current,
      kakao = kkRef.current;
    if (!map || !kakao) return;
    const target = sites.find(x => x.id === focusId);
    if (!target) return; // 아직 반기 전환 중
    const p = posOf(target);
    if (p) {
      const ll = new kakao.maps.LatLng(p.lat, p.lng);
      try {
        map.setLevel(p.exact ? 3 : 6);
        map.panTo(ll);
      } catch {}
      setPicked({
        ...target,
        _exact: p.exact
      });
      setStatus(p.exact ? `${target.school} 위치로 이동했어요.` : `${target.school} — 정확한 위치를 못 찾아 지역 기준으로 이동했어요. 핀을 끌어 맞춰 주세요.`);
    }
    setFocusId(null);
  }, [focusId, ready, sites, posOf]);

  /* 라벨(현장조사일·완수일)은 확대했을 때만 보이게 — 멀리서 보면 글자가 겹쳐 지저분해짐 */
  const LABEL_LEVEL = 6;
  const applyLabels = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const on = labelOnRef.current && map.getLevel() <= LABEL_LEVEL;
    ovRef.current.forEach(ov => {
      try {
        ov.setMap(on ? map : null);
      } catch {}
    });
  }, []);
  useEffect(() => {
    labelOnRef.current = showLabels;
    applyLabels();
  }, [showLabels, applyLabels]);

  /* 마커 그리기
     · 평소에는 핀을 고정 → 탭하면 바로 선택됨 (끌기 모드일 때만 draggable)
     · 날짜 라벨도 눌러서 선택 가능 (핀보다 넓어서 손가락으로 누르기 쉬움) */
  useEffect(() => {
    const kakao = kkRef.current,
      map = mapRef.current;
    if (!ready || !kakao || !map) return;
    if (clRef.current) clRef.current.clear();
    ovRef.current.forEach(ov => {
      try {
        ov.setMap(null);
      } catch {}
    });
    ovRef.current = [];
    const W = isMobile ? 32 : 28,
      H = isMobile ? 42 : 36;
    const pin = color => new kakao.maps.MarkerImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 26 34">
           <path d="M13 0C5.8 0 0 5.8 0 13c0 9.3 13 21 13 21s13-11.7 13-21C26 5.8 20.2 0 13 0z" fill="${color}"/>
           <circle cx="13" cy="12.5" r="4.6" fill="#fff"/></svg>`), new kakao.maps.Size(W, H), {
      offset: new kakao.maps.Point(W / 2, H)
    });
    const exactPin = pin("#1D6FF2"),
      roughPin = pin("#9AA5B4"),
      manualPin = pin("#0D9B6C");
    const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
    const md = v => {
      const a = String(v || "").split("-");
      return a.length === 3 ? `${a[1]}-${a[2]}` : "";
    };
    const markers = [];
    const bounds = new kakao.maps.LatLngBounds();
    let any = false,
      nExact = 0;
    sites.forEach(s => {
      const p = posOf(s);
      if (!p) return;
      any = true;
      if (p.exact) nExact++;
      const ll = new kakao.maps.LatLng(p.lat, p.lng);
      bounds.extend(ll);
      const choose = () => setPicked({
        ...s,
        _exact: p.exact,
        _manual: p.manual
      });
      const mk = new kakao.maps.Marker({
        position: ll,
        title: s.school,
        image: p.manual ? manualPin : p.exact ? exactPin : roughPin,
        draggable: dragMode
      });
      kakao.maps.event.addListener(mk, "click", choose);
      if (dragMode) {
        kakao.maps.event.addListener(mk, "dragend", () => {
          const q2 = mk.getPosition();
          saveGeo(s.school, {
            lat: q2.getLat(),
            lng: q2.getLng(),
            src: "manual",
            at: Date.now()
          });
          setStatus(`${s.school} 위치를 직접 지정했어요. 되돌리려면 '되돌리기'를 누르세요.`);
        });
      }
      markers.push(mk);

      /* 핀 위 라벨 — 눌러도 선택됨 */
      const dd = calcDday(s.end);
      const parts = [];
      if (s.field) parts.push(`조사 ${md(s.field)}`);
      if (s.end) parts.push(`완수 ${md(s.end)}${dd !== null ? ` (${dd >= 0 ? `D-${dd}` : `D+${-dd}`})` : ""}`);
      const urgent = dd !== null && dd <= 7;
      const sub = parts.join(" · ") || "일정 미정";
      const el = document.createElement("div");
      el.style.cssText = `transform:translateY(-${H + 4}px);white-space:nowrap;background:#fff;` + `border:1px solid ${urgent ? "#D64545" : "#D5DEEA"};border-radius:6px;padding:4px 9px;` + `box-shadow:0 2px 7px rgba(20,30,50,.16);font-family:Pretendard,'맑은 고딕',sans-serif;cursor:pointer`;
      el.innerHTML = `<div style="font-size:11px;font-weight:800;color:#1A2332">${esc(s.school)}</div>` + `<div style="font-size:10px;font-weight:600;color:${urgent ? "#D64545" : "#5A6478"};margin-top:1px">${esc(sub)}</div>`;
      el.addEventListener("click", e => {
        e.stopPropagation();
        choose();
      });
      const ov = new kakao.maps.CustomOverlay({
        position: ll,
        content: el,
        yAnchor: 1,
        zIndex: 3,
        clickable: true
      });
      ovRef.current.push(ov);
    });
    if (!clRef.current) {
      clRef.current = new kakao.maps.MarkerClusterer({
        map,
        averageCenter: true,
        minLevel: 7,
        gridSize: 70
      });
      /* 묶음을 누르면 확대되어 개별 핀으로 나뉨 */
      kakao.maps.event.addListener(clRef.current, "clusterclick", cluster => {
        const lv = map.getLevel() - 2;
        try {
          map.setLevel(lv < 1 ? 1 : lv, {
            anchor: cluster.getCenter()
          });
        } catch {}
      });
    }
    clRef.current.addMarkers(markers);
    setDiag(d => ({
      ...d,
      markers: markers.length,
      exact: nExact
    }));
    if (!zoomBoundRef.current) {
      kakao.maps.event.addListener(map, "zoom_changed", () => applyLabels());
      zoomBoundRef.current = true;
    }
    applyLabels();
    if (any && !fitRef.current) {
      try {
        map.setBounds(bounds);
        fitRef.current = true;
      } catch {}
    }
  }, [sites, posOf, ready, applyLabels, dragMode, isMobile]);

  /* 이름이나 주소로 위치 찾아 지정 — 못 찾은 현장을 손으로 잡아줄 때 */
  const searchPlace = () => {
    const kakao = kkRef.current;
    const q2 = (placeQ || "").trim();
    if (!kakao || !q2) return;
    const rx = picked ? regionXY(picked.region) : null;
    const center = rx ? new kakao.maps.LatLng(rx[0], rx[1]) : null;
    const places = new kakao.maps.services.Places();
    const coder = new kakao.maps.services.Geocoder();
    setPlaceHits("loading");
    const opt = center ? {
      location: center,
      radius: 20000,
      sort: kakao.maps.services.SortBy.DISTANCE
    } : {};
    places.keywordSearch(q2, (r, st) => {
      let list = st === kakao.maps.services.Status.OK && r ? r.slice(0, 6).map(x => ({
        name: x.place_name,
        addr: x.road_address_name || x.address_name,
        lat: +x.y,
        lng: +x.x
      })) : [];
      /* 장소로 못 찾으면 주소로 한 번 더 */
      if (!list.length) {
        coder.addressSearch(q2, (r2, st2) => {
          if (st2 === kakao.maps.services.Status.OK && r2 && r2.length) {
            list = r2.slice(0, 6).map(x => ({
              name: x.address_name,
              addr: x.road_address ? x.road_address.address_name : "",
              lat: +x.y,
              lng: +x.x
            }));
          }
          setPlaceHits(list);
        });
      } else setPlaceHits(list);
    }, opt);
  };
  const applyPlace = hit => {
    if (!picked) return;
    saveGeo(picked.school, {
      lat: hit.lat,
      lng: hit.lng,
      src: "manual",
      at: Date.now()
    });
    setPlaceQ("");
    setPlaceHits(null);
    setStatus(`${picked.school} 위치를 '${hit.name}'(으)로 지정했어요.`);
    const kakao = kkRef.current,
      map = mapRef.current;
    if (kakao && map) {
      try {
        map.setLevel(3);
        map.panTo(new kakao.maps.LatLng(hit.lat, hit.lng));
      } catch {}
    }
  };
  const exactCnt = sites.filter(s => {
    const g = geo[normSchool(s.school)];
    return g && g.lat;
  }).length;
  const manualCnt = sites.filter(s => {
    const g = geo[normSchool(s.school)];
    return g && g.lat && g.src === "manual";
  }).length;
  const noPos = sites.filter(s => !posOf(s)).length;

  /* 지역별 집계 — 키가 없어도 어디에 몰려 있는지 볼 수 있게 */
  const byRegion = useMemo(() => {
    const m = {};
    sites.forEach(s => {
      const r = (s.region || "미지정").trim() || "미지정";
      m[r] = (m[r] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [sites]);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 9
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: isMobile ? 18 : 22,
      fontWeight: 800,
      color: C.t1,
      flex: 1
    }
  }, "현장 지도"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setHelpOpen(v => !v),
    style: {
      padding: "6px 12px",
      borderRadius: 20,
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap",
      border: `1px solid ${helpOpen ? C.blue : C.border}`,
      background: helpOpen ? C.blueL : C.surface,
      color: helpOpen ? C.blue : C.t3
    }
  }, "❓ 도움말")), helpOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.t2,
      background: C.blueL,
      border: `1px solid ${C.blue}25`,
      borderRadius: 10,
      padding: "12px 14px",
      marginBottom: 10,
      lineHeight: 1.9
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      color: C.blue,
      marginBottom: 5
    }
  }, "핀 색깔"), "🟢 초록 = 직접 지정한 위치 · 🔵 파랑 = 검색으로 찾은 위치 · ⚪ 회색 = 못 찾아서 시(市) 중심에 임시 표시", /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      color: C.blue,
      marginTop: 9,
      marginBottom: 5
    }
  }, "쓰는 법"), "· 핀이나 ", /*#__PURE__*/React.createElement("b", null, "날짜 라벨"), "을 누르면 아래에 현장 정보(전화·수정·길찾기)가 열려요", /*#__PURE__*/React.createElement("br", null), "· 뭉쳐 있는 원을 누르면 ", /*#__PURE__*/React.createElement("b", null, "확대되며 개별 핀"), "으로 나뉩니다", /*#__PURE__*/React.createElement("br", null), "· 이름을 검색하면 그 현장으로 ", /*#__PURE__*/React.createElement("b", null, "바로 이동"), "해요 (다른 반기에 있어도 찾아줍니다)", /*#__PURE__*/React.createElement("br", null), "· 위치를 옮기려면 ", /*#__PURE__*/React.createElement("b", null, "✋ 핀 옮기기"), "를 켠 뒤 끌어다 놓고, 잘못 옮겼으면 ", /*#__PURE__*/React.createElement("b", null, "↩ 되돌리기"), /*#__PURE__*/React.createElement("br", null), "· 위치를 못 찾은 현장은 현장 카드에서 ", /*#__PURE__*/React.createElement("b", null, "이름·주소로 찾기"), "나 ", /*#__PURE__*/React.createElement("b", null, "지도에서 직접 찍기"), "로 지정", /*#__PURE__*/React.createElement("br", null), "· ", /*#__PURE__*/React.createElement("b", null, "날짜 라벨"), "은 확대하면 핀 위에 나타나요 (조사일 · 완수일 · D-day). 완수 7일 이내는 빨간 테두리", /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      color: C.blue,
      marginTop: 9,
      marginBottom: 5
    }
  }, "위치 저장"), "한 번 정해진 위치는 ", /*#__PURE__*/React.createElement("b", null, "그대로 고정"), "되고 다시 검색하지 않아요. 갱신이 필요할 때만 아래 도구를 쓰세요."), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      marginBottom: 9
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" && matches.length) goTo(matches[0]);
      if (e.key === "Escape") setQ("");
    },
    placeholder: "현장 이름으로 찾기 (예: 용문고, 시온고)",
    style: {
      flex: 1,
      padding: "10px 13px",
      background: C.surface,
      border: `1px solid ${q ? C.blue : C.border}`,
      borderRadius: 9,
      color: C.t1,
      fontSize: 16,
      outline: "none"
    }
  }), q && /*#__PURE__*/React.createElement("button", {
    onClick: () => setQ(""),
    style: {
      padding: "0 13px",
      borderRadius: 9,
      border: `1px solid ${C.border}`,
      background: C.surface,
      color: C.t3,
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "지우기")), q && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      marginTop: 4,
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      boxShadow: "0 8px 24px rgba(20,30,50,.14)",
      zIndex: 40,
      overflow: "hidden"
    }
  }, matches.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 14px",
      fontSize: 14,
      color: C.t4
    }
  }, "일치하는 현장이 없어요."), matches.map(m => {
    const has = !!geo[normSchool(m.s.school)];
    /* 어느 반기 건인지가 제일 먼저 보여야 같은 학교가 여러 번 나와도 헷갈리지 않는다 */
    const lh = isLH(m.y);
    const hc = lh ? C.purple : m.h === "상반기" ? C.blue : C.orange;
    const hlabel = lh ? "LH" : `${String(m.y).slice(2)}년 ${m.h === "상반기" ? "상" : "하"}`;
    return /*#__PURE__*/React.createElement("button", {
      key: `${m.y}-${m.h}-${m.s.id}`,
      onClick: () => goTo(m),
      style: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "10px 13px",
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${C.surfaceD}`,
        cursor: "pointer",
        textAlign: "left"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flexShrink: 0,
        minWidth: 54,
        textAlign: "center",
        padding: "5px 7px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 800,
        color: hc,
        background: hc + "16",
        border: `1px solid ${hc}45`,
        whiteSpace: "nowrap"
      }
    }, lh ? "🏢 LH" : hlabel), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontSize: 15,
        fontWeight: 700,
        color: C.t1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, m.s.school), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontSize: 12,
        color: C.t4,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, m.s.region ? `${m.s.region} · ` : "", (m.s.buildings || []).map(b => b.b).filter(Boolean).slice(0, 3).join(" · ") || "동 정보 없음", m.s.end ? ` · 완수 ${fd(m.s.end)}` : "")), /*#__PURE__*/React.createElement("span", {
      title: has ? "위치 저장됨" : "위치 미확정",
      style: {
        fontSize: 15,
        flexShrink: 0
      }
    }, has ? "🔵" : "⚪"));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center",
      marginBottom: 9,
      overflowX: "auto",
      paddingBottom: 2,
      WebkitOverflowScrolling: "touch"
    }
  }, buckets.map(b => {
    const on = cur && cur.y === b.y && cur.h === b.h;
    return /*#__PURE__*/React.createElement("button", {
      key: `${b.y}-${b.h}`,
      onClick: () => {
        setSel(b);
        setPicked(null);
        fitRef.current = false;
      },
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
    }, isLH(b.y) ? "🏢 LH" : `${String(b.y).slice(2)}년 ${b.h === "상반기" ? "상" : "하"}`, /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 5,
        fontSize: 12,
        color: C.t4
      }
    }, (db[b.y][b.h] || []).length));
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setOnlySoon(v => !v),
    style: {
      padding: "7px 12px",
      borderRadius: 20,
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap",
      flexShrink: 0,
      border: `1px solid ${onlySoon ? C.red : C.border}`,
      background: onlySoon ? C.redL : C.surface,
      color: onlySoon ? C.red : C.t3
    }
  }, "🚨 임박")), !kakaoKey ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: BD,
      borderRadius: 12,
      padding: "18px 20px",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: C.t1,
      marginBottom: 6
    }
  }, "🗺 지도를 켜려면 카카오맵 키가 한 번 필요해요"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.t2,
      lineHeight: 1.8,
      marginBottom: 10
    }
  }, "무료입니다. ", /*#__PURE__*/React.createElement("b", null, "설정 → 지도(카카오맵) 설정"), "에서 키를 넣으면 바로 켜져요.", /*#__PURE__*/React.createElement("br", null), "① developers.kakao.com 로그인 → 내 애플리케이션 → 애플리케이션 추가하기", /*#__PURE__*/React.createElement("br", null), "② 만든 앱 → ", /*#__PURE__*/React.createElement("b", null, "[카카오맵] → [사용 설정] → 상태 ON"), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.orange,
      fontWeight: 700
    }
  }, "(꼭 필요)"), /*#__PURE__*/React.createElement("br", null), "③ ", /*#__PURE__*/React.createElement("b", null, "앱 키 → JavaScript 키 → JavaScript SDK 도메인"), "에 이 사이트 주소 등록", /*#__PURE__*/React.createElement("br", null), "④ ", /*#__PURE__*/React.createElement("b", null, "JavaScript 키"), " 복사 → 설정에 붙여넣기"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: C.t1,
      marginBottom: 8
    }
  }, "지금은 지역별 분포로 볼 수 있어요"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, byRegion.map(([r, n]) => {
    const top = byRegion[0][1] || 1;
    return /*#__PURE__*/React.createElement("div", {
      key: r,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 70,
        fontSize: 14,
        fontWeight: 700,
        color: C.t1
      }
    }, r), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        height: 10,
        background: C.surfaceD,
        borderRadius: 5,
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: `${Math.round(n / top * 100)}%`,
        height: "100%",
        background: C.blue,
        borderRadius: 5
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 40,
        textAlign: "right",
        fontSize: 14,
        fontWeight: 700,
        color: C.t2
      }
    }, n, "개"));
  }), !byRegion.length && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.t4
    }
  }, "표시할 현장이 없습니다."))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    ref: boxRef,
    style: {
      width: "100%",
      height: isMobile ? "58vh" : 560,
      minHeight: isMobile ? 300 : 400,
      borderRadius: 12,
      border: BD,
      overflow: "hidden",
      background: C.surfaceL
    }
  }), busy && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginTop: 8,
      fontSize: 13,
      color: C.t2,
      background: C.blueL,
      border: `1px solid ${C.blue}25`,
      borderRadius: 8,
      padding: "8px 11px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, status || "위치 찾는 중…"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      stopRef.current = true;
    },
    style: {
      padding: "5px 11px",
      borderRadius: 6,
      border: `1px solid ${C.red}40`,
      background: C.redL,
      color: C.red,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      flexShrink: 0
    }
  }, "■ 중지")), !busy && status && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      marginTop: 8,
      padding: "0 2px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, status), err && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.red,
      background: C.redL,
      border: `1px solid ${C.red}35`,
      borderRadius: 8,
      padding: "10px 12px",
      marginTop: 8,
      whiteSpace: "pre-wrap",
      lineHeight: 1.7
    }
  }, "⚠ ", err, "\n\n", /*#__PURE__*/React.createElement("b", null, "확인할 것 (2026년 7월 21일부터 절차가 바뀌었어요)"), "\n", "① 카카오디벨로퍼스 → 내 앱 → ", /*#__PURE__*/React.createElement("b", null, "[카카오맵] → [사용 설정] → 상태 ON"), "\n", "② ", /*#__PURE__*/React.createElement("b", null, "앱 키 → JavaScript 키 → 'JavaScript SDK 도메인'"), "에 아래 주소 등록", "\n", "\u3000 ", typeof window !== "undefined" ? window.location.origin : "", "\n", "③ 넣은 키가 ", /*#__PURE__*/React.createElement("b", null, "JavaScript 키"), "가 맞는지 (REST API 키 아님)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
      marginTop: 9
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowLabels(v => !v),
    style: {
      padding: "7px 12px",
      borderRadius: 20,
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap",
      border: `1px solid ${showLabels ? C.blue : C.border}`,
      background: showLabels ? C.blueL : C.surface,
      color: showLabels ? C.blue : C.t3
    }
  }, "📅 날짜"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setDragMode(v => !v);
      setStatus(!dragMode ? "핀을 끌어서 옮길 수 있어요. 다 옮겼으면 다시 눌러 꺼주세요." : "");
    },
    style: {
      padding: "7px 12px",
      borderRadius: 20,
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap",
      border: `1px solid ${dragMode ? C.green : C.border}`,
      background: dragMode ? C.greenL : C.surface,
      color: dragMode ? C.green : C.t2
    }
  }, dragMode ? "✋ 옮기는 중" : "✋ 핀 옮기기"), !busy && /*#__PURE__*/React.createElement("button", {
    onClick: () => runGeocode(null, {
      includeFailed: true
    }),
    style: {
      padding: "7px 12px",
      borderRadius: 20,
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap",
      border: `1px solid ${C.border}`,
      background: C.surface,
      color: C.t2
    }
  }, "🔄 위치 찾기"), undoStack.length > 0 && !busy && /*#__PURE__*/React.createElement("button", {
    onClick: undoMove,
    style: {
      padding: "7px 12px",
      borderRadius: 20,
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap",
      border: `1px solid ${C.orange}`,
      background: C.orangeL,
      color: C.orange
    }
  }, "↩ 되돌리기 ", undoStack.length), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.t4,
      marginLeft: "auto",
      whiteSpace: "nowrap"
    }
  }, "🟢", manualCnt, " 🔵", exactCnt - manualCnt, " ⚪", sites.length - exactCnt - noPos, noPos > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.orange
    }
  }, " · 미표시 ", noPos), !ready && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.orange,
      marginLeft: 5
    }
  }, "· ", diag.step)))), picked && (() => {
    const tel = siteTel(picked);
    const dial = tel.replace(/[^0-9+]/g, "");
    const needPos = !picked._exact;
    /* 휴대폰에서는 화면 아래에 고정으로 띄워, 핀을 누르면 바로 보이게 */
    const wrapStyle = isMobile ? {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 260,
      background: C.surface,
      borderTop: `3px solid ${C.blue}`,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      boxShadow: "0 -8px 30px rgba(0,0,0,.20)",
      padding: "10px 14px calc(18px + env(safe-area-inset-bottom))",
      maxHeight: "62vh",
      overflowY: "auto",
      transform: cardY ? `translateY(${cardY}px)` : undefined,
      transition: cardStart.current ? "none" : "transform .2s ease-out",
      animation: cardY ? undefined : "pickUp .2s ease-out"
    } : {
      marginTop: 12,
      background: C.surface,
      border: BD,
      borderRadius: 12,
      padding: "14px 16px"
    };
    const closeCard = () => {
      setPicked(null);
      setCardY(0);
    };
    return /*#__PURE__*/React.createElement("div", {
      style: wrapStyle
    }, /*#__PURE__*/React.createElement("style", null, `@keyframes pickUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`), isMobile && /*#__PURE__*/React.createElement("div", {
      onClick: closeCard,
      onTouchStart: e => {
        cardStart.current = e.touches[0].clientY;
      },
      onTouchMove: e => {
        if (cardStart.current == null) return;
        const dy = e.touches[0].clientY - cardStart.current;
        if (dy > 0) setCardY(dy);
      },
      onTouchEnd: () => {
        const dy = cardY;
        cardStart.current = null;
        if (dy > 70) closeCard();else setCardY(0);
      },
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        paddingBottom: 8,
        cursor: "pointer",
        touchAction: "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 44,
        height: 5,
        borderRadius: 3,
        background: C.borderD
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.t4
      }
    }, "아래로 쓸어내리면 닫혀요")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        fontWeight: 800,
        color: C.t1,
        flex: 1,
        minWidth: 100
      }
    }, picked.school), isMobile && /*#__PURE__*/React.createElement("button", {
      onClick: closeCard,
      style: {
        width: 28,
        height: 28,
        borderRadius: "50%",
        border: `1px solid ${C.border}`,
        background: C.surfaceL,
        color: C.t3,
        fontSize: 17,
        cursor: "pointer",
        lineHeight: 1,
        flexShrink: 0
      }
    }, "×"), tel ? /*#__PURE__*/React.createElement("a", {
      href: `tel:${dial}`,
      style: {
        padding: "6px 13px",
        borderRadius: 7,
        fontSize: 15,
        fontWeight: 800,
        textDecoration: "none",
        border: `1px solid ${C.green}55`,
        background: C.greenL,
        color: C.green,
        whiteSpace: "nowrap"
      }
    }, "📞 ", tel) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: C.t4
      }
    }, "전화번호 없음"), /*#__PURE__*/React.createElement("button", {
      onClick: () => setEditId(picked.id),
      style: {
        padding: "6px 13px",
        borderRadius: 7,
        fontSize: 15,
        fontWeight: 700,
        border: `1px solid ${C.blue}40`,
        background: C.blueL,
        color: C.blue,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }
    }, "✏ 수정")), (() => {
      const rl = routeLinks(picked, posOf(picked));
      return /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: 800,
          color: C.t2
        }
      }, "🧭 길찾기"), /*#__PURE__*/React.createElement("button", {
        onClick: () => openRoute(rl.kakao),
        style: {
          padding: "7px 13px",
          borderRadius: 7,
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
          whiteSpace: "nowrap",
          border: `1px solid ${C.purple}45`,
          background: C.purpleL,
          color: C.purple
        }
      }, "카카오맵"), rl.exact && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
        onClick: () => openRoute(rl.tmap),
        style: {
          padding: "7px 13px",
          borderRadius: 7,
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
          whiteSpace: "nowrap",
          border: `1px solid ${C.blue}40`,
          background: C.blueL,
          color: C.blue
        }
      }, "티맵"), /*#__PURE__*/React.createElement("button", {
        onClick: () => openRoute(rl.naver),
        style: {
          padding: "7px 13px",
          borderRadius: 7,
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
          whiteSpace: "nowrap",
          border: `1px solid ${C.green}45`,
          background: C.greenL,
          color: C.green
        }
      }, "네이버"), /*#__PURE__*/React.createElement("button", {
        onClick: () => openRoute(rl.apple),
        style: {
          padding: "7px 13px",
          borderRadius: 7,
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
          whiteSpace: "nowrap",
          border: `1px solid ${C.border}`,
          background: C.surfaceL,
          color: C.t2
        }
      }, "애플지도")), !rl.exact && /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          color: C.orange
        }
      }, "위치 미확정 — 이름으로 검색해서 열려요"));
    })(), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 6
      }
    }, picked._manual ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.green,
        fontWeight: 700
      }
    }, "🟢 직접 지정한 위치") : picked._exact ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.blue,
        fontWeight: 700
      }
    }, "🔵 찾은 위치") : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.orange,
        fontWeight: 700
      }
    }, "⚪ 위치 못 찾음 — 아래에서 지정해 주세요"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        color: C.t2
      }
    }, picked.region || "지역 미지정", " · ", picked.buildings.length, "개 동", picked.field && ` · 현장조사 ${fd(picked.field)}`, picked.end && ` · 완수 ${fd(picked.end)} (${ddL(calcDday(picked.end))})`)), (picked.assignees || []).length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: C.t3,
        marginBottom: 6
      }
    }, "👤 ", picked.assignees.join(", ")), picked.lastEdit && /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement(LastEdit, {
      s: picked,
      size: 10
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        padding: "10px 12px",
        borderRadius: 9,
        background: needPos ? C.orangeL : C.surfaceL,
        border: `1px solid ${needPos ? C.orange + "35" : C.border}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 800,
        color: needPos ? "#9A5B0A" : C.t2,
        marginBottom: 7
      }
    }, "📍 위치 지정 ", needPos && "— 이름이나 주소를 넣으면 그 자리로 옮겨요"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        marginBottom: 7
      }
    }, /*#__PURE__*/React.createElement("input", {
      value: placeQ,
      onChange: e => setPlaceQ(e.target.value),
      onKeyDown: e => {
        if (e.key === "Enter") searchPlace();
      },
      placeholder: `예: ${picked.school} 또는 도로명 주소`,
      style: {
        flex: 1,
        minWidth: 170,
        padding: "9px 11px",
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        color: C.t1,
        fontSize: 15,
        outline: "none"
      }
    }), /*#__PURE__*/React.createElement("button", {
      onClick: searchPlace,
      style: {
        padding: "9px 15px",
        borderRadius: 8,
        border: "none",
        background: C.blue,
        color: "#fff",
        fontSize: 15,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }
    }, "찾기")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        if (pickMode) {
          pickRef.current = null;
          setPickMode(false);
          setStatus("");
        } else {
          pickRef.current = picked;
          setPickMode(true);
          setStatus(`지도에서 ${picked.school} 위치를 눌러 주세요.`);
        }
      },
      style: {
        padding: "7px 13px",
        borderRadius: 7,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
        border: `1px solid ${pickMode ? C.green : C.border}`,
        background: pickMode ? C.greenL : C.surface,
        color: pickMode ? C.green : C.t2
      }
    }, pickMode ? "✋ 지도를 누르세요 (취소하려면 다시 클릭)" : "🖱 지도에서 직접 찍기"), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        const g = geo[normSchool(picked.school)];
        if (g && g.src === "manual" && !window.confirm(`${picked.school}은(는) 직접 지정한 위치예요.\n검색 결과로 덮어쓸까요?`)) return;
        runGeocode([picked.id]);
      },
      disabled: busy,
      style: {
        padding: "7px 13px",
        borderRadius: 7,
        fontSize: 14,
        fontWeight: 700,
        whiteSpace: "nowrap",
        border: `1px solid ${C.blue}40`,
        background: C.blueL,
        color: C.blue,
        cursor: busy ? "default" : "pointer"
      }
    }, "🔍 자동으로 다시 찾기"), geo[normSchool(picked.school)] && /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        saveGeo(picked.school, null);
        setStatus(`${picked.school} 저장된 위치를 지웠어요. (되돌리기 가능)`);
      },
      style: {
        padding: "7px 13px",
        borderRadius: 7,
        fontSize: 14,
        fontWeight: 700,
        whiteSpace: "nowrap",
        border: `1px solid ${C.red}40`,
        background: C.redL,
        color: C.red,
        cursor: "pointer"
      }
    }, "위치 지우기")), placeHits === "loading" && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        fontSize: 13,
        color: C.t3
      }
    }, "찾는 중…"), Array.isArray(placeHits) && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        display: "flex",
        flexDirection: "column",
        gap: 4
      }
    }, placeHits.length === 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: C.t4
      }
    }, "결과가 없어요. 주소로도 넣어 보세요."), placeHits.map((h, i) => /*#__PURE__*/React.createElement("button", {
      key: i,
      onClick: () => applyPlace(h),
      style: {
        textAlign: "left",
        padding: "8px 11px",
        borderRadius: 7,
        border: `1px solid ${C.border}`,
        background: C.surface,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: C.t1
      }
    }, h.name), h.addr && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: C.t3,
        marginTop: 1
      }
    }, h.addr))))));
  })(), editId && (() => {
    const sc2 = sites.find(x => x.id === editId);
    if (!sc2 || !cur) return null;
    return /*#__PURE__*/React.createElement(EditPanel, {
      sc: sc2,
      yr: cur.y,
      half: cur.h,
      setDb: setDb,
      onClose: () => setEditId(null),
      isMobile: isMobile
    });
  })());
}
