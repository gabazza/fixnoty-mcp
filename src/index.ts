#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { createClient } from "./client.js";
import { readConfig } from "./config.js";
import { createFixnotyServer } from "./server.js";

let client;
try {
  client = createClient(readConfig());
} catch (error) {
  const message = error instanceof Error ? error.message : "Configurazione non valida.";
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

serveStdio(() => createFixnotyServer(client));
