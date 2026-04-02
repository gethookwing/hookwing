import chalk from 'chalk';
import type { Command } from 'commander';
import { HookwingClient, type StreamEvent } from '../client.js';
import { getApiKey, isAgentMode, loadConfig } from '../config.js';
import { createSpinner, printError } from '../output.js';

export function createListenCommand(program: Command, getFormat: () => 'json' | 'table'): void {
  program
    .command('listen')
    .description('Forward incoming webhooks to a local URL')
    .option('--port <port>', 'Local port to forward webhooks to', '3000')
    .option('--path <path>', 'Local path prefix to forward to', '/')
    .option('--agent', 'Agent/script mode: emit JSON lines, no interactive UI')
    .action(async (options) => {
      const config = await loadConfig();
      const apiKey = getApiKey(config);

      if (!apiKey) {
        const agent = options.agent || isAgentMode(config);
        printError("Not authenticated. Run 'hookwing auth login'", agent);
        process.exit(1);
      }

      const agentMode = options.agent || isAgentMode(config) || getFormat() === 'json';
      const port = Number.parseInt(options.port, 10);
      const basePath = options.path === '/' ? '' : options.path;
      const localBase = `http://localhost:${port}`;

      if (!agentMode) {
        console.log(chalk.bold('Hookwing Listen'));
        console.log(`Forwarding webhooks → ${chalk.cyan(`${localBase}${basePath || '/'}`)}`);
        console.log(chalk.dim('Press Ctrl+C to stop\n'));
      } else {
        process.stdout.write(
          `${JSON.stringify({ status: 'connected', forwardTo: `${localBase}${basePath || '/'}` })}\n`,
        );
      }

      const client = new HookwingClient(apiKey, config.baseUrl);

      const handleEvent = async (event: StreamEvent) => {
        const targetPath = `${basePath}/${event.type.replace(/\./g, '/')}`.replace(/\/+/g, '/');
        const targetUrl = `${localBase}${targetPath}`;

        if (!agentMode) {
          const spinner = createSpinner(`${chalk.cyan(event.type)} → ${targetUrl}`, agentMode);
          try {
            const res = await fetch(targetUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Hookwing-Event': event.type,
                'X-Hookwing-Event-Id': event.id,
                ...(event.headers ?? {}),
              },
              body: JSON.stringify(event.payload),
            });
            spinner.succeed(
              `${chalk.cyan(event.type)}  ${chalk.green(String(res.status))}  ${chalk.dim(event.id)}`,
            );
          } catch (err) {
            spinner.fail(
              `${chalk.cyan(event.type)}  ${chalk.red('connection refused')}  ${chalk.dim(event.id)}`,
            );
          }
        } else {
          // Agent mode: emit a JSON line before forwarding, then another after
          process.stdout.write(
            `${JSON.stringify({
              event: 'received',
              id: event.id,
              type: event.type,
              receivedAt: event.receivedAt,
              forwardTo: targetUrl,
            })}\n`,
          );

          try {
            const res = await fetch(targetUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Hookwing-Event': event.type,
                'X-Hookwing-Event-Id': event.id,
                ...(event.headers ?? {}),
              },
              body: JSON.stringify(event.payload),
            });
            process.stdout.write(
              `${JSON.stringify({
                event: 'forwarded',
                id: event.id,
                type: event.type,
                status: res.status,
                ok: res.ok,
              })}\n`,
            );
          } catch (err) {
            process.stdout.write(
              `${JSON.stringify({
                event: 'forward_error',
                id: event.id,
                type: event.type,
                error: (err as Error).message,
              })}\n`,
            );
          }
        }
      };

      const controller = client.connectStream(
        (event) => {
          handleEvent(event).catch(() => {});
        },
        (err) => {
          if (!agentMode) {
            console.error(chalk.red(`\nStream error: ${err.message}`));
          } else {
            process.stderr.write(`${JSON.stringify({ error: err.message })}\n`);
          }
          process.exit(1);
        },
      );

      // Graceful shutdown
      const shutdown = () => {
        controller.abort();
        if (!agentMode) {
          console.log(chalk.dim('\nStopped.'));
        } else {
          process.stdout.write(`${JSON.stringify({ status: 'disconnected' })}\n`);
        }
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    });
}
