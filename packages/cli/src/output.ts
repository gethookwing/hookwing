import chalk from 'chalk';
import ora from 'ora';

export function formatTable(headers: string[], rows: string[][]): string {
  const columnWidths = headers.map((header, colIndex) => {
    const dataWidths = rows.map((row) => (row[colIndex] ?? '').length);
    return Math.max(header.length, ...dataWidths);
  });

  const headerRow = headers.map((header, i) => header.padEnd(columnWidths[i] ?? 0)).join(' | ');
  const separator = columnWidths.map((w) => '-'.repeat(w)).join('-+-');

  const dataRows = rows.map((row) =>
    row.map((cell, i) => (cell ?? '').padEnd(columnWidths[i] ?? 0)).join(' | '),
  );

  return [headerRow, separator, ...dataRows].join('\n');
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function createSpinner(text: string, agentMode: boolean) {
  if (agentMode) {
    return {
      stop: () => {},
      succeed: (_msg?: string) => {},
      fail: (_msg?: string) => {},
      text: '',
    };
  }
  return ora(text).start();
}

export function printError(message: string, agentMode: boolean): void {
  if (agentMode) {
    process.stderr.write(`${JSON.stringify({ error: message })}\n`);
  } else {
    console.error(chalk.red(`Error: ${message}`));
  }
}
