import chalk from 'chalk';
import type { Command } from 'commander';
import ora from 'ora';
import { HookwingClient } from '../client.js';
import { getApiKey, loadConfig } from '../config.js';
import { formatJson, formatTable } from '../output.js';

export function createPlaygroundCommands(
  program: Command,
  getFormat: () => 'json' | 'table',
): void {
  const playground = program.command('playground').description('Webhook testing playground');

  playground.command('create').action(async () => {
    const config = await loadConfig();
    const apiKey = getApiKey(config);
    if (!apiKey) {
      console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
      process.exit(1);
    }

    const client = new HookwingClient(apiKey, config.baseUrl);
    const spinner = ora('Creating playground session...').start();

    try {
      const session = await client.createPlaygroundSession();
      spinner.succeed('Playground session created');

      const format = getFormat();
      if (format === 'json') {
        console.log(formatJson(session));
      } else {
        console.log(chalk.bold('\nPlayground Endpoint:'));
        console.log(chalk.cyan(session.endpoint));
        console.log(chalk.bold('\nSession ID:'));
        console.log(session.sessionId);
        console.log(chalk.yellow('\nSend test webhooks to the endpoint above.'));

        if (session.secret) {
          console.log(chalk.bold('\nSigning Secret (for verification):'));
          console.log(chalk.cyan(session.secret));
        }
      }
    } catch (err) {
      spinner.fail('Failed to create playground session');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

  playground.command('list').action(async () => {
    const config = await loadConfig();
    const apiKey = getApiKey(config);
    if (!apiKey) {
      console.error(chalk.red("Error: Not authenticated. Run 'hookwing auth login'"));
      process.exit(1);
    }

    const client = new HookwingClient(apiKey, config.baseUrl);
    const spinner = ora('Loading playground sessions...').start();

    try {
      const list = await client.listPlaygroundSessions();
      spinner.stop();

      const format = getFormat();
      if (format === 'json') {
        console.log(formatJson(list));
      } else {
        if (list.length === 0) {
          console.log(chalk.yellow('No playground sessions found'));
          return;
        }

        const headers = ['ID', 'Endpoint', 'Created'];
        const rows = list.map((s) => [s.sessionId, s.endpoint, s.createdAt]);

        console.log(formatTable(headers, rows));
      }
    } catch (err) {
      spinner.fail('Failed to load playground sessions');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

  playground.command('delete <sessionId>').action(async (sessionId: string) => {
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
      chalk.yellow(`Are you sure you want to delete playground session ${sessionId}? (y/N): `),
    );
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log(chalk.yellow('Cancelled'));
      process.exit(0);
    }

    const client = new HookwingClient(apiKey, config.baseUrl);
    const spinner = ora('Deleting playground session...').start();

    try {
      await client.deletePlaygroundSession(sessionId);
      spinner.succeed('Playground session deleted');
    } catch (err) {
      spinner.fail('Failed to delete playground session');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });
}
