// Visionary Integration Smoke Tests
// KIMI-VISIONARY-06

import { describe, it, expect } from 'vitest';

// Test imports from barrel
import {
  DreamEngine,
  ParallelUniverseEngine,
  OvernightEngine,
  SymbiontCore,
  TasteRoom,
  ALL_SECTIONS,
} from './index.js';

describe('Visionary Integration', () => {
  describe('DreamEngine', () => {
    it('can be imported and instantiated', () => {
      const engine = new DreamEngine({ persistSimulations: false });
      expect(engine).toBeDefined();
    });
  });

  describe('ParallelUniverseEngine', () => {
    it('can be imported and instantiated', () => {
      const engine = new ParallelUniverseEngine();
      expect(engine).toBeDefined();
    });
  });

  describe('OvernightEngine', () => {
    it('can be imported and instantiated', () => {
      const engine = new OvernightEngine();
      expect(engine).toBeDefined();
    });
  });

  describe('SymbiontCore', () => {
    it('can be imported and instantiated', () => {
      const engine = new SymbiontCore({ dbPath: ':memory:' });
      expect(engine).toBeDefined();
    });
  });

  describe('TasteRoom', () => {
    it('can be imported and instantiated', () => {
      const room = new TasteRoom();
      expect(room).toBeDefined();
      expect(ALL_SECTIONS.length).toBe(16);
    });
  });
});
