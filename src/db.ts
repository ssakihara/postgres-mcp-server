// PostgreSQL connection management
import { Client, ClientConfig, QueryResult } from 'pg';

// Singleton client instance
let client: Client | null = null;

// Schema name validation: starts with letter/underscore, contains only letters/digits/underscores, max 63 chars
const VALID_SCHEMA_NAME = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
}

function getConfig(): DatabaseConfig {
  const host = process.env.PGHOST || 'localhost';
  const port = parseInt(process.env.PGPORT || '5432', 10);
  const database = process.env.PGDATABASE;

  if (!database) {
    throw new Error('PGDATABASE environment variable is required');
  }

  const user = process.env.PGUSER || process.env.USER || 'postgres';
  const password = process.env.PGPASSWORD;

  return { host, port, database, user, password };
}

export async function getClient(): Promise<Client> {
  if (client) {
    return client;
  }

  const config = getConfig();
  const clientConfig: ClientConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
  };

  if (config.password) {
    clientConfig.password = config.password;
  }

  client = new Client(clientConfig);
  await client.connect();

  return client;
}

export async function query(sql: string, params?: unknown[]): Promise<QueryResult> {
  const client = await getClient();
  return client.query(sql, params);
}

export async function close(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
  }
}

/**
 * Gets the default schema name from PGSCHEMA environment variable.
 * Falls back to 'public' if not set.
 *
 * @returns The default schema name
 * @throws {Error} If PGSCHEMA is set but contains an invalid schema name
 */
export function getDefaultSchema(): string {
  const schema = process.env.PGSCHEMA || 'public';

  if (!VALID_SCHEMA_NAME.test(schema)) {
    throw new Error(
      `Invalid PGSCHEMA value: "${schema}". Schema names must start with a letter or underscore, `
      + `contain only letters, digits, and underscores, and be 63 characters or less.`,
    );
  }

  return schema;
}
