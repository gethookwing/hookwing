#!/usr/bin/env node

import { Command } from 'commander';
import { createAuthCommands } from './commands/auth.js';
import { createDeliveriesCommands } from './commands/deliveries.js';
import { createEndpointsCommands } from './commands/endpoints.js';
import { createEventsCommands } from './commands/events.js';
import { createKeysCommands } from './commands/keys.js';
import { createPlaygroundCommands } from './commands/playground.js';
import { loadConfig } from './config.js';

const program = new Command();
let outputFormat: 'json' | 'table' = 'table';

function getFormat(): 'json' | 'table' {
  return outputFormat;
}

program
  .name('hookwing')
  .version('0.0.1')
  .description('Hookwing CLI - Manage webhooks from the terminal')
  .option('--json', 'Output in JSON format')
  .hook('preAction', async () => {
    const config = await loadConfig();
    outputFormat = config.format;
  });

// Global --json flag
program.on('option:json', () => {
  outputFormat = 'json';
});

createAuthCommands(program);
createEndpointsCommands(program, getFormat);
createEventsCommands(program, getFormat);
createDeliveriesCommands(program, getFormat);
createKeysCommands(program, getFormat);
createPlaygroundCommands(program, getFormat);

program.parse();
