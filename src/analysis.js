/**
 * ===== 分析 =====
 *   buildAnalysis : 「分析」「分析_明細」タブを数式とグラフで組み立てる（GAS エディタから実行）
 *
 * 集計はすべてスプレッドシートの数式（COUNTIF / COUNTIFS / FILTER など）で行い、
 * 「社内」「外部案件」タブを直接参照する。回答が増えれば表もグラフも即座に更新されるため、
 * buildAnalysis の再実行は「設問や選択肢を変えたとき」だけでよい。
 *
 * 前回アンケート（2026年4月・終了済み）は PREV_SPREADSHEET_ID から値を写した非表示タブ
 * （TAB_PREV）を参照する。前回分は増えないので写しで問題ない。
 *
 * 回答データ（社内 / 外部案件 / 前回スプレッドシート）には一切書き込まない。
 * 「分析」「分析_明細」タブは毎回クリアして作り直すので、何度実行しても同じ結果になる。
 */

/** 「分析」「分析_明細」タブを作り直す。 */
function buildAnalysis() {
  const ss = getBoundSpreadsheet_();
  const prevSheet = copyPrevResponses_(ss);
  const cur = tableRefs_(ss.getSheetByName(TAB_INTERNAL), Q.cur);
  const ext = tableRefs_(ss.getSheetByName(TAB_EXTERNAL), Q.ext);
  const prev = tableRefs_(prevSheet, Q.prev);

  buildSummaryTab_(ss, cur, ext, prev);
  buildDetailTab_(ss, cur, ext, prev);

  ss.toast(`「${TAB_ANALYSIS}」「${TAB_ANALYSIS_DETAIL}」タブを作り直しました`, FORM_TITLE, 10);
  Logger.log(`分析タブを作り直しました（数式ベース。回答が増えると自動で更新されます）`);
}

// ---------------------------------------------------------------------------
// 分析タブ（集計表 + グラフ）
// ---------------------------------------------------------------------------

function buildSummaryTab_(ss, cur, ext, prev) {
  const sheet = resetSheet_(ss, TAB_ANALYSIS);
  const charts = chartPlacer_(sheet);
  let row = 1;
  const put = (title, header, rows, pctCols) => {
    const start = row;
    row = writeSection_(sheet, row, title, header, rows, pctCols);
    return { title: start, header: start + 1, body: start + 2, count: rows.length };
  };
  const teams = PREV_INTERNAL_TEAMS;
  const prevIntCount = (key, crit) =>
    teams.map((t) => `COUNTIFS(${prev.r(key)},"${crit}",${prev.r("team")},"${t}")`).join("+");
  const prevIntAnswered = (key) =>
    teams.map((t) => `COUNTIFS(${prev.r(key)},"<>",${prev.r("team")},"${t}")`).join("+");

  // ---- 1. 概要 ----
  put(
    "1. 概要（数式で自動更新。設問や選択肢を変えたときだけ buildAnalysis を再実行）",
    ["項目", "値", "備考"],
    [
      ["今回 回答数（社内）", `=COUNTA(${cur.r("email")})`, `「${TAB_INTERNAL}」タブ`],
      ["今回 回答数（外部案件）", `=COUNTA(${ext.r("email")})`, `「${TAB_EXTERNAL}」タブ`],
      ["前回 回答数（全体）", `=COUNTA(${prev.r("email")})`, "2026年4月実施。所属で分岐していなかったため全員が同じ設問に回答"],
      ["前回 回答数（社内チーム所属のみ）", `=${prevIntAnswered("email")}`, `チーム名が ${teams.join(" / ")} の回答。今回の「社内」と比較する基準`],
      ["両回とも回答した人", `=SUMPRODUCT((COUNTIF(${prev.r("email")},${cur.r("email")})>0)*(${cur.r("email")}<>""))`, `メールアドレスが一致した人数（「${TAB_ANALYSIS_DETAIL}」タブに一覧）`],
      ...choicesOf_(INTERNAL_QUESTIONS, Q.cur.team).map((t) => [`今回 チーム別: ${t}`, `=COUNTIF(${cur.r("team")},"${t}")`, ""]),
      ["今回 チーム別: その他", `=COUNTA(${cur.r("team")})-${choicesOf_(INTERNAL_QUESTIONS, Q.cur.team).map((t) => `COUNTIF(${cur.r("team")},"${t}")`).join("-")}`, "選択肢以外を入力した人"],
    ],
  );

  // ---- 2. 主要指標の前回比較 ----
  // 各行: [指標, 今回k, 今回n, 今回%, 前回全体k, n, %, 前回社内k, n, %, 差分, 備考]
  const metric = (label, key, curCount, prevCount, prevIntCountF, note) => (r) => [
    label,
    `=${curCount}`,
    `=COUNTA(${cur.r(key)})`,
    `=IFERROR(B${r}/C${r},"-")`,
    `=${prevCount}`,
    `=COUNTA(${prev.r(key)})`,
    `=IFERROR(E${r}/F${r},"-")`,
    `=${prevIntCountF}`,
    `=${prevIntAnswered(key)}`,
    `=IFERROR(H${r}/I${r},"-")`,
    `=IFERROR(D${r}-J${r},"-")`,
    note || "",
  ];
  const simple = (label, key, curCrit, prevCrit, note) =>
    metric(label, key, `COUNTIF(${cur.r(key)},"${curCrit}")`, `COUNTIF(${prev.r(key)},"${prevCrit}")`, prevIntCount(key, prevCrit), note);
  const metrics = [
    simple("生産性: 速度向上を実感", "speed", `>=${SPEED_IMPROVED_MIN}`, "はい", `今回は 1〜5 スケールの ${SPEED_IMPROVED_MIN} 以上、前回は「はい」`),
    simple("成長: スキルアップに貢献「はい」", "skill", "はい", "はい"),
    simple("成長課題: スキルアップに貢献「いいえ」", "skill", "いいえ", "いいえ", "前回「分析」タブの K列 指標"),
    simple("危機感: 依存でスキルアップが滞る不安「はい」", "worry", "はい", "はい", "前回「分析」タブの L列 指標"),
    metric(
      "ジレンマ層: 速度↑ かつ 貢献いいえ かつ 不安はい",
      "speed",
      `COUNTIFS(${cur.r("speed")},">=${SPEED_IMPROVED_MIN}",${cur.r("skill")},"いいえ",${cur.r("worry")},"はい")`,
      `COUNTIFS(${prev.r("speed")},"はい",${prev.r("skill")},"いいえ",${prev.r("worry")},"はい")`,
      teams.map((t) => `COUNTIFS(${prev.r("speed")},"はい",${prev.r("skill")},"いいえ",${prev.r("worry")},"はい",${prev.r("team")},"${t}")`).join("+"),
      "前回「分析」タブの複合指標（分母は回答者全員）",
    ),
    simple("新しい言語・技術へのチャレンジ「はい」", "chal", "はい", "はい"),
    simple("周囲に使い方を共有・推薦「はい」", "share", "はい", "はい"),
    simple("開発フロー: 大幅に変化あり", "flow", "大幅に変化あり", "大幅に変化あり"),
    simple("開発フロー: 少し変化あり", "flow", "少し変化あり", "少し変化あり"),
    simple("開発フロー: 全く変化無し", "flow", "全く変化無し", "全く変化無し"),
    metric(
      "セキュリティ・品質の懸念あり",
      "concern",
      `COUNTIFS(${cur.r("concern")},"<>",${cur.r("concern")},"<>*特になし*")`,
      `COUNTIF(${prev.r("concern")},"はい")`,
      prevIntCount("concern", "はい"),
      "今回は複数選択で「特になし」以外を選んだ人、前回は「はい」",
    ),
  ];
  const sec2 = put(
    "2. 主要指標の前回比較（割合は各設問の回答者ベース）",
    ["指標", "今回 該当", "今回 回答", "今回 %", "前回全体 該当", "前回全体 回答", "前回全体 %", "前回社内 該当", "前回社内 回答", "前回社内 %", "差分 (今回−前回社内)", "備考"],
    metrics.map((m, i) => m(row + 2 + i)),
    [3, 6, 9, 10],
  );
  charts.bar(sec2, "主要指標: 今回 vs 前回（社内チームのみ）", [1, 4, 10], { percent: true, height: 420 });

  // ---- 3. 選択肢分布の比較 ----
  // 各行: [選択肢, 今回件数, 今回%, 前回全体件数, %, 前回社内件数, %]
  const distSection = (title, choices, key, multi) => {
    const crit = (c) => (multi ? `*${c}*` : c);
    const n = choices.length;
    const totalRow = row + 2 + n; // 「回答数」行
    const rows = choices.map((c, i) => {
      const r = row + 2 + i;
      return [
        c,
        `=COUNTIF(${cur.r(key)},"${crit(c)}")`,
        `=IFERROR(B${r}/B${totalRow},"-")`,
        `=COUNTIF(${prev.r(key)},"${crit(c)}")`,
        `=IFERROR(D${r}/D${totalRow},"-")`,
        `=${prevIntCount(key, crit(c))}`,
        `=IFERROR(F${r}/F${totalRow},"-")`,
      ];
    });
    rows.push(["回答数", `=COUNTA(${cur.r(key)})`, "", `=COUNTA(${prev.r(key)})`, "", `=${prevIntAnswered(key)}`, ""]);
    return put(title, ["選択肢", "今回(社内)", "今回 %", "前回(全体)", "前回 %", "前回(社内のみ)", "前回 %"], rows, [2, 4, 6]);
  };
  const HIST = choicesOf_(INTERNAL_QUESTIONS, Q.cur.hist);
  const HOURS = choicesOf_(INTERNAL_QUESTIONS, Q.cur.hours);
  let sec = distSection("3-1. ClaudeCode の利用歴", HIST, "hist", false);
  charts.column(sec, "利用歴の分布", [1, 3, 7], { percent: true, skipLast: 1 });
  sec = distSection("3-2. 1週間あたりの平均利用時間", HOURS, "hours", false);
  charts.column(sec, "週の利用時間の分布", [1, 3, 7], { percent: true, skipLast: 1 });
  sec = distSection("3-3. ClaudeCode が最も役立ったフェーズ（複数選択・回答者ベースの選択率）", PHASES, "phases", true);
  charts.bar(sec, "役立ったフェーズの選択率", [1, 3, 7], { percent: true, skipLast: 1, height: 420 });

  // ---- 4. 今回のみの設問 ----
  // 各行: [選択肢, 件数, 割合]
  const curOnly = (title, key, choices, multi, extra) => {
    const crit = (c) => (multi ? `*${c}*` : c);
    const n = choices.length + (extra ? 1 : 0);
    const totalRow = row + 2 + n;
    const rows = choices.map((c, i) => [c, `=COUNTIF(${cur.r(key)},"${crit(c)}")`, `=IFERROR(B${row + 2 + i}/B${totalRow},"-")`]);
    if (extra) {
      const r = row + 2 + choices.length;
      // 定義済み選択肢に一致しない回答（「その他」の自由入力）
      const known = choices.map((c) => `COUNTIF(${cur.r(key)},"${multi ? `*${c}*` : c}")`).join("+");
      rows.push([
        multi ? "定義済みの選択肢を含まない回答" : "その他（定義外の回答）",
        multi
          ? `=COUNTIFS(${cur.r(key)},"<>",${choices.map((c) => `${cur.r(key)},"<>*${c}*"`).join(",")})`
          : `=COUNTA(${cur.r(key)})-(${known})`,
        `=IFERROR(B${r}/B${totalRow},"-")`,
      ]);
    }
    rows.push(["回答数", `=COUNTA(${cur.r(key)})`, ""]);
    return put(title, ["選択肢", "件数", multi ? "選択率（回答者ベース）" : "割合"], rows, [2]);
  };
  sec = curOnly("4-1. 前回（2026年4月）と比べた AI との向き合い方の変化（設問 9）", "mind", choicesOf_(INTERNAL_QUESTIONS, Q.cur.mind), false, true);
  charts.pie(sec, "AI との向き合い方の変化", [1, 2], { skipLast: 2 });
  sec = curOnly("4-2. 短縮できた時間の使い道（設問 5-2）", "timeUse", choicesOf_(INTERNAL_QUESTIONS, Q.cur.timeUse), true, true);
  charts.bar(sec, "短縮できた時間の使い道", [1, 3], { percent: true, skipLast: 2 });
  sec = curOnly("4-3. セキュリティ・品質面の懸念（設問 12）", "concern", choicesOf_(INTERNAL_QUESTIONS, Q.cur.concern), true, true);
  charts.bar(sec, "セキュリティ・品質面の懸念", [1, 3], { percent: true, skipLast: 2 });
  sec = curOnly("4-4. よく使う機能（設問 13）", "feats", choicesOf_(INTERNAL_QUESTIONS, Q.cur.feats), true, true);
  charts.bar(sec, "よく使う機能", [1, 3], { percent: true, skipLast: 2 });
  sec = curOnly("4-5. AIラボチームに期待するサポート（設問 17）", "support", choicesOf_(INTERNAL_QUESTIONS, Q.cur.support), true, true);
  charts.bar(sec, "期待するサポート", [1, 3], { percent: true, skipLast: 2 });
  sec = curOnly("4-6. 速度変化スコアの分布（設問 5, 1=変化なし 〜 5=大幅に向上）", "speed", ["1", "2", "3", "4", "5"], false, false);
  charts.column(sec, "速度変化スコアの分布", [1, 2], { skipLast: 1 });

  // ---- 5. クロス集計 ----
  const cross = (title, choices, key) => {
    const rows = choices.map((c, i) => {
      const r = row + 2 + i;
      const g = `${cur.r(key)},"${c}"`;
      const pct = (k, crit) => `=IFERROR(COUNTIFS(${g},${cur.r(k)},"${crit}")/B${r},"-")`;
      return [
        c,
        `=COUNTIF(${cur.r(key)},"${c}")`,
        `=IFERROR(ROUND(AVERAGEIFS(${cur.r("speed")},${g}),2),"-")`,
        pct("speed", `>=${SPEED_IMPROVED_MIN}`),
        pct("skill", "はい"),
        pct("worry", "はい"),
        pct("flow", "大幅に変化あり"),
        pct("share", "はい"),
      ];
    });
    return put(title, ["区分", "人数", "速度スコア平均", "速度向上 %", "貢献はい %", "不安はい %", "フロー大幅 %", "共有はい %"], rows, [3, 4, 5, 6, 7]);
  };
  sec = cross("5-1. 週の利用時間 × 効果・不安", HOURS, "hours");
  charts.column(sec, "利用時間 × 速度向上 / 不安", [1, 4, 6], { percent: true });
  cross("5-2. 利用歴 × 効果・不安", HIST, "hist");
  cross("5-3. チーム × 効果・不安", choicesOf_(INTERNAL_QUESTIONS, Q.cur.team), "team");

  // ---- 6. 外部案件 ----
  put(
    "6-1. 外部案件: 概要",
    ["項目", "値"],
    [
      ["回答数", `=COUNTA(${ext.r("email")})`],
      ["業務効率スコア平均（設問 5）", `=IFERROR(ROUND(AVERAGE(${ext.r("speed")}),2),"-")`],
      ["スキルアップに貢献「はい」", `=COUNTIF(${ext.r("skill")},"はい")&" / "&COUNTA(${ext.r("skill")})`],
      ["依存の不安「はい」", `=COUNTIF(${ext.r("worry")},"はい")&" / "&COUNTA(${ext.r("worry")})`],
    ],
  );
  const extOnly = (title, key, choices, multi) => {
    const crit = (c) => (multi ? `*${c}*` : c);
    const totalRow = row + 2 + choices.length;
    const rows = choices.map((c, i) => [c, `=COUNTIF(${ext.r(key)},"${crit(c)}")`, `=IFERROR(B${row + 2 + i}/B${totalRow},"-")`]);
    rows.push(["回答数", `=COUNTA(${ext.r(key)})`, ""]);
    return put(title, ["選択肢", "件数", multi ? "選択率" : "割合"], rows, [2]);
  };
  extOnly("6-2. 外部案件: AI ツールの利用ルール（設問 2）", "rule", choicesOf_(EXTERNAL_QUESTIONS, Q.ext.rule), false);
  extOnly("6-3. 外部案件: 利用している AI ツール（設問 3）", "tools", choicesOf_(EXTERNAL_QUESTIONS, Q.ext.tools), true);
  extOnly("6-4. 外部案件: AI が役立っている工程（設問 4）", "phases", PHASES, true);

  sheet.setColumnWidth(1, 360);
  for (let c = 2; c <= 12; c += 1) sheet.setColumnWidth(c, 110);
  sheet.setColumnWidth(12, 420);
}

// ---------------------------------------------------------------------------
// 分析_明細タブ（行数が回答に応じて伸びる一覧: 両回回答者の変化・自由記述）
// ---------------------------------------------------------------------------

function buildDetailTab_(ss, cur, ext, prev) {
  const sheet = resetSheet_(ss, TAB_ANALYSIS_DETAIL);
  const HOURS = choicesOf_(INTERNAL_QUESTIONS, Q.cur.hours);
  const hoursArr = `{${HOURS.map((h) => `"${h}"`).join(",")}}`;

  // ---- 7. 両回とも回答した人の変化（A〜J 列） ----
  // A 列に FILTER で該当メールを並べ、B 列以降は ARRAYFORMULA + VLOOKUP で前回・今回の回答を引く
  const first = 4; // データ開始行
  const A = `$A$${first}:$A`;
  const curLookup = (key) => `VLOOKUP(${A},${cur.lookup},${cur.lookupIndex(key)},FALSE)`;
  const prevLookup = (key) => `VLOOKUP(${A},${prev.lookup},${prev.lookupIndex(key)},FALSE)`;
  const arr = (expr) => `=ARRAYFORMULA(IF(${A}="","",IFERROR(${expr},"")))`;
  const change = (key) => arr(`${prevLookup(key)}&" → "&${curLookup(key)}&IF(${prevLookup(key)}<>${curLookup(key)}," ＊","")`);
  sheet.getRange(1, 1).setValue("7-1. 両回とも回答した人の変化（＊ = 回答が変わった。回答が増えると自動で行が伸びる）").setFontWeight("bold").setFontSize(11);
  const header7 = ["メールアドレス", "チーム(今回)", "利用時間 前→今", "増減", "貢献 前→今", "不安 前→今", "共有 前→今", "チャレンジ 前→今", "フロー 前→今", "考え方の変化(今回 設問9)"];
  sheet.getRange(3, 1, 1, header7.length).setValues([header7]).setFontWeight("bold").setBackground("#efefef");
  sheet.getRange(first, 1, 1, header7.length).setValues([
    [
      `=IFERROR(FILTER(${cur.r("email")},COUNTIF(${prev.r("email")},${cur.r("email")})>0),"（該当なし）")`,
      arr(curLookup("team")),
      change("hours"),
      arr(`IF(MATCH(${curLookup("hours")},${hoursArr},0)>MATCH(${prevLookup("hours")},${hoursArr},0),REPT("↑",MATCH(${curLookup("hours")},${hoursArr},0)-MATCH(${prevLookup("hours")},${hoursArr},0)),IF(MATCH(${curLookup("hours")},${hoursArr},0)<MATCH(${prevLookup("hours")},${hoursArr},0),REPT("↓",MATCH(${prevLookup("hours")},${hoursArr},0)-MATCH(${curLookup("hours")},${hoursArr},0)),"→"))`),
      change("skill"),
      change("worry"),
      change("share"),
      change("chal"),
      change("flow"),
      arr(curLookup("mind")),
    ],
  ]);

  // ---- 7-2. まとめ（L〜M 列。7-1 の列を COUNTIF で数える） ----
  const col = (letter) => `$${letter}$${first}:$${letter}`;
  const flip = (letter, val) => `="前回 "&COUNTIF(${col(letter)},"${val} → *")&"人 → 今回 "&COUNTIF(${col(letter)},"* → ${val}*")&"人"`;
  const mindChoices = choicesOf_(INTERNAL_QUESTIONS, Q.cur.mind);
  const summary = [
    ["両回回答者数", `=COUNTIF(${col("B")},"?*")`],
    ["利用時間", `="増 "&COUNTIF(${col("D")},"↑*")&"人 / 減 "&COUNTIF(${col("D")},"↓*")&"人 / 同じ "&COUNTIF(${col("D")},"→")&"人"`],
    ["スキルアップに貢献「はい」", flip("E", "はい")],
    ["依存の不安「はい」", flip("F", "はい")],
    ["周囲に共有「はい」", flip("G", "はい")],
    ["開発フロー「大幅に変化あり」", flip("I", "大幅に変化あり")],
    ...mindChoices.map((m) => [`考え方の変化: ${m}`, `=COUNTIF(${col("J")},"${m}")&"人"`]),
  ];
  writeSection_(sheet, 1, "7-2. 両回回答者のまとめ", ["項目", "値"], summary, [], 12);

  // ---- 8. 自由記述（O 列以降に横並び。各ブロックは回答に応じて下に伸びる） ----
  const texts = [
    ["8-1. 困っていること・つまずいていること（設問 16）", cur, "trouble"],
    ["8-2. 考え方が変わった理由・きっかけ（設問 9-1）", cur, "mindWhy"],
    ["8-3. うまくいったプロジェクト・改善事例（設問 18）", cur, "cases"],
    ["8-4. 他の LLM と比べて思うこと（設問 19）", cur, "others"],
    ["8-5. 外部案件: 社内にも取り入れたいもの（設問 8）", ext, "wish"],
    ["8-6. 外部案件: 客先での困りごと・制約（設問 9）", ext, "trouble"],
  ];
  let c = 15;
  texts.forEach(([title, t, key]) => {
    const label = t === cur ? t.r("team") : `IF(${t.r(key)}<>"","${TAB_EXTERNAL}","")`;
    sheet.getRange(1, c).setValue(title).setFontWeight("bold").setFontSize(11);
    sheet.getRange(3, c, 1, 2).setValues([["チーム / 区分", "内容"]]).setFontWeight("bold").setBackground("#efefef");
    sheet.getRange(first, c).setFormula(`=IFERROR(FILTER({${label},${t.r(key)}},${t.r(key)}<>""),"（該当なし）")`);
    sheet.setColumnWidth(c, 110);
    sheet.setColumnWidth(c + 1, 480);
    sheet.getRange(first, c + 1, 200, 1).setWrap(true);
    c += 3;
  });

  sheet.setFrozenRows(3);
  sheet.setColumnWidth(1, 260);
  sheet.setColumnWidth(12, 240);
  sheet.setColumnWidth(13, 260);
}

// ---------------------------------------------------------------------------
// 前回回答の写し
// ---------------------------------------------------------------------------

/** 前回スプレッドシートの回答を TAB_PREV に値として写し、非表示にする。返り値は写し先のシート。 */
function copyPrevResponses_(ss) {
  const src = SpreadsheetApp.openById(PREV_SPREADSHEET_ID).getSheetByName(PREV_SHEET_NAME);
  if (!src) throw new Error(`前回シートが見つかりません: ${PREV_SHEET_NAME}`);
  const values = src.getDataRange().getValues();
  const dst = resetSheet_(ss, TAB_PREV);
  dst.getRange(1, 1, values.length, values[0].length).setValues(values);
  dst.getRange(1, 1).setNote(`${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")} に前回スプレッドシートから写した値。集計の参照元なので編集しない。`);
  dst.setFrozenRows(1);
  dst.hideSheet();
  return dst;
}

// ---------------------------------------------------------------------------
// 参照ヘルパー
// ---------------------------------------------------------------------------

/**
 * シートのヘッダー行から設問プレフィックス表（constants.js の Q.*）に対応する列を特定し、
 * 数式用の参照文字列を返すヘルパーを作る。
 *   r(key)            : 'シート名'!$X$2:$X（ヘッダーを除いた開いた範囲）
 *   lookup            : VLOOKUP 用の範囲（メールアドレス列〜最終列）
 *   lookupIndex(key)  : lookup 内での列番号（1 始まり）
 */
function tableRefs_(sheet, prefixes) {
  if (!sheet) throw new Error("集計対象のシートがありません。");
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(String);
  const cols = {};
  Object.keys(prefixes).forEach((key) => {
    const i = headers.findIndex((h) => h.startsWith(prefixes[key]));
    if (i < 0) throw new Error(`「${sheet.getName()}」に列が見つかりません: ${prefixes[key]}`);
    cols[key] = i + 1;
  });
  const name = `'${sheet.getName()}'`;
  const emailCol = cols.email;
  const lastCol = Math.max(...Object.values(cols));
  return {
    name,
    cols,
    r: (key) => `${name}!$${colLetter_(cols[key])}$2:$${colLetter_(cols[key])}`,
    lookup: emailCol ? `${name}!$${colLetter_(emailCol)}:$${colLetter_(lastCol)}` : null,
    lookupIndex: (key) => cols[key] - emailCol + 1,
  };
}

/** 1 始まりの列番号を A1 形式の列文字に変換する。 */
function colLetter_(n) {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** 質問定義から、タイトルがプレフィックスで始まる設問の選択肢を返す。 */
function choicesOf_(questions, prefix) {
  const q = questions.find((x) => x.title.startsWith(prefix));
  if (!q || !q.choices) throw new Error(`選択肢のある設問が見つかりません: ${prefix}`);
  return q.choices;
}

/** シートを取得（無ければ作成）し、値・書式・グラフを全て消して返す。 */
function resetSheet_(ss, name) {
  const sheet = ensureSheet_(ss, name);
  sheet.getCharts().forEach((c) => sheet.removeChart(c));
  sheet.clear();
  sheet.setFrozenRows(0);
  if (sheet.isSheetHidden()) sheet.showSheet();
  return sheet;
}

// ---------------------------------------------------------------------------
// 書き出しヘルパー
// ---------------------------------------------------------------------------

/**
 * セクション（見出し + ヘッダー + 行）を書き込み、次に書ける行番号を返す。
 * 値が "=" で始まる文字列は数式として入る。pctCols は 0 始まりの列番号で % 表示にする。
 * startCol は書き始める列（1 始まり、省略時 A 列）。
 */
function writeSection_(sheet, row, title, header, rows, pctCols, startCol) {
  const c0 = startCol || 1;
  sheet.getRange(row, c0).setValue(title).setFontWeight("bold").setFontSize(11);
  row += 1;
  if (header && header.length) {
    sheet.getRange(row, c0, 1, header.length).setValues([header]).setFontWeight("bold").setBackground("#efefef");
    row += 1;
  }
  if (rows && rows.length) {
    const width = Math.max(...rows.map((r) => r.length), header ? header.length : 1);
    const norm = rows.map((r) => [...r, ...Array(width - r.length).fill("")]);
    sheet.getRange(row, c0, norm.length, width).setValues(norm);
    (pctCols || []).forEach((c) => sheet.getRange(row, c0 + c, norm.length, 1).setNumberFormat("0.0%"));
    row += norm.length;
  } else {
    sheet.getRange(row, c0).setValue("（該当なし）").setFontColor("#888888");
    row += 1;
  }
  return row + 1;
}

/**
 * グラフを表の右側に並べて置くヘルパー。
 * 2 列（N 列と Z 列）に交互に配置し、直前のグラフと重ならない行から置く。
 * sec は writeSection_ の戻り値（header 行・body 行・行数）、cols は 1 始まりの列番号
 * （最初の列が項目名、以降が系列）。opts.skipLast で末尾の「回答数」行などを除外する。
 */
function chartPlacer_(sheet) {
  const anchors = [14, 26];
  const nextFree = [1, 1];
  const ROW_PX = 21;
  const place = (type, sec, title, cols, opts) => {
    const o = opts || {};
    const height = o.height || 300;
    const n = sec.count - (o.skipLast || 0);
    if (n <= 0) return;
    const slot = nextFree[0] <= nextFree[1] ? 0 : 1;
    const row = Math.max(sec.header, nextFree[slot]);
    const builder = sheet.newChart().setChartType(type).setPosition(row, anchors[slot], 0, 0);
    cols.forEach((c) => builder.addRange(sheet.getRange(sec.header, c, n + 1, 1)));
    builder
      .setOption("title", title)
      .setOption("width", 560)
      .setOption("height", height)
      .setOption("useFirstColumnAsDomain", true)
      .setOption("legend", { position: type === Charts.ChartType.PIE ? "right" : "bottom" });
    if (o.percent) {
      const axis = { format: "percent", minValue: 0, maxValue: 1 };
      builder.setOption(type === Charts.ChartType.BAR ? "hAxis" : "vAxis", axis);
    }
    if (type === Charts.ChartType.PIE) builder.setOption("pieSliceText", "percentage");
    sheet.insertChart(builder.build());
    nextFree[slot] = row + Math.ceil(height / ROW_PX) + 1;
  };
  return {
    column: (sec, title, cols, opts) => place(Charts.ChartType.COLUMN, sec, title, cols, opts),
    bar: (sec, title, cols, opts) => place(Charts.ChartType.BAR, sec, title, cols, opts),
    pie: (sec, title, cols, opts) => place(Charts.ChartType.PIE, sec, title, cols, opts),
  };
}
