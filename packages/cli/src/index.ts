#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import { HookwingClient } from './client.js';
import { createAuthCommands } from './commands/auth.js';
import { createDeliveriesCommands } from './commands/deliveries.js';
import { createEndpointsCommands } from './commands/endpoints.js';
import { createEventsCommands } from './commands/events.js';
import { createKeysCommands } from './commands/keys.js';
import { createListenCommand } from './commands/listen.js';
import { createPlaygroundCommands } from './commands/playground.js';
import { createWorkspaceCommands } from './commands/workspace.js';
import { getApiKey, loadConfig, saveConfig } from './config.js';

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

// Top-level convenience aliases
program
  .command('login')
  .description('Save your API key (alias for: auth login --api-key)')
  .requiredOption('--api-key <key>', 'API key to save')
  .action(async (options) => {
    const config = await loadConfig();
    config.apiKey = options.apiKey.trim();
    await saveConfig(config);
    console.log(chalk.green('API key saved successfully'));
  });

program
  .command('status')
  .description('Quick API health check and auth status (alias for: auth status)')
  .action(async () => {
    const config = await loadConfig();
    const apiKey = getApiKey(config);

    if (apiKey) {
      const masked = `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`;
      console.log(chalk.green('Authenticated'));
      console.log(`API Key: ${chalk.cyan(masked)}`);
    } else {
      console.log(chalk.yellow('Not authenticated'));
      console.log(`Run ${chalk.cyan('hookwing login --api-key <key>')} to authenticate`);
    }

    console.log(`Base URL: ${chalk.cyan(config.baseUrl)}`);

    if (apiKey) {
      try {
        const client = new HookwingClient(apiKey, config.baseUrl);
        await client.whoami();
        console.log(chalk.green('API reachable'));
      } catch {
        console.log(chalk.red('API unreachable or key invalid'));
      }
    }
  });

program
  .command('replay <event-id>')
  .description('Replay an event (alias for: events replay)')
  .action(async (eventId: string) => {
    const config = await loadConfig();
    const apiKey = getApiKey(config);
    if (!apiKey) {
      console.error(chalk.red("Error: Not authenticated. Run 'hookwing login --api-key <key>'"));
      process.exit(1);
    }

    const client = new HookwingClient(apiKey, config.baseUrl);
    try {
      await client.replayEvent(eventId);
      console.log(chalk.green(`Event ${eventId} replayed successfully`));
    } catch (err) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program.parse();
