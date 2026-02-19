// Electric Sync — R20-02
// Conflict resolution, offline queue flush

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SyncQueueItem {
    pub id: String,
    pub action: String, // "create", "update", "delete"
    pub path: String,
    pub content: Option<String>,
    pub timestamp: i64,
    pub synced: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConflictResolution {
    pub strategy: String,
    pub local_version: String,
    pub remote_version: String,
    pub resolved_content: Option<String>,
}

pub struct ElectricSync {
    queue: Vec<SyncQueueItem>,
    queue_path: String,
}

impl ElectricSync {
    pub fn new() -> Self {
        Self {
            queue: Vec::new(),
            queue_path: ".nova/sync-queue.json".to_string(),
        }
    }

    /// Add item to sync queue
    pub fn enqueue(&mut self, item: SyncQueueItem) -> Result<(), String> {
        self.queue.push(item);
        self.persist_queue()
    }

    /// Get all pending items
    pub fn get_pending(&self) -> Vec<&SyncQueueItem> {
        self.queue.iter().filter(|item| !item.synced).collect()
    }

    /// Flush queue to remote
    pub async fn flush(&mut self) -> Result<FlushResult, String> {
        let mut processed = 0;
        let mut failed = 0;
        let mut conflicts = Vec::new();

        for item in self.queue.iter_mut().filter(|i| !i.synced) {
            match self.sync_item(item).await {
                Ok(true) => {
                    item.synced = true;
                    processed += 1;
                }
                Ok(false) => {
                    conflicts.push(item.id.clone());
                }
                Err(_) => {
                    failed += 1;
                }
            }
        }

        // Clean up synced items
        self.queue.retain(|item| !item.synced);
        self.persist_queue()?;

        Ok(FlushResult {
            processed,
            failed,
            conflicts,
        })
    }

    /// Resolve a conflict
    pub fn resolve_conflict(
        &mut self,
        item_id: &str,
        resolution: ConflictResolution,
    ) -> Result<(), String> {
        if let Some(item) = self.queue.iter_mut().find(|i| i.id == item_id) {
            match resolution.strategy.as_str() {
                "last-write-wins" => {
                    item.synced = false; // Retry sync
                }
                "merge" => {
                    if let Some(content) = resolution.resolved_content {
                        item.content = Some(content);
                        item.synced = false;
                    }
                }
                _ => {
                    return Err("Unknown conflict strategy".to_string());
                }
            }
            self.persist_queue()
        } else {
            Err("Item not found".to_string())
        }
    }

    /// Load queue from disk
    pub fn load_queue(&mut self) -> Result<(), String> {
        if !Path::new(&self.queue_path).exists() {
            self.queue = Vec::new();
            return Ok(());
        }

        let content = fs::read_to_string(&self.queue_path)
            .map_err(|e| format!("Failed to read queue: {}", e))?;
        
        self.queue = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse queue: {}", e))?;
        
        Ok(())
    }

    /// Save queue to disk
    fn persist_queue(&self) -> Result<(), String> {
        let parent = Path::new(&self.queue_path).parent();
        if let Some(p) = parent {
            fs::create_dir_all(p).map_err(|e| format!("Failed to create dir: {}", e))?;
        }

        let content = serde_json::to_string_pretty(&self.queue)
            .map_err(|e| format!("Failed to serialize queue: {}", e))?;
        
        fs::write(&self.queue_path, content)
            .map_err(|e| format!("Failed to write queue: {}", e))?;
        
        Ok(())
    }

    /// Sync a single item (mock implementation)
    async fn sync_item(&self, item: &SyncQueueItem) -> Result<bool, String> {
        // In real implementation, this would sync with remote server
        // For now, simulate success
        Ok(true)
    }

    /// Get queue statistics
    pub fn get_stats(&self) -> QueueStats {
        let total = self.queue.len();
        let pending = self.queue.iter().filter(|i| !i.synced).count();
        let synced = total - pending;

        let mut by_action: HashMap<String, usize> = HashMap::new();
        for item in &self.queue {
            *by_action.entry(item.action.clone()).or_insert(0) += 1;
        }

        QueueStats {
            total,
            pending,
            synced,
            by_action,
        }
    }

    /// Clear the queue
    pub fn clear(&mut self) {
        self.queue.clear();
        let _ = self.persist_queue();
    }
}

impl Default for ElectricSync {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
pub struct FlushResult {
    pub processed: usize,
    pub failed: usize,
    pub conflicts: Vec<String>,
}

#[derive(Debug)]
pub struct QueueStats {
    pub total: usize,
    pub pending: usize,
    pub synced: usize,
    pub by_action: HashMap<String, usize>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_electric_sync_new() {
        let sync = ElectricSync::new();
        assert!(sync.get_pending().is_empty());
    }

    #[test]
    fn test_enqueue_and_pending() {
        let mut sync = ElectricSync::new();
        let item = SyncQueueItem {
            id: "test-1".to_string(),
            action: "create".to_string(),
            path: "/test/file.txt".to_string(),
            content: Some("content".to_string()),
            timestamp: 1234567890,
            synced: false,
        };
        
        sync.enqueue(item).unwrap();
        assert_eq!(sync.get_pending().len(), 1);
    }

    #[test]
    fn test_get_stats() {
        let mut sync = ElectricSync::new();
        let item = SyncQueueItem {
            id: "test-1".to_string(),
            action: "create".to_string(),
            path: "/test/file.txt".to_string(),
            content: None,
            timestamp: 1234567890,
            synced: false,
        };
        
        sync.enqueue(item).unwrap();
        let stats = sync.get_stats();
        assert_eq!(stats.total, 1);
        assert_eq!(stats.pending, 1);
    }
}
