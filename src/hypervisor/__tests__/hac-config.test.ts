// HAC Config Parser Tests — Spec Tasks 2.1, 2.2, 2.3, 2.4
// Sprint S3-10 | Hypervisor Hypercore Integration (Reel 2)

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { HACConfigParser } from '../hac-config.js';
import type { VMSpec, HypervisorProvider } from '../types.js';

const parser = new HACConfigParser();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function minimalSpec(overrides: Partial<VMSpec> = {}): VMSpec {
  return {
    name: 'test-vm',
    provider: 'docker',
    image: 'ubuntu:22.04',
    isolationLevel: 'process',
    resources: { cpuMillicores: 500, memoryMb: 256, diskMb: 1024, networkKbps: 1024, maxProcesses: 32 },
    drives: [],
    networkEnabled: false,
    metadata: {},
    bootTimeoutMs: 30_000,
    ...overrides,
  };
}

const MINIMAL_TOML = `
name = "test-vm"
provider = "docker"
image = "ubuntu:22.04"
isolation_level = "process"
network_enabled = false
boot_timeout_ms = 30000

[resources]
cpu_millicores = 500
memory_mb = 256
disk_mb = 1024
network_kbps = 1024
max_processes = 32
`.trimStart();

// ─── parse() ─────────────────────────────────────────────────────────────────

describe('HACConfigParser.parse()', () => {
  it('parses a minimal hac.toml into VMSpec', () => {
    const spec = parser.parse(MINIMAL_TOML);
    expect(spec.name).toBe('test-vm');
    expect(spec.provider).toBe('docker');
    expect(spec.image).toBe('ubuntu:22.04');
    expect(spec.resources.cpuMillicores).toBe(500);
    expect(spec.resources.memoryMb).toBe(256);
  });

  it('parses kernel_image field', () => {
    const toml = `
name = "test-vm"
provider = "firecracker"
image = "/images/ubuntu.ext4"
kernel_image = "/boot/vmlinux"
isolation_level = "vm"
network_enabled = false
boot_timeout_ms = 10000

[resources]
cpu_millicores = 500
memory_mb = 256
disk_mb = 1024
network_kbps = 1024
max_processes = 32
`.trimStart();
    const spec = parser.parse(toml);
    expect(spec.kernelImage).toBe('/boot/vmlinux');
  });

  it('parses drives array-of-tables', () => {
    const toml = MINIMAL_TOML + `
[[drives]]
drive_id = "root"
path_on_host = "/images/root.ext4"
is_root_device = true
is_read_only = false
`;
    const spec = parser.parse(toml);
    expect(spec.drives).toHaveLength(1);
    expect(spec.drives[0].driveId).toBe('root');
    expect(spec.drives[0].isRootDevice).toBe(true);
  });

  it('parses metadata section', () => {
    const toml = MINIMAL_TOML + `
[metadata]
env = "production"
region = "us-east-1"
`;
    const spec = parser.parse(toml);
    expect(spec.metadata['env']).toBe('production');
    expect(spec.metadata['region']).toBe('us-east-1');
  });

  it('throws on empty input', () => {
    expect(() => parser.parse('')).toThrow(/empty input/);
  });

  it('throws on missing required field "name"', () => {
    const toml = `
image = "ubuntu:22.04"
provider = "docker"

[resources]
cpu_millicores = 500
memory_mb = 256
disk_mb = 1024
network_kbps = 1024
max_processes = 32
`;
    expect(() => parser.parse(toml)).toThrow();
  });

  it('strips TOML comments', () => {
    const toml = `# This is a comment
name = "test-vm" # inline comment
provider = "docker"
image = "ubuntu:22.04"

[resources]
cpu_millicores = 500
memory_mb = 256
disk_mb = 1024
network_kbps = 1024
max_processes = 32
`;
    const spec = parser.parse(toml);
    expect(spec.name).toBe('test-vm');
  });
});

// ─── format() ────────────────────────────────────────────────────────────────

describe('HACConfigParser.format()', () => {
  it('formats VMSpec as TOML string', () => {
    const spec = minimalSpec();
    const toml = parser.format(spec);
    expect(toml).toContain('name = "test-vm"');
    expect(toml).toContain('provider = "docker"');
    expect(toml).toContain('image = "ubuntu:22.04"');
    expect(toml).toContain('[resources]');
    expect(toml).toContain('cpu_millicores = 500');
  });

  it('formats kernel_image when present', () => {
    const spec = minimalSpec({ kernelImage: '/boot/vmlinux' });
    const toml = parser.format(spec);
    expect(toml).toContain('kernel_image = "/boot/vmlinux"');
  });

  it('formats drives as [[drives]] sections', () => {
    const spec = minimalSpec({
      drives: [{ driveId: 'root', pathOnHost: '/img/root.ext4', isRootDevice: true, isReadOnly: false }],
    });
    const toml = parser.format(spec);
    expect(toml).toContain('[[drives]]');
    expect(toml).toContain('drive_id = "root"');
    expect(toml).toContain('is_root_device = true');
  });

  it('formats metadata as [metadata] section', () => {
    const spec = minimalSpec({ metadata: { env: 'prod' } });
    const toml = parser.format(spec);
    expect(toml).toContain('[metadata]');
    expect(toml).toContain('env = "prod"');
  });

  it('omits kernel_image when undefined', () => {
    const spec = minimalSpec();
    const toml = parser.format(spec);
    expect(toml).not.toContain('kernel_image');
  });
});

// ─── validate() ──────────────────────────────────────────────────────────────

describe('HACConfigParser.validate()', () => {
  const capacity = { cpuMillicores: 4000, memoryMb: 4096, diskMb: 20480, networkKbps: 10240 };

  it('valid spec returns { valid: true, errors: [] }', () => {
    const result = parser.validate(minimalSpec(), capacity);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('CPU over capacity → error', () => {
    const spec = minimalSpec({ resources: { cpuMillicores: 8000, memoryMb: 256, diskMb: 1024, networkKbps: 1024, maxProcesses: 32 } });
    const result = parser.validate(spec, capacity);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('cpuMillicores'))).toBe(true);
  });

  it('memory over capacity → error', () => {
    const spec = minimalSpec({ resources: { cpuMillicores: 500, memoryMb: 8192, diskMb: 1024, networkKbps: 1024, maxProcesses: 32 } });
    const result = parser.validate(spec, capacity);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('memoryMb'))).toBe(true);
  });

  it('disk over capacity → error', () => {
    const spec = minimalSpec({ resources: { cpuMillicores: 500, memoryMb: 256, diskMb: 50000, networkKbps: 1024, maxProcesses: 32 } });
    const result = parser.validate(spec, capacity);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('diskMb'))).toBe(true);
  });

  it('firecracker without kernelImage → warning', () => {
    const spec = minimalSpec({ provider: 'firecracker', kernelImage: undefined });
    const result = parser.validate(spec, capacity);
    expect(result.warnings.some(w => w.includes('kernelImage'))).toBe(true);
  });

  it('high CPU usage → warning (not error)', () => {
    const spec = minimalSpec({ resources: { cpuMillicores: 3500, memoryMb: 256, diskMb: 1024, networkKbps: 1024, maxProcesses: 32 } });
    const result = parser.validate(spec, capacity);
    expect(result.valid).toBe(true); // not exceeded, just high
    expect(result.warnings.some(w => w.includes('CPU'))).toBe(true);
  });
});

// ─── getDefaultTemplate() ────────────────────────────────────────────────────

describe('HACConfigParser.getDefaultTemplate()', () => {
  const providers: HypervisorProvider[] = ['firecracker', 'qemu', 'docker'];

  for (const provider of providers) {
    it(`returns valid VMSpec for ${provider}`, () => {
      const spec = parser.getDefaultTemplate(provider);
      expect(spec.provider).toBe(provider);
      expect(typeof spec.name).toBe('string');
      expect(typeof spec.image).toBe('string');
      expect(spec.resources.cpuMillicores).toBeGreaterThan(0);
    });
  }
});

// ─── Property 1: parse → format → parse round-trip ──────────────────────────

describe('Property 1: hac.toml round-trip consistency', () => {
  it('parse(format(spec)) produces equivalent spec', () => {
    fc.assert(fc.property(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 30 }).map(s => s.replace(/[^a-zA-Z0-9-_]/g, 'x') || 'vm'),
        provider: fc.constantFrom('firecracker', 'qemu', 'docker') as fc.Arbitrary<HypervisorProvider>,
        image: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/"/g, '-')),
        isolationLevel: fc.constantFrom('none', 'process', 'namespace', 'vm', 'ultra') as fc.Arbitrary<VMSpec['isolationLevel']>,
        networkEnabled: fc.boolean(),
        bootTimeoutMs: fc.integer({ min: 1000, max: 120_000 }),
        resources: fc.record({
          cpuMillicores: fc.integer({ min: 100, max: 4000 }),
          memoryMb: fc.integer({ min: 64, max: 4096 }),
          diskMb: fc.integer({ min: 512, max: 20480 }),
          networkKbps: fc.integer({ min: 128, max: 10240 }),
          maxProcesses: fc.integer({ min: 4, max: 256 }),
        }),
      }),
      (fields) => {
        const spec: VMSpec = { ...fields, drives: [], metadata: {} };
        const toml = parser.format(spec);
        const reparsed = parser.parse(toml);

        expect(reparsed.name).toBe(spec.name);
        expect(reparsed.provider).toBe(spec.provider);
        expect(reparsed.image).toBe(spec.image);
        expect(reparsed.networkEnabled).toBe(spec.networkEnabled);
        expect(reparsed.resources.cpuMillicores).toBe(spec.resources.cpuMillicores);
        expect(reparsed.resources.memoryMb).toBe(spec.resources.memoryMb);
        expect(reparsed.resources.diskMb).toBe(spec.resources.diskMb);
      },
    ), { numRuns: 50 });
  });
});

// ─── Property 2: Invalid config produces descriptive errors ──────────────────

describe('Property 2: Invalid config produces descriptive errors', () => {
  it('resources exceeding capacity always produce errors', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 500 }),    // host CPU
      fc.integer({ min: 501, max: 4000 }), // spec CPU (always exceeds host)
      (hostCpu, specCpu) => {
        const spec = minimalSpec({ resources: { cpuMillicores: specCpu, memoryMb: 256, diskMb: 1024, networkKbps: 1024, maxProcesses: 32 } });
        const capacity = { cpuMillicores: hostCpu, memoryMb: 16384, diskMb: 100000, networkKbps: 100000 };
        const result = parser.validate(spec, capacity);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        // Errors must be descriptive strings
        expect(result.errors.every(e => typeof e === 'string' && e.length > 5)).toBe(true);
      },
    ), { numRuns: 50 });
  });
});

// ─── Property 3: Resource validation against host capacity ───────────────────

describe('Property 3: Resource validation against host capacity', () => {
  it('specs within capacity are always valid (no resource errors)', () => {
    fc.assert(fc.property(
      fc.integer({ min: 100, max: 1000 }),  // cpu
      fc.integer({ min: 64, max: 512 }),    // memory
      fc.integer({ min: 512, max: 2048 }),  // disk
      (cpu, memory, disk) => {
        const spec = minimalSpec({ resources: { cpuMillicores: cpu, memoryMb: memory, diskMb: disk, networkKbps: 512, maxProcesses: 32 } });
        const capacity = { cpuMillicores: cpu + 500, memoryMb: memory + 256, diskMb: disk + 1024, networkKbps: 10000 };
        const result = parser.validate(spec, capacity);
        const resourceErrors = result.errors.filter(e =>
          e.includes('cpuMillicores') || e.includes('memoryMb') || e.includes('diskMb') || e.includes('networkKbps'),
        );
        expect(resourceErrors).toHaveLength(0);
      },
    ), { numRuns: 50 });
  });
});
