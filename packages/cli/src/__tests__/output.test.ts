import { describe, expect, it } from 'vitest';
import { formatJson, formatTable } from '../output.js';

describe('formatTable', () => {
  it('produces aligned columns with separator', () => {
    const headers = ['ID', 'Name', 'Status'];
    const rows = [
      ['abc123', 'Test One', 'active'],
      ['def456', 'Longer Name Here', 'inactive'],
    ];

    const result = formatTable(headers, rows);
    const lines = result.split('\n');

    expect(lines.length).toBe(4); // header + separator + 2 data rows
    expect(lines[0]).toContain('ID');
    expect(lines[0]).toContain('Name');
    expect(lines[0]).toContain('Status');
    expect(lines[1]).toContain('-');
    expect(lines[2]).toContain('abc123');
    expect(lines[3]).toContain('Longer Name Here');
  });

  it('handles empty rows', () => {
    const result = formatTable(['ID', 'Name'], []);
    const lines = result.split('\n');
    expect(lines.length).toBe(2); // header + separator only
    expect(lines[0]).toContain('ID');
    expect(lines[0]).toContain('Name');
  });

  it('handles missing values gracefully', () => {
    const result = formatTable(['ID', 'Description'], [['abc123', '']]);
    const lines = result.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[2]).toContain('abc123');
  });
});

describe('formatJson', () => {
  it('produces valid JSON string', () => {
    const data = { name: 'test', count: 42, active: true };
    const result = formatJson(data);
    const parsed = JSON.parse(result);
    expect(parsed).toEqual(data);
  });

  it('formats with indentation', () => {
    const data = { user: { id: '123' } };
    const result = formatJson(data);
    expect(result).toContain('\n');
    expect(result).toContain('  ');
  });

  it('handles arrays', () => {
    const data = ['one', 'two', 'three'];
    const result = formatJson(data);
    expect(JSON.parse(result)).toEqual(data);
  });

  it('handles null values', () => {
    const data = { a: null };
    const result = formatJson(data);
    expect(JSON.parse(result).a).toBeNull();
  });
});
