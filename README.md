# PostgreSQL MCP Server

LLM が PostgreSQL データベースと対話できるようにする MCP (Model Context Protocol) サーバーです。

## 特徴

- **クエリ実行**: SELECT ステートメントの自動制限付きで SQL クエリを実行
- **スキーマ探索**: データベース内のすべてのスキーマを一覧表示
- **テーブル検査**: テーブルとテーブル構造（カラム、型、制約、インデックス）を記述
- **安全な操作**: 危険な操作（DROP、TRUNCATE、ALTER、DELETE）に対する保護機能
- **Docker サポート**: 簡単な統合のためのコンテナ化デプロイメント

## クイックスタート

### Claude Code を使用している場合

```bash
claude mcp add -s project pms docker \
  --env PGSCHEMA=public \
  --env PGDATABASE=test_db \
  --env PGHOST=host.docker.internal \
  --env PGPORT=5432 \
  --env PGUSER=postgres \
  --env PGPASSWORD=your_password \
  -- run --pull always -i --rm \
  -e PGSCHEMA \
  -e PGDATABASE \
  -e PGHOST \
  -e PGPORT \
  -e PGUSER \
  -e PGPASSWORD \
  ghcr.io/ssakihara/postgres-mcp-server:latest
```

環境変数の値は実際の環境に合わせて変更してください。

## 環境変数

| 変数 | 説明 | デフォルト | 必須 |
|----------|-------------|---------|----------|
| `PGHOST` | PostgreSQL ホスト | `localhost` | いいえ |
| `PGPORT` | PostgreSQL ポート | `5432` | いいえ |
| `PGDATABASE` | データベース名 | - | **はい** |
| `PGUSER` | データベースユーザー | 現在のユーザー / `postgres` | いいえ |
| `PGPASSWORD` | データベースパスワード | - | いいえ |
| `PGSCHEMA` | デフォルトスキーマ名 | `public` | いいえ |

## MCP ツール

### `query`

データベースに対して SQL クエリを実行します。

**入力:**
```json
{
  "sql": "SELECT * FROM users WHERE active = true LIMIT 10",
  "params": [],
  "limit": 1000
}
```

**レスポンス:**
```json
{
  "success": true,
  "rowCount": 10,
  "rows": [...],
  "fields": [...]
}
```

### `list_schemas`

データベース内のすべてのスキーマを一覧表示します。

**入力:**
```json
{
  "includeSystemSchemas": false
}
```

**レスポンス:**
```json
{
  "success": true,
  "schemas": [...],
  "count": 1
}
```

### `list_tables`

スキーマ内のテーブルを一覧表示します。

**入力:**
```json
{
  "schema": "public",
  "includeRowCount": false
}
```

**レスポンス:**
```json
{
  "success": true,
  "schema": "public",
  "tables": [...],
  "count": 5
}
```

### `describe_table`

テーブルの詳細情報を取得します。

**入力:**
```json
{
  "tableName": "users",
  "schema": "public"
}
```

**レスポンス:**
```json
{
  "success": true,
  "table": { "schema": "public", "name": "users" },
  "columns": [...],
  "primaryKeys": ["id"],
  "foreignKeys": [...],
  "indexes": [...]
}
```

## Docker で使用する

### GitHub Container Registry から使用

```bash
docker run -i --rm \
  -e PGHOST=host.docker.internal \
  -e PGPORT=5432 \
  -e PGDATABASE=mydb \
  -e PGUSER=myuser \
  -e PGPASSWORD=mypassword \
  -e PGSCHEMA=public \
  ghcr.io/ssakihara/postgres-mcp-server:latest
```

### ローカルでビルドして使用

```bash
# Docker イメージをビルド
docker build -t postgres-mcp-server .

# 実行
docker run -i --rm \
  -e PGHOST=host.docker.internal \
  -e PGPORT=5432 \
  -e PGDATABASE=mydb \
  -e PGUSER=myuser \
  -e PGPASSWORD=mypassword \
  -e PGSCHEMA=public \
  postgres-mcp-server
```

---

## 開発者向け

### セットアップ

```bash
# 依存関係をインストール
pnpm install

# 開発モードで実行（ウォッチ機能）
pnpm run dev

# 本番用にビルド
pnpm run build

# テストを実行
pnpm test
```

### プロジェクト構成

```
postgres-mcp-server/
├── src/
│   ├── index.ts           # メインエントリーポイント
│   ├── server.ts          # MCP サーバー設定
│   ├── tools/
│   │   ├── query.ts       # SQL クエリ実行ツール
│   │   ├── schema.ts      # データベーススキーマ一覧
│   │   └── tables.ts      # テーブル一覧・詳細取得ツール
│   └── db.ts              # PostgreSQL 接続
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

## ライセンス

ISC
