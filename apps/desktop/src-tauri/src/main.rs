// Space Send — macOS shell.
// Loads the same web UI and adds native superpowers. The signature one is
// background hosting + prevent-sleep: while a Beam is live the Mac must stay
// awake, even with the lid action or idle timer. We use macOS `caffeinate`.
#![cfg_attr(all(not(debug_assertions), target_os = "macos"), windows_subsystem = "windows")]

use std::process::Child;
use std::sync::Mutex;
use tauri::State;

#[derive(Default)]
struct SleepGuard(Mutex<Option<Child>>);

/// Keep the machine awake (display + system) while hosting a Beam.
#[tauri::command]
fn prevent_sleep(state: State<SleepGuard>) -> Result<bool, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Ok(true);
    }
    #[cfg(target_os = "macos")]
    {
        // -d prevent display sleep, -i idle, -m disk, -s system, -u declare user active
        let child = std::process::Command::new("caffeinate")
            .arg("-dimsu")
            .spawn()
            .map_err(|e| e.to_string())?;
        *guard = Some(child);
    }
    Ok(true)
}

/// Release keep-awake once all transfers are done.
#[tauri::command]
fn allow_sleep(state: State<SleepGuard>) -> Result<bool, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
    }
    Ok(false)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(SleepGuard::default())
        .invoke_handler(tauri::generate_handler![prevent_sleep, allow_sleep])
        .run(tauri::generate_context!())
        .expect("error while running Space Send");
}
