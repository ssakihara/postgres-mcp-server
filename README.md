# PostgreSQL MCP Server

`@modelcontextprotocol/sdk` を使用して、LLM が PostgreSQL データベースと対話できるようにする MCP (Model Context Protocol) サーバーです。

## 特徴

- **クエリ実行**: SELECT ステートメントの自動制限付きで SQL クエリを実行
- **スキーマ探索**: データベース内のすべてのスキーマを一覧表示
- **テーブル検査**: テーブルとテーブル構造（カラム、型、制約、インデックス）を記述
- **安全な操作**: 危険な操作（DROP、TRUNCATE、ALTER、DELETE）に対する保護機能
- **Docker サポート**: 簡単な統合のためのコンテナ化デプロイメント

## インストール

```bash
# 依存関係をインストール
pnpm install

# TypeScript をビルド
pnpm run build
```

## 環境変数

| 変数 | 説明 | デフォルト | 必須 |
|----------|-------------|---------|----------|
| `PGHOST` | PostgreSQL ホスト | `localhost` | いいえ |
| `PGPORT` | PostgreSQL ポート | `5432` | いいえ |
| `PGDATABASE` | データベース名 | - | **はい** |
| `PGUSER` | データベースユーザー | 現在のユーザー / `postgres` | いいえ |
| `PGPASSWORD` | データベースパスワード | - | いいえ |
| `PGSCHEMA` | デフォルトスキーマ名 | `public` | いいえ |

## 使用方法

### ローカル開発

```bash
# 環境変数を設定
export PGDATABASE=mydb
export PGHOST=localhost
export PGPORT=5432
export PGUSER=myuser
export PGPASSWORD=mypassword
export PGSCHEMA=myschema  # オプション: デフォルトは 'public'

# tsx で開発モードを実行
pnpm run dev

# またはコンパイル済みバージョンを実行
pnpm run build
pnpm run start
```

### Docker

#### GitHub Container Registry から使用

```bash
# GitHub Container Registry からイメージをプル
docker pull ghcr.io/ssakihara/postgres-mcp-server:latest

# デフォルト設定で実行
docker run -i --rm \
  -e PGDATABASE=mydb \
  ghcr.io/ssakihara/postgres-mcp-server:latest

# カスタム PostgreSQL 接続で実行
docker run -i --rm \
  -e PGHOST=host.docker.internal \
  -e PGPORT=5432 \
  -e PGDATABASE=mydb \
  -e PGUSER=myuser \
  -e PGPASSWORD=mypassword \
  -e PGSCHEMA=myschema \
  ghcr.io/ssakihara/postgres-mcp-server:latest
```

#### ローカルでビルド

```bash
# Docker イメージをビルド
pnpm run docker:build

# デフォルト設定で実行
docker run -i --rm \
  -e PGDATABASE=mydb \
  postgres-mcp-server

# カスタム PostgreSQL 接続で実行
docker run -i --rm \
  -e PGHOST=host.docker.internal \
  -e PGPORT=5432 \
  -e PGDATABASE=mydb \
  -e PGUSER=myuser \
  -e PGPASSWORD=mypassword \
  -e PGSCHEMA=myschema \
  postgres-mcp-server
```

## MCP ツール

### 1. `query`

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

### 2. `list_schemas`

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

### 3. `list_tables`

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

### 4. `describe_table`

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

## Claude Desktop との統合

Claude Desktop の設定ファイルを編集して、この MCP サーバーを使用するように設定します。

### macOS
`~/Library/Application Support/Claude/claude_desktop_config.json`

### Windows
`%APPDATA%/Claude/claude_desktop_config.json`

### ローカル MCP サーバー

```json
{
  "mcpServers": {
    "pms": {
      "command": "node",
      "args": ["/path/to/postgres-mcp-server/dist/index.js"],
      "env": {
        "PGDATABASE": "mydb",
        "PGHOST": "localhost",
        "PGPORT": "5432",
        "PGUSER": "myuser",
        "PGPASSWORD": "mypassword",
        "PGSCHEMA": "myschema"
      }
    }
  }
}
```

### Docker MCP サーバー

GitHub Container Registry のイメージを使用:

```json
{
  "mcpServers": {
    "pms": {
      "command": "docker",
      "args": [
        "run",
        "--pull", "always",
        "-i",
        "--rm",
        "-e",
        "PGHOST",
        "-e",
        "PGDATABASE",
        "-e",
        "PGUSER",
        "-e",
        "PGPASSWORD",
        "-e",
        "PGSCHEMA",
        "ghcr.io/ssakihara/postgres-mcp-server:latest"
      ],
      "env": {
        "PGDATABASE": "test_db",
        "PGHOST": "host.docker.internal",
        "PGPORT": "5432",
        "PGUSER": "postgres",
        "PGPASSWORD": "postgres",
        "PGSCHEMA": "myschema"
      }
    }
  }
}
```

またはローカルビルド版:

```json
{
  "mcpServers": {
    "pms": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "PGHOST=host.docker.internal",
        "-e", "PGDATABASE=mydb",
        "-e", "PGUSER=myuser",
        "-e", "PGPASSWORD=mypassword",
        "-e", "PGSCHEMA=myschema",
        "postgres-mcp-server"
      ]
    }
  }
}
```

## 開発

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

## プロジェクト構成

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
