// Lifecycle Hooks System - Placeholder for Kimi's mega-wiring sprint
// This file will be replaced with full implementation

export type LifecycleHook = 
  | 'onBeforeBuild'
  | 'onBeforeTask'
  | 'onAfterTask'
  | 'onTaskError'
  | 'onHandoff'
  | 'onBuildComplete';

export interface LifecycleHooks {
  onBeforeBuild?: (context: BuildContext) => Promise<void> | void;
  onBeforeTask?: (task: Task, context: BuildContext) => Promise<void> | void;
  onAfterTask?: (task: Task, result: TaskResult, context: BuildContext) => Promise<void> | void;
  onTaskError?: (task: Task, error: Error, context: BuildContext) => Promise<void> | void;
  onHandoff?: (from: string, to: string, context: BuildContext) => Promise<void> | void;
  onBuildComplete?: (result: BuildResult, context: BuildContext) => Promise<void> | void;
}

export interface BuildContext {
  projectId: string;
  buildId: string;
  startTime: string;
  [key: string]: unknown;
}

export interface Task {
  id: string;
  title: string;
  status: string;
}

export interface TaskResult {
  success: boolean;
  output?: string;
}

export interface BuildResult {
  success: boolean;
  tasksCompleted: number;
  tasksFailed: number;
}
