/**
 * ===== 共通関数 =====
 * Drive 上のファイル検索、フォーム項目の生成、スプレッドシート整形など、
 * 実行関数（main.js）から呼び出される汎用処理をまとめる。
 * 末尾に "_" を付けた関数は GAS エディタの実行候補から除外される。
 */

// ---------------------------------------------------------------------------
// Spreadsheet（バインド先）
// ---------------------------------------------------------------------------

/** このスクリプトが紐づいているスプレッドシートを返す（再生成はしない）。 */
function getBoundSpreadsheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      "スプレッドシートに紐づいていません。回答用スプレッドシートのコンテナバインドスクリプトとして実行してください。",
    );
  }
  return ss;
}

/** スプレッドシートが置かれている Drive フォルダを返す（= 現在ディレクトリ）。 */
function getContainerFolder_(ss) {
  const parents = DriveApp.getFileById(ss.getId()).getParents();
  return parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
}

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
// Drive / Form の取得
// ---------------------------------------------------------------------------

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

/**
 * フォームを取得する。優先順位:
 *   1. スプレッドシートに現在紐づいているフォーム（回答連携シートから逆引き）
 *   2. 同じフォルダ内のフォーム
 *   3. 新規作成して同じフォルダへ配置
 */
function getOrCreateForm_(ss, folder) {
  const linked = findLinkedForm_(ss);
  if (linked) {
    Logger.log(`紐づいている既存フォームを更新します: ${linked.getTitle()}`);
    return { form: linked, created: false };
  }

  const file = findFileInFolder_(folder, MimeType.GOOGLE_FORMS, FORM_TITLE);
  if (file) {
    Logger.log(`同じフォルダの既存フォームを更新します: ${file.getName()}`);
    return { form: FormApp.openById(file.getId()), created: false };
  }

  const form = FormApp.create(FORM_TITLE);
  DriveApp.getFileById(form.getId()).moveTo(folder);
  Logger.log(`フォームを新規作成しました: ${FORM_TITLE}`);
  return { form, created: true };
}

/** 回答連携シートの URL から、このスプレッドシートに回答を送っているフォームを返す。なければ null。 */
function findLinkedForm_(ss) {
  for (const sheet of ss.getSheets()) {
    const url = sheet.getFormUrl();
    if (!url) continue;
    try {
      return FormApp.openByUrl(url);
    } catch (e) {
      Logger.log(`連携フォームを開けませんでした（${sheet.getName()}）: ${e.message}`);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Form の構築
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

// ---------------------------------------------------------------------------
// Form ⇄ Spreadsheet の連携
// ---------------------------------------------------------------------------

/**
 * フォームの回答先をこのスプレッドシートに（再）設定する。
 * 項目を作り直すと既存の「フォームの回答 N」シートに旧列が残り
 * 「列名が重複しています」となるため、連携を一度解除して作り直す。
 * 旧連携シートは、回答が無ければ削除、あれば改名して保持する。
 */
function relinkFormToSpreadsheet_(form, ss) {
  const formId = form.getId();
  const oldSheets = ss.getSheets().filter((s) => {
    const url = s.getFormUrl();
    return url && url.indexOf(formId) !== -1;
  });

  let currentId = null;
  try {
    currentId = form.getDestinationId();
  } catch (e) {
    currentId = null; // 未設定
  }
  if (currentId) form.removeDestination();
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();

  oldSheets.forEach((sheet) => {
    if (sheet.getLastRow() <= 1) {
      Logger.log(`旧連携シートを削除: ${sheet.getName()}`);
      ss.deleteSheet(sheet);
    } else {
      const stamp = Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "yyyyMMdd-HHmmss",
      );
      const newName = `${sheet.getName()}${ARCHIVED_SHEET_SUFFIX}${stamp}`;
      Logger.log(`旧連携シートに回答があるため改名して保持: ${newName}`);
      sheet.setName(newName);
    }
  });
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
function saveSurveyProps_(affiliation, internalItems, externalItems) {
  const props = {};
  props[PROP.AFFIL_ID] = String(affiliation.getId());
  props[PROP.INT_IDS] = JSON.stringify(internalItems.map((i) => i.getId()));
  props[PROP.EXT_IDS] = JSON.stringify(externalItems.map((i) => i.getId()));
  PropertiesService.getScriptProperties().setProperties(props);
}
