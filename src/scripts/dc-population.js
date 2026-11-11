/**
 * Data Center: ประชากรทะเบียนราษฎร from stat.bora (SCHEMA §2.6–2.8, §3.8,
 * ADR-0011, ADR-0014).
 *
 * Shares the Apps Script global scope with รหัส.js, dc-storage.js and
 * dc-catalog.js. Read those only inside functions, never at top level: file
 * load order is not guaranteed.
 */

const DC_REGISTRY_POPULATION_SHEET = "registry_population";
// The 13 values of a stat_m line in file order (SCHEMA §2.6); the sheet adds
// uploaded_at after them.
const DC_REGISTRY_POPULATION_COLUMNS = [
  "yymm", "cc", "cc_name", "rcode", "rcode_name", "tt", "tt_name", "mm", "mm_name",
  "male", "female", "total", "house",
];
// Codes written as plain text so Sheets keeps them as strings (SCHEMA §2.6).
const DC_REGISTRY_POPULATION_TEXT_COLUMNS = ["yymm", "cc", "rcode", "tt", "mm"];
// Columns that hold counts (int ≥ 0); every other column is a string.
const DC_REGISTRY_POPULATION_COUNT_COLUMNS = ["male", "female", "total", "house"];
// The string columns with a format of their own (SCHEMA §3.8 rule 6). tt's is
// rule 7.
const DC_REGISTRY_POPULATION_CODE_PATTERNS = { cc: /^\d{2}$/, rcode: /^\d{4}$/ };

// The หมู่บ้าน lines of stat_m (SCHEMA §2.8), in the columns of the ตำบล
// lines.
const DC_REGISTRY_POPULATION_VILLAGE_SHEET = "registry_population_village";

// The age sheet (SCHEMA §2.7), from the age file of stat.bora.
const DC_REGISTRY_POPULATION_AGE_SHEET = "registry_population_age";
// The groups of people the age file does not count by age, then the total.
const DC_REGISTRY_POPULATION_UNSPLIT_GROUPS = ["lunar", "central", "nonthai", "moving"];
const DC_REGISTRY_POPULATION_UNSPLIT_AND_TOTAL = DC_REGISTRY_POPULATION_UNSPLIT_GROUPS.concat(["total"]);
// Its counts: m0, f0 … m100, f100, m101, f101 (over 100 years), then each
// group as _m, _f, _t.
const DC_REGISTRY_POPULATION_AGE_COUNT_COLUMNS = (function () {
  const columns = [];
  for (let age = 0; age <= 101; age++) columns.push("m" + age, "f" + age);
  DC_REGISTRY_POPULATION_UNSPLIT_AND_TOTAL.forEach(function (group) {
    columns.push(group + "_m", group + "_f", group + "_t");
  });
  return columns;
})();
const DC_REGISTRY_POPULATION_AGE_COLUMNS = ["yymm", "rcode", "tt", "tt_name"].concat(DC_REGISTRY_POPULATION_AGE_COUNT_COLUMNS);

// The layout of the sheet each kind of save_registry_population writes
// (SCHEMA §3.8): its name, its columns in sheet order without uploaded_at,
// which of them hold counts, and the codes written as plain text.
const DC_REGISTRY_LAYOUTS = {
  population: {
    name: DC_REGISTRY_POPULATION_SHEET,
    columns: DC_REGISTRY_POPULATION_COLUMNS,
    counts: DC_REGISTRY_POPULATION_COUNT_COLUMNS,
    text: DC_REGISTRY_POPULATION_TEXT_COLUMNS,
  },
  village: {
    name: DC_REGISTRY_POPULATION_VILLAGE_SHEET,
    columns: DC_REGISTRY_POPULATION_COLUMNS,
    counts: DC_REGISTRY_POPULATION_COUNT_COLUMNS,
    text: DC_REGISTRY_POPULATION_TEXT_COLUMNS,
  },
  age: {
    name: DC_REGISTRY_POPULATION_AGE_SHEET,
    columns: DC_REGISTRY_POPULATION_AGE_COLUMNS,
    counts: DC_REGISTRY_POPULATION_AGE_COUNT_COLUMNS,
    text: ["yymm", "rcode", "tt"],
  },
};

/**
 * POST save_registry_population (SCHEMA §3.8): check the request by its rules
 * in order, then replace the rows of its yymm in the sheet of its kind, every
 * other year's rows kept as they are. The sheet is rewritten whole in yymm
 * order, each year's rows in the order they were sent, and created with its
 * header on the first save (SCHEMA §2.6–2.8).
 *
 * The caller must hold the script lock (doPost): this function never calls
 * LockService (SCHEMA §3). district_code comes from readSettings(), which
 * doPost has cached before taking the lock.
 *
 * Returns { status: "success", kind, yymm, count } or { status: "error", message }.
 */
function dcSaveRegistryPopulation(kindRaw, yymmRaw, rows) {
  if (kindRaw !== "population" && kindRaw !== "village" && kindRaw !== "age") {
    return dcRejectRegistryPopulation(null, null, "Unknown kind");
  }
  const kind = kindRaw;
  const layout = DC_REGISTRY_LAYOUTS[kind];
  // Figures at 31 Dec exist only once that year is over, so a yymm of this
  // year or later is refused: a made-up future year must not become the year
  // the home page shows.
  const thisYear = Number(Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy")) + 543;
  if (typeof yymmRaw !== "string" || !/^\d{2}12$/.test(yymmRaw) || 2500 + Number(yymmRaw.slice(0, 2)) >= thisYear) {
    return dcRejectRegistryPopulation(kind, null, "Invalid yymm");
  }
  const yymm = yymmRaw;
  const error = dcRegistryRowsError(kind, rows, yymm, readSettings().district_code) ||
    dcRegistryOtherSheetError(kind, rows, yymm);
  if (error) return dcRejectRegistryPopulation(kind, yymm, error);

  const header = layout.columns.concat(["uploaded_at"]);
  const now = new Date();
  const kept = dcSheetRecords(layout.name, header).filter(function (row) {
    return String(row.yymm).trim() !== yymm;
  });
  const added = rows.map(function (row) {
    return Object.assign({}, row, { uploaded_at: now });
  });
  // Array sort is stable, so each year keeps its row order.
  const all = kept.concat(added).sort(function (a, b) {
    const x = String(a.yymm).trim();
    const y = String(b.yymm).trim();
    return x < y ? -1 : x > y ? 1 : 0;
  });
  dcWriteSheet(layout.name, header, all.map(function (row) {
    return header.map(function (column) {
      return row[column];
    });
  }), layout.text);
  logToSheet("SUCCESS", "Saved " + layout.name + " " + yymm, rows.length + " rows");
  return { status: "success", kind: kind, yymm: yymm, count: rows.length };
}

/**
 * GET ?action=registry_population (SCHEMA §3.9): GasRegistryPopulation
 * (SCHEMA §9), the rows of the three sheets by yymm, oldest first, each
 * sheet's rows in sheet order. A sheet that does not exist yet has no rows,
 * so before the first upload the answer is { years: [] }, and a year of no
 * village rows has village: []. No cache: only the build and
 * the /sync upload call it.
 *
 * The caller must hold the script lock (doGet), so no sheet is read while
 * save_registry_population rewrites it: this function never calls
 * LockService (SCHEMA §3).
 */
function dcGetRegistryPopulation() {
  // Null prototype: a yymm typed by hand such as "constructor" must not hit
  // Object.prototype.
  const years = Object.create(null);
  ["population", "village", "age"].forEach(function (kind) {
    const layout = DC_REGISTRY_LAYOUTS[kind];
    dcRegistryRows(layout.name, layout.columns, layout.counts).forEach(function (row) {
      years[row.yymm] = years[row.yymm] || { yymm: row.yymm, population: [], village: [], age: [] };
      years[row.yymm][kind].push(row);
    });
  });
  return {
    years: Object.keys(years).sort().map(function (yymm) {
      return years[yymm];
    }),
  };
}

/**
 * A registry sheet's rows as SCHEMA §3.9 returns them, read by header name:
 * the given columns (uploaded_at left out), counts as numbers and every other
 * column as a trimmed string, even where an edit by hand turned a code into a
 * number. A column the sheet lacks, and a count cell that is blank or no
 * number (a date or a boolean is none, numeric text is one), are left out of
 * the row: the prebuild then fails loudly on a sheet broken by hand
 * (SCHEMA §7) instead of publishing 0. A row with every column read here blank
 * is no row. One with only its yymm blank stays, as a year with a blank yymm,
 * and a sheet without a yymm column keeps every row below its first: the
 * prebuild fails loudly on those too, instead of publishing a total short of
 * them. [] if the sheet does not exist.
 */
function dcRegistryRows(sheetName, columns, countColumns) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(dcHeaderName);
  const at = columns.map(function (column) {
    return header.indexOf(column);
  });
  const isCount = columns.map(function (column) {
    return countColumns.indexOf(column) > -1;
  });
  const hasYymm = header.indexOf("yymm") > -1;
  return values.slice(1).filter(function (cells) {
    return !hasYymm || at.some(function (i) {
      return i !== -1 && String(cells[i]).trim() !== "";
    });
  }).map(function (cells) {
    const row = {};
    columns.forEach(function (column, k) {
      if (at[k] === -1) return;
      const v = cells[at[k]];
      if (!isCount[k]) {
        row[column] = String(v).trim();
      } else if ((typeof v === "number" || typeof v === "string") && String(v).trim() !== "" && Number.isFinite(Number(v))) {
        row[column] = Number(v);
      }
    });
    return row;
  });
}

/**
 * Rules 3–11 of SCHEMA §3.8 for rows of kind, each over every row before
 * the next: the message of the first rule that fails, or null.
 */
function dcRegistryRowsError(kind, rows, yymm, districtCode) {
  if (!Array.isArray(rows) || rows.length === 0) return "Empty rows";
  const layout = DC_REGISTRY_LAYOUTS[kind];
  const columns = layout.columns;
  const keysMatch = rows.every(function (row) {
    return row !== null && typeof row === "object" && !Array.isArray(row) &&
      Object.keys(row).length === columns.length && columns.every(function (column) {
        return Object.prototype.hasOwnProperty.call(row, column);
      });
  });
  if (!keysMatch) return "Row keys do not match the header";
  if (!rows.every(function (row) {
    return row.yymm === yymm;
  })) return "Row of another yymm";
  if (!rows.every(function (row) {
    return dcRegistryValuesValid(row, layout);
  })) return "Invalid value";
  if (!rows.every(function (row) {
    return /^\d{8}$/.test(row.tt) && row.tt.indexOf(districtCode) === 0;
  })) return "Row outside district";
  if (kind === "population" && !rows.every(function (row) {
    return row.mm === "0";
  })) return "Not a tambon row";
  // A หมู่บ้าน code is 8 digits, the first 6 those of its ตำบล.
  if (kind === "village" && !rows.every(function (row) {
    return /^\d{8}$/.test(row.mm) && row.mm.slice(0, 6) === row.tt.slice(0, 6);
  })) return "Not a village row";
  // Null prototype: a key such as "constructor" must not hit Object.prototype.
  const seen = Object.create(null);
  const unique = rows.every(function (row) {
    const key = row.rcode + "/" + (kind === "village" ? row.mm : row.tt);
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
  if (!unique) return kind === "village" ? "Duplicate village row" : "Duplicate tambon row";
  if (!rows.every(kind !== "age" ? function (row) {
    return row.male + row.female === row.total;
  } : function (row) {
    return DC_REGISTRY_POPULATION_UNSPLIT_AND_TOTAL.every(function (group) {
      return row[group + "_m"] + row[group + "_f"] === row[group + "_t"];
    });
  })) return "Male + female does not equal total";
  if (kind === "age" && !rows.every(dcAgesAddUp)) return "Ages do not add up to total";
  return null;
}

/**
 * Rule 11 of SCHEMA §3.8, stat.bora's formula (SCHEMA §11.1): for ชาย and
 * for หญิง, the counts by year of age and the groups the file does not count
 * by age add up to the total.
 */
function dcAgesAddUp(row) {
  return ["m", "f"].every(function (sex) {
    let sum = 0;
    for (let age = 0; age <= 101; age++) sum += row[sex + age];
    DC_REGISTRY_POPULATION_UNSPLIT_GROUPS.forEach(function (group) {
      sum += row[group + "_" + sex];
    });
    return sum === row["total_" + sex];
  });
}

/**
 * Rules 12–15 of SCHEMA §3.8, so that the sheets always agree on a yymm: age
 * and village rows need the registry_population rows of their yymm, and
 * population rows are checked once registry_population_age has rows of
 * their yymm. Population rows are not checked against village rows: the
 * upload sends the villages of the same stat_m right after them. The message
 * of the first rule that fails, or null.
 */
function dcRegistryOtherSheetError(kind, rows, yymm) {
  const otherLayout = DC_REGISTRY_LAYOUTS[kind === "population" ? "age" : "population"];
  const saved = dcRegistryRows(otherLayout.name, otherLayout.columns, otherLayout.counts).filter(function (row) {
    return row.yymm === yymm;
  });
  if (kind === "population") {
    return saved.length === 0 || dcRegistryRowsAgree(rows, saved) ? null : "Does not match registry_population_age";
  }
  if (saved.length === 0) return "No registry_population rows for this yymm";
  if (kind === "village") return dcVillagesAddUp(saved, rows) ? null : "Villages do not add up to registry_population";
  return dcRegistryRowsAgree(saved, rows) ? null : "Does not match registry_population";
}

/**
 * The match that rule 15 of SCHEMA §3.8 asks for: village rows of one yymm
 * are of the same ตำบล (rcode, tt) as its population rows, every one of them,
 * and per ตำบล their male, female, total and house add up to its row's.
 */
function dcVillagesAddUp(population, villages) {
  // Null prototype: a key such as "constructor" must not hit Object.prototype.
  const sums = Object.create(null);
  villages.forEach(function (row) {
    const key = row.rcode + "/" + row.tt;
    sums[key] = sums[key] || { male: 0, female: 0, total: 0, house: 0 };
    DC_REGISTRY_POPULATION_COUNT_COLUMNS.forEach(function (column) {
      sums[key][column] += row[column];
    });
  });
  const tambons = Object.create(null);
  return population.every(function (row) {
    const key = row.rcode + "/" + row.tt;
    tambons[key] = true;
    return sums[key] !== undefined && DC_REGISTRY_POPULATION_COUNT_COLUMNS.every(function (column) {
      return sums[key][column] === row[column];
    });
  }) && Object.keys(sums).every(function (key) {
    return tambons[key];
  });
}

/**
 * The match that rules 13 and 14 of SCHEMA §3.8 ask for: population rows and
 * age rows of one yymm are the same ตำบล (rcode, tt), and each age row's
 * total_m, total_f, total_t are male, female, total of its population row.
 */
function dcRegistryRowsAgree(population, age) {
  // Null prototype: a key such as "constructor" must not hit Object.prototype.
  const byTambon = Object.create(null);
  population.forEach(function (row) {
    byTambon[row.rcode + "/" + row.tt] = row;
  });
  const paired = Object.create(null);
  return age.every(function (row) {
    const key = row.rcode + "/" + row.tt;
    const pair = byTambon[key];
    paired[key] = true;
    return pair !== undefined && row.total_m === pair.male && row.total_f === pair.female && row.total_t === pair.total;
  }) && Object.keys(paired).length === Object.keys(byTambon).length;
}

/**
 * Rule 6 of SCHEMA §3.8 for a row of layout (DC_REGISTRY_LAYOUTS): counts
 * are whole numbers ≥ 0, the rest strings in their format. No string may
 * begin with "=", which setValues writes as a formula (Apps Script
 * Range.setValues).
 */
function dcRegistryValuesValid(row, layout) {
  return layout.columns.every(function (column) {
    const v = row[column];
    if (layout.counts.indexOf(column) > -1) return Number.isInteger(v) && v >= 0;
    const pattern = DC_REGISTRY_POPULATION_CODE_PATTERNS[column];
    return typeof v === "string" && v.charAt(0) !== "=" && (!pattern || pattern.test(v));
  });
}

/**
 * Log a rejected save_registry_population to system_logs and return the
 * error response. Nothing has been written yet. kind and yymm are null until
 * they have passed their rule, so no raw request text reaches the sheet.
 */
function dcRejectRegistryPopulation(kind, yymm, message) {
  const what = kind ? DC_REGISTRY_LAYOUTS[kind].name + " " + (yymm || "(invalid yymm)") : "(unknown kind)";
  logToSheet("ERROR", "Save rejected " + what, message);
  return { status: "error", message: message };
}
