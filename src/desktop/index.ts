// Desktop Module — R20-02
// Tauri Native Desktop Application exports

export type {
  TauriAppConfig,
  WindowConfig,
  NativeBridge,
  OfflineCapabilityConfig,
  SecurityModel,
  FileChangeEvent,
  GitStatus,
  OllamaStatus,
  SyncQueueItem,
  ConflictResolution,
} from './types.js';

export { DEFAULT_TAURI_CONFIG } from './types.js';

export {
  NativeBridgeImpl,
  MockNativeBridge,
  createNativeBridge,
  createMockNativeBridge,
} from './native-bridge.js';

export {
  OllamaBridgeImpl,
  MockOllamaBridge,
  createOllamaBridge,
  createMockOllamaBridge,
} from './ollama-bridge.js';

export {
  OfflineQueue,
  DEFAULT_OFFLINE_CONFIG,
  createOfflineQueue,
} from './offline-queue.js';

export {
  SecurityManager,
  createSecurityManager,
} from './security-model.js';
