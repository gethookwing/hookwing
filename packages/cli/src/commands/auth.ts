import chalk from 'chalk';
import type { Command } from 'commander';
import { getApiKey, loadConfig, saveConfig } from '../config.js';

export function createAuthCommands(program: Command): void {
  const auth = program.command('auth').description('Manage authentication');

  auth
    .command('login')
    .description('Login with your API key')
    .action(async () => {
      const config = await loadConfig();

      // Prompt for API key (using simple approach since no inquirer)
      const readline = await import('node:readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const question = (query: string): Promise<string> =>
        new Promise((resolve) => rl.question(query, resolve));

      const apiKey = await question('Enter your API key: ');
      rl.close();

      if (!apiKey.trim()) {
        console.error(chalk.red('Error: API key is required'));
        process.exit(1);
      }

      config.apiKey = apiKey.trim();
      await saveConfig(config);

      console.log(chalk.green('API key saved successfully'));
    });

  auth
    .command('logout')
    .description('Remove API key from config')
    .action(async () => {
      const config = await loadConfig();
      config.apiKey = '';
      await saveConfig(config);
      console.log(chalk.green('Logged out successfully'));
    });

  auth
    .command('status')
    .description('Show current auth status')
    .action(async () => {
      const config = await loadConfig();
      const apiKey = getApiKey(config);

      if (apiKey) {
        const masked = `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`;
        console.log(chalk.green('Authenticated'));
        console.log(`API Key: ${chalk.cyan(masked)}`);
      } else {
        console.log(chalk.yellow('Not authenticated'));
        console.log(`Run ${chalk.cyan('hookwing auth login')} to authenticate`);
      }

      console.log(`Base URL: ${chalk.cyan(config.baseUrl)}`);
    });
}
