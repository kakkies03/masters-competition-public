# マスターズ大会一覧ツール

🔗 **公開サイト**：[https://bearded-swimmer.com/swim/index.html](https://bearded-swimmer.com/swim/index.html)

Google Apps Script + HTML/JS を使った、スプレッドシートから大会情報を取得・表示する検索ツールです。

## 📁 ディレクトリ構成

- `frontend/`: HTML/CSS/JSで構成されたフロント画面
- `backend/`: Google Apps Script（GAS）コード
- `spreadsheet/`: 対象スプレッドシートの仕様やメモ
- `.clasp.json`: GASとの連携設定（claspを使用）

## 🚀 機能

- 種目・距離・開催日で絞り込み
- 「〇」「◯」のマークに対応した参加可否表示
- コンパクト / フル表示切り替え
- GAS経由で非公開スプレッドシートからデータ取得

## 🔧 開発

```bash
cd backend
clasp login
clasp push   # GASにデプロイ
