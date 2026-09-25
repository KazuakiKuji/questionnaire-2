/**
 * ===== 定数 =====
 * フォームの名称、質問定義などをここで一元管理する。
 * 質問を追加・変更する場合はこのファイルのみ編集し、createSurvey を再実行する。
 *
 * このスクリプトは回答用スプレッドシートに紐づくコンテナバインドスクリプトとして動作する。
 * スプレッドシートは再生成せず、常に紐づいているものを更新する。
 *
 * アンケート実施中は createSurvey を実行しない。フォームの項目を全て作り直すため
 * 既存回答が失われ、振り分け先タブの列もずれる。設問の変更は配布前に済ませる。
 */

// ---- 名称 ----

/**
 * フォームのタイトル。Drive 上でフォームを名前検索するときのキーにもなる。
 * @type {string}
 */
const FORM_TITLE = "ClaudeCode・AI活用 実態アンケート";

/**
 * フォーム冒頭に表示する説明文（回答の使い道と匿名性の説明）。
 * @type {string}
 */
const FORM_DESCRIPTION = [
  "ClaudeCode・AIツールの利用状況、効果、および今後の改善点に関するフィードバックを収集するためのアンケートです。皆様のご協力をお願いいたします。",
  "",
  "【回答の使い道】",
  "・利用状況や困りごとを踏まえた、ナレッジ記事のテーマ選定",
  "・社内マーケットプレイス（スキル・プラグイン）の整備・優先度の決定",
  "・AIラボチームのサポート計画と、AI活用の進捗報告",
  "",
  "【匿名性について】",
  "回答は匿名可能です。メールアドレスとPJ名の記入は任意で、個人の評価や回答者の特定には使用しません。",
].join("\n");

// ---- スプレッドシート ----

/**
 * 社内PJ の回答を振り分けるスプレッドシートのタブ名。
 * @type {string}
 */
const TAB_INTERNAL = "社内";

/**
 * 外部案件の回答を振り分けるスプレッドシートのタブ名。
 * @type {string}
 */
const TAB_EXTERNAL = "外部案件";

// ---- メールアドレス（任意）----

/**
 * 任意入力のメールアドレス項目のタイトル。振り分け先タブのヘッダーにもそのまま使う。
 *
 * Google フォーム標準のメール収集は「収集する＝必須」しか選べないため、
 * 標準収集はオフにし、任意入力のテキスト項目としてフォーム先頭に置く。
 * @type {string}
 */
const EMAIL_TITLE = "メールアドレス（任意）";

/**
 * メールアドレス項目の補足説明（任意であることと用途）。
 * @type {string}
 */
const EMAIL_HELP =
  "回答は匿名でも構いません。記入いただいた場合は、回答内容について詳しく伺いたいときの連絡先としてのみ使用します。";

/**
 * メールアドレス形式のバリデーションに失敗したときに表示する文言。
 * @type {string}
 */
const EMAIL_VALIDATION_MESSAGE = "メールアドレスの形式で入力してください";

/**
 * 振り分け先タブの先頭ヘッダー。この後ろに各設問のタイトルが並ぶ。
 * @type {readonly string[]}
 */
const BASE_HEADERS = ["タイムスタンプ", EMAIL_TITLE];

/**
 * フォーム再構築で不要になった旧「フォームの回答 N」シートに付ける接尾辞。
 * 回答がある場合のみ改名して保持し、回答が無ければ削除する。
 * @type {string}
 */
const ARCHIVED_SHEET_SUFFIX = "（旧）";

// ---- 分岐（所属）----

/**
 * 最初の分岐設問「現在の主な所属」のタイトル。
 * @type {string}
 */
const AFFILIATION_TITLE = "現在の主な所属を教えてください";

/**
 * 所属の選択肢: 社内PJ。選ぶと社内セクションへ遷移する。
 * @type {string}
 */
const INTERNAL_LABEL = "社内PJ（ClaudeCode配布あり）";

/**
 * 所属の選択肢: 外部案件。選ぶと外部案件セクションへ遷移する。
 * onSubmit で振り分け先タブを決める判定にも使う。
 * @type {string}
 */
const EXTERNAL_LABEL = "外部案件";

// ---- トリガー / スクリプトプロパティ ----

/**
 * フォーム送信時トリガーのハンドラ関数名。
 * @type {string}
 */
const TRIGGER_HANDLER = "onSubmit";

/**
 * スクリプトプロパティのキー。createSurvey が保存し、onSubmit が読む。
 * - EMAIL_ID: メールアドレス項目の ID
 * - AFFIL_ID: 所属（分岐）項目の ID
 * - INT_IDS : 社内セクションの項目 ID 配列（JSON 文字列）
 * - EXT_IDS : 外部案件セクションの項目 ID 配列（JSON 文字列）
 */
const PROP = {
  EMAIL_ID: "EMAIL_ID",
  AFFIL_ID: "AFFIL_ID",
  INT_IDS: "INT_IDS",
  EXT_IDS: "EXT_IDS",
};

// ---- 選択肢の共通部品 ----

/**
 * はい / いいえ の 2 択。
 * @type {readonly string[]}
 */
const YN = ["はい", "いいえ"];

/**
 * 開発フェーズの選択肢。社内向け設問 14 と外部案件向け設問 4 で共用する。
 * @type {readonly string[]}
 */
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
 * 社内向け設問 5-2: ClaudeCode で短縮できた時間の使い道。
 * @type {readonly string[]}
 */
const TIME_USAGE = [
  "仕様・設計の検討",
  "生成コードのレビュー・理解",
  "テスト・品質確認",
  "学習・技術調査",
  "追加の実装タスク",
  "他の業務・案件",
  "特に意識していない",
];

// ---- 質問定義の型 ----

/**
 * 質問定義。配列の順にフォームへ並ぶ。
 * @typedef {Object} Question
 * @property {"radio" | "checkbox" | "text" | "paragraph" | "scale"} type 回答形式
 * @property {string} title 質問文
 * @property {readonly string[]} [choices] 選択肢（radio / checkbox のみ）
 * @property {boolean} [other] その他の自由入力欄を表示するか（radio / checkbox のみ）
 * @property {[number, number]} [bounds] 下限と上限（scale のみ）
 * @property {[string, string]} [labels] 下限ラベルと上限ラベル（scale のみ）
 * @property {string} [helpText] 質問文の下に表示する補足説明
 * @property {boolean} [required] 必須かどうか（省略時は任意）
 */

/**
 * セクション（ページ区切り）の定義。
 * @typedef {Object} Section
 * @property {string} title セクションのタイトル
 * @property {string} [helpText] セクションの説明文
 */

// ---- 社内セクション ----

/**
 * 社内PJ セクションのページ区切り。
 * @type {Section}
 */
const INTERNAL_SECTION = {
  title: "社内PJの方への質問",
  helpText: "社内で配布されたClaudeCodeの利用状況について伺います。",
};

/**
 * 社内PJ 向けの設問。
 * @type {Question[]}
 */
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
      "1. 関わっているPJ名もしくはPJの概要を教えてください（任意 例: ナレッジベース共有サービス）",
    helpText:
      "PJ名を出したくない場合は、PJの種類やフェーズ（例: 新規Webサービスの実装フェーズ）だけでも構いません。",
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
    type: "checkbox",
    title:
      "3-1. 質問3で「利用できていない」と回答された方は、その理由をすべて選択してください。",
    choices: [
      "業務でコードを書く機会が少ない",
      "使い方が分からない・学ぶ時間がない",
      "環境構築やセットアップでつまずいた",
      "案件・客先の制約で利用できない",
      "効果を感じられなかった",
    ],
    other: true,
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
    type: "checkbox",
    title:
      "5-2. 質問5で変化があった方は、ClaudeCodeで短縮できた時間を主に何に使っていますか？（複数選択可）",
    choices: TIME_USAGE,
    other: true,
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
      "9. 前回アンケート（2026年4月実施）の頃と比べて、AIとの向き合い方・考え方は変わりましたか？",
    helpText:
      "回答は匿名のため前回の回答との突き合わせは行いません。この半年のご自身の体感でお答えください。",
    choices: [
      "より積極的に使うようになった",
      "変わらない",
      "より慎重に使うようになった",
      "前回は回答していない・分からない",
    ],
    required: true,
  },
  {
    type: "paragraph",
    title:
      "9-1. 質問9で「変わった」と回答した方は、変わった理由やきっかけを教えてください。",
  },
  {
    type: "radio",
    title:
      "10. 周囲のメンバーへClaudeCodeの使い方を共有・推薦したことはありますか？",
    choices: YN,
    required: true,
  },
  {
    type: "radio",
    title:
      "11. ClaudeCodeの導入によって、チームの開発フロー（設計、コーディング、レビュー、ドキュメント作成など）に変化はありましたか？",
    choices: ["全く変化無し", "少し変化あり", "大幅に変化あり"],
    required: true,
  },
  {
    type: "checkbox",
    title:
      "12. ClaudeCodeの利用に関して、セキュリティや品質面で懸念があれば、すべて選択してください。",
    choices: [
      "機密情報・顧客情報を入力してしまうリスク",
      "生成コードの品質・バグ",
      "生成コードのライセンス・著作権",
      "レビュー負荷の増加",
      "生成内容を理解しないまま使ってしまうこと",
      "特になし",
    ],
    other: true,
    required: true,
  },
  {
    type: "paragraph",
    title:
      "12-1. 質問12で懸念を選択した方は、具体的な内容や背景（例: 〇〇の案件で△△が起きそう）を教えてください。",
  },
  {
    type: "checkbox",
    title: "13. よく使うClaudeCodeの機能をすべて選択してください。",
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
      "14. 開発プロセスにおいて、ClaudeCodeが最も役立ったフェーズをすべて選択してください。",
    choices: PHASES,
    other: true,
    required: true,
  },
  {
    type: "paragraph",
    title:
      "14-1. 質問14で選択したフェーズ（最も役立った点）について、具体的な事例を教えてください。",
  },
  {
    type: "paragraph",
    title:
      "15. AIレポートスキルの実行結果があれば、教えられる範囲で結果を教えてください（任意）",
    helpText: [
      "【AIレポートの作り方】",
      "1. ターミナルで Claude Code を起動し、セッションを開きます。",
      "2. プロンプトに /insights と入力して実行します。",
      "3. 直近のセッション履歴を分析したレポート（利用傾向・よく使う機能・改善提案など）が作成されます。",
      "レポートの内容や気になった項目を、共有できる範囲で記載してください。",
      "※英語のHTMLで出力されるので、和訳・要約したものを提示いただけると幸いです。",
    ].join("\n"),
  },
  {
    type: "paragraph",
    title:
      "16. ClaudeCodeの利用で困っていること・つまずいていることがあれば教えてください。（任意）",
    helpText:
      "使い方が分からない機能、うまく動かない場面、運用ルールで迷っていることなど、どんな内容でも構いません。ナレッジ記事のテーマ選定に活用します。",
  },
  {
    type: "checkbox",
    title: "17. AIラボチームに期待するサポートをすべて選択してください。",
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
      "18. その他 ClaudeCodeを活用して「うまくいったプロジェクト」や「具体的な改善事例」があれば、簡単にお教えください。（任意）",
  },
  {
    type: "paragraph",
    title:
      "19. 他のLLM（例: Copilot, Gemini, Codexなど）とClaudeCodeを比べたときに、特に思うことがあれば記載してください。（任意）",
  },
];

// ---- 外部案件セクション ----

/**
 * 外部案件セクションのページ区切り。
 * @type {Section}
 */
const EXTERNAL_SECTION = {
  title: "外部案件の方への質問",
  helpText: "守秘義務の範囲で、話せる内容のみご回答ください。",
};

/**
 * 外部案件向けの設問。
 * @type {Question[]}
 */
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
  // 6, 7 は前回アンケート（外部案件の方も同じ設問に回答）との比較用。社内向け 7, 8 と同じ趣旨の文言にする
  {
    type: "radio",
    title: "6. AIツールの利用は、自身のスキルアップに貢献していると感じますか？",
    choices: YN,
    required: true,
  },
  {
    type: "radio",
    title:
      "7. AIツールへの依存により、自分のスキルアップが滞っている、あるいは不安だと感じますか？",
    choices: YN,
    required: true,
  },
  {
    type: "paragraph",
    title:
      "8. 社内にも取り入れたいと思った使い方・ルール・ツールがあれば教えてください。",
    helpText: [
      "いただいた内容は、AIの社内活用を広める取り組みの一環として整備している社内マーケットプレイス（スキル・プラグインの配布基盤）への導入を検討する参考にさせていただきます。",
      "GitHub：https://github.com/dreamcareer/claude-marketplace",
    ].join("\n"),
  },
  {
    type: "paragraph",
    title: "9. 客先でのAI利用で困っていること・制約があれば教えてください。",
  },
];
