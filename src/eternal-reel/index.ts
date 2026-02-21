// Eternal Data Reel - K3-37
// Unified export for all Eternal Data Reel features

// ─── Harness Module ───────────────────────────────────────────────────────────
export * from '../harness/index.js';

// ─── SAGA Module ─────────────────────────────────────────────────────────────
export * from '../saga/index.js';

// ─── RLM Module ──────────────────────────────────────────────────────────────
export * from '../rlm/index.js';

// ─── Hindsight Module ────────────────────────────────────────────────────────
export * from '../hindsight/index.js';

// ─── Factory & Dream Mode ────────────────────────────────────────────────────
export { createEternalReel } from './factory.js';
export type { EternalReelConfig, EternalReelInstance } from './factory.js';

export { DreamMode, createDreamMode } from './dream-mode.js';
export type { DreamModeReport, DreamModeOptions } from './dream-mode.js';
