// PostgreSQL接続管理
import { Client, ClientConfig, QueryResult } from 'pg';

// シングルトンクライアントインスタンス
let client: Client | null = null;

// スキーマ名バリデーション: 文字/アンダースコアで始まり、文字/数字/アンダースコアのみ含み、最大63文字
const VALID_SCHEMA_NAME = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
}

function getConfig(): DatabaseConfig {
  const host = process.env.PGHOST || 'localhost';
  const port = parseInt(process.env.PGPORT || '5432', 10);
  const database = process.env.PGDATABASE;

  if (!database) {
    throw new Error('PGDATABASE environment variable is required');
  }

  const user = process.env.PGUSER || process.env.USER || 'postgres';
  const password = process.env.PGPASSWORD;

  return { host, port, database, user, password };
}

export async function getClient(): Promise<Client> {
  if (client) {
    return client;
  }

  const config = getConfig();
  const clientConfig: ClientConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
  };

  if (config.password) {
    clientConfig.password = config.password;
  }

  client = new Client(clientConfig);
  await client.connect();

  // 修飾されていないテーブル参照をPGSCHEMAのみに制限するためにsearch_pathを設定
  const defaultSchema = getDefaultSchema();
  const validatedSchema = validateSchemaForSearchPath(defaultSchema);
  await client.query('SET search_path TO $1', [validatedSchema]);

  return client;
}

export async function query(sql: string, params?: unknown[]): Promise<QueryResult> {
  const client = await getClient();
  return client.query(sql, params);
}

export async function close(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
  }
}

/**
 * スキーマ名に危険な特殊値が含まれていないことを検証します。
 *
 * @param schema - 検証するスキーマ名
 * @returns 検証されたスキーマ名
 * @throws {Error} スキーマ名に危険な値が含まれる場合
 */
function validateSchemaForSearchPath(schema: string): string {
  // セキュリティ制限を回避する可能性のある危険な特殊値
  const dangerousValues = ['$user', 'pg_catalog', 'information_schema'];
  if (dangerousValues.includes(schema.toLowerCase())) {
    throw new Error(`Invalid schema name: "${schema}" contains dangerous special values`);
  }

  return schema;
}

/**
 * PGSCHEMA環境変数からデフォルトのスキーマ名を取得します。
 * 設定されていない場合は 'public' にフォールバックします。
 *
 * @returns デフォルトのスキーマ名
 * @throws {Error} PGSCHEMAが設定されているが、無効なスキーマ名が含まれる場合
 */
export function getDefaultSchema(): string {
  const schema = process.env.PGSCHEMA || 'public';

  if (!VALID_SCHEMA_NAME.test(schema)) {
    throw new Error(
      `Invalid PGSCHEMA value: "${schema}". Schema names must start with a letter or underscore, `
      + `contain only letters, digits, and underscores, and be 63 characters or less.`,
    );
  }

  return schema;
}
