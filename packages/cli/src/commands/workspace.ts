import chalk from 'chalk';
import type { Command } from 'commander';
import { HookwingClient } from '../client.js';
import { getApiKey, isAgentMode, loadConfig } from '../config.js';
import { createSpinner, formatJson, printError } from '../output.js';

export function createWorkspaceCommands(program: Command, getFormat: () => 'json' | 'table'): void {
  program
    .command('whoami')
    .description('Show current authenticated user and workspace')
    .action(async () => {
      const config = await loadConfig();
      const apiKey = getApiKey(config);
      const agentMode = isAgentMode(config) || getFormat() === 'json';

      if (!apiKey) {
        printError("Not authenticated. Run 'hookwing auth login'", agentMode);
        process.exit(1);
      }

      const client = new HookwingClient(apiKey, config.baseUrl);
      const spinner = createSpinner('Loading user info...', agentMode);

      try {
        const user = await client.whoami();
        spinner.stop();

        if (agentMode) {
          console.log(formatJson(user));
        } else {
          console.log(chalk.bold('Authenticated as'));
          console.log(`  Name:       ${chalk.cyan(user.name)}`);
          console.log(`  Email:      ${chalk.cyan(user.email)}`);
          console.log(
            `  Workspace:  ${chalk.cyan(user.workspaceName)} ${chalk.dim(`(${user.workspaceId})`)}`,
          );
        }
      } catch (err) {
        spinner.fail('Failed to fetch user info');
        printError((err as Error).message, agentMode);
        process.exit(1);
      }
    });
}

// Re-export formatJson so listen.ts can use it cleanly
export { formatJson } from '../output.js';
