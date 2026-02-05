import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { close } from './db.js';
import { handleQuery } from './tools/query.js';
import { handleListSchemas } from './tools/schema.js';
import { handleListTables, handleDescribeTable } from './tools/tables.js';

const server = new McpServer(
  {
    name: '@ssakihara/postgres-mcp-server',
    version: '1.0.0',
  },
);

// Register query tool
server.registerTool('query', {
  description: 'Execute a SQL query against the PostgreSQL database. Returns the results as JSON. '
    + 'For SELECT queries, returns rows of data. For INSERT/UPDATE/DELETE, returns affected row count.',
  inputSchema: {
    sql: z.string().describe('The SQL query to execute'),
    params: z.array(z.unknown()).optional().describe('Optional parameters for parameterized queries'),
    limit: z.number().int().min(1).max(10000).default(1000).describe('Maximum number of rows to return (default: 1000, max: 10000)'),
  },
}, async (args: unknown) => {
  const result = await handleQuery(args);
  return {
    content: [{ type: 'text', text: result }],
  };
});

// Register list_schemas tool
server.registerTool('list_schemas', {
  description: 'List all schemas in the current database',
  inputSchema: {
    includeSystemSchemas: z.boolean().default(false).describe('Include system schemas like pg_catalog, information_schema (default: false)'),
  },
},
async (args: unknown) => {
  const result = await handleListSchemas(args);
  return {
    content: [{ type: 'text', text: result }],
  };
});

// Register list_tables tool
server.registerTool('list_tables', {
  description: 'List all tables in a schema, optionally including row counts',
  inputSchema: {
    schema: z.string().default('public').describe('Schema name to list tables from (default: public)'),
    includeRowCount: z.boolean().default(false).describe('Include row counts for each table (slower for large databases)'),
  },
},
async (args: unknown) => {
  const result = await handleListTables(args);
  return {
    content: [{ type: 'text', text: result }],
  };
});

// Register describe_table tool
server.registerTool('describe_table', {
  description: 'Get detailed information about a table including columns, data types, constraints, and indexes',
  inputSchema: {
    tableName: z.string().min(1).describe('Name of the table to describe'),
    schema: z.string().default('public').describe('Schema name (default: public)'),
  },
},
async (args: unknown) => {
  const result = await handleDescribeTable(args);
  return {
    content: [{ type: 'text', text: result }],
  };
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await close();
  process.exit(0);
});

export async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export { server };
