import { z } from 'zod';
import { query, getDefaultSchema } from '../db.js';

const defaultSchema = getDefaultSchema();

const QueryInputSchema = z.object({
  sql: z.string().min(1, 'SQLクエリは空にできません'),
  params: z.array(z.unknown()).optional(),
  limit: z.number().int().min(1).max(10000).default(1000),
});

/**
 * SQLクエリ内の明示的に修飾されたテーブル参照からスキーマ名を抽出します。
 *
 * @param sql - 解析するSQLクエリ
 * @returns クエリ内で見つかったスキーマ名のセット
 */
function extractSchemaFromQuery(sql: string): Set<string> {
  const schemas = new Set<string>();

  // FROM schema.table パターン
  const fromPattern = /FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  let match;
  while ((match = fromPattern.exec(sql)) !== null) {
    schemas.add(match[1]);
  }

  // JOIN schema.table パターン
  const joinPattern = /JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  while ((match = joinPattern.exec(sql)) !== null) {
    schemas.add(match[1]);
  }

  // INSERT INTO schema.table パターン
  const insertPattern = /INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  while ((match = insertPattern.exec(sql)) !== null) {
    schemas.add(match[1]);
  }

  // UPDATE schema.table パターン
  const updatePattern = /UPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  while ((match = updatePattern.exec(sql)) !== null) {
    schemas.add(match[1]);
  }

  return schemas;
}

/**
 * 安全ガード付きでSQLクエリを実行します。
 *
 * 注意: search_pathは接続レベルでPGSCHEMAに制限されています（db.tsを参照）。
 * そのため、修飾されていないテーブル参照（例: "SELECT * FROM users"）は
 * PGSCHEMAスキーマに制限されます。
 * 明示的なスキーマ修飾（例: "SELECT * FROM other_schema.table"）は、
 * 認可されていないスキーマアクセスを防ぐために積極的にブロックされます。
 */
export async function handleQuery(input: unknown): Promise<string> {
  const { sql, params, limit = 1000 } = QueryInputSchema.parse(input);

  // 基本的なSQLインジェクション防止 - 危険な操作はブロックされます
  const upperSql = sql.toUpperCase().trim();
  if (upperSql.startsWith('DROP ') || upperSql.startsWith('TRUNCATE ') || upperSql.startsWith('ALTER ') || upperSql.startsWith('DELETE ')) {
    return JSON.stringify({
      error: '危険な操作が検出されました',
      message: '安全上の理由から、DROP、TRUNCATE、ALTER、DELETE操作は許可されていません',
      sql: sql,
    }, null, 2);
  }

  // 明示的なスキーマ修飾をすべてブロック（PGSCHEMA以外へのアクセスを防ぐため）
  // 修飾されていないテーブル参照はsearch_path設定によりPGSCHEMAに自動的にルーティングされる
  const explicitSchemas = extractSchemaFromQuery(sql);
  if (explicitSchemas.size > 0) {
    const foundSchemas = Array.from(explicitSchemas).join('", "');
    return JSON.stringify({
      error: 'スキーマアクセス違反',
      message: `明示的なスキーマ修飾は許可されていません。スキーマ指定なし（例: "SELECT * FROM users"）でクエリを実行してください。PGSCHEMA="${defaultSchema}"スキーマに自動的にアクセスされます。`,
      detected_schemas: foundSchemas,
      sql: sql,
    }, null, 2);
  }

  try {
    // Apply limit for SELECT queries
    let finalSql = sql;
    const finalUpperSql = upperSql;
    if (finalUpperSql.startsWith('SELECT') && !finalUpperSql.includes('LIMIT') && !finalUpperSql.includes('FETCH')) {
      finalSql = `${sql} LIMIT ${limit}`;
    }

    const result = await query(finalSql, params);

    return JSON.stringify({
      success: true,
      rowCount: result.rowCount,
      rows: result.rows,
      fields: result.fields.map((f: { name: string; dataTypeID: number }) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    }, null, 2);
  }
  catch (error) {
    if (error instanceof Error) {
      return JSON.stringify({
        success: false,
        error: error.message,
        sql: sql,
      }, null, 2);
    }
    return JSON.stringify({
      success: false,
      error: '不明なエラーが発生しました',
      sql: sql,
    }, null, 2);
  }
}
