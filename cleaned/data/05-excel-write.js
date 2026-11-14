/* ┌──────────────────────────────────────────────────────────────
   │ STON 정리본 05/18 — 엑셀 만들기  (data/05-excel-write.js)
   │ 시설물 리스트·예산·인원 투입·완수 목표·일정·달력 시트를 만들어 내보내는 계산
   │ ※ index.cleaned.html 이 번호 순서대로 불러옵니다. 순서를 바꾸면 안 됩니다.
   └────────────────────────────────────────────────────────────── */
function xlHalfLabel(yr, half) {
  return `${String(yr).slice(2)}년(${half === "상반기" ? "상" : "하"})`;
}
function xlDate(v) {
  if (!v) return "";
  const p = String(v).split("-").map(Number);
  return p.length === 3 && p[0] ? new Date(p[0], p[1] - 1, p[2], 12) : "";
}
/* ══════════════════════════════════════════════════════════════
   시설물 리스트 시트 — 회사 표준 양식 그대로
   · 1행: 색 범례 / 2~3행: 2단 헤더 / 4행부터 데이터
   · 학교 정보는 '학교행'에, 시설물은 그 아래 '시설행'에 한 줄씩
   · A~Z 는 원본 양식, AB~AF 는 앱 전용 정보(담당자·진행 등)
══════════════════════════════════════════════════════════════ */
const XL_FONT = "맑은 고딕";
/* 원본 파일에서 직접 추출한 색 (테마색 + tint 를 실제 RGB 로 환산) */
const XLC = {
  /* 26년(하) 1행 범례 — 테마색을 실제 RGB 로 환산한 값 */
  legendContract: "FFFEE9D8",
  // 계약완료 (연주황)
  legendField: "FFE7EAEA",
  // 현장조사완료 (연회색)
  legendDeliver: "FFA6A6A6",
  // 납품완료 (회색)
  /* 달력 시트에서 실제로 칠해진 색 (원본에 rgb 로 직접 지정돼 있음) */
  calDone: "FFFEF3FF",
  // 완수 (연보라)
  calField: "FFE7EAEA",
  // 현장조사 (연회색)
  calDeliver: "FFEBF7FF",
  // 납품 (연하늘)
  header: "FFD9D9D9",
  // 날짜(구분) 행 배경
  line: "FF000000",
  sat: "FF0070C0",
  sun: "FFFF0000"
};
/* 달력 시트 글꼴 — 원본과 동일 (없는 PC 에서는 맑은 고딕으로 대체된다) */
const CAL_FONT = "KoddiUD 온고딕 ExtraBold";
const CAL_FONT_B = "KoddiUD 온고딕 Bold";
const xlBorder = (top, bottom) => ({
  top: {
    style: top,
    color: {
      rgb: XLC.line
    }
  },
  bottom: {
    style: bottom || top,
    color: {
      rgb: XLC.line
    }
  },
  left: {
    style: "thin",
    color: {
      rgb: XLC.line
    }
  },
  right: {
    style: "thin",
    color: {
      rgb: XLC.line
    }
  }
});
function buildSheet(schools) {
  /* 원본 양식 A~Z + 앱 전용 AB~AF */
  const HEAD1 = ["점검\n회차", "No.", "점검\n종류", "지역", "학교명", "시설물명", "시설물 개수", null, null, "종별", "건축", null, "옹벽/사면", null, "착수일", "현장조사일", "완수일", "납품일자", "완수\n유무", "납품", null, "FMS", null, null, "특기사항", "비고", null, "담당자", "연락처", "표시", "진행단계", "진행률", "분류", "조사기간", "일정상태"];
  const HEAD2 = [null, null, null, null, null, null, "건축물", "토목(종)", "토목(소)", null, "층수", "연면적(m²)", "연장(m)", "높이(m)", null, null, null, null, null, "유무", "방법", "ID", "PW", "완", null, null, null, null, null, null, null, null, null, null, null];
  const nC = HEAD1.length;
  const aoa = [];
  /* 1행 — 색 범례 (원본과 동일 위치) */
  const r0 = new Array(nC).fill("");
  r0[3] = "계약완료";
  r0[4] = "현장조사완료";
  r0[5] = "납품완료";
  aoa.push(r0);
  aoa.push(HEAD1.map(v => v == null ? "" : v));
  aoa.push(HEAD2.map(v => v == null ? "" : v));
  const mkDate = v => {
    if (!v) return "";
    const p = String(v).split("-").map(Number);
    return p.length === 3 && p[0] ? new Date(p[0], p[1] - 1, p[2], 12) : "";
  };
  const rows = []; // {r, kind:'school'|'bld', last}
  schools.forEach(s => {
    const cc = catCounts(s);
    const done = siteDone(s);
    const deliv = siteDelivered(s);
    const pg = s.progress || {};
    const prog = STEPS.filter(k => pg[k]);
    /* FMS 는 첫 시설의 계정을 학교행에 올린다 (원본 양식과 동일) */
    const fms = String((s.buildings || []).map(b => b.fms).find(Boolean) || "");
    const fmsPart = fms.split("//").map(x => x.trim());
    const notes = (s.buildings || []).map(b => b.note).filter(Boolean).join(" / ");
    const schoolRow = new Array(nC).fill("");
    schoolRow[0] = isNewSite(s) ? "신규" : s.round || "-";
    schoolRow[1] = s.no || "";
    /* 점검종류는 동별 값에서 만든다. 여러 종류면 쉼표로 이어 붙인다 (예: 정밀,정기) */
    schoolRow[2] = (() => {
      const ks = [];
      (s.buildings || []).forEach(b => {
        const k = bldKind(b) || kindToBK(s.kind);
        if (k && !ks.includes(k)) ks.push(k);
      });
      return ks.length ? ks.join(",") : s.kind || "정기";
    })();
    schoolRow[3] = s.region || "";
    schoolRow[4] = s.school || "";
    schoolRow[6] = cc.건축 || "";
    schoolRow[7] = cc.토목종 || "";
    schoolRow[8] = cc.토목소 || "";
    schoolRow[14] = mkDate(s.start);
    schoolRow[15] = mkDate(s.field);
    schoolRow[16] = mkDate(s.end);
    schoolRow[17] = mkDate(s.deliverDate);
    schoolRow[18] = done ? "완료" : "미완";
    schoolRow[19] = deliv ? "완료" : "미납";
    schoolRow[20] = (s.buildings || []).map(b => b.delivery).find(Boolean) || "";
    schoolRow[21] = fmsPart[0] || "";
    schoolRow[22] = fmsPart[1] || "";
    schoolRow[23] = (s.buildings || []).every(b => b.fmsD) && (s.buildings || []).length ? "O" : "";
    schoolRow[24] = notes;
    schoolRow[25] = s.memo || "";
    /* 앱 전용 (AB~AF) */
    /* AA열 — 달력 시트가 FILTER 로 끌어가는 표시 문자열 (원본과 동일한 수식) */
    schoolRow[26] = null; // 수식은 아래에서 직접 넣는다
    schoolRow[27] = sortMembers(s.assignees).join(", ");
    schoolRow[28] = s.tel || "";
    schoolRow[29] = getFlags(s).join(",");
    schoolRow[30] = prog.join(",");
    schoolRow[31] = `${prog.length}/${STEPS.length}`;
    /* 조사가 여러 날이면 P열은 첫날만 두고(달력 수식이 날짜 하나를 비교하므로)
       전체 일정은 이 칸에 따로 적는다. */
    const sd = surveyDates(s);
    schoolRow[34] = isTentative(s) ? "예정" : "확정";
    schoolRow[33] = sd.length > 1 ? `${s.fieldEnd && s.fieldEnd > s.field ? `${s.field}~${s.fieldEnd}` : s.field}${(s.fieldExtra || []).length ? `,${(s.fieldExtra || []).join(",")}` : ""}` : "";
    rows.push({
      r: aoa.length,
      kind: "school"
    });
    aoa.push(schoolRow);
    /* 학교명과 같은 이름의 단일 동은 원본에 시설 행이 없던 경우 → 그대로 생략 */
    const bs = (s.buildings || []).length === 1 && (s.buildings[0].b || "").trim() === (s.school || "").trim() && !s.buildings[0].floor && s.buildings[0].area == null ? [] : s.buildings || [];
    bs.forEach(b => {
      const br = new Array(nC).fill("");
      br[2] = bldKind(b) || kindToBK(s.kind);
      br[5] = b.b || "";
      br[9] = b.jong || "";
      br[10] = b.floor || "";
      br[11] = b.area != null && b.area !== "" && !isNaN(Number(b.area)) ? Number(b.area) : "";
      br[12] = b.len || "";
      br[13] = b.height || "";
      br[24] = b.note || "";
      br[32] = bldCat(b); // 시설 분류 (앱 전용)
      rows.push({
        r: aoa.length,
        kind: "bld"
      });
      aoa.push(br);
    });
    if (rows.length) rows[rows.length - 1].last = true; // 학교 블록의 마지막 줄
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa, {
    cellDates: true
  });
  /* 열 너비 — 원본 값 */
  ws["!cols"] = [4.6, 4.6, 12.6, 5.6, 29.5, 29, 6.6, 6.6, 6.6, 10.6, 8.6, 8.6, 8.6, 8.6, 10.6, 10.6, 10.6, 10.6, 4.6, 5.6, 5.6, 12.6, 12.6, 4.6, 45.6, 12, 2, 16, 13, 10, 22, 6, 8, 22, 9].map(w => ({
    wch: Math.max(1, w - 0.8)
  }));
  /* 시설물 행은 접어 둔다 — 왼쪽 [+] 버튼으로 펼쳐 볼 수 있게 (원본과 동일) */
  ws["!rows"] = aoa.map((_, i) => {
    const row = rows.find(x => x.r === i);
    return row && row.kind === "bld" ? {
      hpt: 20.1,
      level: 1,
      hidden: true
    } : {
      hpt: 20.1
    };
  });
  /* 2단 헤더 병합 (원본과 동일) */
  const M = (r1, c1, r2, c2) => ({
    s: {
      r: r1,
      c: c1
    },
    e: {
      r: r2,
      c: c2
    }
  });
  ws["!merges"] = [M(1, 0, 2, 0), M(1, 1, 2, 1), M(1, 2, 2, 2), M(1, 3, 2, 3), M(1, 4, 2, 4), M(1, 5, 2, 5), M(1, 6, 1, 8), M(1, 9, 2, 9), M(1, 10, 1, 11), M(1, 12, 1, 13), M(1, 14, 2, 14), M(1, 15, 2, 15), M(1, 16, 2, 16), M(1, 17, 2, 17), M(1, 18, 2, 18), M(1, 19, 1, 20), M(1, 21, 1, 23), M(1, 24, 2, 24), M(1, 25, 2, 25), M(1, 27, 2, 27), M(1, 28, 2, 28), M(1, 29, 2, 29), M(1, 30, 2, 30), M(1, 31, 2, 31), M(1, 32, 2, 32), M(1, 33, 2, 33), M(1, 34, 2, 34)];
  /* 헤더 3줄 고정 — 스크롤해도 항목명이 보이게 */
  ws["!freeze"] = {
    xSplit: 0,
    ySplit: 3,
    topLeftCell: "A4",
    activePane: "bottomLeft",
    state: "frozen"
  };
  ws["!views"] = [{
    state: "frozen",
    xSplit: 0,
    ySplit: 3,
    topLeftCell: "A4",
    activePane: "bottomLeft"
  }];
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: {
        r: 1,
        c: 0
      },
      e: {
        r: Math.max(3, aoa.length - 1),
        c: nC - 1
      }
    })
  };
  /* AA열 수식 — 학교행마다 "No. 지역 학교명 (건축/토목종/토목소) - 완수/납품" 을 만든다.
     달력 시트가 이 값을 날짜로 걸러서 가져간다. */
  rows.forEach(row => {
    if (row.kind !== "school") return;
    const n = row.r + 1; // 엑셀 행번호(1-based)
    const a = XLSX.utils.encode_cell({
      r: row.r,
      c: 26
    });
    ws[a] = {
      t: "s",
      f: `B${n}&". "&D${n}&" "&E${n}&" ("&G${n}&"/"&H${n}&"/"&I${n}&")"&" - "&S${n}&"/"&T${n}`
    };
  });
  const put = (r, c, st) => {
    const a = XLSX.utils.encode_cell({
      r,
      c
    });
    if (!ws[a]) ws[a] = {
      t: "s",
      v: ""
    };
    ws[a].s = st;
  };
  /* 1행 범례 — 원본의 세 가지 색 */
  const LEGEND = {
    3: XLC.legendContract,
    4: XLC.legendField,
    5: XLC.legendDeliver
  };
  for (let c = 0; c < nC; c++) put(0, c, LEGEND[c] ? {
    font: {
      name: XL_FONT,
      sz: 10
    },
    alignment: {
      horizontal: "center",
      vertical: "center"
    },
    fill: {
      patternType: "solid",
      fgColor: {
        rgb: LEGEND[c]
      }
    }
  } : {
    font: {
      name: XL_FONT,
      sz: 10
    }
  });
  /* 2~3행 헤더 */
  for (let r = 1; r <= 2; r++) for (let c = 0; c < nC; c++) put(r, c, {
    font: {
      name: XL_FONT,
      sz: r === 2 ? 8 : 10,
      // 3행(세부 항목)은 8pt
      bold: true,
      color: {
        rgb: "FF000000"
      }
    },
    alignment: {
      horizontal: "center",
      vertical: "center",
      wrapText: true
    },
    border: xlBorder("thin"),
    fill: {
      patternType: "solid",
      fgColor: {
        rgb: XLC.header
      }
    }
  });
  /* 데이터 — 학교행은 굵게, 시설행은 보통 */
  const LEFT = new Set([4, 5, 24, 25, 27]);
  const DATE_C = new Set([14, 15, 16, 17]);
  rows.forEach(row => {
    const isSchool = row.kind === "school";
    for (let c = 0; c < nC; c++) {
      const a = XLSX.utils.encode_cell({
        r: row.r,
        c
      });
      if (!ws[a]) ws[a] = {
        t: "s",
        v: ""
      };
      ws[a].s = {
        font: {
          name: XL_FONT,
          sz: 10,
          bold: isSchool && (c === 1 || c === 4),
          color: {
            rgb: "FF000000"
          }
        },
        alignment: {
          horizontal: LEFT.has(c) ? "left" : "center",
          vertical: "center",
          wrapText: c === 24
        },
        border: xlBorder(row.kind === "school" ? "thin" : "hair", row.last ? "thin" : "hair")
      };
      if (DATE_C.has(c) && ws[a].t === "d") ws[a].z = "mm-dd-yy";
      if (c === 11 && typeof ws[a].v === "number") ws[a].z = "#,##0.00";
    }
  });
  return ws;
}

/* 범용 스타일 표 — headers:[…], rows:[[…]], meta:[{align,date,num,bold,wrap,team,w}], opts:{totalRow} */
function buildAuxSheet(headers, rows, meta, opts = {}) {
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa, {
    cellDates: true
  });
  const nC = headers.length,
    last = aoa.length - 1;
  ws["!cols"] = meta.map(m => ({
    wch: m.w || 12
  }));
  ws["!rows"] = [{
    hpt: 26
  }];
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: {
        r: 0,
        c: 0
      },
      e: {
        r: 0,
        c: nC - 1
      }
    })
  };
  ws["!freeze"] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen"
  };
  for (let c = 0; c < nC; c++) {
    const a = XLSX.utils.encode_cell({
      r: 0,
      c
    });
    if (!ws[a]) ws[a] = {
      t: "s",
      v: headers[c]
    };
    ws[a].s = {
      font: {
        name: "맑은 고딕",
        sz: 10,
        bold: true,
        color: {
          rgb: "FFFFFFFF"
        }
      },
      fill: {
        patternType: "solid",
        fgColor: {
          rgb: "FF1D6FF2"
        }
      },
      alignment: {
        horizontal: "center",
        vertical: "center",
        wrapText: true
      },
      border: {
        top: {
          style: "thin",
          color: {
            rgb: "FF1559C9"
          }
        },
        bottom: {
          style: "medium",
          color: {
            rgb: "FF1559C9"
          }
        },
        left: {
          style: "thin",
          color: {
            rgb: "FF4D8AE8"
          }
        },
        right: {
          style: "thin",
          color: {
            rgb: "FF4D8AE8"
          }
        }
      }
    };
  }
  for (let r = 1; r <= last; r++) {
    const totalRow = opts.totalRow && r === last;
    /* 데이터 행은 색 없이 흰 배경 · 검정 글자 (헤더만 색) */
    for (let c = 0; c < nC; c++) {
      const m = meta[c] || {};
      const a = XLSX.utils.encode_cell({
        r,
        c
      });
      if (!ws[a]) ws[a] = {
        t: "s",
        v: ""
      };
      let fill = "FFFFFFFF";
      let font = {
        name: "맑은 고딕",
        sz: 9.5,
        color: {
          rgb: "FF1A2332"
        }
      };
      if (totalRow) font = {
        ...font,
        bold: true
      };else if (m.bold || m.num) font = {
        ...font,
        bold: true
      };
      ws[a].s = {
        font,
        fill: {
          patternType: "solid",
          fgColor: {
            rgb: fill
          }
        },
        alignment: {
          vertical: m.wrap ? "top" : "center",
          horizontal: m.align || "center",
          wrapText: !!m.wrap
        },
        border: {
          top: {
            style: "thin",
            color: {
              rgb: "FFE3E8F0"
            }
          },
          bottom: {
            style: "thin",
            color: {
              rgb: "FFEDF0F5"
            }
          },
          left: {
            style: "thin",
            color: {
              rgb: "FFE3E8F0"
            }
          },
          right: {
            style: "thin",
            color: {
              rgb: "FFE3E8F0"
            }
          }
        }
      };
      if (m.date && ws[a].t === "d") ws[a].z = "yyyy-mm-dd";
      if (m.num && typeof ws[a].v === "number") ws[a].z = "#,##0";
    }
  }
  return ws;
}

/* 예산표 시트 — entries:[{yr,half,schools}] */
function buildBudgetSheet(entries) {
  const HEAD = ["연도", "담당자", "지역", "학교명", "시설명", "시설 예산(원)", "학교 합계(원)"];
  const nC = HEAD.length;
  const aoa = [HEAD];
  const blocks = [];
  let grand = 0;
  entries.forEach(({
    yr,
    half,
    schools
  }) => (schools || []).forEach(s => {
    const bs = s.buildings && s.buildings.length ? s.buildings : [{
      b: s.school || "본관"
    }];
    const startRow = aoa.length;
    const total = Number(s.contract) || 0;
    grand += total;
    bs.forEach((b, bi) => {
      const first = bi === 0;
      const ba = b.budget != null && b.budget !== "" ? Number(b.budget) : "";
      aoa.push([first ? xlHalfLabel(yr, half) : "", first ? sortMembers(s.assignees).join(", ") : "", first ? s.region || "" : "", first ? s.school || "" : "", b.b || "", isNaN(ba) ? "" : ba, first ? total || "" : ""]);
    });
    blocks.push({
      startRow,
      rows: bs.length
    });
  }));
  aoa.push(["합계", "", "", "", "", "", grand]);
  const ws = XLSX.utils.aoa_to_sheet(aoa, {
    cellDates: true
  });
  const last = aoa.length - 1;
  ws["!cols"] = [11, 8, 8, 26, 24, 16, 16].map(w => ({
    wch: w
  }));
  ws["!rows"] = [{
    hpt: 28
  }];
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: {
        r: 0,
        c: 0
      },
      e: {
        r: 0,
        c: nC - 1
      }
    })
  };
  ws["!freeze"] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen"
  };
  const SCHOOL_COLS = [0, 1, 2, 3, 6];
  const LEFT_COLS = new Set([3, 4]);
  /* 헤더 */
  for (let c = 0; c < nC; c++) {
    const a = XLSX.utils.encode_cell({
      r: 0,
      c
    });
    if (!ws[a]) ws[a] = {
      t: "s",
      v: HEAD[c]
    };
    ws[a].s = {
      font: {
        name: "맑은 고딕",
        sz: 10,
        bold: true,
        color: {
          rgb: "FFFFFFFF"
        }
      },
      fill: {
        patternType: "solid",
        fgColor: {
          rgb: "FF1D6FF2"
        }
      },
      alignment: {
        horizontal: "center",
        vertical: "center",
        wrapText: true
      },
      border: {
        top: {
          style: "thin",
          color: {
            rgb: "FF1559C9"
          }
        },
        bottom: {
          style: "medium",
          color: {
            rgb: "FF1559C9"
          }
        },
        left: {
          style: "thin",
          color: {
            rgb: "FF4D8AE8"
          }
        },
        right: {
          style: "thin",
          color: {
            rgb: "FF4D8AE8"
          }
        }
      }
    };
  }
  /* 합계 행 */
  for (let c = 0; c < nC; c++) {
    const a = XLSX.utils.encode_cell({
      r: last,
      c
    });
    if (!ws[a]) ws[a] = {
      t: "s",
      v: ""
    };
    ws[a].s = {
      font: {
        name: "맑은 고딕",
        sz: 10,
        bold: true,
        color: {
          rgb: "FF1A2332"
        }
      },
      fill: {
        patternType: "solid",
        fgColor: {
          rgb: "FFFFFFFF"
        }
      },
      alignment: {
        horizontal: c === 6 ? "right" : "center",
        vertical: "center"
      },
      border: {
        top: {
          style: "medium",
          color: {
            rgb: "FFC2CCDC"
          }
        },
        bottom: {
          style: "medium",
          color: {
            rgb: "FFC2CCDC"
          }
        },
        left: {
          style: "thin",
          color: {
            rgb: "FFE3E8F0"
          }
        },
        right: {
          style: "thin",
          color: {
            rgb: "FFE3E8F0"
          }
        }
      }
    };
    if (c === 6 && typeof ws[a].v === "number") ws[a].z = "#,##0";
  }
  /* 데이터 블록 */
  blocks.forEach(bk => {
    for (let ri = 0; ri < bk.rows; ri++) {
      const r = bk.startRow + ri;
      const lastOfSchool = ri === bk.rows - 1;
      for (let c = 0; c < nC; c++) {
        const a = XLSX.utils.encode_cell({
          r,
          c
        });
        if (!ws[a]) ws[a] = {
          t: "s",
          v: ""
        };
        /* 데이터 행은 색 없이 흰 배경 · 검정 글자 (헤더만 색) */
        let fill = "FFFFFFFF",
          font = {
            name: "맑은 고딕",
            sz: 9.5,
            color: {
              rgb: "FF1A2332"
            }
          };
        if (c === 3 || c === 6) font = {
          ...font,
          bold: true
        };
        ws[a].s = {
          font,
          fill: {
            patternType: "solid",
            fgColor: {
              rgb: fill
            }
          },
          alignment: {
            vertical: SCHOOL_COLS.includes(c) ? "center" : "top",
            horizontal: LEFT_COLS.has(c) ? "left" : c === 5 || c === 6 ? "right" : "center"
          },
          border: {
            top: {
              style: "thin",
              color: {
                rgb: "FFE3E8F0"
              }
            },
            bottom: {
              style: lastOfSchool ? "medium" : "thin",
              color: {
                rgb: lastOfSchool ? "FFC2CCDC" : "FFEDF0F5"
              }
            },
            left: {
              style: "thin",
              color: {
                rgb: "FFE3E8F0"
              }
            },
            right: {
              style: "thin",
              color: {
                rgb: "FFE3E8F0"
              }
            }
          }
        };
        if ((c === 5 || c === 6) && typeof ws[a].v === "number") ws[a].z = "#,##0";
      }
    }
    if (bk.rows > 1) {
      ws["!merges"] = ws["!merges"] || [];
      SCHOOL_COLS.forEach(c => ws["!merges"].push({
        s: {
          r: bk.startRow,
          c
        },
        e: {
          r: bk.startRow + bk.rows - 1,
          c
        }
      }));
    }
  });
  return ws;
}

/* 특이사항 시트 — entries:[{yr,half,schools}] */
function buildNotesSheet(entries) {
  const headers = ["연도", "담당자", "학교명", "시설명", "특기사항"];
  const meta = [{
    align: "center",
    w: 11
  }, {
    align: "center",
    team: true,
    w: 8
  }, {
    align: "left",
    bold: true,
    w: 22
  }, {
    align: "left",
    w: 20
  }, {
    align: "left",
    wrap: true,
    w: 62
  }];
  const rows = [];
  entries.forEach(({
    yr,
    half,
    schools
  }) => (schools || []).forEach(s => (s.buildings || []).forEach(b => {
    if (b.note && String(b.note).trim()) rows.push([xlHalfLabel(yr, half), sortMembers(s.assignees).join(", "), s.school || "", b.b || "", b.note]);
  })));
  if (!rows.length) rows.push(["", "", "", "", "특이사항이 입력된 현장이 없습니다."]);
  return buildAuxSheet(headers, rows, meta);
}

/* 현장일정 시트 — 학교별 현장조사·착수·완수일 + 담당자, 일정 순 정렬. entries:[{yr,half,schools}] */
/* ── 인원 배치 엑셀 (기존 내보내기와 완전히 분리된 별도 기능) ──
   어느 날 누가 어느 현장에 나갔는지를 세 장으로 뽑는다.
   기존 buildSheet / buildScheduleSheet 등에는 손대지 않는다. */
const CREW_DOW = ["일", "월", "화", "수", "목", "금", "토"];
function crewDow(ds) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ds || "");
  if (!m) return "";
  return CREW_DOW[new Date(+m[1], +m[2] - 1, +m[3]).getDay()];
}
/* 한 줄 = 그 날 · 그 현장 · 그 사람 하나 */
function crewRecords(entries) {
  const out = [];
  (entries || []).forEach(({ yr, half, schools }) => {
    (schools || []).filter(s => s && !s.deleted).forEach(s => {
      surveyDates(s).forEach(ds => {
        const who = sortMembers(whoOnDate(s, ds));
        if (!who.length) return;
        const bs = buildingsOnDate(s, ds);
        const kinds = [];
        bs.forEach(b => {
          const k = b && b.kind;
          if (k && !kinds.includes(k)) kinds.push(k);
        });
        who.forEach(name => {
          const mine = bs.filter(b => bldWhoOf(s, b.b).includes(name)).map(b => b.b);
          out.push({
            yr, half, ds,
            dow: crewDow(ds),
            region: s.region || "",
            school: s.school || "",
            kind: kinds.join(", "),
            bcount: bs.length,
            name,
            duty: mine.length ? mine.join(", ") : bs.length > 1 ? "전체" : (bs[0] && bs[0].b) || "",
            tentative: s.tentative ? "예정" : "확정",
            crew: who.join(", "),
            crewN: who.length
          });
        });
      });
    });
  });
  return out.sort((a, b) => a.ds.localeCompare(b.ds) || a.school.localeCompare(b.school) || byRank(a.name, b.name));
}
function crewSheetByDate(recs) {
  const seen = new Map();
  recs.forEach(r => {
    const k = r.ds + "|" + r.school;
    if (!seen.has(k)) seen.set(k, r);
  });
  const rows = [["날짜", "요일", "지역", "학교명", "점검종류", "동수", "인원수", "인원", "확정"]];
  [...seen.values()].forEach(r => rows.push([r.ds, r.dow, r.region, r.school, r.kind, r.bcount, r.crewN, r.crew, r.tentative]));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 5 }, { wch: 9 }, { wch: 26 }, { wch: 16 }, { wch: 6 }, { wch: 7 }, { wch: 34 }, { wch: 7 }];
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  return ws;
}
/* 동별 담당 — 한 줄 = 그날 · 그 현장 · 그 동 하나 */
function crewBldRecords(entries) {
  const out = [];
  (entries || []).forEach(({ schools }) => {
    (schools || []).filter(s => s && !s.deleted).forEach(s => {
      surveyDates(s).forEach(ds => {
        const who = sortMembers(whoOnDate(s, ds));
        if (!who.length) return;
        const bs = buildingsOnDate(s, ds);
        bs.forEach(b => {
          const own = sortMembers(bldWhoOf(s, b.b));
          out.push({
            ds, dow: crewDow(ds),
            region: s.region || "",
            school: s.school || "",
            bld: b.b || "",
            size: (typeof bldSize === "function" ? bldSize(b) : "") || "",
            kind: b.kind || "",
            who: own.length ? own.join(", ") : who.join(", "),
            how: own.length ? "동 담당" : "전체",
            tentative: s.tentative ? "예정" : "확정"
          });
        });
        /* 협의 담당도 한 줄로 남긴다 */
        const con = sortMembers(consultOf(s));
        if (con.length) out.push({
          ds, dow: crewDow(ds),
          region: s.region || "",
          school: s.school || "",
          bld: "협의", size: "", kind: "",
          who: con.join(", "), how: "협의",
          tentative: s.tentative ? "예정" : "확정"
        });
      });
    });
  });
  return out.sort((a, b) => a.ds.localeCompare(b.ds) || a.school.localeCompare(b.school) || a.bld.localeCompare(b.bld));
}
function crewSheetByBuilding(rows) {
  const aoa = [["날짜", "요일", "지역", "학교명", "동", "규모", "점검종류", "담당", "배정", "확정"]];
  rows.forEach(r => aoa.push([r.ds, r.dow, r.region, r.school, r.bld, r.size, r.kind, r.who, r.how, r.tentative]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 12 }, { wch: 5 }, { wch: 9 }, { wch: 26 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 9 }, { wch: 7 }];
  return ws;
}

function crewSheetByPerson(recs) {
  const rows = [["인원", "날짜", "요일", "지역", "학교명", "담당 동", "확정"]];
  recs.slice().sort((a, b) => byRank(a.name, b.name) || a.ds.localeCompare(b.ds) || a.school.localeCompare(b.school)).forEach(r => rows.push([r.name, r.ds, r.dow, r.region, r.school, r.duty, r.tentative]));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 10 }, { wch: 12 }, { wch: 5 }, { wch: 9 }, { wch: 26 }, { wch: 24 }, { wch: 7 }];
  return ws;
}
function crewSheetSummary(recs) {
  const months = [];
  recs.forEach(r => {
    const m = r.ds.slice(0, 7);
    if (m && !months.includes(m)) months.push(m);
  });
  months.sort();
  const per = new Map();
  recs.forEach(r => {
    if (!per.has(r.name)) per.set(r.name, { days: new Set(), visits: 0, mon: {} });
    const p = per.get(r.name);
    p.days.add(r.ds);
    p.visits++;
    const m = r.ds.slice(0, 7);
    if (!p.mon[m]) p.mon[m] = new Set();
    p.mon[m].add(r.ds);
  });
  const rows = [["인원", "출장 일수", "현장 방문 건수", ...months.map(m => `${+m.slice(5)}월`)]];
  [...per.keys()].sort(byRank).forEach(n => {
    const p = per.get(n);
    rows.push([n, p.days.size, p.visits, ...months.map(m => p.mon[m] ? p.mon[m].size : 0)]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 10 }, { wch: 10 }, { wch: 14 }, ...months.map(() => ({ wch: 7 }))];
  return ws;
}

/* ── 동별 점검 인원 JSON (기존 내보내기와 완전히 분리된 별도 기능) ──
   현장 하나 = 학교 하나, 그 안에 동별로 누가 점검했는지.
   동 담당을 정했으면 그 사람들, 안 정했으면 그날 간 인원 전체(assigned:false). */
function crewJsonData(entries, range) {
  /* range = { from, to } 이면 그 기간 조사일만 (주별·월별), 없으면 전체 */
  const inMonth = ds => !range || String(ds) >= range.from && String(ds) <= range.to;
  const sites = [];
  (entries || []).forEach(({ yr, half, schools }) => {
    (schools || []).filter(s => s && !s.deleted).forEach(s => {
      const dates = [];
      const crewAll = new Set();
      const bmap = new Map();
      surveyDates(s).filter(inMonth).forEach(ds => {
        const who = sortMembers(whoOnDate(s, ds));
        if (!who.length) return;
        dates.push({ date: ds, dow: crewDow(ds), crew: who });
        who.forEach(n => crewAll.add(n));
        buildingsOnDate(s, ds).forEach(b => {
          const key = b.b || "";
          if (!bmap.has(key)) {
            const own = sortMembers(bldWhoOf(s, key));
            bmap.set(key, {
              name: key,
              category: bldCat(b),
              kind: b.kind || "",
              size: (typeof bldSize === "function" ? bldSize(b) : "") || "",
              dates: [],
              assigned: own.length > 0,
              inspectors: own.slice(),
              _day: new Set()
            });
          }
          const e = bmap.get(key);
          if (!e.dates.includes(ds)) e.dates.push(ds);
          if (!e.assigned) who.forEach(n => e._day.add(n));
        });
      });
      if (!dates.length) return;
      const buildings = [...bmap.values()].map(e => {
        const { _day, ...rest } = e;
        if (!rest.assigned) rest.inspectors = sortMembers([..._day]);
        return rest;
      });
      sites.push({
        year: yr,
        half,
        no: String(s.no || "").trim(),
        region: s.region || "",
        school: s.school || "",
        status: s.tentative ? "예정" : "확정",
        surveyDates: dates,
        crew: sortMembers([...crewAll]),
        consult: sortMembers(consultOf(s)),
        buildings
      });
    });
  });
  sites.sort((a, b) => (a.surveyDates[0].date || "").localeCompare(b.surveyDates[0].date || "") || a.school.localeCompare(b.school));
  return {
    exportedAt: new Date().toISOString(),
    exportedBy: typeof CURRENT_USER !== "undefined" && (CURRENT_USER.name || CURRENT_USER.email) || "",
    note: "buildings[].assigned=true 면 동 담당으로 정한 인원, false 면 그날 현장에 간 인원 전체",
    siteCount: sites.length,
    period: range ? { from: range.from, to: range.to, label: range.label || "" } : "전체",
    sites
  };
}
/* 기간 선택값 → { from, to, label } . "w:2026-10-05" = 그 월요일부터 일요일까지, "m:2026-10" = 그 달 */
function crewJsonRange(v) {
  if (!v || v === "all") return null;
  if (v.startsWith("w:")) {
    const mon = v.slice(2);
    const sun = dstr(addDays(parseD(mon), 6));
    return { from: mon, to: sun, label: `${mon} ~ ${sun}`, file: `${mon}_주간` };
  }
  if (v.startsWith("m:")) {
    const ym = v.slice(2);
    const last = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
    return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}`, label: `${+ym.slice(0, 4)}년 ${+ym.slice(5, 7)}월`, file: `${ym}_월간` };
  }
  return null;
}
const crewWeekMon = ds => {
  const d = parseD(ds);
  return dstr(addDays(d, -((d.getDay() + 6) % 7)));
};
function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}

/* ── 완수용 캘린더 엑셀 (기존 내보내기와 완전히 분리된 별도 기능) ──
   목표일 = 완수일 − 5일. 그 날이 토·일·공휴일이면 평일이 나올 때까지 하루씩 앞당긴다.
   기존 buildSheet / buildCalendarSheet 등에는 손대지 않는다. */
/* 공휴일 (대체공휴일 포함) — 해가 바뀌면 여기 한 덩어리만 추가하면 된다.
   2026년부터 노동절(5/1)·제헌절(7/17) 공휴일 지정 반영 */
const WANSU_HOLIDAYS = {
  "2025-01-01": "신정", "2025-01-27": "임시공휴일", "2025-01-28": "설날", "2025-01-29": "설날", "2025-01-30": "설날",
  "2025-03-01": "삼일절", "2025-03-03": "대체공휴일", "2025-05-05": "어린이날", "2025-05-06": "대체공휴일",
  "2025-06-03": "대통령선거", "2025-06-06": "현충일", "2025-08-15": "광복절", "2025-10-03": "개천절",
  "2025-10-05": "추석", "2025-10-06": "추석", "2025-10-07": "추석", "2025-10-08": "대체공휴일",
  "2025-10-09": "한글날", "2025-12-25": "성탄절",
  "2026-01-01": "신정", "2026-02-16": "설날", "2026-02-17": "설날", "2026-02-18": "설날",
  "2026-03-01": "삼일절", "2026-03-02": "대체공휴일", "2026-05-01": "노동절", "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날", "2026-05-25": "대체공휴일", "2026-06-03": "지방선거", "2026-06-06": "현충일",
  "2026-07-17": "제헌절", "2026-08-15": "광복절", "2026-08-17": "대체공휴일",
  "2026-09-24": "추석", "2026-09-25": "추석", "2026-09-26": "추석",
  "2026-10-03": "개천절", "2026-10-05": "대체공휴일", "2026-10-09": "한글날", "2026-12-25": "성탄절",
  "2027-01-01": "신정", "2027-02-06": "설날", "2027-02-07": "설날", "2027-02-08": "설날", "2027-02-09": "대체공휴일",
  "2027-03-01": "삼일절", "2027-05-01": "노동절", "2027-05-03": "대체공휴일", "2027-05-05": "어린이날",
  "2027-05-13": "부처님오신날", "2027-06-06": "현충일", "2027-07-17": "제헌절", "2027-07-19": "대체공휴일",
  "2027-08-15": "광복절", "2027-08-16": "대체공휴일", "2027-09-14": "추석", "2027-09-15": "추석", "2027-09-16": "추석",
  "2027-10-03": "개천절", "2027-10-04": "대체공휴일", "2027-10-09": "한글날", "2027-10-11": "대체공휴일",
  "2027-12-25": "성탄절", "2027-12-27": "대체공휴일"
};
const WANSU_HOLI_YEARS = ["2025", "2026", "2027"];
/* 목록에 없는 해는 날짜가 고정된 공휴일만이라도 본다 (설·추석·대체공휴일은 빠짐) */
const WANSU_FIXED = { "01-01": "신정", "03-01": "삼일절", "05-01": "노동절", "05-05": "어린이날", "06-06": "현충일", "07-17": "제헌절", "08-15": "광복절", "10-03": "개천절", "10-09": "한글날", "12-25": "성탄절" };
const wansuHoliday = ds => WANSU_HOLIDAYS[ds] || (!WANSU_HOLI_YEARS.includes(ds.slice(0, 4)) && WANSU_FIXED[ds.slice(5)]) || "";
const WANSU_DOW = ["일", "월", "화", "수", "목", "금", "토"];
const wansuDow = ds => WANSU_DOW[parseD(ds).getDay()];
const wansuMD = ds => `${+ds.slice(5, 7)}/${+ds.slice(8, 10)}`;
/* 목표일 계산 — { date, note } . note 는 당겼을 때만 */
function wansuTarget(end) {
  const first = dstr(addDays(parseD(end), -5));
  let d = first;
  const why = [];
  let guard = 0;
  while (guard++ < 20) {
    const dw = parseD(d).getDay();
    const h = wansuHoliday(d);
    if (h) why.push(`${wansuMD(d)} ${h}`);
    else if (dw === 0 || dw === 6) why.push(`${wansuMD(d)} ${WANSU_DOW[dw]}요일`);
    else break;
    d = dstr(addDays(parseD(d), -1));
  }
  return { date: d, first, note: why.length ? `${why.join(" · ")} → ${wansuMD(d)}(${wansuDow(d)})` : "" };
}
/* 완수 안 된 현장만 · 같은 현장이 두 반기에 있으면 한 번만 */
function wansuRecords(entries) {
  const out = [];
  const seen = new Set();
  (entries || []).forEach(({ schools }) => (schools || []).forEach(s => {
    if (!s || s.deleted || !/^\d{4}-\d{2}-\d{2}$/.test(String(s.end || ""))) return;
    if (typeof siteDone === "function" && siteDone(s)) return;
    const nm = (s.school || "").trim();
    /* 같은 학교라도 시트에서 줄(No.)이 다르면 따로 계약된 별개 현장 → 둘 다 남긴다 */
    const k = `${s.region || ""}|${nm}|${String(s.no || "").trim()}|${s.end}`;
    if (seen.has(k)) return;
    seen.add(k);
    const t = wansuTarget(s.end);
    const cc = catCounts(s);
    const cat = [cc.건축 ? `건축${cc.건축}` : "", cc.토목종 ? `토목${cc.토목종}` : "", cc.토목소 ? `소규모${cc.토목소}` : ""].filter(Boolean).join("·");
    out.push({ s, school: nm, region: s.region || "", end: s.end, no: String(s.no || "").trim(), cat, target: t.date, first: t.first, note: t.note, moved: !!t.note,
      who: sortMembers(toArr(s.assignees).filter(Boolean)).join(", ") });
  }));
  /* 같은 이름이 두 번 이상이면 달력에서 구분되게 No.·구분을 붙인다 */
  const cnt = {};
  out.forEach(r => { cnt[r.school] = (cnt[r.school] || 0) + 1; });
  out.forEach(r => {
    r.label = cnt[r.school] > 1 ? `${r.school} [${[r.no ? `No.${r.no}` : "", r.cat].filter(Boolean).join(" ")}]` : r.school;
  });
  return out.sort((a, b) => a.target.localeCompare(b.target) || a.school.localeCompare(b.school) || (+a.no || 0) - (+b.no || 0));
}
const WX = {
  bd: { top: { style: "thin", color: { rgb: "FF000000" } }, bottom: { style: "thin", color: { rgb: "FF000000" } }, left: { style: "thin", color: { rgb: "FF000000" } }, right: { style: "thin", color: { rgb: "FF000000" } } },
  fill: rgb => ({ patternType: "solid", fgColor: { rgb } }),
  head: "FFD9D9D9", item: "FFEBF3FF", moved: "FFFFF2CC", wk: "FFF2F2F2", sat: "FF0070C0", sun: "FFFF0000"
};
function wansuListSheet(recs) {
  const today = dstr(new Date());
  const rows = [["목표일", "요일", "No.", "지역", "학교명", "구분", "완수일", "요일", "목표까지", "인원", "당김 사유"]];
  recs.forEach(r => {
    const dd = Math.round((parseD(r.target) - parseD(today)) / 86400000);
    rows.push([r.target, wansuDow(r.target), r.no, r.region, r.school, r.cat, r.end, wansuDow(r.end), dd === 0 ? "오늘" : dd > 0 ? `D-${dd}` : `${-dd}일 지남`, r.who, r.note]);
  });
  const late = recs.some(r => !WANSU_HOLI_YEARS.includes(r.target.slice(0, 4)));
  if (late) rows.push([], ["※ " + WANSU_HOLI_YEARS[WANSU_HOLI_YEARS.length - 1] + "년 이후는 설·추석·대체공휴일이 목록에 없어 날짜가 고정된 공휴일만 피했습니다."]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 5 }, { wch: 6 }, { wch: 8 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 5 }, { wch: 10 }, { wch: 22 }, { wch: 40 }];
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let c = 0; c <= 10; c++) {
    const a = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[a]) ws[a].s = { font: { bold: true }, fill: WX.fill(WX.head), border: WX.bd, alignment: { horizontal: "center" } };
  }
  recs.forEach((r, i) => {
    for (let c = 0; c <= 10; c++) {
      const a = XLSX.utils.encode_cell({ r: i + 1, c });
      if (!ws[a]) ws[a] = { t: "s", v: "" };
      ws[a].s = { border: WX.bd, fill: r.moved ? WX.fill(WX.moved) : undefined, alignment: { vertical: "center", horizontal: c === 4 || c === 9 || c === 10 ? "left" : "center" } };
    }
  });
  void range;
  return ws;
}
/* 한 달 달력 — 월요일 시작. 한 주 = 날짜 줄 + 내용 줄 */
function wansuCalSheet(recs, y, m) {
  const by = {};
  recs.forEach(r => (by[r.target] = by[r.target] || []).push(r));
  const first = new Date(y, m - 1, 1, 12);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const aoa = [], st = {}, rowH = [];
  const S = (r, c, s) => { st[`${r}_${c}`] = s; };
  aoa.push([`${y}년 ${m}월 완수 목표일`, "", "", "", "", "", ""]);
  S(0, 0, { font: { bold: true, sz: 14 } });
  rowH.push({ hpt: 24 });
  aoa.push(["목표일 = 완수일 − 5일 · 토·일·공휴일이면 앞 평일로 당김 · 노란 칸 = 당긴 날 (↩)", "", "", "", "", "", ""]);
  S(1, 0, { font: { sz: 9, color: { rgb: "FF595959" } } });
  rowH.push({ hpt: 16 });
  const hdr = ["월", "화", "수", "목", "금", "토", "일"];
  aoa.push(hdr);
  hdr.forEach((h, c) => S(2, c, { font: { bold: true, color: { rgb: c === 5 ? WX.sat : c === 6 ? WX.sun : "FF000000" } }, fill: WX.fill(WX.head), border: WX.bd, alignment: { horizontal: "center" } }));
  rowH.push({ hpt: 18 });
  for (let w = 0; w < 6; w++) {
    const days = [...Array(7)].map((_, i) => addDays(start, w * 7 + i));
    if (w > 0 && days[0].getMonth() !== m - 1) break;
    /* 한 칸에 몰아넣으면 행 높이 한도(409)를 넘어서, 학교 하나 = 한 줄로 아래로 늘린다 */
    const dRow = aoa.length;
    const dr = [];
    const cols = days.map((d, c) => {
      const ds = dstr(d);
      const inMonth = d.getMonth() === m - 1;
      const h = wansuHoliday(ds);
      dr.push(`${inMonth ? d.getDate() : `${d.getMonth() + 1}/${d.getDate()}`}${h ? ` ${h}` : ""}${inMonth && (by[ds] || []).length > 1 ? `  (${by[ds].length}곳)` : ""}`);
      const red = h || c === 6, blue = !h && c === 5;
      S(dRow, c, { font: { bold: true, color: { rgb: !inMonth ? "FFBFBFBF" : red ? WX.sun : blue ? WX.sat : "FF000000" } }, fill: WX.fill(WX.head), border: WX.bd, alignment: { horizontal: "left" } });
      return { items: inMonth ? by[ds] || [] : [], off: c >= 5 || !!h };
    });
    aoa.push(dr);
    rowH.push({ hpt: 16 });
    const n = Math.max(3, ...cols.map(x => x.items.length));
    for (let i = 0; i < n; i++) {
      const r = aoa.length;
      const last = i === n - 1;
      aoa.push(cols.map((x, c) => {
        const it = x.items[i];
        const side = { left: WX.bd.left, right: WX.bd.right, top: { style: "hair", color: { rgb: "FFBFBFBF" } }, bottom: last ? WX.bd.bottom : { style: "hair", color: { rgb: "FFBFBFBF" } } };
        S(r, c, { font: { sz: 10 }, border: side, alignment: { vertical: "center" },
          fill: it ? WX.fill(it.moved ? WX.moved : WX.item) : x.off ? WX.fill(WX.wk) : undefined });
        return it ? `${it.moved ? "↩ " : ""}${it.label} (완수 ${wansuMD(it.end)})` : "";
      }));
      rowH.push({ hpt: 16 });
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  Object.entries(st).forEach(([k, s]) => {
    const [r, c] = k.split("_").map(Number);
    const a = XLSX.utils.encode_cell({ r, c });
    if (!ws[a]) ws[a] = { t: "s", v: "" };
    ws[a].s = s;
  });
  ws["!cols"] = [...Array(7)].map(() => ({ wch: 20 }));
  ws["!rows"] = rowH;
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }];
  return ws;
}
function buildWansuWorkbook(entries) {
  const recs = wansuRecords(entries);
  if (!recs.length) return null;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wansuListSheet(recs), "완수목표 목록");
  const months = [...new Set(recs.map(r => r.target.slice(0, 7)))].sort();
  months.forEach(ym => {
    const y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    XLSX.utils.book_append_sheet(wb, wansuCalSheet(recs, y, m), `${String(y).slice(2)}.${m}월 완수`);
  });
  return wb;
}

function buildScheduleSheet(entries) {
  const multi = entries.length > 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  /* 화면(calcDday)과 같은 방식으로 계산한다.
     new Date("2026-08-06") 은 UTC 자정으로 해석돼 시간대에 따라 하루가 밀린다. */
  const ddStr = end => {
    const d = calcDday(end);
    return d === null ? "" : d >= 0 ? `D-${d}` : `D+${-d}`;
  };
  /* 날짜 문자열은 그대로 비교해도 순서가 맞다 (YYYY-MM-DD).
     new Date(문자열) 은 시간대 영향을 받으므로 쓰지 않는다. */
  const sortKey = s => {
    const ds = [s.field, s.start, s.end].filter(Boolean).filter(x => /^\d{4}-\d{2}-\d{2}/.test(x));
    return ds.length ? ds.sort()[0] : "9999-99-99";
  };
  const headers = multi ? ["구분", "지역", "학교명", "표시", "현장조사", "착수일", "완수일", "잔여", "담당자", "연락처"] : ["지역", "학교명", "표시", "현장조사", "착수일", "완수일", "잔여", "담당자", "연락처"];
  const meta = multi ? [{
    align: "center",
    w: 9
  }, {
    align: "center",
    team: true,
    w: 9
  }, {
    align: "center",
    w: 9
  }, {
    align: "left",
    bold: true,
    w: 26
  }, {
    align: "center",
    date: true,
    w: 12
  }, {
    align: "center",
    date: true,
    w: 12
  }, {
    align: "center",
    date: true,
    w: 12
  }, {
    align: "center",
    w: 8
  }, {
    align: "left",
    w: 28
  }, {
    align: "center",
    w: 16
  }] : [{
    align: "center",
    team: true,
    w: 9
  }, {
    align: "center",
    w: 9
  }, {
    align: "left",
    bold: true,
    w: 26
  }, {
    align: "center",
    date: true,
    w: 12
  }, {
    align: "center",
    date: true,
    w: 12
  }, {
    align: "center",
    date: true,
    w: 12
  }, {
    align: "center",
    w: 8
  }, {
    align: "left",
    w: 28
  }, {
    align: "center",
    w: 16
  }];
  const all = [];
  entries.forEach(({
    yr,
    half,
    schools
  }) => (schools || []).forEach(s => all.push({
    s,
    label: xlHalfLabel(yr, half)
  })));
  all.sort((a, b) => String(sortKey(a.s)).localeCompare(String(sortKey(b.s))));
  const rows = all.map(({
    s,
    label
  }) => {
    const base = [s.region || "", s.school || "", getFlags(s).join(","), xlDate(s.field), xlDate(s.start), xlDate(s.end), ddStr(s.end), sortMembers(s.assignees).join(", "), s.tel || ""];
    return multi ? [label, ...base] : base;
  });
  if (!rows.length) rows.push(new Array(headers.length).fill(""));
  return buildAuxSheet(headers, rows, meta);
}

/* ══════════════════════════════════════════════════════════════
   월 달력 시트 — 회사 양식(9월달력)과 같은 형태
   · 월요일 시작 · 한 주가 5줄: 구분 / 현장조사 / 조사인원 / 완수일 / 납품
   · 날짜별로 해당 일정의 현장명을 쌓아 넣는다
══════════════════════════════════════════════════════════════ */
/* 일정이 들어 있는 달 목록 — 최대 6개까지 (시트가 너무 많아지지 않게) */
/* 데이터 시트의 대략 행 수 — 달력 수식의 참조 범위를 잡는 데 쓴다 */
function dataRowCount(schools) {
  return (schools || []).reduce((a, s) => a + 1 + (s.buildings || []).length, 0) + 4;
}
function calMonths(entries) {
  const cnt = {};
  entries.forEach(({
    schools
  }) => (schools || []).forEach(s => {
    if (s.deleted) return;
    [s.field, s.end, s.deliverDate].forEach(d => {
      const k = String(d || "").slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(k)) cnt[k] = (cnt[k] || 0) + 1;
    });
  }));
  return Object.keys(cnt).sort().slice(-6).map(k => ({
    y: +k.slice(0, 4),
    m: +k.slice(5, 7)
  }));
}
function buildCalendarSheet(entries, ym, dataSheetName, dataRows, notes) {
  const today = new Date();
  /* 데이터 시트와 수식으로 연결한다 (원본 방식).
     시트명이 주어지면 FILTER 수식을, 아니면 계산된 값을 넣는다. */
  const SN = dataSheetName ? `'${dataSheetName}'!` : "";
  const LAST = Math.max(200, (dataRows || 0) + 10);
  const formula = (dateCell, colLetter, srcCol) => `_xlfn.TEXTJOIN(CHAR(10),TRUE,_xlfn._xlws.FILTER(${SN}$${srcCol || "AA"}$4:$${srcCol || "AA"}$${LAST},${SN}$${colLetter}$4:$${colLetter}$${LAST}=${dateCell},""))`;
  let Y = ym && ym.y,
    M = ym && ym.m;
  if (!Y || !M) {
    const key = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}`;
    Y = +key.slice(0, 4);
    M = +key.slice(5, 7);
  }

  /* 날짜별 수집 — 조사 / 조사인원 / 완수 / 납품 */
  const byDay = {};
  const add = (d, kind, text) => {
    const k = String(d || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
    (byDay[k] = byDay[k] || {
      조사: [],
      인원: [],
      완수: [],
      납품: []
    })[kind].push(text);
  };
  const seen = new Set();
  /* 메모 일정도 달력에 함께 (현장 리스트에는 넣지 않는다) */
  (notes || []).forEach(n => {
    noteDates(n).forEach(d => {
      const who = (n.who || []).join(",");
      add(d, "조사", `[${n.kind}] ${n.text}${who ? ` (${who})` : ""}`);
    });
  });
  entries.forEach(({
    schools
  }) => (schools || []).forEach(s => {
    if (s.deleted) return;
    const nm = (s.school || "").trim();
    const mark = `${isNewSite(s) ? "[신규] " : ""}${nm}`;
    const uk = (d, t) => `${d}|${t}|${nm}`;
    /* 조사가 여러 날이면 모든 날에, 그 날 가는 인원과 함께 */
    surveyDates(s).forEach(d => {
      if (seen.has(uk(d, "조사"))) return;
      seen.add(uk(d, "조사"));
      add(d, "조사", mark);
      add(d, "인원", sortMembers(whoOnDate(s, d)).join(",") || "미배정");
    });
    if (s.end && !seen.has(uk(s.end, "완수"))) {
      seen.add(uk(s.end, "완수"));
      add(s.end, "완수", mark);
    }
    if (s.deliverDate && !seen.has(uk(s.deliverDate, "납품"))) {
      seen.add(uk(s.deliverDate, "납품"));
      add(s.deliverDate, "납품", mark);
    }
  }));

  /* 월요일 시작 격자 (원본과 동일) */
  const first = new Date(Y, M - 1, 1, 12);
  const gridStart = addDays(first, -((first.getDay() + 6) % 7));
  const aoa = [],
    styles = {},
    rowH = [];
  const setS = (r, c, st) => {
    styles[`${r}_${c}`] = st;
  };
  const bd = {
    top: {
      style: "thin",
      color: {
        rgb: XLC.line
      }
    },
    bottom: {
      style: "thin",
      color: {
        rgb: XLC.line
      }
    },
    left: {
      style: "thin",
      color: {
        rgb: XLC.line
      }
    },
    right: {
      style: "thin",
      color: {
        rgb: XLC.line
      }
    }
  };
  const solid = rgb => ({
    patternType: "solid",
    fgColor: {
      rgb
    }
  });
  const FT = (bold, color) => ({
    name: bold ? CAL_FONT : CAL_FONT_B,
    sz: 10,
    color: {
      rgb: color || "FF000000"
    }
  });

  /* 1행: YEAR / MONTH 머리 (원본은 H1·I1) */
  const r1 = new Array(10).fill("");
  r1[7] = "YEAR";
  r1[8] = "MONTH";
  aoa.push(r1);
  [7, 8].forEach(c => setS(0, c, {
    font: FT(true),
    alignment: {
      horizontal: "center",
      vertical: "center"
    }
  }));
  rowH.push({
    hpt: 20.1
  });

  /* 2행: 범례 + 연·월 값 (원본 B2·C2·D2 / H2·I2) */
  const r2 = new Array(10).fill("");
  r2[1] = "현장조사";
  r2[2] = "완수";
  r2[3] = "납품 완료";
  r2[7] = Y;
  r2[8] = M;
  aoa.push(r2);
  setS(1, 1, {
    font: {
      name: XL_FONT,
      sz: 10,
      bold: true
    },
    alignment: {
      horizontal: "center",
      vertical: "center"
    }
  });
  setS(1, 2, {
    font: {
      name: XL_FONT,
      sz: 10,
      bold: true
    },
    fill: solid(XLC.calField),
    alignment: {
      horizontal: "center",
      vertical: "center"
    }
  });
  setS(1, 3, {
    font: {
      name: XL_FONT,
      sz: 10,
      bold: true
    },
    fill: solid(XLC.calDone),
    alignment: {
      horizontal: "center",
      vertical: "center"
    }
  });
  [7, 8].forEach(c => setS(1, c, {
    font: FT(true),
    alignment: {
      horizontal: "center",
      vertical: "center"
    }
  }));
  rowH.push({
    hpt: 20.1
  });
  aoa.push(new Array(10).fill(""));
  rowH.push({
    hpt: 20.1
  });

  /* 주 단위 5줄: 구분 / 현장조사 / 조사인원 / 완수일 / 납품 */
  const LABELS = [["구분", null], ["현장조사", "조사"], ["조사인원", "인원"], ["완수일", "완수"], ["납품", "납품"]];
  /* 수식이 참조할 데이터 시트 열 — P 현장조사일 / Q 완수일 / R 납품일자 */
  const FCOL = {
    조사: "P",
    완수: "Q",
    납품: "R"
  };
  /* 조사인원은 담당자 열(AC)을 현장조사일(P) 기준으로 가져온다 */
  const FSRC = {
    인원: "AC"
  };
  const fcells = [];
  /* 행 배경 — 원본: 완수일행 연하늘, 납품행 연보라 */
  const ROWFILL = {
    조사: null,
    인원: null,
    완수: XLC.calDeliver,
    납품: XLC.calDone
  };
  for (let w = 0; w < 6; w++) {
    const ws0 = addDays(gridStart, w * 7);
    const inMonth = Array.from({
      length: 7
    }, (_, i) => addDays(ws0, i)).some(d => d.getMonth() + 1 === M && d.getFullYear() === Y);
    if (!inMonth) continue;
    LABELS.forEach(([label, kind]) => {
      const row = new Array(10).fill("");
      row[1] = label;
      let maxLines = 1;
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws0, i);
        const c = 2 + i;
        if (kind === null) row[c] = d;else {
          const list = (byDay[dstr(d)] || {})[kind] || [];
          row[c] = list.join("\n");
          maxLines = Math.max(maxLines, list.length || 1);
        }
      }
      const r = aoa.length;
      aoa.push(row);
      /* 수식으로 연결할 칸 기록 (조사·완수·납품) */
      if (SN && (FCOL[kind] || FSRC[kind])) for (let i = 0; i < 7; i++) fcells.push({
        r,
        c: 2 + i,
        dateRow: r - LABELS.findIndex(x => x[1] === kind),
        col: FCOL[kind] || "P",
        src: FSRC[kind] || "AA"
      });
      rowH.push({
        hpt: kind === null ? 20.1 : Math.max(20.1, maxLines * 14 + 6)
      });
      /* 라벨 칸 */
      setS(r, 1, {
        font: FT(true, kind === "완수" ? XLC.sun : null),
        ...(kind === null || ROWFILL[kind] ? {
          fill: solid(kind === null ? XLC.header : ROWFILL[kind])
        } : {}),
        alignment: {
          horizontal: "center",
          vertical: "center"
        },
        border: bd
      });
      /* 날짜 칸 */
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws0, i);
        const c = 2 + i;
        const other = d.getMonth() + 1 !== M || d.getFullYear() !== Y;
        const dowColor = i === 5 ? XLC.sat : i === 6 ? XLC.sun : null;
        setS(r, c, {
          font: kind === null ? FT(true, other ? "FFA6A6A6" : dowColor) : FT(false, kind === "완수" ? XLC.sun : null),
          ...(kind === null || ROWFILL[kind] ? {
            fill: solid(kind === null ? XLC.header : ROWFILL[kind])
          } : {}),
          alignment: {
            horizontal: kind === null ? "center" : "left",
            vertical: "center",
            wrapText: kind !== null
          },
          border: bd,
          ...(kind === null ? {
            numFmt: "m-d"
          } : {})
        });
      }
    });
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa, {
    cellDates: true
  });
  /* 열 너비 — 원본: A 9 / B 10.6 / 날짜칸 20.6 (D 는 50.6) */
  /* 엑셀은 지정값에 0.8 을 더해 저장하므로 원본 너비에서 미리 빼둔다 */
  ws["!cols"] = [9, 10.6, 20.6, 50.6, 20.6, 20.6, 20.6, 20.6, 20.6, 9].map(w => ({
    wch: Math.max(1, w - 0.8)
  }));
  ws["!rows"] = rowH;
  Object.entries(styles).forEach(([rc, st]) => {
    const p = rc.split("_");
    const a = XLSX.utils.encode_cell({
      r: +p[0],
      c: +p[1]
    });
    if (!ws[a]) ws[a] = {
      t: "s",
      v: ""
    };
    const {
      numFmt,
      ...rest
    } = st;
    ws[a].s = rest;
    if (numFmt) ws[a].z = numFmt;
  });
  /* 데이터 시트와 수식으로 연결 — 시설물 리스트를 고치면 달력도 따라 바뀐다 */
  fcells.forEach(fc => {
    const a = XLSX.utils.encode_cell({
      r: fc.r,
      c: fc.c
    });
    const dateRef = XLSX.utils.encode_cell({
      r: fc.dateRow,
      c: fc.c
    });
    const keep = ws[a] && ws[a].s;
    ws[a] = {
      t: "s",
      v: ws[a] && ws[a].v || "",
      f: formula(dateRef, fc.col, fc.src)
    };
    if (keep) ws[a].s = keep;
  });
  return ws;
}
function parseBudget(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null
  });
  const clean = v => v == null ? "" : String(v).replace(/\u00a0/g, " ").trim();
  const norm = v => clean(v).toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
  /* 헤더 영역(학교명이 있는 행)과 그 아래 2행에서 열 탐지 */
  let schoolRow = -1,
    schoolCol = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const c = (rows[i] || []).findIndex(v => {
      const n = norm(v);
      return n === "학교명" || n === "시설물명";
    });
    if (c >= 0) {
      schoolRow = i;
      schoolCol = c;
      break;
    }
  }
  if (schoolRow < 0) return {};
  /* 금액 열: 학교명 행~+2행에서 '합계' 우선, 없으면 '예산액' */
  let amtCol = -1;
  for (const pat of ["합계", "예산액"]) {
    for (let i = schoolRow; i <= schoolRow + 2 && i < rows.length && amtCol < 0; i++) {
      const idx = (rows[i] || []).findIndex(v => norm(v).includes(pat));
      if (idx >= 0) amtCol = idx;
    }
    if (amtCol >= 0) break;
  }
  if (amtCol < 0) return {};
  const toNum = v => {
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : n;
  };
  const out = {}; // { 학교명: { total:원, items:[원,…] (시설 순서) } }
  for (let i = schoolRow + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const sch = clean(r[schoolCol]);
    if (!sch) continue;
    if (["합계", "소계", "총계", "학교수"].some(k => sch.includes(k))) continue; // 요약행 제외
    const won = toNum(r[amtCol]) * 1000; // 천원 → 원
    if (!out[sch]) out[sch] = {
      total: 0,
      items: []
    };
    out[sch].items.push(won); // 시설(행) 순서대로 누적 — 위치 매칭용
    out[sch].total += won;
  }
  return out;
}

/* 특이사항 시트 → [{school, building, note}]  (특기 헤더가 비어있어도 보고서완료 열 앞 칸으로 추정) */
function parseNotes(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null
  });
  const clean = v => v == null ? "" : String(v).replace(/\u00a0/g, " ").trim();
  const norm = v => clean(v).toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
  let hIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    if ((rows[i] || []).some(v => {
      const n = norm(v);
      return n.includes("학교명") || n.includes("시설물명");
    })) {
      hIdx = i;
      break;
    }
  }
  if (hIdx < 0) return [];
  const H = (rows[hIdx] || []).map(norm);
  const schoolCol = H.findIndex(h => h.includes("학교명") || h.includes("시설물명"));
  const buildingCol = H.findIndex(h => h === "시설명" || h === "동명");
  let noteCol = H.findIndex(h => h.includes("특기"));
  if (noteCol < 0) {
    const repCol = H.findIndex(h => h.includes("보고서") && h.includes("완료"));
    if (repCol > 0) noteCol = repCol - 1;
  }
  if (schoolCol < 0 || noteCol < 0) return [];
  const out = [];
  let curSchool = "";
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const sch = clean(r[schoolCol]);
    if (sch) curSchool = sch;
    const note = clean(r[noteCol]);
    if (note && curSchool) out.push({
      school: curSchool,
      building: buildingCol >= 0 ? clean(r[buildingCol]) : "",
      note
    });
  }
  return out;
}

/* 특이사항 노트를 학교의 해당 시설(동) 특기사항에 추가 병합 (중복 방지) */
function applyNotes(schools, notes) {
  if (!notes || !notes.length) return 0;
  const byName = {};
  schools.forEach(s => {
    (byName[s.school] = byName[s.school] || []).push(s);
  });
  let applied = 0;
  notes.forEach(({
    school,
    building,
    note
  }) => {
    const list = byName[school];
    if (!list || !list.length) return;
    const s = list[0];
    let b = null;
    if (building) b = s.buildings.find(x => x.b === building) || s.buildings.find(x => x.b && (x.b.includes(building) || building.includes(x.b)));
    if (!b) b = s.buildings[0];
    if (!b) return;
    const add = building && b.b !== building ? `[${building}] ${note}` : note;
    const sig = note.replace(/\s/g, "").slice(0, 20); // 노트 앞부분 지문(공백 제거 20자)
    const existSig = (b.note || "").replace(/\s/g, "");
    if (!b.note) b.note = add;else if (existSig.includes(sig)) {/* 사실상 같은 노트 → 건너뜀(중복 방지) */} else b.note = b.note + " / " + add;
    applied++;
  });
  return applied;
}
