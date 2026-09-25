//! Process liveness checks for the Electron app managed by the updater.

use crate::config::RuntimeConfig;
use anyhow::{Context, Result};
use std::{
    fs,
    path::{Path, PathBuf},
};

/// Detects whether the managed Electron app is currently running.
pub fn is_app_running(config: &RuntimeConfig) -> Result<bool> {
    scan_proc_for_executable(&config.app_executable_path)
}

fn scan_proc_for_executable(expected: &Path) -> Result<bool> {
    let proc_dir = Path::new("/proc");
    for entry in fs::read_dir(proc_dir).context("Failed to read /proc")? {
        let entry = entry?;
        let Some(file_name) = entry.file_name().to_str().map(str::to_string) else {
            continue;
        };
        let Ok(pid) = file_name.parse::<u32>() else {
            continue;
        };

        if process_matches(pid, expected) {
            return Ok(true);
        }
    }

    Ok(false)
}

fn process_matches(pid: u32, expected: &Path) -> bool {
    is_process_alive(pid)
        && read_exe_link(pid)
            .map(|path| path == expected)
            .unwrap_or(false)
}

fn is_process_alive(pid: u32) -> bool {
    Path::new("/proc").join(pid.to_string()).exists()
}

fn read_exe_link(pid: u32) -> Result<PathBuf> {
    fs::read_link(Path::new("/proc").join(pid.to_string()).join("exe"))
        .with_context(|| format!("Failed to read /proc/{pid}/exe"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::Result;

    #[test]
    fn current_process_is_not_mistaken_for_electron() -> Result<()> {
        let mut config = crate::config::RuntimeConfig::default_with_paths(
            &crate::config::RuntimePaths::detect()?,
        );
        config.app_executable_path = PathBuf::from("/opt/codex-desktop/ChatGPT");

        assert!(!process_matches(
            std::process::id(),
            &config.app_executable_path
        ));
        Ok(())
    }
}
