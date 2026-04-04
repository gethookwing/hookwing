import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Config {
  apiKey: string;
  baseUrl: string;
  format: 'json' | 'table';
}

const DEFAULT_CONFIG: Config = {
  apiKey: '',
  baseUrl: 'https://api.hookwing.com',
  format: 'table',
};

function getConfigPath(): string {
  return join(homedir(), '.hookwing', 'config.json');
}

function getConfigDir(): string {
  return join(homedir(), '.hookwing');
}

export async function loadConfig(): Promise<Config> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: Config): Promise<void> {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true });
  }

  const content = JSON.stringify(config, null, 2);
  await writeFile(configPath, content, 'utf-8');
}

export function getApiKey(config: Config): string | undefined {
  const envApiKey = process.env.HOOKWING_API_KEY;
  if (envApiKey) {
    return envApiKey;
  }
  return config.apiKey || undefined;
}

export function isAgentMode(config: Config): boolean {
  if (process.env.HOOKWING_AGENT === '1') return true;
  if (process.env.HOOKWING_JSON === '1') return true;
  return config.format === 'json';
}
