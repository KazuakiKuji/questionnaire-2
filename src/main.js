/**
 * ===== 実行関数 =====
 *   onOpen       : スプレッドシートを開いた時にカスタムメニューを追加する
 *   createSurvey : フォームを作成または更新し、このスプレッドシートを回答先にする
 *   onSubmit     : フォーム送信時トリガー（createSurvey が自動登録）
 *
 * このスクリプトは回答用スプレッドシートに紐づくコンテナバインドスクリプト。
 * スプレッドシートは再生成せず、常に紐づいているものを更新する。
 * フォームは「このスプレッドシートに連携済みのもの → 同じフォルダのもの → 新規作成」の順で決める。
 */

/** スプレッドシートを開いた時にメニューを追加する。 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(MENU_NAME)
    .addItem(MENU_ITEM_CREATE, "createSurvey")
    .addToUi();
}

/** フォームを作成または更新する。何度実行しても同じ結果になる。 */
function createSurvey() {
  const ss = getBoundSpreadsheet_();
  const folder = getContainerFolder_(ss);
  Logger.log(`対象スプレッドシート: ${ss.getName()} / フォルダ: ${folder.getName()}`);

  // ----- フォーム -----
  const { form, created: formCreated } = getOrCreateForm_(ss, folder);
  if (!formCreated) clearFormItems_(form);
  // 匿名回答を可能にするため標準のメール収集は使わず、任意入力の項目にする
  form.setTitle(FORM_TITLE).setDescription(FORM_DESCRIPTION).setCollectEmail(false);

  // 共通: メールアドレス（任意）
  const email = addEmailItem_(form);

  // 共通: 所属（ここで分岐）
  const affiliation = form
    .addMultipleChoiceItem()
    .setTitle(AFFILIATION_TITLE)
    .setRequired(true);

  // 社内 / 外部案件セクション
  const internal = addSection_(form, INTERNAL_SECTION, INTERNAL_QUESTIONS);
  const external = addSection_(form, EXTERNAL_SECTION, EXTERNAL_QUESTIONS);
  // 社内セクション終了後は送信へ（外部案件セクションを飛ばす）
  external.page.setGoToPage(FormApp.PageNavigationType.SUBMIT);

  affiliation.setChoices([
    affiliation.createChoice(INTERNAL_LABEL, internal.page),
    affiliation.createChoice(EXTERNAL_LABEL, external.page),
  ]);

  // ----- スプレッドシート（紐づいているものを更新）-----
  const titlesOf = (items) => items.map((i) => i.getTitle());
  writeHeader_(ensureSheet_(ss, TAB_INTERNAL), [...BASE_HEADERS, ...titlesOf(internal.items)]);
  writeHeader_(ensureSheet_(ss, TAB_EXTERNAL), [...BASE_HEADERS, ...titlesOf(external.items)]);
  relinkFormToSpreadsheet_(form, ss); // 回答原本の「フォームの回答 N」シートを作り直す

  // ----- プロパティ / トリガー -----
  saveSurveyProps_(email, affiliation, internal.items, external.items);
  resetSubmitTrigger_(form);

  Logger.log(`フォーム編集URL: ${form.getEditUrl()}`);
  Logger.log(`回答URL: ${form.getPublishedUrl()}`);
  Logger.log(`スプレッドシート: ${ss.getUrl()}`);
  ss.toast(`${formCreated ? "作成" : "更新"}しました: ${form.getTitle()}`, MENU_NAME, 10);
}

/** 送信時トリガー: 所属に応じて「社内」「外部案件」タブへ 1 行追記する。 */
function onSubmit(e) {
  const p = PropertiesService.getScriptProperties();
  const res = e.response;

  const answers = {};
  res.getItemResponses().forEach((r) => {
    const v = r.getResponse();
    answers[r.getItem().getId()] = Array.isArray(v) ? v.join(", ") : v;
  });

  const email = answers[p.getProperty(PROP.EMAIL_ID)] ?? ""; // 任意項目なので未記入なら空
  const isExternal = answers[p.getProperty(PROP.AFFIL_ID)] === EXTERNAL_LABEL;
  const ids = JSON.parse(p.getProperty(isExternal ? PROP.EXT_IDS : PROP.INT_IDS));

  getBoundSpreadsheet_()
    .getSheetByName(isExternal ? TAB_EXTERNAL : TAB_INTERNAL)
    .appendRow([res.getTimestamp(), email, ...ids.map((id) => answers[id] ?? "")]);
}
