import { z } from 'zod';
import { query, getDefaultSchema } from '../db.js';

const defaultSchema = getDefaultSchema();

const QueryInputSchema = z.object({
  sql: z.string().min(1, 'SQL query cannot be empty'),
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

  // Basic SQL injection prevention - dangerous operations are blocked
  const upperSql = sql.toUpperCase().trim();
  if (upperSql.startsWith('DROP ') || upperSql.startsWith('TRUNCATE ') || upperSql.startsWith('ALTER ') || upperSql.startsWith('DELETE ')) {
    return JSON.stringify({
      error: 'Dangerous operation detected',
      message: 'DROP, TRUNCATE, ALTER, and DELETE operations are not allowed for safety reasons',
      sql: sql,
    }, null, 2);
  }

  // Block explicit schema qualifications to prevent unauthorized schema access
  const explicitSchemas = extractSchemaFromQuery(sql);
  for (const schema of explicitSchemas) {
    if (schema !== defaultSchema) {
      return JSON.stringify({
        error: 'Schema access violation',
        message: `Explicit schema qualification to "${schema}" is not allowed. Only "${defaultSchema}" schema is accessible.`,
        sql: sql,
      }, null, 2);
    }
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
      error: 'Unknown error occurred',
      sql: sql,
    }, null, 2);
  }
}
