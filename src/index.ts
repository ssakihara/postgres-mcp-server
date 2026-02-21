#!/usr/bin/env node
// MCPサーバーのエントリーポイント

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
