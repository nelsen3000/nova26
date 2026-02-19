// Tests for Mock Factory & Stub Generator
// KIMI-TESTING-02

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  StubBuilder,
  MockBuilder,
  DataFactoryBuilder,
  SpyManager,
  MockRegistry,
  createMock,
  createDataFactory,
  getMockRegistry,
  resetMockRegistry,
} from './mock-factory.js';

describe('StubBuilder', () => {
  it('creates value stub', () => {
    const stub = StubBuilder.value(42);
    expect(stub.type).toBe('value');
    expect(stub.value).toBe(42);
  });

  it('creates function stub', () => {
    const fn = () => 'result';
    const stub = StubBuilder.fn(fn);
    expect(stub.type).toBe('function');
    expect(stub.implementation).toBe(fn);
  });

  it('creates resolve stub', () => {
    const stub = StubBuilder.resolve({ data: 'test' });
    expect(stub.type).toBe('promise');
    expect(stub.resolveValue).toEqual({ data: 'test' });
  });

  it('creates reject stub', () => {
    const error = new Error('fail');
    const stub = StubBuilder.reject(error);
    expect(stub.type).toBe('promise');
    expect(stub.rejectError).toBe(error);
  });

  it('creates stream stub', () => {
    const stub = StubBuilder.stream([1, 2, 3]);
    expect(stub.type).toBe('stream');
    expect(stub.streamData).toEqual([1, 2, 3]);
  });

  it('creates error stub from message', () => {
    const stub = StubBuilder.error('error message');
    expect(stub.type).toBe('error');
    expect(stub.value).toBeInstanceOf(Error);
  });

  it('creates throws stub', () => {
    const error = new Error('custom');
    const stub = StubBuilder.throws(error);
    expect(stub.type).toBe('error');
    expect(stub.value).toBe(error);
  });
});

describe('MockBuilder', () => {
  it('builds mock with name', () => {
    const mock = new MockBuilder()
      .name('TestMock')
      .build();

    expect(mock.name).toBe('TestMock');
  });

  it('builds mock with value method', () => {
    const mock = new MockBuilder()
      .method('getValue', StubBuilder.value(42))
      .build();

    expect(mock.mock.getValue()).toBe(42);
  });

  it('builds mock with function method', () => {
    const mock = new MockBuilder()
      .method('compute', StubBuilder.fn((a: unknown, b: unknown) => (a as number) + (b as number)))
      .build();

    expect(mock.mock.compute(2, 3)).toBe(5);
  });

  it('builds mock with promise resolve', async () => {
    const mock = new MockBuilder()
      .method('fetch', StubBuilder.resolve({ data: 'test' }))
      .build();

    const result = await mock.mock.fetch();
    expect(result).toEqual({ data: 'test' });
  });

  it('builds mock with promise reject', async () => {
    const error = new Error('fail');
    const mock = new MockBuilder()
      .method('fetch', StubBuilder.reject(error))
      .build();

    await expect(mock.mock.fetch()).rejects.toBe(error);
  });

  it('builds mock with property', () => {
    const mock = new MockBuilder()
      .property('name', StubBuilder.value('Test'))
      .build();

    expect(mock.mock.name).toBe('Test');
  });

  it('tracks method calls', () => {
    const mock = new MockBuilder()
      .method('save', StubBuilder.value(undefined))
      .build();

    mock.mock.save('arg1', 'arg2');
    mock.mock.save('arg3');

    expect(mock.getCalls('save')).toHaveLength(2);
    expect(mock.getCalls('save')[0]).toEqual(['arg1', 'arg2']);
  });

  it('verifies method was called', () => {
    const mock = new MockBuilder()
      .method('save', StubBuilder.value(undefined))
      .build();

    expect(mock.verifyCalled('save')).toBe(false);
    mock.mock.save();
    expect(mock.verifyCalled('save')).toBe(true);
  });

  it('verifies method called specific times', () => {
    const mock = new MockBuilder()
      .method('save', StubBuilder.value(undefined))
      .build();

    mock.mock.save();
    mock.mock.save();

    expect(mock.verifyCalled('save', 2)).toBe(true);
    expect(mock.verifyCalled('save', 3)).toBe(false);
  });

  it('verifies method called with args', () => {
    const mock = new MockBuilder()
      .method('save', StubBuilder.value(undefined))
      .build();

    mock.mock.save('arg1', 42);

    expect(mock.verifyCalledWith('save', ['arg1', 42])).toBe(true);
    expect(mock.verifyCalledWith('save', ['wrong'])).toBe(false);
  });

  it('resets call history', () => {
    const mock = new MockBuilder()
      .method('save', StubBuilder.value(undefined))
      .build();

    mock.mock.save();
    expect(mock.getCalls('save')).toHaveLength(1);

    mock.reset();
    expect(mock.getCalls('save')).toHaveLength(0);
  });
});

describe('DataFactoryBuilder', () => {
  interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'user';
  }

  const defaults: Partial<User> = {
    id: 1,
    name: 'Default User',
    email: 'user@example.com',
    role: 'user',
  };

  it('creates entity with defaults', () => {
    const factory = new DataFactoryBuilder('User', defaults).build();
    const user = factory.create();

    expect(user.id).toBe(1);
    expect(user.name).toBe('Default User');
  });

  it('creates entity with overrides', () => {
    const factory = new DataFactoryBuilder('User', defaults).build();
    const user = factory.create({ name: 'Custom Name', role: 'admin' });

    expect(user.name).toBe('Custom Name');
    expect(user.role).toBe('admin');
    expect(user.email).toBe('user@example.com'); // from defaults
  });

  it('creates multiple entities', () => {
    const factory = new DataFactoryBuilder('User', defaults).build();
    const users = factory.createMany(3);

    expect(users).toHaveLength(3);
    expect(users[0].id).toBe(1);
    expect(users[1].id).toBe(1);
  });

  it('registers and applies traits', () => {
    const factory = new DataFactoryBuilder('User', defaults)
      .registerTrait('admin', (data) => ({ ...data, role: 'admin' as const }))
      .build();

    const admin = factory.withTrait('admin');
    expect(admin.role).toBe('admin');
    expect(admin.name).toBe('Default User'); // from defaults
  });

  it('applies traits with overrides', () => {
    const factory = new DataFactoryBuilder('User', defaults)
      .registerTrait('admin', (data) => ({ ...data, role: 'admin' as const }))
      .build();

    const admin = factory.withTrait('admin', { name: 'Admin User' });
    expect(admin.role).toBe('admin');
    expect(admin.name).toBe('Admin User');
  });

  it('throws for unknown trait', () => {
    const factory = new DataFactoryBuilder('User', defaults).build();
    expect(() => factory.withTrait('unknown')).toThrow('Trait not found');
  });

  it('generates sequential entities', () => {
    const factory = new DataFactoryBuilder('User', defaults).build();
    
    const user1 = factory.sequence((n) => ({ id: n, name: `User ${n}` }));
    const user2 = factory.sequence((n) => ({ id: n, name: `User ${n}` }));

    expect(user1.id).toBe(1);
    expect(user1.name).toBe('User 1');
    expect(user2.id).toBe(2);
    expect(user2.name).toBe('User 2');
  });
});

describe('SpyManager', () => {
  it('creates spy on object method', () => {
    const obj = {
      greet: (name: string) => `Hello, ${name}!`,
    };

    const manager = new SpyManager();
    const spy = manager.create(obj, 'greet');

    obj.greet('World');

    expect(spy.wasCalled()).toBe(true);
    expect(spy.wasCalledWith('World')).toBe(true);
    expect(spy.wasCalledTimes(1)).toBe(true);
  });

  it('tracks multiple calls', () => {
    const obj = { method: () => 'result' };

    const manager = new SpyManager();
    manager.create(obj, 'method');

    obj.method();
    obj.method();
    obj.method();

    expect(obj.method()).toBe('result');
  });

  it('restores original method', () => {
    const original = () => 'original';
    const obj = { method: original };

    const manager = new SpyManager();
    const spy = manager.create(obj, 'method');

    spy.restore();

    expect(obj.method).toBe(original);
  });

  it('replaces with custom implementation', () => {
    const obj = { method: () => 'original' };

    const manager = new SpyManager();
    manager.create(obj, 'method', () => 'mocked');

    expect(obj.method()).toBe('mocked');
  });

  it('tracks return values', () => {
    const obj = { add: (a: number, b: number) => a + b };

    const manager = new SpyManager();
    const spy = manager.create(obj, 'add');

    obj.add(1, 2);
    obj.add(3, 4);

    expect(spy.returnValues).toEqual([3, 7]);
  });

  it('restores all spies', () => {
    const obj1 = { method: () => 'obj1' };
    const obj2 = { method: () => 'obj2' };
    const original1 = obj1.method;
    const original2 = obj2.method;

    const manager = new SpyManager();
    manager.create(obj1, 'method');
    manager.create(obj2, 'method');

    manager.restoreAll();

    expect(obj1.method).toBe(original1);
    expect(obj2.method).toBe(original2);
  });
});

describe('MockRegistry', () => {
  let registry: MockRegistry;

  beforeEach(() => {
    registry = new MockRegistry();
  });

  it('registers and retrieves mock', () => {
    const mock = new MockBuilder().name('Test').build();
    registry.registerMock('testMock', mock);

    expect(registry.getMock('testMock')).toBe(mock);
  });

  it('registers and retrieves factory', () => {
    const factory = new DataFactoryBuilder('User', { id: 1 }).build();
    registry.registerFactory('userFactory', factory);

    expect(registry.getFactory('userFactory')).toBe(factory);
  });

  it('resets all mocks', () => {
    const mock = new MockBuilder()
      .method('save', StubBuilder.value(undefined))
      .build();
    
    registry.registerMock('testMock', mock);
    mock.mock.save();
    
    expect(mock.getCalls('save')).toHaveLength(1);
    
    registry.resetAll();
    
    expect(mock.getCalls('save')).toHaveLength(0);
  });

  it('clears everything', () => {
    const mock = new MockBuilder().build();
    const factory = new DataFactoryBuilder('User', {}).build();
    
    registry.registerMock('mock', mock);
    registry.registerFactory('factory', factory);

    registry.clear();

    expect(registry.getMock('mock')).toBeUndefined();
    expect(registry.getFactory('factory')).toBeUndefined();
  });
});

describe('Helper Functions', () => {
  beforeEach(() => {
    resetMockRegistry();
  });

  it('createMock returns MockBuilder', () => {
    const builder = createMock('TestMock');
    const mock = builder.build();
    expect(mock.name).toBe('TestMock');
  });

  it('createDataFactory returns DataFactoryBuilder', () => {
    const builder = createDataFactory('User', { id: 1 });
    const factory = builder.build();
    expect(factory.name).toBe('User');
  });

  it('getMockRegistry returns singleton', () => {
    const registry1 = getMockRegistry();
    const registry2 = getMockRegistry();
    expect(registry1).toBe(registry2);
  });

  it('resetMockRegistry clears registry', () => {
    const registry1 = getMockRegistry();
    resetMockRegistry();
    const registry2 = getMockRegistry();
    expect(registry1).not.toBe(registry2);
  });
});
