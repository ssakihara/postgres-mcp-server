// PostgreSQL connection management
import { Client, ClientConfig, QueryResult } from 'pg';

// Singleton client instance

let client: Client | null = null;

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
