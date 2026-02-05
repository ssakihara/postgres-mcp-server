import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { QueryResult } from 'pg';
import { handleQuery } from '../src/tools/query.js';

// Mock the db module
vi.mock('../src/db.js', () => ({
  query: vi.fn(),
}));

import { query } from '../src/db.js';

describe('query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleQuery', () => {
    test('should reject DROP operations', async () => {
      const result = JSON.parse(await handleQuery({
        sql: 'DROP TABLE users',
      }));

      expect(result).toEqual({
        error: 'Dangerous operation detected',
        message: 'DROP, TRUNCATE, ALTER, and DELETE operations are not allowed for safety reasons',
        sql: 'DROP TABLE users',
      });
    });

    test('should reject TRUNCATE operations', async () => {
      const result = JSON.parse(await handleQuery({
        sql: 'TRUNCATE TABLE users',
      }));

      expect(result.error).toBe('Dangerous operation detected');
    });

    test('should reject ALTER operations', async () => {
      const result = JSON.parse(await handleQuery({
        sql: 'ALTER TABLE users ADD COLUMN name TEXT',
      }));

      expect(result.error).toBe('Dangerous operation detected');
    });

    test('should reject DELETE FROM operations', async () => {
      const result = JSON.parse(await handleQuery({
        sql: 'DELETE FROM users WHERE id = 1',
      }));

      expect(result.error).toBe('Dangerous operation detected');
    });

    test('should allow SELECT queries', async () => {
      vi.mocked(query).mockResolvedValue({
        rows: [{ id: 1, name: 'test' }],
        rowCount: 1,
        fields: [{ name: 'id', dataTypeID: 23 }, { name: 'name', dataTypeID: 25 }],
        command: 'SELECT',
      } as QueryResult);

      const result = JSON.parse(await handleQuery({
        sql: 'SELECT * FROM users',
      }));

      expect(result.success).toBe(true);
      expect(result.rows).toEqual([{ id: 1, name: 'test' }]);
      expect(query).toHaveBeenCalledWith('SELECT * FROM users LIMIT 1000', undefined);
    });

    test('should apply custom limit', async () => {
      vi.mocked(query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: 'SELECT',
      } as QueryResult);

      await handleQuery({
        sql: 'SELECT * FROM users',
        limit: 100,
      });

      expect(query).toHaveBeenCalledWith('SELECT * FROM users LIMIT 100', undefined);
    });

    test('should not add LIMIT if already present', async () => {
      vi.mocked(query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: 'SELECT',
      } as QueryResult);

      await handleQuery({
        sql: 'SELECT * FROM users LIMIT 10',
      });

      expect(query).toHaveBeenCalledWith('SELECT * FROM users LIMIT 10', undefined);
    });

    test('should not add LIMIT for INSERT queries', async () => {
      vi.mocked(query).mockResolvedValue({
        rows: [],
        rowCount: 1,
        fields: [],
        command: 'INSERT',
      } as QueryResult);

      await handleQuery({
        sql: 'INSERT INTO users (name) VALUES ($1)',
        params: ['test'],
      });

      expect(query).toHaveBeenCalledWith('INSERT INTO users (name) VALUES ($1)', ['test']);
    });

    test('should handle query errors', async () => {
      vi.mocked(query).mockRejectedValue(new Error('Connection failed'));

      const result = JSON.parse(await handleQuery({
        sql: 'SELECT * FROM users',
      }));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });

    test('should handle unknown errors', async () => {
      vi.mocked(query).mockRejectedValue('unknown error');

      const result = JSON.parse(await handleQuery({
        sql: 'SELECT * FROM users',
      }));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error occurred');
    });

    test('should use default limit of 1000', async () => {
      vi.mocked(query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: 'SELECT',
      } as QueryResult);

      await handleQuery({
        sql: 'SELECT * FROM users',
      });

      expect(query).toHaveBeenCalledWith('SELECT * FROM users LIMIT 1000', undefined);
    });

    test('should reject empty SQL string', async () => {
      await expect(handleQuery({
        sql: '',
      })).rejects.toThrow();
    });

    test('should reject limit below minimum', async () => {
      await expect(handleQuery({
        sql: 'SELECT * FROM users',
        limit: 0,
      })).rejects.toThrow();
    });

    test('should reject limit above maximum', async () => {
      await expect(handleQuery({
        sql: 'SELECT * FROM users',
        limit: 10001,
      })).rejects.toThrow();
    });
  });
});
