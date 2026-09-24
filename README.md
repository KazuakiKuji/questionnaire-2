# questionnaire-2 — ClaudeCode・AI活用 実態アンケート（GAS / clasp）

社内 / 外部案件で分岐する Google フォームを作成し、回答を所属ごとに
スプレッドシートの「社内」「外部案件」タブへ振り分ける Apps Script プロジェクト。

## 構成

```
.clasp.json          clasp 設定（scriptId / rootDir=src / 読み込み順）
src/
  appsscript.json    マニフェスト
  constants.js       定数（名称・質問定義）
  utils.js           共通関数（Drive 検索・フォーム生成・シート整形・トリガー）
  main.js            実行関数（createSurvey / onSubmit）
```

## セットアップ

```sh
npm install -g @google/clasp   # 未導入の場合
clasp login                    # ブラウザで Google 認証
clasp push                     # src/ を Apps Script プロジェクトへ反映
clasp open                     # ブラウザでエディタを開く
```

## 実行

GAS エディタで `createSurvey` を実行する。

- スクリプトと同じ Drive フォルダに Google フォーム / スプレッドシートがあれば **更新**
  - フォーム: 項目を全て削除して `constants.js` の定義で作り直す
  - スプレッドシート: 「社内」「外部案件」タブのヘッダー行を上書き（既存の回答行は保持）
- なければ **新規作成** して同じフォルダへ配置
- `onSubmit` トリガーは毎回作り直される（重複登録なし）

質問を変更するときは `src/constants.js` を編集し、`clasp push` → `createSurvey` を再実行する。
