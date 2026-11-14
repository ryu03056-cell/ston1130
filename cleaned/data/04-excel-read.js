/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 04/18 — 엑셀 읽기  (data/04-excel-read.js)
   │ 회사 양식·LH 양식 엑셀 파일을 읽어 현장 목록으로 바꾸는 계산
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════
   엑셀 파싱 / 내보내기
   엑셀 열: 1팀 2No 3종류 4지역 5학교 6시설 7층 8연면적 9높이 10길이
            11종별 12현장조사 13착수 14완수 15기간 16FMS 17플래그
            18특기 19보고서완료(◎) 20납품 21FMS등록(◎)
══════════════════════════════════════════════════════════════ */
function parseSheetName(name) {
  /* 데이터 시트(반기) 인식 — "26년(상)", "2026년(하)", "26년 하반기", "26하", "2026 상반기" 등 다양한 형식 허용.
     단, 예산·특이사항·메모 등 데이터가 아닌 시트는 제외. */
  const s = String(name).trim();
  if (/예산|특이|비고|메모|참고|양식|템플릿|요약|sample|sheet/i.test(s)) return null;
  const m = s.match(/^(?:20)?(\d{2})\s*년?\s*[\(\[\s\-·]*([상하])(?:\s*반기)?\s*[\)\]]?\s*$/);
  if (!m) return null;
  return {
    year: `20${m[1]}`,
    half: m[2] === "상" ? "상반기" : "하반기"
  };
}
function parseExcelDate(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v)) {
    const tz = v.getTimezoneOffset() * 60000;
    return new Date(v - tz).toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const s = v.trim();
    let m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/); // YYYY-MM-DD / YYYY.MM.DD
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = s.match(/(\d{2})[-./](\d{1,2})[-./](\d{1,2})/); // YY.MM.DD → 20YY
    if (m) return `20${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return null;
}
function parseSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null
  });
  const clean = v => v == null ? "" : String(v).replace(/\u00a0/g, " ").trim();
  const norm = v => clean(v).toLowerCase().replace(/[^a-z0-9가-힣]/g, "");

  /* 1) 헤더 행 찾기 — 회사 양식은 2단(예: 2행 '학교명', 3행 '층수')이라
        위아래 두 줄을 합쳐서 한 줄처럼 본다. */
  const HKEYS = ["학교", "시설물명", "번호", "no", "지역", "착수", "준공", "완수", "현장조사", "연면적", "시설명", "동명", "특기", "점검종류", "납품", "종별", "층수", "회차"];
  let hIdx = -1,
    best = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = (rows[i] || []).map(norm);
    const score = cells.filter(c => c && HKEYS.some(k => c.includes(k))).length;
    if (score > best) {
      best = score;
      hIdx = i;
    }
  }
  if (hIdx < 0 || best < 3) return [];

  /* 헤더 두 줄 합치기 (아래줄이 세부 항목: 건축물/토목, 층수/연면적, ID/PW …) */
  const H0 = (rows[hIdx] || []).map(norm);
  const H1 = (rows[hIdx + 1] || []).map(norm);
  const twoRow = H1.filter(Boolean).length >= 3 && H1.some(h => ["층수", "연면적", "건축물", "id", "pw", "유무", "방법"].some(k => h.includes(k)));
  const width = Math.max(H0.length, H1.length);
  const H = [];
  for (let c = 0; c < width; c++) H.push(((H0[c] || "") + (twoRow ? H1[c] || "" : "")).trim());
  const dataStart = hIdx + (twoRow ? 2 : 1);

  /* 2) 열 위치 찾기 */
  const idxInc = (...keys) => H.findIndex(h => h && keys.some(k => h.includes(k)));
  const idxEq = (...keys) => H.findIndex(h => h && keys.some(k => h === k));
  const col = {
    round: idxInc("점검회차", "회차"),
    no: (() => {
      const e = idxEq("no", "번호", "no.");
      return e >= 0 ? e : idxInc("번호");
    })(),
    kind: idxInc("점검종류"),
    region: idxInc("지역"),
    school: (() => {
      const i = H.findIndex(h => h.includes("학교명") || h.includes("시설물명") && !h.includes("개수"));
      return i >= 0 ? i : idxInc("학교");
    })(),
    building: (() => {
      const e = idxEq("시설명", "동명", "시설물명");
      return e >= 0 ? e : -1;
    })(),
    cntB: idxInc("시설물개수건축물", "개수건축물"),
    cntT1: idxInc("토목종"),
    cntT2: idxInc("토목소"),
    jong: idxEq("종별"),
    floor: idxInc("층수"),
    area: idxInc("연면적"),
    length: idxInc("연장"),
    height: idxInc("높이"),
    start: idxInc("착수"),
    field: idxInc("현장조사"),
    end: idxInc("완수일", "준공"),
    deliverDate: idxInc("납품일자", "납품일"),
    doneYN: idxInc("완수유무"),
    delivYN: idxInc("납품유무"),
    delivery: idxInc("납품방법"),
    fmsId: (() => {
      const i = H.findIndex(h => h.includes("fms") && h.includes("id"));
      return i >= 0 ? i : H.findIndex(h => h.includes("fms") && h.includes("아이디"));
    })(),
    fmsPw: H.findIndex(h => h.includes("fms") && (h.includes("pw") || h.includes("비번") || h.includes("비밀"))),
    fmsD: (() => {
      const e = H.findIndex(h => h.includes("fms") && h.endsWith("완"));
      return e >= 0 ? e : idxEq("fms");
    })(),
    fms: H.findIndex(h => h.includes("fms") && h.includes("아이디") && h.includes("비")),
    flag: idxInc("드론", "피난", "위치도"),
    note: idxInc("특기"),
    memo: idxEq("비고"),
    rep: H.findIndex(h => h.includes("보고서") && h.includes("완료")),
    /* 앱 전용 열 (내보낸 파일을 다시 읽을 때) */
    assignees: idxInc("담당자"),
    tel: idxInc("연락처"),
    appFlags: idxEq("표시"),
    progress: idxInc("진행단계"),
    cat: idxEq("분류"),
    period: idxEq("조사기간"),
    tentative: idxEq("일정상태")
  };
  if (col.school < 0) return [];
  const gv = (r, i) => i == null || i < 0 ? null : r[i];
  const isMark = v => {
    const s = clean(v);
    return ["◎", "○", "●", "O", "o", "Y", "y", "V", "v", "✓"].includes(s) || v === true;
  };
  const num = v => {
    const n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : n;
  };
  const out = [];
  let cur = null;
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const school = clean(gv(r, col.school));
    const building = clean(gv(r, col.building));
    const noRaw = clean(gv(r, col.no));
    const no = noRaw && noRaw !== "-" ? noRaw : "";
    if (!school && !building && !no) continue;

    /* 학교행: 학교명이 있으면 새 현장. (회사 양식은 학교행/시설행이 분리돼 있다) */
    if (school && (!cur || school !== cur.school)) {
      const roundV = clean(gv(r, col.round));
      const fmsCombo = clean(gv(r, col.fms));
      const fid = clean(gv(r, col.fmsId)),
        fpw = clean(gv(r, col.fmsPw));
      const fms = fmsCombo || (fid ? fpw ? `${fid} // ${fpw}` : fid : "");
      const prog = {};
      clean(gv(r, col.progress)).split(",").map(x => x.trim()).filter(Boolean).forEach(k => {
        if (STEPS.includes(k)) prog[k] = true;
      });
      /* 진행단계 열이 없으면 완수·납품 유무로 최소한만 채운다 */
      if (!Object.keys(prog).length) {
        if (/완료|완수|○|◎|o/i.test(clean(gv(r, col.doneYN)))) prog["완수"] = true;
        if (/완료|납품|○|◎|o/i.test(clean(gv(r, col.delivYN)))) prog["납품"] = true;
      }
      cur = {
        id: `imp-${Date.now().toString(36)}-${out.length}-${Math.random().toString(36).slice(2, 6)}`,
        no,
        school,
        round: roundV,
        isNew: /신규/.test(roundV),
        region: clean(gv(r, col.region)),
        kind: clean(gv(r, col.kind)) || "정기점검",
        field: parseExcelDate(gv(r, col.field)),
        start: parseExcelDate(gv(r, col.start)),
        end: parseExcelDate(gv(r, col.end)),
        deliverDate: parseExcelDate(gv(r, col.deliverDate)),
        memo: clean(gv(r, col.memo)),
        tentative: /예정|미정/.test(clean(gv(r, col.tentative))),
        ...(() => {
          /* 조사기간 칸: "2026-08-10~2026-08-12,2026-08-20" 형태 */
          const p = clean(gv(r, col.period));
          if (!p) return {};
          const parts = p.split(",").map(x => x.trim()).filter(Boolean);
          const run = (parts[0] || "").split("~").map(x => x.trim());
          return {
            fieldEnd: run[1] && /^\d{4}-\d{2}-\d{2}$/.test(run[1]) ? run[1] : "",
            fieldExtra: parts.slice(1).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x))
          };
        })(),
        tel: clean(gv(r, col.tel)),
        /* 직급 순으로 정렬해서 들여온다 (엑셀에는 직급 정보가 없다) */
        assignees: sortMembers(clean(gv(r, col.assignees)).split(/[,·]/).map(x => x.trim()).filter(Boolean)),
        headcount: 2,
        progress: prog,
        buildings: [],
        flags: [],
        _fms: fms,
        _fmsD: isMark(gv(r, col.fmsD)) || clean(gv(r, col.fmsD)) === "O",
        _delivery: clean(gv(r, col.delivery)),
        _note: clean(gv(r, col.note))
      };
      cur.headcount = cur.assignees.length || 2;
      clean(gv(r, col.appFlags)).split(",").map(x => x.trim()).filter(Boolean).forEach(v => {
        if (["드론", "1년", "피난"].includes(v)) cur.flags.push(v);
      });
      out.push(cur);
    } else if (cur) {
      /* 병합 셀 탓에 아래 행에만 값이 있는 경우 보강 */
      if (no && !cur.no) cur.no = no;
      if (!cur.region) cur.region = clean(gv(r, col.region));
      if (!cur.field) cur.field = parseExcelDate(gv(r, col.field));
      if (!cur.start) cur.start = parseExcelDate(gv(r, col.start));
      if (!cur.end) cur.end = parseExcelDate(gv(r, col.end));
      if (!cur.deliverDate) cur.deliverDate = parseExcelDate(gv(r, col.deliverDate));
    }
    if (!cur) continue;

    /* 시설(동) 행 */
    if (building) {
      const names = building.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      const floors = clean(gv(r, col.floor)).split(/\r?\n/);
      const areas = clean(gv(r, col.area)).split(/\r?\n/);
      const jongV = clean(gv(r, col.jong));
      names.forEach((bn, bi) => {
        const rowKind = kindToBK(clean(gv(r, col.kind)));
        cur.buildings.push({
          b: bn,
          kind: rowKind,
          cat: (() => {
            const cv = clean(gv(r, col.cat));
            return cv === "건축" || cv === "토목종" || cv === "토목소" ? cv : guessCat(bn, jongV);
          })(),
          floor: (floors[bi] != null ? floors[bi] : floors[0] || "").trim() || null,
          area: num(areas[bi] != null ? areas[bi] : areas[0] || ""),
          height: col.height >= 0 ? clean(gv(r, col.height)) || null : null,
          len: col.length >= 0 ? clean(gv(r, col.length)) || null : null,
          jong: jongV || null,
          fms: bi === 0 && cur.buildings.length === 0 ? cur._fms || null : null,
          note: clean(gv(r, col.note)) || null,
          rep: isMark(gv(r, col.rep)) || !!(cur.progress && cur.progress["보고서"]),
          fmsD: !!cur._fmsD,
          delivery: cur._delivery || null
        });
        const fv = clean(gv(r, col.flag));
        if (fv) {
          if (/드론|●|○|◎/.test(fv) && !cur.flags.includes("드론")) cur.flags.push("드론");
          if (/1년|일년/.test(fv) && !cur.flags.includes("1년")) cur.flags.push("1년");
          if (/피난/.test(fv) && !cur.flags.includes("피난")) cur.flags.push("피난");
        }
      });
    }
  }
  /* 시설이 하나도 없으면 학교명으로 기본 동 하나 */
  const out2 = out.filter(s => s.school);
  out2.forEach(s => {
    if (!s.buildings.length) s.buildings.push({
      b: s.school,
      /* 시설 행이 없어 학교명으로 만든 기본 동 — 이름만으로 토목으로 단정하지 않는다 */
      cat: "건축",
      kind: kindToBK(s.kind),
      floor: null,
      area: null,
      height: null,
      len: null,
      jong: null,
      fms: s._fms || null,
      note: s._note || null,
      rep: !!(s.progress && s.progress["보고서"]),
      fmsD: !!s._fmsD,
      delivery: s._delivery || null
    });
    delete s._fms;
    delete s._fmsD;
    delete s._delivery;
    delete s._note;
  });
  return out2;
}
/* ── LH 아파트 정밀점검 시트 파서 ──
   학교 양식과 열 구성이 달라 별도로 읽는다. 단지명으로 묶고 시설물명(101동 등)을 동으로,
   관리사무소를 전화번호로, 현장점검을 현장조사일, 정밀안전점검 도래시기를 완수일로 매핑. */
function parseLHDate(v) {
  if (v instanceof Date && !isNaN(v)) {
    const q = n => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${q(v.getMonth() + 1)}-${q(v.getDate())}`;
  }
  const t = String(v == null ? "" : v).replace(/\u00a0/g, " ").trim();
  if (!t) return null;
  const q = n => String(parseInt(n, 10)).padStart(2, "0");
  /* 한 칸에 여러 날짜(줄바꿈·슬래시·물결)가 있으면 첫 날짜만 사용 */
  let m = t.match(/(\d{4})\s*[-.\/]\s*(\d{1,2})\s*[-.\/]\s*(\d{1,2})/); // 2026-03-18
  if (m) return `${m[1]}-${q(m[2])}-${q(m[3])}`;
  m = t.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/); // 3/19/26 (월/일/년)
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return `${y}-${q(m[1])}-${q(m[2])}`;
  }
  const n = Number(t); // 엑셀 일련번호
  if (!isNaN(n) && n > 20000 && n < 60000) {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (!isNaN(d)) return `${d.getUTCFullYear()}-${q(d.getUTCMonth() + 1)}-${q(d.getUTCDate())}`;
  }
  return null;
}
function parseLHSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: false
  });
  const cl = v => v == null ? "" : String(v).replace(/\u00a0/g, " ").trim();
  const nz = v => cl(v).toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
  const hIdx = rows.findIndex(r => (r || []).some(c => nz(c).includes("단지명")));
  if (hIdx < 0) return [];
  const H = (rows[hIdx] || []).map(nz);
  const idx = (...keys) => H.findIndex(h => h && keys.some(k => h.includes(k)));
  const col = {
    gubun: idx("구분"),
    complex: idx("단지명"),
    loc: idx("위치"),
    b: idx("시설물명"),
    area: idx("연면적"),
    floor: idx("층수"),
    type: idx("유형"),
    tel: idx("관리사무소"),
    fms: H.findIndex(h => h.includes("fms") && h.includes("아이디")),
    field: idx("현장점검"),
    defect: idx("결함조사"),
    equip: idx("장비조사"),
    due: idx("도래시기"),
    who: idx("담당팀", "담당자")
  };
  if (col.complex < 0) return [];
  const shortRegion = a => {
    const m = String(a || "").match(/([가-힣]{2,4})시|([가-힣]{2,4})군/);
    return m ? m[1] || m[2] : "";
  };
  const splitNames = v => cl(v).split(/[,·\/]/).map(x => x.trim()).filter(Boolean);
  const num = v => {
    const n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : n;
  };
  const gv = (r, i) => i == null || i < 0 ? null : r[i];
  const out = [];
  let cur = null;
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const name = cl(gv(r, col.complex));
    const bname = cl(gv(r, col.b));
    if (!name && !bname) continue;
    if (name && (!cur || cur.school !== name)) {
      cur = {
        id: `lh-${Date.now().toString(36)}-${out.length}-${Math.random().toString(36).slice(2, 6)}`,
        no: cl(gv(r, col.gubun)),
        school: name,
        region: shortRegion(gv(r, col.loc)),
        addr: cl(gv(r, col.loc)),
        kind: "정밀점검",
        tel: cl(gv(r, col.tel)),
        field: parseLHDate(gv(r, col.field)),
        start: parseLHDate(gv(r, col.defect)),
        // 결함조사
        end: parseLHDate(gv(r, col.due)),
        // 정밀안전점검 도래시기
        assignees: splitNames(gv(r, col.who)),
        headcount: 2,
        buildings: [],
        flags: [],
        progress: {},
        lh: true
      };
      cur.headcount = cur.assignees.length || 2;
      out.push(cur);
    }
    if (!cur) continue;
    /* 병합 셀 탓에 아래 행에만 값이 있는 경우 보강 */
    if (!cur.tel) cur.tel = cl(gv(r, col.tel));
    if (!cur.field) cur.field = parseLHDate(gv(r, col.field));
    if (!cur.start) cur.start = parseLHDate(gv(r, col.defect));
    if (!cur.end) cur.end = parseLHDate(gv(r, col.due));
    if (!cur.region) cur.region = shortRegion(gv(r, col.loc));
    if (!cur.assignees.length) cur.assignees = splitNames(gv(r, col.who));
    if (bname) {
      const fmsRaw = cl(gv(r, col.fms));
      const bits = [];
      const ty = cl(gv(r, col.type));
      if (ty) bits.push(`유형 ${ty}`);
      const eq = cl(gv(r, col.equip));
      if (eq) bits.push(`장비조사 ${eq}`);
      cur.buildings.push({
        b: bname,
        floor: cl(gv(r, col.floor)) || null,
        area: num(gv(r, col.area)),
        height: null,
        len: null,
        jong: null,
        fms: fmsRaw && fmsRaw !== '"' ? fmsRaw : null,
        // " 는 윗행과 같다는 표시
        note: bits.join(" · ") || null,
        rep: false,
        fmsD: false,
        delivery: null
      });
    }
  }
  return out.filter(s => s.school && s.buildings.length);
}
