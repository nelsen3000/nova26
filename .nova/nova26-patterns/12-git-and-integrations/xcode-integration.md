# Xcode Integration

## Source
Extracted from Nova26 `src/integrations/xcode/`

---

## Pattern: Xcode Integration

An integration layer that connects the Nova26 agent system with Xcode projects for iOS and macOS development workflows. The module parses `.xcodeproj` and `.xcworkspace` structures, manages build scheme selection, invokes `xcodebuild` for compilation and testing, and feeds build results back into the Ralph Loop for agent-driven iteration.

The design treats Xcode as an external build system — Nova26 agents generate Swift/Objective-C code, and the Xcode integration validates it through actual compilation and test runs rather than relying solely on static analysis. This closes the feedback loop: agents write code, Xcode builds it, failures route back to the responsible agent for correction.

---

## Implementation

### Code Example

```typescript
import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';

export interface XcodeProject {
  path: string;
  name: string;
  schemes: string[];
  targets: string[];
  sdk: 'iphoneos' | 'iphonesimulator' | 'macosx';
}

export interface XcodeBuildResult {
  success: boolean;
  output: string;
  errors: XcodeBuildError[];
  warnings: string[];
  duration: number;
}

export interface XcodeBuildError {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Discover Xcode projects in the workspace.
 * Scans for .xcodeproj and .xcworkspace bundles.
 */
export function discoverProjects(rootDir: string): XcodeProject[] {
  const projects: XcodeProject[] = [];

  const entries = readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.endsWith('.xcodeproj') || entry.name.endsWith('.xcworkspace')) {
      const projectPath = join(rootDir, entry.name);
      const name = basename(entry.name).replace(/\.(xcodeproj|xcworkspace)$/, '');

      try {
        const schemes = listSchemes(projectPath);
        const targets = listTargets(projectPath);
        projects.push({
          path: projectPath,
          name,
          schemes,
          targets,
          sdk: detectSDK(projectPath),
        });
      } catch {
        // Skip unreadable projects
      }
    }
  }

  return projects;
}

/**
 * List available build schemes for a project.
 */
function listSchemes(projectPath: string): string[] {
  try {
    const flag = projectPath.endsWith('.xcworkspace') ? '-workspace' : '-project';
    const output = execSync(
      `xcodebuild -list ${flag} "${projectPath}" -json`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const data = JSON.parse(output);
    return data.workspace?.schemes || data.project?.schemes || [];
  } catch {
    return [];
  }
}

/**
 * List build targets for a project.
 */
function listTargets(projectPath: string): string[] {
  try {
    const flag = projectPath.endsWith('.xcworkspace') ? '-workspace' : '-project';
    const output = execSync(
      `xcodebuild -list ${flag} "${projectPath}" -json`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const data = JSON.parse(output);
    return data.project?.targets || [];
  } catch {
    return [];
  }
}

/**
 * Detect the appropriate SDK based on project configuration.
 */
function detectSDK(projectPath: string): 'iphoneos' | 'iphonesimulator' | 'macosx' {
  try {
    const flag = projectPath.endsWith('.xcworkspace') ? '-workspace' : '-project';
    const output = execSync(
      `xcodebuild -showBuildSettings ${flag} "${projectPath}" -scheme "${listSchemes(projectPath)[0]}" 2>/dev/null | grep SDKROOT`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    if (output.includes('macosx')) return 'macosx';
    if (output.includes('iphoneos')) return 'iphoneos';
    return 'iphonesimulator';
  } catch {
    return 'iphonesimulator';
  }
}

/**
 * Build an Xcode project with the specified scheme.
 * Parses xcodebuild output to extract structured errors.
 */
export function buildProject(
  project: XcodeProject,
  scheme: string,
  configuration: 'Debug' | 'Release' = 'Debug'
): XcodeBuildResult {
  const start = Date.now();
  const flag = project.path.endsWith('.xcworkspace') ? '-workspace' : '-project';

  try {
    const output = execSync(
      `xcodebuild build ${flag} "${project.path}" -scheme "${scheme}" ` +
      `-configuration ${configuration} -sdk ${project.sdk} ` +
      `-destination "generic/platform=iOS Simulator" 2>&1`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    return {
      success: true,
      output,
      errors: [],
      warnings: parseWarnings(output),
      duration: Date.now() - start,
    };
  } catch (error: any) {
    const output = error.stdout || error.message;
    return {
      success: false,
      output,
      errors: parseBuildErrors(output),
      warnings: parseWarnings(output),
      duration: Date.now() - start,
    };
  }
}

/**
 * Run tests for an Xcode project scheme.
 */
export function runTests(
  project: XcodeProject,
  scheme: string
): XcodeBuildResult {
  const start = Date.now();
  const flag = project.path.endsWith('.xcworkspace') ? '-workspace' : '-project';

  try {
    const output = execSync(
      `xcodebuild test ${flag} "${project.path}" -scheme "${scheme}" ` +
      `-sdk iphonesimulator -destination "platform=iOS Simulator,name=iPhone 15" 2>&1`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    return {
      success: true,
      output,
      errors: [],
      warnings: parseWarnings(output),
      duration: Date.now() - start,
    };
  } catch (error: any) {
    const output = error.stdout || error.message;
    return {
      success: false,
      output,
      errors: parseBuildErrors(output),
      warnings: parseWarnings(output),
      duration: Date.now() - start,
    };
  }
}

/**
 * Parse xcodebuild output for structured error information.
 * Extracts file path, line, column, and message from compiler diagnostics.
 */
function parseBuildErrors(output: string): XcodeBuildError[] {
  const errors: XcodeBuildError[] = [];
  const errorRegex = /^(.+?):(\d+):(\d+):\s*(error|warning):\s*(.+)$/gm;

  let match;
  while ((match = errorRegex.exec(output)) !== null) {
    if (match[4] === 'error') {
      errors.push({
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        message: match[5],
        severity: 'error',
      });
    }
  }

  return errors;
}

/**
 * Parse xcodebuild output for warnings.
 */
function parseWarnings(output: string): string[] {
  const warnings: string[] = [];
  const warnRegex = /^(.+?):(\d+):(\d+):\s*warning:\s*(.+)$/gm;

  let match;
  while ((match = warnRegex.exec(output)) !== null) {
    warnings.push(`${match[1]}:${match[2]}: ${match[4]}`);
  }

  return warnings;
}

/**
 * Format build errors for agent consumption.
 * Produces a concise summary that agents can act on.
 */
export function formatErrorsForAgent(result: XcodeBuildResult): string {
  if (result.success) return 'Build succeeded.';

  const lines = [`Build failed with ${result.errors.length} error(s):\n`];
  for (const err of result.errors.slice(0, 10)) {
    lines.push(`  ${err.file}:${err.line}:${err.column} — ${err.message}`);
  }

  if (result.errors.length > 10) {
    lines.push(`  ... and ${result.errors.length - 10} more errors`);
  }

  return lines.join('\n');
}
```

### Key Concepts

- **Project discovery**: Automatically scans the workspace for `.xcodeproj` and `.xcworkspace` bundles, extracting schemes, targets, and SDK type without manual configuration
- **Structured error parsing**: Raw `xcodebuild` output is parsed into typed `XcodeBuildError` objects with file, line, column, and message — agents receive actionable diagnostics, not raw logs
- **SDK auto-detection**: Inspects build settings to determine whether the project targets iOS, iOS Simulator, or macOS, selecting the correct SDK flag automatically
- **Agent-friendly formatting**: `formatErrorsForAgent` produces concise error summaries capped at 10 errors, preventing prompt overflow when builds fail with hundreds of diagnostics
- **Workspace vs project handling**: Transparently handles both `.xcworkspace` (CocoaPods, SPM) and `.xcodeproj` (standalone) by switching the `-workspace`/`-project` flag

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Dumping raw xcodebuild output into the agent prompt
function buildAndReport(projectPath: string): string {
  try {
    return execSync(`xcodebuild build -project "${projectPath}"`, {
      encoding: 'utf-8',
    });
  } catch (error: any) {
    return error.stdout; // 50KB+ of raw build log — unusable for agents
  }
}
```

### ✅ Do This Instead

```typescript
// Parse build output into structured errors, format for agent consumption
const project = discoverProjects('./')[0];
const result = buildProject(project, project.schemes[0]);

if (!result.success) {
  const summary = formatErrorsForAgent(result);
  // "Build failed with 3 error(s):
  //   ViewController.swift:42:10 — Use of unresolved identifier 'foo'
  //   ..."
  await agent.fixErrors(summary, result.errors);
}
```

---

## When to Use This Pattern

✅ **Use for:**
- iOS/macOS projects where Nova26 agents generate or modify Swift code and need compilation feedback
- Automated build-test-fix loops where Xcode build errors feed back into the MARS agent for correction
- CI-like validation of agent-generated code in Xcode projects before creating PRs

❌ **Don't use for:**
- Non-Apple platforms — use the standard TypeScript gate or Docker executor instead
- Projects using only Swift Package Manager without an Xcode project (use `swift build` directly)

---

## Benefits

1. **Closed feedback loop** — agents generate Swift code, Xcode compiles it, structured errors route back to the agent for correction, enabling iterative fix cycles without human intervention
2. **Structured diagnostics** — parsed `XcodeBuildError` objects give agents precise file/line/column information instead of raw build logs, improving fix accuracy
3. **Auto-discovery** — no manual project configuration required; the module finds and introspects Xcode projects automatically
4. **Multi-target support** — handles iOS, iOS Simulator, and macOS SDKs, plus both workspace and standalone project formats

---

## Related Patterns

- See `./git-workflow.md` for the branch/commit/PR lifecycle that wraps Xcode build outputs
- See `../03-quality-gates/typescript-gate.md` for the analogous TypeScript compilation gate (same pattern, different compiler)
- See `../05-execution/docker-executor.md` for sandboxed execution of non-Xcode builds
- See `../01-orchestration/gate-runner-pipeline.md` for the gate runner that orchestrates build validation steps including Xcode builds

---

*Extracted: 2026-02-19*
