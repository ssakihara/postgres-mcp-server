import { z } from 'zod';
import { query } from '../db.js';

const ListSchemasInputSchema = z.object({
  includeSystemSchemas: z.boolean().default(false),
});

export async function handleListSchemas(input: unknown): Promise<string> {
  const { includeSystemSchemas = false } = ListSchemasInputSchema.parse(input);

  try {
    let sql = `
      SELECT
        schema_name,
        schema_owner
      FROM information_schema.schemata
    `;

    if (!includeSystemSchemas) {
      sql += ` WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast') AND schema_name NOT LIKE 'pg_%'`;
    }

    sql += ` ORDER BY schema_name`;

    const result = await query(sql);

    return JSON.stringify({
      success: true,
      schemas: result.rows,
      count: result.rowCount,
    }, null, 2);
  }
  catch (error) {
    if (error instanceof Error) {
      return JSON.stringify({
        success: false,
        error: error.message,
      }, null, 2);
    }
    return JSON.stringify({
      success: false,
      error: 'Unknown error occurred',
    }, null, 2);
  }
}
