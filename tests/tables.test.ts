import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { QueryResult } from 'pg';
import { handleListTables, handleDescribeTable } from '../src/tools/tables.js';

// Mock the db module
vi.mock('../src/db.js', () => ({
  query: vi.fn(),
}));

import { query } from '../src/db.js';

describe('tables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleListTables', () => {
    test('should list tables in the specified schema', async () => {
      vi.mocked(query).mockResolvedValue({
        rows: [
          { table_name: 'users', table_type: 'BASE TABLE' },
          { table_name: 'posts', table_type: 'BASE TABLE' },
        ],
        rowCount: 2,
      } as QueryResult);

      const result = JSON.parse(await handleListTables({}));

      expect(result.success).toBe(true);
      expect(result.schema).toBe('public');
      expect(result.tables).toEqual([
        { table_name: 'users', table_type: 'BASE TABLE' },
        { table_name: 'posts', table_type: 'BASE TABLE' },
      ]);
      expect(result.count).toBe(2);
    });

    test('should use default schema "public"', async () => {
      vi.mocked(query).mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as QueryResult);

      await handleListTables({});

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE table_schema = $1'),
        ['public'],
      );
    });

    test('should use custom schema when provided', async () => {
      vi.mocked(query).mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as QueryResult);

      await handleListTables({ schema: 'app' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE table_schema = $1'),
        ['app'],
      );
    });

    test('should not include row counts by default', async () => {
      vi.mocked(query).mockResolvedValue({
        rows: [{ table_name: 'users', table_type: 'BASE TABLE' }],
        rowCount: 1,
      } as QueryResult);

      const result = JSON.parse(await handleListTables({
        includeRowCount: false,
      }));

      expect(result.tables[0]).not.toHaveProperty('row_count');
    });

    test('should include row counts when requested', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce({
          rows: [{ table_name: 'users', table_type: 'BASE TABLE' }],
          rowCount: 1,
        } as QueryResult)
        .mockResolvedValueOnce({
          rows: [{ count: '100' }],
          rowCount: 1,
        } as QueryResult);

      const result = JSON.parse(await handleListTables({
        includeRowCount: true,
      }));

      expect(result.tables[0].row_count).toBe(100);
    });

    test('should handle errors when counting rows', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce({
          rows: [{ table_name: 'users', table_type: 'BASE TABLE' }],
          rowCount: 1,
        } as QueryResult)
        .mockRejectedValueOnce(new Error('Permission denied'));

      const result = JSON.parse(await handleListTables({
        includeRowCount: true,
      }));

      expect(result.tables[0].row_count).toBeNull();
    });

    test('should handle query errors', async () => {
      vi.mocked(query).mockRejectedValue(new Error('Database error'));

      const result = JSON.parse(await handleListTables({}));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('handleDescribeTable', () => {
    test('should describe table structure', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce({
          rows: [
            {
              column_name: 'id',
              data_type: 'integer',
              character_maximum_length: null,
              is_nullable: 'NO',
              column_default: 'nextval(\'users_id_seq\')',
              ordinal_position: 1,
            },
            {
              column_name: 'name',
              data_type: 'character varying',
              character_maximum_length: 255,
              is_nullable: 'YES',
              column_default: null,
              ordinal_position: 2,
            },
          ],
          rowCount: 2,
        } as QueryResult)
        .mockResolvedValueOnce({
          rows: [{ column_name: 'id' }],
          rowCount: 1,
        } as QueryResult)
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        } as QueryResult)
        .mockResolvedValueOnce({
          rows: [{ indexname: 'users_pkey', indexdef: 'CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)' }],
          rowCount: 1,
        } as QueryResult);

      const result = JSON.parse(await handleDescribeTable({
        tableName: 'users',
        schema: 'public',
      }));

      expect(result.success).toBe(true);
      expect(result.table).toEqual({ schema: 'public', name: 'users' });
      expect(result.columns).toHaveLength(2);
      expect(result.columns[0]).toEqual({
        name: 'id',
        type: 'integer',
        maxLength: null,
        nullable: false,
        defaultValue: 'nextval(\'users_id_seq\')',
        isPrimaryKey: true,
      });
      expect(result.primaryKeys).toEqual(['id']);
    });

    test('should use default schema "public"', async () => {
      vi.mocked(query).mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as QueryResult);

      await handleDescribeTable({
        tableName: 'users',
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE table_schema = $1'),
        ['public', 'users'],
      );
    });

    test('should use custom schema when provided', async () => {
      vi.mocked(query).mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as QueryResult);

      await handleDescribeTable({
        tableName: 'users',
        schema: 'app',
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE table_schema = $1'),
        ['app', 'users'],
      );
    });

    test('should handle query errors', async () => {
      vi.mocked(query).mockRejectedValue(new Error('Table not found'));

      const result = JSON.parse(await handleDescribeTable({
        tableName: 'nonexistent',
      }));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Table not found');
    });

    test('should include foreign key information', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as QueryResult)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as QueryResult)
        .mockResolvedValueOnce({
          rows: [
            {
              column_name: 'user_id',
              foreign_table_name: 'users',
              foreign_column_name: 'id',
            },
          ],
          rowCount: 1,
        } as QueryResult)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as QueryResult);

      const result = JSON.parse(await handleDescribeTable({
        tableName: 'posts',
      }));

      expect(result.foreignKeys).toEqual([
        {
          column_name: 'user_id',
          foreign_table_name: 'users',
          foreign_column_name: 'id',
        },
      ]);
    });

    test('should reject empty tableName', async () => {
      await expect(handleDescribeTable({
        tableName: '',
      })).rejects.toThrow();
    });

    test('should reject missing tableName', async () => {
      await expect(handleDescribeTable({} as never)).rejects.toThrow();
    });
  });
});
