import { describe, it, expect, beforeEach } from 'vitest';
import { FrameworkDetector } from './framework-detector.js';
import type {
  DetectedFramework,
  FrameworkSignature,
  ProjectProfile,
  FrameworkCategory,
} from './framework-detector.js';

describe('FrameworkDetector', () => {
  let detector: FrameworkDetector;

  beforeEach(() => {
    detector = new FrameworkDetector();
  });

  // ── Constructor / signatures ──────────────────────────────────────────

  it('should register at least 12 framework signatures', () => {
    const sigs = detector.getSignatures();
    expect(sigs.length).toBeGreaterThanOrEqual(12);
  });

  it('should include React, Express, Vitest, Docker signatures', () => {
    const names = detector.getSignatures().map((s) => s.name);
    expect(names).toContain('React');
    expect(names).toContain('Express');
    expect(names).toContain('Vitest');
    expect(names).toContain('Docker');
  });

  it('should include Next.js, Vue, Angular, Fastify signatures', () => {
    const names = detector.getSignatures().map((s) => s.name);
    expect(names).toContain('Next.js');
    expect(names).toContain('Vue');
    expect(names).toContain('Angular');
    expect(names).toContain('Fastify');
  });

  it('should include Jest, Tailwind, Prisma, Drizzle signatures', () => {
    const names = detector.getSignatures().map((s) => s.name);
    expect(names).toContain('Jest');
    expect(names).toContain('Tailwind');
    expect(names).toContain('Prisma');
    expect(names).toContain('Drizzle');
  });

  // ── detectFromPackageJson ─────────────────────────────────────────────

  it('should detect React from package.json dependencies', () => {
    const detected = detector.detectFromPackageJson({
      dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
    });
    const reactEntry = detected.find((d) => d.name === 'React');
    expect(reactEntry).toBeDefined();
    expect(reactEntry!.confidence).toBe(1.0);
    expect(reactEntry!.detectedVia).toBe('package.json');
    expect(reactEntry!.version).toBe('^18.0.0');
  });

  it('should detect Express from devDependencies too', () => {
    const detected = detector.detectFromPackageJson({
      devDependencies: { express: '^4.18.0' },
    });
    expect(detected.find((d) => d.name === 'Express')).toBeDefined();
  });

  it('should return empty array when no frameworks detected', () => {
    const detected = detector.detectFromPackageJson({ dependencies: { lodash: '^4.0.0' } });
    expect(detected).toEqual([]);
  });

  it('should detect multiple frameworks from a single package.json', () => {
    const detected = detector.detectFromPackageJson({
      dependencies: { react: '^18', express: '^4' },
      devDependencies: { vitest: '^1.0.0' },
    });
    expect(detected.length).toBeGreaterThanOrEqual(3);
  });

  // ── detectFromConfigFiles ─────────────────────────────────────────────

  it('should detect Next.js from next.config.js', () => {
    const detected = detector.detectFromConfigFiles(['next.config.js']);
    const nextEntry = detected.find((d) => d.name === 'Next.js');
    expect(nextEntry).toBeDefined();
    expect(nextEntry!.confidence).toBe(0.9);
    expect(nextEntry!.detectedVia).toBe('config-file');
  });

  it('should detect Tailwind from tailwind.config.ts', () => {
    const detected = detector.detectFromConfigFiles(['tailwind.config.ts']);
    expect(detected.find((d) => d.name === 'Tailwind')).toBeDefined();
  });

  it('should detect Docker from Dockerfile', () => {
    const detected = detector.detectFromConfigFiles(['Dockerfile']);
    expect(detected.find((d) => d.name === 'Docker')).toBeDefined();
  });

  it('should return empty when no config files match', () => {
    const detected = detector.detectFromConfigFiles(['random.txt']);
    expect(detected).toEqual([]);
  });

  // ── detectFromFileStructure ───────────────────────────────────────────

  it('should detect React from src/App.tsx directory pattern', () => {
    const detected = detector.detectFromFileStructure(['src/App.tsx', 'src/components']);
    const reactEntry = detected.find((d) => d.name === 'React');
    expect(reactEntry).toBeDefined();
    expect(reactEntry!.confidence).toBe(0.7);
    expect(reactEntry!.detectedVia).toBe('file-structure');
  });

  it('should detect Prisma from prisma directory', () => {
    const detected = detector.detectFromFileStructure(['prisma']);
    expect(detected.find((d) => d.name === 'Prisma')).toBeDefined();
  });

  it('should return empty for non-matching directories', () => {
    const detected = detector.detectFromFileStructure(['lib', 'bin']);
    expect(detected).toEqual([]);
  });

  // ── detectPackageManager ──────────────────────────────────────────────

  it('should detect npm from package-lock.json', () => {
    expect(detector.detectPackageManager(['package-lock.json'])).toBe('npm');
  });

  it('should detect yarn from yarn.lock', () => {
    expect(detector.detectPackageManager(['yarn.lock'])).toBe('yarn');
  });

  it('should detect pnpm from pnpm-lock.yaml', () => {
    expect(detector.detectPackageManager(['pnpm-lock.yaml'])).toBe('pnpm');
  });

  it('should detect bun from bun.lockb', () => {
    expect(detector.detectPackageManager(['bun.lockb'])).toBe('bun');
  });

  it('should return unknown when no lock file present', () => {
    expect(detector.detectPackageManager(['README.md'])).toBe('unknown');
  });

  // ── buildProfile ──────────────────────────────────────────────────────

  it('should build a full project profile', () => {
    const profile = detector.buildProfile(
      { dependencies: { react: '^18' }, devDependencies: { typescript: '^5', vitest: '^1' } },
      ['package-lock.json', 'tsconfig.json'],
      ['src/App.tsx'],
    );
    expect(profile.packageManager).toBe('npm');
    expect(profile.hasTypeScript).toBe(true);
    expect(profile.hasTests).toBe(true);
    expect(profile.detectedFrameworks.length).toBeGreaterThan(0);
    expect(new Date(profile.builtAt).toISOString()).toBe(profile.builtAt);
  });

  it('should merge detections preferring highest confidence', () => {
    const profile = detector.buildProfile(
      { dependencies: { react: '^18' } },
      [],
      ['src/App.tsx'],
    );
    const reactEntries = profile.detectedFrameworks.filter((f) => f.name === 'React');
    expect(reactEntries).toHaveLength(1);
    expect(reactEntries[0].confidence).toBe(1.0); // package.json wins
  });

  // ── inferProjectType ──────────────────────────────────────────────────

  it('should infer react-app for React framework', () => {
    const result = detector.inferProjectType([
      { name: 'React', category: 'frontend', confidence: 1.0, detectedVia: 'package.json' },
    ]);
    expect(result).toBe('react-app');
  });

  it('should infer api-server for Express framework', () => {
    const result = detector.inferProjectType([
      { name: 'Express', category: 'backend', confidence: 1.0, detectedVia: 'package.json' },
    ]);
    expect(result).toBe('api-server');
  });

  it('should return null when no frameworks detected', () => {
    const result = detector.inferProjectType([]);
    expect(result).toBeNull();
  });
});
