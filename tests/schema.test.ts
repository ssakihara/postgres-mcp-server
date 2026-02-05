import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { QueryResult } from 'pg';
import { handleListSchemas } from '../src/tools/schema.js';

// Mock the db module
vi.mock('../src/db.js', () => ({
  query: vi.fn(),
}));

import { query } from '../src/db.js';

describe('schema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleListSchemas', () => {
    test('should list schemas excluding system schemas by default', async () => {
      vi.mocked(query).mockResolvedValue({
        rows: [
          { schema_name: 'public', schema_owner: 'postgres' },
          { schema_name: 'app', schema_owner: 'admin' },
        ],
        rowCount: 2,
      } as QueryResult);

      const result = JSON.parse(await handleListSchemas({}));

      expect(result.success).toBe(true);
      expect(result.schemas).toEqual([
        { schema_name: 'public', schema_owner: 'postgres' },
        { schema_name: 'app', schema_owner: 'admin' },
      ]);
      expect(result.count).toBe(2);
    });

    test('should include system schemas when requested', async () => {
      vi.mocked(query).mockResolvedValue({
        rows: [
          { schema_name: 'public', schema_owner: 'postgres' },
          { schema_name: 'pg_catalog', schema_owner: 'postgres' },
          { schema_name: 'information_schema', schema_owner: 'postgres' },
        ],
        rowCount: 3,
      } as QueryResult);

      const result = JSON.parse(await handleListSchemas({
        includeSystemSchemas: true,
      }));

      expect(result.success).toBe(true);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY schema_name'),
      );
    });

    test('should exclude system schemas when includeSystemSchemas is false', async () => {
      vi.mocked(query).mockResolvedValue({
        rows: [{ schema_name: 'public', schema_owner: 'postgres' }],
        rowCount: 1,
      } as QueryResult);

      await handleListSchemas({
        includeSystemSchemas: false,
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE schema_name NOT IN (\'pg_catalog\', \'information_schema\', \'pg_toast\')'),
      );
    });

    test('should handle query errors', async () => {
      vi.mocked(query).mockRejectedValue(new Error('Database connection failed'));

      const result = JSON.parse(await handleListSchemas({}));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    test('should handle unknown errors', async () => {
      vi.mocked(query).mockRejectedValue('unknown error');

      const result = JSON.parse(await handleListSchemas({}));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error occurred');
    });

    test('should default includeSystemSchemas to false', async () => {
      vi.mocked(query).mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as QueryResult);

      await handleListSchemas({});

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE schema_name NOT IN'),
      );
    });

    test('should reject invalid includeSystemSchemas type', async () => {
      await expect(handleListSchemas({
        includeSystemSchemas: 'true' as unknown as boolean,
      })).rejects.toThrow();
    });
  });
});
