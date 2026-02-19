// Mock Factory & Stub Generator
// KIMI-TESTING-02: R16-04 spec

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type StubType = 'value' | 'function' | 'promise' | 'stream' | 'error';

export interface StubDefinition {
  type: StubType;
  value?: unknown;
  implementation?: (...args: unknown[]) => unknown;
  resolveValue?: unknown;
  rejectError?: Error;
  streamData?: unknown[];
}

export interface MockConfig {
  name: string;
  methods?: Record<string, StubDefinition>;
  properties?: Record<string, StubDefinition>;
  staticMethods?: Record<string, StubDefinition>;
}

export interface MockInstance {
  name: string;
  mock: Record<string, unknown>;
  calls: Map<string, unknown[][]>;
  reset(): void;
  getCalls(method: string): unknown[][];
  verifyCalled(method: string, times?: number): boolean;
  verifyCalledWith(method: string, args: unknown[]): boolean;
}

export interface FactoryTrait<T> {
  name: string;
  apply(data: Partial<T>): Partial<T>;
}

export interface DataFactory<T> {
  name: string;
  create(overrides?: Partial<T>): T;
  createMany(count: number, overrides?: Partial<T>): T[];
  withTrait(trait: string, overrides?: Partial<T>): T;
  sequence(fn: (n: number) => Partial<T>): T;
  registerTrait(name: string, trait: FactoryTrait<T>): void;
}

export interface SpyConfig {
  target: object;
  method: string;
  implementation?: (...args: unknown[]) => unknown;
}

export interface SpyInstance {
  original: unknown;
  calls: unknown[][];
  returnValues: unknown[];
  restore(): void;
  wasCalled(): boolean;
  wasCalledWith(...args: unknown[]): boolean;
  wasCalledTimes(times: number): boolean;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const StubDefinitionSchema = z.object({
  type: z.enum(['value', 'function', 'promise', 'stream', 'error']),
  value: z.unknown().optional(),
  implementation: z.function().optional(),
  resolveValue: z.unknown().optional(),
  rejectError: z.instanceof(Error).optional(),
  streamData: z.array(z.unknown()).optional(),
});

export const MockConfigSchema = z.object({
  name: z.string(),
  methods: z.record(StubDefinitionSchema).optional(),
  properties: z.record(StubDefinitionSchema).optional(),
  staticMethods: z.record(StubDefinitionSchema).optional(),
});

// ============================================================================
// StubBuilder Class
// ============================================================================

export class StubBuilder {
  static value<T>(val: T): StubDefinition {
    return { type: 'value', value: val };
  }

  static fn<T>(implementation: (...args: unknown[]) => T): StubDefinition {
    return { type: 'function', implementation };
  }

  static resolve<T>(value: T): StubDefinition {
    return { type: 'promise', resolveValue: value };
  }

  static reject(error: Error): StubDefinition {
    return { type: 'promise', rejectError: error };
  }

  static stream<T>(data: T[]): StubDefinition {
    return { type: 'stream', streamData: data };
  }

  static error(message: string): StubDefinition {
    return { type: 'error', value: new Error(message) };
  }

  static throws(error: Error): StubDefinition {
    return { type: 'error', value: error };
  }
}

// ============================================================================
// MockBuilder Class
// ============================================================================

export class MockBuilder {
  private config: MockConfig = { name: 'AnonymousMock' };

  name(name: string): this {
    this.config.name = name;
    return this;
  }

  method(name: string, stub: StubDefinition): this {
    if (!this.config.methods) this.config.methods = {};
    this.config.methods[name] = stub;
    return this;
  }

  property(name: string, stub: StubDefinition): this {
    if (!this.config.properties) this.config.properties = {};
    this.config.properties[name] = stub;
    return this;
  }

  staticMethod(name: string, stub: StubDefinition): this {
    if (!this.config.staticMethods) this.config.staticMethods = {};
    this.config.staticMethods[name] = stub;
    return this;
  }

  build(): MockInstance {
    const mockObj: Record<string, unknown> = {};
    const calls = new Map<string, unknown[][]>();

    // Build methods
    if (this.config.methods) {
      for (const [name, stub] of Object.entries(this.config.methods)) {
        calls.set(name, []);
        
        mockObj[name] = (...args: unknown[]) => {
          calls.get(name)!.push(args);
          return this.resolveStub(stub, args);
        };
      }
    }

    // Build properties
    if (this.config.properties) {
      for (const [name, stub] of Object.entries(this.config.properties)) {
        Object.defineProperty(mockObj, name, {
          get: () => this.resolveStub(stub),
          configurable: true,
        });
      }
    }

    // Build static methods
    if (this.config.staticMethods) {
      for (const [name, stub] of Object.entries(this.config.staticMethods)) {
        calls.set(`static.${name}`, []);
        
        (mockObj.constructor as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
          calls.get(`static.${name}`)!.push(args);
          return this.resolveStub(stub);
        };
      }
    }

    return {
      name: this.config.name,
      mock: mockObj,
      calls,
      reset: () => calls.forEach((arr) => arr.length = 0),
      getCalls: (method: string) => calls.get(method) || [],
      verifyCalled: (method: string, times?: number) => {
        const callCount = calls.get(method)?.length || 0;
        return times === undefined ? callCount > 0 : callCount === times;
      },
      verifyCalledWith: (method: string, args: unknown[]) => {
        const methodCalls = calls.get(method) || [];
        return methodCalls.some(call => this.arraysEqual(call, args));
      },
    };
  }

  private resolveStub(stub: StubDefinition, args: unknown[] = []): unknown {
    switch (stub.type) {
      case 'value':
        return stub.value;
      case 'function':
        return stub.implementation!(...args);
      case 'promise':
        if (stub.rejectError) {
          return Promise.reject(stub.rejectError);
        }
        return Promise.resolve(stub.resolveValue);
      case 'stream':
        return stub.streamData || [];
      case 'error':
        throw stub.value;
      default:
        return undefined;
    }
  }

  private arraysEqual(a: unknown[], b: unknown[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, i) => val === b[i]);
  }
}

// ============================================================================
// DataFactoryBuilder Class
// ============================================================================

export class DataFactoryBuilder<T extends Record<string, unknown>> {
  private name: string;
  private defaults: Partial<T>;
  private traits = new Map<string, FactoryTrait<T>>();
  private sequenceCounter = 0;

  constructor(name: string, defaults: Partial<T>) {
    this.name = name;
    this.defaults = defaults;
  }

  registerTrait(name: string, apply: (data: Partial<T>) => Partial<T>): this {
    this.traits.set(name, { name, apply });
    return this;
  }

  create(overrides: Partial<T> = {}): T {
    return { ...this.defaults, ...overrides } as T;
  }

  createMany(count: number, overrides: Partial<T> = {}): T[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  withTrait(traitName: string, overrides: Partial<T> = {}): T {
    const trait = this.traits.get(traitName);
    if (!trait) {
      throw new Error(`Trait not found: ${traitName}`);
    }
    const traitData = trait.apply(this.defaults);
    return { ...this.defaults, ...traitData, ...overrides } as T;
  }

  withTraits(traitNames: string[], overrides: Partial<T> = {}): T {
    let result: Partial<T> = { ...this.defaults };
    for (const traitName of traitNames) {
      const trait = this.traits.get(traitName);
      if (trait) {
        result = { ...result, ...trait.apply(result) };
      }
    }
    return { ...result, ...overrides } as T;
  }

  sequence(fn: (n: number) => Partial<T>): T {
    this.sequenceCounter++;
    const seqData = fn(this.sequenceCounter);
    return { ...this.defaults, ...seqData } as T;
  }

  build(): DataFactory<T> {
    return {
      name: this.name,
      create: (overrides?: Partial<T>) => this.create(overrides),
      createMany: (count: number, overrides?: Partial<T>) => this.createMany(count, overrides),
      withTrait: (trait: string, overrides?: Partial<T>) => this.withTrait(trait, overrides),
      sequence: (fn: (n: number) => Partial<T>) => this.sequence(fn),
      registerTrait: (name: string, trait: FactoryTrait<T>) => {
        this.traits.set(name, trait);
      },
    };
  }
}

// ============================================================================
// SpyManager Class
// ============================================================================

export class SpyManager {
  private spies: Map<string, SpyInstance> = new Map();

  create(target: object, method: string, implementation?: (...args: unknown[]) => unknown): SpyInstance {
    const key = `${target.constructor.name}.${method}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    const original = (target as Record<string, unknown>)[method];
    const calls: unknown[][] = [];
    const returnValues: unknown[] = [];

    const spyFn = (...args: unknown[]) => {
      calls.push(args);
      const result = implementation 
        ? implementation(...args) 
        : (original as (...args: unknown[]) => unknown)(...args);
      returnValues.push(result);
      return result;
    };

    (target as Record<string, unknown>)[method] = spyFn;

    const spyInstance: SpyInstance = {
      original,
      calls,
      returnValues,
      restore: () => {
        (target as Record<string, unknown>)[method] = original;
      },
      wasCalled: () => calls.length > 0,
      wasCalledWith: (...args: unknown[]) => 
        calls.some(call => this.arraysEqual(call, args)),
      wasCalledTimes: (times: number) => calls.length === times,
    };

    this.spies.set(key, spyInstance);
    return spyInstance;
  }

  restoreAll(): void {
    const spies = Array.from(this.spies.values());
    spies.forEach(spy => spy.restore());
    this.spies.clear();
  }

  private arraysEqual(a: unknown[], b: unknown[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, i) => val === b[i]);
  }
}

// ============================================================================
// MockRegistry
// ============================================================================

export class MockRegistry {
  private mocks = new Map<string, MockInstance>();
  private factories = new Map<string, DataFactory<Record<string, unknown>>>();
  private spyManager = new SpyManager();

  registerMock(name: string, mock: MockInstance): void {
    this.mocks.set(name, mock);
  }

  getMock(name: string): MockInstance | undefined {
    return this.mocks.get(name);
  }

  registerFactory<T extends Record<string, unknown>>(name: string, factory: DataFactory<T>): void {
    this.factories.set(name, factory as DataFactory<Record<string, unknown>>);
  }

  getFactory<T extends Record<string, unknown>>(name: string): DataFactory<T> | undefined {
    return this.factories.get(name) as DataFactory<T> | undefined;
  }

  createSpy(target: object, method: string, implementation?: (...args: unknown[]) => unknown): SpyInstance {
    return this.spyManager.create(target, method, implementation);
  }

  resetAll(): void {
    this.mocks.forEach(mock => mock.reset());
  }

  restoreAllSpies(): void {
    this.spyManager.restoreAll();
  }

  clear(): void {
    this.mocks.clear();
    this.factories.clear();
    this.spyManager.restoreAll();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createMock(name?: string): MockBuilder {
  const builder = new MockBuilder();
  if (name) builder.name(name);
  return builder;
}

export function createDataFactory<T extends Record<string, unknown>>(
  name: string, 
  defaults: Partial<T>
): DataFactoryBuilder<T> {
  return new DataFactoryBuilder(name, defaults);
}

export function stub(): StubBuilder {
  return StubBuilder;
}

// Global registry instance
let globalRegistry: MockRegistry | null = null;

export function getMockRegistry(): MockRegistry {
  if (!globalRegistry) {
    globalRegistry = new MockRegistry();
  }
  return globalRegistry;
}

export function resetMockRegistry(): void {
  globalRegistry?.clear();
  globalRegistry = null;
}
