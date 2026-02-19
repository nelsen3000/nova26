// Tests for Environment Management
// KIMI-R17-09

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EnvironmentManager,
  createEnvironmentManager,
  maskSecret,
  parseDotenv,
  EnvironmentSchema,
  EnvironmentVariableSchema,
} from './environment-manager.js';

describe('EnvironmentManager', () => {
  let manager: EnvironmentManager;

  beforeEach(() => {
    manager = new EnvironmentManager();
  });

  describe('createEnvironment', () => {
    it('creates environment', () => {
      const env = manager.createEnvironment('Production', 'production', 'Main prod env');

      expect(env.name).toBe('Production');
      expect(env.type).toBe('production');
      expect(env.description).toBe('Main prod env');
    });
  });

  describe('addVariable', () => {
    it('adds variable', () => {
      const env = manager.createEnvironment('Test', 'development');
      const updated = manager.addVariable(env.id, {
        key: 'API_URL',
        value: 'https://api.example.com',
        type: 'string',
        encrypted: false,
        tags: ['api'],
      });

      expect(updated.variables).toHaveLength(1);
      expect(updated.variables[0].key).toBe('API_URL');
    });

    it('updates existing variable', () => {
      const env = manager.createEnvironment('Test', 'development');
      manager.addVariable(env.id, { key: 'API_URL', value: 'old', type: 'string', encrypted: false, tags: [] });
      const updated = manager.addVariable(env.id, { key: 'API_URL', value: 'new', type: 'string', encrypted: false, tags: [] });

      expect(updated.variables).toHaveLength(1);
      expect(updated.variables[0].value).toBe('new');
    });
  });

  describe('updateVariable', () => {
    it('updates variable', () => {
      const env = manager.createEnvironment('Test', 'development');
      manager.addVariable(env.id, { key: 'API_URL', value: 'old', type: 'string', encrypted: false, tags: [] });
      const variable = manager.getVariable(env.id, 'API_URL')!;

      manager.updateVariable(env.id, variable.id, { value: 'new' });

      expect(manager.getVariable(env.id, 'API_URL')?.value).toBe('new');
    });
  });

  describe('removeVariable', () => {
    it('removes variable', () => {
      const env = manager.createEnvironment('Test', 'development');
      manager.addVariable(env.id, { key: 'API_URL', value: 'url', type: 'string', encrypted: false, tags: [] });
      const variable = manager.getVariable(env.id, 'API_URL')!;

      const updated = manager.removeVariable(env.id, variable.id);

      expect(updated.variables).toHaveLength(0);
    });
  });

  describe('cloneEnvironment', () => {
    it('clones environment', () => {
      const source = manager.createEnvironment('Source', 'development');
      manager.addVariable(source.id, { key: 'KEY', value: 'value', type: 'string', encrypted: false, tags: ['tag'] });

      const cloned = manager.cloneEnvironment(source.id, 'Clone', 'staging');

      expect(cloned.name).toBe('Clone');
      expect(cloned.type).toBe('staging');
      expect(cloned.variables).toHaveLength(1);
    });
  });

  describe('diffEnvironments', () => {
    it('finds added variables', () => {
      const env1 = manager.createEnvironment('Env1', 'development');
      const env2 = manager.createEnvironment('Env2', 'development');
      manager.addVariable(env2.id, { key: 'NEW', value: 'val', type: 'string', encrypted: false, tags: [] });

      const diff = manager.diffEnvironments(env1.id, env2.id);

      expect(diff.added).toHaveLength(1);
    });

    it('finds modified variables', () => {
      const env1 = manager.createEnvironment('Env1', 'development');
      const env2 = manager.createEnvironment('Env2', 'development');
      manager.addVariable(env1.id, { key: 'KEY', value: 'old', type: 'string', encrypted: false, tags: [] });
      manager.addVariable(env2.id, { key: 'KEY', value: 'new', type: 'string', encrypted: false, tags: [] });

      const diff = manager.diffEnvironments(env1.id, env2.id);

      expect(diff.modified).toHaveLength(1);
    });
  });

  describe('syncEnvironment', () => {
    it('syncs pending variables', () => {
      const env = manager.createEnvironment('Test', 'development');
      manager.addVariable(env.id, { key: 'KEY', value: 'val', type: 'string', encrypted: false, tags: [] });

      const result = manager.syncEnvironment(env.id);

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
    });
  });

  describe('generateDotenv', () => {
    it('generates dotenv format', () => {
      const env = manager.createEnvironment('Test', 'development');
      manager.addVariable(env.id, { key: 'API_URL', value: 'https://api.com', type: 'string', encrypted: false, tags: [] });

      const dotenv = manager.generateDotenv(env.id);

      expect(dotenv).toContain('API_URL=https://api.com');
    });
  });

  describe('validateEnvironment', () => {
    it('validates correct environment', () => {
      const env = manager.createEnvironment('Test', 'development');
      manager.addVariable(env.id, { key: 'VALID_KEY', value: 'val', type: 'string', encrypted: false, tags: [] });

      const validation = manager.validateEnvironment(env.id);

      expect(validation.valid).toBe(true);
    });

    it('detects duplicate keys', () => {
      const env = manager.createEnvironment('Test', 'development');
      // Manually add duplicate keys by manipulating the internal structure
      const environment = manager.getEnvironment(env.id)!;
      environment.variables.push({
        id: 'v1', key: 'KEY', value: 'val1', type: 'string', encrypted: false, tags: [], syncStatus: 'synced'
      });
      environment.variables.push({
        id: 'v2', key: 'KEY', value: 'val2', type: 'string', encrypted: false, tags: [], syncStatus: 'synced'
      });

      const validation = manager.validateEnvironment(env.id);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Duplicate'))).toBe(true);
    });

    it('detects invalid JSON', () => {
      const env = manager.createEnvironment('Test', 'development');
      manager.addVariable(env.id, { key: 'JSON_VAR', value: 'not json', type: 'json', encrypted: false, tags: [] });

      const validation = manager.validateEnvironment(env.id);

      expect(validation.valid).toBe(false);
    });
  });

  describe('getSecrets', () => {
    it('returns secret variables', () => {
      const env = manager.createEnvironment('Test', 'development');
      manager.addVariable(env.id, { key: 'SECRET', value: 'hidden', type: 'secret', encrypted: true, tags: [] });
      manager.addVariable(env.id, { key: 'PUBLIC', value: 'visible', type: 'string', encrypted: false, tags: [] });

      const secrets = manager.getSecrets(env.id);

      expect(secrets).toHaveLength(1);
      expect(secrets[0].key).toBe('SECRET');
    });
  });
});

describe('Helper Functions', () => {
  it('createEnvironmentManager creates instance', () => {
    const instance = createEnvironmentManager();
    expect(instance).toBeInstanceOf(EnvironmentManager);
  });

  it('maskSecret masks value', () => {
    expect(maskSecret('secretvalue', 2)).toBe('se*******ue');
    expect(maskSecret('abcd', 2)).toBe('****');
  });

  it('parseDotenv parses content', () => {
    const content = `
      # Comment
      KEY1=value1
      KEY2="quoted value"
      INVALID_LINE
    `;

    const vars = parseDotenv(content);

    expect(vars).toHaveLength(2);
    expect(vars.find(v => v.key === 'KEY1')?.value).toBe('value1');
  });
});

describe('Zod Schemas', () => {
  it('validates environment', () => {
    const env = {
      id: 'e1',
      name: 'Test',
      type: 'development',
      variables: [],
      config: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = EnvironmentSchema.safeParse(env);
    expect(result.success).toBe(true);
  });

  it('validates environment variable', () => {
    const variable = {
      id: 'v1',
      key: 'API_URL',
      value: 'https://api.com',
      type: 'string',
      encrypted: false,
      tags: [],
      syncStatus: 'synced',
    };
    const result = EnvironmentVariableSchema.safeParse(variable);
    expect(result.success).toBe(true);
  });
});
