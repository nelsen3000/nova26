// Environment Management
// KIMI-R17-09: R17 spec

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type EnvironmentType = 'local' | 'development' | 'staging' | 'production';
export type VariableType = 'string' | 'number' | 'boolean' | 'json' | 'secret';
export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error';

export interface Environment {
  id: string;
  name: string;
  type: EnvironmentType;
  description?: string;
  variables: EnvironmentVariable[];
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  type: VariableType;
  encrypted: boolean;
  description?: string;
  tags: string[];
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
}

export interface EnvironmentDiff {
  added: EnvironmentVariable[];
  removed: EnvironmentVariable[];
  modified: { variable: EnvironmentVariable; previousValue: string }[];
}

export interface EnvironmentTemplate {
  name: string;
  type: EnvironmentType;
  variables: Omit<EnvironmentVariable, 'id' | 'syncStatus' | 'lastSyncedAt'>[];
  config: Record<string, unknown>;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const EnvironmentVariableSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'json', 'secret']),
  encrypted: z.boolean(),
  description: z.string().optional(),
  tags: z.array(z.string()),
  syncStatus: z.enum(['synced', 'pending', 'conflict', 'error']),
  lastSyncedAt: z.string().optional(),
});

export const EnvironmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['local', 'development', 'staging', 'production']),
  description: z.string().optional(),
  variables: z.array(EnvironmentVariableSchema),
  config: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ============================================================================
// EnvironmentManager Class
// ============================================================================

export class EnvironmentManager {
  private environments = new Map<string, Environment>();

  createEnvironment(name: string, type: EnvironmentType, description?: string): Environment {
    const env: Environment = {
      id: crypto.randomUUID(),
      name,
      type,
      description,
      variables: [],
      config: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.environments.set(env.id, env);
    return env;
  }

  createFromTemplate(template: EnvironmentTemplate): Environment {
    const env = this.createEnvironment(template.name, template.type);
    
    for (const varTemplate of template.variables) {
      this.addVariable(env.id, varTemplate);
    }

    env.config = { ...template.config };
    return env;
  }

  addVariable(envId: string, variable: Omit<EnvironmentVariable, 'id' | 'syncStatus' | 'lastSyncedAt'>): Environment {
    const env = this.environments.get(envId);
    if (!env) throw new Error(`Environment not found: ${envId}`);

    const newVar: EnvironmentVariable = {
      ...variable,
      id: crypto.randomUUID(),
      syncStatus: 'pending',
    };

    // Check for existing key
    const existingIndex = env.variables.findIndex(v => v.key === variable.key);
    if (existingIndex >= 0) {
      env.variables[existingIndex] = newVar;
    } else {
      env.variables.push(newVar);
    }

    env.updatedAt = new Date().toISOString();
    return env;
  }

  updateVariable(envId: string, varId: string, updates: Partial<EnvironmentVariable>): Environment {
    const env = this.environments.get(envId);
    if (!env) throw new Error(`Environment not found: ${envId}`);

    const variable = env.variables.find(v => v.id === varId);
    if (!variable) throw new Error(`Variable not found: ${varId}`);

    Object.assign(variable, updates, { syncStatus: 'pending' as SyncStatus });
    env.updatedAt = new Date().toISOString();

    return env;
  }

  removeVariable(envId: string, varId: string): Environment {
    const env = this.environments.get(envId);
    if (!env) throw new Error(`Environment not found: ${envId}`);

    env.variables = env.variables.filter(v => v.id !== varId);
    env.updatedAt = new Date().toISOString();

    return env;
  }

  deleteEnvironment(id: string): boolean {
    return this.environments.delete(id);
  }

  getEnvironment(id: string): Environment | undefined {
    return this.environments.get(id);
  }

  getEnvironmentsByType(type: EnvironmentType): Environment[] {
    return Array.from(this.environments.values()).filter(e => e.type === type);
  }

  getVariable(envId: string, key: string): EnvironmentVariable | undefined {
    const env = this.environments.get(envId);
    return env?.variables.find(v => v.key === key);
  }

  getSecrets(envId: string): EnvironmentVariable[] {
    const env = this.environments.get(envId);
    return env?.variables.filter(v => v.type === 'secret' || v.encrypted) || [];
  }

  diffEnvironments(envId1: string, envId2: string): EnvironmentDiff {
    const env1 = this.environments.get(envId1);
    const env2 = this.environments.get(envId2);

    if (!env1 || !env2) throw new Error('Environment not found');

    const env1Keys = new Map(env1.variables.map(v => [v.key, v]));
    const env2Keys = new Map(env2.variables.map(v => [v.key, v]));

    const added: EnvironmentVariable[] = [];
    const removed: EnvironmentVariable[] = [];
    const modified: { variable: EnvironmentVariable; previousValue: string }[] = [];

    for (const [key, v2] of env2Keys) {
      const v1 = env1Keys.get(key);
      if (!v1) {
        added.push(v2);
      } else if (v1.value !== v2.value) {
        modified.push({ variable: v2, previousValue: v1.value });
      }
    }

    for (const [key, v1] of env1Keys) {
      if (!env2Keys.has(key)) {
        removed.push(v1);
      }
    }

    return { added, removed, modified };
  }

  syncEnvironment(envId: string): SyncResult {
    const env = this.environments.get(envId);
    if (!env) throw new Error(`Environment not found: ${envId}`);

    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    for (const variable of env.variables) {
      if (variable.syncStatus === 'pending') {
        try {
          // Simulate sync
          variable.syncStatus = 'synced';
          variable.lastSyncedAt = new Date().toISOString();
          result.synced++;
        } catch (error) {
          variable.syncStatus = 'error';
          result.failed++;
          result.errors.push((error as Error).message);
        }
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  cloneEnvironment(sourceId: string, newName: string, newType: EnvironmentType): Environment {
    const source = this.environments.get(sourceId);
    if (!source) throw new Error(`Source environment not found: ${sourceId}`);

    const cloned = this.createEnvironment(newName, newType, `Cloned from ${source.name}`);
    
    for (const variable of source.variables) {
      this.addVariable(cloned.id, {
        key: variable.key,
        value: variable.value,
        type: variable.type,
        encrypted: variable.encrypted,
        description: variable.description,
        tags: [...variable.tags],
      });
    }

    return cloned;
  }

  generateDotenv(envId: string): string {
    const env = this.environments.get(envId);
    if (!env) throw new Error(`Environment not found: ${envId}`);

    const lines: string[] = [`# Environment: ${env.name}`, `# Type: ${env.type}`, ''];

    for (const variable of env.variables) {
      if (variable.description) {
        lines.push(`# ${variable.description}`);
      }
      if (variable.encrypted) {
        lines.push(`# ${variable.key}=<encrypted>`);
      } else {
        lines.push(`${variable.key}=${variable.value}`);
      }
    }

    return lines.join('\n');
  }

  validateEnvironment(envId: string): { valid: boolean; errors: string[] } {
    const env = this.environments.get(envId);
    if (!env) throw new Error(`Environment not found: ${envId}`);

    const errors: string[] = [];
    const keys = new Set<string>();

    for (const variable of env.variables) {
      if (keys.has(variable.key)) {
        errors.push(`Duplicate key: ${variable.key}`);
      }
      keys.add(variable.key);

      if (!variable.key.match(/^[A-Z_][A-Z0-9_]*$/)) {
        errors.push(`Invalid key format: ${variable.key}`);
      }

      if (variable.type === 'json') {
        try {
          JSON.parse(variable.value);
        } catch {
          errors.push(`Invalid JSON for ${variable.key}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createEnvironmentManager(): EnvironmentManager {
  return new EnvironmentManager();
}

export function maskSecret(value: string, visible = 4): string {
  if (value.length <= visible * 2) return '*'.repeat(value.length);
  return value.slice(0, visible) + '*'.repeat(value.length - visible * 2) + value.slice(-visible);
}

export function parseDotenv(content: string): Array<{ key: string; value: string }> {
  const variables: Array<{ key: string; value: string }> = [];
  
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    
    const eqIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    
    if (key) {
      variables.push({ key, value: value.replace(/^["']|["']$/g, '') });
    }
  }

  return variables;
}
