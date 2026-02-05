# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

LLM が PostgreSQL データベースと対話できるようにする MCP (Model Context Protocol) サーバーです。`@modelcontextprotocol/sdk` と `pg` (node-postgres) を使用して、安全な SQL クエリ実行とスキーマイントロスペクション機能を提供します。

## 開発コマンド

```bash
# 依存関係をインストール
pnpm install

# TypeScript をビルド (dist/に出力)
pnpm run build

# 開発サーバーを実行 (tsx でウォッチ)
pnpm run dev

# 本番サーバーを実行
pnpm run start

# テストを実行 (Vitest)
pnpm test

# カバレッジ付きでテストを実行
pnpm test:coverage

# リントを実行
pnpm run lint

# リントの問題を自動修正
pnpm run lint:fix

# Docker コマンド
pnpm run docker:build
pnpm run docker:run
```

## 環境変数

| 変数 | 必須 | デフォルト | 説明 |
|------|------|------------|------|
| `PGDATABASE` | はい | - | データベース名 |
| `PGHOST` | いいえ | `localhost` | PostgreSQL ホスト |
| `PGPORT` | いいえ | `5432` | PostgreSQL ポート |
| `PGUSER` | いいえ | 現在のユーザー / `postgres` | データベースユーザー |
| `PGPASSWORD` | いいえ | - | データベースパスワード |

## アーキテクチャ

### エントリーポイント

- **`src/index.ts`**: `server.ts` の `startServer()` を呼び出すメインエントリーポイント

### コアコンポーネント

- **`src/server.ts`**: `@modelcontextprotocol/sdk` を使用した MCP サーバー設定
  - サーバーメタデータで `McpServer` インスタンスを作成
  - すべてのツールを登録 (`query`, `list_schemas`, `list_tables`, `describe_table`)
  - グレースフルシャットダウンを処理 (SIGINT/SIGTERM)
  - 通信用に `StdioServerTransport` を使用

- **`src/db.ts`**: PostgreSQL 接続管理
  - 遅延初期化によるシングルトンクライアントパターン
  - `getClient()`: キャッシュされた、または新規の `pg.Client` を返す
  - `query()`: オプションのパラメータで SQL を実行
  - `close()`: 接続をグレースフルにクローズ

### ツールハンドラー (`src/tools/`)

各ツールハンドラー:
1. Zod スキーマで入力をバリデーション
2. JSON 文字列化されたレスポンスを返す
3. 一貫性のあるエラーハンドリング

- **`query.ts`**: 安全ガード付きで SQL クエリを実行
  - ブロック対象: DROP, TRUNCATE, ALTER, DELETE 操作
  - SELECT クエリに自動で LIMIT を適用 (デフォルト: 1000, 最大: 10000)
  - パラメータ化クエリをサポート

- **`schema.ts`**: データベーススキーマを一覧表示
  - デフォルトでシステムスキーマ (`pg_catalog`, `information_schema`, `pg_*`) をフィルタリング

- **`tables.ts`**: テーブルイントロスペクション
  - `handleListTables()`: スキーマ内のテーブルを一覧表示（オプションで行数カウント付き）
  - `handleDescribeTable()`: カラム、型、制約、PK、FK、インデックスを返す

## コードスタイル

- `eslint.config.ts` で ESLint 設定
- シングルクォート、2スペースインデント、セミコロン必須
- TypeScript strict モード有効
- ES2022 ターゲット、Node16 モジュール解決

## MCP ツール

すべてのツールは `{ success, ... }` パターンの JSON フォーマット文字列を返します。

1. **`query`**: SQL を実行（SELECT には自動 LIMIT 付き）
2. **`list_schemas`**: すべてのスキーマを一覧表示
3. **`list_tables`**: スキーマ内のテーブルを一覧表示
4. **`describe_table`**: テーブルの詳細情報を取得

## 重要な注意点

- プロジェクトは ES モジュールを使用 (package.json で `"type": "module"`)
- すべてのインポートは `.js` 拡張子を使用（TypeScript は .js ファイルを出力）
- データベース接続はサーバー稼働中は維持される
- 危険な SQL 操作はツールレベルでブロックされる
