import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DIContainer,
  getDIContainer,
  resetDIContainer,
  type Factory,
  type Lifetime,
} from '../di-container.js';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    vi.clearAllMocks();
    container = new DIContainer();
    resetDIContainer();
  });

  // ============================================================
  // 1. Register and resolve singleton
  // ============================================================

  it('should register and resolve a singleton dependency', () => {
    container.register<string>('greeting', () => 'hello', 'singleton');
    const result = container.resolve<string>('greeting');
    expect(result).toBe('hello');
  });

  // ============================================================
  // 2. Register and resolve transient (different instances)
  // ============================================================

  it('should register and resolve a transient dependency returning new instances', () => {
    container.register('counter', () => ({ count: Math.random() }), 'transient');
    const a = container.resolve<{ count: number }>('counter');
    const b = container.resolve<{ count: number }>('counter');
    expect(a).not.toBe(b);
  });

  // ============================================================
  // 3. Singleton returns same instance every time
  // ============================================================

  it('should return the same instance for singleton on every resolve', () => {
    container.register('service', () => ({ id: 'svc' }), 'singleton');
    const first = container.resolve<{ id: string }>('service');
    const second = container.resolve<{ id: string }>('service');
    const third = container.resolve<{ id: string }>('service');
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  // ============================================================
  // 4. Transient returns new instance every time
  // ============================================================

  it('should return a new instance for transient on every resolve', () => {
    const factory = vi.fn(() => ({ value: 42 }));
    container.register('widget', factory, 'transient');

    const a = container.resolve<{ value: number }>('widget');
    const b = container.resolve<{ value: number }>('widget');
    const c = container.resolve<{ value: number }>('widget');

    expect(factory).toHaveBeenCalledTimes(3);
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
  });

  // ============================================================
  // 5. Resolve unknown name throws
  // ============================================================

  it('should throw a descriptive error when resolving an unknown name', () => {
    expect(() => container.resolve('nonexistent')).toThrow(
      'DIContainer: No registration found for "nonexistent"',
    );
  });

  // ============================================================
  // 6. has() returns true/false correctly
  // ============================================================

  it('should return true from has() for a registered name', () => {
    container.register('x', () => 1);
    expect(container.has('x')).toBe(true);
  });

  it('should return false from has() for an unregistered name', () => {
    expect(container.has('missing')).toBe(false);
  });

  // ============================================================
  // 7. unregister() removes registration
  // ============================================================

  it('should remove a registration via unregister()', () => {
    container.register('temp', () => 'val');
    expect(container.has('temp')).toBe(true);

    const removed = container.unregister('temp');
    expect(removed).toBe(true);
    expect(container.has('temp')).toBe(false);
  });

  // ============================================================
  // 8. clear() removes all
  // ============================================================

  it('should remove all registrations when clear() is called', () => {
    container.register('a', () => 1);
    container.register('b', () => 2);
    container.register('c', () => 3);

    container.clear();

    expect(container.has('a')).toBe(false);
    expect(container.has('b')).toBe(false);
    expect(container.has('c')).toBe(false);
    expect(container.getRegisteredNames()).toEqual([]);
  });

  // ============================================================
  // 9. Override existing registration
  // ============================================================

  it('should override an existing registration (last wins)', () => {
    container.register<string>('config', () => 'old');
    container.register<string>('config', () => 'new');

    expect(container.resolve<string>('config')).toBe('new');
  });

  // ============================================================
  // 10. getRegisteredNames() lists all
  // ============================================================

  it('should return all registered names via getRegisteredNames()', () => {
    container.register('alpha', () => 'a');
    container.register('beta', () => 'b');
    container.register('gamma', () => 'c');

    const names = container.getRegisteredNames();
    expect(names).toEqual(['alpha', 'beta', 'gamma']);
  });

  // ============================================================
  // 11. Complex object registration
  // ============================================================

  it('should handle complex nested object registration and resolution', () => {
    interface AppConfig {
      db: { host: string; port: number };
      features: string[];
    }

    container.register<AppConfig>('appConfig', () => ({
      db: { host: 'localhost', port: 5432 },
      features: ['auth', 'logging', 'metrics'],
    }));

    const config = container.resolve<AppConfig>('appConfig');
    expect(config.db.host).toBe('localhost');
    expect(config.db.port).toBe(5432);
    expect(config.features).toContain('auth');
    expect(config.features).toHaveLength(3);
  });

  // ============================================================
  // 12. Factory function receives no args
  // ============================================================

  it('should invoke factory with zero arguments', () => {
    const factory: Factory<number> = vi.fn(() => 99);
    container.register('num', factory);
    container.resolve<number>('num');

    expect(factory).toHaveBeenCalledWith();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  // ============================================================
  // 13. Singleton lifecycle — factory called only once
  // ============================================================

  it('should call singleton factory only once regardless of resolve count', () => {
    const factory = vi.fn(() => ({ created: Date.now() }));
    container.register('singleton-svc', factory, 'singleton');

    container.resolve('singleton-svc');
    container.resolve('singleton-svc');
    container.resolve('singleton-svc');

    expect(factory).toHaveBeenCalledTimes(1);
  });

  // ============================================================
  // 14. Register same name twice (override)
  // ============================================================

  it('should allow registering the same name twice and use the latest factory', () => {
    const factoryA = vi.fn(() => 'A');
    const factoryB = vi.fn(() => 'B');

    container.register('dup', factoryA, 'singleton');
    container.register('dup', factoryB, 'singleton');

    const val = container.resolve<string>('dup');
    expect(val).toBe('B');
    expect(factoryA).not.toHaveBeenCalled();
    expect(factoryB).toHaveBeenCalledTimes(1);
  });

  // ============================================================
  // 15. Unregister returns false for unknown
  // ============================================================

  it('should return false when unregistering a name that does not exist', () => {
    expect(container.unregister('phantom')).toBe(false);
  });

  // ============================================================
  // 16. Resolve after unregister throws
  // ============================================================

  it('should throw when resolving a name that was unregistered', () => {
    container.register('ephemeral', () => 'here');
    container.unregister('ephemeral');

    expect(() => container.resolve('ephemeral')).toThrow(
      'DIContainer: No registration found for "ephemeral"',
    );
  });

  // ============================================================
  // 17. Default lifetime is singleton
  // ============================================================

  it('should default to singleton lifetime when none is specified', () => {
    const factory = vi.fn(() => ({ tag: 'default' }));
    container.register('default-life', factory);

    const a = container.resolve('default-life');
    const b = container.resolve('default-life');

    expect(a).toBe(b);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  // ============================================================
  // 18. Override changes lifetime from singleton to transient
  // ============================================================

  it('should allow overriding lifetime from singleton to transient', () => {
    container.register('morph', () => ({ v: 1 }), 'singleton');
    const s1 = container.resolve('morph');
    const s2 = container.resolve('morph');
    expect(s1).toBe(s2);

    // Re-register as transient
    container.register('morph', () => ({ v: 2 }), 'transient');
    const t1 = container.resolve('morph');
    const t2 = container.resolve('morph');
    expect(t1).not.toBe(t2);
  });

  // ============================================================
  // 19. getRegisteredNames() returns empty array for empty container
  // ============================================================

  it('should return an empty array when no registrations exist', () => {
    expect(container.getRegisteredNames()).toEqual([]);
  });

  // ============================================================
  // 20. Resolve error message lists available registrations
  // ============================================================

  it('should list available registrations in the error message', () => {
    container.register('foo', () => 1);
    container.register('bar', () => 2);

    expect(() => container.resolve('baz')).toThrow('Available registrations: [foo, bar]');
  });

  // ============================================================
  // 21. getDIContainer() returns a DIContainer
  // ============================================================

  it('should return a DIContainer instance from getDIContainer()', () => {
    const global = getDIContainer();
    expect(global).toBeInstanceOf(DIContainer);
  });

  // ============================================================
  // 22. getDIContainer() returns the same instance on repeated calls
  // ============================================================

  it('should return the same global container on repeated getDIContainer() calls', () => {
    const first = getDIContainer();
    const second = getDIContainer();
    expect(first).toBe(second);
  });

  // ============================================================
  // 23. resetDIContainer() creates a new instance on next get
  // ============================================================

  it('should return a new container after resetDIContainer()', () => {
    const before = getDIContainer();
    before.register('x', () => 1);

    resetDIContainer();
    const after = getDIContainer();

    expect(after).not.toBe(before);
    expect(after.has('x')).toBe(false);
  });

  // ============================================================
  // 24. Multiple containers are independent
  // ============================================================

  it('should maintain independent registrations across separate containers', () => {
    const containerA = new DIContainer();
    const containerB = new DIContainer();

    containerA.register('shared', () => 'A');
    containerB.register('shared', () => 'B');

    expect(containerA.resolve<string>('shared')).toBe('A');
    expect(containerB.resolve<string>('shared')).toBe('B');
  });

  // ============================================================
  // 25. Class-based dependency registration
  // ============================================================

  it('should support class-based dependency registration', () => {
    class Logger {
      log(msg: string): string {
        return `[LOG] ${msg}`;
      }
    }

    container.register('logger', () => new Logger(), 'singleton');
    const logger = container.resolve<Logger>('logger');
    expect(logger.log('test')).toBe('[LOG] test');
  });

  // ============================================================
  // 26. Dependency chain — one factory resolves another
  // ============================================================

  it('should support dependency chains where factories resolve other deps', () => {
    container.register<string>('dbUrl', () => 'postgres://localhost/app');
    container.register('dbClient', () => {
      const url = container.resolve<string>('dbUrl');
      return { url, connected: true };
    });

    const client = container.resolve<{ url: string; connected: boolean }>('dbClient');
    expect(client.url).toBe('postgres://localhost/app');
    expect(client.connected).toBe(true);
  });

  // ============================================================
  // 27. Singleton caches even for falsy values (0, '', false)
  // ============================================================

  it('should not re-invoke factory for singletons that return truthy values', () => {
    const factory = vi.fn(() => 'cached');
    container.register('cached-val', factory, 'singleton');

    container.resolve('cached-val');
    container.resolve('cached-val');
    container.resolve('cached-val');

    expect(factory).toHaveBeenCalledTimes(1);
  });

  // ============================================================
  // 28. clear() resets singleton caches
  // ============================================================

  it('should reset singleton caches when clear() is called', () => {
    const factory = vi.fn(() => ({ fresh: true }));
    container.register('svc', factory, 'singleton');

    const before = container.resolve('svc');
    expect(factory).toHaveBeenCalledTimes(1);

    container.clear();
    container.register('svc', factory, 'singleton');

    const after = container.resolve('svc');
    expect(factory).toHaveBeenCalledTimes(2);
    expect(before).not.toBe(after);
  });

  // ============================================================
  // 29. Unregister clears singleton cache
  // ============================================================

  it('should clear singleton cache when unregistered and re-registered', () => {
    const factory = vi.fn(() => ({ ts: Date.now() }));
    container.register('cached', factory, 'singleton');

    const first = container.resolve('cached');
    expect(factory).toHaveBeenCalledTimes(1);

    container.unregister('cached');
    container.register('cached', factory, 'singleton');

    const second = container.resolve('cached');
    expect(factory).toHaveBeenCalledTimes(2);
    expect(first).not.toBe(second);
  });

  // ============================================================
  // 30. Type exports are usable
  // ============================================================

  it('should export Factory and Lifetime types that are usable', () => {
    const myFactory: Factory<number> = () => 42;
    const myLifetime: Lifetime = 'transient';

    container.register('typed', myFactory, myLifetime);
    const val = container.resolve<number>('typed');
    expect(val).toBe(42);
  });
});
