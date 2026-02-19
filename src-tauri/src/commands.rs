// Tauri Commands — R20-02
// Invoke commands for file, git, ollama, and notification operations

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::State;
use crate::AppState;

#[derive(Serialize, Deserialize, Debug)]
pub struct FileContent {
    pub path: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GitCommitRequest {
    pub message: String,
    pub files: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GitStatus {
    pub modified: Vec<String>,
    pub staged: Vec<String>,
    pub untracked: Vec<String>,
    pub branch: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct OllamaStatus {
    pub running: bool,
    pub port: u16,
    pub version: Option<String>,
    pub models: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct NotificationRequest {
    pub title: String,
    pub body: String,
}

/// Read a file from the project
#[tauri::command]
pub async fn read_project_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write content to a file
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    let parent = Path::new(&path).parent();
    if let Some(p) = parent {
        fs::create_dir_all(p).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))
}

/// Commit changes to git
#[tauri::command]
pub async fn git_commit(message: String, files: Vec<String>) -> Result<String, String> {
    // Use git2 for git operations
    let repo = git2::Repository::discover(".")
        .map_err(|e| format!("Failed to discover repo: {}", e))?;

    // Stage files
    let mut index = repo.index().map_err(|e| format!("Failed to get index: {}", e))?;
    
    for file in &files {
        index.add_path(Path::new(file))
            .map_err(|e| format!("Failed to stage file: {}", e))?;
    }
    
    index.write().map_err(|e| format!("Failed to write index: {}", e))?;

    // Create commit
    let signature = repo.signature()
        .map_err(|e| format!("Failed to get signature: {}", e))?;
    
    let tree_id = index.write_tree()
        .map_err(|e| format!("Failed to write tree: {}", e))?;
    
    let tree = repo.find_tree(tree_id)
        .map_err(|e| format!("Failed to find tree: {}", e))?;

    let parent_commit = repo.head()
        .and_then(|h| h.peel_to_commit())
        .map_err(|e| format!("Failed to get parent: {}", e))?;

    let commit_id = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &message,
        &tree,
        &[&parent_commit],
    ).map_err(|e| format!("Failed to create commit: {}", e))?;

    Ok(commit_id.to_string())
}

/// Get git status
#[tauri::command]
pub async fn git_status() -> Result<GitStatus, String> {
    let repo = git2::Repository::discover(".")
        .map_err(|e| format!("Failed to discover repo: {}", e))?;

    let statuses = repo.statuses(None)
        .map_err(|e| format!("Failed to get statuses: {}", e))?;

    let mut modified = Vec::new();
    let mut staged = Vec::new();
    let mut untracked = Vec::new();

    for status in statuses.iter() {
        let path = status.path().unwrap_or("").to_string();
        let status_bits = status.status();

        if status_bits.is_index_new() || status_bits.is_index_modified() {
            staged.push(path.clone());
        }
        if status_bits.is_wt_modified() {
            modified.push(path.clone());
        }
        if status_bits.is_wt_new() {
            untracked.push(path);
        }
    }

    let branch = repo.head()
        .and_then(|h| h.shorthand().map(|s| s.to_string()))
        .unwrap_or_else(|_| "main".to_string());

    Ok(GitStatus {
        modified,
        staged,
        untracked,
        branch,
    })
}

/// Start Ollama service
#[tauri::command]
pub async fn spawn_ollama(state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.ollama_manager.lock().await;
    manager.start().await
}

/// Stop Ollama service
#[tauri::command]
pub async fn stop_ollama(state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.ollama_manager.lock().await;
    manager.stop().await
}

/// Get Ollama status
#[tauri::command]
pub async fn ollama_status(state: State<'_, AppState>) -> Result<OllamaStatus, String> {
    let manager = state.ollama_manager.lock().await;
    manager.check_status().await
}

/// Watch project directory for changes
#[tauri::command]
pub async fn watch_project(path: String) -> Result<(), String> {
    // In real implementation, this would set up file watching
    // For now, just validate the path exists
    if !Path::new(&path).exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    Ok(())
}

/// Send system notification
#[tauri::command]
pub async fn send_notification(title: String, body: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // Use macOS notification center
        let _ = std::process::Command::new("osascript")
            .args(&[
                "-e",
                &format!("display notification \"{}\" with title \"{}\"", body, title),
            ])
            .output();
    }
    
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("notify-send")
            .args(&[&title, &body])
            .output();
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_git_status_structure() {
        let status = GitStatus {
            modified: vec!["file1.rs".to_string()],
            staged: vec!["file2.rs".to_string()],
            untracked: vec!["file3.rs".to_string()],
            branch: "main".to_string(),
        };
        
        assert_eq!(status.branch, "main");
        assert_eq!(status.modified.len(), 1);
    }

    #[test]
    fn test_ollama_status_structure() {
        let status = OllamaStatus {
            running: true,
            port: 11434,
            version: Some("0.1.0".to_string()),
            models: vec!["llama2".to_string()],
        };
        
        assert!(status.running);
        assert_eq!(status.port, 11434);
    }
}
