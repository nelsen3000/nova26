// MX-11: Typed Dependency Injection Container
// Provides a simple DI container with singleton and transient lifetime support

// ============================================================================
// Types
// ============================================================================

export type Factory<T> = () => T;
export type Lifetime = 'singleton' | 'transient';

interface Registration {
  factory: Factory<unknown>;
  lifetime: Lifetime;
  instance: unknown | undefined;
}

// ============================================================================
// DIContainer
// ============================================================================

export class DIContainer {
  private readonly registrations = new Map<string, Registration>();

  /**
   * Register a factory under the given name.
   * If a registration already exists for the name it is overridden (last wins).
   */
  register<T>(name: string, factory: Factory<T>, lifetime: Lifetime = 'singleton'): void {
    this.registrations.set(name, {
      factory: factory as Factory<unknown>,
      lifetime,
      instance: undefined,
    });
  }

  /**
   * Resolve the dependency registered under `name`.
   * For singletons the factory is invoked once and the instance is cached.
   * For transients a new instance is created on every call.
   *
   * @throws Error if no registration exists for `name`.
   */
  resolve<T>(name: string): T {
    const reg = this.registrations.get(name);
    if (!reg) {
      throw new Error(
        `DIContainer: No registration found for "${name}". ` +
          `Available registrations: [${this.getRegisteredNames().join(', ')}]`,
      );
    }

    if (reg.lifetime === 'singleton') {
      if (reg.instance === undefined) {
        reg.instance = reg.factory();
      }
      return reg.instance as T;
    }

    // transient — always create a new instance
    return reg.factory() as T;
  }

  /** Returns true when a registration exists for `name`. */
  has(name: string): boolean {
    return this.registrations.has(name);
  }

  /**
   * Remove the registration for `name`.
   * @returns true if a registration existed and was removed, false otherwise.
   */
  unregister(name: string): boolean {
    return this.registrations.delete(name);
  }

  /** Returns an array of all currently registered names (insertion order). */
  getRegisteredNames(): string[] {
    return [...this.registrations.keys()];
  }

  /** Remove all registrations and cached instances. */
  clear(): void {
    this.registrations.clear();
  }
}

// ============================================================================
// Module-level singleton
// ============================================================================

let globalContainer: DIContainer | undefined;

/** Return the shared global DIContainer instance (created on first call). */
export function getDIContainer(): DIContainer {
  if (!globalContainer) {
    globalContainer = new DIContainer();
  }
  return globalContainer;
}

/** Reset the global container (primarily for testing). */
export function resetDIContainer(): void {
  globalContainer = undefined;
}
