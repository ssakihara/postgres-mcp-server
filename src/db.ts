// PostgreSQL接続管理
import { Pool, PoolConfig, QueryResult } from 'pg';

// シングルトンプールインスタンス
let pool: Pool | null = null;

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

/**
 * 接続プールを取得します。
 * 初回呼び出し時にプールが初期化されます。
 */
export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const config = getConfig();
  const defaultSchema = getDefaultSchema();
  const validatedSchema = validateSchemaForSearchPath(defaultSchema);

  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    max: parseInt(process.env.PG_MAX_CONNECTIONS || '5', 10),
    idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT || '2000', 10),
  };

  if (config.password) {
    poolConfig.password = config.password;
  }

  // 接続オプションでsearch_pathを設定（各接続の初期化時に適用）
  poolConfig.options = `-c search_path=${validatedSchema}`;

  pool = new Pool(poolConfig);

  // プールエラーハンドリング
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  return pool;
}

/**
 * クエリを実行します。接続エラー時に再試行します。
 */
export async function query(sql: string, params?: unknown[], retryCount = 0): Promise<QueryResult> {
  const pool = getPool();

  try {
    return await pool.query(sql, params);
  }
  catch (error) {
    // 接続エラーの場合、再試行
    if (error instanceof Error
      && (error.message.includes('connection')
        || error.message.includes('timeout')
        || error.message.includes('terminated'))
      && retryCount < 3) {
      console.warn(`クエリ実行エラー、再試行中 (${retryCount + 1}/3): ${error.message}`);
      return query(sql, params, retryCount + 1);
    }
    throw error;
  }
}

/**
 * 接続プールをグレースフルにクローズします。
 */
export async function close(): Promise<void> {
  if (pool) {
    // タイムアウト付きでグレースフルシャットダウン
    await pool.end();
    pool = null;
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
