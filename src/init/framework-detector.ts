import type { ProjectType } from './template-system.js';

// ── Types ──────────────────────────────────────────────────────────────────

export type FrameworkCategory =
  | 'frontend'
  | 'backend'
  | 'testing'
  | 'styling'
  | 'orm'
  | 'devops';

export interface DetectedFramework {
  name: string;
  category: FrameworkCategory;
  confidence: number;
  version?: string;
  detectedVia: 'package.json' | 'config-file' | 'file-structure';
}

export interface FrameworkSignature {
  name: string;
  category: FrameworkCategory;
  packageNames: string[];
  configFiles: string[];
  directoryPatterns: string[];
}

export interface ProjectProfile {
  detectedFrameworks: DetectedFramework[];
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';
  inferredProjectType: ProjectType | null;
  hasTypeScript: boolean;
  hasTests: boolean;
  builtAt: string;
}

// ── Framework Detector ─────────────────────────────────────────────────────

export class FrameworkDetector {
  private signatures: FrameworkSignature[] = [];

  constructor() {
    this.registerBuiltInSignatures();
  }

  private registerBuiltInSignatures(): void {
    this.signatures = [
      {
        name: 'React',
        category: 'frontend',
        packageNames: ['react', 'react-dom'],
        configFiles: [],
        directoryPatterns: ['src/components', 'src/App.tsx', 'src/App.jsx'],
      },
      {
        name: 'Next.js',
        category: 'frontend',
        packageNames: ['next'],
        configFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
        directoryPatterns: ['pages', 'app'],
      },
      {
        name: 'Vue',
        category: 'frontend',
        packageNames: ['vue'],
        configFiles: ['vue.config.js', 'vite.config.ts'],
        directoryPatterns: ['src/components', 'src/App.vue'],
      },
      {
        name: 'Angular',
        category: 'frontend',
        packageNames: ['@angular/core', '@angular/cli'],
        configFiles: ['angular.json'],
        directoryPatterns: ['src/app'],
      },
      {
        name: 'Express',
        category: 'backend',
        packageNames: ['express'],
        configFiles: [],
        directoryPatterns: ['src/routes', 'src/middleware'],
      },
      {
        name: 'Fastify',
        category: 'backend',
        packageNames: ['fastify'],
        configFiles: [],
        directoryPatterns: ['src/routes', 'src/plugins'],
      },
      {
        name: 'Vitest',
        category: 'testing',
        packageNames: ['vitest'],
        configFiles: ['vitest.config.ts', 'vitest.config.js'],
        directoryPatterns: ['__tests__', 'tests'],
      },
      {
        name: 'Jest',
        category: 'testing',
        packageNames: ['jest'],
        configFiles: ['jest.config.js', 'jest.config.ts', 'jest.config.mjs'],
        directoryPatterns: ['__tests__', 'tests'],
      },
      {
        name: 'Tailwind',
        category: 'styling',
        packageNames: ['tailwindcss'],
        configFiles: ['tailwind.config.js', 'tailwind.config.ts'],
        directoryPatterns: [],
      },
      {
        name: 'Prisma',
        category: 'orm',
        packageNames: ['prisma', '@prisma/client'],
        configFiles: ['prisma/schema.prisma'],
        directoryPatterns: ['prisma'],
      },
      {
        name: 'Drizzle',
        category: 'orm',
        packageNames: ['drizzle-orm', 'drizzle-kit'],
        configFiles: ['drizzle.config.ts', 'drizzle.config.js'],
        directoryPatterns: ['drizzle'],
      },
      {
        name: 'Docker',
        category: 'devops',
        packageNames: [],
        configFiles: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'],
        directoryPatterns: ['.docker'],
      },
    ];
  }

  getSignatures(): FrameworkSignature[] {
    return [...this.signatures];
  }

  detectFromPackageJson(packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }): DetectedFramework[] {
    const allDeps: Record<string, string> = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    };
    const detected: DetectedFramework[] = [];

    for (const sig of this.signatures) {
      for (const pkgName of sig.packageNames) {
        if (pkgName in allDeps) {
          detected.push({
            name: sig.name,
            category: sig.category,
            confidence: 1.0,
            version: allDeps[pkgName],
            detectedVia: 'package.json',
          });
          break;
        }
      }
    }

    return detected;
  }

  detectFromConfigFiles(fileList: string[]): DetectedFramework[] {
    const detected: DetectedFramework[] = [];

    for (const sig of this.signatures) {
      for (const configFile of sig.configFiles) {
        if (fileList.includes(configFile)) {
          detected.push({
            name: sig.name,
            category: sig.category,
            confidence: 0.9,
            detectedVia: 'config-file',
          });
          break;
        }
      }
    }

    return detected;
  }

  detectFromFileStructure(directoryList: string[]): DetectedFramework[] {
    const detected: DetectedFramework[] = [];

    for (const sig of this.signatures) {
      for (const dirPattern of sig.directoryPatterns) {
        if (directoryList.includes(dirPattern)) {
          detected.push({
            name: sig.name,
            category: sig.category,
            confidence: 0.7,
            detectedVia: 'file-structure',
          });
          break;
        }
      }
    }

    return detected;
  }

  detectPackageManager(fileList: string[]): 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown' {
    if (fileList.includes('bun.lockb') || fileList.includes('bun.lock')) {
      return 'bun';
    }
    if (fileList.includes('pnpm-lock.yaml')) {
      return 'pnpm';
    }
    if (fileList.includes('yarn.lock')) {
      return 'yarn';
    }
    if (fileList.includes('package-lock.json')) {
      return 'npm';
    }
    return 'unknown';
  }

  buildProfile(
    packageJson: {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    },
    fileList: string[],
    directoryList: string[],
  ): ProjectProfile {
    const fromPkg = this.detectFromPackageJson(packageJson);
    const fromConfig = this.detectFromConfigFiles(fileList);
    const fromDirs = this.detectFromFileStructure(directoryList);

    // Merge detections by name, preferring highest confidence
    const merged = new Map<string, DetectedFramework>();
    for (const d of [...fromDirs, ...fromConfig, ...fromPkg]) {
      const existing = merged.get(d.name);
      if (!existing || d.confidence > existing.confidence) {
        merged.set(d.name, d);
      }
    }

    const detectedFrameworks = Array.from(merged.values());
    const allDeps = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    };
    const hasTypeScript = 'typescript' in allDeps || fileList.includes('tsconfig.json');
    const testFrameworks = detectedFrameworks.filter((d) => d.category === 'testing');
    const hasTests = testFrameworks.length > 0;
    const packageManager = this.detectPackageManager(fileList);

    return {
      detectedFrameworks,
      packageManager,
      inferredProjectType: this.inferProjectType(detectedFrameworks),
      hasTypeScript,
      hasTests,
      builtAt: new Date().toISOString(),
    };
  }

  inferProjectType(frameworks: DetectedFramework[]): ProjectType | null {
    const names = new Set(frameworks.map((f) => f.name));
    const categories = new Set(frameworks.map((f) => f.category));

    if (names.has('React') || names.has('Next.js') || names.has('Vue') || names.has('Angular')) {
      return 'react-app';
    }
    if (names.has('Express') || names.has('Fastify')) {
      return 'api-server';
    }
    if (categories.has('backend')) {
      return 'api-server';
    }
    if (categories.has('frontend')) {
      return 'react-app';
    }

    return null;
  }
}
