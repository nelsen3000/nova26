// Hyperswarm Discovery Integration Tests — Requirements 1.7, 1.8, 4.4

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentRegistry } from '../registry.js';
import { DiscoveryManager, resetGlobalDHT } from '../../hypercore/discovery.js';

describe('AgentRegistry Hyperswarm Discovery', () => {
  let registry: AgentRegistry;
  let discovery: DiscoveryManager;

  beforeEach(() => {
    resetGlobalDHT();
    registry = new AgentRegistry();
    discovery = new DiscoveryManager('peer-a', '127.0.0.1:9000');
  });

  afterEach(() => {
    registry.disableHyperswarmDiscovery();
    discovery.destroy();
    resetGlobalDHT();
  });

  it('enableHyperswarmDiscovery announces on DHT topic', () => {
    registry.enableHyperswarmDiscovery(discovery);
    expect(registry.isDiscoveryEnabled()).toBe(true);
    expect(discovery.getTopics().length).toBe(1);
  });

  it('disableHyperswarmDiscovery leaves DHT topic', () => {
    registry.enableHyperswarmDiscovery(discovery);
    registry.disableHyperswarmDiscovery();
    expect(registry.isDiscoveryEnabled()).toBe(false);
    expect(discovery.getTopics().length).toBe(0);
  });

  it('discoverRemoteCards finds peers on the same topic', () => {
    // Peer B announces on the same topic
    const peerB = new DiscoveryManager('peer-b', '127.0.0.1:9001');
    peerB.announce('nova26-agent-cards');

    registry.enableHyperswarmDiscovery(discovery);
    const found = registry.discoverRemoteCards();
    expect(found).toBe(1); // peer-b is discoverable

    peerB.destroy();
  });

  it('discoverRemoteCards returns 0 when no peers', () => {
    registry.enableHyperswarmDiscovery(discovery);
    const found = registry.discoverRemoteCards();
    expect(found).toBe(0);
  });

  it('discoverRemoteCards returns 0 when discovery not enabled', () => {
    expect(registry.discoverRemoteCards()).toBe(0);
  });

  it('remote card merge via discovery preserves origin', () => {
    registry.enableHyperswarmDiscovery(discovery);
    // Simulate discovering a remote card
    registry.mergeRemoteCard({ id: 'REMOTE-AGENT', name: 'Remote', tier: 'L2' });
    const card = registry.getById('REMOTE-AGENT');
    expect(card?.origin).toBe('remote');
  });
});
