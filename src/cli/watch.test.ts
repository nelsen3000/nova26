// Unit tests for watch.ts — Watch Mode for NOVA26
// MEGA-06: Watch Mode tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs before importing watch module
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWatch = vi.fn();

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  watch: mockWatch,
}));

vi.mock('../orchestrator/ralph-loop.js', () => ({
  ralphLoop: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocking
const {
  mapFileToAgent,
  shouldIgnoreFile,
  debounce,
  findTaskForAgent,
  formatStatusLine,
  loadPRD,
} = await import('./watch.js');
import type { PRD, Task, WatchSession } from './watch.js';

// --- Test Helpers ---

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    id: overrides.id,
    title: `Task ${overrides.id}`,
    description: `Description for ${overrides.id}`,
    agent: overrides.agent ?? 'MARS',
    status: (overrides.status as Task['status']) ?? 'pending',
    dependencies: overrides.dependencies ?? [],
    phase: overrides.phase ?? 1,
    attempts: overrides.attempts ?? 0,
    createdAt: new Date().toISOString(),
  };
}

function makePRD(tasks: Task[]): PRD {
  return {
    meta: { name: 'test', version: '1.0', createdAt: new Date().toISOString() },
    tasks,
  };
}

function makeWatchSession(overrides: Partial<WatchSession> = {}): WatchSession {
  return {
    prdPath: './test.json',
    srcDir: './src',
    watchedFiles: new Set(),
    lastChange: null,
    tasksCompleted: 0,
    tasksPending: 0,
    stop: vi.fn(),
    ...overrides,
  };
}

// --- Tests for mapFileToAgent ---

describe('mapFileToAgent', () => {
  it('maps test files to SATURN', () => {
    expect(mapFileToAgent('src/utils/helper.test.ts')).toBe('SATURN');
    expect(mapFileToAgent('src/components/Button.test.tsx')).toBe('SATURN');
    expect(mapFileToAgent('/project/src/lib/parser.test.ts')).toBe('SATURN');
  });

  it('maps convex/schema.ts to PLUTO', () => {
    expect(mapFileToAgent('convex/schema.ts')).toBe('PLUTO');
    expect(mapFileToAgent('/project/convex/schema.ts')).toBe('PLUTO');
    expect(mapFileToAgent('src/convex/schema.ts')).toBe('PLUTO');
  });

  it('maps other convex files to MARS', () => {
    expect(mapFileToAgent('convex/users.ts')).toBe('MARS');
    expect(mapFileToAgent('convex/api/mutations.ts')).toBe('MARS');
    expect(mapFileToAgent('/project/convex/queries.ts')).toBe('MARS');
  });

  it('maps components to VENUS', () => {
    expect(mapFileToAgent('src/components/Button.tsx')).toBe('VENUS');
    expect(mapFileToAgent('src/components/Header/index.tsx')).toBe('VENUS');
    expect(mapFileToAgent('/project/src/components/Card.tsx')).toBe('VENUS');
  });

  it('maps app routes to VENUS', () => {
    expect(mapFileToAgent('src/app/page.tsx')).toBe('VENUS');
    expect(mapFileToAgent('src/app/layout.tsx')).toBe('VENUS');
    expect(mapFileToAgent('src/app/users/[id]/page.tsx')).toBe('VENUS');
  });

  it('maps hooks to VENUS', () => {
    expect(mapFileToAgent('src/hooks/useAuth.ts')).toBe('VENUS');
    expect(mapFileToAgent('src/hooks/useApi.ts')).toBe('VENUS');
    expect(mapFileToAgent('/project/src/hooks/useForm.ts')).toBe('VENUS');
  });

  it('maps lib files to MARS', () => {
    expect(mapFileToAgent('src/lib/utils.ts')).toBe('MARS');
    expect(mapFileToAgent('src/lib/api/client.ts')).toBe('MARS');
    expect(mapFileToAgent('/project/src/lib/helpers.ts')).toBe('MARS');
  });

  it('maps security files to ENCELADUS', () => {
    expect(mapFileToAgent('src/security/validator.ts')).toBe('ENCELADUS');
    expect(mapFileToAgent('src/security/auth.ts')).toBe('ENCELADUS');
    expect(mapFileToAgent('/project/src/security/permissions.ts')).toBe('ENCELADUS');
  });

  it('maps integration files to GANYMEDE', () => {
    expect(mapFileToAgent('src/integrations/github.ts')).toBe('GANYMEDE');
    expect(mapFileToAgent('src/integrations/stripe/api.ts')).toBe('GANYMEDE');
    expect(mapFileToAgent('/project/src/integrations/aws.ts')).toBe('GANYMEDE');
  });

  it('maps markdown files to CALLISTO', () => {
    expect(mapFileToAgent('README.md')).toBe('CALLISTO');
    expect(mapFileToAgent('docs/guide.md')).toBe('CALLISTO');
    expect(mapFileToAgent('/project/src/docs/api.md')).toBe('CALLISTO');
  });

  it('maps generic ts/tsx files to MARS (default)', () => {
    expect(mapFileToAgent('src/utils/helper.ts')).toBe('MARS');
    expect(mapFileToAgent('src/types/index.ts')).toBe('MARS');
    expect(mapFileToAgent('/project/src/config/settings.ts')).toBe('MARS');
  });

  it('returns null for ignored files', () => {
    expect(mapFileToAgent('node_modules/lodash/index.js')).toBeNull();
    expect(mapFileToAgent('.git/config')).toBeNull();
    expect(mapFileToAgent('dist/bundle.js')).toBeNull();
  });

  it('returns null for non-typescript files', () => {
    expect(mapFileToAgent('styles.css')).toBeNull();
    expect(mapFileToAgent('image.png')).toBeNull();
    expect(mapFileToAgent('config.json')).toBeNull();
    expect(mapFileToAgent('script.js')).toBeNull();
  });
});

// --- Tests for shouldIgnoreFile ---

describe('shouldIgnoreFile', () => {
  it('ignores dotfiles', () => {
    expect(shouldIgnoreFile('.gitignore')).toBe(true);
    expect(shouldIgnoreFile('.env')).toBe(true);
    expect(shouldIgnoreFile('.eslintrc')).toBe(true);
    expect(shouldIgnoreFile('src/.hidden.ts')).toBe(true);
  });

  it('ignores dot directories', () => {
    expect(shouldIgnoreFile('.git/config')).toBe(true);
    expect(shouldIgnoreFile('.github/workflows/ci.yml')).toBe(true);
    expect(shouldIgnoreFile('src/.internal/utils.ts')).toBe(true);
  });

  it('ignores node_modules', () => {
    expect(shouldIgnoreFile('node_modules/lodash/index.js')).toBe(true);
    expect(shouldIgnoreFile('node_modules/react/package.json')).toBe(true);
    expect(shouldIgnoreFile('/project/node_modules/.bin/tsc')).toBe(true);
  });

  it('ignores .nova directory', () => {
    expect(shouldIgnoreFile('.nova/output/result.md')).toBe(true);
    expect(shouldIgnoreFile('.nova/prd.json')).toBe(true);
    expect(shouldIgnoreFile('/project/.nova/agents/config.json')).toBe(true);
  });

  it('ignores dist directory', () => {
    expect(shouldIgnoreFile('dist/index.js')).toBe(true);
    expect(shouldIgnoreFile('dist/assets/main.css')).toBe(true);
    expect(shouldIgnoreFile('/project/dist/bundle.js')).toBe(true);
  });

  it('ignores build directory', () => {
    expect(shouldIgnoreFile('build/index.html')).toBe(true);
    expect(shouldIgnoreFile('build/static/js/main.js')).toBe(true);
  });

  it('ignores css and style files', () => {
    expect(shouldIgnoreFile('styles.css')).toBe(true);
    expect(shouldIgnoreFile('app.scss')).toBe(true);
    expect(shouldIgnoreFile('main.sass')).toBe(true);
    expect(shouldIgnoreFile('theme.less')).toBe(true);
  });

  it('ignores json and config files', () => {
    expect(shouldIgnoreFile('package.json')).toBe(true);
    expect(shouldIgnoreFile('tsconfig.json')).toBe(true);
    expect(shouldIgnoreFile('package-lock.json')).toBe(true);
  });

  it('ignores log and temp files', () => {
    expect(shouldIgnoreFile('app.log')).toBe(true);
    expect(shouldIgnoreFile('debug.tmp')).toBe(true);
    expect(shouldIgnoreFile('temp.tmp')).toBe(true);
    expect(shouldIgnoreFile('cache.temp')).toBe(true);
  });

  it('ignores image and asset files', () => {
    expect(shouldIgnoreFile('logo.png')).toBe(true);
    expect(shouldIgnoreFile('icon.jpg')).toBe(true);
    expect(shouldIgnoreFile('banner.gif')).toBe(true);
    expect(shouldIgnoreFile('sprite.svg')).toBe(true);
    expect(shouldIgnoreFile('font.woff2')).toBe(true);
  });

  it('does not ignore typescript source files', () => {
    expect(shouldIgnoreFile('src/index.ts')).toBe(false);
    expect(shouldIgnoreFile('components/App.tsx')).toBe(false);
    expect(shouldIgnoreFile('lib/utils.ts')).toBe(false);
  });

  it('does not ignore markdown files', () => {
    expect(shouldIgnoreFile('README.md')).toBe(false);
    expect(shouldIgnoreFile('docs/guide.md')).toBe(false);
  });
});

// --- Tests for debounce ---

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays function execution', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 500);

    debouncedFn('arg1');
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledWith('arg1');
  });

  it('resets timer on consecutive calls', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 500);

    debouncedFn('first');
    vi.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();

    debouncedFn('second');
    vi.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledWith('second');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('preserves multiple arguments', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn('arg1', 'arg2', 123);
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 123);
  });

  it('handles multiple independent debounced functions', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const debounced1 = debounce(fn1, 100);
    const debounced2 = debounce(fn2, 200);

    debounced1('a');
    debounced2('b');

    vi.advanceTimersByTime(100);
    expect(fn1).toHaveBeenCalledWith('a');
    expect(fn2).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn2).toHaveBeenCalledWith('b');
  });

  it('allows execution after timer completes', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn('first');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);

    debouncedFn('second');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// --- Tests for findTaskForAgent ---

describe('findTaskForAgent', () => {
  it('finds ready task for agent', () => {
    const tasks = [
      makeTask({ id: 'T1', agent: 'MARS', status: 'ready' }),
      makeTask({ id: 'T2', agent: 'VENUS', status: 'pending' }),
    ];
    const prd = makePRD(tasks);

    const result = findTaskForAgent(prd, 'MARS');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('T1');
  });

  it('prefers ready tasks over pending', () => {
    const tasks = [
      makeTask({ id: 'T1', agent: 'MARS', status: 'pending' }),
      makeTask({ id: 'T2', agent: 'MARS', status: 'ready' }),
    ];
    const prd = makePRD(tasks);

    const result = findTaskForAgent(prd, 'MARS');
    expect(result!.id).toBe('T2');
  });

  it('falls back to pending task when no ready task', () => {
    const tasks = [
      makeTask({ id: 'T1', agent: 'MARS', status: 'pending' }),
      makeTask({ id: 'T2', agent: 'MARS', status: 'done' }),
    ];
    const prd = makePRD(tasks);

    const result = findTaskForAgent(prd, 'MARS');
    expect(result!.id).toBe('T1');
  });

  it('returns null when all tasks for agent are done', () => {
    const tasks = [
      makeTask({ id: 'T1', agent: 'MARS', status: 'done' }),
      makeTask({ id: 'T2', agent: 'MARS', status: 'done' }),
    ];
    const prd = makePRD(tasks);

    const result = findTaskForAgent(prd, 'MARS');
    expect(result).toBeNull();
  });

  it('returns null when agent has no tasks', () => {
    const tasks = [
      makeTask({ id: 'T1', agent: 'VENUS', status: 'ready' }),
      makeTask({ id: 'T2', agent: 'PLUTO', status: 'pending' }),
    ];
    const prd = makePRD(tasks);

    const result = findTaskForAgent(prd, 'MARS');
    expect(result).toBeNull();
  });

  it('returns null for empty PRD', () => {
    const prd = makePRD([]);
    const result = findTaskForAgent(prd, 'MARS');
    expect(result).toBeNull();
  });

  it('handles failed tasks', () => {
    const tasks = [
      makeTask({ id: 'T1', agent: 'MARS', status: 'failed' }),
    ];
    const prd = makePRD(tasks);

    const result = findTaskForAgent(prd, 'MARS');
    expect(result!.id).toBe('T1');
  });

  it('handles blocked tasks', () => {
    const tasks = [
      makeTask({ id: 'T1', agent: 'MARS', status: 'blocked' }),
    ];
    const prd = makePRD(tasks);

    const result = findTaskForAgent(prd, 'MARS');
    expect(result!.id).toBe('T1');
  });
});

// --- Tests for formatStatusLine ---

describe('formatStatusLine', () => {
  it('formats initial state correctly', () => {
    const session = makeWatchSession({
      tasksCompleted: 0,
      tasksPending: 0,
      lastChange: null,
    });

    const result = formatStatusLine(session);
    expect(result).toBe('[WATCHING] 0 tasks done | 0 pending | Waiting for changes...');
  });

  it('formats with completed tasks', () => {
    const session = makeWatchSession({
      tasksCompleted: 5,
      tasksPending: 0,
      lastChange: new Date('2024-01-01'),
      watchedFiles: new Set(['/project/src/app.ts']),
    });

    const result = formatStatusLine(session);
    expect(result).toContain('[WATCHING] 5 tasks done | 0 pending');
    expect(result).toContain('Last change:');
  });

  it('formats with pending tasks', () => {
    const session = makeWatchSession({
      tasksCompleted: 3,
      tasksPending: 2,
      lastChange: new Date('2024-01-01'),
      watchedFiles: new Set(['/project/src/utils.ts']),
    });

    const result = formatStatusLine(session);
    expect(result).toContain('[WATCHING] 3 tasks done | 2 pending');
  });

  it('includes last changed file in output', () => {
    const session = makeWatchSession({
      tasksCompleted: 1,
      tasksPending: 0,
      lastChange: new Date('2024-01-01'),
      watchedFiles: new Set(['/project/src/components/Button.tsx']),
    });

    const result = formatStatusLine(session);
    expect(result).toContain('Last change:');
    expect(result).toContain('src/components/Button.tsx');
  });
});

// --- Tests for loadPRD ---

describe('loadPRD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and parses valid PRD file', () => {
    const mockPRD: PRD = {
      meta: { name: 'Test', version: '1.0', createdAt: '2024-01-01' },
      tasks: [],
    };

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(mockPRD));

    const result = loadPRD('test.json');
    expect(result).toEqual(mockPRD);
    expect(mockExistsSync).toHaveBeenCalledWith(expect.stringContaining('test.json'));
  });

  it('returns null when file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = loadPRD('nonexistent.json');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));

    consoleSpy.mockRestore();
  });

  it('returns null when JSON is invalid', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('invalid json {');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = loadPRD('invalid.json');

    expect(result).toBeNull();

    consoleSpy.mockRestore();
  });

  it('returns null when read fails', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => {
      throw new Error('Permission denied');
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = loadPRD('unreadable.json');

    expect(result).toBeNull();

    consoleSpy.mockRestore();
  });
});

// --- Additional edge case tests ---

describe('mapFileToAgent edge cases', () => {
  it('handles Windows-style paths', () => {
    expect(mapFileToAgent('src\\components\\Button.tsx')).toBe('VENUS');
    expect(mapFileToAgent('convex\\schema.ts')).toBe('PLUTO');
    expect(mapFileToAgent('src\\lib\\utils.ts')).toBe('MARS');
  });

  it('handles nested test files', () => {
    expect(mapFileToAgent('src/components/Button/Button.test.tsx')).toBe('SATURN');
    expect(mapFileToAgent('src/lib/utils/helper.test.ts')).toBe('SATURN');
  });

  it('distinguishes between convex/schema.ts and other convex files', () => {
    expect(mapFileToAgent('convex/schema.ts')).toBe('PLUTO');
    expect(mapFileToAgent('convex/_generated/schema.ts')).toBe('PLUTO');
    expect(mapFileToAgent('convex/mutations.ts')).toBe('MARS');
  });

  it('handles paths with multiple dots', () => {
    expect(mapFileToAgent('src/utils/string.utils.test.ts')).toBe('SATURN');
    expect(mapFileToAgent('docs/api.reference.md')).toBe('CALLISTO');
  });
});
