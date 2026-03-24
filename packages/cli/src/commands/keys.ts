import chalk from 'chalk';
import type { Command } from 'commander';
import ora from 'ora';
import { HookwingClient } from '../client.js';
import { getApiKey, loadConfig } from '../config.js';
import { formatJson, formatTable } from '../output.js';

export function createKeysCommands(program: Command, getFormat: () => 'json' | 'table'): void {
  const keys = program.command('keys').description('Manage API keys');

  keys.command('list').action(async () => {
    const config = await loadConfig();
    const apiKey = getApiKey(config);
    if (!apiKey) {
      console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
      process.exit(1);
    }

    const client = new HookwingClient(apiKey, config.baseUrl);
    const spinner = ora('Loading API keys...').start();

    try {
      const list = await client.listKeys();
      spinner.stop();

      const format = getFormat();
      if (format === 'json') {
        console.log(formatJson(list));
      } else {
        if (list.length === 0) {
          console.log(chalk.yellow('No API keys found'));
          return;
        }

        const headers = ['ID', 'Name', 'Scopes', 'Created'];
        const rows = list.map((key) => [
          key.id,
          key.name,
          key.scopes.join(', ') || '-',
          key.createdAt,
        ]);

        console.log(formatTable(headers, rows));
      }
    } catch (err) {
      spinner.fail('Failed to load API keys');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

  keys
    .command('create')
    .requiredOption('--name <name>', 'Key name')
    .option('--scopes <scopes...>', 'Scopes for the key (e.g., endpoints:read events:write)')
    .action(async (options) => {
      const config = await loadConfig();
      const apiKey = getApiKey(config);
      if (!apiKey) {
        console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
        process.exit(1);
      }

      const client = new HookwingClient(apiKey, config.baseUrl);
      const spinner = ora('Creating API key...').start();

      try {
        const result = await client.createKey({
          name: options.name,
          scopes: options.scopes,
        });
        spinner.succeed('API key created');

        const format = getFormat();
        if (format === 'json') {
          console.log(formatJson(result));
        } else {
          console.log(chalk.bold('\nAPI Key (copy it now, it cannot be shown again):'));
          console.log(chalk.cyan(result.secret));
          console.log(chalk.yellow('\nWarning: This is the only time the secret will be shown!'));
        }
      } catch (err) {
        spinner.fail('Failed to create API key');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });

  keys.command('delete <id>').action(async (id: string) => {
    const config = await loadConfig();
    const apiKey = getApiKey(config);
    if (!apiKey) {
      console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
      process.exit(1);
    }

    const readline = await import('node:readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (q: string): Promise<string> =>
      new Promise((resolve) => rl.question(q, resolve));

    const answer = await question(
      chalk.yellow(`Are you sure you want to delete API key ${id}? (y/N): `),
    );
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log(chalk.yellow('Cancelled'));
      process.exit(0);
    }

    const client = new HookwingClient(apiKey, config.baseUrl);
    const spinner = ora('Deleting API key...').start();

    try {
      await client.deleteKey(id);
      spinner.succeed('API key deleted');
    } catch (err) {
      spinner.fail('Failed to delete API key');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });
}
