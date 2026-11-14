/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 10/18 — 엑셀 관리 화면  (screens/10-excel-page.js)
   │ 엑셀 가져오기/내보내기 화면
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════
   엑셀 가져오기 / 내보내기 페이지
══════════════════════════════════════════════════════════════ */
function ExportImportPage({
  db,
  setDb,
  saveNow,
  notes
}) {
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);
  const [autoCarry, setAutoCarry] = useState(true); // 상반기 완수일 7월+ → 하반기 자동 추가
  const [carryInfo, setCarryInfo] = useState(null);
  const [saveResult, setSaveResult] = useState(null); // 가져오기 후 서버 저장 결과 {ok,err,total}
  const fileRef = useRef();
  const processFile = file => {
    setErr(null);
    setParsed(null);
    setDone(false);
    if (!file) return;
    const r = new FileReader();
    r.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, {
          type: "array",
          cellDates: true
        });
        /* 1) 예산 시트 → 연도별 { 학교명: 금액(원) } */
        const budgetByYear = {};
        wb.SheetNames.forEach(name => {
          const ym = name.match(/(\d{2})\s*년/);
          if (!/예산/.test(name) || !ym) return;
          const yr = `20${ym[1]}`;
          const bud = parseBudget(wb.Sheets[name]);
          if (Object.keys(bud).length) budgetByYear[yr] = {
            ...(budgetByYear[yr] || {}),
            ...bud
          };
        });
        /* 2) 특이사항 시트 → 연도/반기별 노트 목록 */
        const notesByHalf = {};
        wb.SheetNames.forEach(name => {
          const m = name.match(/(\d{2})년\s*\(\s*([상하])\s*\)\s*특이사항/);
          if (!m) return;
          const yr = `20${m[1]}`,
            hf = m[2] === "상" ? "상반기" : "하반기";
          const ns = parseNotes(wb.Sheets[name]);
          if (ns.length) {
            (notesByHalf[yr] = notesByHalf[yr] || {})[hf] = ns;
          }
        });
        /* 3) 반기 시트 → 학교 목록 (+ 예산 매칭 + 특이사항 병합) */
        const sheets = [];
        wb.SheetNames.forEach(name => {
          const info = parseSheetName(name);
          if (!info) return;
          const schools = parseSheet(wb.Sheets[name]);
          if (!schools.length) return;
          const bud = budgetByYear[info.year] || {};
          let budHit = 0;
          schools.forEach(s => {
            const bd = bud[s.school];
            if (bd) {
              s.contract = bd.total;
              budHit++;
              (s.buildings || []).forEach((b, bi) => {
                if (bd.items[bi] != null && bd.items[bi] > 0) b.budget = bd.items[bi];
              }); // 시설별 금액(순서 매칭)
            }
          });
          const noteHit = applyNotes(schools, notesByHalf[info.year] && notesByHalf[info.year][info.half]);
          sheets.push({
            name,
            year: info.year,
            half: info.half,
            schools,
            count: schools.length,
            bCount: schools.reduce((a, s) => a + s.buildings.length, 0),
            budHit,
            noteHit
          });
        });
        /* 4) LH 정밀 시트 → LH 전용 구분으로 (학교와 따로 관리) */
        wb.SheetNames.forEach(name => {
          if (!/lh/i.test(name)) return;
          if (/예산|특이|메모/.test(name)) return;
          const lhs = parseLHSheet(wb.Sheets[name]);
          if (!lhs.length) return;
          sheets.push({
            name,
            year: CAT_LH,
            half: "정밀",
            schools: lhs,
            count: lhs.length,
            bCount: lhs.reduce((a, s) => a + s.buildings.length, 0),
            budHit: 0,
            noteHit: 0,
            isLH: true
          });
        });
        if (!sheets.length) {
          setErr('인식된 시트가 없어요. 시트 이름이 "26년(상)", "26년(하)", "26년 하반기" 같은 형식이거나, LH 시트에 "단지명" 열이 있는지 확인해주세요.');
          return;
        }
        setParsed({
          sheets,
          fileName: file.name,
          budYears: Object.keys(budgetByYear)
        });
      } catch (e) {
        setErr("파일 읽기 오류: " + e.message);
      }
    };
    r.readAsArrayBuffer(file);
  };

  /* 기존 학교에 가져온 학교를 병합 — 학교명+No 기준으로 매칭.
     엑셀 값(일정·학교정보·동·예산)은 갱신, 웹 전용 값(진행단계·투입인원)은 보존.
     매칭 안 되는 기존 학교는 그대로 유지 → 중복/꼬임 없이 '바뀐 부분만' 반영. */
  const mergeHalf = (existing, incoming) => {
    const ex = existing || [];
    const keyOf = s => `${(s.school || "").trim()}|${(s.no || "").toString().trim()}`;
    const nameOf = s => (s.school || "").replace(/\s+/g, "").trim();
    const exMap = new Map();
    ex.forEach(s => {
      if (!exMap.has(keyOf(s))) exMap.set(keyOf(s), s);
    });
    const usedIds = new Set();
    /* 기존 기록 찾기 — No는 반기마다 새로 매겨지므로 1순위 실패 시 학교명으로 재시도.
       (이월본이 하반기 엑셀 데이터와 중복되던 원인) */
    const takeOld = ins => {
      const exact = exMap.get(keyOf(ins));
      if (exact && !usedIds.has(exact.id)) return exact;
      const cands = ex.filter(s => nameOf(s) === nameOf(ins) && !usedIds.has(s.id));
      if (!cands.length) return null;
      return cands.find(s => s.carried) || cands[0]; // 이월본을 먼저 소진 → 실제 데이터로 대체
    };
    const merged = incoming.map(ins => {
      const old = takeOld(ins);
      if (old) {
        usedIds.add(old.id);
        return {
          ...ins,
          id: old.id,
          // 안정적 ID 유지
          progress: old.progress || {},
          // 진행단계(웹 전용) 보존
          assignees: ins.assignees && ins.assignees.length ? ins.assignees : old.assignees || [],
          headcount: old.headcount || ins.headcount || 2,
          contract: ins.contract != null && ins.contract > 0 ? ins.contract : old.contract ?? null,
          // 예산 갱신/보존
          tel: (ins.tel || "").trim() || old.tel || "",
          // 연락처(웹에서 입력) 보존
          flags: ins.flags && ins.flags.length ? ins.flags : old.flags || []
        };
      }
      return ins; // 신규 학교
    });
    const leftovers = ex.filter(s => !usedIds.has(s.id)); // 엑셀에 없던 기존 학교 → 유지
    return {
      merged: merged.concat(leftovers),
      matched: usedIds.size,
      added: incoming.length - usedIds.size,
      kept: leftovers.length
    };
  };
  const doImport = () => {
    if (!parsed) return;
    setImporting(true);
    /* 가져오기 전 상태를 통째로 백업 — 잘못 올려도 되돌릴 수 있게 */
    makeSnapshot(db, "엑셀 가져오기 전").catch(() => {});
    setTimeout(() => {
      let carryReport = [];
      /* 현재 db 기준으로 최종 결과(next) 계산 */
      const next = {
        ...(db || {})
      };
      parsed.sheets.forEach(sh => {
        next[sh.year] = {
          ...(next[sh.year] || {})
        };
        const {
          merged
        } = mergeHalf(next[sh.year][sh.half], sh.schools);
        next[sh.year][sh.half] = merged;
      });
      /* 상반기 완수일이 7월 이후(같은 해 하반기)인 현장 → 하반기에 자동 추가 (날짜·진행 그대로 이월) */
      if (autoCarry) {
        Object.keys(next).forEach(yr => {
          const first = next[yr]?.["상반기"] || [];
          if (!first.length) return;
          const carry = first.filter(s => {
            if (!s.end) return false;
            const ey = String(s.end).slice(0, 4);
            const mo = parseInt(String(s.end).slice(5, 7), 10);
            return ey === String(yr) && mo >= 7 && mo <= 12;
          });
          if (!carry.length) return;
          /* No는 반기마다 새로 매겨지므로 학교명(표기 차이 무시)으로 대조해야 이월본과 실제 데이터가 안 겹친다 */
          const nameOf = normSchool;
          let dest = dedupeBucket(next[yr]["하반기"] || []);
          const realNames = new Set(dest.filter(d => !d.carried).map(nameOf));
          const carriedByName = new Map(dest.filter(d => d.carried).map(d => [nameOf(d), d]));
          let n = 0,
            ci = 0;
          carry.forEach(s => {
            const nm = nameOf(s);
            if (realNames.has(nm)) return; // 하반기에 실제 데이터가 있으면 이월하지 않음
            const fresh = {
              ...s,
              carried: true,
              progress: {},
              // 진행단계 초기화
              /* 신규는 그 반기에 처음 들어온 현장이라는 뜻이다.
                 이월본은 지난 반기에 이미 있던 곳이므로 신규가 아니다. */
              isNew: false,
              round: "",
              /* 상반기 날짜를 그대로 끌고 오면 하반기 달력이 어긋난다 → 비운다 */
              field: "",
              fieldEnd: "",
              fieldExtra: [],
              fieldWho: null,
              start: "",
              deliverDate: "",
              end: "",
              tentative: false,
              buildings: (s.buildings || []).map(b => ({
                ...b,
                rep: false,
                fmsD: false,
                delivery: null
              })) // 보고서·FMS·납품 미완으로
            };
            const prev = carriedByName.get(nm);
            if (prev) {
              /* 이미 하반기에서 손본 값(날짜·인원·상태)은 지우지 않는다.
                 상반기 정보만 새로 반영하고 나머지는 그대로 둔다. */
              carriedByName.set(nm, {
                ...fresh,
                id: prev.id,
                assignees: prev.assignees || fresh.assignees,
                field: prev.field || "",
                fieldEnd: prev.fieldEnd || "",
                fieldExtra: toArr(prev.fieldExtra),
                fieldWho: prev.fieldWho || null,
                start: prev.start || "",
                deliverDate: prev.deliverDate || "",
                end: prev.end || "",
                tentative: prev.tentative !== undefined ? prev.tentative : true,
                progress: prev.progress || {},
                memo: prev.memo || fresh.memo || ""
              });
              n++;
            } // 기존 이월본 갱신(id·인원·하반기 입력값 유지)
            else {
              const add = {
                ...fresh,
                id: `carry-${Date.now().toString(36)}-${(ci++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`
              };
              carriedByName.set(nm, add);
              n++;
            }
          });
          if (n) {
            next[yr]["하반기"] = dest.filter(d => !d.carried).concat(Array.from(carriedByName.values()));
            carryReport.push({
              yr,
              n
            });
          } else if (dest.length !== (next[yr]["하반기"] || []).length) {
            next[yr]["하반기"] = dest; // 중복 이월본만 정리된 경우
          }
        });
      }

      /* 가져온 결과 전체를 자동 중복 정리 (같은 현장이 두 번 올라가지 않게) */
      const beforeCnt = countSchools(next);
      Object.keys(next).forEach(yr => {
        next[yr] = {
          ...next[yr]
        };
        Object.keys(next[yr] || {}).forEach(hf => {
          next[yr][hf] = dedupeBucket(next[yr][hf] || []);
        });
      });
      const dedupRemoved = beforeCnt - countSchools(next);
      setDb(next); // 화면 반영
      parsed.sheets.forEach(sh => logAction("수정", `엑셀 병합 · ${sh.year} ${sh.half}`, null, `${sh.count}개 학교 / ${sh.bCount}개 동${sh.budHit ? ` / 예산 ${sh.budHit}건` : ""}${sh.noteHit ? ` / 특이사항 ${sh.noteHit}건` : ""}`));
      carryReport.forEach(c => logAction("추가", `하반기 자동 이월 · ${c.yr}`, null, `상반기 완수일 7월 이후 ${c.n}개 → 하반기`));
      setCarryInfo(carryReport.length ? carryReport : null);

      /* 자동 effect에 의존하지 않고, 여기서 직접 서버에 저장하고 결과 확인 */
      const finish = (ok, err) => {
        setImporting(false);
        setDone(true);
        setParsed(null);
        setSaveResult({
          ok,
          err,
          total: countSchools(next),
          dedup: dedupRemoved
        });
      };
      if (saveNow) {
        Promise.resolve(saveNow(next)).then(() => finish(true)).catch(e => finish(false, e && e.message || String(e)));
      } else {
        finish(true);
      }
    }, 400);
  };
  const doExport = (yr, half) => {
    /* 휴지통(삭제 표시) 현장은 내보내지 않는다 */
    const schools = (db[yr]?.[half] || []).filter(s => !s.deleted);
    if (!schools.length) return;
    const wb = XLSX.utils.book_new();
    const sn = `${yr.slice(2)}년(${half === "상반기" ? "상" : "하"})`;
    const entries = [{
      yr,
      half,
      schools
    }];
    XLSX.utils.book_append_sheet(wb, buildSheet(schools), sn); // 시설물 리스트
    /* 일정이 있는 달마다 달력 시트를 만든다 (원본의 '9월달력' 형식) */
    calMonths(entries).forEach(m => XLSX.utils.book_append_sheet(wb, buildCalendarSheet(entries, m, sn, dataRowCount(schools), notes), `${m.m}월달력`));
    XLSX.utils.book_append_sheet(wb, buildScheduleSheet(entries), "현장일정(목록)"); // 현장일정(목록)
    XLSX.utils.book_append_sheet(wb, buildBudgetSheet(entries), "예산표"); // 예산표
    XLSX.utils.book_append_sheet(wb, buildNotesSheet(entries), "특이사항"); // 특이사항
    XLSX.writeFile(wb, `시설물_리스트_${yr}_${half}.xlsx`);
  };
  const doExportAll = () => {
    const wb = XLSX.utils.book_new();
    const entries = [];
    Object.entries(db).forEach(([yr, hs]) => Object.entries(hs).forEach(([half, arr]) => {
      /* 휴지통 현장 제외 */
      const schools = (arr || []).filter(s => !s.deleted);
      if (!schools.length) return;
      XLSX.utils.book_append_sheet(wb, buildSheet(schools), `${yr.slice(2)}년(${half === "상반기" ? "상" : "하"})`);
      entries.push({
        yr,
        half,
        schools
      });
    }));
    if (!entries.length) return;
    /* 시트가 여러 개일 땐 가장 큰 반기 시트에 연결한다 */
    const main = entries.slice().sort((a, b) => (b.schools || []).length - (a.schools || []).length)[0];
    const mainName = main ? `${String(main.yr).slice(2)}년(${main.half === "상반기" ? "상" : "하"})` : null;
    calMonths(entries).forEach(m => XLSX.utils.book_append_sheet(wb, buildCalendarSheet(entries, m, mainName, main ? dataRowCount(main.schools) : 0, notes), `${m.m}월달력`));
    XLSX.utils.book_append_sheet(wb, buildScheduleSheet(entries), "현장일정(목록)"); // 전체 현장일정(목록)
    XLSX.utils.book_append_sheet(wb, buildBudgetSheet(entries), "예산표"); // 전체 예산표
    XLSX.utils.book_append_sheet(wb, buildNotesSheet(entries), "특이사항"); // 전체 특이사항
    XLSX.writeFile(wb, "시설물_리스트_전체.xlsx");
  };
  /* 인원 배치 엑셀 — 어느 날 누가 어디로 나갔는지 (별도 기능) */
  const doExportCrew = () => {
    const entries = [];
    Object.entries(db).forEach(([yr, hs]) => Object.entries(hs).forEach(([half, arr]) => {
      const schools = (arr || []).filter(s => !s.deleted);
      if (schools.length) entries.push({ yr, half, schools });
    }));
    const recs = crewRecords(entries);
    if (!recs.length) {
      alert("내보낼 현장조사 배치가 없습니다.");
      return;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, crewSheetByDate(recs), "일자별 배치");
    XLSX.utils.book_append_sheet(wb, crewSheetByBuilding(crewBldRecords(entries)), "동별 담당");
    XLSX.utils.book_append_sheet(wb, crewSheetByPerson(recs), "인원별 기록");
    XLSX.utils.book_append_sheet(wb, crewSheetSummary(recs), "인원 집계");
    XLSX.writeFile(wb, `인원_배치기록_${dstr(new Date())}.xlsx`);
  };
  /* 동별 점검 인원 JSON (별도 기능) — 전체 · 주별 · 월별 */
  const [crewJsonMonth, setCrewJsonMonth] = useState("all");
  const crewJsonMonths = useMemo(() => {
    const months = new Set(), weeks = new Set();
    Object.values(db || {}).forEach(hs => Object.values(hs || {}).forEach(arr => (arr || []).forEach(s => {
      if (!s || s.deleted) return;
      surveyDates(s).forEach(ds => {
        if (!whoOnDate(s, ds).length) return;
        months.add(String(ds).slice(0, 7));
        weeks.add(crewWeekMon(ds));
      });
    })));
    return { months: [...months].sort().reverse(), weeks: [...weeks].sort().reverse() };
  }, [db]);
  const doExportCrewJson = () => {
    const entries = [];
    Object.entries(db).forEach(([yr, hs]) => Object.entries(hs).forEach(([half, arr]) => {
      const schools = (arr || []).filter(s => !s.deleted);
      if (schools.length) entries.push({ yr, half, schools });
    }));
    const range = crewJsonRange(crewJsonMonth);
    const data = crewJsonData(entries, range);
    if (!data.sites.length) {
      alert(range ? `${range.label} 에는 내보낼 현장조사 인원이 없습니다.` : "내보낼 현장조사 인원이 없습니다.");
      return;
    }
    downloadJson(data, range ? `동별_점검인원_${range.file}.json` : `동별_점검인원_전체_${dstr(new Date())}.json`);
  };
  /* 완수용 캘린더 — 완수일 5일 전(주말·공휴일이면 앞 평일) 목표 달력 (별도 기능) */
  const doExportWansu = () => {
    const entries = [];
    Object.entries(db).forEach(([yr, hs]) => Object.entries(hs).forEach(([half, arr]) => {
      const schools = (arr || []).filter(s => !s.deleted);
      if (schools.length) entries.push({ yr, half, schools });
    }));
    const wb = buildWansuWorkbook(entries);
    if (!wb) {
      alert("완수일이 잡힌 미완수 현장이 없습니다.");
      return;
    }
    XLSX.writeFile(wb, `완수용_캘린더_${dstr(new Date())}.xlsx`);
  };
  const totalS = Object.values(db).flatMap(h => Object.values(h)).flatMap(s => s).length;
  const totalB = Object.values(db).flatMap(h => Object.values(h)).flatMap(s => s).flatMap(s => s.buildings).length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      letterSpacing: 2,
      fontWeight: 600,
      marginBottom: 3
    }
  }, "IMPORT / EXPORT"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 22,
      fontWeight: 800,
      color: C.t1
    }
  }, "엑셀 가져오기 · 내보내기"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.t3,
      marginTop: 4
    }
  }, "기존 엑셀을 올리면 팀·연도·상하반기를 자동 인식해서 반영해요")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 10,
      marginBottom: 24
    }
  }, [{
    l: "저장된 학교",
    v: totalS,
    c: C.blue
  }, {
    l: "저장된 동",
    v: totalB,
    c: C.green
  }, {
    l: "관리 기간",
    v: Object.values(db).flatMap(h => Object.keys(h)).length,
    c: C.orange
  }].map(x => /*#__PURE__*/React.createElement("div", {
    key: x.l,
    style: {
      padding: "14px 16px",
      background: C.surface,
      border: BD,
      borderTop: `2px solid ${x.c}`,
      borderRadius: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: x.c
    }
  }, x.v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      marginTop: 4
    }
  }, x.l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: BD,
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: "0 2px 10px rgba(0,0,0,.05)",
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 20px",
      borderBottom: BD,
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20
    }
  }, "📥"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: C.t1
    }
  }, "엑셀 업로드"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      marginTop: 1
    }
  }, "시트 이름이 \"26년(상)\" 형식이면 자동 인식"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, !parsed && !done && /*#__PURE__*/React.createElement("div", {
    onDragOver: e => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: e => {
      e.preventDefault();
      setDragOver(false);
      processFile(e.dataTransfer.files[0]);
    },
    onClick: () => fileRef.current?.click(),
    style: {
      padding: "36px 20px",
      borderRadius: 12,
      cursor: "pointer",
      textAlign: "center",
      border: `2px dashed ${dragOver ? C.blue : C.borderD}`,
      background: dragOver ? C.blueL : C.surfaceL,
      transition: "all .15s"
    }
  }, /*#__PURE__*/React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: ".xlsx,.xls",
    style: {
      display: "none"
    },
    onChange: e => processFile(e.target.files[0])
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36,
      marginBottom: 10
    }
  }, "📂"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: dragOver ? C.blue : C.t1,
      marginBottom: 4
    }
  }, dragOver ? "여기에 놓으세요!" : "엑셀 파일을 드래그하거나 클릭"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3
    }
  }, ".xlsx / .xls · 기존 엑셀 그대로 올리면 돼요")), parsed && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
      padding: "10px 14px",
      background: C.greenL,
      borderRadius: 8,
      border: `1px solid ${C.green}30`
    }
  }, /*#__PURE__*/React.createElement("span", null, "✓"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: C.green
    }
  }, parsed.fileName, " 파싱 완료"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t2,
      marginTop: 1
    }
  }, parsed.sheets.length, "개 시트 인식", parsed.budYears && parsed.budYears.length ? ` · 예산표 ${parsed.budYears.join(",")} 인식` : "", " · 확인 후 가져오기")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setParsed(null),
    style: {
      padding: "4px 10px",
      borderRadius: 6,
      border: BD,
      background: "transparent",
      color: C.t3,
      fontSize: 13,
      cursor: "pointer"
    }
  }, "취소")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 7,
      marginBottom: 12,
      padding: "9px 12px",
      background: C.blueL,
      borderRadius: 8,
      border: `1px solid ${C.blue}25`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15
    }
  }, "🔄"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t2,
      lineHeight: 1.55
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.blue
    }
  }, "병합 방식"), " — 학교명+No로 같은 현장을 찾아 ", /*#__PURE__*/React.createElement("b", null, "일정·동·예산만 갱신"), "하고, 웹에서 입력한 ", /*#__PURE__*/React.createElement("b", null, "진행단계·투입인원은 그대로 유지"), "해요. 중복으로 쌓이지 않아요.")), parsed.sheets.map((sh, i) => {
    const hc = sh.half === "상반기" ? C.blue : C.orange;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        padding: "14px 16px",
        background: C.surfaceL,
        borderRadius: 10,
        border: `1px solid ${hc}30`,
        borderLeft: `3px solid ${hc}`,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("span", null, sh.half === "상반기" ? "🌱" : "🍂"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        fontWeight: 800,
        color: C.t1
      }
    }, sh.year, "년 ", sh.half), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 10,
        background: hc + "18",
        color: hc,
        fontWeight: 700
      }
    }, sh.count, "개 학교 · ", sh.bCount, "개 동"), sh.budHit > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 10,
        background: C.green + "18",
        color: C.green,
        fontWeight: 700
      }
    }, "💰 예산 ", sh.budHit, "건"), sh.noteHit > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 10,
        background: C.yellow + "22",
        color: "#9A7B0A",
        fontWeight: 700
      }
    }, "📝 특이사항 ", sh.noteHit, "건")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 3
      }
    }, sh.schools.slice(0, 10).map(s => /*#__PURE__*/React.createElement("span", {
      key: s.id,
      style: {
        fontSize: 12,
        color: C.t2,
        padding: "1px 6px",
        borderRadius: 3,
        background: C.surface,
        border: BD
      }
    }, s.school)), sh.schools.length > 10 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.t4,
        padding: "1px 6px"
      }
    }, "+", sh.schools.length - 10, "개")));
  }), (() => {
    const carryCount = parsed.sheets.filter(sh => sh.half === "상반기").reduce((a, sh) => a + sh.schools.filter(s => {
      if (!s.end) return false;
      const ey = String(s.end).slice(0, 4);
      const mo = parseInt(String(s.end).slice(5, 7), 10);
      return ey === String(sh.year) && mo >= 7 && mo <= 12;
    }).length, 0);
    return /*#__PURE__*/React.createElement("label", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 14px",
        background: autoCarry ? C.orange + "0e" : C.surfaceL,
        border: `1px solid ${autoCarry ? C.orange + "50" : C.border}`,
        borderRadius: 10,
        cursor: "pointer",
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      onClick: () => setAutoCarry(v => !v),
      style: {
        width: 38,
        height: 22,
        borderRadius: 11,
        background: autoCarry ? C.orange : C.borderD,
        position: "relative",
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        top: 2,
        left: autoCarry ? 18 : 2,
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
      onClick: () => setAutoCarry(v => !v)
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 800,
        color: C.t1
      }
    }, "🍂 상반기 완수일 7월 이후 → 하반기 자동 추가 ", carryCount > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.orange
      }
    }, "(", carryCount, "개)")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: C.t3,
        marginTop: 2,
        lineHeight: 1.5
      }
    }, autoCarry ? "1년 계약 등 하반기까지 이어지는 현장을 하반기에도 자동 등록해요 (날짜는 유지, 보고서·FMS·납품은 미완으로)" : "자동 추가 안 함")));
  })(), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setParsed(null),
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
    onClick: doImport,
    style: {
      flex: 2,
      padding: 11,
      borderRadius: 9,
      background: C.blue,
      border: "none",
      color: "#fff",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: `0 4px 14px ${C.blue}40`,
      opacity: importing ? .7 : 1
    }
  }, importing ? "가져오는 중..." : "✓ 웹에 가져오기 · 현장관리 자동 반영"))), done && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: 24,
      background: saveResult && !saveResult.ok ? C.redL : C.greenL,
      borderRadius: 10,
      border: `1px solid ${saveResult && !saveResult.ok ? C.red : C.green}30`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 28,
      marginBottom: 8
    }
  }, saveResult && !saveResult.ok ? "⚠️" : "✅"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: saveResult && !saveResult.ok ? C.red : C.green,
      marginBottom: 4
    }
  }, saveResult && !saveResult.ok ? "화면 반영됨 · 서버 저장 실패" : "가져오기 + 서버 저장 완료!"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.t2,
      marginBottom: 10
    }
  }, saveResult && !saveResult.ok ? "데이터는 화면에 있지만 서버에 저장되지 않았어요. 아래 오류를 확인하세요." : `서버에 ${saveResult ? saveResult.total : countSchools(db)}개 학교 저장됨 · 껐다 켜도 유지돼요`), saveResult && !saveResult.ok && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-block",
      fontSize: 13,
      color: C.red,
      background: C.surface,
      border: `1px solid ${C.red}40`,
      borderRadius: 8,
      padding: "8px 12px",
      marginBottom: 14,
      maxWidth: "90%",
      wordBreak: "break-all"
    }
  }, "❌ ", saveResult.err), saveResult && saveResult.dedup > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "block",
      fontSize: 13,
      color: C.blue,
      background: C.blueL,
      border: `1px solid ${C.blue}40`,
      borderRadius: 8,
      padding: "8px 12px",
      marginBottom: 10,
      maxWidth: "90%",
      marginLeft: "auto",
      marginRight: "auto"
    }
  }, "🧹 중복 현장 ", saveResult.dedup, "건 자동 정리 (같은 학교가 두 번 올라가지 않게 합쳤어요)"), carryInfo && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "block",
      fontSize: 13,
      color: "#9A5B0A",
      background: C.orange + "18",
      border: `1px solid ${C.orange}40`,
      borderRadius: 8,
      padding: "8px 12px",
      marginBottom: 16,
      maxWidth: "90%",
      marginLeft: "auto",
      marginRight: "auto"
    }
  }, "🍂 자동 이월: ", carryInfo.map(c => `${c.yr}년 하반기 +${c.n}개`).join(" · ")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setDone(false);
      setCarryInfo(null);
      setSaveResult(null);
    },
    style: {
      padding: "8px 20px",
      borderRadius: 8,
      border: `1px solid ${C.green}`,
      background: "transparent",
      color: C.green,
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "다른 파일 올리기"))), err && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 16px",
      background: C.redL,
      borderRadius: 9,
      border: `1px solid ${C.red}30`,
      marginTop: 12,
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", null, "⚠"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 14,
      color: C.red
    }
  }, err), /*#__PURE__*/React.createElement("button", {
    onClick: () => setErr(null),
    style: {
      background: "transparent",
      border: "none",
      color: C.red,
      fontSize: 17,
      cursor: "pointer"
    }
  }, "×")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      padding: "12px 14px",
      background: C.surfaceL,
      borderRadius: 8,
      border: BD
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: C.t2,
      marginBottom: 7
    }
  }, "📋 자동 인식 컬럼"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 5,
      flexWrap: "wrap"
    }
  }, ["시트명 26년(상)/(하)·하반기·26하", "1열 팀", "5열 학교", "6열 시설", "12열 현장조사", "14열 완수", "16열 FMS", "17열 플래그", "18열 특기", "19열 보고서◎", "20열 납품", "21열 FMS◎"].map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      fontSize: 12,
      padding: "2px 7px",
      borderRadius: 4,
      background: C.surface,
      border: BD,
      color: C.t2
    }
  }, t)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: BD,
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: "0 2px 10px rgba(0,0,0,.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 20px",
      borderBottom: BD,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20
    }
  }, "📤"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: C.t1
    }
  }, "엑셀 내보내기"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.t3,
      marginTop: 1
    }
  }, "현장일정 · 예산표 · 특이사항 시트로 저장"))), /*#__PURE__*/React.createElement("div", {
    style: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: doExportAll,
    style: {
      padding: "9px 18px",
      background: C.green,
      border: "none",
      borderRadius: 9,
      color: "#fff",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: `0 4px 12px ${C.green}40`
    }
  }, "↗ 전체 다운로드"), /*#__PURE__*/React.createElement("button", {
    onClick: doExportCrew,
    title: "어느 날 누가 어느 현장에 나갔는지 (일자별 · 인원별 · 집계)",
    style: {
      padding: "9px 16px",
      background: C.blue,
      border: "none",
      borderRadius: 9,
      color: "#fff",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: `0 4px 12px ${C.blue}40`
    }
  }, "\uD83D\uDC65 인원 배치"), /*#__PURE__*/React.createElement("button", {
    onClick: doExportCrewJson,
    title: "동별로 누가 점검했는지 JSON 파일로",
    style: {
      padding: "9px 16px",
      background: "#334155",
      border: "none",
      borderRadius: 9,
      color: "#fff",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: "0 4px 12px #33415540"
    }
  }, "{ } 동별 인원 JSON"), /*#__PURE__*/React.createElement("select", {
    value: crewJsonMonth,
    onChange: e => setCrewJsonMonth(e.target.value),
    title: "JSON으로 뺄 기간 (주는 월~일)",
    style: {
      padding: "8px 10px",
      border: "1px solid #334155",
      borderRadius: 9,
      fontSize: 14,
      fontWeight: 700,
      color: "#334155",
      background: "#fff",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "전체 기간"), /*#__PURE__*/React.createElement("optgroup", {
    label: "주별 (월~일)"
  }, crewJsonMonths.weeks.map(w => {
    const sun = dstr(addDays(parseD(w), 6));
    const thisWeek = w === crewWeekMon(dstr(new Date()));
    return /*#__PURE__*/React.createElement("option", {
      key: "w" + w,
      value: "w:" + w
    }, `${+w.slice(5, 7)}/${+w.slice(8, 10)}(월) ~ ${+sun.slice(5, 7)}/${+sun.slice(8, 10)}(일)${thisWeek ? " · 이번 주" : ""}`);
  })), /*#__PURE__*/React.createElement("optgroup", {
    label: "월별"
  }, crewJsonMonths.months.map(m => /*#__PURE__*/React.createElement("option", {
    key: "m" + m,
    value: "m:" + m
  }, `${m.slice(0, 4)}년 ${+m.slice(5, 7)}월`)))), /*#__PURE__*/React.createElement("button", {
    onClick: doExportWansu,
    title: "완수일 5일 전을 목표일로 (토·일·공휴일이면 앞 평일로 당김)",
    style: {
      padding: "9px 16px",
      background: C.purple,
      border: "none",
      borderRadius: 9,
      color: "#fff",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: `0 4px 12px ${C.purple}40`
    }
  }, "\u2705 완수용 캘린더"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, Object.entries(db).sort((a, b) => b[0] - a[0]).flatMap(([yr, hs]) => Object.entries(hs).map(([half, schools]) => {
    const hc = isLH(yr) ? C.purple : half === "상반기" ? C.blue : C.orange,
      bC = schools.flatMap(s => s.buildings).length,
      rep = schools.flatMap(s => s.buildings).filter(b => b.rep).length;
    return /*#__PURE__*/React.createElement("div", {
      key: `${yr}-${half}`,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        background: C.surfaceL,
        borderRadius: 10,
        border: `1px solid ${hc}25`,
        borderLeft: `3px solid ${hc}`
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 19
      }
    }, isLH(yr) ? "🏢" : half === "상반기" ? "🌱" : "🍂"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: C.t1
      }
    }, isLH(yr) ? "🏢 LH 정밀" : `${yr}년 ${half}`), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.t3,
        marginTop: 2
      }
    }, schools.length, "개 ", isLH(yr) ? "단지" : "학교", " · ", bC, "개 동 · ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.purple
      }
    }, "보고서 ", rep, "/", bC))), /*#__PURE__*/React.createElement("button", {
      onClick: () => doExport(yr, half),
      style: {
        padding: "8px 16px",
        borderRadius: 8,
        background: hc + "15",
        border: `1px solid ${hc}40`,
        color: hc,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }
    }, "↗ 다운로드"));
  })))));
}
