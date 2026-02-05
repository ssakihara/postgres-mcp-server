import { z } from 'zod';
import { query } from '../db.js';

const ListTablesInputSchema = z.object({
  schema: z.string().default('public'),
  includeRowCount: z.boolean().default(false),
});

const DescribeTableInputSchema = z.object({
  tableName: z.string().min(1, 'Table name cannot be empty'),
  schema: z.string().default('public'),
});

export async function handleListTables(input: unknown): Promise<string> {
  const { schema = 'public', includeRowCount = false } = ListTablesInputSchema.parse(input);

  try {
    const sql = `
      SELECT
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const result = await query(sql, [schema]);

    const tables = result.rows;

    if (includeRowCount) {
      for (const table of tables) {
        try {
          const countResult = await query(`SELECT COUNT(*) as count FROM "${schema}"."${table.table_name}"`);
          table.row_count = parseInt(countResult.rows[0].count, 10);
        }
        catch {
          table.row_count = null;
        }
      }
    }

    return JSON.stringify({
      success: true,
      schema,
      tables,
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

export async function handleDescribeTable(input: unknown): Promise<string> {
  const { tableName, schema = 'public' } = DescribeTableInputSchema.parse(input);

  try {
    // Get column information
    const columnsResult = await query(`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `, [schema, tableName]);

    // Get primary key information
    const pkResult = await query(`
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
    `, [`${schema}.${tableName}`]);

    const primaryKeys = pkResult.rows.map((r: { column_name: string }) => r.column_name);

    // Get foreign key information
    const fkResult = await query(`
      SELECT
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
    `, [schema, tableName]);

    // Get index information
    const indexResult = await query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = $1 AND tablename = $2
    `, [schema, tableName]);

    return JSON.stringify({
      success: true,
      table: {
        schema,
        name: tableName,
      },
      columns: columnsResult.rows.map((col: {
        column_name: string;
        data_type: string;
        character_maximum_length: number | null;
        is_nullable: string;
        column_default: string | null;
      }) => ({
        name: col.column_name,
        type: col.data_type,
        maxLength: col.character_maximum_length,
        nullable: col.is_nullable === 'YES',
        defaultValue: col.column_default,
        isPrimaryKey: primaryKeys.includes(col.column_name),
      })),
      primaryKeys,
      foreignKeys: fkResult.rows,
      indexes: indexResult.rows,
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
