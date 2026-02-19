// Ollama Manager — R20-02
// Auto-start/stop Ollama, port watching, health checks

use serde::{Deserialize, Serialize};
use std::process::{Child, Command};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OllamaStatus {
    pub running: bool,
    pub port: u16,
    pub version: Option<String>,
    pub models: Vec<String>,
}

pub struct OllamaManager {
    process: Arc<Mutex<Option<Child>>>,
    default_port: u16,
}

impl OllamaManager {
    pub fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            default_port: 11434,
        }
    }

    /// Start Ollama service
    pub async fn start(&self) -> Result<(), String> {
        let mut process = self.process.lock().await;
        
        if process.is_some() {
            return Err("Ollama is already running".to_string());
        }

        // Try to start Ollama
        let child = Command::new("ollama")
            .arg("serve")
            .spawn()
            .map_err(|e| format!("Failed to start Ollama: {}", e))?;

        *process = Some(child);

        // Wait for service to be ready
        sleep(Duration::from_secs(2)).await;

        // Verify it's running
        match self.check_port(self.default_port).await {
            Ok(true) => Ok(()),
            Ok(false) => {
                *process = None;
                Err("Ollama failed to start".to_string())
            }
            Err(e) => {
                *process = None;
                Err(format!("Failed to verify Ollama: {}", e))
            }
        }
    }

    /// Stop Ollama service
    pub async fn stop(&self) -> Result<(), String> {
        let mut process = self.process.lock().await;
        
        if let Some(mut child) = process.take() {
            let _ = child.kill();
            let _ = child.wait();
        }

        // Also try to kill any remaining ollama processes
        #[cfg(target_os = "macos")]
        {
            let _ = Command::new("pkill")
                .args(&["-f", "ollama serve"])
                .output();
        }

        #[cfg(target_os = "linux")]
        {
            let _ = Command::new("pkill")
                .args(&["-f", "ollama serve"])
                .output();
        }

        Ok(())
    }

    /// Check Ollama status
    pub async fn check_status(&self) -> Result<OllamaStatus, String> {
        let port = self.detect_port().await.unwrap_or(self.default_port);
        
        match self.check_port(port).await {
            Ok(true) => {
                // Try to get models list
                let models = self.fetch_models(port).await.unwrap_or_default();
                
                Ok(OllamaStatus {
                    running: true,
                    port,
                    version: Some("0.1.0".to_string()),
                    models,
                })
            }
            Ok(false) => Ok(OllamaStatus {
                running: false,
                port,
                version: None,
                models: vec![],
            }),
            Err(e) => Err(format!("Failed to check status: {}", e)),
        }
    }

    /// Detect which port Ollama is running on
    pub async fn detect_port(&self) -> Option<u16> {
        let common_ports = [11434, 11435, 11436];
        
        for port in &common_ports {
            if let Ok(true) = self.check_port(*port).await {
                return Some(*port);
            }
        }
        
        None
    }

    /// Check if a specific port is responding
    async fn check_port(&self, port: u16) -> Result<bool, String> {
        let client = reqwest::Client::new();
        let url = format!("http://localhost:{}/api/tags", port);
        
        match client.get(&url).timeout(Duration::from_secs(2)).send().await {
            Ok(response) => Ok(response.status().is_success()),
            Err(_) => Ok(false),
        }
    }

    /// Fetch list of available models
    async fn fetch_models(&self, port: u16) -> Result<Vec<String>, String> {
        let client = reqwest::Client::new();
        let url = format!("http://localhost:{}/api/tags", port);
        
        #[derive(Deserialize)]
        struct Model {
            name: String,
        }
        
        #[derive(Deserialize)]
        struct ModelsResponse {
            models: Vec<Model>,
        }
        
        let response = client
            .get(&url)
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;
        
        if !response.status().is_success() {
            return Ok(vec![]);
        }
        
        let data: ModelsResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;
        
        Ok(data.models.into_iter().map(|m| m.name).collect())
    }

    /// Wait for Ollama to be ready
    pub async fn wait_for_ready(&self, timeout_secs: u64) -> Result<bool, String> {
        let start = std::time::Instant::now();
        let timeout = Duration::from_secs(timeout_secs);
        
        while start.elapsed() < timeout {
            match self.check_status().await {
                Ok(status) if status.running => return Ok(true),
                _ => sleep(Duration::from_millis(500)).await,
            }
        }
        
        Ok(false)
    }
}

impl Default for OllamaManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ollama_manager_creation() {
        let manager = OllamaManager::new();
        assert_eq!(manager.default_port, 11434);
    }

    #[test]
    fn test_ollama_status_default() {
        let status = OllamaStatus {
            running: false,
            port: 11434,
            version: None,
            models: vec![],
        };
        
        assert!(!status.running);
        assert!(status.models.is_empty());
    }

    #[tokio::test]
    async fn test_check_status_offline() {
        let manager = OllamaManager::new();
        // Should return not running since Ollama isn't actually running
        let status = manager.check_status().await;
        assert!(status.is_ok());
        let status = status.unwrap();
        assert!(!status.running);
    }
}
