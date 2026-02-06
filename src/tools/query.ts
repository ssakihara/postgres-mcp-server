import { z } from 'zod';
import { query } from '../db.js';

const QueryInputSchema = z.object({
  sql: z.string().min(1, 'SQL query cannot be empty'),
  params: z.array(z.unknown()).optional(),
  limit: z.number().int().min(1).max(10000).default(1000),
});

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
