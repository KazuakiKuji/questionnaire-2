/**
 * ===== 定数 =====
 * フォームの名称、質問定義などをここで一元管理する。
 * 質問を追加・変更する場合はこのファイルのみ編集し、createSurvey を再実行する。
 *
 * このスクリプトは回答用スプレッドシートに紐づくコンテナバインドスクリプトとして動作する。
 * スプレッドシートは再生成せず、常に紐づいているものを更新する。
 */

// ---- 名称 ----
const FORM_TITLE = "ClaudeCode・AI活用 実態アンケート";
const FORM_DESCRIPTION =
  "ClaudeCode・AIツールの利用状況、効果、および今後の改善点に関するフィードバックを収集するためのアンケートです。皆様のご協力をお願いいたします。";

// ---- スプレッドシート ----
const TAB_INTERNAL = "社内";
const TAB_EXTERNAL = "外部案件";
const BASE_HEADERS = ["タイムスタンプ", "メールアドレス"];
// フォーム再構築で不要になった旧「フォームの回答 N」シートに付ける接尾辞（回答がある場合のみ改名して保持）
const ARCHIVED_SHEET_SUFFIX = "（旧）";

// ---- スプレッドシートのメニュー ----
const MENU_NAME = "アンケート管理";
const MENU_ITEM_CREATE = "フォームを作成／更新";

// ---- 分岐（所属）----
const AFFILIATION_TITLE = "現在の主な所属を教えてください";
const INTERNAL_LABEL = "社内PJ（ClaudeCode配布あり）";
const EXTERNAL_LABEL = "外部案件";

// ---- トリガー / スクリプトプロパティ ----
const TRIGGER_HANDLER = "onSubmit";
const PROP = {
  AFFIL_ID: "AFFIL_ID",
  INT_IDS: "INT_IDS",
  EXT_IDS: "EXT_IDS",
};

// ---- 選択肢の共通部品 ----
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

/**
 * 質問定義のフォーマット
 *   type     : "radio" | "checkbox" | "text" | "paragraph" | "scale"
 *   title    : 質問文
 *   choices  : 選択肢（radio / checkbox のみ）
 *   other    : 「その他」欄を表示するか（radio / checkbox のみ）
 *   bounds   : [下限, 上限]（scale のみ）
 *   labels   : [下限ラベル, 上限ラベル]（scale のみ）
 *   helpText : 質問文の下に表示する補足説明（任意）
 *   required : 必須かどうか
 */

// ---- 社内セクション ----
const INTERNAL_SECTION = {
  title: "社内PJの方への質問",
  helpText: "社内で配布されたClaudeCodeの利用状況について伺います。",
};

const INTERNAL_QUESTIONS = [
  {
    type: "radio",
    title: "チーム名を教えてください",
    choices: ["吉川チーム", "新井チーム"],
    other: true,
    required: true,
  },
  {
    type: "text",
    title:
      "1. 関わっているPJ名もしくはPJの概要を教えてください（例: ナレッジベース共有サービス）",
    required: true,
  },
  {
    type: "radio",
    title: "2. あなたのClaudeCodeの利用歴（個人の利用も含む）を教えてください。",
    choices: ["1か月未満", "3か月未満", "半年未満", "1年未満", "1年以上"],
    required: true,
  },
  {
    type: "radio",
    title:
      "3. 社内で配布されたClaudeCodeの、1週間あたりの平均利用時間をお答えください。",
    choices: [
      "利用できていない",
      "1時間未満",
      "5時間未満",
      "10時間未満",
      "20時間未満",
      "40時間未満",
      "40時間以上",
    ],
    required: true,
  },
  {
    type: "paragraph",
    title:
      "3-1. 質問3で「利用できていない」と回答された方は、その理由を具体的にお教えください。",
  },
  {
    type: "radio",
    title:
      "4. 担当業務のうち、AIを使っている業務の割合（体感）を教えてください。",
    choices: ["0%", "25%未満", "50%未満", "75%未満", "75%以上"],
    required: true,
  },
  {
    type: "scale",
    title:
      "5. ClaudeCode導入前後で、コード生成量・タスク完了速度はどの程度変化しましたか？（体感でも可）",
    bounds: [1, 5],
    labels: ["変化なし", "大幅に向上"],
    required: true,
  },
  {
    type: "paragraph",
    title:
      "5-1. 変化があった方は、具体的な事例（例: 以前と比べて〇〇のタスク完了速度が上がった）をお教えください。",
  },
  {
    type: "radio",
    title:
      "6. ClaudeCodeの利用により、普段触れない言語や技術へのチャレンジが増えましたか？",
    choices: YN,
  },
  {
    type: "radio",
    title:
      "7. ClaudeCodeの利用は、自身のスキルアップに貢献していると感じましたか？",
    choices: YN,
    required: true,
  },
  {
    type: "radio",
    title:
      "8. ClaudeCodeへの依存により、自分のスキルアップが滞っている、あるいは不安だと感じますか？",
    choices: YN,
    required: true,
  },
  {
    type: "radio",
    title:
      "9. 周囲のメンバーへClaudeCodeの使い方を共有・推薦したことはありますか？",
    choices: YN,
    required: true,
  },
  {
    type: "radio",
    title:
      "10. ClaudeCodeの導入によって、チームの開発フロー（設計、コーディング、レビュー、ドキュメント作成など）に変化はありましたか？",
    choices: ["全く変化無し", "少し変化あり", "大幅に変化あり"],
    required: true,
  },
  {
    type: "radio",
    title:
      "11. ClaudeCodeの利用に関して、セキュリティや品質面での懸念はありますか？",
    choices: YN,
    required: true,
  },
  {
    type: "checkbox",
    title: "12. よく使うClaudeCodeの機能をすべて選択してください。",
    choices: [
      "スキル",
      "マーケットプレイスのプラグイン",
      "MCP連携",
      "サブエージェント",
      "スラッシュコマンド",
      "CLAUDE.md",
      "特になし",
    ],
    other: true,
    required: true,
  },
  {
    type: "checkbox",
    title:
      "13. 開発プロセスにおいて、ClaudeCodeが最も役立ったフェーズをすべて選択してください。",
    choices: PHASES,
    required: true,
  },
  {
    type: "paragraph",
    title:
      "13-1. 質問13で選択したフェーズ（最も役立った点）について、具体的な事例を教えてください。",
  },
  {
    type: "text",
    title:
      "14. AIレポートスキルの実行結果があれば、教えられる範囲で結果を教えてください（任意）",
    helpText: [
      "【AIレポートの作り方】",
      "1. ターミナルで Claude Code を起動し、セッションを開きます。",
      "2. プロンプトに /insights と入力して実行します。",
      "3. 直近のセッション履歴を分析したレポート（利用傾向・よく使う機能・改善提案など）が作成されます。",
      "レポートの内容や気になった項目を、共有できる範囲で記載してください。",
    ].join("\n"),
  },
  {
    type: "checkbox",
    title: "15. AIラボチームに期待するサポートをすべて選択してください。",
    helpText: [
      "AIラボチームは、ClaudeCodeをはじめとするAIツールの社内活用を推進するチームです。ハーネス（開発環境・ルール）の整備、スキル・プラグインの提供、ナレッジ記事の発信などを行っています。",
      "GitHub：https://github.com/dreamcareer/claude-marketplace",
    ].join("\n"),
    choices: [
      "ハーネス導入支援",
      "勉強会・ハンズオン",
      "ナレッジ記事の充実",
      "スキル・プラグインの提供",
      "個別相談",
      "特になし",
    ],
    other: true,
  },
  {
    type: "paragraph",
    title:
      "16. その他 ClaudeCodeを活用して「うまくいったプロジェクト」や「具体的な改善事例」があれば、簡単にお教えください。（任意）",
  },
  {
    type: "paragraph",
    title:
      "17. 他のLLM（例: Copilot, Gemini, Codexなど）とClaudeCodeを比べたときに、特に思うことがあれば記載してください。（任意）",
  },
];

// ---- 外部案件セクション ----
const EXTERNAL_SECTION = {
  title: "外部案件の方への質問",
  helpText: "守秘義務の範囲で、話せる内容のみご回答ください。",
};

const EXTERNAL_QUESTIONS = [
  {
    type: "text",
    title: "1. 案件の概要を教えてください（話せる範囲で）",
    required: true,
  },
  {
    type: "radio",
    title: "2. 案件内でのAIツールの利用ルールを教えてください。",
    choices: ["利用禁止", "許可されたツールのみ利用可", "自由に利用可", "分からない"],
    required: true,
  },
  {
    type: "checkbox",
    title: "3. 案件で利用しているAIツールをすべて選択してください。",
    choices: [
      "GitHub Copilot",
      "ChatGPT",
      "Gemini",
      "Claude（Claude Code含む）",
      "Cursor",
      "客先独自のAIツール",
      "利用していない",
    ],
    other: true,
    required: true,
  },
  {
    type: "checkbox",
    title: "4. AIが役立っている工程をすべて選択してください。",
    choices: PHASES,
    required: true,
  },
  {
    type: "scale",
    title: "5. AI活用による業務効率の変化（体感）を教えてください。",
    bounds: [1, 5],
    labels: ["変化なし", "大幅に向上"],
    required: true,
  },
  {
    type: "paragraph",
    title:
      "6. 社内にも取り入れたいと思った使い方・ルール・ツールがあれば教えてください。",
    helpText: [
      "いただいた内容は、AIの社内活用を広める取り組みの一環として整備している社内マーケットプレイス（スキル・プラグインの配布基盤）への導入を検討する参考にさせていただきます。",
      "GitHub：https://github.com/dreamcareer/claude-marketplace",
    ].join("\n"),
  },
  {
    type: "paragraph",
    title: "7. 客先でのAI利用で困っていること・制約があれば教えてください。",
  },
];
