# RalphLoop Lifecycle Hooks

Central nervous system for Ralph Loop - provides typed lifecycle hooks for all features.

## Hooks

- `onBeforeBuild` - Before build starts
- `onBeforeTask` - Before each task
- `onAfterTask` - After each task completes
- `onTaskError` - When a task errors
- `onHandoff` - During agent handoffs
- `onBuildComplete` - When build finishes

## HookRegistry

Maps every feature to its lifecycle phase for coordinated execution.
