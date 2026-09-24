/**
 * 社内/外部案件で分岐する1本のアンケートフォームを作成し、
 * 回答を所属ごとにスプレッドシートの「社内」「外部案件」タブへ振り分ける。
 * 使い方: script.google.com に貼り付け → createSurvey を1回だけ実行
 */
const FORM_TITLE = "ClaudeCode・AI活用 実態アンケート";
const TAB_INTERNAL = "社内";
const TAB_EXTERNAL = "外部案件";
const EXTERNAL_LABEL = "外部案件";
const YN = ["はい", "いいえ"];
const PHASES = [
  "調査",
  "要件定義",
  "設計",
  "実装",
  "環境構築",
  "テスト",
  "デバッグ（バグ修正）",
  "ドキュメント化",
  "プレゼン資料作成",
  "日々の業務改善（定型作業など）",
  "特になし",
  "その他",
];

function createSurvey() {
  const form = FormApp.create(FORM_TITLE);
  form.setDescription(
    "ClaudeCode・AIツールの利用状況、効果、および今後の改善点に関するフィードバックを収集するためのアンケートです。皆様のご協力をお願いいたします。",
  );
  form.setCollectEmail(true);

  // ===== 共通: 所属（ここで分岐）=====
  const affiliation = form
    .addMultipleChoiceItem()
    .setTitle("現在の主な所属を教えてください")
    .setRequired(true);

  // ===== 社内セクション =====
  const internalPage = form
    .addPageBreakItem()
    .setTitle("社内PJの方への質問")
    .setHelpText("社内で配布されたClaudeCodeの利用状況について伺います。");
  const I = [];
  const addI = (item) => {
    I.push(item);
    return item;
  };

  addI(
    form
      .addMultipleChoiceItem()
      .setTitle("チーム名を教えてください")
      .setChoiceValues(["塩見チーム", "吉川チーム", "新井チーム"])
      .showOtherOption(true)
      .setRequired(true),
  );
  addI(
    form
      .addTextItem()
      .setTitle(
        "1. 関わっているPJ名もしくはPJの概要を教えてください（例: ナレッジベース共有サービス）",
      )
      .setRequired(true),
  );
  addI(
    form
      .addMultipleChoiceItem()
      .setTitle(
        "2. あなたのClaudeCodeの利用歴（個人の利用も含む）を教えてください。",
      )
      .setChoiceValues([
        "1か月未満",
        "3か月未満",
        "半年未満",
        "1年未満",
        "1年以上",
      ])
      .setRequired(true),
  );
  addI(
    form
      .addMultipleChoiceItem()
      .setTitle(
        "3. 社内で配布されたClaudeCodeの、1週間あたりの平均利用時間をお答えください。",
      )
      .setChoiceValues([
        "利用できていない",
        "1時間未満",
        "5時間未満",
        "10時間未満",
        "20時間未満",
        "40時間未満",
        "40時間以上",
      ])
      .setRequired(true),
  );
  addI(
    form
      .addParagraphTextItem()
      .setTitle(
        "3-1. 質問3で「利用できていない」と回答された方は、その理由を具体的にお教えください。",
      ),
  );
  addI(
    form
      .addMultipleChoiceItem()
      .setTitle(
        "4. 担当業務のうち、AIを使っている業務の割合（体感）を教えてください。",
      )
      .setChoiceValues(["0%", "25%未満", "50%未満", "75%未満", "75%以上"])
      .setRequired(true),
  );
  addI(
    form
      .addScaleItem()
      .setTitle(
        "5. ClaudeCode導入前後で、コード生成量・タスク完了速度はどの程度変化しましたか？（体感でも可）",
      )
      .setBounds(1, 5)
      .setLabels("変化なし", "大幅に向上")
      .setRequired(true),
  );
  addI(
    form
      .addParagraphTextItem()
      .setTitle(
        "5-1. 変化があった方は、具体的な事例（例: 以前と比べて〇〇のタスク完了速度が上がった）をお教えください。",
      ),
  );
  addI(
    form
      .addMultipleChoiceItem()
      .setTitle(
        "6. ClaudeCodeの利用により、普段触れない言語や技術へのチャレンジが増えましたか？",
      )
      .setChoiceValues(YN),
  );
  addI(
    form
      .addMultipleChoiceItem()
      .setTitle(
        "7. ClaudeCodeの利用は、自身のスキルアップに貢献していると感じましたか？",
      )
      .setChoiceValues(YN)
      .setRequired(true),
  );
  addI(
    form
      .addMultipleChoiceItem()
      .setTitle(
        "8. ClaudeCodeへの依存により、自分のスキルアップが滞っている、あるいは不安だと感じますか？",
      )
      .setChoiceValues(YN)
      .setRequired(true),
  );
  addI(
    form
      .addMultipleChoiceItem()
      .setTitle(
        "9. 周囲のメンバーへClaudeCodeの使い方を共有・推薦したことはありますか？",
      )
      .setChoiceValues(YN)
      .setRequired(true),
  );
  addI(
    form
      .addMultipleChoiceItem()
      .setTitle(
        "10. ClaudeCodeの導入によって、チームの開発フロー（設計、コーディング、レビュー、ドキュメント作成など）に変化はありましたか？",
      )
      .setChoiceValues(["全く変化無し", "少し変化あり", "大幅に変化あり"])
      .setRequired(true),
  );
  addI(
    form
      .addMultipleChoiceItem()
      .setTitle(
        "11. ClaudeCodeの利用に関して、セキュリティや品質面での懸念はありますか？",
      )
      .setChoiceValues(YN)
      .setRequired(true),
  );
  addI(
    form
      .addCheckboxItem()
      .setTitle("12. よく使うClaudeCodeの機能をすべて選択してください。")
      .setChoiceValues([
        "スキル",
        "マーケットプレイスのプラグイン",
        "MCP連携",
        "サブエージェント",
        "スラッシュコマンド",
        "CLAUDE.md",
        "特になし",
      ])
      .showOtherOption(true)
      .setRequired(true),
  );
  addI(
    form
      .addCheckboxItem()
      .setTitle(
        "13. 開発プロセスにおいて、ClaudeCodeが最も役立ったフェーズをすべて選択してください。",
      )
      .setChoiceValues(PHASES)
      .setRequired(true),
  );
  addI(
    form
      .addParagraphTextItem()
      .setTitle(
        "13-1. 質問13で選択したフェーズ（最も役立った点）について、具体的な事例を教えてください。",
      ),
  );
  addI(
    form
      .addTextItem()
      .setTitle(
        "14. AIレポートスキルの実行結果があれば、共有URLを記載してください。（任意）",
      ),
  );
  addI(
    form
      .addCheckboxItem()
      .setTitle("15. AIラボチームに期待するサポートをすべて選択してください。")
      .setChoiceValues([
        "ハーネス導入支援",
        "勉強会・ハンズオン",
        "ナレッジ記事の充実",
        "スキル・プラグインの提供",
        "個別相談",
        "特になし",
      ])
      .showOtherOption(true),
  );
  addI(
    form
      .addParagraphTextItem()
      .setTitle(
        "16. その他 ClaudeCodeを活用して「うまくいったプロジェクト」や「具体的な改善事例」があれば、簡単にお教えください。（任意）",
      ),
  );
  addI(
    form
      .addParagraphTextItem()
      .setTitle(
        "17. 他のLLM（例: Copilot, Gemini, Codexなど）とClaudeCodeを比べたときに、特に思うことがあれば記載してください。（任意）",
      ),
  );

  // ===== 外部案件セクション =====
  const externalPage = form
    .addPageBreakItem()
    .setTitle("外部案件の方への質問")
    .setHelpText("守秘義務の範囲で、話せる内容のみご回答ください。");
  externalPage.setGoToPage(FormApp.PageNavigationType.SUBMIT); // 社内セクション終了後は送信へ
  const E = [];
  const addE = (item) => {
    E.push(item);
    return item;
  };

  addE(
    form
      .addTextItem()
      .setTitle("1. 案件の概要を教えてください（話せる範囲で）")
      .setRequired(true),
  );
  addE(
    form
      .addMultipleChoiceItem()
      .setTitle("2. 案件内でのAIツールの利用ルールを教えてください。")
      .setChoiceValues([
        "利用禁止",
        "許可されたツールのみ利用可",
        "自由に利用可",
        "分からない",
      ])
      .setRequired(true),
  );
  addE(
    form
      .addCheckboxItem()
      .setTitle("3. 案件で利用しているAIツールをすべて選択してください。")
      .setChoiceValues([
        "GitHub Copilot",
        "ChatGPT",
        "Gemini",
        "Claude（Claude Code含む）",
        "Cursor",
        "客先独自のAIツール",
        "利用していない",
      ])
      .showOtherOption(true)
      .setRequired(true),
  );
  addE(
    form
      .addCheckboxItem()
      .setTitle("4. AIが役立っている工程をすべて選択してください。")
      .setChoiceValues(PHASES)
      .setRequired(true),
  );
  addE(
    form
      .addScaleItem()
      .setTitle("5. AI活用による業務効率の変化（体感）を教えてください。")
      .setBounds(1, 5)
      .setLabels("変化なし", "大幅に向上")
      .setRequired(true),
  );
  addE(
    form
      .addParagraphTextItem()
      .setTitle(
        "6. 社内にも取り入れたいと思った使い方・ルール・ツールがあれば教えてください。",
      ),
  );
  addE(
    form
      .addParagraphTextItem()
      .setTitle(
        "7. 客先でのAI利用で困っていること・制約があれば教えてください。",
      ),
  );
  addE(
    form
      .addMultipleChoiceItem()
      .setTitle("8. 社内で進めているハーネス整備の取り組みに関心はありますか？")
      .setChoiceValues([
        "ぜひ聞きたい",
        "機会があれば聞きたい",
        "特に関心はない",
      ])
      .setRequired(true),
  );

  // ===== 分岐設定 =====
  affiliation.setChoices([
    affiliation.createChoice("社内PJ（ClaudeCode配布あり）", internalPage),
    affiliation.createChoice(EXTERNAL_LABEL, externalPage),
  ]);

  // ===== スプレッドシート（社内/外部案件タブ）=====
  const ss = SpreadsheetApp.create(FORM_TITLE + "（回答）");
  const internalTab = ss.getSheets()[0].setName(TAB_INTERNAL);
  const externalTab = ss.insertSheet(TAB_EXTERNAL);
  internalTab
    .appendRow([
      "タイムスタンプ",
      "メールアドレス",
      ...I.map((i) => i.getTitle()),
    ])
    .setFrozenRows(1);
  externalTab
    .appendRow([
      "タイムスタンプ",
      "メールアドレス",
      ...E.map((i) => i.getTitle()),
    ])
    .setFrozenRows(1);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId()); // 全回答の原本タブも自動生成される

  PropertiesService.getScriptProperties().setProperties({
    SS_ID: ss.getId(),
    AFFIL_ID: String(affiliation.getId()),
    INT_IDS: JSON.stringify(I.map((i) => i.getId())),
    EXT_IDS: JSON.stringify(E.map((i) => i.getId())),
  });
  ScriptApp.newTrigger("onSubmit").forForm(form).onFormSubmit().create();

  Logger.log("フォーム編集URL: " + form.getEditUrl());
  Logger.log("回答URL: " + form.getPublishedUrl());
  Logger.log("スプレッドシート: " + ss.getUrl());
}

/** 送信時トリガー: 所属に応じて該当タブへ1行追記 */
function onSubmit(e) {
  const p = PropertiesService.getScriptProperties();
  const res = e.response;
  const answers = {};
  res.getItemResponses().forEach((r) => {
    const v = r.getResponse();
    answers[r.getItem().getId()] = Array.isArray(v) ? v.join(", ") : v;
  });

  const isExternal = answers[p.getProperty("AFFIL_ID")] === EXTERNAL_LABEL;
  const ids = JSON.parse(p.getProperty(isExternal ? "EXT_IDS" : "INT_IDS"));
  SpreadsheetApp.openById(p.getProperty("SS_ID"))
    .getSheetByName(isExternal ? TAB_EXTERNAL : TAB_INTERNAL)
    .appendRow([
      res.getTimestamp(),
      res.getRespondentEmail(),
      ...ids.map((id) => answers[id] ?? ""),
    ]);
}
