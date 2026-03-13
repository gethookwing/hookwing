import chalk from 'chalk';
import type { Command } from 'commander';
import ora from 'ora';
import { HookwingClient } from '../client.js';
import { getApiKey, loadConfig } from '../config.js';
import { formatJson, formatTable } from '../output.js';

export function createEndpointsCommands(program: Command, getFormat: () => 'json' | 'table'): void {
  const endpoints = program.command('endpoints').description('Manage webhook endpoints');

  endpoints.command('list').action(async () => {
    const config = await loadConfig();
    const apiKey = getApiKey(config);
    if (!apiKey) {
      console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
      process.exit(1);
    }

    const client = new HookwingClient(apiKey, config.baseUrl);
    const spinner = ora('Loading endpoints...').start();

    try {
      const list = await client.listEndpoints();
      spinner.stop();

      const format = getFormat();
      if (format === 'json') {
        console.log(formatJson(list));
      } else {
        if (list.length === 0) {
          console.log(chalk.yellow('No endpoints found'));
          return;
        }

        const headers = ['ID', 'URL', 'Status', 'Event Types'];
        const rows = list.map((ep) => [
          ep.id,
          ep.url,
          ep.active ? chalk.green('active') : chalk.red('inactive'),
          ep.eventTypes.join(', ') || '-',
        ]);

        console.log(formatTable(headers, rows));
      }
    } catch (err) {
      spinner.fail('Failed to load endpoints');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

  endpoints
    .command('create')
    .requiredOption('--url <url>', 'Endpoint URL')
    .option('--description <desc>', 'Endpoint description')
    .option('--event-types <types...>', 'Event types to receive')
    .action(async (options) => {
      const config = await loadConfig();
      const apiKey = getApiKey(config);
      if (!apiKey) {
        console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
        process.exit(1);
      }

      const client = new HookwingClient(apiKey, config.baseUrl);
      const spinner = ora('Creating endpoint...').start();

      try {
        const endpoint = await client.createEndpoint({
          url: options.url,
          description: options.description,
          eventTypes: options.eventTypes,
        });
        spinner.succeed('Endpoint created');

        const format = getFormat();
        if (format === 'json') {
          console.log(formatJson(endpoint));
        } else {
          console.log(formatTable(['ID', 'URL'], [[endpoint.id, endpoint.url]]));
        }
      } catch (err) {
        spinner.fail('Failed to create endpoint');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });

  endpoints.command('get <id>').action(async (id: string) => {
    const config = await loadConfig();
    const apiKey = getApiKey(config);
    if (!apiKey) {
      console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
      process.exit(1);
    }

    const client = new HookwingClient(apiKey, config.baseUrl);
    const spinner = ora('Loading endpoint...').start();

    try {
      const endpoint = await client.getEndpoint(id);
      spinner.stop();

      const format = getFormat();
      if (format === 'json') {
        console.log(formatJson(endpoint));
      } else {
        console.log(
          formatTable(
            ['ID', 'URL', 'Description', 'Active', 'Event Types', 'Created'],
            [
              [
                endpoint.id,
                endpoint.url,
                endpoint.description || '-',
                endpoint.active ? chalk.green('yes') : chalk.red('no'),
                endpoint.eventTypes.join(', ') || '-',
                endpoint.createdAt,
              ],
            ],
          ),
        );
      }
    } catch (err) {
      spinner.fail('Failed to load endpoint');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

  endpoints
    .command('delete <id>')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (id: string, options) => {
      const config = await loadConfig();
      const apiKey = getApiKey(config);
      if (!apiKey) {
        console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
        process.exit(1);
      }

      if (!options.yes) {
        const readline = await import('node:readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const question = (q: string): Promise<string> =>
          new Promise((resolve) => rl.question(q, resolve));

        const answer = await question(
          chalk.yellow(`Are you sure you want to delete endpoint ${id}? (y/N): `),
        );
        rl.close();

        if (answer.toLowerCase() !== 'y') {
          console.log(chalk.yellow('Cancelled'));
          process.exit(0);
        }
      }

      const client = new HookwingClient(apiKey, config.baseUrl);
      const spinner = ora('Deleting endpoint...').start();

      try {
        await client.deleteEndpoint(id);
        spinner.succeed('Endpoint deleted');
      } catch (err) {
        spinner.fail('Failed to delete endpoint');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });

  endpoints
    .command('update <id>')
    .option('--url <url>', 'New endpoint URL')
    .option('--description <desc>', 'New endpoint description')
    .option('--active <true|false>', 'Set active status', (val) => {
      if (val === 'true' || val === 'false') return val === 'true';
      return undefined;
    })
    .action(async (id: string, options) => {
      const config = await loadConfig();
      const apiKey = getApiKey(config);
      if (!apiKey) {
        console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
        process.exit(1);
      }

      const updateData: {
        url?: string;
        description?: string;
        active?: boolean;
      } = {};

      if (options.url) updateData.url = options.url;
      if (options.description !== undefined) updateData.description = options.description;
      if (options.active !== undefined) updateData.active = options.active;

      if (Object.keys(updateData).length === 0) {
        console.error(chalk.red('Error: No options provided'));
        process.exit(1);
      }

      const client = new HookwingClient(apiKey, config.baseUrl);
      const spinner = ora('Updating endpoint...').start();

      try {
        const endpoint = await client.updateEndpoint(id, updateData);
        spinner.succeed('Endpoint updated');

        const format = getFormat();
        if (format === 'json') {
          console.log(formatJson(endpoint));
        } else {
          console.log(
            formatTable(
              ['ID', 'URL', 'Active'],
              [[endpoint.id, endpoint.url, endpoint.active ? chalk.green('yes') : chalk.red('no')]],
            ),
          );
        }
      } catch (err) {
        spinner.fail('Failed to update endpoint');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });
}
