// Visionary Barrel Export - All 5 Visionary Engines
// KIMI-VISIONARY-06: Integration & Wiring

// Dream Mode Engine
export { DreamEngine } from '../dream/dream-engine.js';
export type {
  DreamModeConfig,
  DreamSession,
  DreamAnnotation,
  SimulationState,
  TasteProfile,
} from '../dream/dream-engine.js';

// Parallel Universe Engine
export { ParallelUniverseEngine } from '../universe/parallel-universe.js';
export type {
  ParallelUniverseConfig,
  ParallelUniverseSession,
  Universe,
  UniverseResult,
  BlendRequest,
} from '../universe/parallel-universe.js';

// Overnight Evolution Engine
export { OvernightEngine } from '../evolution/overnight-engine.js';
export type {
  OvernightEvolutionConfig,
  Experiment,
  ExperimentType,
  OvernightSession,
  MorningReport,
} from '../evolution/overnight-engine.js';

// Nova Symbiont Core
export { SymbiontCore } from '../symbiont/symbiont-core.js';
export type {
  SymbiontConfig,
  SymbiontState,
  CreativeStyleProfile,
  DecisionJournalEntry,
  SymbiontInsight,
} from '../symbiont/symbiont-core.js';

// Taste Room Engine
export { TasteRoom, ALL_SECTIONS } from '../taste-room/taste-room.js';
export type {
  TasteRoomConfig,
  TasteRoomSection,
  DevicePreview,
  TasteCard,
  SwipeEvent,
  SwipeDirection,
  CuratedFeed,
  InspirationBoard,
} from '../taste-room/taste-room.js';
