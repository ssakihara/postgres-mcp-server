import { z } from 'zod';
import { query } from '../db.js';

const QueryInputSchema = z.object({
  sql: z.string().min(1, 'SQL query cannot be empty'),
  params: z.array(z.unknown()).optional(),
  limit: z.number().int().min(1).max(10000).default(1000),
});

export async function handleQuery(input: unknown): Promise<string> {
  const { sql, params, limit = 1000 } = QueryInputSchema.parse(input);

  // Basic SQL injection prevention - warn about dangerous operations
  const upperSql = sql.toUpperCase().trim();
  if (upperSql.startsWith('DROP ') || upperSql.startsWith('TRUNCATE ') || upperSql.startsWith('ALTER ') || upperSql.startsWith('DELETE ')) {
    return JSON.stringify({
      error: 'Dangerous operation detected',
      message: 'DROP, TRUNCATE, ALTER, and DELETE operations are not allowed for safety reasons',
      sql: sql,
    }, null, 2);
  }

  // DELETE is only allowed with a WHERE clause to target specific rows
  // Also checks the affected row count before executing (max 1 row allowed)
  // Note: This is currently unreachable due to the DELETE check above
  if (upperSql.includes('DELETE FROM')) {
    const deleteIndex = upperSql.indexOf('DELETE FROM');
    const whereIndex = upperSql.indexOf('WHERE', deleteIndex);
    if (whereIndex === -1) {
      return JSON.stringify({
        error: 'Dangerous operation detected',
        message: 'DELETE without WHERE clause is not allowed. Please specify a condition to target specific rows.',
        sql: sql,
      }, null, 2);
    }

    // Extract table name and WHERE clause for count check
    const tableEndIndex = upperSql.indexOf('WHERE', deleteIndex) - (deleteIndex + 11);
    const tableName = sql.substring(deleteIndex + 11, deleteIndex + 11 + tableEndIndex).trim();
    const whereClause = sql.substring(upperSql.indexOf('WHERE', deleteIndex) + 5).trim();

    // Check affected row count before executing DELETE
    const countSql = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}`;
    try {
      const countResult = await query(countSql, params);
      const affectedRows = parseInt(countResult.rows[0].count as string, 10);
      if (affectedRows > 1) {
        return JSON.stringify({
          error: 'Dangerous operation detected',
          message: `DELETE would affect ${affectedRows} rows. Only single-row DELETE is allowed (max 1 row). Please refine your WHERE clause.`,
          sql: sql,
          affectedRows: affectedRows,
        }, null, 2);
      }
    }
    catch (countError) {
      if (countError instanceof Error) {
        return JSON.stringify({
          success: false,
          error: `Failed to check affected rows: ${countError.message}`,
          sql: sql,
        }, null, 2);
      }
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
