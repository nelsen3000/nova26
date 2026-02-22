// Moltbot + Image Verifier + Security Tests — Spec Tasks 9.1, 9.2, 10.1
// Sprint S3-12 | Hypervisor Hypercore Integration (Reel 2)

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AgentRegistry, AgentNotFoundError, AgentAlreadyRegisteredError } from '../agent-registry.js';
import { MoltbotDeployer, defaultAgentConfigLoader } from '../moltbot-deployer.js';
import { ImageVerifier, sha256 } from '../image-verifier.js';
import { SandboxManager } from '../sandbox-manager.js';
import type { AgentDeployment, TrustedManifest } from '../types.js';

// ─── AgentRegistry ────────────────────────────────────────────────────────────

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  function makeDeployment(agentName: string): AgentDeployment {
    return {
      agentName,
      vmId: `vm-${agentName}`,
      spec: {
        name: agentName, provider: 'docker', image: `img/${agentName}:latest`,
        isolationLevel: 'namespace', resources: { cpuMillicores: 250, memoryMb: 128, diskMb: 1024, networkKbps: 512, maxProcesses: 16 },
        drives: [], networkEnabled: false, metadata: {}, bootTimeoutMs: 5000,
      },
      deployedAt: Date.now(),
      status: 'running',
    };
  }

  beforeEach(() => { registry = new AgentRegistry(); });

  it('register() stores a deployment', () => {
    registry.register(makeDeployment('MARS'));
    expect(registry.has('MARS')).toBe(true);
    expect(registry.count()).toBe(1);
  });

  it('register() throws on duplicate', () => {
    registry.register(makeDeployment('MARS'));
    expect(() => registry.register(makeDeployment('MARS'))).toThrow(AgentAlreadyRegisteredError);
  });

  it('upsert() updates existing entry', () => {
    registry.register(makeDeployment('MARS'));
    const updated = { ...makeDeployment('MARS'), status: 'stopped' as const };
    registry.upsert(updated);
    expect(registry.get('MARS').status).toBe('stopped');
  });

  it('unregister() removes and returns true', () => {
    registry.register(makeDeployment('VENUS'));
    expect(registry.unregister('VENUS')).toBe(true);
    expect(registry.has('VENUS')).toBe(false);
  });

  it('unregister() returns false for unknown agent', () => {
    expect(registry.unregister('nobody')).toBe(false);
  });

  it('get() throws AgentNotFoundError for unknown agent', () => {
    expect(() => registry.get('UNKNOWN')).toThrow(AgentNotFoundError);
  });

  it('list() returns all deployments', () => {
    registry.register(makeDeployment('MARS'));
    registry.register(makeDeployment('VENUS'));
    expect(registry.list()).toHaveLength(2);
  });

  it('toJSON() → fromJSON() round-trips all deployments', () => {
    registry.register(makeDeployment('MARS'));
    registry.register(makeDeployment('EARTH'));
    const json = registry.toJSON();

    const registry2 = new AgentRegistry();
    registry2.fromJSON(json);
    expect(registry2.count()).toBe(2);
    expect(registry2.has('MARS')).toBe(true);
    expect(registry2.has('EARTH')).toBe(true);
  });

  it('clear() removes all entries', () => {
    registry.register(makeDeployment('MARS'));
    registry.clear();
    expect(registry.count()).toBe(0);
  });
});

// ─── MoltbotDeployer ─────────────────────────────────────────────────────────

describe('MoltbotDeployer', () => {
  let sandbox: SandboxManager;
  let deployer: MoltbotDeployer;

  beforeEach(async () => {
    sandbox = new SandboxManager({ maxConcurrentVMs: 5 });
    await sandbox.initialize();
    deployer = new MoltbotDeployer(sandbox);
  });

  it('deployAgent() spawns a VM and registers deployment', async () => {
    const deployment = await deployer.deployAgent('MARS');
    expect(deployment.agentName).toBe('MARS');
    expect(deployment.vmId).toBeTruthy();
    expect(deployer.isDeployed('MARS')).toBe(true);
  });

  it('deployAgent() uses overrides for spec', async () => {
    const deployment = await deployer.deployAgent('VENUS', { resources: { cpuMillicores: 500, memoryMb: 256, diskMb: 2048, networkKbps: 1024, maxProcesses: 32 } });
    expect(deployment.spec.resources.cpuMillicores).toBe(500);
  });

  it('undeployAgent() terminates VM and unregisters', async () => {
    await deployer.deployAgent('EARTH');
    await deployer.undeployAgent('EARTH');
    expect(deployer.isDeployed('EARTH')).toBe(false);
  });

  it('undeployAgent() throws AgentNotFoundError for unknown agent', async () => {
    await expect(deployer.undeployAgent('NOBODY')).rejects.toThrow(AgentNotFoundError);
  });

  it('getDeployment() returns deployment info', async () => {
    await deployer.deployAgent('SATURN');
    const d = deployer.getDeployment('SATURN');
    expect(d.agentName).toBe('SATURN');
    expect(d.vmId).toBeTruthy();
  });

  it('listDeployments() returns all deployed agents', async () => {
    await deployer.deployAgent('AGENT-A');
    await deployer.deployAgent('AGENT-B');
    expect(deployer.listDeployments()).toHaveLength(2);
  });

  it('defaultAgentConfigLoader produces valid VMSpec', async () => {
    const spec = await defaultAgentConfigLoader('TEST-AGENT', { networkEnabled: true });
    expect(spec.name).toBe('TEST-AGENT');
    expect(spec.networkEnabled).toBe(true);
    expect(spec.agentId).toBe('TEST-AGENT');
  });
});

// ─── ImageVerifier ────────────────────────────────────────────────────────────

describe('ImageVerifier', () => {
  let verifier: ImageVerifier;
  const testData = Buffer.from('hello-image-data', 'utf8');
  const testHash = sha256(testData);

  const manifest: TrustedManifest = {
    version: '1.0.0',
    images: { '/images/ubuntu.ext4': testHash },
    kernels: { '/boot/vmlinux': testHash },
    plugins: { 'nova26-agent': testHash },
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    verifier = new ImageVerifier();
    verifier.loadManifest(manifest);
  });

  it('verifyImage() succeeds with correct data', () => {
    const result = verifier.verifyImage('/images/ubuntu.ext4', testData);
    expect(result.verified).toBe(true);
    expect(result.actualHash).toBe(testHash);
  });

  it('verifyImage() fails with tampered data', () => {
    const tampered = Buffer.from('tampered', 'utf8');
    const result = verifier.verifyImage('/images/ubuntu.ext4', tampered);
    expect(result.verified).toBe(false);
    expect(result.error).toContain('hash mismatch');
  });

  it('verifyKernel() succeeds with correct data', () => {
    const result = verifier.verifyKernel('/boot/vmlinux', testData);
    expect(result.verified).toBe(true);
  });

  it('verifyPlugin() succeeds with correct data', () => {
    const result = verifier.verifyPlugin('nova26-agent', testData);
    expect(result.verified).toBe(true);
  });

  it('verifyImage() returns error when path not in manifest', () => {
    const result = verifier.verifyImage('/unknown/image.ext4', testData);
    expect(result.verified).toBe(false);
    expect(result.error).toContain('not found in manifest');
  });

  it('verifyImage() returns error when no manifest loaded', () => {
    verifier.clearManifest();
    const result = verifier.verifyImage('/images/ubuntu.ext4', testData);
    expect(result.verified).toBe(false);
    expect(result.error).toContain('No manifest loaded');
  });

  it('isKnown() returns true for registered paths', () => {
    expect(verifier.isKnown('images', '/images/ubuntu.ext4')).toBe(true);
    expect(verifier.isKnown('images', '/unknown.ext4')).toBe(false);
  });

  it('sha256() is deterministic', () => {
    const data = Buffer.from('test');
    expect(sha256(data)).toBe(sha256(data));
  });
});

// ─── Property 11: Agent deployment uses correct config ───────────────────────

describe('Property 11: Agent deployment config accuracy', () => {
  it('deployAgent() always registers with correct agentName', async () => {
    await fc.assert(fc.asyncProperty(
      fc.constantFrom('AGENT-A', 'AGENT-B', 'AGENT-C', 'AGENT-D', 'AGENT-E'),
      async (agentName) => {
        const sandbox = new SandboxManager({ maxConcurrentVMs: 10 });
        await sandbox.initialize();
        const deployer = new MoltbotDeployer(sandbox);
        const deployment = await deployer.deployAgent(agentName);
        expect(deployment.agentName).toBe(agentName);
        expect(deployer.isDeployed(agentName)).toBe(true);
        await deployer.undeployAgent(agentName);
        expect(deployer.isDeployed(agentName)).toBe(false);
      },
    ), { numRuns: 5 });
  });
});

// ─── Property 12: Agent registry accuracy ────────────────────────────────────

describe('Property 12: Agent registry accuracy', () => {
  it('registry count matches registered agent count', () => {
    fc.assert(fc.property(
      fc.uniqueArray(fc.string({ minLength: 2, maxLength: 10 }).map(s => `AGENT-${s.replace(/[^A-Z0-9]/gi, 'X').toUpperCase()}`), { minLength: 1, maxLength: 10 }),
      (agentNames) => {
        const registry = new AgentRegistry();
        for (const name of agentNames) {
          registry.upsert({
            agentName: name,
            vmId: `vm-${name}`,
            spec: {
              name, provider: 'docker', image: `img/${name}:latest`,
              isolationLevel: 'namespace', resources: { cpuMillicores: 250, memoryMb: 128, diskMb: 1024, networkKbps: 512, maxProcesses: 16 },
              drives: [], networkEnabled: false, metadata: {}, bootTimeoutMs: 5000,
            },
            deployedAt: Date.now(),
            status: 'running',
          });
        }
        expect(registry.count()).toBe(agentNames.length);
        expect(registry.list()).toHaveLength(agentNames.length);
        // All registered agents can be retrieved
        for (const name of agentNames) {
          expect(registry.has(name)).toBe(true);
          expect(registry.get(name).agentName).toBe(name);
        }
      },
    ), { numRuns: 30 });
  });
});

// ─── Property 17: Image checksum verification ────────────────────────────────

describe('Property 17: Image and kernel checksum verification', () => {
  it('correct data always verifies; tampered data always fails', () => {
    fc.assert(fc.property(
      fc.uint8Array({ minLength: 10, maxLength: 1000 }),
      (dataArray) => {
        const data = Buffer.from(dataArray);
        const hash = sha256(data);
        const manifest: TrustedManifest = {
          version: '1.0.0',
          images: { '/test.ext4': hash },
          kernels: {},
          plugins: {},
          updatedAt: Date.now(),
        };

        const v = new ImageVerifier();
        v.loadManifest(manifest);

        // Correct data verifies
        expect(v.verifyImage('/test.ext4', data).verified).toBe(true);

        // Extra byte at end — different data always fails
        const tampered = Buffer.concat([data, Buffer.from([0xff])]);
        expect(v.verifyImage('/test.ext4', tampered).verified).toBe(false);
      },
    ), { numRuns: 50 });
  });
});
