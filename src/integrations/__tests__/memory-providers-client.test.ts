// KMS-13: Tests for Mem0/Letta Memory Providers Client

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MemoryProvidersClient,
  createMemoryProvidersClient,
  getMemoryProvidersClient,
  resetMemoryProvidersClient,
  type Memory,
  type Collection,
  type QueryResult,
} from '../memory-providers-client.js';

describe('MemoryProvidersClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMemoryProvidersClient();
  });

  // ============================================================================
  // Connection Tests
  // ============================================================================

  describe('connection', () => {
    it('should connect to mem0 with valid API key', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      const connected = await client.connect();
      expect(connected).toBe(true);
      expect(client.isConnected()).toBe(true);
    });

    it('should connect to letta with valid API key', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'letta',
      });
      const connected = await client.connect();
      expect(connected).toBe(true);
      expect(client.isConnected()).toBe(true);
    });

    it('should throw when connecting without API key', async () => {
      const client = createMemoryProvidersClient({
        apiKey: '',
        provider: 'mem0',
      });
      await expect(client.connect()).rejects.toThrow('API key is required');
    });

    it('should throw when calling methods without connecting', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await expect(client.listCollections()).rejects.toThrow('not connected');
    });

    it('should return correct provider type', () => {
      const mem0Client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      expect(mem0Client.getProvider()).toBe('mem0');

      const lettaClient = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'letta',
      });
      expect(lettaClient.getProvider()).toBe('letta');
    });
  });

  // ============================================================================
  // Store Memory Tests
  // ============================================================================

  describe('store', () => {
    it('should store a memory with content', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      const memory = await client.store({
        content: 'User likes dark mode',
      });

      expect(memory.content).toBe('User likes dark mode');
      expect(memory.id).toBeDefined();
      expect(memory.collection).toBe('default');
    });

    it('should store memory in custom collection', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      const memory = await client.store({
        content: 'Important fact',
        collection: 'my-collection',
      });

      expect(memory.collection).toBe('my-collection');
    });

    it('should store memory with metadata', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      const memory = await client.store({
        content: 'Test content',
        metadata: { priority: 'high', source: 'chat' },
      });

      expect(memory.metadata).toEqual({ priority: 'high', source: 'chat' });
    });

    it('should store memory with tags', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      const memory = await client.store({
        content: 'Tagged memory',
        tags: ['important', 'user-preference'],
      });

      expect(memory.tags).toEqual(['important', 'user-preference']);
    });

    it('should set created and updated timestamps', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      const before = Date.now();
      const memory = await client.store({ content: 'Test' });
      const after = Date.now();

      const created = new Date(memory.createdAt).getTime();
      expect(created).toBeGreaterThanOrEqual(before);
      expect(created).toBeLessThanOrEqual(after);
      expect(memory.updatedAt).toBe(memory.createdAt);
    });
  });

  // ============================================================================
  // Query Memory Tests
  // ============================================================================

  describe('query', () => {
    it('should return empty array when no memories match', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      const results = await client.query({ query: 'nonexistent' });
      expect(results).toEqual([]);
    });

    it('should find memories matching query', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      await client.store({ content: 'User likes coffee' });
      await client.store({ content: 'User likes tea' });

      const results = await client.query({ query: 'coffee' });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].memory.content).toBe('User likes coffee');
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should respect query limit', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      await client.store({ content: 'Memory one' });
      await client.store({ content: 'Memory two' });
      await client.store({ content: 'Memory three' });

      const results = await client.query({ query: 'Memory', limit: 2 });

      expect(results.length).toBe(2);
    });

    it('should filter by collection', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      await client.store({
        content: 'Personal info',
        collection: 'personal',
      });
      await client.store({
        content: 'Work info',
        collection: 'work',
      });

      const results = await client.query({
        query: 'info',
        collection: 'personal',
      });

      expect(results.length).toBe(1);
      expect(results[0].memory.content).toBe('Personal info');
    });

    it('should apply score threshold', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      await client.store({ content: 'Exact match for query' });
      await client.store({ content: 'Something unrelated' });

      const results = await client.query({
        query: 'Exact match',
        threshold: 0.5,
      });

      expect(results.every((r) => r.score >= 0.5)).toBe(true);
    });

    it('should filter by metadata', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      await client.store({
        content: 'High priority task',
        metadata: { priority: 'high' },
      });
      await client.store({
        content: 'Low priority task',
        metadata: { priority: 'low' },
      });

      const results = await client.query({
        query: 'task',
        filters: { priority: 'high' },
      });

      expect(results.length).toBe(1);
      expect(results[0].memory.content).toBe('High priority task');
    });
  });

  // ============================================================================
  // Update Memory Tests
  // ============================================================================

  describe('update', () => {
    it('should update memory content', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      const memory = await client.store({ content: 'Old content' });
      const updated = await client.update({
        id: memory.id,
        content: 'New content',
      });

      expect(updated.content).toBe('New content');
      expect(updated.id).toBe(memory.id);
    });

    it('should update memory metadata', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      const memory = await client.store({
        content: 'Test',
        metadata: { status: 'pending' },
      });
      const updated = await client.update({
        id: memory.id,
        metadata: { status: 'completed' },
      });

      expect(updated.metadata).toEqual({ status: 'completed' });
    });

    it('should update memory tags', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      const memory = await client.store({
        content: 'Test',
        tags: ['old-tag'],
      });
      const updated = await client.update({
        id: memory.id,
        tags: ['new-tag'],
      });

      expect(updated.tags).toEqual(['new-tag']);
    });

    it('should update updatedAt timestamp', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      const memory = await client.store({ content: 'Test' });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const beforeUpdate = Date.now();
      const updated = await client.update({
        id: memory.id,
        content: 'Updated',
      });

      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(beforeUpdate);
    });

    it('should throw for non-existent memory', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      await expect(
        client.update({ id: 'non-existent', content: 'Test' })
      ).rejects.toThrow('Memory not found');
    });
  });

  // ============================================================================
  // Delete Memory Tests
  // ============================================================================

  describe('delete', () => {
    it('should delete existing memory', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      const memory = await client.store({ content: 'To be deleted' });
      const deleted = await client.delete(memory.id);

      expect(deleted).toBe(true);
      expect(await client.get(memory.id)).toBeNull();
    });

    it('should return false for non-existent memory', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      const deleted = await client.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ============================================================================
  // List Collections Tests
  // ============================================================================

  describe('listCollections', () => {
    it('should return default collection', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      const collections = await client.listCollections();

      expect(collections.length).toBeGreaterThanOrEqual(1);
      expect(collections.some((c) => c.name === 'default')).toBe(true);
    });

    it('should list custom collections', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      await client.store({ content: 'Test', collection: 'collection-a' });
      await client.store({ content: 'Test', collection: 'collection-b' });

      const collections = await client.listCollections();

      expect(collections.some((c) => c.name === 'collection-a')).toBe(true);
      expect(collections.some((c) => c.name === 'collection-b')).toBe(true);
    });

    it('should apply limit', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      await client.store({ content: 'Test', collection: 'col1' });
      await client.store({ content: 'Test', collection: 'col2' });
      await client.store({ content: 'Test', collection: 'col3' });

      const collections = await client.listCollections({ limit: 2 });

      expect(collections.length).toBe(2);
    });

    it('should apply offset', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      await client.store({ content: 'Test', collection: 'col1' });
      await client.store({ content: 'Test', collection: 'col2' });

      const all = await client.listCollections();
      const offset = await client.listCollections({ offset: 1 });

      expect(offset.length).toBe(all.length - 1);
    });
  });

  // ============================================================================
  // Get and List Memory Tests
  // ============================================================================

  describe('get and list', () => {
    it('should get memory by ID', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      const stored = await client.store({ content: 'Test' });
      const fetched = await client.get(stored.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(stored.id);
      expect(fetched!.content).toBe('Test');
    });

    it('should return null for non-existent ID', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      const fetched = await client.get('non-existent');
      expect(fetched).toBeNull();
    });

    it('should list all memories', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      await client.store({ content: 'Memory 1' });
      await client.store({ content: 'Memory 2' });

      const memories = await client.list();

      expect(memories.length).toBe(2);
    });

    it('should list memories in specific collection', async () => {
      const client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await client.connect();

      await client.store({ content: 'In default' });
      await client.store({ content: 'In custom', collection: 'custom' });

      const defaultMemories = await client.list('default');
      const customMemories = await client.list('custom');

      expect(defaultMemories.length).toBe(1);
      expect(customMemories.length).toBe(1);
      expect(defaultMemories[0].content).toBe('In default');
      expect(customMemories[0].content).toBe('In custom');
    });
  });

  // ============================================================================
  // Provider Isolation Tests
  // ============================================================================

  describe('provider isolation', () => {
    it('should isolate mem0 and letta stores', async () => {
      const mem0Client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      const lettaClient = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'letta',
      });

      await mem0Client.connect();
      await lettaClient.connect();

      await mem0Client.store({ content: 'Mem0 memory' });
      await lettaClient.store({ content: 'Letta memory' });

      const mem0Memories = await mem0Client.list();
      const lettaMemories = await lettaClient.list();

      expect(mem0Memories.length).toBe(1);
      expect(mem0Memories[0].content).toBe('Mem0 memory');
      expect(lettaMemories.length).toBe(1);
      expect(lettaMemories[0].content).toBe('Letta memory');
    });

    it('should reset specific provider store', async () => {
      const mem0Client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      const lettaClient = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'letta',
      });

      await mem0Client.connect();
      await lettaClient.connect();

      await mem0Client.store({ content: 'Mem0' });
      await lettaClient.store({ content: 'Letta' });

      resetMemoryProvidersClient('mem0');

      const newMem0Client = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      const newLettaClient = createMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'letta',
      });

      await newMem0Client.connect();
      await newLettaClient.connect();

      expect((await newMem0Client.list()).length).toBe(0);
      expect((await newLettaClient.list()).length).toBe(1);
    });
  });

  // ============================================================================
  // Singleton Tests
  // ============================================================================

  describe('singleton', () => {
    it('should return same instance from getMemoryProvidersClient', async () => {
      const client1 = getMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      const client2 = getMemoryProvidersClient();

      expect(client1).toBe(client2);
    });

    it('should throw when getting client without initialization', () => {
      resetMemoryProvidersClient();

      expect(() => getMemoryProvidersClient()).toThrow('not initialized');
    });

    it('should reset all clients and stores', async () => {
      const mem0Client = getMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await mem0Client.connect();
      await mem0Client.store({ content: 'Test' });

      resetMemoryProvidersClient();

      const newClient = getMemoryProvidersClient({
        apiKey: 'test-key',
        provider: 'mem0',
      });
      await newClient.connect();
      const memories = await newClient.list();

      expect(memories.length).toBe(0);
    });
  });
});
