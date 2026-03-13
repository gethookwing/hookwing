import chalk from 'chalk';
import type { Command } from 'commander';
import ora from 'ora';
import { HookwingClient } from '../client.js';
import { getApiKey, loadConfig } from '../config.js';
import { formatJson, formatTable } from '../output.js';

export function createEventsCommands(program: Command, getFormat: () => 'json' | 'table'): void {
  const events = program.command('events').description('Manage events');

  events
    .command('list')
    .option('--limit <n>', 'Number of events to fetch', '20')
    .option('--status <status>', 'Filter by status (pending, processed, failed)')
    .option('--type <type>', 'Filter by event type')
    .action(async (options) => {
      const config = await loadConfig();
      const apiKey = getApiKey(config);
      if (!apiKey) {
        console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
        process.exit(1);
      }

      const client = new HookwingClient(apiKey, config.baseUrl);
      const spinner = ora('Loading events...').start();

      try {
        const list = await client.listEvents({
          limit: Number.parseInt(options.limit, 10),
          status: options.status,
          type: options.type,
        });
        spinner.stop();

        const format = getFormat();
        if (format === 'json') {
          console.log(formatJson(list));
        } else {
          if (list.length === 0) {
            console.log(chalk.yellow('No events found'));
            return;
          }

          const headers = ['ID', 'Type', 'Status', 'Received'];
          const rows = list.map((ev) => [
            ev.id,
            ev.type,
            ev.status === 'pending'
              ? chalk.yellow('pending')
              : ev.status === 'processed'
                ? chalk.green('processed')
                : chalk.red('failed'),
            ev.receivedAt,
          ]);

          console.log(formatTable(headers, rows));
        }
      } catch (err) {
        spinner.fail('Failed to load events');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });

  events.command('get <id>').action(async (id: string) => {
    const config = await loadConfig();
    const apiKey = getApiKey(config);
    if (!apiKey) {
      console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
      process.exit(1);
    }

    const client = new HookwingClient(apiKey, config.baseUrl);
    const spinner = ora('Loading event...').start();

    try {
      const event = await client.getEvent(id);
      spinner.stop();

      const format = getFormat();
      if (format === 'json') {
        console.log(formatJson(event));
      } else {
        console.log(chalk.bold('Event Details\n'));
        console.log(
          formatTable(
            ['ID', 'Type', 'Status', 'Received'],
            [
              [
                event.id,
                event.type,
                event.status === 'pending'
                  ? chalk.yellow('pending')
                  : event.status === 'processed'
                    ? chalk.green('processed')
                    : chalk.red('failed'),
                event.receivedAt,
              ],
            ],
          ),
        );

        console.log(chalk.bold('\nPayload'));
        console.log(formatJson(event.payload));

        if (event.deliveries.length > 0) {
          console.log(chalk.bold('\nDeliveries'));
          const headers = ['ID', 'Endpoint', 'Status', 'Code', 'Attempts'];
          const rows = event.deliveries.map((d) => [
            d.id,
            d.endpointUrl,
            d.status === 'pending'
              ? chalk.yellow('pending')
              : d.status === 'success'
                ? chalk.green('success')
                : chalk.red('failed'),
            d.statusCode !== null ? String(d.statusCode) : '-',
            String(d.attempts),
          ]);
          console.log(formatTable(headers, rows));
        }
      }
    } catch (err) {
      spinner.fail('Failed to load event');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

  events.command('replay <id>').action(async (id: string) => {
    const config = await loadConfig();
    const apiKey = getApiKey(config);
    if (!apiKey) {
      console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
      process.exit(1);
    }

    const client = new HookwingClient(apiKey, config.baseUrl);
    const spinner = ora('Replaying event...').start();

    try {
      await client.replayEvent(id);
      spinner.succeed('Event replayed successfully');
    } catch (err) {
      spinner.fail('Failed to replay event');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

  events
    .command('replay')
    .option('--bulk <ids>', 'Comma-separated list of event IDs')
    .action(async (options) => {
      if (!options.bulk) {
        console.error(chalk.red('Error: --bulk is required'));
        process.exit(1);
      }

      const config = await loadConfig();
      const apiKey = getApiKey(config);
      if (!apiKey) {
        console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
        process.exit(1);
      }

      const ids = options.bulk.split(',').map((id: string) => id.trim());
      const client = new HookwingClient(apiKey, config.baseUrl);
      const spinner = ora(`Replaying ${ids.length} events...`).start();

      try {
        await client.replayEvents(ids);
        spinner.succeed(`Replayed ${ids.length} events successfully`);
      } catch (err) {
        spinner.fail('Failed to replay events');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });
}
