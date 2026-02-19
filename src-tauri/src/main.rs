// Tauri Main Entry Point — R20-02
// Desktop application with window config, menu, system tray

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod ollama_manager;
mod electric_sync;

use tauri::{Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState {
    pub ollama_manager: Arc<Mutex<ollama_manager::OllamaManager>>,
    pub sync_engine: Arc<Mutex<electric_sync::ElectricSync>>,
}

fn main() {
    // Create system tray menu
    let tray_menu = SystemTrayMenu::new()
        .add_item(SystemTrayMenuItem::new("Show", "show"))
        .add_item(SystemTrayMenuItem::new("Hide", "hide"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(SystemTrayMenuItem::new("Quit", "quit"));

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .setup(|app| {
            // Initialize state
            let state = AppState {
                ollama_manager: Arc::new(Mutex::new(ollama_manager::OllamaManager::new())),
                sync_engine: Arc::new(Mutex::new(electric_sync::ElectricSync::new())),
            };
            app.manage(state);

            // Auto-start Ollama if configured
            let handle = app.handle();
            tauri::async_runtime::spawn(async move {
                if let Some(state) = handle.try_state::<AppState>() {
                    let manager = state.ollama_manager.lock().await;
                    let _ = manager.check_status().await;
                }
            });

            Ok(())
        })
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| {
            match event {
                SystemTrayEvent::MenuItemClick { id, .. } => {
                    match id.as_str() {
                        "show" => {
                            if let Some(window) = app.get_window("main") {
                                window.show().unwrap();
                                window.set_focus().unwrap();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app.get_window("main") {
                                window.hide().unwrap();
                            }
                        }
                        "quit" => {
                            std::process::exit(0);
                        }
                        _ => {}
                    }
                }
                SystemTrayEvent::LeftClick { .. } => {
                    if let Some(window) = app.get_window("main") {
                        if window.is_visible().unwrap() {
                            window.hide().unwrap();
                        } else {
                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_project_file,
            commands::write_file,
            commands::git_commit,
            commands::git_status,
            commands::spawn_ollama,
            commands::stop_ollama,
            commands::ollama_status,
            commands::watch_project,
            commands::send_notification,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_creation() {
        let state = AppState {
            ollama_manager: Arc::new(Mutex::new(ollama_manager::OllamaManager::new())),
            sync_engine: Arc::new(Mutex::new(electric_sync::ElectricSync::new())),
        };
        // State created successfully
        assert!(Arc::strong_count(&state.ollama_manager) > 0);
    }
}
