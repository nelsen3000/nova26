// Hypervisor HAC Config Parser — Spec Task 2 (hac.toml)
// Sprint S3-10 | Hypervisor Hypercore Integration (Reel 2)
//
// Lightweight TOML parser and pretty-printer for hac.toml VM config files.
// No external TOML library dependency — uses a minimal custom parser.

import type { VMSpec, HypervisorProvider, DriveSpec } from './types.js';
import { VMSpecSchema } from './types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HostCapacity {
  cpuMillicores: number;
  memoryMb: number;
  diskMb: number;
  networkKbps: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Minimal TOML parser ─────────────────────────────────────────────────────

type TOMLValue = string | number | boolean | TOMLTable | TOMLTable[];
type TOMLTable = Record<string, TOMLValue>;

function parseTOMLValue(raw: string): TOMLValue {
  const t = raw.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  if (t === 'true') return true;
  if (t === 'false') return false;
  const n = Number(t);
  if (!isNaN(n) && t !== '') return n;
  return t; // unknown: return as-is
}

/** Strip a TOML line comment, respecting quoted strings. */
function stripTOMLComment(line: string): string {
  let inString = false;
  let quoteChar = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === '\\') { i++; continue; } // skip escape sequence
      if (ch === quoteChar) inString = false;
    } else {
      if (ch === '"' || ch === "'") { inString = true; quoteChar = ch; }
      else if (ch === '#') return line.slice(0, i);
    }
  }
  return line;
}

function parseTOML(toml: string): TOMLTable {
  const root: TOMLTable = {};
  const tableArrayEntries: Record<string, TOMLTable[]> = {};
  let current: TOMLTable = root;

  for (const rawLine of toml.split('\n')) {
    const line = stripTOMLComment(rawLine).trim();
    if (!line) continue;

    // Array of tables: [[name]]
    if (line.startsWith('[[') && line.endsWith(']]')) {
      const name = line.slice(2, -2).trim();
      if (!tableArrayEntries[name]) {
        tableArrayEntries[name] = [];
        root[name] = tableArrayEntries[name];
      }
      const entry: TOMLTable = {};
      tableArrayEntries[name].push(entry);
      current = entry;
      continue;
    }

    // Section: [section] or [section.sub]
    if (line.startsWith('[') && line.endsWith(']')) {
      const path = line.slice(1, -1).trim().split('.');
      let obj: TOMLTable = root;
      for (const key of path) {
        if (!(key in obj)) obj[key] = {};
        obj = obj[key] as TOMLTable;
      }
      current = obj;
      continue;
    }

    // Key = value
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    current[key] = parseTOMLValue(val);
  }

  return root;
}

// ─── TOML → VMSpec mapping ────────────────────────────────────────────────────

function tomlToVMSpec(t: TOMLTable): VMSpec {
  const raw = t['resources'] as TOMLTable | undefined ?? {};
  const drives: DriveSpec[] = ((t['drives'] as TOMLTable[]) ?? []).map(d => ({
    driveId: String(d['drive_id'] ?? d['driveId'] ?? ''),
    pathOnHost: String(d['path_on_host'] ?? d['pathOnHost'] ?? ''),
    isRootDevice: Boolean(d['is_root_device'] ?? d['isRootDevice'] ?? false),
    isReadOnly: Boolean(d['is_read_only'] ?? d['isReadOnly'] ?? false),
  }));
  const metadata: Record<string, string> = {};
  const metaSection = t['metadata'] as TOMLTable | undefined;
  if (metaSection) {
    for (const [k, v] of Object.entries(metaSection)) {
      metadata[k] = String(v);
    }
  }

  return VMSpecSchema.parse({
    name: t['name'],
    provider: t['provider'] ?? 'docker',
    image: t['image'],
    kernelImage: t['kernel_image'] ?? t['kernelImage'],
    isolationLevel: t['isolation_level'] ?? t['isolationLevel'],
    networkEnabled: t['network_enabled'] ?? t['networkEnabled'],
    bootTimeoutMs: t['boot_timeout_ms'] ?? t['bootTimeoutMs'],
    agentId: t['agent_id'] ?? t['agentId'],
    resources: {
      cpuMillicores: raw['cpu_millicores'] ?? raw['cpuMillicores'],
      memoryMb: raw['memory_mb'] ?? raw['memoryMb'],
      diskMb: raw['disk_mb'] ?? raw['diskMb'],
      networkKbps: raw['network_kbps'] ?? raw['networkKbps'],
      maxProcesses: raw['max_processes'] ?? raw['maxProcesses'],
    },
    drives,
    metadata,
  });
}

// ─── VMSpec → TOML formatting ─────────────────────────────────────────────────

function vmSpecToTOML(spec: VMSpec): string {
  const lines: string[] = [];

  lines.push(`name = "${spec.name}"`);
  lines.push(`provider = "${spec.provider}"`);
  lines.push(`image = "${spec.image}"`);
  if (spec.kernelImage) lines.push(`kernel_image = "${spec.kernelImage}"`);
  lines.push(`isolation_level = "${spec.isolationLevel}"`);
  lines.push(`network_enabled = ${spec.networkEnabled}`);
  lines.push(`boot_timeout_ms = ${spec.bootTimeoutMs}`);
  if (spec.agentId) lines.push(`agent_id = "${spec.agentId}"`);

  lines.push('');
  lines.push('[resources]');
  lines.push(`cpu_millicores = ${spec.resources.cpuMillicores}`);
  lines.push(`memory_mb = ${spec.resources.memoryMb}`);
  lines.push(`disk_mb = ${spec.resources.diskMb}`);
  lines.push(`network_kbps = ${spec.resources.networkKbps}`);
  lines.push(`max_processes = ${spec.resources.maxProcesses}`);

  for (const drive of spec.drives) {
    lines.push('');
    lines.push('[[drives]]');
    lines.push(`drive_id = "${drive.driveId}"`);
    lines.push(`path_on_host = "${drive.pathOnHost}"`);
    lines.push(`is_root_device = ${drive.isRootDevice}`);
    lines.push(`is_read_only = ${drive.isReadOnly}`);
  }

  const metaEntries = Object.entries(spec.metadata);
  if (metaEntries.length > 0) {
    lines.push('');
    lines.push('[metadata]');
    for (const [k, v] of metaEntries) {
      lines.push(`${k} = "${v}"`);
    }
  }

  return lines.join('\n') + '\n';
}

// ─── Default templates ────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: Record<HypervisorProvider, Partial<VMSpec>> = {
  firecracker: {
    provider: 'firecracker',
    image: '/var/lib/firecracker/images/ubuntu-22.04.ext4',
    kernelImage: '/var/lib/firecracker/kernels/vmlinux',
    isolationLevel: 'vm',
    resources: { cpuMillicores: 500, memoryMb: 256, diskMb: 2048, networkKbps: 1024, maxProcesses: 32 },
    networkEnabled: false,
    bootTimeoutMs: 10_000,
  },
  qemu: {
    provider: 'qemu',
    image: '/var/lib/qemu/images/ubuntu-22.04.qcow2',
    kernelImage: '/boot/vmlinuz',
    isolationLevel: 'vm',
    resources: { cpuMillicores: 1000, memoryMb: 512, diskMb: 4096, networkKbps: 2048, maxProcesses: 64 },
    networkEnabled: false,
    bootTimeoutMs: 30_000,
  },
  docker: {
    provider: 'docker',
    image: 'ubuntu:22.04',
    isolationLevel: 'namespace',
    resources: { cpuMillicores: 250, memoryMb: 128, diskMb: 1024, networkKbps: 1024, maxProcesses: 32 },
    networkEnabled: false,
    bootTimeoutMs: 5_000,
  },
};

// ─── HACConfigParser ──────────────────────────────────────────────────────────

/**
 * HACConfigParser — parse, format, validate, and generate default hac.toml configs.
 *
 * Satisfies Spec Task 2.1:
 * - parse(toml): VMSpec — lightweight custom TOML parser (no external deps)
 * - format(spec): string — pretty-prints VMSpec as hac.toml
 * - validate(spec, hostCapacity): ValidationResult — resource constraint checks
 * - getDefaultTemplate(provider): VMSpec — per-provider sensible defaults
 */
export class HACConfigParser {
  /**
   * Parse a hac.toml string into a VMSpec.
   * Throws on invalid TOML or missing required fields (name, image).
   */
  parse(toml: string): VMSpec {
    if (!toml.trim()) {
      throw new Error('hac.toml parse error: empty input');
    }
    let raw: TOMLTable;
    try {
      raw = parseTOML(toml);
    } catch (err) {
      throw new Error(`hac.toml parse error: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      return tomlToVMSpec(raw);
    } catch (err) {
      throw new Error(`hac.toml validation error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Format a VMSpec as a hac.toml string.
   */
  format(spec: VMSpec): string {
    return vmSpecToTOML(spec);
  }

  /**
   * Validate a VMSpec against host capacity constraints.
   */
  validate(spec: VMSpec, hostCapacity: HostCapacity): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!spec.name?.trim()) errors.push('name is required');
    if (!spec.image?.trim()) errors.push('image is required');

    const r = spec.resources;

    if (r.cpuMillicores > hostCapacity.cpuMillicores) {
      errors.push(
        `cpuMillicores ${r.cpuMillicores} exceeds host capacity ${hostCapacity.cpuMillicores}`,
      );
    }
    if (r.memoryMb > hostCapacity.memoryMb) {
      errors.push(`memoryMb ${r.memoryMb} exceeds host capacity ${hostCapacity.memoryMb}`);
    }
    if (r.diskMb > hostCapacity.diskMb) {
      errors.push(`diskMb ${r.diskMb} exceeds host capacity ${hostCapacity.diskMb}`);
    }
    if (r.networkKbps > hostCapacity.networkKbps) {
      errors.push(
        `networkKbps ${r.networkKbps} exceeds host capacity ${hostCapacity.networkKbps}`,
      );
    }

    if (r.cpuMillicores > hostCapacity.cpuMillicores * 0.8) {
      warnings.push('CPU allocation exceeds 80% of host capacity');
    }
    if (r.memoryMb > hostCapacity.memoryMb * 0.8) {
      warnings.push('Memory allocation exceeds 80% of host capacity');
    }

    if (spec.provider === 'firecracker' && !spec.kernelImage) {
      warnings.push('firecracker provider typically requires kernelImage');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Get a default VMSpec template for a given provider.
   * The caller must set a `name` before using the spec.
   */
  getDefaultTemplate(provider: HypervisorProvider): VMSpec {
    const defaults = DEFAULT_TEMPLATES[provider];
    return VMSpecSchema.parse({
      name: `${provider}-vm`,
      drives: [],
      metadata: {},
      ...defaults,
    });
  }
}
