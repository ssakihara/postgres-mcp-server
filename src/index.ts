#!/usr/bin/env node
// Entry point for MCP server

import { startServer } from './server.js';

async function main() {
  try {
    await startServer();
  }
  catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
