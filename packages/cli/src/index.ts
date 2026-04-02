#!/usr/bin/env node

import { Command } from 'commander';
import { createAuthCommands } from './commands/auth.js';
import { createDeliveriesCommands } from './commands/deliveries.js';
import { createEndpointsCommands } from './commands/endpoints.js';
import { createEventsCommands } from './commands/events.js';
import { createKeysCommands } from './commands/keys.js';
import { createListenCommand } from './commands/listen.js';
import { createPlaygroundCommands } from './commands/playground.js';
import { createWorkspaceCommands } from './commands/workspace.js';
import { loadConfig } from './config.js';

const program = new Command();
let outputFormat: 'json' | 'table' = 'table';

function getFormat(): 'json' | 'table' {
  return outputFormat;
}

// Detect agent/JSON mode from env vars early so all commands see it
if (process.env.HOOKWING_AGENT === '1' || process.env.HOOKWING_JSON === '1') {
  outputFormat = 'json';
}

program
  .name('hookwing')
  .version('0.1.0')
  .description('Hookwing CLI — Manage webhooks from the terminal or scripts')
  .option('--json', 'Output in JSON format (alias for --agent)')
  .option('--agent', 'Agent/script mode: structured JSON output, no interactive UI')
  .hook('preAction', async () => {
    const config = await loadConfig();
    if (outputFormat !== 'json') {
      outputFormat = config.format;
    }
  });

program.on('option:json', () => {
  outputFormat = 'json';
});

program.on('option:agent', () => {
  outputFormat = 'json';
});

createAuthCommands(program);
createListenCommand(program, getFormat);
createEndpointsCommands(program, getFormat);
createEventsCommands(program, getFormat);
createDeliveriesCommands(program, getFormat);
createKeysCommands(program, getFormat);
createPlaygroundCommands(program, getFormat);
createWorkspaceCommands(program, getFormat);

program.parse();
