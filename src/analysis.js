/**
 * ===== 分析 =====
 *   buildAnalysis : 「社内」「外部案件」タブと前回アンケート（2026年4月）の回答を集計し、
 *                   「分析」タブへ書き出す（GAS エディタから実行）
 *
 * 回答データ（社内 / 外部案件 / 前回スプレッドシート）には一切書き込まない。
 * 「分析」タブは毎回クリアして作り直すので、何度実行しても同じ結果になる。
 * 回答が増えたら再実行するだけでよい。
 *
 * 列は設問タイトルの先頭文字列（constants.js の Q）で特定するため、
 * 「社内」タブの列が増減しても設問番号が変わらなければ影響しない。
 */

/** 「分析」タブを作り直す。 */
function buildAnalysis() {
  const ss = getBoundSpreadsheet_();
  const cur = readTable_(ss.getSheetByName(TAB_INTERNAL), Q.cur);
  const ext = readTable_(ss.getSheetByName(TAB_EXTERNAL), Q.ext);
  const prevSheet = SpreadsheetApp.openById(PREV_SPREADSHEET_ID).getSheetByName(PREV_SHEET_NAME);
  if (!prevSheet) throw new Error(`前回シートが見つかりません: ${PREV_SHEET_NAME}`);
  const prev = readTable_(prevSheet, Q.prev);
  const prevInt = prev.filter((r) => PREV_INTERNAL_TEAMS.includes(r.team));

  const sheet = ensureSheet_(ss, TAB_ANALYSIS);
  sheet.clear();
  let row = 1;
  const put = (title, header, rows, pctCols) => {
    row = writeSection_(sheet, row, title, header, rows, pctCols);
  };

  // ------------------------------------------------------------------
  // 1. 概要
  // ------------------------------------------------------------------
  const both = cur.filter((c) => prev.some((p) => p.email === c.email));
  put(
    "1. 概要",
    ["項目", "値", "備考"],
    [
      ["更新日時", Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"), "GAS エディタで buildAnalysis を再実行すると更新される"],
      ["今回 回答数（社内）", cur.length, `「${TAB_INTERNAL}」タブ`],
      ["今回 回答数（外部案件）", ext.length, `「${TAB_EXTERNAL}」タブ`],
      ["前回 回答数（全体）", prev.length, "2026年4月実施。所属で分岐していなかったため全員が同じ設問に回答"],
      ["前回 回答数（社内チーム所属のみ）", prevInt.length, `チーム名が ${PREV_INTERNAL_TEAMS.join(" / ")} の回答。今回の「社内」と比較する際はこちらを基準にする`],
      ["両回とも回答した人", both.length, "メールアドレスが一致した人数（セクション 7 を参照）"],
      ...countBy_(cur.map((r) => r.team)).map(([k, n]) => [`今回 チーム別: ${k}`, n, ""]),
    ],
  );

  // ------------------------------------------------------------------
  // 2. 主要指標の前回比較
  // ------------------------------------------------------------------
  const yes = (v) => v === "はい";
  const no = (v) => v === "いいえ";
  const improved = (v) => Number(v) >= SPEED_IMPROVED_MIN;
  const hasConcern = (v) => v !== "" && !String(v).includes("特になし");
  const dilemmaCur = (r) => improved(r.speed) && no(r.skill) && yes(r.worry);
  const dilemmaPrev = (r) => yes(r.speed) && no(r.skill) && yes(r.worry);

  /** key は分母（回答あり）を数える列。@returns {Array} [指標, 今回 k/n, 今回%, 前回全体 k/n, %, 前回社内 k/n, %, 差分, 備考] */
  const metric = (label, key, curPred, prevPred, note) => {
    const a = rate_(cur, key, curPred);
    const b = rate_(prev, key, prevPred);
    const c = rate_(prevInt, key, prevPred);
    const diff = a.n && c.n ? a.p - c.p : "-";
    return [label, a.text, a.p, b.text, b.p, c.text, c.p, diff, note || ""];
  };
  put(
    "2. 主要指標の前回比較（割合は各設問の回答者ベース）",
    ["指標", "今回(社内)", "今回 %", "前回(全体)", "前回 %", "前回(社内のみ)", "前回 %", "差分 (今回−前回社内)", "備考"],
    [
      metric("生産性: 速度向上を実感", "speed", (r) => improved(r.speed), (r) => yes(r.speed), `今回は 1〜5 スケールの ${SPEED_IMPROVED_MIN} 以上、前回は「はい」`),
      metric("成長: スキルアップに貢献「はい」", "skill", (r) => yes(r.skill), (r) => yes(r.skill)),
      metric("成長課題: スキルアップに貢献「いいえ」", "skill", (r) => no(r.skill), (r) => no(r.skill), "前回「分析」タブの K列 指標"),
      metric("危機感: 依存でスキルアップが滞る不安「はい」", "worry", (r) => yes(r.worry), (r) => yes(r.worry), "前回「分析」タブの L列 指標"),
      metric("ジレンマ層: 速度↑ かつ 貢献いいえ かつ 不安はい", "speed", dilemmaCur, dilemmaPrev, "前回「分析」タブの複合指標（前回は速度はい 44人中 4人 = 9.09%）"),
      metric("新しい言語・技術へのチャレンジ「はい」", "chal", (r) => yes(r.chal), (r) => yes(r.chal)),
      metric("周囲に使い方を共有・推薦「はい」", "share", (r) => yes(r.share), (r) => yes(r.share)),
      metric("開発フロー: 大幅に変化あり", "flow", (r) => r.flow === "大幅に変化あり", (r) => r.flow === "大幅に変化あり"),
      metric("開発フロー: 少し変化あり", "flow", (r) => r.flow === "少し変化あり", (r) => r.flow === "少し変化あり"),
      metric("開発フロー: 全く変化無し", "flow", (r) => r.flow === "全く変化無し", (r) => r.flow === "全く変化無し"),
      metric("セキュリティ・品質の懸念あり", "concern", (r) => hasConcern(r.concern), (r) => yes(r.concern), "今回は複数選択で「特になし」以外を選んだ人、前回は「はい」"),
    ],
    [2, 4, 6, 7],
  );

  // ------------------------------------------------------------------
  // 3. 選択肢分布の比較
  // ------------------------------------------------------------------
  const HIST = INTERNAL_QUESTIONS.find((q) => q.title.startsWith(Q.cur.hist)).choices;
  const HOURS = INTERNAL_QUESTIONS.find((q) => q.title.startsWith(Q.cur.hours)).choices;
  const dist = (label, choices, key) => {
    put(
      label,
      ["選択肢", "今回(社内)", "今回 %", "前回(全体)", "前回 %", "前回(社内のみ)", "前回 %"],
      distRows_(choices, [cur, prev, prevInt].map((t) => t.map((r) => r[key]))),
      [2, 4, 6],
    );
  };
  dist("3-1. ClaudeCode の利用歴", HIST, "hist");
  dist("3-2. 1週間あたりの平均利用時間", HOURS, "hours");
  put(
    "3-3. ClaudeCode が最も役立ったフェーズ（複数選択・回答者ベースの選択率）",
    ["選択肢", "今回(社内)", "今回 %", "前回(全体)", "前回 %", "前回(社内のみ)", "前回 %"],
    multiRows_(PHASES, [cur, prev, prevInt].map((t) => t.map((r) => r.phases))),
    [2, 4, 6],
  );

  // ------------------------------------------------------------------
  // 4. 今回のみの設問（複数選択・単一選択の件数）
  // ------------------------------------------------------------------
  const choicesOf = (prefix) => INTERNAL_QUESTIONS.find((q) => q.title.startsWith(prefix)).choices;
  const single = (label, key, prefix) =>
    put(label, ["選択肢", "件数", "割合"], distRows_(choicesOf(prefix), [cur.map((r) => r[key])]), [2]);
  const multi = (label, key, prefix) =>
    put(label, ["選択肢", "件数", "選択率（回答者ベース）"], multiRows_(choicesOf(prefix), [cur.map((r) => r[key])]), [2]);
  single("4-1. 前回（2026年4月）と比べた AI との向き合い方の変化（設問 9）", "mind", Q.cur.mind);
  multi("4-2. 短縮できた時間の使い道（設問 5-2）", "timeUse", Q.cur.timeUse);
  multi("4-3. セキュリティ・品質面の懸念（設問 12）", "concern", Q.cur.concern);
  multi("4-4. よく使う機能（設問 13）", "feats", Q.cur.feats);
  multi("4-5. AIラボチームに期待するサポート（設問 17）", "support", Q.cur.support);
  put(
    "4-6. 速度変化スコアの分布（設問 5, 1=変化なし 〜 5=大幅に向上）",
    ["スコア", "件数", "割合"],
    distRows_(["1", "2", "3", "4", "5"], [cur.map((r) => String(Number(r.speed) || ""))]),
    [2],
  );

  // ------------------------------------------------------------------
  // 5. クロス集計（今回・社内）
  // ------------------------------------------------------------------
  const cross = (label, choices, key) =>
    put(
      label,
      ["区分", "人数", "速度スコア平均", "速度向上 %", "貢献はい %", "不安はい %", "フロー大幅 %", "共有はい %"],
      choices
        .map((c) => {
          const g = cur.filter((r) => r[key] === c);
          if (!g.length) return null;
          const avg = g.reduce((s, r) => s + Number(r.speed || 0), 0) / g.length;
          return [
            c,
            g.length,
            Math.round(avg * 100) / 100,
            rate_(g, "speed", (r) => improved(r.speed)).p,
            rate_(g, "skill", (r) => yes(r.skill)).p,
            rate_(g, "worry", (r) => yes(r.worry)).p,
            rate_(g, "flow", (r) => r.flow === "大幅に変化あり").p,
            rate_(g, "share", (r) => yes(r.share)).p,
          ];
        })
        .filter(Boolean),
      [3, 4, 5, 6, 7],
    );
  cross("5-1. 週の利用時間 × 効果・不安", HOURS, "hours");
  cross("5-2. 利用歴 × 効果・不安", HIST, "hist");
  cross("5-3. チーム × 効果・不安", countBy_(cur.map((r) => r.team)).map(([k]) => k), "team");

  // ------------------------------------------------------------------
  // 6. 外部案件
  // ------------------------------------------------------------------
  const extChoices = (prefix) => EXTERNAL_QUESTIONS.find((q) => q.title.startsWith(prefix)).choices;
  put(
    "6-1. 外部案件: 概要",
    ["項目", "値"],
    [
      ["回答数", ext.length],
      ["業務効率スコア平均（設問 5）", ext.length ? Math.round((ext.reduce((s, r) => s + Number(r.speed || 0), 0) / ext.length) * 100) / 100 : "-"],
      ["スキルアップに貢献「はい」", rate_(ext, "skill", (r) => yes(r.skill)).text],
      ["依存の不安「はい」", rate_(ext, "worry", (r) => yes(r.worry)).text],
    ],
  );
  put("6-2. 外部案件: AI ツールの利用ルール（設問 2）", ["選択肢", "件数", "割合"], distRows_(extChoices(Q.ext.rule), [ext.map((r) => r.rule)]), [2]);
  put("6-3. 外部案件: 利用している AI ツール（設問 3）", ["選択肢", "件数", "選択率"], multiRows_(extChoices(Q.ext.tools), [ext.map((r) => r.tools)]), [2]);
  put("6-4. 外部案件: AI が役立っている工程（設問 4）", ["選択肢", "件数", "選択率"], multiRows_(PHASES, [ext.map((r) => r.phases)]), [2]);

  // ------------------------------------------------------------------
  // 7. 両回とも回答した人の変化
  // ------------------------------------------------------------------
  const arrow = (order, a, b) => {
    const d = order.indexOf(b) - order.indexOf(a);
    if (order.indexOf(a) < 0 || order.indexOf(b) < 0) return "?";
    return d > 0 ? "↑".repeat(d) : d < 0 ? "↓".repeat(-d) : "→";
  };
  const chg = (a, b) => `${a || "-"} → ${b || "-"}${a && b && a !== b ? " ＊" : ""}`;
  const pairs = both.map((c) => ({ c, p: prev.find((p) => p.email === c.email) }));
  put(
    "7-1. 両回とも回答した人の変化（＊ = 回答が変わった）",
    ["メールアドレス", "チーム(今回)", "利用時間 前→今", "増減", "貢献 前→今", "不安 前→今", "共有 前→今", "チャレンジ 前→今", "フロー 前→今", "考え方の変化(今回 設問9)"],
    pairs.map(({ c, p }) => [
      c.email,
      c.team,
      `${p.hours} → ${c.hours}`,
      arrow(HOURS, p.hours, c.hours),
      chg(p.skill, c.skill),
      chg(p.worry, c.worry),
      chg(p.share, c.share),
      chg(p.chal, c.chal),
      chg(p.flow, c.flow),
      c.mind,
    ]),
  );
  const flip = (key, val) => {
    const a = pairs.filter(({ p }) => p[key] === val).length;
    const b = pairs.filter(({ c }) => c[key] === val).length;
    return `${val}: 前回 ${a}人 → 今回 ${b}人`;
  };
  const moves = pairs.map(({ c, p }) => arrow(HOURS, p.hours, c.hours));
  put(
    `7-2. 両回回答者（${pairs.length}人）のまとめ`,
    ["項目", "値"],
    [
      ["利用時間", `増 ${moves.filter((m) => m.startsWith("↑")).length}人 / 減 ${moves.filter((m) => m.startsWith("↓")).length}人 / 同じ ${moves.filter((m) => m === "→").length}人`],
      ["スキルアップに貢献", flip("skill", "はい")],
      ["依存の不安", flip("worry", "はい")],
      ["周囲に共有", flip("share", "はい")],
      ["開発フロー 大幅に変化あり", flip("flow", "大幅に変化あり")],
      ...countBy_(pairs.map(({ c }) => c.mind)).map(([k, n]) => [`考え方の変化(今回 設問9): ${k}`, `${n}人`]),
    ],
  );

  // ------------------------------------------------------------------
  // 8. 自由記述
  // ------------------------------------------------------------------
  const texts = (label, table, key, heading) =>
    put(
      label,
      ["チーム / 区分", heading],
      table.filter((r) => r[key] !== "").map((r) => [r.team || TAB_EXTERNAL, r[key]]),
    );
  texts("8-1. 困っていること・つまずいていること（設問 16）", cur, "trouble", "内容");
  texts("8-2. 考え方が変わった理由・きっかけ（設問 9-1）", cur, "mindWhy", "内容");
  texts("8-3. うまくいったプロジェクト・改善事例（設問 18）", cur, "cases", "内容");
  texts("8-4. 他の LLM と比べて思うこと（設問 19）", cur, "others", "内容");
  texts("8-5. 外部案件: 社内にも取り入れたいもの（設問 8）", ext, "wish", "内容");
  texts("8-6. 外部案件: 客先での困りごと・制約（設問 9）", ext, "trouble", "内容");

  sheet.setFrozenRows(0);
  sheet.autoResizeColumns(1, 3);
  sheet.setColumnWidth(1, 360);
  ss.toast(`「${TAB_ANALYSIS}」タブを更新しました（社内 ${cur.length} 件 / 外部案件 ${ext.length} 件 / 前回 ${prev.length} 件）`, FORM_TITLE, 10);
  Logger.log(`分析タブを更新: 社内 ${cur.length} / 外部案件 ${ext.length} / 前回 ${prev.length} / 両回回答 ${both.length}`);
}

// ---------------------------------------------------------------------------
// 集計ヘルパー
// ---------------------------------------------------------------------------

/**
 * シートを読み、設問プレフィックス表（constants.js の Q.*）に基づいて 1 行を 1 オブジェクトにする。
 * 見つからない列は "" になる（設問の無い前回シートなどを許容するため）。
 * 空行は除く。値は文字列化して前後の空白を除く。
 */
function readTable_(sheet, prefixes) {
  if (!sheet) throw new Error("集計対象のシートがありません。");
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map((h) => String(h));
  const index = {};
  Object.keys(prefixes).forEach((key) => {
    index[key] = headers.findIndex((h) => h.startsWith(prefixes[key]));
  });
  return values
    .slice(1)
    .filter((r) => r.some((c) => c !== "" && c !== null))
    .map((r) => {
      const obj = {};
      Object.keys(index).forEach((key) => {
        const i = index[key];
        obj[key] = i < 0 || r[i] === null ? "" : String(r[i]).trim();
      });
      return obj;
    });
}

/**
 * key の回答がある行を分母に、述語 pred(row) を満たす件数を数える。
 * { k, n, p, text } を返す（p は割合、n=0 のとき "-"）。
 */
function rate_(rows, key, pred) {
  const answered = rows.filter((r) => r[key] !== "" && r[key] !== undefined);
  const n = answered.length;
  const k = answered.filter(pred).length;
  return { k, n, p: n ? k / n : "-", text: n ? `${k} / ${n}` : "-" };
}

/** 値の出現回数を [値, 件数] の配列（件数降順）で返す。 */
function countBy_(values) {
  const map = new Map();
  values.filter((v) => v !== "").forEach((v) => map.set(v, (map.get(v) || 0) + 1));
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * 単一選択の分布表。columns は各データセットの回答値配列。
 * 選択肢ごとに [選択肢, 件数, 割合, 件数, 割合, ...] を返し、定義外の回答は「その他」にまとめる。
 * 割合の分母はそのデータセットで回答があった件数。
 */
function distRows_(choices, columns) {
  const answered = columns.map((col) => col.filter((v) => v !== ""));
  const rows = choices.map((c) => {
    const cells = [c];
    answered.forEach((col) => {
      const k = col.filter((v) => v === c).length;
      cells.push(k, col.length ? k / col.length : "-");
    });
    return cells;
  });
  const other = ["その他（定義外の回答）"];
  let hasOther = false;
  answered.forEach((col) => {
    const k = col.filter((v) => !choices.includes(v)).length;
    if (k) hasOther = true;
    other.push(k, col.length ? k / col.length : "-");
  });
  if (hasOther) rows.push(other);
  const total = ["回答数"];
  answered.forEach((col) => total.push(col.length, ""));
  rows.push(total);
  return rows;
}

/**
 * 複数選択（"a, b, c" 形式）の選択率表。columns は各データセットの回答値配列。
 * 選択肢ごとに [選択肢, 件数, 選択率, ...] を返す。分母は回答があった人数。
 * どの選択肢にも一致しない断片（「その他」の自由入力）は「その他（自由入力）」にまとめる。
 */
function multiRows_(choices, columns) {
  const answered = columns.map((col) => col.filter((v) => v !== "").map((v) => splitMulti_(v, choices)));
  const rows = choices.map((c) => {
    const cells = [c];
    answered.forEach((col) => {
      const k = col.filter((parts) => parts.includes(c)).length;
      cells.push(k, col.length ? k / col.length : "-");
    });
    return cells;
  });
  const other = ["その他（自由入力）"];
  let hasOther = false;
  answered.forEach((col) => {
    const k = col.filter((parts) => parts.some((p) => !choices.includes(p))).length;
    if (k) hasOther = true;
    other.push(k, col.length ? k / col.length : "-");
  });
  if (hasOther) rows.push(other);
  const total = ["回答数"];
  answered.forEach((col) => total.push(col.length, ""));
  rows.push(total);
  return rows;
}

/**
 * "a, b, c" を選択肢配列に分解する。選択肢の文言を先に取り除いてから残りを「その他」として扱うため、
 * 自由入力にカンマが含まれていても定義済みの選択肢の判定はずれない。
 */
function splitMulti_(value, choices) {
  let rest = String(value);
  const parts = [];
  choices.forEach((c) => {
    if (rest.includes(c)) {
      parts.push(c);
      rest = rest.split(c).join("");
    }
  });
  rest
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .forEach((s) => parts.push(s));
  return parts;
}

/**
 * セクション（見出し + ヘッダー + 行）を書き込み、次に書ける行番号を返す。
 * pctCols は 0 始まりの列番号で、その列を % 表示にする。
 */
function writeSection_(sheet, row, title, header, rows, pctCols) {
  sheet.getRange(row, 1).setValue(title).setFontWeight("bold").setFontSize(11);
  row += 1;
  if (header && header.length) {
    sheet.getRange(row, 1, 1, header.length).setValues([header]).setFontWeight("bold").setBackground("#efefef");
    row += 1;
  }
  if (rows && rows.length) {
    const width = Math.max(...rows.map((r) => r.length), header ? header.length : 1);
    const norm = rows.map((r) => [...r, ...Array(width - r.length).fill("")]);
    sheet.getRange(row, 1, norm.length, width).setValues(norm);
    (pctCols || []).forEach((c) => sheet.getRange(row, c + 1, norm.length, 1).setNumberFormat("0.0%"));
    row += norm.length;
  } else {
    sheet.getRange(row, 1).setValue("（該当なし）").setFontColor("#888888");
    row += 1;
  }
  return row + 1;
}
