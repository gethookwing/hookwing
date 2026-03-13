import chalk from 'chalk';
import type { Command } from 'commander';
import ora from 'ora';
import { HookwingClient } from '../client.js';
import { getApiKey, loadConfig } from '../config.js';
import { formatJson, formatTable } from '../output.js';

export function createDeliveriesCommands(
  program: Command,
  getFormat: () => 'json' | 'table',
): void {
  const deliveries = program.command('deliveries').description('Manage deliveries');

  deliveries
    .command('list')
    .option('--limit <n>', 'Number of deliveries to fetch', '20')
    .option('--status <status>', 'Filter by status (pending, success, failed)')
    .option('--endpoint-id <id>', 'Filter by endpoint ID')
    .action(async (options) => {
      const config = await loadConfig();
      const apiKey = getApiKey(config);
      if (!apiKey) {
        console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
        process.exit(1);
      }

      const client = new HookwingClient(apiKey, config.baseUrl);
      const spinner = ora('Loading deliveries...').start();

      try {
        const list = await client.listDeliveries({
          limit: Number.parseInt(options.limit, 10),
          status: options.status,
          endpointId: options.endpointId,
        });
        spinner.stop();

        const format = getFormat();
        if (format === 'json') {
          console.log(formatJson(list));
        } else {
          if (list.length === 0) {
            console.log(chalk.yellow('No deliveries found'));
            return;
          }

          const headers = ['ID', 'Endpoint', 'Status', 'Code', 'Attempts', 'Sent'];
          const rows = list.map((d) => [
            d.id,
            d.endpointUrl,
            d.status === 'pending'
              ? chalk.yellow('pending')
              : d.status === 'success'
                ? chalk.green('success')
                : chalk.red('failed'),
            d.statusCode !== null ? String(d.statusCode) : '-',
            String(d.attempts),
            d.sentAt || '-',
          ]);

          console.log(formatTable(headers, rows));
        }
      } catch (err) {
        spinner.fail('Failed to load deliveries');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });

  deliveries.command('get <id>').action(async (id: string) => {
    const config = await loadConfig();
    const apiKey = getApiKey(config);
    if (!apiKey) {
      console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
      process.exit(1);
    }

    const client = new HookwingClient(apiKey, config.baseUrl);
    const spinner = ora('Loading delivery...').start();

    try {
      const delivery = await client.getDelivery(id);
      spinner.stop();

      const format = getFormat();
      if (format === 'json') {
        console.log(formatJson(delivery));
      } else {
        console.log(chalk.bold('Delivery Details\n'));
        console.log(
          formatTable(
            ['ID', 'Endpoint ID', 'Endpoint URL', 'Status', 'Code', 'Attempts'],
            [
              [
                delivery.id,
                delivery.endpointId,
                delivery.endpointUrl,
                delivery.status === 'pending'
                  ? chalk.yellow('pending')
                  : delivery.status === 'success'
                    ? chalk.green('success')
                    : chalk.red('failed'),
                delivery.statusCode !== null ? String(delivery.statusCode) : '-',
                String(delivery.attempts),
              ],
            ],
          ),
        );

        console.log(chalk.bold('\nTimestamps'));
        console.log(
          formatTable(
            ['Sent', 'Completed'],
            [[delivery.sentAt || '-', delivery.completedAt || '-']],
          ),
        );

        if (delivery.response) {
          console.log(chalk.bold('\nResponse'));
          console.log(delivery.response);
        }
      }
    } catch (err) {
      spinner.fail('Failed to load delivery');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });
}
