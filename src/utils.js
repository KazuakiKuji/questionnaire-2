/**
 * ===== 共通関数 =====
 * Drive 上のファイル検索、フォーム項目の生成、スプレッドシート整形など、
 * 実行関数（main.js）から呼び出される汎用処理をまとめる。
 * 末尾に "_" を付けた関数は GAS エディタの実行候補から除外される。
 */

// ---------------------------------------------------------------------------
// Drive
// ---------------------------------------------------------------------------

/** このスクリプトファイルが置かれている Drive フォルダを返す（= 現在ディレクトリ）。 */
function getScriptFolder_() {
  const scriptFile = DriveApp.getFileById(ScriptApp.getScriptId());
  const parents = scriptFile.getParents();
  return parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
}

/**
 * フォルダ内から指定 MIME タイプのファイルを探す。
 * 1. 名前が完全一致するものがあればそれ
 * 2. 該当タイプが 1 件だけならそれ
 * 3. それ以外（0 件 or 複数で名前不一致）は null
 */
function findFileInFolder_(folder, mimeType, name) {
  const found = [];
  const it = folder.getFilesByType(mimeType);
  while (it.hasNext()) found.push(it.next());

  if (found.length === 0) return null;
  const exact = found.find((f) => f.getName() === name);
  if (exact) return exact;
  if (found.length === 1) return found[0];

  Logger.log(
    `「${folder.getName()}」内に ${mimeType} が複数あり、名前「${name}」に一致するものがないため新規作成します。`,
  );
  return null;
}

/** フォルダ内の既存フォームを開く。なければ新規作成して同フォルダへ移動する。 */
function getOrCreateForm_(folder) {
  const file = findFileInFolder_(folder, MimeType.GOOGLE_FORMS, FORM_TITLE);
  if (file) {
    Logger.log(`既存フォームを更新します: ${file.getName()}`);
    return { form: FormApp.openById(file.getId()), created: false };
  }
  const form = FormApp.create(FORM_TITLE);
  DriveApp.getFileById(form.getId()).moveTo(folder);
  Logger.log(`フォームを新規作成しました: ${FORM_TITLE}`);
  return { form, created: true };
}

/** フォルダ内の既存スプレッドシートを開く。なければ新規作成して同フォルダへ移動する。 */
function getOrCreateSpreadsheet_(folder) {
  const file = findFileInFolder_(folder, MimeType.GOOGLE_SHEETS, SS_TITLE);
  if (file) {
    Logger.log(`既存スプレッドシートを更新します: ${file.getName()}`);
    return { ss: SpreadsheetApp.openById(file.getId()), created: false };
  }
  const ss = SpreadsheetApp.create(SS_TITLE);
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  Logger.log(`スプレッドシートを新規作成しました: ${SS_TITLE}`);
  return { ss, created: true };
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

/**
 * フォーム内の全項目（ページ区切り含む）を削除する。
 * 他の項目から「遷移先」として参照されているページ区切りは削除できず
 * "Invalid data updating form." になるため、先に遷移設定を解除してから
 * 「ページ区切り以外 → ページ区切り」の順で削除する。
 */
function clearFormItems_(form) {
  const items = form.getItems();

  // 1. ページ遷移の参照を全て解除する
  items.forEach((item) => {
    switch (item.getType()) {
      case FormApp.ItemType.PAGE_BREAK:
        item.asPageBreakItem().setGoToPage(FormApp.PageNavigationType.CONTINUE);
        break;
      case FormApp.ItemType.MULTIPLE_CHOICE:
        resetChoiceNavigation_(item.asMultipleChoiceItem());
        break;
      case FormApp.ItemType.LIST:
        resetChoiceNavigation_(item.asListItem());
        break;
      default:
        break;
    }
  });

  // 2. ページ区切り以外を削除 → 3. ページ区切りを削除
  const isPageBreak = (item) => item.getType() === FormApp.ItemType.PAGE_BREAK;
  items.filter((i) => !isPageBreak(i)).forEach((i) => form.deleteItem(i));
  items.filter(isPageBreak).forEach((i) => form.deleteItem(i));
}

/** 選択式項目の選択肢から遷移先設定を外す（選択肢の文言はそのまま保持）。 */
function resetChoiceNavigation_(choiceItem) {
  const values = choiceItem.getChoices().map((c) => c.getValue());
  if (values.length > 0) choiceItem.setChoiceValues(values);
}

/** 質問定義（constants.js のフォーマット）から 1 項目を追加して返す。 */
function addQuestion_(form, q) {
  let item;
  switch (q.type) {
    case "radio":
      item = form.addMultipleChoiceItem().setChoiceValues(q.choices);
      if (q.other) item.showOtherOption(true);
      break;
    case "checkbox":
      item = form.addCheckboxItem().setChoiceValues(q.choices);
      if (q.other) item.showOtherOption(true);
      break;
    case "text":
      item = form.addTextItem();
      break;
    case "paragraph":
      item = form.addParagraphTextItem();
      break;
    case "scale":
      item = form
        .addScaleItem()
        .setBounds(q.bounds[0], q.bounds[1])
        .setLabels(q.labels[0], q.labels[1]);
      break;
    default:
      throw new Error(`未対応の質問タイプです: ${q.type}（${q.title}）`);
  }
  item.setTitle(q.title);
  if (q.helpText) item.setHelpText(q.helpText);
  if (q.required) item.setRequired(true);
  return item;
}

/** ページ区切り + 質問群をまとめて追加し、{ page, items } を返す。 */
function addSection_(form, section, questions) {
  const page = form
    .addPageBreakItem()
    .setTitle(section.title)
    .setHelpText(section.helpText || "");
  const items = questions.map((q) => addQuestion_(form, q));
  return { page, items };
}

/** フォームの回答先を指定スプレッドシートに設定する（既に同じなら何もしない）。 */
function linkFormToSpreadsheet_(form, ss) {
  let currentId = null;
  try {
    currentId = form.getDestinationId();
  } catch (e) {
    currentId = null; // 未設定
  }
  if (currentId === ss.getId()) return;
  if (currentId) form.removeDestination();
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
}

// ---------------------------------------------------------------------------
// Spreadsheet
// ---------------------------------------------------------------------------

/** 指定名のシートを取得。なければ末尾に追加する。 */
function ensureSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/** 1 行目をヘッダーで上書きし、固定行にする（2 行目以降の既存データは保持）。 */
function writeHeader_(sheet, headers) {
  const width = Math.max(sheet.getLastColumn(), headers.length, 1);
  sheet.getRange(1, 1, 1, width).clearContent();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
  sheet.setFrozenRows(1);
}

// ---------------------------------------------------------------------------
// Trigger / Properties
// ---------------------------------------------------------------------------

/** onSubmit トリガーを作り直す（重複登録を防ぐため既存分は削除）。 */
function resetSubmitTrigger_(form) {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === TRIGGER_HANDLER)
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(TRIGGER_HANDLER).forForm(form).onFormSubmit().create();
}

/** onSubmit で使う ID 群をスクリプトプロパティへ保存する。 */
function saveSurveyProps_(ss, affiliation, internalItems, externalItems) {
  const props = {};
  props[PROP.SS_ID] = ss.getId();
  props[PROP.AFFIL_ID] = String(affiliation.getId());
  props[PROP.INT_IDS] = JSON.stringify(internalItems.map((i) => i.getId()));
  props[PROP.EXT_IDS] = JSON.stringify(externalItems.map((i) => i.getId()));
  PropertiesService.getScriptProperties().setProperties(props);
}
