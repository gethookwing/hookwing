import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const openapiPath = join(__dirname, '../../openapi.yaml');
const raw = readFileSync(openapiPath, 'utf-8');
const spec = yaml.load(raw) as {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
};

describe('openapi.yaml', () => {
  it('should be valid YAML that parses to an object', () => {
    expect(spec).toBeTypeOf('object');
    expect(spec).not.toBeNull();
  });

  it('should be OpenAPI 3.1.0', () => {
    expect(spec.openapi).toBe('3.1.0');
  });

  it('should have info with title and version', () => {
    expect(spec.info.title).toBeTruthy();
    expect(spec.info.version).toBeTruthy();
  });

  it('should have paths defined', () => {
    expect(spec.paths).toBeTypeOf('object');
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
  });

  it('should document all major route groups', () => {
    const paths = Object.keys(spec.paths);
    expect(paths.some((p) => p.includes('/health'))).toBe(true);
    expect(paths.some((p) => p.includes('/tiers'))).toBe(true);
    expect(paths.some((p) => p.includes('/auth'))).toBe(true);
    expect(paths.some((p) => p.includes('/endpoints'))).toBe(true);
    expect(paths.some((p) => p.includes('/events'))).toBe(true);
    expect(paths.some((p) => p.includes('/deliveries'))).toBe(true);
    expect(paths.some((p) => p.includes('/ingest'))).toBe(true);
  });

  it('should have at least one operation per path', () => {
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
    for (const [path, operations] of Object.entries(spec.paths)) {
      const hasOperation = httpMethods.some((method) => method in operations);
      expect(hasOperation, `Path ${path} has no operations`).toBe(true);
    }
  });

  it('should have components/schemas defined', () => {
    expect(spec.components.schemas).toBeTypeOf('object');
    expect(Object.keys(spec.components.schemas).length).toBeGreaterThan(0);
  });

  it('should define key schemas', () => {
    const schemas = Object.keys(spec.components.schemas);
    expect(schemas).toContain('Error');
    expect(schemas).toContain('TierConfig');
    expect(schemas).toContain('Endpoint');
    expect(schemas).toContain('Event');
    expect(schemas).toContain('Delivery');
  });

  it('should define BearerAuth security scheme', () => {
    expect(spec.components.securitySchemes).toHaveProperty('BearerAuth');
  });

  it('should have replay endpoints documented', () => {
    const paths = Object.keys(spec.paths);
    expect(paths.some((p) => p.includes('/replay'))).toBe(true);
  });
});
