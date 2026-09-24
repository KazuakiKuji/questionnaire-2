/**
 * ===== 実行関数 =====
 *   createSurvey : フォーム／スプレッドシートを作成または更新する（手動実行）
 *   onSubmit     : フォーム送信時トリガー（createSurvey が自動登録）
 *
 * createSurvey はスクリプトファイルと同じ Drive フォルダ（= 現在ディレクトリ）を見て、
 *   - Google フォームがあれば項目を全て作り直して更新、なければ新規作成
 *   - Google スプレッドシートがあればヘッダー行を更新、なければ新規作成
 * を行う。新規作成したファイルは同じフォルダへ配置する。
 */

/** フォーム・スプレッドシートを作成または更新する。何度実行しても同じ結果になる。 */
function createSurvey() {
  const folder = getScriptFolder_();
  Logger.log(`対象フォルダ: ${folder.getName()}`);

  // ----- フォーム -----
  const { form, created: formCreated } = getOrCreateForm_(folder);
  if (!formCreated) clearFormItems_(form);
  form.setTitle(FORM_TITLE).setDescription(FORM_DESCRIPTION).setCollectEmail(true);

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

  // ----- スプレッドシート -----
  const { ss, created: ssCreated } = getOrCreateSpreadsheet_(folder);
  if (ssCreated) ss.getSheets()[0].setName(TAB_INTERNAL);

  const titlesOf = (items) => items.map((i) => i.getTitle());
  writeHeader_(ensureSheet_(ss, TAB_INTERNAL), [...BASE_HEADERS, ...titlesOf(internal.items)]);
  writeHeader_(ensureSheet_(ss, TAB_EXTERNAL), [...BASE_HEADERS, ...titlesOf(external.items)]);
  linkFormToSpreadsheet_(form, ss); // 全回答の原本タブも自動生成される

  // ----- プロパティ / トリガー -----
  saveSurveyProps_(ss, affiliation, internal.items, external.items);
  resetSubmitTrigger_(form);

  Logger.log(`フォーム編集URL: ${form.getEditUrl()}`);
  Logger.log(`回答URL: ${form.getPublishedUrl()}`);
  Logger.log(`スプレッドシート: ${ss.getUrl()}`);
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

  const isExternal = answers[p.getProperty(PROP.AFFIL_ID)] === EXTERNAL_LABEL;
  const ids = JSON.parse(p.getProperty(isExternal ? PROP.EXT_IDS : PROP.INT_IDS));

  SpreadsheetApp.openById(p.getProperty(PROP.SS_ID))
    .getSheetByName(isExternal ? TAB_EXTERNAL : TAB_INTERNAL)
    .appendRow([
      res.getTimestamp(),
      res.getRespondentEmail(),
      ...ids.map((id) => answers[id] ?? ""),
    ]);
}
